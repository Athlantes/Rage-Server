const fs = require('fs');
const path = require('path');
const db = require('../database');
const vehicleManager = require('../vehicles/vehicleManager'); 
const webServer = require('../../webserver');

const uploadCache = new Map();

// --- PHOTO UPLOAD LOGIC ---
// Updated: Accepts 'filename' from client to ensure sync
mp.events.add('server:photo:initUpload', (player, totalChunks, filename) => {
    if (!player.logged) return;
    const total = parseInt(totalChunks);
    if (isNaN(total) || total <= 0) return;
    
    // Ensure DB ID is synced to client for future photos
    if (player.data.dbId && !player.getVariable('dbId')) {
        player.setVariable('dbId', player.data.dbId);
    }

    uploadCache.set(player.id, {
        chunks: new Array(total), 
        total: total,
        received: 0,
        filename: filename || `${player.data.dbId}_${Date.now()}.jpg`, 
        timestamp: Date.now()
    });
});

mp.events.add('server:photo:receiveChunk', async (player, chunkData, index) => {
    if (!uploadCache.has(player.id)) return;
    const upload = uploadCache.get(player.id);
    if (upload.chunks[index] !== undefined) return;

    upload.chunks[index] = chunkData;
    upload.received++;

    if (upload.received >= upload.total) {
        const fullBase64 = upload.chunks.join('');
        const finalName = upload.filename; 
        uploadCache.delete(player.id); 
        savePhotoToDisk(player, fullBase64, finalName);
    }
});

async function savePhotoToDisk(player, base64Data, filename) {
    try {
        if (typeof base64Data !== 'string') return;
        
        const safeFilename = path.basename(filename);
        const userId = player.data.dbId || 0;
        const filePath = path.join(webServer.photosDir, safeFilename);

        fs.writeFile(filePath, base64Data, 'base64', async (err) => {
            if (err) return console.error(`[Photo] Write Error: ${err.message}`);
            
            await db.query("INSERT INTO player_photos (user_id, image_path) VALUES (?, ?)", [userId, safeFilename]);
            console.log(`[Photo] Saved: ${safeFilename}`);

            // --- CRITICAL FIX: Tell Client the file is ready ---
            if (mp.players.exists(player)) {
                player.call('client:camera:uploadSuccess', [safeFilename]);
            }
        });
    } catch (err) {
        console.error("[Photo] Error:", err);
    }
}

// --- PHONE NUMBER LOGIC ---
async function generatePhoneNumber() {
    let isUnique = false;
    let newNumber = '';
    while (!isUnique) {
        newNumber = Math.floor(100000 + Math.random() * 900000).toString();
        const [rows] = await db.query("SELECT id FROM player_phone WHERE phone_number = ?", [newNumber]);
        if (rows.length === 0) isUnique = true;
    }
    return newNumber;
}

async function getPhoneSettings(userId) {
    try {
        const [rows] = await db.query("SELECT * FROM player_phone WHERE user_id = ?", [userId]);
        let settings;

        if (rows.length === 0) {
            await db.query("INSERT INTO player_phone (user_id) VALUES (?)", [userId]);
            settings = { user_id: userId, phone_number: null, wallpaper: 'wall1.jpg', is_dnd: 0, is_flight_mode: 0, zoom_level: 100 };
        } else {
            settings = rows[0];
        }

        if (!settings.phone_number) {
            const newNum = await generatePhoneNumber();
            await db.query("UPDATE player_phone SET phone_number = ? WHERE user_id = ?", [newNum, userId]);
            settings.phone_number = newNum;
        }
        return settings;
    } catch (err) {
        console.error("[Phone] Get Settings Error:", err);
        return null;
    }
}

// --- MAIN PHONE OPEN EVENT ---
mp.events.add('server:phone:open', async (player) => {
    if (!player.logged) return;

    try {
        const userId = player.data.dbId;
        
        // Sync DB ID to client if not already there (helper for camera)
        if (!player.getVariable('dbId')) player.setVariable('dbId', userId);

        const settings = await getPhoneSettings(userId);
        const myNumber = settings.phone_number;

        const [mails] = await db.query(
            "SELECT id, sender, title, message, is_read, created_at FROM player_mails WHERE user_id = ? ORDER BY created_at DESC LIMIT 20", 
            [userId]
        );

        const [photos] = await db.query(
            "SELECT id, image_path, created_at FROM player_photos WHERE user_id = ? ORDER BY created_at DESC",
            [userId]
        );

        const [contacts] = await db.query(
            "SELECT contact_name as name, contact_number as number FROM phone_contacts WHERE owner_id = ? ORDER BY contact_name ASC",
            [userId]
        );

        const [messagesRaw] = await db.query(
            "SELECT sender_number, receiver_number, message, type, created_at, is_read FROM phone_messages WHERE sender_number = ? OR receiver_number = ? ORDER BY created_at ASC",
            [myNumber, myNumber]
        );

        const messages = messagesRaw.map(msg => ({
            number: (msg.sender_number === myNumber) ? msg.receiver_number : msg.sender_number, 
            body: msg.message,
            type: msg.type || 'text',
            isMine: (msg.sender_number === myNumber),
            is_read: Number(msg.is_read),
            time: msg.created_at
        }));

        player.call('client:phone:initialize', [
            JSON.stringify(mails), 
            JSON.stringify(photos), 
            webServer.baseUrl,
            JSON.stringify(settings),
            JSON.stringify(contacts),
            JSON.stringify(messages)
        ]);
        
        const cars = await vehicleManager.getPlayerVehicles(userId);
        const processedCars = cars.map(c => {
            const activeVeh = vehicleManager.findActiveVehicle(c.id);
            return {
                id: c.id, model: c.model, plate: c.plate, fuel: c.fuel, parked: c.parked, spawned: !!activeVeh 
            };
        });
        player.call('client:phone:updateVehicles', [JSON.stringify(processedCars)]);

    } catch (err) {
        console.error("Phone Data Error:", err);
    }
});

mp.events.add('server:phone:markMessagesRead', async (player, targetNumber) => {
    if (!player.logged) return;
    try {
        const settings = await getPhoneSettings(player.data.dbId);
        const myNumber = settings.phone_number;

        await db.query(
            "UPDATE phone_messages SET is_read = 1 WHERE sender_number = ? AND receiver_number = ?",
            [targetNumber, myNumber]
        );
    } catch (err) {
        console.error("Mark Read Error:", err);
    }
});

// --- CONTACTS & SMS HANDLERS ---

mp.events.add('server:phone:addContact', async (player, name, number) => {
    if (!player.logged) return;
    try {
        await db.query("INSERT INTO phone_contacts (owner_id, contact_name, contact_number) VALUES (?, ?, ?)", 
            [player.data.dbId, name, number]);
    } catch (err) {
        console.error("Add Contact Error:", err);
    }
});

mp.events.add('server:phone:sendMail', async (targetId, sender, title, message) => {
    try {
        const [result] = await db.query(
            "INSERT INTO player_mails (user_id, sender, title, message, created_at, is_read) VALUES (?, ?, ?, ?, NOW(), 0)",
            [targetId, sender, title, message]
        );

        const targetPlayer = mp.players.toArray().find(p => p.logged && p.data.dbId === targetId);
        if (targetPlayer) {
            targetPlayer.call('client:phone:receiveMail', [result.insertId, sender, title, message]);
        }
    } catch (err) {
        console.error("[Phone] Send Mail Error:", err);
    }
});

mp.events.add('server:phone:sendSMS', async (player, targetNumber, body, type = 'text') => {
    if (!player.logged) return;
    try {
        const settings = await getPhoneSettings(player.data.dbId);
        const myNumber = settings.phone_number;

        await db.query(
            "INSERT INTO phone_messages (sender_number, receiver_number, message, type) VALUES (?, ?, ?, ?)",
            [myNumber, targetNumber, body, type]
        );

        const [rows] = await db.query("SELECT user_id FROM player_phone WHERE phone_number = ?", [targetNumber]);
        
        if (rows.length > 0) {
            const targetUserId = rows[0].user_id;
            const targetPlayer = mp.players.toArray().find(p => p.logged && p.data.dbId === targetUserId);

            if (targetPlayer) {
                targetPlayer.call('client:phone:receiveSMS', [myNumber, body, type]);
            }
        }
    } catch (err) {
        console.error("Send SMS Error:", err);
    }
});

mp.events.add('server:phone:startCall', (player, targetNumber) => {
    player.call('showNotification', ['Phone', 'Calling functionality coming soon...']);
});

// --- EXISTING HANDLERS ---

mp.events.add('server:phone:readAllMails', async (player) => {
    if (!player.logged) return;
    try {
        await db.query("UPDATE player_mails SET is_read = 1 WHERE user_id = ? AND is_read = 0", [player.data.dbId]);
        mp.events.call('server:phone:open', player);
    } catch (err) { console.error("Read All Mails Error:", err); }
});

mp.events.add('server:phone:readMail', async (player, id) => {
    if (!player.logged) return;
    try {
        await db.query("UPDATE player_mails SET is_read = 1 WHERE id = ? AND user_id = ?", [parseInt(id), player.data.dbId]);
    } catch (err) { console.error("Read Mail Error:", err); }
});

mp.events.add('server:phone:vehicleAction', async (player, action, id) => {
    if (!player.logged) return;
    try {
        const vehDbId = parseInt(id);
        if (action === 'spawn') {
            const veh = await vehicleManager.unparkVehicle(player, vehDbId);
            if (veh) {
                player.call('showNotification', ['Fleet', 'Vehicle spawned.']);
                player.call('client:setWaypoint', [veh.position.x, veh.position.y]);
            }
        } else if (action === 'despawn') {
            const veh = vehicleManager.findActiveVehicle(vehDbId);
            if (!veh) return player.call('showNotification', ['Fleet', 'Vehicle not found.']);
            vehicleManager.despawnVehicle(veh);
            player.call('showNotification', ['Fleet', 'Vehicle towed.']);
            mp.events.call('server:phone:open', player); 
        } else if (action === 'locate') {
            const veh = vehicleManager.findActiveVehicle(vehDbId);
            if (!veh) return player.call('showNotification', ['Fleet', 'Vehicle is in garage.']);
            player.call('client:setWaypoint', [veh.position.x, veh.position.y]);
            player.call('showNotification', ['GPS', 'Location marked.']);
        }
    } catch (err) { console.error("Phone Action Error:", err); }
});

mp.events.add('server:phone:deletePhoto', async (player, photoId, photoPath) => {
    if (!player.logged) return;
    try {
        await db.query("DELETE FROM player_photos WHERE id = ? AND user_id = ?", [photoId, player.data.dbId]);
        /*const filePath = path.join(webServer.photosDir, photoPath);
        if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});*/
        player.call('client:photo:log', [`Deleted photo.`]);
        mp.events.call('server:phone:open', player); 
    } catch (err) { console.error("Delete Photo Error:", err); }
});

mp.events.add('server:phone:saveSetting', async (player, key, value) => {
    if (!player.logged) return;
    const allowedKeys = ['wallpaper', 'is_dnd', 'is_flight_mode', 'is_silent', 'zoom_level'];
    if (!allowedKeys.includes(key)) return;
    try {
        await db.query(`UPDATE player_phone SET ${key} = ? WHERE user_id = ?`, [value, player.data.dbId]);
    } catch (err) { console.error(`[Phone] Save Error (${key}):`, err); }
});