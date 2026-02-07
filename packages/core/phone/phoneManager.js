const fs = require('fs');
const path = require('path');
const db = require('../database');
const vehicleManager = require('../vehicles/vehicleManager'); 
const webServer = require('../../webserver');

const uploadCache = new Map();

mp.events.add('server:photo:initUpload', (player, totalChunks) => {
    if (!player.logged) return;
    
    // [FIX] Ensure totalChunks is a valid number
    const total = parseInt(totalChunks);
    if (isNaN(total) || total <= 0) return;

    // Initialize an array with empty slots
    uploadCache.set(player.id, {
        chunks: new Array(total), 
        total: total,
        received: 0,
        timestamp: Date.now()
    });
});

mp.events.add('server:photo:receiveChunk', async (player, chunkData, index) => {
    if (!uploadCache.has(player.id)) return;

    const upload = uploadCache.get(player.id);
    
    // [FIX] DUPLICATE PROTECTION
    // If we already have a chunk at this index, ignore this packet.
    // This prevents 'upload.received' from counting the same chunk twice 
    // and saving the file before it is actually complete.
    if (upload.chunks[index] !== undefined) return;

    // Store chunk
    upload.chunks[index] = chunkData;
    upload.received++;

    // Only save when we have EVERY piece
    if (upload.received >= upload.total) {
        // Construct the full string
        const fullBase64 = upload.chunks.join('');
        
        uploadCache.delete(player.id); 
        
        savePhotoToDisk(player, fullBase64);
    }
});

async function savePhotoToDisk(player, base64Data) {
    try {
        // [FIX] TYPE SAFETY CHECK
        // If data is somehow not a string, stop here to prevent server crash.
        if (typeof base64Data !== 'string') {
            console.error(`[Photo] Critical Error: Received ${typeof base64Data} instead of string. Upload aborted.`);
            return;
        }

        const timestamp = Date.now();
        const userId = player.data.dbId || 0;
        const filename = `${userId}_${timestamp}.jpg`;
        const filePath = path.join(webServer.photosDir, filename);

        fs.writeFile(filePath, base64Data, 'base64', async (err) => {
            if (err) {
                console.error(`[Photo] Write Error: ${err.message}`);
                return;
            }

            await db.query(
                "INSERT INTO player_photos (user_id, image_path) VALUES (?, ?)", 
                [userId, filename]
            );

            console.log(`[Photo] Saved full image: ${filename}`);
        });
    } catch (err) {
        console.error("[Photo] Error:", err);
    }
}

// 1. Open Phone & Load Data
mp.events.add('server:phone:open', async (player) => {
    if (!player.logged) return;

    try {
        const [mails] = await db.query(
            "SELECT id, user_id, sender, title, message, is_read, created_at FROM player_mails " +
            "WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 3 DAY) " +
            "ORDER BY created_at DESC LIMIT 20", 
            [player.data.dbId]
        );
        
        const [photos] = await db.query(
            "SELECT id, image_path, created_at FROM player_photos WHERE user_id = ? ORDER BY created_at DESC",
            [player.data.dbId]
        );

        player.call('client:phone:initialize', [
            JSON.stringify(mails), 
            JSON.stringify(photos), 
            webServer.baseUrl
        ]);
        
        const cars = await vehicleManager.getPlayerVehicles(player.data.dbId);
        const processedCars = cars.map(c => {
            const activeVeh = vehicleManager.findActiveVehicle(c.id);
            return {
                id: c.id,
                model: c.model,
                plate: c.plate,
                fuel: c.fuel,
                parked: c.parked,
                spawned: !!activeVeh 
            };
        });
        
        player.call('client:phone:updateVehicles', [JSON.stringify(processedCars)]);

    } catch (err) {
        console.error("Phone Data Error:", err);
    }
});

// --- NEW: Dedicated Handlers for Mail ---

mp.events.add('server:phone:readAllMails', async (player) => {
    if (!player.logged) return;
    try {
        // Update all unread mails for this specific player
        await db.query("UPDATE player_mails SET is_read = 1 WHERE user_id = ? AND is_read = 0", [player.data.dbId]);
        
        // Refresh the phone data logic (Optional since client is optimistic, but good for sync)
        mp.events.call('server:phone:open', player);
    } catch (err) {
        console.error("Read All Mails Error:", err);
    }
});

mp.events.add('server:phone:readMail', async (player, id) => {
    if (!player.logged) return;
    try {
        const mailId = parseInt(id);
        await db.query(
            "UPDATE player_mails SET is_read = 1 WHERE id = ? AND user_id = ?", 
            [mailId, player.data.dbId]
        );
        // Silent update; no need to refresh entire phone for one read mail if UI handles it
    } catch (err) {
        console.error("Read Mail Error:", err);
    }
});

// 2. Handle Vehicle Actions
mp.events.add('server:phone:vehicleAction', async (player, action, id) => {
    if (!player.logged) return;

    try {
        const vehDbId = parseInt(id);

        if (action === 'spawn') {
            const veh = await vehicleManager.unparkVehicle(player, vehDbId);
            if (veh) {
                player.call('showNotification', ['Fleet', 'Vehicle spawned at parked location.']);
                player.call('client:setWaypoint', [veh.position.x, veh.position.y]);
            }
        } 
        else if (action === 'despawn') {
            const veh = vehicleManager.findActiveVehicle(vehDbId);
            if (!veh) return player.call('showNotification', ['Fleet', 'Vehicle not found.']);
            
            vehicleManager.despawnVehicle(veh);
            player.call('showNotification', ['Fleet', 'Vehicle towed to garage.']);
            mp.events.call('server:phone:open', player); 
        }
        else if (action === 'locate') {
            const veh = vehicleManager.findActiveVehicle(vehDbId);
            if (!veh) return player.call('showNotification', ['Fleet', 'Vehicle is in the garage.']);
            
            player.call('client:setWaypoint', [veh.position.x, veh.position.y]);
            player.call('showNotification', ['GPS', 'Vehicle location marked.']);
        }
    } catch (err) {
        console.error("Phone Action Error:", err);
    }
});

// API to send a mail
mp.events.add('server:phone:sendMail', async (targetId, sender, title, message) => {
    try {
        await db.query(
            "INSERT INTO player_mails (user_id, sender, title, message, is_read) VALUES (?, ?, ?, ?, 0)",
            [targetId, sender, title, message]
        );

        const target = mp.players.toArray().find(p => p.data.dbId === targetId);
        if (target) {
            mp.events.call('server:phone:open', target);
            target.call('client:phone:receiveMail', [sender, title, message]);
        }
    } catch (err) {
        console.error("Mail Send Error:", err);
    }
});

mp.events.add('server:phone:deletePhoto', async (player, photoId, photoPath) => {
    if (!player.logged) return;
    console.log(`[Phone] Deleting photo ${photoId} (${photoPath})`);
    
    try {
        // 1. Delete from Database
        await db.query("DELETE FROM player_photos WHERE id = ? AND user_id = ?", [photoId, player.data.dbId]);

        // 2. Delete from Disk
        const filePath = path.join(webServer.photosDir, photoPath);
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
                if (err) console.error("Failed to delete file:", err);
                else console.log("[Phone] File deleted from disk.");
            });
        }

        // 3. Notify and Refresh
        player.call('client:photo:log', [`Deleted photo.`]);
        // Refresh phone to update the grid
        mp.events.call('server:phone:open', player); 

    } catch (err) {
        console.error("Delete Photo Error:", err);
    }
});