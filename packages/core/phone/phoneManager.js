const fs = require('fs');
const path = require('path');
const db = require('../database');
const vehicleManager = require('../vehicles/vehicleManager'); 
const { catalog } = require('../../data/dealershipCatalog');
const webServer = require('../../webserver');
const CallManager = require('../voiceManager');

const uploadCache = new Map();

// --- PHOTO UPLOAD LOGIC ---
// Updated: Accepts 'filename' from client to ensure sync
mp.events.add('server:photo:initUpload', (player, totalChunks, filename) => {
    console.log(`[Upload] server:photo:initUpload from ${player.name}: chunks=${totalChunks}, filename=${filename}`);
    if (!player.logged) { console.log('[Upload] REJECTED: player not logged'); return; }
    const total = parseInt(totalChunks);
    if (isNaN(total) || total <= 0) { console.log('[Upload] REJECTED: invalid totalChunks'); return; }
    
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
    if (!uploadCache.has(player.id)) { console.log(`[Upload] receiveChunk REJECTED: no cache for player ${player.id}`); return; }
    const upload = uploadCache.get(player.id);
    if (upload.chunks[index] !== undefined) return;

    upload.chunks[index] = chunkData;
    upload.received++;

    if (upload.received >= upload.total) {
        console.log(`[Upload] All ${upload.total} chunks received for ${upload.filename}, assembling...`);
        const fullBase64 = upload.chunks.join('');
        const finalName = upload.filename; 
        uploadCache.delete(player.id); 
        savePhotoToDisk(player, fullBase64, finalName);
    }
});

async function savePhotoToDisk(player, base64Data, filename) {
    try {
        if (typeof base64Data !== 'string') { console.log('[Photo] REJECTED: base64Data is not a string'); return; }
        
        const safeFilename = path.basename(filename);
        const userId = player.data.dbId || 0;
        const isMugshot = safeFilename.startsWith('mugshot_');
        const saveDir = isMugshot ? webServer.mugshotsDir : webServer.photosDir;
        const filePath = path.join(saveDir, safeFilename);

        console.log(`[Photo] savePhotoToDisk: file=${safeFilename}, isMugshot=${isMugshot}, dir=${saveDir}, fullPath=${filePath}, base64Length=${base64Data.length}`);

        fs.writeFile(filePath, base64Data, 'base64', async (err) => {
            if (err) return console.error(`[Photo] Write Error: ${err.message}`);
            
            if (isMugshot) {
                console.log(`[Mugshot] Saved: ${safeFilename}`);
                if (mp.players.exists(player)) {
                    player.outputChatBox(`!{00FF00}[Mugshot] Mugshot saved successfully.`);
                    player.call('client:mugshot:uploadSuccess', [safeFilename]);
                }
            } else {
                await db.query("INSERT INTO player_photos (user_id, image_path) VALUES (?, ?)", [userId, safeFilename]);
                console.log(`[Photo] Saved: ${safeFilename}`);
                if (mp.players.exists(player)) {
                    player.call('client:camera:uploadSuccess', [safeFilename]);
                }
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
        // Inject mugshot URL into settings for the phone UI
        settings.mugshot = player.data.mugshot ? (webServer.mugshotsUrl + player.data.mugshot) : null;
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
            const catEntry = catalog.find(v => v.model === c.model);
            return {
                id: c.id, model: c.model, plate: c.plate, fuel: c.fuel, parked: c.parked, spawned: !!activeVeh,
                displayName: catEntry ? catEntry.name : c.model,
                type: catEntry ? catEntry.type : 'Unknown',
                grade: catEntry ? catEntry.grade : '?',
                sellPrice: catEntry ? Math.floor(catEntry.price * 0.4) : 0
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

// =============================================
// --- PHONE CALL SYSTEM ---
// =============================================
const pendingCalls = new Map(); // callerId -> { targetId, timeout, targetNumber }
const RING_TIMEOUT_MS = 30000; // 30 seconds to answer

function findPlayerByPhone(phoneNumber) {
    const players = mp.players.toArray();
    for (const p of players) {
        if (p && mp.players.exists(p) && p.logged && p.data && p.data.phoneNumber === phoneNumber) {
            return p;
        }
    }
    return null;
}

function cleanupCall(playerId, reason) {
    const pending = pendingCalls.get(playerId);
    if (pending) {
        clearTimeout(pending.timeout);
        pendingCalls.delete(playerId);
        pendingCalls.delete(pending.targetId);
    }

    const partnerId = CallManager.endCall(playerId);
    const player = mp.players.at(playerId);
    if (player && mp.players.exists(player)) {
        player.setVariable('callPartnerId', null);
        player.setVariable('callState', null);
        player.call('client:phone:callEnded', [reason || 'Call ended.']);
    }
    if (partnerId !== undefined) {
        const partner = mp.players.at(partnerId);
        if (partner && mp.players.exists(partner)) {
            partner.setVariable('callPartnerId', null);
            partner.setVariable('callState', null);
            partner.call('client:phone:callEnded', [reason || 'Call ended.']);
        }
    }
}

// --- START CALL ---
mp.events.add('server:phone:startCall', async (player, targetNumber) => {
    if (!player.logged) return;

    // Already in a call or ringing?
    if (CallManager.isInCall(player.id) || pendingCalls.has(player.id)) {
        return player.call('showNotification', ['Phone', 'You are already in a call.']);
    }

    // Can't call yourself
    if (player.data.phoneNumber === targetNumber) {
        return player.call('showNotification', ['Phone', 'You cannot call yourself.']);
    }

    // Find target player
    const target = findPlayerByPhone(targetNumber);
    if (!target) {
        return player.call('client:phone:callEnded', ['Number not reachable.']);
    }

    // Check if target is busy
    if (CallManager.isInCall(target.id) || pendingCalls.has(target.id)) {
        return player.call('client:phone:callEnded', ['Line busy.']);
    }

    // Check DND / flight mode
    try {
        const [rows] = await db.query('SELECT is_dnd, is_flight_mode FROM player_phone WHERE user_id = ?', [target.data.dbId]);
        if (rows.length > 0 && (rows[0].is_dnd || rows[0].is_flight_mode)) {
            return player.call('client:phone:callEnded', ['Number not reachable.']);
        }
    } catch (err) { console.error('[Phone Call] DND check error:', err); }

    // Set up pending call with timeout
    const timeout = setTimeout(() => {
        if (pendingCalls.has(player.id)) {
            pendingCalls.delete(player.id);
            pendingCalls.delete(target.id);
            player.call('client:phone:callEnded', ['No answer.']);
            target.call('client:phone:callEnded', ['Missed call.']);
            player.setVariable('callState', null);
            target.setVariable('callState', null);
        }
    }, RING_TIMEOUT_MS);

    pendingCalls.set(player.id, { targetId: target.id, timeout, targetNumber });
    pendingCalls.set(target.id, { targetId: player.id, timeout, targetNumber: player.data.phoneNumber });

    player.setVariable('callState', 'ringing');
    target.setVariable('callState', 'ringing');

    // Notify both sides
    player.call('client:phone:callRinging', [targetNumber, target.name]);
    target.call('client:phone:incomingCall', [player.data.phoneNumber, player.name]);
});

// --- ACCEPT CALL ---
mp.events.add('server:phone:acceptCall', (player) => {
    if (!player.logged) return;
    const pending = pendingCalls.get(player.id);
    if (!pending) return player.call('showNotification', ['Phone', 'No incoming call.']);

    const caller = mp.players.at(pending.targetId);
    if (!caller || !mp.players.exists(caller)) {
        pendingCalls.delete(player.id);
        return player.call('client:phone:callEnded', ['Caller disconnected.']);
    }

    // Clear timeout & pending state
    clearTimeout(pending.timeout);
    pendingCalls.delete(player.id);
    pendingCalls.delete(caller.id);

    // Start voice routing via CallManager
    CallManager.startCall(caller.id, player.id);

    caller.setVariable('callPartnerId', player.id);
    player.setVariable('callPartnerId', caller.id);
    caller.setVariable('callState', 'active');
    player.setVariable('callState', 'active');

    // Notify both sides call is connected
    caller.call('client:phone:callConnected', [player.data.phoneNumber, player.name]);
    player.call('client:phone:callConnected', [caller.data.phoneNumber, caller.name]);
});

// --- DECLINE CALL ---
mp.events.add('server:phone:declineCall', (player) => {
    if (!player.logged) return;
    const pending = pendingCalls.get(player.id);
    if (!pending) return;

    const caller = mp.players.at(pending.targetId);
    clearTimeout(pending.timeout);
    pendingCalls.delete(player.id);

    player.setVariable('callState', null);
    player.call('client:phone:callEnded', ['Call declined.']);

    if (caller && mp.players.exists(caller)) {
        pendingCalls.delete(caller.id);
        caller.setVariable('callState', null);
        caller.call('client:phone:callEnded', ['Call declined.']);
    }
});

// --- END CALL (Hang up active or ringing) ---
mp.events.add('server:phone:endCall', (player) => {
    if (!player.logged) return;

    // If ringing (pending), treat as decline
    if (pendingCalls.has(player.id)) {
        const pending = pendingCalls.get(player.id);
        const other = mp.players.at(pending.targetId);
        clearTimeout(pending.timeout);
        pendingCalls.delete(player.id);
        player.setVariable('callState', null);
        player.call('client:phone:callEnded', ['Call cancelled.']);
        if (other && mp.players.exists(other)) {
            pendingCalls.delete(other.id);
            other.setVariable('callState', null);
            other.call('client:phone:callEnded', ['Call cancelled.']);
        }
        return;
    }

    // If active call
    if (CallManager.isInCall(player.id)) {
        cleanupCall(player.id, 'Call ended.');
    }
});

// --- CLEANUP ON DISCONNECT ---
mp.events.add('playerQuit', (player) => {
    if (pendingCalls.has(player.id)) {
        const pending = pendingCalls.get(player.id);
        clearTimeout(pending.timeout);
        const other = mp.players.at(pending.targetId);
        pendingCalls.delete(player.id);
        if (other && mp.players.exists(other)) {
            pendingCalls.delete(other.id);
            other.setVariable('callState', null);
            other.call('client:phone:callEnded', ['Caller disconnected.']);
        }
    }
    // Active call cleanup is handled by voiceManager playerQuit event
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
            vehicleManager.startVehicleLocator(player, veh, 'Personal Vehicle');
            player.call('showNotification', ['GPS', 'Live vehicle tracker enabled.']);
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