const vehicleManager = require('./vehicleManager');
const playerManager = require('../playerManager');

// CONFIGURATION
const FUEL_CONSUMPTION_RATE = 0.05; 
const FUEL_TICK_RATE = 2000; 

// ---------------------------------------------------------
// 1. ENGINE & LOCK LOGIC
// ---------------------------------------------------------

mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
    // Only for driver
    if (seat !== -1) return;

    // --- SYNC FIX ---
    vehicle.engine = vehicle.engine; 
});

// --- KEEP ENGINE ON FIX ---
mp.events.add('playerExitVehicle', (player, vehicle) => {
    if (vehicle && vehicle.engine) {
        vehicle.engine = true;
    }
});

mp.events.add('vehicle:toggleEngine', (player) => {
    const veh = player.vehicle;
    if (!veh) return;

    if (player.vehicle && player.vehicle.getVariable('isScooter')) {
        return; 
    }
    
    // Check if driver
    if (player.seat !== -1 && player.seat !== 0) return;

    // PREVENT STARTING IF LOADING/FROZEN
    if (veh.frozen) {
        return player.call('showNotification', ['Vehicle System', 'Cannot start engine while loading!']);
    }

    // Check Fuel
    let currentFuel = veh.getVariable('fuel');
    if (currentFuel <= 0) {
        return player.call('showNotification', ['Vehicle System', 'Out of fuel!']);
    }

    // Toggle
    veh.engine = !veh.engine;
    player.call('showNotification', ['Vehicle System', veh.engine ? 'Engine Started.' : 'Engine Stopped.']);
});

mp.events.add('vehicle:toggleLock', (player) => {
    let veh = player.vehicle;
    
    if (!veh) {
        veh = mp.vehicles.getClosest(player.position);
        if (!veh || player.dist(veh.position) > 5) return;
    }

    if (!hasKeys(player, veh)) {
        player.call('showNotification', ['Vehicle System', 'You do not have the keys.']);
        return;
    }

    veh.locked = !veh.locked;
    veh.setVariable('locked', veh.locked);
    
    player.call('showNotification', ['Vehicle System', veh.locked ? 'Vehicle Locked.' : 'Vehicle Unlocked.']);
    
    if(veh.locked) player.call('client:playLockSound'); 
});

function hasKeys(player, veh) {
    if (veh.ownerId === player.data.dbId) return true;
    if (player.activeJob && player.jobVehicle === veh) return true;
    return false;
}

// ---------------------------------------------------------
// 2. FUEL SYSTEM LOOP
// ---------------------------------------------------------
setInterval(() => {
    mp.vehicles.forEach((veh) => {
        if (veh.engine) {
            if (veh.jobOwner) return; 

            let fuel = veh.getVariable('fuel') || 0;
            if (fuel > 0) {
                fuel -= FUEL_CONSUMPTION_RATE;
                if (fuel < 0) fuel = 0;
                veh.setVariable('fuel', fuel);
            } else {
                veh.engine = false;
                veh.setVariable('engine', false); 
            }
        }
    });
}, FUEL_TICK_RATE);