const db = require('./database');
const bcrypt = require('bcryptjs');
const playerManager = require('./playerManager');

// 1. Handle Join
mp.events.add('playerJoin', (player) => {
    player.outputChatBox("!{F0C400}Welcome to the Trucking Server!");
    player.outputChatBox("!{FFFFFF}Use: /login [username] [password]");
    player.outputChatBox("!{FFFFFF}Or: /register [username] [password] [repeat_password]");
    
    // Set a flag so they can't move until logged in
    player.logged = false;
    player.dim = 100; // Hide them in a different dimension
    player.position = new mp.Vector3(-1037, -2738, 13); // Airport view
    player.call("client:freezePlayer", [true]); // Optional: freeze client side if you have that script
});

// 2. Register Command
// Usage: /register [username] [password] [repeat_password]
mp.events.addCommand('register', async (player, fullText, username, password, repeatPassword) => {
    if(player.logged) return player.outputChatBox("You are already logged in.");
    
    // ... validation checks ...
    if(!username || !password || !repeatPassword) return player.outputChatBox("Usage: /register [user] [pass] [repeat]");
    if(password !== repeatPassword) return player.outputChatBox("Passwords do not match.");

    try {
        // PROTECTION 1: Check if Username is taken
        const [userCheck] = await db.query("SELECT id FROM users WHERE username = ?", [username]);
        if(userCheck.length > 0) return player.outputChatBox("!{FF0000}That username is taken.");

        // PROTECTION 2: Check Social Club ID
        const [scidCheck] = await db.query("SELECT username FROM users WHERE social_id = ?", [player.rgscId]);
        if(scidCheck.length > 0) {
            return player.outputChatBox(`!{FF0000}You already have an account: ${scidCheck[0].username}`);
        }

        const hash = await bcrypt.hash(password, 10);

        // NOTE: We rely on the DB default '{}' for cooldowns, so we don't need to insert it manually here
        const [result] = await db.query(
            "INSERT INTO users (username, password, social_id, money, level, vehicle_slots) VALUES (?, ?, ?, 500, 1, 3)", 
            [username, hash, player.rgscId]
        );
        
        player.outputChatBox("!{00FF00}Account Protected & Created!");

        // Auto-Login
        const newUser = {
            id: result.insertId,
            username: username,
            money: 500,        
            level: 1,          
            vehicle_slots: 3,
            cooldowns: '{}'    // Default empty JSON string for new user
        };
        loadAccount(player, newUser);

    } catch(err) {
        console.log(err);
        player.outputChatBox("Database Error.");
    }
});

mp.events.addCommand('login', async (player, fullText, username, password) => {
    if(player.logged) return player.outputChatBox("You are already logged in.");
    if(!username || !password) return player.outputChatBox("Usage: /login [username] [password]");

    try {
        const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [username]);
        
        if(rows.length === 0) return player.outputChatBox("!{FF0000}Account not found.");
        
        const user = rows[0];

        // PROTECTION 3: The Hardware Check
        if (user.social_id && user.social_id !== player.rgscId) {
            console.log(`[Security] Login Blocked. User: ${username} | Saved SCID: ${user.social_id} | Attempt SCID: ${player.rgscId}`);
            return player.outputChatBox("!{FF0000}SECURITY ALERT: This account belongs to a different Social Club ID.");
        }

        // Password Check
        const match = await bcrypt.compare(password, user.password);
        if(!match) return player.outputChatBox("!{FF0000}Incorrect password.");

        // Link account if it's old (pre-security update)
        if (user.social_id === null) {
            await db.query("UPDATE users SET social_id = ? WHERE id = ?", [player.rgscId, user.id]);
            player.outputChatBox("!{F0C400}Account linked to your PC for security.");
        }

        // Success
        loadAccount(player, user);

    } catch(err) {
        console.log(err);
        player.outputChatBox("Database Error.");
    }
});

// 4. Helper: Load Data into Memory
function loadAccount(player, userData) {
    player.logged = true;
    player.dim = 0; 
    
    player.name = userData.username;
    player.data.dbId = userData.id;
    player.data.username = userData.username;

    // Load Stats
    player.data.money = userData.money;
    player.setVariable('money', userData.money);
    player.data.level = userData.level;
    player.data.vehicle_slots = userData.vehicle_slots;
    
    // --- COOLDOWN SYSTEM UPGRADE ---
    try {
        player.data.cooldowns = (typeof userData.cooldowns === 'string') 
            ? JSON.parse(userData.cooldowns || '{}') 
            : (userData.cooldowns || {});

        // NEW: Sync active cooldowns to Client immediately on login
        // This ensures the UI is hidden if they reconnect while on cooldown
        const now = Date.now();
        for (const [key, expiry] of Object.entries(player.data.cooldowns)) {
            if (expiry > now) {
                player.setVariable('cooldown_' + key, expiry);
            }
        }

    } catch (e) {
        player.data.cooldowns = {};
        console.log(`[Auth] Error parsing cooldowns for ${player.name}:`, e);
    }

    // Helper: Set Cooldown (Upgraded)
    player.setCooldown = function(name, minutes) {
        const expiresAt = Date.now() + (minutes * 60000);
        this.data.cooldowns[name] = expiresAt;
        
        // NEW: Sync to client so UI can react instantly
        this.setVariable('cooldown_' + name, expiresAt);
        
        db.query('UPDATE users SET cooldowns = ? WHERE id = ?', 
            [JSON.stringify(this.data.cooldowns), this.data.dbId]
        ).catch(err => console.error("[Auth] Cooldown Save Error:", err));
    };

    // Helper: Check Cooldown
    player.hasCooldown = function(name) {
        if (!this.data.cooldowns[name]) return false;
        return Date.now() < this.data.cooldowns[name];
    };

    // Helper: Get Time Left
    player.getCooldownTime = function(name) {
        if (!this.data.cooldowns[name]) return 0;
        const diff = this.data.cooldowns[name] - Date.now();
        return diff > 0 ? Math.ceil(diff / 60000) : 0; 
    };
    // ----------------------------

    if (userData.position) {
        try {
            let pos = (typeof userData.position === 'string') ? JSON.parse(userData.position) : userData.position;
            if(pos && typeof pos.x === 'number') {
                player.position = new mp.Vector3(pos.x, pos.y, pos.z);
            } else {
                 player.position = new mp.Vector3(-1037, -2738, 13);
            }
        } catch (e) {
            player.position = new mp.Vector3(-1037, -2738, 13);
        }
    } else {
        player.position = new mp.Vector3(-1037, -2738, 13);
    }

    player.call("client:freezePlayer", [false]);
    player.outputChatBox(`!{00FF00}Welcome back, ${userData.username}!`);
    mp.events.call('server:loadAccount', player);
}

mp.events.add('playerQuit', (player) => {
    if (player.logged) {
        playerManager.saveAccount(player);
        console.log(`[Auth] ${player.name} saved on quit.`);
    }
});