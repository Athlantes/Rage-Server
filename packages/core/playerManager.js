// packages/core/playerManager.js
const db = require('./database');

// --- LEVELING CONFIGURATION ---
const BASE_XP_NEEDED = 1000;
const XP_MULTIPLIER = 1.2; // Each level requires 20% more XP than the last

const playerManager = {
    // Helper: Calculate XP needed for next level
    calculateNextLevelXp: (currentLevel) => {
        return Math.floor(BASE_XP_NEEDED * Math.pow(XP_MULTIPLIER, currentLevel - 1));
    },

    addMoney: (player, amount, reason = "Unknown") => {
        if (!player || !mp.players.exists(player)) return false;
        player.data.money += amount;
        player.setVariable('money', player.data.money);
        return true;
    },

    addMoneyAndSave: async (player, amount, reason = "Job Reward") => {
        if (!player || !mp.players.exists(player)) return false;

        player.data.money += amount;
        player.setVariable('money', player.data.money);

        try {
            const dbId = player.data.dbId;
            if (!dbId) return false;
            await db.query("UPDATE users SET money = money + ? WHERE id = ?", [amount, dbId]);
            return true;
        } catch (err) {
            console.error(`[CRITICAL] Failed to save money for ${player.name}:`, err);
            return false;
        }
    },

    removeMoneyAndSave: async (player, amount, reason = "Unknown") => {
        if (!player || !mp.players.exists(player)) return false;
        if (player.data.money < amount) return false;

        player.data.money -= amount;
        player.setVariable('money', player.data.money);

        try {
            const dbId = player.data.dbId;
            if (!dbId) return false;
            await db.query("UPDATE users SET money = money - ? WHERE id = ?", [amount, dbId]);
            return true;
        } catch (err) {
            console.error(`[CRITICAL] Failed to sync money removal for ${player.name}:`, err);
            return false;
        }
    },

    saveAccount: async (player) => {
        if (!mp.players.exists(player) || !player.logged || !player.data.dbId) return;

        const name = player.name; 
        const dbId = player.data.dbId;
        
        // Stats
        const level = player.data.level || 1;
        const xp = player.data.xp || 0;
        const playedMinutes = player.data.playedMinutes || 0;
        const bank = player.data.bank || 0;

        let currentPos;
        try {
            currentPos = JSON.stringify(player.position);
        } catch (err) {
            currentPos = JSON.stringify(new mp.Vector3(-1037, -2738, 13));
        }

        try {
            // Note: Ensure your DB has 'xp' column instead of 'respect'
            await db.query(
                "UPDATE users SET level=?, position=?, played_minutes=?, xp=?, bank=? WHERE id=?", 
                [level, currentPos, playedMinutes, xp, bank, dbId]
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

mp.events.add('playerJoin', (player) => {
    // ID Assignment
    const usedIds = new Set();
    mp.players.forEach(p => {
        if (p !== player && p.data.onlineId !== undefined) {
            usedIds.add(p.data.onlineId);
        }
    });

    let newId = 0;
    while (usedIds.has(newId)) newId++;
    player.data.onlineId = newId;
    player.setVariable('onlineId', newId);
    
    // Init RPG Variables
    player.data.playedMinutes = 0;
    player.data.bank = 0;
    player.data.isAfk = false; 

    // Init XP / Level
    if (!player.data.level) player.data.level = 1;
    if (!player.data.xp) player.data.xp = 0;

    // Calculate Max XP for current level and sync to client
    const xpMax = playerManager.calculateNextLevelXp(player.data.level);
    player.setVariable('level', player.data.level);
    player.setVariable('xp', player.data.xp);
    player.setVariable('xpMax', xpMax);

    console.log(`[Connection] ${player.name} joined. Assigned ID: ${newId}`);
});

mp.events.add('server:spawn:player', (player, index) => {
    let pos;
    if (index === -1) {
        pos = player.data.lastLocation ? player.data.lastLocation : spawnPoints[0];
    } else {
        if (index < 0 || index >= spawnPoints.length) return;
        pos = spawnPoints[index];
    }
    
    player.spawn(new mp.Vector3(pos.x, pos.y, pos.z));
    player.dimension = 0;
    player.health = 100;
});

mp.events.add('server:kickPlayer', (player) => {
    if (!player || !mp.players.exists(player)) return;
    player.kick('Disconnected by user request.');
});

// =========================================================================
//  --- GAME TIME LOOP (PAYDAY & XP) ---
// =========================================================================

setInterval(() => {
    mp.events.call('server:tickMinute');
}, 60000);

mp.events.add('server:tickMinute', () => {
    mp.players.forEach(player => {
        if (!player.logged) return;

        // Skip if AFK
        if (player.data.isAfk) return;

        if (!player.data.playedMinutes) player.data.playedMinutes = 0;
        player.data.playedMinutes++;

        player.call('updateHUD', [player.data.playedMinutes]);

        // Payday every 60 mins
        if (player.data.playedMinutes >= 60) {
            triggerPayday(player);
        }
    });
});

function triggerPayday(player) {
    player.data.playedMinutes = 0;

    // 1. Give XP (e.g., 250 XP per payday)
    const xpReward = 250;
    player.data.xp += xpReward;

    // 2. Check Level Up
    let xpNeeded = playerManager.calculateNextLevelXp(player.data.level);
    
    // While loop handles multi-level ups (if they somehow got huge XP)
    while (player.data.xp >= xpNeeded) {
        player.data.xp -= xpNeeded;
        player.data.level++;
        
        player.outputChatBox(`!{#f0c400}🎉 LEVEL UP! You are now Level ${player.data.level}!`);
        player.call('playSound', ['HUD_AWARDS', 'CHALLENGE_UNLOCKED']); // Plays GTA sound
        
        // Recalculate needed for next level
        xpNeeded = playerManager.calculateNextLevelXp(player.data.level);
    }

    // 3. Sync new stats to Client (for Player Menu / HUD)
    player.setVariable('level', player.data.level);
    player.setVariable('xp', player.data.xp);
    player.setVariable('xpMax', xpNeeded);

    // 4. Calculate Money
    if (!player.data.bank) player.data.bank = 0;
    
    // Salary increases with Level ($500 base + $50 per level)
    const salary = 500 + (player.data.level * 50); 
    const interest = Math.floor(player.data.bank * 0.001); 
    const totalIncome = salary + interest;

    player.data.bank += totalIncome;

    // 5. Output
    player.outputChatBox(`!{#00FF00}_________________ PAYDAY _________________`);
    player.outputChatBox(`!{#FFFFFF}Paycheck: !{#2ecc71}$${salary}`);
    player.outputChatBox(`!{#FFFFFF}Bank Interest: !{#2ecc71}$${interest}`);
    player.outputChatBox(`!{#FFFFFF}XP Gained: !{#00a2ff}+${xpReward}`);
    player.outputChatBox(`!{#FFFFFF}New Balance: !{#2ecc71}$${player.data.bank}`);

    // 6. Save
    playerManager.saveAccount(player);
}