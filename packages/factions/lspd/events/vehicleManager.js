// packages/factions/lspd/events/vehicleManager.js

module.exports = (faction) => {

    mp.events.add('faction:spawnLSPD', (player) => {
        if (player.factionId !== faction.id) {
            return player.outputChatBox('!{#ff4757}You are not an LSPD officer.');
        }
        if (!player.getVariable('factionDuty')) {
            return player.outputChatBox('!{#ff4757}You must go ON DUTY inside the HQ first.');
        }

        const dist = player.dist(faction.garage.menuPoint);
        if (dist > 3.0 || player.dimension !== 0) {
            return player.outputChatBox('!{#ff4757}You are not at the LSPD garage.');
        }

        // Filter catalog by player's rank
        const rank = player.factionRank || 0;
        const available = faction.vehicleCatalog.filter(v => rank >= v.minRank);

        if (available.length === 0) {
            return player.outputChatBox('!{#ff4757}No vehicles available for your rank.');
        }

        // Send available vehicle list to client for selection
        player.call('client:lspd:openGarageMenu', [JSON.stringify(available)]);
    });

    mp.events.add('server:lspd:spawnVehicle', (player, modelStr) => {
        if (player.factionId !== faction.id || !player.getVariable('factionDuty')) return;

        const rank = player.factionRank || 0;
        const entry = faction.vehicleCatalog.find(v => v.model === modelStr && rank >= v.minRank);
        if (!entry) {
            return player.outputChatBox('!{#ff4757}You are not authorized for that vehicle.');
        }

        // Destroy old faction vehicle
        if (player.factionVehicle && mp.vehicles.exists(player.factionVehicle)) {
            player.factionVehicle.destroy();
        }

        const spots = faction.garage.spawnPoints;
        const spot = spots[Math.floor(Math.random() * spots.length)];
        const spawnPos = new mp.Vector3(spot.x, spot.y, spot.z);

        const plateStr = player.data && player.data.onlineId
            ? `LSPD ${player.data.onlineId}`
            : `LSPD ${player.id}`;

        const veh = mp.vehicles.new(mp.joaat(modelStr), spawnPos, {
            heading: spot.h,
            numberPlate: plateStr,
            color: [0, 0],
        });

        veh.setColorRGB(0, 0, 0, 0, 0, 0); // Black
        veh.setVariable('fuel', 100.0);
        veh.setVariable('engine', true);
        veh.setVariable('factionId', faction.id);

        // Mount siren lights without forcing them on
        try { veh.setSirenActive(false); } catch (_) {}

        player.factionVehicle = veh;
        player.outputChatBox(`!{#00a8ff}${entry.label} spawned.`);

        setTimeout(() => {
            if (mp.players.exists(player) && mp.vehicles.exists(veh)) {
                player.call('client:warpIntoVehicle', [veh.id, -1]);
            }
        }, 250);
    });

    // Prevent non-officers from entering LSPD vehicles
    mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
        if (seat !== -1) return; // passenger seats are fine (detained suspects handled in arrestManager)
        if (vehicle.getVariable('factionId') !== faction.id) return;

        if (player.factionId !== faction.id || !player.getVariable('factionDuty')) {
            player.removeFromVehicle();
            player.outputChatBox('!{#ff4757}You do not have the keys to this police vehicle.');
        }
    });
};