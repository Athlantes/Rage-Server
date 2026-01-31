const vehicleManager = require('./vehicles/vehicleManager');
const ZoneManager = require('../zones/index.js'); // Import ZoneManager
const fs = require('fs');
const path = require('path');

// --- NEW COMMAND: CHECK ZONES ---
mp.events.addCommand('currentzone', (player) => {
    // 1. Check if the set exists and has items
    if (!player.activeZones || player.activeZones.size === 0) {
        return player.outputChatBox("!{FFFF00}[Zones] !{FFFFFF}You are not in any zone.");
    }

    // 2. Get Broad Phase (The ID list)
    const broadZones = Array.from(player.activeZones);
    
    // 3. Check Precise Phase (The Polygon math)
    const preciseZones = broadZones.filter(id => ZoneManager.isPlayerInZone(player, id));

    player.outputChatBox(`!{FFFF00}[Zones] !{FFFFFF}Broad Area: ${broadZones.join(', ')}`);
    
    if (preciseZones.length > 0) {
        player.outputChatBox(`!{00FF00}[Zones] !{FFFFFF}Precise Polygon: ${preciseZones.join(', ')}`);
    } else {
        player.outputChatBox(`!{FF0000}[Zones] !{FFFFFF}Precise Polygon: None (You are in the box, but outside the shape)`);
    }
});

mp.events.addCommand('parkcar', (player) => {
    const veh = player.vehicle;
    if (!veh) return player.call('showNotification', ['Garage', 'You must be in a vehicle.']);
    
    if (veh.ownerId !== player.data.dbId) return player.call('showNotification', ['Garage', 'You do not own this vehicle.']);
    
    vehicleManager.savePosition(veh);

    player.call('client:leaveVehicle');
    player.call('showNotification', ['Garage', 'Parking location updated! Car remains here.']);
});

mp.events.addCommand('testphonenotif', (player) => {
    if (!player.data || !player.data.dbId) return player.outputChatBox("You are not logged in.");

    mp.events.call(
        'server:phone:sendMail', 
        player.data.dbId,           
        'System',                   
        'Test Notification',        
        'This is a test to see if the toast works!' 
    );
});

mp.events.addCommand('savecoords', (player, fullText) => {
    const pos = player.vehicle ? player.vehicle.position : player.position;
    const heading = player.vehicle ? player.vehicle.heading : player.heading;
    const name = fullText || "Unnamed Location";
    
    const coordString = `
    // ${name}
    { x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}, h: ${heading.toFixed(2)} },
    `;

    const filePath = path.join(__dirname, '../saved_coords.txt');
    
    fs.appendFile(filePath, coordString, (err) => {
        if (err) {
            player.outputChatBox("!{FF0000}Error saving coordinates!");
            return console.log(err);
        }
        player.outputChatBox(`!{00FF00}Saved: !{FFFFFF}${name}`);
        player.outputChatBox(`!{AAAAAA}Check saved_coords.txt`);
    });
});