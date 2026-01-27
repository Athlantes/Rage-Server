const fs = require('fs');

mp.events.add('drawZone.save', (player, rawData) => {
    try {
        // The data comes in double-stringified, so we parse it once to clean it up
        // If your client sends it differently, you might not need JSON.parse here.
        // But based on your code: JSON.stringify(JSON.stringify(poly))
        const cleanData = JSON.parse(rawData); 
        
        // create a readable timestamp
        const date = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
        
        // Format the line to save
        const fileEntry = `\n[${date}] Saved by ${player.name}:\n${cleanData}\n----------------------------------`;

        // Save to 'saved_zones.txt' in the main server folder
        fs.appendFile('saved_zones.txt', fileEntry, (err) => {
            if (err) {
                console.log(`[ZoneError] Could not write to file: ${err.message}`);
                player.outputChatBox("!{#ff0000}[Error] !{000}Could not save zone to file.");
            } else {
                console.log(`[Zone] New zone saved by ${player.name}`);
                player.outputChatBox("!{00ff00}[Success] !{000}Zone coordinates saved to 'saved_zones.txt'!");
            }
        });

    } catch (e) {
        console.log(`[ZoneError] Error parsing data: ${e.message}`);
    }
});