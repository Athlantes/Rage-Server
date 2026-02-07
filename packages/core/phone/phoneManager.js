const fs = require('fs');
const path = require('path');
const db = require('../database');
const vehicleManager = require('../vehicles/vehicleManager'); 
const webServer = require('../../webserver');

const uploadCache = new Map();

// 1. Initialize Upload
mp.events.add('server:photo:initUpload', (player, totalChunks) => {
    if (!player.logged) return;
    uploadCache.set(player.id, {
        chunks: [],
        total: totalChunks,
        timestamp: Date.now()
    });
});

// 2. Receive Chunk
mp.events.add('server:photo:receiveChunk', async (player, chunkData) => {
    if (!uploadCache.has(player.id)) return;

    const upload = uploadCache.get(player.id);
    upload.chunks.push(chunkData);

    // If all chunks received, save the file
    if (upload.chunks.length >= upload.total) {
        // Join all chunks back into one string
        const fullBase64 = upload.chunks.join('');
        uploadCache.delete(player.id); // Clear memory
        
        savePhotoToDisk(player, fullBase64);
    }
});

async function savePhotoToDisk(player, base64Data) {
    try {
        const timestamp = Date.now();
        const userId = player.data.dbId || 0;
        const filename = `${userId}_${timestamp}.png`;
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

            player.notify("~g~Photo uploaded successfully!");
            console.log(`[Photo] Saved full image: ${filename}`);
        });
    } catch (err) {
        console.error("[Photo] Error:", err);
    }
}

// Ensure you keep your existing 'server:phone:requestPhotos' event here
mp.events.add('server:phone:requestPhotos', async (player) => {
    const userId = player.data.dbId || 0;
    try {
        const [rows] = await db.query(
            "SELECT id, image_path FROM player_photos WHERE user_id = ? ORDER BY id DESC LIMIT 20",
            [userId]
        );
        const photos = rows.map(r => ({
            id: r.id,
            url: webServer.baseUrl + r.image_path 
        }));
        player.call('client:phone:receivePhotos', [JSON.stringify(photos)]);
    } catch (err) { console.error(err); }
});

// 1. Open Phone & Load Data
mp.events.add('server:phone:open', async (player) => {
    if (!player.logged) return;

    try {
        // Load Mails
        const [mails] = await db.query(
            "SELECT id, user_id, sender, title, message, is_read, created_at FROM player_mails " +
            "WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 3 DAY) " +
            "ORDER BY created_at DESC LIMIT 20", 
            [player.data.dbId]
        );
        player.call('client:phone:initialize', [JSON.stringify(mails)]);
        
        // Load Vehicles
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

mp.events.add('server:phone:readMail', async (player, id) => {
    if (!player.logged) return;
    try {
        const mailId = parseInt(id);
        
        // 1. Update database
        await db.query(
            "UPDATE player_mails SET is_read = 1 WHERE id = ? AND user_id = ?", 
            [mailId, player.data.dbId]
        );
        
    } catch (err) {
        console.error("Read Mail Error:", err);
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