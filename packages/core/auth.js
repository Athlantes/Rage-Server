const db = require('./database');
const bcrypt = require('bcryptjs');
const playerManager = require('./playerManager');
const QuestManager = require('./questManager');
const Banking = require('./banking');
const CharCreator = require('../systems/charCreator');
const PhotoHuntManager = require('../systems/photoHunt/photoHuntManager');
// --- 1. INITIALIZATION ---
mp.events.add('playerJoin', async (player) => {
    player.logged = false;
    player.dim = 2000 + player.id; // Isolation dimension
    // We can safely access player.ip and player.serial (HWID)
    console.log(`[Connect] ${player.name} | SCID: ${player.rgscId} | HWID: ${player.serial} | IP: ${player.ip}`);

    try {
        // Fetch recent accounts (Only matching SCID for privacy)
        const [recentAccounts] = await db.query(
            `SELECT username, money, level, hwid FROM users 
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

// --- 2. AUTO-LOGIN (Quick Access) ---
mp.events.add('server:auth:autoLogin', async (player, username) => {
    if (player.logged) return;

    try {
        const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [username]);
        if (rows.length === 0) return player.call('client:auth:error', ["Account invalid."]);
        const user = rows[0];

        // Strict Auto-Login: Must match SCID + HWID
        if (user.social_id !== player.rgscId || user.hwid !== player.serial) {
             return player.call('client:auth:error', ["Security alert: Device changed. Login manually."]);
        }

        performLoginChecks(player, user, null); // Password null = trusted auto-login

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

    // PRE-CHECK: Anti-Multibox (Scenario: Same HWID/SCID already online?)
    if (isDeviceOrSocialActive(player)) {
        return player.call('client:auth:error', ["You can't connect with 2 accounts at the same time from the same device."]);
    }

    try {
        const [check] = await db.query("SELECT id FROM users WHERE username = ?", [username]);
        if (check.length > 0) return player.call('client:auth:error', ["Username taken."]);

        const hash = await bcrypt.hash(password, 10);

        // Insert with Tracking Data (IP, HWID)
        const [res] = await db.query(
            "INSERT INTO users (username, password, social_id, hwid, ip, money, level, vehicle_slots, last_active) VALUES (?, ?, ?, ?, ?, 500, 1, 3, NOW())",
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
            cooldowns: '{}'
        };

        finalizeLogin(player, newUser);

    } catch (err) {
        console.log(err);
        player.call('client:auth:error', ["Registration Error."]);
    }
});

// --- 5. SECURITY LOGIC (The Core Request) ---
async function performLoginChecks(player, user, passwordInput) {
    // 1. Check for Active Bans (New System)
    try {
        // Check for active bans that are either Permanent (NULL) or Not Yet Expired
        const [bans] = await db.query(
            `SELECT * FROM user_bans 
             WHERE user_id = ? AND active = 1 
             AND (expire_time IS NULL OR expire_time > NOW()) 
             ORDER BY id DESC LIMIT 1`, 
            [user.id]
        );

        if (bans.length > 0) {
            const ban = bans[0];
            const reason = ban.reason;
            const admin = ban.admin_name;
            
            // Logic to display "Permanent" if expire_time is null
            const expireDisplay = ban.expire_time ? new Date(ban.expire_time).toLocaleString() : "Permanent";
            
            player.outputChatBox("!{FF0000}========================================");
            player.outputChatBox("!{FF0000}       YOU ARE BANNED FROM THIS SERVER");
            player.outputChatBox("!{FF0000}========================================");
            player.outputChatBox(`!{FFFFFF}Reason: ${reason}`);
            player.outputChatBox(`!{FFFFFF}Banned By: ${admin}`);
            player.outputChatBox(`!{FFFFFF}Expires: ${expireDisplay}`);
            
            // Stop login and show error on client
            return player.call('client:auth:error', [`Banned: ${reason} (Expires: ${expireDisplay})`]);
        }
    } catch (err) {
        console.error("[Auth] Ban Check Error:", err);
        return player.call('client:auth:error', ["Server Error (Ban System)."]);
    }

    // 2. Password Check (Skipped if Auto-Login)
    if (passwordInput !== null) {
        const match = await bcrypt.compare(passwordInput, user.password);
        if (!match) return player.call('client:auth:error', ["Incorrect Password."]);
    }

    // 3. SCID OWNERSHIP CHECK (Scenario: Same HWID, Diff SCID -> Block)
    if (user.social_id && user.social_id !== player.rgscId) {
        console.log(`[Security] Blocked ${player.name}. Account SCID: ${user.social_id} vs Player SCID: ${player.rgscId}`);
        return player.call('client:auth:error', ["This account belongs to another Social Club ID."]);
    }

    // 4. ACCOUNT ALREADY ONLINE CHECK (Scenario: Diff HWID, Same SCID -> Kick Old)
    const existingSession = mp.players.toArray().find(p => p.logged && p.data.dbId === user.id);
    if (existingSession) {
        // We notify the new player
        player.call('client:auth:error', ["You are already connected in another location. Disconnecting old session..."]);
        
        // We kick the old player
        existingSession.outputChatBox("!{FF0000}Logged in from another location.");
        existingSession.kick("Logged in from another location.");
        
        // Return here to force the new player to click Login again (safer to ensure DB sync)
        return; 
    }

    // 5. DEVICE ALREADY PLAYING CHECK (Scenario: Same HWID/SCID already online -> Block)
    // This prevents opening 2 game instances on the same PC to farm money
    if (isDeviceOrSocialActive(player)) {
        return player.call('client:auth:error', ["You can't connect with 2 accounts at the same time from the same device."]);
    }

    // 6. IP SAFETY CHECK (New)
    // If IP changed significantly, we just log it (don't block, to allow dynamic IPs)
    if (user.ip && user.ip !== player.ip) {
        console.log(`[Auth] ${player.name} new IP detected: ${player.ip} (Old: ${user.ip})`);
        player.outputChatBox("!{FFFF00}[Security] New login location detected.");
    }

    // 7. UPDATE TRACKING & LOGIN
    // First time link?
    if (!user.social_id) await db.query("UPDATE users SET social_id = ? WHERE id = ?", [player.rgscId, user.id]);

    // Update Last Active, HWID, IP
    await db.query("UPDATE users SET last_active = NOW(), hwid = ?, ip = ? WHERE id = ?", 
        [player.serial, player.ip, user.id]);

    finalizeLogin(player, user);
}

// Helper: Checks if this physical computer is already playing any account
function isDeviceOrSocialActive(currentPlayer) {
    return mp.players.toArray().some(p => {
        if (!p.logged) return false;
        if (p === currentPlayer) return false;

        // Check HWID (Serial)
        const sameHWID = (p.serial === currentPlayer.serial);
        // Check Social Club
        const sameSCID = (p.rgscId === currentPlayer.rgscId);

        // NOTE: We do NOT check IP here to allow brothers/roommates (Same IP, Diff HWID) to play.
        return sameHWID || sameSCID;
    });
}

async function finalizeLogin(player, userData) {
    // 1. Check if Character Exists
    if (!userData.appearance) {
        player.data.dbId = userData.id;
        player.data.username = userData.username;
        player.logged = true; 
        
        console.log(`[Auth] ${player.name} sent to Character Creator.`);
        
        player.call('client:auth:destroy');
        
        player.call('client:creator:start'); 
        return;
    }

    startSession(player, userData);
}

// NEW FUNCTION: Actually spawn the player
function startSession(player, userData) {
    player.logged = true;
    player.name = userData.username;
    player.data.dbId = userData.id;
    player.data.username = userData.username;
    player.data.appearance = userData.appearance; // Cache appearance
    player.data.gender = userData.gender; // Cache gender
    player.data.adminLevel = userData.admin_level || 0; 
    player.setVariable('adminLevel', player.data.adminLevel);

    // Load Economy
    player.data.money = userData.money;
    player.data.bank_money = userData.bank_money || 0;
    player.setVariable('money', userData.money);
    
    // Load Stats
    player.data.level = userData.level;
    player.data.vehicle_slots = userData.vehicle_slots;

    // Init Managers
    PhotoHuntManager.initPlayer(player);
    QuestManager.initPlayer(player);
    Banking.initAccount(player);

    // Load Cooldowns
    try {
        const cd = userData.cooldowns ? (typeof userData.cooldowns === 'string' ? JSON.parse(userData.cooldowns) : userData.cooldowns) : {};
        player.data.cooldowns = cd;
        const now = Date.now();
        for (const [key, val] of Object.entries(cd)) {
            if (val > now) player.setVariable('cooldown_' + key, val);
        }
    } catch(e) { player.data.cooldowns = {}; }

    // Helper: Set Cooldown
    player.setCooldown = function(name, minutes) {
        const exp = Date.now() + (minutes * 60000);
        player.data.cooldowns = player.data.cooldowns || {};
        player.data.cooldowns[name] = exp;
        player.setVariable('cooldown_' + name, exp);
        db.query('UPDATE users SET cooldowns = ? WHERE id = ?', [JSON.stringify(player.data.cooldowns), player.data.dbId]).catch(console.error);
    };
    player.hasCooldown = (name) => player.data.cooldowns && player.data.cooldowns[name] > Date.now();

    // Spawn
    player.dim = 0;
    if (userData.position) {
        try {
            const pos = typeof userData.position === 'string' ? JSON.parse(userData.position) : userData.position;
            player.position = new mp.Vector3(pos.x, pos.y, pos.z);
        } catch(e) { player.position = new mp.Vector3(-1037, -2738, 13); }
    } else {
        player.position = new mp.Vector3(-1037, -2738, 13);
    }

    // Apply Appearance
    CharCreator.applyAppearance(player, userData.appearance);

    player.call('client:auth:success');
    player.outputChatBox(`!{00FF00}Welcome back, ${userData.username}!`);
    mp.events.call('server:loadAccount', player);
}

// Event called by Creator when done
mp.events.add('server:auth:finalized', async (player) => {
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [player.data.dbId]);
    if (rows.length > 0) {
        startSession(player, rows[0]);
    }
});

mp.events.add('playerQuit', (player) => {
    if (player.logged) playerManager.saveAccount(player);
});