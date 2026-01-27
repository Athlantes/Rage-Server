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

        const [result] = await db.query(
            "INSERT INTO users (username, password, social_id, money, level, vehicle_slots) VALUES (?, ?, ?, 500, 1, 3)", 
            [username, hash, player.rgscId]
        );
        
        player.outputChatBox("!{00FF00}Account Protected & Created!");

        // Auto-Login
        const newUser = {
            id: result.insertId,
            username: username,
            money: 500,        // Matches DB now
            level: 1,          // Matches DB now
            vehicle_slots: 3   // Matches DB now
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
        // If the account has a Social ID saved, it MUST match the connecting player
        if (user.social_id && user.social_id !== player.rgscId) {
            console.log(`[Security] Login Blocked. User: ${username} | Saved SCID: ${user.social_id} | Attempt SCID: ${player.rgscId}`);
            return player.outputChatBox("!{FF0000}SECURITY ALERT: This account belongs to a different Social Club ID.");
        }

        // Password Check
        const match = await bcrypt.compare(password, user.password);
        if(!match) return player.outputChatBox("!{FF0000}Incorrect password.");

        // If the account was created BEFORE this update (social_id is NULL), 
        // we should save it now to lock it to this player forever.
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
    player.dim = 0; // Back to real world
    
    // CRITICAL: Update the player's name on the server
    // This changes their nametag above their head to the account name
    player.name = userData.username;
    
    // Save IDs to the player object for easy access later
    player.data.dbId = userData.id;
    player.data.username = userData.username;

    // Load Stats
    player.data.money = userData.money;
    player.setVariable('money', userData.money);
    player.data.level = userData.level;
    player.data.vehicle_slots = userData.vehicle_slots;
    
    // Load Saved Position
    if (userData.position) {
        try {
            let pos = JSON.parse(userData.position);
            player.position = new mp.Vector3(pos.x, pos.y, pos.z);
        } catch (e) {
            console.log("Error parsing position for " + userData.username);
            player.position = new mp.Vector3(-1037, -2738, 13); // Default
        }
    } else {
        player.position = new mp.Vector3(-1037, -2738, 13);
    }

    player.call("client:freezePlayer", [false]);
    
    player.outputChatBox(`!{00FF00}Welcome back, ${userData.username}!`);
    player.outputChatBox(`Level: ${player.data.level} | Money: $${player.data.money}`);

    mp.events.call('server:loadAccount', player);
}

mp.events.add('playerQuit', (player) => {
    if (player.logged) {
        playerManager.saveAccount(player);
        console.log(`[Auth] ${player.name} saved on quit.`);
    }
});