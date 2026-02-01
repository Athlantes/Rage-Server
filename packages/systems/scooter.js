// packages/systems/scooter.js
const PlayerManager = require('../core/playerManager');
const db = require('../core/database');

const CONFIG = {
    model: 'serv_electricscooter', // Your custom model
    unlockCost: 5,
    costPerMin: 1,
    spawnDistance: 2.0 // Meters from player
};

// Handle Phone Events
mp.events.add('server:phone:scooterAction', async (player, dataJson) => {
    if (!player.logged) return;
    const data = JSON.parse(dataJson);

    if (data.type === 'scan') {
        // Simple logic: Check if player is outdoors (dimension 0) and not in a vehicle
        if (player.dimension !== 0 || player.vehicle) {
            return player.call('client:phone:proxyResponse', ['scooterAction', { status: 'failed', msg: 'Invalid location' }]);
        }

        // Simulate finding one with 40-100% battery
        const batt = Math.floor(Math.random() * (100 - 40 + 1) + 40);
        player.call('client:phone:proxyResponse', ['scooterAction', { status: 'found', battery: batt }]);
    }
    
    else if (data.type === 'rent') {
        if (player.data.money < CONFIG.unlockCost) {
            return player.call('showNotification', ['eScootr', 'Insufficient funds for unlock fee.']);
        }

        // Deduct Unlock Fee
        const paid = await PlayerManager.removeMoney(player, CONFIG.unlockCost, "eScootr Unlock");
        if (!paid) return;

        // Spawn Scooter
        const pos = player.position;
        // Small random offset so it doesn't spawn ON the player
        const offsetX = (Math.random() - 0.5) * 3;
        const offsetY = (Math.random() - 0.5) * 3;
        
        const scooter = mp.vehicles.new(mp.joaat(CONFIG.model), new mp.Vector3(pos.x + offsetX, pos.y + offsetY, pos.z), {
            heading: player.heading,
            dimension: player.dimension
        });

        // Setup Vehicle Variables
        const initialBatt = Math.floor(Math.random() * (100 - 60 + 1) + 60);
        scooter.setVariable('fuel', initialBatt); // Sync with your Fuel System
        scooter.setVariable('owner_id', player.data.dbId); // Mark as rented by this player
        scooter.data.renter = player;
        scooter.data.rentStartTime = Date.now();

        // Optional: Freeze for 2 seconds to simulate "Booting up"
        scooter.locked = true;
        setTimeout(() => {
            if (mp.vehicles.exists(scooter)) scooter.locked = false;
        }, 2000);

        player.call('client:phone:proxyResponse', ['scooterAction', { status: 'started' }]);
        player.call('showNotification', ['eScootr', 'Vehicle unlocked. Wear a helmet!']);
        
        // Tell client UI to start timer
        player.call('client:phone:appCallback', ['scooter', 'startRide']);
    }

    else if (data.type === 'end') {
        // Find the scooter rented by this player
        // We look for the closest scooter OR the one they are driving
        let targetScootr = player.vehicle;
        
        // If not on vehicle, find their rented one nearby
        if (!targetScootr || targetScootr.model !== mp.joaat(CONFIG.model)) {
            const vehicles = mp.vehicles.toArray();
            targetScootr = vehicles.find(v => v.dist(player.position) < 10 && v.getVariable('owner_id') === player.data.dbId);
        }

        if (targetScootr) {
            // Calculate Cost
            const startTime = targetScootr.data.rentStartTime || Date.now();
            const minutes = Math.ceil((Date.now() - startTime) / 60000);
            const cost = minutes * CONFIG.costPerMin;

            // Despawn
            targetScootr.destroy();

            // Charge Player
            await PlayerManager.removeMoney(player, cost, "eScootr Ride");
            player.call('showNotification', ['eScootr', `Ride ended. charged $${cost}`]);
        } else {
            player.call('showNotification', ['eScootr', 'No active rental found nearby.']);
        }
    }
});