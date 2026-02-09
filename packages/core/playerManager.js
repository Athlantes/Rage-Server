// core/playerManager.js
const db = require('./database');

const playerManager = {
    // Standard memory update (use for temporary items or HUD sync)
    addMoney: (player, amount, reason = "Unknown") => {
        if (!player || !mp.players.exists(player)) return false;
        player.data.money += amount;
        player.setVariable('money', player.data.money);
        console.log(`[Economy] ${player.name} gained $${amount} (${reason}). Total: ${player.data.money}`);
        return true;
    },

    /**
     * SECURE PAYOUT: Updates memory AND immediately persists to DB.
     * Essential for Job Rewards to prevent loss on server crash.
     */
    addMoneyAndSave: async (player, amount, reason = "Job Reward") => {
        if (!player || !mp.players.exists(player)) return false;

        // 1. Update Memory immediately so UI stays snappy
        player.data.money += amount;
        player.setVariable('money', player.data.money);

        // 2. Immediate Database Write
        try {
            const dbId = player.data.dbId;
            if (!dbId) return false;

            // Use additive SQL logic to prevent race conditions
            await db.query("UPDATE users SET money = money + ? WHERE id = ?", [amount, dbId]);
            
            console.log(`[Economy-Secure] ${player.name} +$${amount} (${reason}). DB Synced.`);
            return true;
        } catch (err) {
            console.error(`[CRITICAL] Failed to save money for ${player.name}:`, err);
            // Even if DB fails, memory is updated, but we log the error for admins
            return false;
        }
    },

    removeMoneyAndSave: async (player, amount, reason = "Unknown") => {
        if (!player || !mp.players.exists(player)) return false;
        
        // Check balance before proceeding
        if (player.data.money < amount) return false;

        // 1. Update Memory immediately
        player.data.money -= amount;
        player.setVariable('money', player.data.money);

        // 2. Immediate Database Write
        try {
            const dbId = player.data.dbId;
            if (!dbId) return false;

            // Use subtractive SQL logic
            await db.query("UPDATE users SET money = money - ? WHERE id = ?", [amount, dbId]);

            console.log(`[Economy-Secure] ${player.name} -$${amount} (${reason}). DB Synced.`);
            return true;
        } catch (err) {
            console.error(`[CRITICAL] Failed to sync money removal for ${player.name}:`, err);
            // Note: Money was already removed from memory.
            return false;
        }
    },

    saveAccount: async (player) => {
        if (!mp.players.exists(player) || !player.logged || !player.data.dbId) return;

        const name = player.name; 
        const dbId = player.data.dbId;
        const level = player.data.level;
        let currentPos;

        try {
            currentPos = JSON.stringify(player.position);
        } catch (err) {
            currentPos = JSON.stringify(new mp.Vector3(-1037, -2738, 13));
        }

        try {
            await db.query(
                "UPDATE users SET level=?, position=? WHERE id=?", 
                [level, currentPos, dbId]
            );
            console.log(`[Data] Saved account: ${name}`);
        } catch (e) {
            console.error(`[Data] Failed to save ${name}:`, e);
        }
    }
};

module.exports = playerManager;

// --- SPAWN POINTS ---
const spawnPoints = [
    { x: 206.56, y: -909.89, z: 30.29 },
    { x: 384.62, y: 260.67, z: 91.00 },
    { x: 1941.40, y: 3747.01, z: 32.50 },
    { x: -113.84, y: 6445.62, z: 31.40 },
    { x: -1037.76, y: -2737.67, z: 20.16 }
];

// --- EVENTS ---

// 1. Assign Online ID on Join
mp.events.add('playerJoin', (player) => {
    // Gather all currently used IDs
    const usedIds = new Set();
    mp.players.forEach(p => {
        if (p !== player && p.data.onlineId !== undefined) {
            usedIds.add(p.data.onlineId);
        }
    });

    // Find lowest available ID
    let newId = 0;
    while (usedIds.has(newId)) {
        newId++;
    }

    // Assign
    player.data.onlineId = newId;
    player.setVariable('onlineId', newId);
    
    console.log(`[Connection] ${player.name} joined. Assigned ID: ${newId}`);
});

mp.events.add('server:spawn:player', (player, index) => {
    let pos;

    // Index -1 means "Last Location"
    if (index === -1) {
        if (player.data.lastLocation) {
            pos = player.data.lastLocation;
        } else {
            // Fallback if data is missing
            pos = spawnPoints[0];
        }
    } else {
        // Standard Checks
        if (index < 0 || index >= spawnPoints.length) return;
        pos = spawnPoints[index];
    }
    
    // Spawn
    player.spawn(new mp.Vector3(pos.x, pos.y, pos.z));
    player.dimension = 0;
    player.health = 100;
});

mp.events.add('server:kickPlayer', (player) => {
    if (!player || !mp.players.exists(player)) return;
    
    console.log(`[Disconnect] ${player.name} requested disconnect.`);
    player.kick('Disconnected by user request.');
});