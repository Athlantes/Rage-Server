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
        // Calls the wrapper in client index.js, which must now notify the Browser UI
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

        const searchDelay = Math.floor(Math.random() * (5000) + 5000); // 5-10s

        setTimeout(() => {
            if (!mp.players.exists(player)) return;
            const batt = Math.floor(Math.random() * (61) + 40); // 40-100
            const estDist = Math.floor(Math.random() * (21) + 10); // 10-30
            player.call('client:phone:proxyResponse', ['scooterAction', { status: 'found', battery: batt, dist: estDist }]);
        }, searchDelay);
    }
    
    else if (data.type === 'rent') {
        if (player.data.money < CONFIG.unlockCost) {
            return player.call('showNotification', ['eScootr', 'Insufficient funds.']);
        }

        // Instead of spawning here, ask Client to find a safe road/sidewalk behind them
        player.call('client:phone:findScooterSpawn');
    }

    else if (data.type === 'end') {
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

// --- NEW EVENT: Called by client after finding a valid road spot ---
mp.events.add('server:scooter:performRent', async (player, spawnPoint) => {
    if (!player || !mp.players.exists(player)) return;

    // Re-check funds just in case
    if (player.data.money < CONFIG.unlockCost) return;

    const paid = await PlayerManager.removeMoney(player, CONFIG.unlockCost, "eScootr Unlock");
    if (!paid) return;

    // Use found point or fallback to player pos if client failed
    const pos = spawnPoint || player.position;
    
    const scooter = mp.vehicles.new(mp.joaat(CONFIG.model), new mp.Vector3(pos.x, pos.y, pos.z), {
        heading: player.heading, // Match player heading
        dimension: player.dimension
    });

    const initialBatt = Math.floor(Math.random() * (41) + 60); // 60-100
    scooter.setVariable('fuel', initialBatt);
    scooter.setVariable('owner_id', player.data.dbId); 
    scooter.data.renter = player;           
    scooter.data.rentStartTime = Date.now();
    scooter.data.lastActiveTime = Date.now();

    // Lock initially for realism (unlocking sequence), but ensure it opens
    scooter.locked = true;
    setTimeout(() => {
        if (mp.vehicles.exists(scooter)) {
            scooter.locked = false;
        }
    }, 2000);

    // SEND COORDINATES BACK TO CLIENT
    player.call('client:phone:proxyResponse', ['scooterAction', { 
        status: 'started', 
        x: pos.x, 
        y: pos.y, 
        z: pos.z 
    }]);
    
    player.call('showNotification', ['eScootr', `Unlocked! It's behind you.`]);
    player.call('client:phone:appCallback', ['scooter', 'startRide']);
});

mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
    if (vehicle.model === mp.joaat(CONFIG.model)) {
        const ownerId = vehicle.getVariable('owner_id');
        
        // Anti-Theft Logic
        if (ownerId && ownerId !== player.data.dbId) {
            player.call('showNotification', ['eScootr', '~r~ANTI-THEFT: This vehicle is rented by another user.']);
            player.removeFromVehicle();
            
            // FIX: Ensure vehicle remains unlocked so the owner can still get in later
            vehicle.locked = false;
        }
        // Owner entering - double check it's unlocked
        else if (ownerId === player.data.dbId) {
            vehicle.locked = false;
        }
    }
});

setInterval(() => {
    mp.vehicles.forEach((veh) => {
        if (veh.model === mp.joaat(CONFIG.model) && veh.getVariable('owner_id')) {
            const renter = veh.data.renter;
            if (!renter || !mp.players.exists(renter)) { endRental(veh, "Player disconnected"); return; }
            
            // Ensure owner can always enter (fixes "locked" bug)
            if (veh.locked) veh.locked = false; 

            const driver = veh.getOccupant(0);
            if (driver === renter) { veh.data.lastActiveTime = Date.now(); } 
            else {
                if (veh.dist(renter.position) > CONFIG.maxDistance) { endRental(veh, "Scooter abandoned"); return; }
                if ((Date.now() - veh.data.lastActiveTime) > CONFIG.autoEndTimeout) { endRental(veh, "Ride auto-ended"); return; }
            }
        }
    });
}, 10000);