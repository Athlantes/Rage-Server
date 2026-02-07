const fs = require('fs');
const path = require('path');
const db = require('../database');
const vehicleManager = require('../vehicles/vehicleManager'); 
const webServer = require('../../webserver');

const uploadCache = new Map();

mp.events.add('server:photo:initUpload', (player, totalChunks) => {
    if (!player.logged) return;
    
    // Initialize an array with empty slots
    uploadCache.set(player.id, {
        chunks: new Array(totalChunks), // Create empty slots
        total: totalChunks,
        received: 0,
        timestamp: Date.now()
    });
});

mp.events.add('server:photo:receiveChunk', async (player, chunkData, index) => {
    if (!uploadCache.has(player.id)) return;

    const upload = uploadCache.get(player.id);
    
    // Store chunk in the specific slot (Correct Order)
    upload.chunks[index] = chunkData;
    upload.received++;

    // Only save when we have EVERY piece
    if (upload.received >= upload.total) {
        const fullBase64 = upload.chunks.join('');
        
        uploadCache.delete(player.id); 
        
        savePhotoToDisk(player, fullBase64);
    }
});

async function savePhotoToDisk(player, base64Data) {
    try {
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

            player.notify("~g~Photo uploaded successfully!");
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
        console.log(`[Phone] Opening for ${player.name}`);

        // Load Mails (Safe Fallback)
        let mails = [];
        try {
            const [mailRows] = await db.query(
                "SELECT id, sender, title, message, is_read, created_at FROM player_mails WHERE user_id = ? ORDER BY created_at DESC LIMIT 20", 
                [player.data.dbId]
            );
            mails = mailRows || [];
        } catch(e) { console.error("[Phone] Mail Error:", e.message); }
        
        // Load Photos (Safe Fallback)
        let photos = [];
        try {
            const [photoRows] = await db.query(
                "SELECT id, image_path, created_at FROM player_photos WHERE user_id = ?",
                [player.data.dbId]
            );
            photos = photoRows || [];
            console.log(`[Phone] Photos found in DB: ${photos.length}`);
        } catch (e) { console.error("[Phone] Photo Error:", e.message); }

        // Get URL with fallback
        const mediaUrl = webServer.baseUrl || "http://localhost:8080/"; 

        // Send to client
        player.call('client:phone:initialize', [
            JSON.stringify(mails), 
            JSON.stringify(photos), 
            mediaUrl
        ]);

    } catch (err) {
        console.error("[Phone] Critical Error:", err);
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