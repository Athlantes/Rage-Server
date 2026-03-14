const vehicleManager = require('./vehicles/vehicleManager');
const playerManager = require('./playerManager');
const Inventory = require('../systems/inventory');
const ZoneManager = require('../zones/index.js');
const HouseManager = require('../systems/houseManager');
const factionsManager = require('../factions/factionsManager');
const wardrobeManager = require('../factions/wardrobe/wardrobeManager');
const dispatchManager = require('../factions/dispatch/dispatchManager');
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
    if (targetIdOrName === null || targetIdOrName === undefined) return null;

    // 1. Try to find by custom Online ID (Numeric)
    const id = parseInt(targetIdOrName);
    if (!isNaN(id)) {
        const found = mp.players.toArray().find(p => p.data.onlineId === id);
        if (found) return found;
    }

    // 2. Fallback: Search by Name (Partial)
    const lowerName = targetIdOrName.toString().toLowerCase();
    return mp.players.toArray().find(p => p.name.toLowerCase().includes(lowerName));
}

function checkRank(player, minRank) {
    if (!player.logged || (player.data.adminLevel || 0) < minRank) {
        player.outputChatBox(`${COLORS.ERROR} You are not authorized (Level ${minRank}+ required).`);
        return false;
    }
    return true;
}

// Colour helper (same shape as familyManager.hexToRgbArr)
function hexToRgbArr(hex) {
    if (!hex) return [255,255,255,255];
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
    return [
        isNaN(r) ? 255 : r,
        isNaN(g) ? 255 : g,
        isNaN(b) ? 255 : b,
        255
    ];
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
    const bank = player.data.bank_money || 0; 
    const level = player.data.level || 0;
    const onlineId = player.data.onlineId !== undefined ? player.data.onlineId : "-";
    const job = player.activeJobId ? player.activeJobId.toUpperCase() : "None";
    
    player.outputChatBox(`${COLORS.SUCCESS}[Stats] !{FFFFFF}ID: ${onlineId} | Money: $${money} | Bank: $${bank} | Level: ${level} | Job: ${job}`);
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
    vehicleManager.create(player, model); 
});

mp.events.addCommand('parkcar', (player) => {
    const veh = player.vehicle;
    if (!veh) return player.call('showNotification', ['Garage', 'You must be in a vehicle.']);
    if (veh.ownerId !== player.data.dbId) return player.call('showNotification', ['Garage', 'You do not own this vehicle.']);
    
    vehicleManager.savePosition(veh); 
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
            const success = await PlayerManager.removeMoneyAndSave(player, 50, "Refuel");
            if (success) {
                veh.setVariable('fuel', 100.0);
                player.call('showNotification', ['Fuel', 'Tank Full ($50).']);
            } else {
                player.call('showNotification', ['Fuel', 'Not enough money!']);
            }
        }
    }, 3000);
});

// --- HOUSING COMMANDS (PLAYER) ---

mp.events.addCommand('sellhouse', async (player) => {
    // Simple sell logic: get 50% back
    // (You can move this to HouseManager.js if you want it cleaner)
    const house = HouseManager.getNearestHouse(player.position);
    if (!house) return player.outputChatBox("!{FF0000}Go to your house entrance.");
    if (house.ownerId !== player.data.dbId) return player.outputChatBox("!{FF0000}You don't own this house.");

    try {
        await db.query("UPDATE houses SET owner_id = 0 WHERE id = ?", [house.id]);
        
        const refund = Math.floor(house.price / 2);
        player.data.money += refund; // Update memory
        // await db.query("UPDATE users...") // Update DB money here ideally
        
        house.ownerId = 0;
        house.label.text = `House #${house.id}\n~g~For Sale: $${house.price}`;
        house.marker.setColor(0, 255, 0, 100);
        
        player.outputChatBox(`!{00FF00}House sold for $${refund}.`);
    } catch (err) {
        player.outputChatBox("!{FF0000}Error selling house.");
    }
});

// This overrides your existing lock command if you wish, or you can merge logic
mp.events.addCommand('lockhouse', (player) => {
    HouseManager.lockHouse(player);
});

// --- FACTION COMMANDS --- 

mp.events.addCommand('duty', (player) => {
    // 1. Check if the player is in a faction
    if (!player.factionId) {
        return player.outputChatBox("!{#ff0000}You are not in a faction.");
    }

    // 2. Fetch the player's faction data
    const faction = factionsManager.getFaction(player.factionId);
    if (!faction) return player.outputChatBox("!{#ff0000}Error loading your faction data.");

    // 3. Check if this faction even has a duty point defined
    if (!faction.hq || !faction.hq.dutyPoint) {
        return player.outputChatBox("!{#ff0000}Your faction does not have a designated locker room.");
    }

    // 4. Check if the player is close to the locker room AND in the right dimension
    const dist = player.dist(faction.hq.dutyPoint);
    if (dist > 3.0 || player.dimension !== faction.hq.dimension) {
        return player.outputChatBox("!{#ff0000}You must be at your faction's HQ locker room to go on duty.");
    }

    // 5. Check if the faction has a wardrobe system and require a uniform
    const hasWardrobe = wardrobeManager.getConfig(player.factionId);
    if (hasWardrobe) {
        const hasUniform = wardrobeManager.hasUniformSet(player, player.factionId);
        if (!hasUniform) {
            return player.outputChatBox("!{#ff0000}You must select a uniform at the wardrobe before going on duty.");
        }
    }

    // 6. Toggle the duty state
    let onDuty = player.getVariable('factionDuty') || false;
    player.setVariable('factionDuty', !onDuty);

    if (!onDuty) {
        player.outputChatBox(`!{#00ff00}You are now ON duty for ${faction.name}.`);
        
        // Apply faction uniform if wardrobe is configured
        if (hasWardrobe) {
            const applied = wardrobeManager.applyUniform(player, player.factionId);
            if (applied) {
                player.outputChatBox("!{#00a8ff}Your uniform has been applied.");
            }
        }

        // Set nametag color for on-duty players (if faction defines a color)
        try {
            if (faction.color) {
                player.setVariable('factionNametagColor', hexToRgbArr(faction.color));
            }
        } catch (e) {
            console.error('[Duty] Failed to apply faction nametag color:', e);
        }
    } else {
        player.outputChatBox("!{#ff0000}You are now OFF duty.");
        
        // Remove uniform and restore inventory clothes
        if (hasWardrobe) {
            wardrobeManager.removeUniform(player);
            player.outputChatBox("!{#00a8ff}Your uniform has been removed.");
        }

        // Cancel any active dispatch assignment for this driver
        try {
            const assignment = dispatchManager.getAssignment(player.id);
            if (assignment) {
                // Notify the caller that ride was cancelled
                if (assignment.callerServerId !== null) {
                    const caller = mp.players.at(assignment.callerServerId);
                    if (caller && mp.players.exists(caller)) {
                        caller.outputChatBox('!{#ff4757}[DISPATCH] !{#ffffff}Your driver went off-duty. Please request a new ride.');
                        caller.call('client:taxi:callCancelled', []);
                    }
                    // Clean up the caller's phone call state
                    try {
                        const taxiCommand = require('../factions/taxi/taxiCommand');
                        taxiCommand.activePhoneCalls.delete(assignment.callerServerId);
                    } catch (e) {}
                }
                dispatchManager.cancelAssignment(player.id, 'Driver went off-duty.');
            }
        } catch (e) {
            console.error('[Duty] Error cleaning up dispatch assignment:', e);
        }

        // Optional: Despawn their faction vehicle if they go off duty
        if (player.factionVehicle && mp.vehicles.exists(player.factionVehicle)) {
            player.factionVehicle.destroy();
            player.factionVehicle = null;
            player.outputChatBox("!{#ffcc00}Your faction vehicle has been returned to the garage.");
        }
        // Clear any faction nametag color when off duty
        try { player.setVariable('factionNametagColor', null); } catch(e) {}
    }
});

// ----------------------------------------------------------------------------
// ADMIN SYSTEM
// ----------------------------------------------------------------------------

// --- HOUSING COMMANDS (ADMIN) ---

mp.events.addCommand('createhouse', (player, fullText) => {
    if (!checkRank(player, RANKS.ADMIN)) return;
    const args = fullText.split(' ');
    const price = parseInt(args[0]);
    const interior = args[1];

    if (isNaN(price) || !interior) {
        return player.outputChatBox("Usage: /createhouse [price] [interior_preset] (e.g., motel, modern)");
    }
    HouseManager.createNewHouse(player, price, interior);
});

mp.events.addCommand('delhouse', (player) => {
    if (!checkRank(player, RANKS.ADMIN)) return;
    HouseManager.deleteNearestHouse(player);
});

mp.events.addCommand('sethouseowner', async (player, fullText) => {
    if (!checkRank(player, RANKS.ADMIN)) return;
    const args = fullText.split(' ');
    const houseId = parseInt(args[0]);
    const targetId = parseInt(args[1]); 

    if (isNaN(houseId) || isNaN(targetId)) return player.outputChatBox("Usage: /sethouseowner [houseId] [targetDbId]");

    const house = HouseManager.getHouseById(houseId);
    if (!house) return player.outputChatBox("!{FF0000}House not found.");

    // Update DB
    const db = require('./database'); // Require only if not globally available
    await db.query("UPDATE houses SET owner_id = ? WHERE id = ?", [targetId, houseId]);
    
    // Update Visuals via HouseManager cache
    house.ownerId = targetId;
    const isOwned = targetId > 0;
    
    if (house.label) house.label.text = `House #${house.id}\n${isOwned ? "~r~Owned" : `~g~For Sale: $${house.price}`}`;
    if (house.marker) house.marker.setColor(isOwned ? 255 : 0, isOwned ? 0 : 255, 0, 100);
    if (house.blip) {
        house.blip.setColor(isOwned ? 1 : 2);
        house.blip.name = isOwned ? "House (Owned)" : "House For Sale";
    }

    player.outputChatBox(`!{00FF00}Set House #${houseId} owner to ID ${targetId}.`);
});

mp.events.addCommand('gotohouse', (player, id) => {
    if (!checkRank(player, RANKS.HELPER)) return;
    const houseId = parseInt(id);
    const house = HouseManager.getHouseById(houseId);
    
    if (house) {
        player.position = new mp.Vector3(house.position.x, house.position.y, house.position.z);
        player.dimension = 0;
        player.outputChatBox(`!{00FF00}Teleported to House #${houseId}.`);
    } else {
        player.outputChatBox("!{FF0000}House not found.");
    }
});

// --- ADMIN DUTY (Godmode + Label) ---
mp.events.addCommand('ahelp', (player) => {
    if (!checkRank(player, RANKS.HELPER)) return;
    player.outputChatBox(`${COLORS.ADMIN}--- Admin Commands ---`);
    player.outputChatBox(`!{FFFFFF}Helper: /a, /aduty, /goto, /gethere, /kick, /spectate`);
    if (player.data.adminLevel >= RANKS.MODERATOR) player.outputChatBox(`!{FFFFFF}Mod: /ban, /unban, /freeze, /unfreeze, /tpcoords,`);
    if (player.data.adminLevel >= RANKS.ADMIN) player.outputChatBox(`!{FFFFFF}Admin: /veh, /dv, /fix, /giveitem, /setmoney, /sethealth, /savelandmark`);
    if (player.data.adminLevel >= RANKS.OWNER) player.outputChatBox(`!{FFFFFF}Owner: /makeadmin, /giveveh, /savecoords`);
});

mp.events.addCommand('aduty', (player) => {
    if (!checkRank(player, RANKS.HELPER)) return;

    player.data.adminDuty = !player.data.adminDuty;
    
    if (player.data.adminDuty) {
        player.setVariable('isAdminDuty', true); 
        player.health = 100;
        player.armour = 100;
        player.call('client:setGodmode', [true]); 
        mp.players.broadcast(`${COLORS.ADMIN}[ADMIN] ${player.name} is now on duty.`);
    } else {
        player.setVariable('isAdminDuty', false);
        player.call('client:setGodmode', [false]);
        mp.players.broadcast(`${COLORS.INFO}[ADMIN] ${player.name} is now off duty.`);
    }
});

mp.events.addCommand('flymode', (player) => {
    // Check if the player is at least a Moderator (change to RANKS.ADMIN if you want it stricter)
    if (!checkRank(player, RANKS.MODERATOR)) return;

    // Get current fly state (default to false)
    let isFlying = player.getVariable('isFlying') || false;
    
    // Toggle state
    isFlying = !isFlying;
    player.setVariable('isFlying', isFlying);

    // Call the client to actually enable/disable the physics of flying
    player.call('client:toggleFlyMode', [isFlying]);

    // Notify the admin
    if (isFlying) {
        player.outputChatBox(`${COLORS.SUCCESS}Flymode (NoClip) ENABLED. Use WASD to move, Space (Up), Ctrl (Down), Shift (Sprint).`);
    } else {
        player.outputChatBox(`${COLORS.INFO}Flymode (NoClip) DISABLED.`);
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

mp.events.addCommand('savelandmark', (player, fullText) => {
    if (!checkRank(player, RANKS.ADMIN)) return;

    const args = fullText.split(' ');
    const reward = parseInt(args[0]);
    const name = args.slice(1).join(' ');

    if (isNaN(reward) || !name) {
        return player.outputChatBox(`${COLORS.ERROR}Usage: /savelandmark [reward_amount] [Landmark Name]`);
    }

    const pos = player.position;
    const outputString = `\n    { id: 0, name: "${name}", pos: { x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)} }, reward: ${reward} },`;
    const filePath = path.join(__dirname, '../../saved_landmarks.txt');

    fs.appendFile(filePath, outputString, (err) => {
        if (err) {
            console.error(err);
            player.outputChatBox(`${COLORS.ERROR}Failed to save landmark.`);
        } else {
            player.outputChatBox(`${COLORS.SUCCESS}Saved landmark "${name}" with reward $${reward}.`);
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
    if (!checkRank(player, RANKS.ADMIN)) return; 
    const args = fullText.split(' ');
    const targetName = args[0];
    const reason = args.slice(1).join(' ') || "Breach of rules";

    if (!targetName) return player.outputChatBox("Usage: /ban [username] [reason]");

    try {
        const [rows] = await db.query("SELECT id, username FROM users WHERE username = ?", [targetName]);
        if (rows.length === 0) return player.outputChatBox("!{FF0000}User not found.");
        
        const targetDbId = rows[0].id;
        const targetUsername = rows[0].username;

        await db.query(
            "INSERT INTO user_bans (user_id, admin_name, reason, active, expire_time) VALUES (?, ?, ?, 1, NULL)",
            [targetDbId, player.name, reason]
        );

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

mp.events.addCommand('tempban', async (player, fullText) => {
    if (!checkRank(player, RANKS.MODERATOR)) return; 
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

        await db.query(
            `INSERT INTO user_bans (user_id, admin_name, reason, active, expire_time) 
             VALUES (?, ?, ?, 1, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
            [targetDbId, player.name, reason, minutes]
        );

        const targetPlayer = mp.players.toArray().find(p => p.name === targetUsername);
        if (targetPlayer) {
            targetPlayer.outputChatBox(`!{FF0000}You have been BANNED for ${minutes} minutes.`);
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
        const [users] = await db.query("SELECT id FROM users WHERE username = ?", [targetName]);
        if (users.length === 0) return player.outputChatBox(`${COLORS.ERROR}User not found.`);
        
        const targetId = users[0].id;
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

    target.call('client:freezePlayer', [true]); 
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
    player.outputChatBox(`${COLORS.SUCCESS}Revived ${target.name}.`);
});

mp.events.addCommand('setfaction', async (player, fullText) => {
    // Check if the player is at least an Admin (Level 3)
    if (!checkRank(player, RANKS.ADMIN)) return;

    if (!fullText) return player.outputChatBox("Usage: /setfaction [id/name] [factionId] [rank (default: 1)]");

    const args = fullText.split(' ');
    const target = getPlayer(args[0]);
    const factionId = parseInt(args[1]);
    const rank = parseInt(args[2]) || 1; // Defaults to rank 1 if they don't type a 3rd argument

    if (!target) return player.outputChatBox(`${COLORS.ERROR}Player not found.`);
    if (isNaN(factionId)) return player.outputChatBox("Usage: /setfaction [id/name] [factionId] [rank]");

    // Verify faction exists if they aren't removing (0 = civilian/removal)
    if (factionId > 0) {
        const faction = factionsManager.getFaction(factionId);
        if (!faction) return player.outputChatBox(`${COLORS.ERROR}Faction ID ${factionId} does not exist.`);
    }

    // Update the player's memory state (null = no faction)
    target.factionId = factionId > 0 ? factionId : null;
    target.factionRank = factionId > 0 ? rank : 0;
    
    // Sync to the client-side for UI purposes (like your inventory or radial menu)
    target.setVariable('factionId', target.factionId);

    try {
        // Save the changes to the database
        await db.query("UPDATE users SET faction_id = ?, faction_rank = ?, faction_joined_at = ? WHERE id = ?", [target.factionId, target.factionRank, target.factionId ? new Date() : null, target.data.dbId]);
        
        if (!target.factionId) {
            player.outputChatBox(`${COLORS.SUCCESS}You removed ${target.name} from their faction.`);
            target.outputChatBox(`${COLORS.INFO}You have been removed from your faction by an admin.`);
        } else {
            const faction = factionsManager.getFaction(factionId);
            player.outputChatBox(`${COLORS.SUCCESS}You placed ${target.name} into ${faction.name} (Rank: ${rank}).`);
            target.outputChatBox(`${COLORS.INFO}Admin ${player.name} placed you into ${faction.name} (Rank: ${rank}).`);
        }
    } catch (err) {
        console.error("[Factions] DB Error in /setfaction:", err);
        player.outputChatBox(`${COLORS.ERROR}Database error occurred while setting faction.`);
    }
});

// --- VEHICLE MANAGEMENT ---

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
    
    if (player.vehicle) {
        const veh = player.vehicle;
        vehicleManager.despawnVehicle(veh); 
        player.outputChatBox(`${COLORS.SUCCESS}Vehicle deleted.`);
        return;
    }

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
        player.vehicle.repair();
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

    if (!target || !item) return player.outputChatBox("Usage: /giveitem [id/name] [itemId] [amount]");

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

    if (!target || isNaN(level)) return player.outputChatBox("Usage: /makeadmin [id/name] [level (0-4)]");

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
    if (player.data.adminLevel < 1) return;
    
    const broadZones = ZoneManager.getBroadPhaseZones(player);
    const preciseZones = broadZones.filter(id => ZoneManager.isPlayerInZone(player, id));
    
    player.outputChatBox(`${COLORS.INFO}Zones: ${preciseZones.join(', ') || 'None'}`);
});