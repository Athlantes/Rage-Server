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

    // --- HUNGER & THIRST MANAGEMENT ---
    updateHunger: (player, amount) => {
        if (!player || !mp.players.exists(player)) return;
        player.data.hunger = Math.min(100, Math.max(0, (player.data.hunger || 0) + amount));
        player.data.hungerFloat = player.data.hunger; // Sync float tracker
        player.setVariable('hunger', player.data.hunger);
        if (player.data.hunger <= 0) player.call('showNotification', ['Health', 'You are starving!']);
    },

    updateThirst: (player, amount) => {
        if (!player || !mp.players.exists(player)) return;
        player.data.thirst = Math.min(100, Math.max(0, (player.data.thirst || 0) + amount));
        player.data.thirstFloat = player.data.thirst; // Sync float tracker
        player.setVariable('thirst', player.data.thirst);
        if (player.data.thirst <= 0) player.call('showNotification', ['Health', 'You are dehydrated!']);
    },

    saveAccount: async (player) => {
        if (!mp.players.exists(player) || !player.logged || !player.data.dbId) return;

        const name = player.name; 
        const dbId = player.data.dbId;
        
        // Data to save
        const level = player.data.level || 1;
        const xp = player.data.xp || 0;
        const bank_money = player.data.bank_money || 0;
        const premiumPoints = player.data.premiumPoints || 0;
        const hunger = player.data.hunger || 100;
        const thirst = player.data.thirst || 100;
        const paydayIn = (player.data.paydayIn !== undefined) ? player.data.paydayIn : 60;

        let currentPos;
        try {
            currentPos = JSON.stringify(player.position);
        } catch (err) {
            currentPos = JSON.stringify(new mp.Vector3(-1037, -2738, 13));
        }

        try {
            const sessionMinutes = player.data.activeMinutes || 0;
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
            
            await db.query(
                `UPDATE users SET level=?, position=?, xp=?, bank_money=?, payday_in=?, hunger=?, thirst=?, premium_points=?,
                 total_playtime = COALESCE(total_playtime, 0) + ?,
                 daily_playtime = CASE WHEN daily_playtime_date = ? THEN COALESCE(daily_playtime, 0) + ? ELSE ? END,
                 daily_playtime_date = ?
                 WHERE id=?`, 
                [level, currentPos, xp, bank_money, paydayIn, hunger, thirst, premiumPoints, sessionMinutes, today, sessionMinutes, sessionMinutes, today, dbId]
            );

            if (mp.players.exists(player)) {
                player.data.dailyPlaytimeBase = (player.data.dailyPlaytimeBase || 0) + sessionMinutes;
                player.data.activeMinutes = 0;
            }
            console.log(`[Data] Saved ${name} (H:${hunger} T:${thirst} PP:${premiumPoints})`);
        } catch (e) {
            console.error(`[Data] Failed to save ${name}:`, e);
        }
    },

    // --- COOLDOWN SYSTEM ---
    // Saves cooldown as an Expiration Timestamp (Date.now() + ms)
    setCooldown: async (player, key, minutes) => {
        if (!player || !player.data) return;
        
        // 1. Get current cooldowns or empty object
        // We use a local variable 'cds' to ensure we modify the data correctly
        let cds = player.data.cooldowns || {};
        
        // 2. Set the new cooldown
        const expiry = Date.now() + (minutes * 60000);
        cds[key] = expiry;

        // 3. RE-ASSIGN to player.data to ensure RageMP saves it
        player.data.cooldowns = cds; 

        // 4. Sync to client
        player.call('updateCooldowns', [JSON.stringify(cds)]);

        // 5. Save to DB
        if (player.data.dbId) {
            await db.query('UPDATE users SET cooldowns = ? WHERE id = ?', [JSON.stringify(cds), player.data.dbId]);
        }
    },

    hasCooldown: (player, key) => {
        if (!player || !player.data || !player.data.cooldowns) return false;
        const expiry = player.data.cooldowns[key];
        if (!expiry) return false;
        
        if (expiry > Date.now()) {
            return true;
        } else {
            delete player.data.cooldowns[key];
            return false;
        }
    },

    // Sync current cooldowns (Call this on player join/spawn)
    syncCooldowns: (player) => {
        if (player.data.cooldowns) {
            player.call('updateCooldowns', [JSON.stringify(player.data.cooldowns)]);
        }
    },
    
    getCooldownTime: (player, key) => {
        if (!player || !player.data || !player.data.cooldowns) return 0;
        const expiry = player.data.cooldowns[key];
        if (!expiry || expiry < Date.now()) return 0;
        return Math.ceil((expiry - Date.now()) / 60000);
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
    player.data.paydayIn = 60; 
    player.data.activeMinutes = 0; 
    
    // Init Hunger/Thirst
    if (!player.data.hunger) player.data.hunger = 100;
    if (!player.data.thirst) player.data.thirst = 100;

    // Init XP / Level
    if (!player.data.level) player.data.level = 1;
    if (!player.data.xp) player.data.xp = 0;

    if (typeof player.data.cooldowns === 'string') {
        try {
            player.data.cooldowns = JSON.parse(player.data.cooldowns);
        } catch (e) {
            player.data.cooldowns = {};
        }
    } else if (!player.data.cooldowns) {
        player.data.cooldowns = {};
    }

    playerManager.syncCooldowns(player);

    const xpMax = playerManager.calculateNextLevelXp(player.data.level);
    player.setVariable('level', player.data.level);
    player.setVariable('xp', player.data.xp);
    player.setVariable('xpMax', xpMax);
    player.setVariable('hunger', player.data.hunger);
    player.setVariable('thirst', player.data.thirst);

    console.log(`[Connection] ${player.name} joined. Assigned ID: ${newId}`);
});

mp.events.add('server:spawn:player', (player, index) => {
    let pos;
    if (index === -1) {
        pos = player.data.lastLocation ? player.data.lastLocation : spawnPoints[0];
    } else if (index === -2) {
        const house = HouseManager.getHouseByOwner(player.data.dbId);
        pos = house ? house.position : spawnPoints[0];
    } else if (index === -3) {
        const FamilyManager = require('../systems/familyManager');
        const fam = FamilyManager.getFamilyByPlayer(player);
        if (fam && fam.hqHouseId) {
            const hqHouse = HouseManager.getHouseById(fam.hqHouseId);
            if (hqHouse) {
                const INTERIORS = { 
                    motel: { x: 151.45, y: -1007.57, z: -99.00 }, 
                    low_end: { x: 266.00, y: -1007.00, z: -101.00 }, 
                    medium: { x: 346.52, y: -1012.42, z: -99.20 }, 
                    modern: { x: -786.86, y: 315.76, z: 217.63 }, 
                    luxury: { x: -1459.17, y: -520.58, z: 56.92 } 
                };
                const interiorPos = INTERIORS[hqHouse.interior] || INTERIORS['motel'];
                player.position = new mp.Vector3(interiorPos.x, interiorPos.y, interiorPos.z);
                player.dimension = hqHouse.id;
                player.health = 100;
                return;
            }
        }
        pos = spawnPoints[0];
    } else if (index === -4) {
        const FactionsManager = require('../factions/factionsManager');
        if (player.factionId) {
            const faction = FactionsManager.getFaction(player.factionId);
            if (faction && faction.hq && faction.hq.exterior) {
                pos = faction.hq.exterior;
            } else {
                pos = spawnPoints[0];
            }
        } else {
            pos = spawnPoints[0];
        }
    } else {
        if (index < 0 || index >= spawnPoints.length) return;
        pos = spawnPoints[index];
    }
    
    player.spawn(new mp.Vector3(pos.x, pos.y, pos.z));
    player.dimension = 0;
    player.health = 100;

    // Auto-mugshot if player doesn't have one yet
    if (!player.data.mugshot) {
        const webServer = require('../webserver');
        setTimeout(() => {
            if (mp.players.exists(player)) {
                player.call('prepareScreenshot', [webServer.mugshotUploadUrl, player.data.dbId]);
            }
        }, 5000);
    }
});

mp.events.add('server:kickPlayer', (player) => {
    if (!player || !mp.players.exists(player)) return;
    player.kick('Disconnected by user request.');
});

// =========================================================================
//  --- METABOLISM LOOP (Hunger & Thirst) ---
// =========================================================================
setInterval(() => {
    mp.players.forEach(player => {
        if (!player.logged || player.data.isAfk) return;

        // 1. Hunger: Slowed down significantly
        // Previous: 0.35. New: 0.1 (Takes ~55 minutes to starve if idle)
        if (!player.data.hungerFloat) player.data.hungerFloat = player.data.hunger || 100;
        player.data.hungerFloat -= 0.1; 
        
        // 2. Thirst: Depends on Velocity
        if (!player.data.thirstFloat) player.data.thirstFloat = player.data.thirst || 100;
        
        const velocity = player.velocity;
        const speed = Math.sqrt(velocity.x*velocity.x + velocity.y*velocity.y + velocity.z*velocity.z);
        
        if (speed > 6.0) { // Slight lower threshold to ensure sprinting catches
            // Running/Sprinting: Significantly Increased Drain
            // Previous: 0.8. New: 4.0 (Drops very fast when running)
            player.data.thirstFloat -= 4.0; 
        } else if (speed > 1.5) {
            // Walking
            player.data.thirstFloat -= 0.4;
        } else {
            // Idle
            player.data.thirstFloat -= 0.05;
        }

        // Apply to Integer Stats
        const oldHunger = player.data.hunger;
        const oldThirst = player.data.thirst;
        
        player.data.hunger = Math.floor(player.data.hungerFloat);
        player.data.thirst = Math.floor(player.data.thirstFloat);

        // Sync if changed
        if (player.data.hunger !== oldHunger) player.setVariable('hunger', Math.max(0, player.data.hunger));
        if (player.data.thirst !== oldThirst) player.setVariable('thirst', Math.max(0, player.data.thirst));

        // Health Penalty if empty
        if (player.data.hunger <= 0 || player.data.thirst <= 0) {
            if (player.health > 10) player.health -= 1; // Don't kill instantly, just drain
        }
    });
}, 5000);

// =========================================================================
//  --- PAYDAY LOOP ---
// =========================================================================
setInterval(() => {
    mp.players.forEach(player => {
        if (!player.logged) return;
        if (player.data.isAfk) return;

        if (!player.data.paydayIn && player.data.paydayIn !== 0) player.data.paydayIn = 60;

        player.data.paydayIn--;
        player.data.activeMinutes = (player.data.activeMinutes || 0) + 1;

        player.call('updatePaydayHUD', [player.data.paydayIn]);

        if (player.data.paydayIn <= 0) {
            triggerPayday(player);
            player.data.paydayIn = 60; 
            player.data.activeMinutes = 0; 
            player.call('updatePaydayHUD', [60]); 
        }
    });
}, 60000);

function triggerPayday(player) {
    const xpReward = 250;
    player.data.xp = (player.data.xp || 0) + xpReward;

    let xpNeeded = playerManager.calculateNextLevelXp(player.data.level);
    while (player.data.xp >= xpNeeded) {
        player.data.xp -= xpNeeded;
        player.data.level++;
        player.outputChatBox(`!{#f0c400}🎉 LEVEL UP! You are now Level ${player.data.level}!`);
        player.call('playSound', ['HUD_AWARDS', 'CHALLENGE_UNLOCKED']); 
        xpNeeded = playerManager.calculateNextLevelXp(player.data.level);
    }

    player.setVariable('level', player.data.level);
    player.setVariable('xp', player.data.xp);
    player.setVariable('xpMax', xpNeeded);

    if (!player.data.bank_money) player.data.bank_money = 0;
    const salary = 500 + (player.data.level * 50); 
    const interest = Math.floor(player.data.bank_money * 0.001); 
    const totalIncome = salary + interest;

    player.data.bank_money += totalIncome;
    player.data.bank = player.data.bank_money; 
    player.setVariable('bank', player.data.bank); 

    const activeMins = player.data.activeMinutes || 0;
    const rewards = [
        { type: 'money', value: `$${new Intl.NumberFormat().format(totalIncome)}` },
        { type: 'xp', value: `${xpReward} XP` }
    ];
    if (interest > 0) {
        rewards.push({ type: 'generic', value: `$${interest} Interest` });
    }

    // ── Family Points reward ──────────────────────────────────────────────────
    // Award FP if this player is a family member; silently skip if not.
    // Lazy-require to avoid circular dependency (familyManager → playerManager → familyManager).
    try {
        const FamilyManager = require('../systems/familyManager');
        if (player.data.familyId) {
            const fpGain = FamilyManager.FAMILY_POINTS_PER_PAYDAY; // 10
            FamilyManager.modifyMemberFamilyPoints(player.data.dbId, fpGain)
                .then(newTotal => {
                    if (newTotal === null) return; // DB error, already logged
                    rewards.push({ type: 'generic', value: `+${fpGain} Family Points` });
                    player.outputChatBox(
                        `!{FFAA00}[Family] !{FFFFFF}Payday bonus: !{00FF00}+${fpGain} Family Points ` +
                        `!{FFFFFF}(${newTotal}/${FamilyManager.FAMILY_POINTS_MAX_STORED})`
                    );
                })
                .catch(e => console.error('[Payday] FP award error:', e));
        }
    } catch (e) {
        // FamilyManager not loaded (e.g. first boot race) — skip silently
    }
    // ── End Family Points ─────────────────────────────────────────────────────

    const subtitle = `You played ${activeMins} minute${activeMins !== 1 ? 's' : ''} this payday.`;
    player.call('showCenterPopup', [
        'PAYDAY',
        subtitle,
        JSON.stringify(rewards),
        7000
    ]);

    playerManager.saveAccount(player);
}