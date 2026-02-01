const vehicleManager = require('./vehicles/vehicleManager');
const playerManager = require('./playerManager');
const Inventory = require('../systems/inventory');
const ZoneManager = require('../zones/index.js');
const db = require('./database');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const RANKS = {
    HELPER: 1,
    MODERATOR: 2,
    ADMIN: 3,
    OWNER: 4
};

const COLORS = {
    ERROR: '!{FF0000}',
    SUCCESS: '!{00FF00}',
    INFO: '!{FFFF00}',
    ADMIN: '!{FF4444}',
    WHISPER: '!{AE57EA}'
};

// --- UTILS ---
function getPlayer(targetIdOrName) {
    if (!targetIdOrName) return null;
    let target = mp.players.at(parseInt(targetIdOrName));
    if (!target) {
        target = mp.players.toArray().find(p => p.name.toLowerCase().includes(targetIdOrName.toLowerCase()));
    }
    return target;
}

function checkRank(player, minRank) {
    if (!player.logged || (player.data.adminLevel || 0) < minRank) {
        player.outputChatBox(`${COLORS.ERROR} You are not authorized (Level ${minRank}+ required).`);
        return false;
    }
    return true;
}

// ----------------------------------------------------------------------------
// GENERAL ROLEPLAY COMMANDS (Existing)
// ----------------------------------------------------------------------------

mp.events.addCommand('help', (player) => {
    player.outputChatBox(`${COLORS.INFO}Available Commands:`);
    player.outputChatBox(`!{FFFFFF}/me, /do, /stats, /w, /buycar, /parkcar, /refuel, /lock, /engine`);
    if (player.data.adminLevel > 0) player.outputChatBox(`${COLORS.ADMIN}Admin: /ahelp`);
});

mp.events.addCommand('stats', (player) => {
    if (!player.data) return;
    const money = player.data.money || 0;
    const bank = player.data.bank_money || 0; // Fixed variable name based on auth.js
    const level = player.data.level || 0;
    const job = player.activeJobId ? player.activeJobId.toUpperCase() : "None";
    
    player.outputChatBox(`${COLORS.SUCCESS}[Stats] !{FFFFFF}Money: $${money} | Bank: $${bank} | Level: ${level} | Job: ${job}`);
});

mp.events.addCommand('me', (player, fullText) => {
    if (!fullText) return player.outputChatBox("Usage: /me [action]");
    mp.players.forEachInRange(player.position, 20.0, (target) => {
        target.call('chat:push', [null, `* ${player.name} ${fullText}`, 'me']);
    });
});

mp.events.addCommand('do', (player, fullText) => {
    if (!fullText) return player.outputChatBox("Usage: /do [description]");
    mp.players.forEachInRange(player.position, 20.0, (target) => {
        target.call('chat:push', [null, `* ${fullText} (( ${player.name} ))`, 'do']);
    });
});

mp.events.addCommand('w', (player, fullText) => {
    const args = fullText.split(' ');
    if (args.length < 2) return player.outputChatBox("Usage: /w [id/name] [message]");
    
    const target = getPlayer(args[0]);
    const msg = args.slice(1).join(' ');

    if (!target) return player.outputChatBox(`${COLORS.ERROR}Player not found.`);
    if (player.dist(target.position) > 10.0) return player.outputChatBox(`${COLORS.ERROR}Player is too far.`);

    target.call('chat:push', [`(Whisper) ${player.name}`, msg, 'whisper']);
    player.call('chat:push', [`(Whisper) to ${target.name}`, msg, 'whisper']);
});

// ----------------------------------------------------------------------------
// PLAYER VEHICLE COMMANDS
// ----------------------------------------------------------------------------

mp.events.addCommand('buycar', (player, model) => {
    if (!player.logged) return player.outputChatBox("Login first!");
    if (!model) return player.outputChatBox("Usage: /buycar [modelname]");
    vehicleManager.create(player, model); // Integrated with your vehicleManager
});

mp.events.addCommand('parkcar', (player) => {
    const veh = player.vehicle;
    if (!veh) return player.call('showNotification', ['Garage', 'You must be in a vehicle.']);
    if (veh.ownerId !== player.data.dbId) return player.call('showNotification', ['Garage', 'You do not own this vehicle.']);
    
    vehicleManager.savePosition(veh); // Updates DB position
    player.call('client:leaveVehicle');
    player.call('showNotification', ['Garage', 'Vehicle parked here.']);
});

mp.events.addCommand('lock', (player) => mp.events.call('vehicle:toggleLock', player));
mp.events.addCommand('engine', (player) => mp.events.call('vehicle:toggleEngine', player));

mp.events.addCommand('refuel', async (player) => {
    const veh = player.vehicle;
    if (!veh) return;
    
    player.call('showNotification', ['Fuel', 'Refueling...']);
    setTimeout(async () => {
        if (mp.vehicles.exists(veh)) {
            const success = await playerManager.removeMoney(player, 50, "Refuel");
            if (success) {
                veh.setVariable('fuel', 100.0);
                player.call('showNotification', ['Fuel', 'Tank Full ($50).']);
            } else {
                player.call('showNotification', ['Fuel', 'Not enough money!']);
            }
        }
    }, 3000);
});

// ----------------------------------------------------------------------------
// ADMIN SYSTEM
// ----------------------------------------------------------------------------

mp.events.addCommand('ahelp', (player) => {
    if (!checkRank(player, RANKS.HELPER)) return;
    player.outputChatBox(`${COLORS.ADMIN}--- Admin Commands ---`);
    player.outputChatBox(`!{FFFFFF}Helper: /a, /aduty, /goto, /gethere, /kick, /spectate`);
    if (player.data.adminLevel >= RANKS.MODERATOR) player.outputChatBox(`!{FFFFFF}Mod: /ban, /unban, /freeze, /unfreeze, /tpcoords,`);
    if (player.data.adminLevel >= RANKS.ADMIN) player.outputChatBox(`!{FFFFFF}Admin: /veh, /dv, /fix, /giveitem, /setmoney, /sethealth, /addscooter, /delscooter`);
    if (player.data.adminLevel >= RANKS.OWNER) player.outputChatBox(`!{FFFFFF}Owner: /makeadmin, /giveveh, /savecoords`);
});

// --- ADMIN DUTY (Godmode + Label) ---
mp.events.addCommand('aduty', (player) => {
    if (!checkRank(player, RANKS.HELPER)) return;

    player.data.adminDuty = !player.data.adminDuty;
    
    if (player.data.adminDuty) {
        // Enable Godmode & Visuals
        player.setVariable('isAdminDuty', true); // Use this client-side for nametags
        player.health = 100;
        player.armour = 100;
        player.call('client:setGodmode', [true]); // Assuming you have a client event for this
        mp.players.broadcast(`${COLORS.ADMIN}[ADMIN] ${player.name} is now on duty.`);
    } else {
        // Disable
        player.setVariable('isAdminDuty', false);
        player.call('client:setGodmode', [false]);
        mp.players.broadcast(`${COLORS.INFO}[ADMIN] ${player.name} is now off duty.`);
    }
});


// --- ADMIN CHAT ---
mp.events.addCommand('a', (player, fullText) => {
    if (!checkRank(player, RANKS.HELPER)) return;
    if (!fullText) return player.outputChatBox("Usage: /a [message]");

    const msg = `${COLORS.ADMIN}[A-Chat] ${player.name} (${player.data.adminLevel}): !{FFFFFF}${fullText}`;
    
    mp.players.forEach(p => {
        if (p.logged && p.data.adminLevel > 0) {
            p.outputChatBox(msg);
        }
    });
});

// --- TELEPORTATION ---
mp.events.addCommand('goto', (player, targetName) => {
    if (!checkRank(player, RANKS.HELPER)) return;
    const target = getPlayer(targetName);
    if (!target) return player.outputChatBox(`${COLORS.ERROR}Player not found.`);

    player.position = new mp.Vector3(target.position.x + 1, target.position.y + 1, target.position.z);
    player.dimension = target.dimension;
    player.outputChatBox(`${COLORS.SUCCESS}Teleported to ${target.name}.`);
});

mp.events.addCommand('gethere', (player, targetName) => {
    if (!checkRank(player, RANKS.HELPER)) return;
    const target = getPlayer(targetName);
    if (!target) return player.outputChatBox(`${COLORS.ERROR}Player not found.`);

    target.position = player.position;
    target.dimension = player.dimension;
    target.outputChatBox(`${COLORS.ADMIN}You were summoned by an Admin.`);
    player.outputChatBox(`${COLORS.SUCCESS}Summoned ${target.name}.`);
});

mp.events.addCommand('tpcoords', (player, fullText) => {
    if (!checkRank(player, RANKS.MODERATOR)) return;
    const args = fullText.split(' ');
    if (args.length < 3) return player.outputChatBox("Usage: /tpcoords [x] [y] [z]");

    player.position = new mp.Vector3(parseFloat(args[0]), parseFloat(args[1]), parseFloat(args[2]));
});

// --- PLAYER MANAGEMENT ---
mp.events.addCommand('kick', (player, fullText) => {
    if (!checkRank(player, RANKS.HELPER)) return;
    const args = fullText.split(' ');
    const target = getPlayer(args[0]);
    const reason = args.slice(1).join(' ') || "No reason specified";

    if (!target) return player.outputChatBox(`${COLORS.ERROR}Player not found.`);
    if (target.data.adminLevel >= player.data.adminLevel) return player.outputChatBox(`${COLORS.ERROR}You cannot kick this admin.`);

    mp.players.broadcast(`${COLORS.ADMIN}[Kick] ${target.name} was kicked by ${player.name}. Reason: ${reason}`);
    target.kick(reason);
});

mp.events.addCommand('ban', async (player, fullText) => {
    if (!checkRank(player, RANKS.ADMIN)) return; // Recommend Rank 3 (Admin) for Perm Bans

    const args = fullText.split(' ');
    const targetName = args[0];
    const reason = args.slice(1).join(' ') || "Breach of rules";

    if (!targetName) return player.outputChatBox("Usage: /ban [username] [reason]");

    try {
        const [rows] = await db.query("SELECT id, username FROM users WHERE username = ?", [targetName]);
        if (rows.length === 0) return player.outputChatBox("!{FF0000}User not found.");
        
        const targetDbId = rows[0].id;
        const targetUsername = rows[0].username;

        // INSERT as Permanent (expire_time is omitted, so it defaults to NULL)
        await db.query(
            "INSERT INTO user_bans (user_id, admin_name, reason, active, expire_time) VALUES (?, ?, ?, 1, NULL)",
            [targetDbId, player.name, reason]
        );

        // Kick if online
        const targetPlayer = mp.players.toArray().find(p => p.name === targetUsername);
        if (targetPlayer) {
            targetPlayer.outputChatBox(`!{FF0000}You have been PERMANENTLY BANNED by ${player.name}.`);
            targetPlayer.outputChatBox(`!{FF0000}Reason: ${reason}`);
            targetPlayer.kick(`Permanent Ban: ${reason}`);
        }

        mp.players.broadcast(`!{FF0000}[ADMIN] ${targetUsername} was PERMANENTLY banned by ${player.name}. (${reason})`);

    } catch (err) {
        console.error(err);
        player.outputChatBox("!{FF0000}Database Error.");
    }
});

// 2. TEMPORARY BAN COMMAND
mp.events.addCommand('tempban', async (player, fullText) => {
    if (!checkRank(player, RANKS.MODERATOR)) return; // Moderators can usually tempban

    const args = fullText.split(' ');
    const targetName = args[0];
    const minutes = parseInt(args[1]);
    const reason = args.slice(2).join(' ') || "Temporary suspension";

    if (!targetName || isNaN(minutes)) return player.outputChatBox("Usage: /tempban [username] [minutes] [reason]");

    try {
        const [rows] = await db.query("SELECT id, username FROM users WHERE username = ?", [targetName]);
        if (rows.length === 0) return player.outputChatBox("!{FF0000}User not found.");

        const targetDbId = rows[0].id;
        const targetUsername = rows[0].username;

        // INSERT with Expiration Date
        await db.query(
            `INSERT INTO user_bans (user_id, admin_name, reason, active, expire_time) 
             VALUES (?, ?, ?, 1, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
            [targetDbId, player.name, reason, minutes]
        );

        const targetPlayer = mp.players.toArray().find(p => p.name === targetUsername);
        if (targetPlayer) {
            targetPlayer.outputChatBox(`!{FF0000}You have been BANNED for ${minutes} minutes.`);
            targetPlayer.outputChatBox(`!{FF0000}Reason: ${reason}`);
            targetPlayer.kick(`Temp Ban (${minutes}m): ${reason}`);
        }

        mp.players.broadcast(`!{FF0000}[ADMIN] ${targetUsername} was banned for ${minutes} mins by ${player.name}.`);

    } catch (err) {
        console.error(err);
        player.outputChatBox("!{FF0000}Database Error.");
    }
});

mp.events.addCommand('unban', async (player, targetName) => {
    if (!checkRank(player, RANKS.MODERATOR)) return;
    if (!targetName) return player.outputChatBox("Usage: /unban [username]");

    try {
        // Find the user ID
        const [users] = await db.query("SELECT id FROM users WHERE username = ?", [targetName]);
        if (users.length === 0) return player.outputChatBox(`${COLORS.ERROR}User not found.`);
        
        const targetId = users[0].id;

        // Set all active bans to inactive
        const [result] = await db.query(
            "UPDATE user_bans SET active = 0 WHERE user_id = ? AND active = 1", 
            [targetId]
        );

        if (result.changedRows > 0) {
            player.outputChatBox(`${COLORS.SUCCESS}Unbanned ${targetName} (${result.changedRows} records closed).`);
        } else {
            player.outputChatBox(`${COLORS.INFO}${targetName} is not currently banned.`);
        }

    } catch (err) {
        console.error(err);
        player.outputChatBox(`${COLORS.ERROR}Database error.`);
    }
});

mp.events.addCommand('freeze', (player, targetName) => {
    if (!checkRank(player, RANKS.MODERATOR)) return;
    const target = getPlayer(targetName);
    if (!target) return player.outputChatBox(`${COLORS.ERROR}Player not found.`);

    target.call('client:freezePlayer', [true]); // Needs client event
    target.outputChatBox(`${COLORS.ADMIN}You have been frozen.`);
    player.outputChatBox(`${COLORS.SUCCESS}Frozen ${target.name}.`);
});

mp.events.addCommand('unfreeze', (player, targetName) => {
    if (!checkRank(player, RANKS.MODERATOR)) return;
    const target = getPlayer(targetName);
    if (!target) return player.outputChatBox(`${COLORS.ERROR}Player not found.`);

    target.call('client:freezePlayer', [false]);
    player.outputChatBox(`${COLORS.SUCCESS}Unfrozen ${target.name}.`);
});

mp.events.addCommand('revive', (player, targetName) => {
    if (!checkRank(player, RANKS.ADMIN)) return;
    let target = targetName ? getPlayer(targetName) : player;
    if (!target) return player.outputChatBox(`${COLORS.ERROR}Player not found.`);

    target.health = 100;
    target.armour = 0;
    // If you have a death system, emit the revive event here:
    // mp.events.call('server:player:revive', target); 
    player.outputChatBox(`${COLORS.SUCCESS}Revived ${target.name}.`);
});

// --- VEHICLE MANAGEMENT ---

// Temporary Admin Vehicle
mp.events.addCommand('veh', (player, model) => {
    if (!checkRank(player, RANKS.ADMIN)) return;
    if (!model) return player.outputChatBox("Usage: /veh [model]");

    const pos = player.position;
    const veh = mp.vehicles.new(mp.joaat(model), pos, {
        numberPlate: "ADMIN",
        dimension: player.dimension,
        locked: false,
        engine: false
    }); 

    veh.setVariable('engine', false);
    veh.setVariable('fuel', 100.0);
    
    setTimeout(() => {
        if (mp.players.exists(player) && mp.vehicles.exists(veh)) {
            player.call('client:warpIntoVehicle', [veh.id, -1]);
        }
    }, 250); 

    player.outputChatBox(`${COLORS.SUCCESS}Spawned temporary ${model}.`);
});

// Permanent Database Vehicle (Uses vehicleManager)
mp.events.addCommand('giveveh', async (player, fullText) => {
    if (!checkRank(player, RANKS.OWNER)) return;
    const args = fullText.split(' ');
    const target = getPlayer(args[0]);
    const model = args[1];

    if (!target || !model) return player.outputChatBox("Usage: /giveveh [id/name] [model]");

    await vehicleManager.create(target, model);
    player.outputChatBox(`${COLORS.SUCCESS}Gifted ${model} to ${target.name}.`);
});

mp.events.addCommand('dv', (player) => {
    if (!checkRank(player, RANKS.ADMIN)) return;
    
    // Check if in vehicle
    if (player.vehicle) {
        const veh = player.vehicle;
        vehicleManager.despawnVehicle(veh); // Updates DB to parked=1 if it's a saved car
        player.outputChatBox(`${COLORS.SUCCESS}Vehicle deleted.`);
        return;
    }

    // Check nearest vehicle
    let nearestVeh = null;
    let minDist = 5.0;

    mp.vehicles.forEachInRange(player.position, 5.0, (veh) => {
        const dist = player.dist(veh.position);
        if (dist < minDist) {
            minDist = dist;
            nearestVeh = veh;
        }
    });

    if (nearestVeh) {
        vehicleManager.despawnVehicle(nearestVeh);
        player.outputChatBox(`${COLORS.SUCCESS}Nearest vehicle deleted.`);
    } else {
        player.outputChatBox(`${COLORS.ERROR}No vehicle nearby.`);
    }
});

mp.events.addCommand('fix', (player) => {
    if (!checkRank(player, RANKS.ADMIN)) return;
    
    if (player.vehicle) {
        // 1. Repair Body & Engine
        player.vehicle.repair();
        
        // 2. Set Fuel to 100%
        player.vehicle.setVariable('fuel', 100.0);
        
        player.outputChatBox(`${COLORS.SUCCESS}Vehicle repaired and refueled.`);
    } else {
        player.outputChatBox(`${COLORS.ERROR}You must be in a vehicle.`);
    }
});
// --- ECONOMY & INVENTORY INTEGRATION ---

mp.events.addCommand('setmoney', async (player, fullText) => {
    if (!checkRank(player, RANKS.ADMIN)) return;
    const args = fullText.split(' ');
    const target = getPlayer(args[0]);
    const amount = parseInt(args[1]);

    if (!target || isNaN(amount)) return player.outputChatBox("Usage: /setmoney [player] [amount]");

    target.data.money = amount;
    // We update the DB manually here to override the additive logic in playerManager
    target.setVariable('money', amount);
    await db.query("UPDATE users SET money = ? WHERE id = ?", [amount, target.data.dbId]);
    
    player.outputChatBox(`${COLORS.SUCCESS}Set ${target.name}'s money to $${amount}.`);
});

mp.events.addCommand('givemoney', async (player, fullText) => {
    if (!checkRank(player, RANKS.ADMIN)) return;
    const args = fullText.split(' ');
    const target = getPlayer(args[0]);
    const amount = parseInt(args[1]);

    if (!target || isNaN(amount)) return player.outputChatBox("Usage: /givemoney [player] [amount]");

    await playerManager.addMoneyAndSave(target, amount, "Admin Grant");
    player.outputChatBox(`${COLORS.SUCCESS}Gave $${amount} to ${target.name}.`);
});

mp.events.addCommand('giveitem', async (player, fullText) => {
    if (!checkRank(player, RANKS.ADMIN)) return;
    const args = fullText.split(' ');
    const target = getPlayer(args[0]);
    const item = args[1];
    const amount = parseInt(args[2]) || 1;

    if (!target || !item) return player.outputChatBox("Usage: /giveitem [player] [itemId] [amount]");

    // INTEGRATION: Use Inventory System
    const success = await Inventory.addItem(target, item, amount);
    
    if (success) {
        player.outputChatBox(`${COLORS.SUCCESS}Gave ${amount}x ${item} to ${target.name}.`);
        target.outputChatBox(`${COLORS.INFO}Admin gave you ${amount}x ${item}.`);
    } else {
        player.outputChatBox(`${COLORS.ERROR}Failed to give item (Invalid ID or Full Inventory).`);
    }
});

// --- SYSTEM / DEV COMMANDS ---

mp.events.addCommand('makeadmin', async (player, fullText) => {
    if (!checkRank(player, RANKS.OWNER)) return;
    const args = fullText.split(' ');
    const target = getPlayer(args[0]);
    const level = parseInt(args[1]);

    if (!target || isNaN(level)) return player.outputChatBox("Usage: /makeadmin [player] [level (0-4)]");

    target.data.adminLevel = level;
    await db.query("UPDATE users SET admin_level = ? WHERE id = ?", [level, target.data.dbId]);

    player.outputChatBox(`${COLORS.SUCCESS}Set ${target.name} to Admin Level ${level}.`);
    target.outputChatBox(`${COLORS.ADMIN}You are now Admin Level ${level}.`);
});

mp.events.addCommand('savecoords', (player, fullText) => {
    if (!checkRank(player, RANKS.OWNER)) return;
    const pos = player.vehicle ? player.vehicle.position : player.position;
    const heading = player.vehicle ? player.vehicle.heading : player.heading;
    const name = fullText || "Location";
    
    const coordString = `\n// ${name}\n{ x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}, h: ${heading.toFixed(2)} },`;

    const filePath = path.join(__dirname, `../../saved_coords_${player.name}.txt`);
    
    fs.appendFile(filePath, coordString, (err) => {
        if (err) return console.log(err);
        player.outputChatBox(`${COLORS.SUCCESS}Saved coords to saved_coords_${player.name}.txt`);
    });
});

mp.events.addCommand('currentzone', (player) => {
    // Debug for development
    if (player.data.adminLevel < 1) return;
    
    const broadZones = ZoneManager.getBroadPhaseZones(player);
    const preciseZones = broadZones.filter(id => ZoneManager.isPlayerInZone(player, id));
    
    player.outputChatBox(`${COLORS.INFO}Zones: ${preciseZones.join(', ') || 'None'}`);
});