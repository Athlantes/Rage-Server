const db = require('./database');
const bcrypt = require('bcryptjs');
const playerManager = require('./playerManager');
const QuestManager = require('./questManager');
const Banking = require('./banking');
const CharCreator = require('../systems/charCreator');
const PhotoHuntManager = require('../systems/photoHunt/photoHuntManager');
const RepoJob = require('../systems/repoJob');
const HouseManager = require('../systems/houseManager');
const FactionsManager = require('../factions/factionsManager');

// --- 1. INITIALIZATION ---
mp.events.add('playerJoin', async (player) => {
    player.logged = false;
    player.dim = 2000 + player.id; 
    console.log(`[Connect] ${player.name} | SCID: ${player.rgscId} | HWID: ${player.serial} | IP: ${player.ip}`);

    try {
        const [recentAccounts] = await db.query(
            `SELECT username, money, level, hwid, mugshot FROM users 
             WHERE social_id = ? 
             AND last_active >= NOW() - INTERVAL 3 DAY 
             ORDER BY last_active DESC 
             LIMIT 3`,
            [player.rgscId]
        );
        player.call('client:auth:show', [JSON.stringify(recentAccounts)]);
    } catch (err) {
        console.error("[Auth] Init Error:", err);
        player.call('client:auth:show', ["[]"]);
    }
});

// --- 2. AUTO-LOGIN ---
mp.events.add('server:auth:autoLogin', async (player, username) => {
    if (player.logged) return;
    try {
        const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [username]);
        if (rows.length === 0) return player.call('client:auth:error', ["Account invalid."]);
        const user = rows[0];

        if (user.social_id !== player.rgscId || user.hwid !== player.serial) {
             return player.call('client:auth:error', ["Security alert: Device changed. Login manually."]);
        }
        performLoginChecks(player, user, null);
    } catch (err) {
        console.error(err);
        player.call('client:auth:error', ["Server error."]);
    }
});

// --- 3. MANUAL LOGIN ---
mp.events.add('server:auth:login', async (player, username, password) => {
    if (player.logged) return;
    try {
        const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [username]);
        if (rows.length === 0) return player.call('client:auth:error', ["Account not found."]);
        const user = rows[0];
        performLoginChecks(player, user, password);
    } catch (err) {
        console.log(err);
        player.call('client:auth:error', ["Database Error."]);
    }
});

// --- 4. REGISTER ---
mp.events.add('server:auth:register', async (player, username, password) => {
    if (player.logged) return;
    if (!username || username.length < 3) return player.call('client:auth:error', ["Username too short."]);

    const registerBlock = isDeviceOrSocialActive(player);
    if (registerBlock) {
        const msg = registerBlock === 'same_device'
            ? "You can't register while another account is active on this device."
            : `You already have ${MAX_ACCOUNTS_PER_PLAYER} accounts connected simultaneously.`;
        return player.call('client:auth:error', [msg]);
    }

    try {
        const [check] = await db.query("SELECT id FROM users WHERE username = ?", [username]);
        if (check.length > 0) return player.call('client:auth:error', ["Username taken."]);

        const hash = await bcrypt.hash(password, 10);

        const [res] = await db.query(
            "INSERT INTO users (username, password, social_id, hwid, ip, money, level, vehicle_slots, last_active, payday_in, created_at, total_playtime) VALUES (?, ?, ?, ?, ?, 500, 1, 3, NOW(), 60, NOW(), 0)",
            [username, hash, player.rgscId, player.serial, player.ip]
        );

        const newUser = {
            id: res.insertId,
            username: username,
            social_id: player.rgscId,
            hwid: player.serial,
            ip: player.ip,
            money: 500,
            level: 1,
            vehicle_slots: 3,
            payday_in: 60,
            cooldowns: '{}'
        };

        finalizeLogin(player, newUser);

    } catch (err) {
        console.log(err);
        player.call('client:auth:error', ["Registration Error."]);
    }
});

// --- 5. SECURITY LOGIC ---
async function performLoginChecks(player, user, passwordInput) {
    try {
        const [bans] = await db.query(
            `SELECT * FROM user_bans 
             WHERE user_id = ? AND active = 1 
             AND (expire_time IS NULL OR expire_time > NOW()) 
             ORDER BY id DESC LIMIT 1`, 
            [user.id]
        );

        if (bans.length > 0) {
            const ban = bans[0];
            const expireDisplay = ban.expire_time ? new Date(ban.expire_time).toLocaleString() : "Permanent";
            player.outputChatBox("!{FF0000}       YOU ARE BANNED FROM THIS SERVER");
            return player.call('client:auth:error', [`Banned: ${ban.reason} (Expires: ${expireDisplay})`]);
        }
    } catch (err) {
        console.error("[Auth] Ban Check Error:", err);
        return player.call('client:auth:error', ["Server Error (Ban System)."]);
    }

    if (passwordInput !== null) {
        const match = await bcrypt.compare(passwordInput, user.password);
        if (!match) return player.call('client:auth:error', ["Incorrect Password."]);
    }

    if (user.social_id && user.social_id !== player.rgscId) {
        return player.call('client:auth:error', ["This account belongs to another Social Club ID."]);
    }

    const existingSession = mp.players.toArray().find(p => p.logged && p.data.dbId === user.id);
    if (existingSession) {
        return player.call('client:auth:error', ["This account is already active. Please disconnect from the other session first."]);
    }

    const loginBlock = isDeviceOrSocialActive(player);
    if (loginBlock) {
        const msg = loginBlock === 'same_device'
            ? "You can't connect with 2 accounts from the same device."
            : `You already have ${MAX_ACCOUNTS_PER_PLAYER} accounts connected. Use a different device.`;
        return player.call('client:auth:error', [msg]);
    }

    if (!user.social_id) await db.query("UPDATE users SET social_id = ? WHERE id = ?", [player.rgscId, user.id]);
    await db.query("UPDATE users SET last_active = NOW(), hwid = ?, ip = ? WHERE id = ?", [player.serial, player.ip, user.id]);

    finalizeLogin(player, user);
}

const MAX_ACCOUNTS_PER_PLAYER = 2; // Max simultaneous accounts from the same Social Club (must be on different devices)

function isDeviceOrSocialActive(currentPlayer) {
    const loggedPlayers = mp.players.toArray().filter(p => p.logged && p !== currentPlayer);

    // Block same device (same HWID) — no multi-accounting from one machine
    if (loggedPlayers.some(p => p.serial === currentPlayer.serial)) return 'same_device';

    // Allow up to MAX_ACCOUNTS_PER_PLAYER sessions per Social Club ID (from different devices)
    const sameSocialCount = loggedPlayers.filter(p => p.rgscId === currentPlayer.rgscId).length;
    if (sameSocialCount >= MAX_ACCOUNTS_PER_PLAYER) return 'max_accounts';

    return false;
}

async function finalizeLogin(player, userData) {
    if (!userData.appearance) {
        player.data.dbId = userData.id;
        player.data.username = userData.username;
        player.logged = true; 
        player.call('client:auth:destroy');
        player.call('client:creator:start'); 
        return;
    }

    startSession(player, userData);

    // Load family data after session starts
    try {
        const FamilyManager = require('../systems/familyManager');
        await FamilyManager.setupPlayerFamily(player, userData.id);
    } catch (e) {
        console.error('[Family] Error loading family on login:', e);
    }

}

async function startSession(player, userData) {
    player.logged = true;
    player.name = userData.username;
    player.data.dbId = userData.id;
    player.data.username = userData.username;
    player.data.appearance = userData.appearance; 
    player.data.gender = userData.gender; 
    player.data.adminLevel = userData.admin_level || 0; 
    player.setVariable('adminLevel', player.data.adminLevel);

    player.model = (player.data.gender === 0) ? mp.joaat('mp_m_freemode_01') : mp.joaat('mp_f_freemode_01');
    player.data.money = userData.money;
    player.data.bank_money = userData.bank_money || 0;
    player.data.mugshot = userData.mugshot || null;
    player.setVariable('money', userData.money);
    
    // --- LOAD RPG STATS ---
    player.data.level = userData.level || 1;
    player.data.xp = userData.xp || 0; 
    player.data.vehicle_slots = userData.vehicle_slots;
    player.data.exposure = userData.exposure || 0;
    
    // --- LOAD PAYDAY TIMER ---
    player.data.paydayIn = (userData.payday_in && userData.payday_in > 0) ? userData.payday_in : 60;

    // --- FIX: DO NOT RESTORE DAILY PLAYTIME ---
    // We start at 0 so playerManager.saveAccount() only adds the NEW minutes.
    // playerMenu.js will handle fetching the DB history + current session for the UI.
    player.data.activeMinutes = 0; 
    console.log(`[Playtime] Tracker started at 0 for ${player.name}`);

    // --- 1. SETUP DAILY PLAYTIME TRACKER ---
    const todayStr = new Date();
    const today = `${todayStr.getFullYear()}-${String(todayStr.getMonth()+1).padStart(2,'0')}-${String(todayStr.getDate()).padStart(2,'0')}`;
    const dbDate = userData.daily_playtime_date;
    let dbDateStr = null;
    
    if (dbDate) {
        const d = (typeof dbDate === 'string') ? new Date(dbDate + 'T00:00:00') : new Date(dbDate);
        dbDateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    if (dbDateStr === today) {
        // Store the DB time in a SEPARATE variable (Base)
        player.data.dailyPlaytimeBase = userData.daily_playtime || 0;
        console.log(`[Playtime] Loaded ${player.data.dailyPlaytimeBase}m previous playtime for today.`);
    } else {
        // New day, start base at 0
        player.data.dailyPlaytimeBase = 0;
        console.log(`[Playtime] New day for ${player.name}. Reset daily tracker.`);
    }

    // Always start session counter at 0
    player.data.activeMinutes = 0;

    // Sync XP
    const xpMax = playerManager.calculateNextLevelXp(player.data.level);
    player.setVariable('level', player.data.level);
    player.setVariable('xp', player.data.xp);
    player.setVariable('xpMax', xpMax);

    // Init Managers
    CharCreator.applyAppearance(player, userData.appearance);
    PhotoHuntManager.initPlayer(player);
    QuestManager.initPlayer(player);
    Banking.initAccount(player);
    RepoJob.onPlayerReady(player);
    await FactionsManager.loadPlayerFactionData(player);

    try {
        const cd = userData.cooldowns ? (typeof userData.cooldowns === 'string' ? JSON.parse(userData.cooldowns) : userData.cooldowns) : {};
        player.data.cooldowns = cd;

        playerManager.syncCooldowns(player); 

        const now = Date.now();
        for (const [key, val] of Object.entries(cd)) {
            if (val > now) player.setVariable('cooldown_' + key, val);
        }
    } catch(e) { 
        player.data.cooldowns = {}; 
        playerManager.syncCooldowns(player); // Sync empty if error
    }

    player.setCooldown = function(name, minutes) {
        const exp = Date.now() + (minutes * 60000);
        player.data.cooldowns = player.data.cooldowns || {};
        player.data.cooldowns[name] = exp;
        player.setVariable('cooldown_' + name, exp);
        db.query('UPDATE users SET cooldowns = ? WHERE id = ?', [JSON.stringify(player.data.cooldowns), player.data.dbId]).catch(console.error);
    };
    player.hasCooldown = (name) => {
        return player.data.cooldowns && player.data.cooldowns[name] && player.data.cooldowns[name] > Date.now();
    };
    player.getCooldownTime = (name) => {
        if (!player.data.cooldowns || !player.data.cooldowns[name]) return 0;
        const remaining = player.data.cooldowns[name] - Date.now();
        if (remaining <= 0) return 0;
        return Math.ceil(remaining / 60000);
    };
    player.clearCooldown = (name) => {
        if (player.data.cooldowns) {
            delete player.data.cooldowns[name];
            player.setVariable('cooldown_' + name, null);
            db.query('UPDATE users SET cooldowns = ? WHERE id = ?', [JSON.stringify(player.data.cooldowns), player.data.dbId]).catch(console.error);
        }
    };

    // Spawn Logic
    const lastActive = new Date(userData.last_active).getTime();
    const now = Date.now();
    const diffMinutes = (now - lastActive) / 1000 / 60;
    
    // 1. Get House Data
    const house = HouseManager.getHouseByOwner(player.data.dbId);
    const housePos = house ? house.position : null; 
    
    // 2. Get Family HQ Data
    let familyHQPos = null;
    try {
        const FamilyManager = require('../systems/familyManager');
        const fam = FamilyManager.getFamilyByUserId(player.data.dbId);
        if (fam && fam.hqHouseId) {
            const hqHouse = HouseManager.getHouseById(fam.hqHouseId);
            if (hqHouse) familyHQPos = hqHouse.position;
        }
    } catch (e) {
        console.error('[Family] Error getting HQ position:', e);
    }
    
    // 3. Get Faction HQ Data
    let factionHQPos = null;
    try {
        if (player.factionId) {
            const faction = FactionsManager.getFaction(player.factionId);
            if (faction && faction.hq && faction.hq.exterior) {
                const ext = faction.hq.exterior;
                factionHQPos = { x: ext.x, y: ext.y, z: ext.z };
            }
        }
    } catch (e) {
        console.error('[Faction] Error getting HQ position:', e);
    }

    let showSpawnSelector = true; 
    let lastPos = null;

    if (userData.position) {
        try { lastPos = typeof userData.position === 'string' ? JSON.parse(userData.position) : userData.position; } catch (e) {}
    }

    if (lastPos) player.data.lastLocation = lastPos;

    if (diffMinutes < 5 && lastPos) {
        player.spawn(new mp.Vector3(lastPos.x, lastPos.y, lastPos.z));
        player.dim = 0; 
        player.heading = lastPos.heading || 0;
        showSpawnSelector = false; 

        // Auto-mugshot if player doesn't have one yet
        if (!player.data.mugshot) {
            const webServer = require('../webserver');
            setTimeout(() => {
                if (mp.players.exists(player)) {
                    player.call('prepareScreenshot', [webServer.mugshotUploadUrl, player.data.dbId]);
                }
            }, 5000);
        }
    }

    // Pass housePos, familyHQPos, and factionHQPos to the client event
    player.call('client:auth:success', [showSpawnSelector, lastPos, housePos, familyHQPos, factionHQPos]);
    player.outputChatBox(`!{00FF00}Welcome back, ${userData.username}!`);

    // --- INITIAL TIMER UPDATE ---
    setTimeout(() => {
        player.call('updatePaydayHUD', [player.data.paydayIn]);
    }, 2000); 

    mp.events.call('server:loadAccount', player);

    // Update Discord Rich Presence with player info
    player.call('client:discord:setLoggedIn', [player.name, player.data.level || 1]);
}

mp.events.add('server:auth:finalized', async (player) => {
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [player.data.dbId]);
    if (rows.length > 0) {
        startSession(player, rows[0]);
    }
});

mp.events.add('playerQuit', (player) => {
    if (player.logged) playerManager.saveAccount(player);
});