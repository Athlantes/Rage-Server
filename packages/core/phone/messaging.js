const db = require('../database');

module.exports = {
    // We can export helper functions if needed
};

// --- EVENTS ---

// 1. Load Conversations
mp.events.add('server:phone:chat:fetchChats', async (player) => {
    if (!player.logged || !player.data.phone) return;
    const myNumber = player.data.phone; 

    try {
        const [chats] = await db.query(`
            SELECT 
                pm.*,
                CASE 
                    WHEN pm.sender_number = ? THEN pm.receiver_number 
                    ELSE pm.sender_number 
                END AS other_party,
                COALESCE(pc.contact_name, pm.sender_number) as display_name
            FROM phone_messages pm
            LEFT JOIN phone_contacts pc ON (pc.owner_id = ? AND pc.contact_number = 
                CASE 
                    WHEN pm.sender_number = ? THEN pm.receiver_number 
                    ELSE pm.sender_number 
                END
            )
            WHERE id IN (
                SELECT MAX(id) 
                FROM phone_messages 
                WHERE sender_number = ? OR receiver_number = ? 
                GROUP BY 
                    CASE 
                        WHEN sender_number = ? THEN receiver_number 
                        ELSE sender_number 
                    END
            )
            ORDER BY created_at DESC
        `, [myNumber, player.data.dbId, myNumber, myNumber, myNumber, myNumber]);

        player.call('client:phone:chat:loadChats', [JSON.stringify(chats)]);
    } catch (err) {
        console.error("Fetch Chats Error:", err);
    }
});

// 2. Load Messages
mp.events.add('server:phone:chat:fetchMessages', async (player, targetNumber) => {
    if (!player.logged || !player.data.phone) return;
    const myNumber = player.data.phone;

    try {
        const [msgs] = await db.query(`
            SELECT * FROM phone_messages 
            WHERE (sender_number = ? AND receiver_number = ?) 
               OR (sender_number = ? AND receiver_number = ?)
            ORDER BY created_at ASC
            LIMIT 50
        `, [myNumber, targetNumber, targetNumber, myNumber]);

        await db.query(`
            UPDATE phone_messages SET is_read = 1 
            WHERE sender_number = ? AND receiver_number = ?
        `, [targetNumber, myNumber]);

        player.call('client:phone:chat:loadHistory', [targetNumber, JSON.stringify(msgs)]);
    } catch (err) {
        console.error("Fetch Messages Error:", err);
    }
});

// 3. Send Message
mp.events.add('server:phone:chat:send', async (player, targetNumber, content, type = 'text') => {
    if (!player.logged || !player.data.phone) return;
    const myNumber = player.data.phone;

    try {
        const [result] = await db.query(`
            INSERT INTO phone_messages (sender_number, receiver_number, message, type)
            VALUES (?, ?, ?, ?)
        `, [myNumber, targetNumber, content, type]);

        const msgId = result.insertId;
        const timestamp = new Date().toISOString();

        player.call('client:phone:chat:messageSent', [targetNumber, content, type, timestamp, msgId]);

        const targetPlayer = mp.players.toArray().find(p => p.data.phone === targetNumber);
        
        if (targetPlayer) {
            targetPlayer.call('client:phone:chat:receive', [myNumber, content, type, timestamp, msgId]);
        }

    } catch (err) {
        console.error("Send Message Error:", err);
    }
});

// --- NEW: CONTACTS SYSTEM ---

// 4. Fetch Contacts
mp.events.add('server:phone:contacts:fetch', async (player) => {
    if (!player.logged) return;
    
    try {
        const [contacts] = await db.query(`SELECT * FROM phone_contacts WHERE owner_id = ?`, [player.data.dbId]);
        player.call('client:phone:contacts:load', [JSON.stringify(contacts)]);
    } catch(err) {
        console.error("Fetch Contacts Error:", err);
    }
});

// 5. Add Contact
mp.events.add('server:phone:contacts:add', async (player, name, number) => {
    if (!player.logged) return;
    if (!name || !number) return;

    try {
        // Check duplication
        const [exists] = await db.query(`SELECT id FROM phone_contacts WHERE owner_id = ? AND contact_number = ?`, [player.data.dbId, number]);
        
        if (exists.length > 0) {
            // Update name if exists
             await db.query(`UPDATE phone_contacts SET contact_name = ? WHERE id = ?`, [name, exists[0].id]);
        } else {
             await db.query(`INSERT INTO phone_contacts (owner_id, contact_name, contact_number) VALUES (?, ?, ?)`, [player.data.dbId, name, number]);
        }
        
        // Refresh client
        mp.events.call('server:phone:contacts:fetch', player);
        // Also refresh chat list names
        mp.events.call('server:phone:chat:fetchChats', player);
        
    } catch(err) {
        console.error("Add Contact Error:", err);
    }
});