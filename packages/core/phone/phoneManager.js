const fs = require('fs');
const path = require('path');
const db = require('../database');
const vehicleManager = require('../vehicles/vehicleManager'); 
const webServer = require('../../webserver');


if (!fs.existsSync(webServer.photosDir)){
    fs.mkdirSync(webServer.photosDir, { recursive: true });
}

mp.events.add('server:photo:save', async (player, base64Data) => {
    if (!player.logged) return;

    try {
        const timestamp = Date.now();
        const filename = `${player.data.dbId}_${timestamp}.png`;
        const filePath = path.join(webServer.photosDir, filename);

        // 1. Write file to disk
        fs.writeFile(filePath, base64Data, 'base64', async (err) => {
            if (err) {
                console.error(`[Photo] Save Error: ${err.message}`);
                player.notify("~r~Server failed to save photo.");
                return;
            }

            // 2. Save Reference to Database
            // We store the filename. The gallery will prepend the webServer URL.
            await db.query(
                "INSERT INTO player_photos (user_id, image_path) VALUES (?, ?)", 
                [player.data.dbId, filename]
            );

            player.notify("~g~Photo saved to Gallery!");
            console.log(`[Photo] Saved ${filename} for ${player.name}`);
        });

    } catch (err) {
        console.error("[Photo] Error:", err);
    }
});

// API for Gallery App to fetch photos
mp.events.add('server:phone:requestPhotos', async (player) => {
    if (!player.logged) return;
    try {
        const [rows] = await db.query(
            "SELECT id, image_path FROM player_photos WHERE user_id = ? ORDER BY id DESC LIMIT 20",
            [player.data.dbId]
        );

        // Construct full URLs
        const photos = rows.map(r => ({
            id: r.id,
            url: webServer.baseUrl + r.image_path // e.g., http://localhost:3000/photos/1_123456.png
        }));

        player.call('client:phone:receivePhotos', [JSON.stringify(photos)]);
    } catch (err) {
        console.error(err);
    }
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