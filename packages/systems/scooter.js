// packages/systems/scooter.js
const PlayerManager = require('../core/playerManager');

const CONFIG = {
    model: 'serv_electricscooter',
    unlockCost: 5,
    costPerMin: 1,
    maxDistance: 100.0,
    autoEndTimeout: 60000
};

// --- SHARED HELPER: END RIDE ---
async function endRental(scooter, reason = "Ride ended") {
    if (!mp.vehicles.exists(scooter)) return;
    
    const player = scooter.data.renter;
    const startTime = scooter.data.rentStartTime || Date.now();
    const minutes = Math.ceil((Date.now() - startTime) / 60000);
    const cost = minutes * CONFIG.costPerMin;

    scooter.destroy();

    if (player && mp.players.exists(player)) {
        await PlayerManager.removeMoney(player, cost, "eScootr Ride");
        player.call('showNotification', ['eScootr', `${reason}. Charged: $${cost}`]);
        player.call('client:phone:appCallback', ['scooter', 'endRide']);
    }
}

mp.events.add('server:phone:scooterAction', async (player, dataJson) => {
    if (!player.logged) return;
    const data = JSON.parse(dataJson);

    if (data.type === 'scan') {
        if (player.dimension !== 0 || player.vehicle) {
            return player.call('client:phone:proxyResponse', ['scooterAction', { status: 'failed', msg: 'Invalid location' }]);
        }

        const searchDelay = Math.floor(Math.random() * (10000 - 5000 + 1) + 5000);

        setTimeout(() => {
            if (!mp.players.exists(player)) return;
            const batt = Math.floor(Math.random() * (100 - 40 + 1) + 40);
            const estDist = Math.floor(Math.random() * (30 - 10 + 1) + 10); 
            player.call('client:phone:proxyResponse', ['scooterAction', { status: 'found', battery: batt, dist: estDist }]);
        }, searchDelay);
    }
    
    else if (data.type === 'rent') {
        if (player.data.money < CONFIG.unlockCost) {
            return player.call('showNotification', ['eScootr', 'Insufficient funds.']);
        }

        const paid = await PlayerManager.removeMoney(player, CONFIG.unlockCost, "eScootr Unlock");
        if (!paid) return;

        // Spawn Logic
        const pos = player.position;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (25 - 10) + 10;
        const offsetX = Math.cos(angle) * dist;
        const offsetY = Math.sin(angle) * dist;
        
        const spawnPos = new mp.Vector3(pos.x + offsetX, pos.y + offsetY, pos.z); // Store this!

        const scooter = mp.vehicles.new(mp.joaat(CONFIG.model), spawnPos, {
            heading: (angle * 180 / Math.PI) + 90,
            dimension: player.dimension
        });

        const initialBatt = Math.floor(Math.random() * (100 - 60 + 1) + 60);
        scooter.setVariable('fuel', initialBatt);
        scooter.setVariable('owner_id', player.data.dbId); 
        scooter.data.renter = player;           
        scooter.data.rentStartTime = Date.now();
        scooter.data.lastActiveTime = Date.now();

        scooter.locked = true;
        setTimeout(() => {
            if (mp.vehicles.exists(scooter)) scooter.locked = false;
        }, 2000);

        // SEND COORDINATES BACK TO CLIENT
        player.call('client:phone:proxyResponse', ['scooterAction', { 
            status: 'started', 
            x: spawnPos.x, 
            y: spawnPos.y, 
            z: spawnPos.z 
        }]);
        
        player.call('showNotification', ['eScootr', `Unlocked! Follow the marker.`]);
        player.call('client:phone:appCallback', ['scooter', 'startRide']);
    }

    else if (data.type === 'end') {
        // ... [Keep the end logic exactly as it was] ...
        let targetScootr = null;
        const vehicles = mp.vehicles.toArray();
        if (player.vehicle && player.vehicle.getVariable('owner_id') === player.data.dbId) {
            targetScootr = player.vehicle;
        } else {
            targetScootr = vehicles.find(v => v.dist(player.position) < 10 && v.getVariable('owner_id') === player.data.dbId);
        }

        if (targetScootr) endRental(targetScootr, "Ride ended manually");
        else player.call('showNotification', ['eScootr', 'No active rental found nearby.']);
    }
});

mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
    if (vehicle.model === mp.joaat(CONFIG.model)) {
        const ownerId = vehicle.getVariable('owner_id');
        if (ownerId && ownerId !== player.data.dbId) {
            player.call('showNotification', ['eScootr', '~r~ANTI-THEFT: This vehicle is rented by another user.']);
            player.removeFromVehicle();
        }
    }
});

setInterval(() => {
    mp.vehicles.forEach((veh) => {
        if (veh.model === mp.joaat(CONFIG.model) && veh.getVariable('owner_id')) {
            const renter = veh.data.renter;
            if (!renter || !mp.players.exists(renter)) { endRental(veh, "Player disconnected"); return; }
            const driver = veh.getOccupant(0);
            if (driver === renter) { veh.data.lastActiveTime = Date.now(); } 
            else {
                if (veh.dist(renter.position) > CONFIG.maxDistance) { endRental(veh, "Scooter abandoned"); return; }
                if ((Date.now() - veh.data.lastActiveTime) > CONFIG.autoEndTimeout) { endRental(veh, "Ride auto-ended"); return; }
            }
        }
    });
}, 10000);