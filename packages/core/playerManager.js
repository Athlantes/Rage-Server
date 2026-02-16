// packages/core/playerManager.js
const db = require('./database');
const HouseManager = require('../systems/houseManager');

// --- LEVELING CONFIGURATION ---
const BASE_XP_NEEDED = 1000;
const XP_MULTIPLIER = 1.2;

const playerManager = {
    // Helper: Calculate XP needed for next level
    calculateNextLevelXp: (currentLevel) => {
        return Math.floor(BASE_XP_NEEDED * Math.pow(XP_MULTIPLIER, currentLevel - 1));
    },

    addMoney: (player, amount, reason = "Unknown") => {
        if (!player || !mp.players.exists(player)) return false;
        player.data.money += amount;
        player.setVariable('money', player.data.money);
        // console.log(`[Economy] ${player.name} gained $${amount} (${reason}).`);
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
        
        // Data to save
        const level = player.data.level || 1;
        const xp = player.data.xp || 0;
        const bank_money = player.data.bank_money || 0;
        // Default to 60 if for some reason it's missing/null
        const paydayIn = (player.data.paydayIn !== undefined) ? player.data.paydayIn : 60;

        let currentPos;
        try {
            currentPos = JSON.stringify(player.position);
        } catch (err) {
            currentPos = JSON.stringify(new mp.Vector3(-1037, -2738, 13));
        }

        try {
            // Save core stats + accumulate total_playtime
            const sessionMinutes = player.data.activeMinutes || 0;
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
            
            await db.query(
                `UPDATE users SET level=?, position=?, xp=?, bank_money=?, payday_in=?, 
                 total_playtime = COALESCE(total_playtime, 0) + ?,
                 daily_playtime = CASE WHEN daily_playtime_date = ? THEN COALESCE(daily_playtime, 0) + ? ELSE ? END,
                 daily_playtime_date = ?
                 WHERE id=?`, 
                [level, currentPos, xp, bank_money, paydayIn, sessionMinutes, today, sessionMinutes, sessionMinutes, today, dbId]
            );

            // --- UPDATE VARIABLES AFTER SAVE ---
            if (mp.players.exists(player)) {
                // Move session minutes into the "Base" (Saved) variable
                player.data.dailyPlaytimeBase = (player.data.dailyPlaytimeBase || 0) + sessionMinutes;
                
                // Reset session counter
                player.data.activeMinutes = 0;
            }
            console.log(`[Data] Saved ${name} (Payday in: ${paydayIn}m)`);
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
    player.data.bank_money = 0;
    player.data.isAfk = false; 
    player.data.paydayIn = 60; // Default until loaded from DB
    player.data.activeMinutes = 0; // Track non-AFK minutes for payday popup

    // Init XP / Level
    if (!player.data.level) player.data.level = 1;
    if (!player.data.xp) player.data.xp = 0;

    const xpMax = playerManager.calculateNextLevelXp(player.data.level);
    player.setVariable('level', player.data.level);
    player.setVariable('xp', player.data.xp);
    player.setVariable('xpMax', xpMax);

    console.log(`[Connection] ${player.name} joined. Assigned ID: ${newId}`);
});

mp.events.add('server:spawn:player', (player, index) => {
    let pos;
    if (index === -1) {
        // Last Location
        pos = player.data.lastLocation ? player.data.lastLocation : spawnPoints[0];
    } else if (index === -2) {
        // [ADDED] House Spawn
        const house = HouseManager.getHouseByOwner(player.data.dbId);
        if (house) {
            // Spawn inside if interior exists, or outside if you prefer
            // Currently house.position is the EXTERIOR.
            pos = house.position;
        } else {
            pos = spawnPoints[0]; // Fallback
        }
    } else {
        // Standard Spawns
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

// Global Timer: Runs every 60 seconds (60000ms)
setInterval(() => {
    mp.players.forEach(player => {
        if (!player.logged) return;

        // Skip if AFK
        if (player.data.isAfk) return;

        // Ensure variable exists
        if (!player.data.paydayIn && player.data.paydayIn !== 0) player.data.paydayIn = 60;

        // 1. DECREMENT TIMER & TRACK ACTIVE TIME
        player.data.paydayIn--;
        player.data.activeMinutes = (player.data.activeMinutes || 0) + 1;

        // 2. SEND UPDATE TO CLIENT (UI)
        // We send the EXACT remaining minutes
        player.call('updatePaydayHUD', [player.data.paydayIn]);

        // 3. CHECK FOR PAYDAY
        if (player.data.paydayIn <= 0) {
            triggerPayday(player);
            // Reset logic is inside triggerPayday or here:
            player.data.paydayIn = 60; 
            player.data.activeMinutes = 0; // Reset active time tracker
            player.call('updatePaydayHUD', [60]); // Immediate UI reset
        }
    });
}, 60000);

function triggerPayday(player) {
    // 1. Give XP
    const xpReward = 250;
    player.data.xp = (player.data.xp || 0) + xpReward;

    // 2. Check Level Up
    let xpNeeded = playerManager.calculateNextLevelXp(player.data.level);
    
    while (player.data.xp >= xpNeeded) {
        player.data.xp -= xpNeeded;
        player.data.level++;
        player.outputChatBox(`!{#f0c400}🎉 LEVEL UP! You are now Level ${player.data.level}!`);
        player.call('playSound', ['HUD_AWARDS', 'CHALLENGE_UNLOCKED']); 
        xpNeeded = playerManager.calculateNextLevelXp(player.data.level);
    }

    // 3. Sync stats
    player.setVariable('level', player.data.level);
    player.setVariable('xp', player.data.xp);
    player.setVariable('xpMax', xpNeeded);

    // 4. Calculate Money
    if (!player.data.bank_money) player.data.bank_money = 0;
    const salary = 500 + (player.data.level * 50); 
    const interest = Math.floor(player.data.bank_money * 0.001); 
    const totalIncome = salary + interest;

    player.data.bank_money += totalIncome;
    player.data.bank = player.data.bank_money; // Sync bank property used by overlay
    player.setVariable('bank', player.data.bank); // Push update to client

    // 5. Send popup to client instead of chat messages
    const activeMins = player.data.activeMinutes || 0;
    const rewards = [
        { type: 'money', value: `$${new Intl.NumberFormat().format(totalIncome)}` },
        { type: 'xp', value: `${xpReward} XP` }
    ];
    if (interest > 0) {
        rewards.push({ type: 'generic', value: `$${interest} Interest` });
    }
    const subtitle = `You played ${activeMins} minute${activeMins !== 1 ? 's' : ''} this payday.`;
    player.call('showCenterPopup', [
        'PAYDAY',
        subtitle,
        JSON.stringify(rewards),
        7000
    ]);

    // 6. Save Account (This saves the reset timer too)
    playerManager.saveAccount(player);
}