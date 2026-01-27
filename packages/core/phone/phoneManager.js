const db = require('../database');
const vehicleManager = require('../vehicles/vehicleManager'); 

// 1. Open Phone & Load Data
mp.events.add('server:phone:open', async (player) => {
    if (!player.logged) return;

    try {
        // Load Mails - Added is_read to the selection
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

// 2. Handle Actions from Phone (Vehicles & Mail)
mp.events.add('server:phone:vehicleAction', async (player, action, id) => {
    if (!player.logged) return;

    try {
        // --- NEW: Handle Reading Mails ---
        if (action === 'readMail') {
            const mailId = parseInt(id);
            // Update the mail to read status in DB
            await db.query(
                "UPDATE player_mails SET is_read = 1 WHERE id = ? AND user_id = ?", 
                [mailId, player.data.dbId]
            );
            
            // Refresh the mail list immediately to update UI colors/badges
            const [mails] = await db.query(
                "SELECT id, user_id, sender, title, message, is_read, created_at FROM player_mails " +
                "WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 3 DAY) " +
                "ORDER BY created_at DESC LIMIT 20", 
                [player.data.dbId]
            );
            player.call('client:phone:initialize', [JSON.stringify(mails)]);
            return;
        } else if (action === 'readAllMails') {
            // Update all unread mails for this specific player
            await db.query("UPDATE player_mails SET is_read = 1 WHERE user_id = ? AND is_read = 0", [player.data.dbId]);
            
            // Refresh the phone data so the badges and colors update immediately
            mp.events.call('server:phone:open', player);
        }

        // --- Existing Vehicle Actions ---
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
            // 1. Refresh the mail list data (Existing)
            mp.events.call('server:phone:open', target);

            target.call('client:phone:receiveMail', [sender, title, message]);
        }
    } catch (err) {
        console.error("Mail Send Error:", err);
    }
});