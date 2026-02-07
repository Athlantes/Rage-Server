const db = require('../database');

module.exports = {
    // We can export helper functions if needed
};

// --- EVENTS ---

// 1. Load Conversations (The "Home Screen" of the app)
mp.events.add('server:phone:chat:fetchChats', async (player) => {
    if (!player.logged || !player.data.phone) return;
    const myNumber = player.data.phone; // Assuming you store this on login/phone open

    try {
        // Complex query to get the LAST message of every conversation
        // This makes it look like WhatsApp (sorted by recent)
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

// 2. Load Messages for ONE specific conversation
mp.events.add('server:phone:chat:fetchMessages', async (player, targetNumber) => {
    if (!player.logged || !player.data.phone) return;
    const myNumber = player.data.phone;

    try {
        // Fetch history
        const [msgs] = await db.query(`
            SELECT * FROM phone_messages 
            WHERE (sender_number = ? AND receiver_number = ?) 
               OR (sender_number = ? AND receiver_number = ?)
            ORDER BY created_at ASC
            LIMIT 50
        `, [myNumber, targetNumber, targetNumber, myNumber]);

        // Mark them as read (Blue Ticks) since we opened the chat
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
        // 1. Save to DB
        const [result] = await db.query(`
            INSERT INTO phone_messages (sender_number, receiver_number, message, type)
            VALUES (?, ?, ?, ?)
        `, [myNumber, targetNumber, content, type]);

        const msgId = result.insertId;
        const timestamp = new Date().toISOString();

        // 2. Return to Sender (to append to UI immediately with "Sent" checkmark)
        player.call('client:phone:chat:messageSent', [targetNumber, content, type, timestamp, msgId]);

        // 3. Find Receiver (Real-time Push)
        // We need to find if the player with that number is online
        const targetPlayer = mp.players.toArray().find(p => p.data.phone === targetNumber);
        
        if (targetPlayer) {
            targetPlayer.call('client:phone:chat:receive', [myNumber, content, type, timestamp, msgId]);
            // Optional: Play notification sound here
        }

    } catch (err) {
        console.error("Send Message Error:", err);
    }
});