const vehicleManager = require('./vehicles/vehicleManager');
const playerManager = require('./playerManager');
const Inventory = require('../systems/inventory');
const ZoneManager = require('../zones/index.js');
const fs = require('fs');
const path = require('path');

// Helper for local messages (Roleplay)
function broadcastLocal(player, text, type = 'local') {
    mp.players.forEachInRange(player.position, 20.0, (target) => {
        target.call('chat:push', [null, text, type]);
    });
}

// --- Proximity Whisper ---
mp.events.addCommand('w', (player, fullText) => {
    const args = fullText.split(' ');
    const targetIdOrName = args[0];
    const msg = args.slice(1).join(' ');

    if (!targetIdOrName || !msg) return player.outputChatBox("Usage: /w [id/name] [message]");

    const target = mp.players.at(parseInt(targetIdOrName)) || mp.players.find(p => p.name === targetIdOrName);
    
    if (!target) return player.outputChatBox("!{FF0000}Player not found.");
    if (target === player) return player.outputChatBox("!{FF0000}You can't whisper to yourself.");

    // Distance Check
    if (player.dist(target.position) > WHISPER_RANGE) {
        return player.outputChatBox("!{FF0000}Player is too far away to whisper.");
    }

    // Send to both (Purple/Italic usually for whispers)
    target.call('chat:push', [`(Whisper) ${player.name}`, msg, 'whisper']);
    player.call('chat:push', [`(Whisper) to ${target.name}`, msg, 'whisper']);
});

// --- Clan / Faction Examples ---
// These add the Prefixes you wanted for the "All" tab.
mp.events.addCommand('c', (player, fullText) => {
    if (!player.data.clan) return player.outputChatBox("!{FF0000}You are not in a clan.");
    if (!fullText) return player.outputChatBox("Usage: /c [message]");

    // Logic: Find all clan members and send
    const clanMembers = mp.players.toArray().filter(p => p.data.clan === player.data.clan);
    clanMembers.forEach(p => {
        // Prefix added here:
        p.call('chat:push', [`[Clan] ${player.name}`, fullText, 'clan']);
    });
});

mp.events.addCommand('f', (player, fullText) => {
    if (!player.data.faction) return player.outputChatBox("!{FF0000}You are not in a faction.");
    if (!fullText) return player.outputChatBox("Usage: /f [message]");

    const factionMembers = mp.players.toArray().filter(p => p.data.faction === player.data.faction);
    factionMembers.forEach(p => {
        p.call('chat:push', [`[Faction] ${player.name}`, fullText, 'faction']);
    });
});

// ----------------------------------------------------------------------------
// GENERAL & ROLEPLAY COMMANDS
// ----------------------------------------------------------------------------

mp.events.addCommand('help', (player) => {
    player.outputChatBox("!{55AA55}Available Commands:");
    player.outputChatBox("!{FFFFFF}/me, /do, /stats, /buycar, /parkcar, /refuel, /lock, /engine");
});

mp.events.addCommand('stats', (player) => {
    if (!player.data) return;
    const money = player.data.money || 0;
    const bank = player.data.bank || 0;
    const level = player.data.level || 0;
    const job = player.activeJobId ? player.activeJobId.toUpperCase() : "None";
    
    player.outputChatBox(`!{00AA00}[Stats] !{FFFFFF}Money: $${money} | Bank: $${bank} | Level: ${level} | Job: ${job}`);
});

mp.events.addCommand('me', (player, fullText) => {
    if (!fullText) return player.outputChatBox("Usage: /me [action]");
    
    const msg = `* ${player.name} ${fullText}`;
    
    mp.players.forEachInRange(player.position, 20.0, (target) => {
        target.call('chat:push', [null, msg, 'me']);
    });
});

mp.events.addCommand('do', (player, fullText) => {
    if (!fullText) return player.outputChatBox("Usage: /do [description]");
    
    const msg = `* ${fullText} (( ${player.name} ))`;
    
    mp.players.forEachInRange(player.position, 20.0, (target) => {
        target.call('chat:push', [null, msg, 'do']);
    });
});
// ----------------------------------------------------------------------------
// VEHICLE COMMANDS
// ----------------------------------------------------------------------------

mp.events.addCommand('buycar', (player, model) => {
    if (!player.logged) return player.outputChatBox("Login first!");
    if (!model) return player.outputChatBox("Usage: /buycar [modelname]");
    
    // Uses vehicleManager to properly create and register the car in DB
    vehicleManager.create(player, model);
});

mp.events.addCommand('parkcar', (player) => {
    const veh = player.vehicle;
    if (!veh) return player.call('showNotification', ['Garage', 'You must be in a vehicle.']);
    
    if (veh.ownerId !== player.data.dbId) return player.call('showNotification', ['Garage', 'You do not own this vehicle.']);
    
    vehicleManager.savePosition(veh);

    player.call('client:leaveVehicle');
    player.call('showNotification', ['Garage', 'Parking location updated! Car remains here.']);
});

mp.events.addCommand('refuel', async (player) => {
    const veh = player.vehicle;
    if (!veh) return player.call('showNotification', ['Vehicle System', 'Must be in a vehicle.']);
    if (veh.engine) return player.call('showNotification', ['Vehicle System', 'Turn off engine first!']);
    
    player.call('showNotification', ['Vehicle System', 'Refueling...']);
    
    // Simulate time to refuel
    setTimeout(async () => {
        if (mp.vehicles.exists(veh)) {
            // Hardcoded 50$ for full tank in this basic command version
            const success = await playerManager.removeMoney(player, 50, "Gas Station");
            if (success) {
                veh.setVariable('fuel', 100.0);
                player.call('showNotification', ['Vehicle System', 'Tank Full ($50).']);
            } else {
                player.call('showNotification', ['Vehicle System', 'You cannot afford fuel ($50)!']);
            }
        }
    }, 3000);
});

mp.events.addCommand('lock', (player) => {
    // Calls the event defined in vehicleSystem.js
    mp.events.call('vehicle:toggleLock', player);
});

mp.events.addCommand('engine', (player) => {
    // Calls the event defined in vehicleSystem.js
    mp.events.call('vehicle:toggleEngine', player);
});

// ----------------------------------------------------------------------------
// ADMIN COMMANDS (Basic permissions check)
// ----------------------------------------------------------------------------

function isAdmin(player) {
    // Check if player has admin level (Adjust level requirement as needed)
    return (player.data.level >= 5);
}

// --- Admin Private Message (Global) ---
mp.events.addCommand('pm', (player, fullText) => {
    // Check Admin (Replace with your actual admin variable)
    if (!player.data.isAdmin && !player.adminLevel) {
        return player.outputChatBox("!{FF0000}You are not authorized to use this command.");
    }

    const args = fullText.split(' ');
    const targetIdOrName = args[0];
    const msg = args.slice(1).join(' ');

    if (!targetIdOrName || !msg) return player.outputChatBox("Usage: /pm [id/name] [message]");

    const target = mp.players.at(parseInt(targetIdOrName)) || mp.players.find(p => p.name === targetIdOrName);
    
    if (!target) return player.outputChatBox("!{FF0000}Player not found.");

    target.call('chat:push', [`[Admin PM] ${player.name}`, msg, 'admin']);
    player.call('chat:push', [`[PM to ${target.name}]`, msg, 'admin']);
});

mp.events.addCommand('veh', (player, model) => {
    if (!isAdmin(player)) return;
    if (!model) return player.outputChatBox("Usage: /veh [model]");

    const pos = player.position;
    const veh = mp.vehicles.new(mp.joaat(model), pos, {
        numberPlate: "ADMIN",
        dimension: player.dimension
    });
    
    player.putIntoVehicle(veh, -1);
    player.outputChatBox(`!{00FF00}[Admin] !{FFFFFF}Spawned ${model}.`);
});

mp.events.addCommand('fix', (player) => {
    if (!isAdmin(player)) return;
    if (player.vehicle) {
        player.vehicle.repair();
        player.outputChatBox("!{00FF00}[Admin] !{FFFFFF}Vehicle repaired.");
    }
});

mp.events.addCommand('hp', (player) => {
    if (!isAdmin(player)) return;
    player.health = 100;
    player.outputChatBox("!{00FF00}[Admin] !{FFFFFF}Health restored.");
});

mp.events.addCommand('tp', (player, targetName) => {
    if (!isAdmin(player)) return;
    if (!targetName) return player.outputChatBox("Usage: /tp [name/id]");
    
    const target = mp.players.toArray().find(p => p.name === targetName || p.id == targetName);
    if (target) {
        player.position = target.position;
        player.dimension = target.dimension;
        player.outputChatBox(`!{00FF00}[Admin] !{FFFFFF}Teleported to ${target.name}.`);
    } else {
        player.outputChatBox("!{FF0000}Player not found.");
    }
});

// ----------------------------------------------------------------------------
// DEBUG / SYSTEM COMMANDS
// ----------------------------------------------------------------------------

mp.events.addCommand('currentzone', (player) => {
    const broadZones = ZoneManager.getBroadPhaseZones(player);
    const preciseZones = broadZones.filter(id => ZoneManager.isPlayerInZone(player, id));

    player.outputChatBox(`!{55AA55}[Debug] !{FFFFFF}Broad Zones: ${broadZones.length > 0 ? broadZones.join(', ') : 'None'}`);
    
    if (preciseZones.length > 0) {
        player.outputChatBox(`!{00FF00}[Zone] !{FFFFFF}You are in: !{FFFF00}${preciseZones.join(', ')}`);
    } else {
        player.outputChatBox(`!{FF0000}[Zone] !{FFFFFF}Not currently inside any zone.`);
    }
});

mp.events.addCommand('savecoords', (player, fullText) => {
    const pos = player.vehicle ? player.vehicle.position : player.position;
    const heading = player.vehicle ? player.vehicle.heading : player.heading;
    const name = fullText || "Unnamed Location";
    
    const coordString = `
    // ${name}
    { x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}, h: ${heading.toFixed(2)} },
    `;

    // Saves to the root folder (or change path as preferred)
    const filePath = path.join(__dirname, `../../saved_coords_${player.name}.txt`);
    
    fs.appendFile(filePath, coordString, (err) => {
        if (err) return console.log(err);
        player.outputChatBox(`!{00FF00}Saved: !{FFFFFF}${name}`);
        player.outputChatBox(`!{AAAAAA}Check saved_coords_${player.name}.txt`);
    });
});

mp.events.addCommand('testinv', async (player) => {
    if (!isAdmin(player)) return;
    if (player.logged === false) return player.call('showNotification', ['Error', 'Login first!']);

    // Adds a basic kit for testing
    await Inventory.addItem(player, 'burger', 2);
    await Inventory.addItem(player, 'water', 5);
    await Inventory.addItem(player, 'pistol', 1); 
    await Inventory.addItem(player, 'pistol_ammo', 50);
    
    player.call('showNotification', ['Admin', 'Test items added.']);
});

mp.events.addCommand('testphonenotif', (player) => {
    if (!player.data || !player.data.dbId) return player.outputChatBox("Login required.");
    mp.events.call('server:phone:sendMail', player.data.dbId, 'System', 'Test', 'This is a test notification.');
});