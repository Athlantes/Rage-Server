const db = require('./database');
const bcrypt = require('bcryptjs');
const playerManager = require('./playerManager');
const QuestManager = require('./questManager');

// 1. Handle Join
mp.events.add('playerJoin', (player) => {
    player.outputChatBox("!{F0C400}Welcome to the Trucking Server!");
    player.outputChatBox("!{FFFFFF}Use: /login [username] [password]");
    player.outputChatBox("!{FFFFFF}Or: /register [username] [password] [repeat_password]");
    
    player.logged = false;
    player.dim = 100; 
    player.position = new mp.Vector3(-1037, -2738, 13);
    player.call("client:freezePlayer", [true]); 
});

// 2. Register Command
mp.events.addCommand('register', async (player, fullText, username, password, repeatPassword) => {
    if(player.logged) return player.outputChatBox("You are already logged in.");
    if(!username || !password || !repeatPassword) return player.outputChatBox("Usage: /register [user] [pass] [repeat]");
    if(password !== repeatPassword) return player.outputChatBox("Passwords do not match.");

    try {
        const [userCheck] = await db.query("SELECT id FROM users WHERE username = ?", [username]);
        if(userCheck.length > 0) return player.outputChatBox("!{FF0000}That username is taken.");

        const [scidCheck] = await db.query("SELECT username FROM users WHERE social_id = ?", [player.rgscId]);
        if(scidCheck.length > 0) {
            return player.outputChatBox(`!{FF0000}You already have an account: ${scidCheck[0].username}`);
        }

        const hash = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            "INSERT INTO users (username, password, social_id, money, level, vehicle_slots) VALUES (?, ?, ?, 500, 1, 3)", 
            [username, hash, player.rgscId]
        );
        
        player.outputChatBox("!{00FF00}Account Protected & Created!");

        const newUser = {
            id: result.insertId,
            username: username,
            money: 500,        
            level: 1,          
            vehicle_slots: 3,
            cooldowns: '{}'    
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

        if (user.social_id && user.social_id !== player.rgscId) {
            console.log(`[Security] Login Blocked. User: ${username} | Saved SCID: ${user.social_id} | Attempt SCID: ${player.rgscId}`);
            return player.outputChatBox("!{FF0000}SECURITY ALERT: This account belongs to a different Social Club ID.");
        }

        const match = await bcrypt.compare(password, user.password);
        if(!match) return player.outputChatBox("!{FF0000}Incorrect password.");

        if (user.social_id === null) {
            await db.query("UPDATE users SET social_id = ? WHERE id = ?", [player.rgscId, user.id]);
            player.outputChatBox("!{F0C400}Account linked to your PC for security.");
        }

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

    // --- FIX 1: LOAD BANK MONEY CORRECTLY ---
    player.data.money = userData.money;
    player.data.bank_money = userData.bank_money || 0; // <--- ADD THIS LINE
    
    player.setVariable('money', userData.money);
    player.setVariable('bank_money', player.data.bank_money);
    player.data.level = userData.level;
    player.data.vehicle_slots = userData.vehicle_slots;

    // Initialize Systems
    QuestManager.initPlayer(player);
    console.log(`[Quests] Initialized for ${player.name}`);
    
    const Banking = require('./banking');
    Banking.initAccount(player);
    // --- COOLDOWN SYSTEM UPGRADE ---
    try {
        // Load existing cooldowns or empty object
        const loadedCooldowns = (typeof userData.cooldowns === 'string') 
            ? JSON.parse(userData.cooldowns || '{}') 
            : (userData.cooldowns || {});
            
        player.data.cooldowns = loadedCooldowns;

        // Sync active cooldowns to Client immediately on login
        const now = Date.now();
        for (const [key, expiry] of Object.entries(loadedCooldowns)) {
            if (expiry > now) {
                player.setVariable('cooldown_' + key, expiry);
            }
        }

    } catch (e) {
        player.data.cooldowns = {};
        console.log(`[Auth] Error parsing cooldowns for ${player.name}:`, e);
    }

    // Helper: Set Cooldown (FIXED FOR DB SAVING)
    player.setCooldown = function(name, minutes) {
        const expiresAt = Date.now() + (minutes * 60000);
        
        // 1. Get current object (Local variable ensures reliability)
        let currentCooldowns = player.data.cooldowns || {};
        
        // 2. Update the key in the local object
        currentCooldowns[name] = expiresAt;

        // 3. Re-assign to player.data to ensure RageMP updates the proxy
        player.data.cooldowns = currentCooldowns;
        
        // 4. Sync to client
        player.setVariable('cooldown_' + name, expiresAt);
        
        // 5. Debug Log
        console.log(`[Cooldown] Saving for ${player.name}:`, JSON.stringify(currentCooldowns));

        // 6. Save to DB using the LOCAL variable (currentCooldowns)
        db.query('UPDATE users SET cooldowns = ? WHERE id = ?', 
            [JSON.stringify(currentCooldowns), player.data.dbId]
        ).catch(err => console.error("[Auth] Cooldown Save Error:", err));
    };

    // Helper: Check Cooldown
    player.hasCooldown = function(name) {
        if (!player.data.cooldowns || !player.data.cooldowns[name]) return false;
        return Date.now() < player.data.cooldowns[name];
    };

    // Helper: Get Time Left
    player.getCooldownTime = function(name) {
        if (!player.data.cooldowns || !player.data.cooldowns[name]) return 0;
        const diff = player.data.cooldowns[name] - Date.now();
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