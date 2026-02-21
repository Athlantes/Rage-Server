// packages/factions/taxi/events/vehicleManager.js

module.exports = (faction) => {
    mp.events.add('faction:spawnTaxi', (player) => {
        if (player.factionId !== faction.id) return player.outputChatBox("!{#ff0000}You are not a taxi driver.");
        if (!player.getVariable('factionDuty')) return player.outputChatBox("!{#ff0000}You must go ON DUTY inside the HQ first.");
        
        const dist = player.dist(faction.garage.menuPoint);
        if (dist > 3.0 || player.dimension !== 0) {
            return player.outputChatBox("!{#ff0000}You are not at the faction garage.");
        }

        if (player.factionVehicle && mp.vehicles.exists(player.factionVehicle)) {
            player.factionVehicle.destroy();
        }

        // --- NEW: Pick a random spot from the array ---
        const spots = faction.garage.spawnPoints;
        const randomSpot = spots[Math.floor(Math.random() * spots.length)];
        const spawnPos = new mp.Vector3(randomSpot.x, randomSpot.y, randomSpot.z);

        // I noticed your existing code uses player.data.onlineId for identifiers, 
        // so I put that on the numberPlate for a nice modern RP touch!
        const plateStr = player.data && player.data.onlineId ? `CAB ${player.data.onlineId}` : `CAB ${player.id}`;

        let veh = mp.vehicles.new(mp.joaat('taxi'), spawnPos, {
            heading: randomSpot.h,
            numberPlate: plateStr,
            color: [88, 88]  // fallback while the RGB call lands
        });

        // Give them a full tank of gas automatically based on your server's fuel system
        veh.setColorRGB(255, 204, 0, 255, 204, 0);
        veh.setVariable('fuel', 100.0); 
        veh.setVariable('engine', true);
        veh.setVariable('factionId', faction.id); 
        
        player.factionVehicle = veh; 

        player.outputChatBox("!{#00ff00}Vehicle spawned in a parking spot nearby.");
        
        // Auto-place them in the driver seat
        setTimeout(() => {
            if (mp.players.exists(player) && mp.vehicles.exists(veh)) {
                player.call('client:warpIntoVehicle', [veh.id, -1]);
            }
        }, 250);
    });

    mp.events.add("playerEnterVehicle", (player, vehicle, seat) => {
        if (seat === -1 && vehicle.getVariable('factionId') === faction.id) {
            if (player.factionId !== faction.id || !player.getVariable('factionDuty')) {
                player.removeFromVehicle();
                player.outputChatBox("!{#ff0000}You do not have the keys for this faction vehicle.");
            }
        }
    });
};