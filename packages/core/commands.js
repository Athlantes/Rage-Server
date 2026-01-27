const vehicleManager = require('./vehicles/vehicleManager');
const fs = require('fs');
const path = require('path');

mp.events.addCommand('parkcar', (player) => {
    const veh = player.vehicle;
    if (!veh) return player.call('showNotification', ['Garage', 'You must be in a vehicle.']);
    
    if (veh.ownerId !== player.data.dbId) return player.call('showNotification', ['Garage', 'You do not own this vehicle.']);
    
    // 1. Save the Position
    vehicleManager.savePosition(veh);

    player.call('client:leaveVehicle');

    player.call('showNotification', ['Garage', 'Parking location updated! Car remains here.']);
});

mp.events.addCommand('testphonenotif', (player) => {
    if (!player.data || !player.data.dbId) return player.outputChatBox("You are not logged in.");

    mp.events.call(
        'server:phone:sendMail', 
        player.data.dbId,           // Target ID
        'System',                   // Sender
        'Test Notification',        // Title
        'This is a test to see if the toast works!' // Message
    );
});

mp.events.addCommand('savecoords', (player, fullText) => {
    // Get position and heading based on whether player is in a car or not
    const pos = player.vehicle ? player.vehicle.position : player.position;
    const heading = player.vehicle ? player.vehicle.heading : player.heading;
    
    const name = fullText || "Unnamed Location";
    
    // Format the string so it's ready for copy-pasting into your script
    const coordString = `
    // ${name}
    { x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}, h: ${heading.toFixed(2)} },
    `;

    // Save to a file named 'saved_coords.txt' in your main server folder
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