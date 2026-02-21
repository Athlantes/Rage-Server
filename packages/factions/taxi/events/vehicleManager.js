// packages/factions/taxi/events/vehicleManager.js

module.exports = (faction) => {
    
    // You can trigger this event from your Radial Menu or a simple /spawntaxi command for now
    mp.events.add('faction:spawnTaxi', (player) => {
        if (player.factionId !== faction.id) return player.outputChatBox("!{#ff0000}You are not a taxi driver.");
        if (!player.getVariable('factionDuty')) return player.outputChatBox("!{#ff0000}You must go ON DUTY inside the HQ first.");
        
        // Ensure they are standing at the garage marker outside
        const dist = player.dist(faction.garage.menuPoint);
        if (dist > 3.0 || player.dimension !== 0) {
            return player.outputChatBox("!{#ff0000}You are not at the faction garage.");
        }

        // Clean up their previous taxi if they already spawned one
        if (player.factionVehicle && mp.vehicles.exists(player.factionVehicle)) {
            player.factionVehicle.destroy();
        }

        // Spawn the vehicle
        let veh = mp.vehicles.new(mp.joaat('taxi'), faction.garage.spawnPoint, {
            heading: faction.garage.spawnHeading,
            numberPlate: "CAB " + player.sqlId, // Gives them a custom plate
            color: [[255, 204, 0], [255, 204, 0]] // Taxi Yellow
        });

        // Tag the vehicle so the server knows it belongs to the Taxi faction
        veh.setVariable('factionId', faction.id); 
        player.factionVehicle = veh; 

        player.outputChatBox("!{#00ff00}Vehicle spawned successfully.");
        player.putIntoVehicle(veh, -1); // Auto-place them in the driver seat
    });

    // --- Temporary command to test it ---
    mp.events.addCommand('spawntaxi', (player) => {
        mp.events.call('faction:spawnTaxi', player);
    });

    // --- Prevent Theft ---
    mp.events.add("playerEnterVehicle", (player, vehicle, seat) => {
        // If someone tries to enter the Driver Seat (-1) of a Taxi Faction vehicle
        if (seat === -1 && vehicle.getVariable('factionId') === faction.id) {
            
            // Kick them out if they aren't in the faction OR aren't on duty
            if (player.factionId !== faction.id || !player.getVariable('factionDuty')) {
                player.removeFromVehicle();
                player.outputChatBox("!{#ff0000}You do not have the keys for this faction vehicle.");
            }
        }
    });
};