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
    // We force the vehicle's engine state to whatever the server thinks it is.
    vehicle.engine = vehicle.engine; 
});

// --- NEW: KEEP ENGINE ON FIX ---
mp.events.add('playerExitVehicle', (player, vehicle) => {
    // If the engine is currently flagged as ON server-side, 
    // force it ON again to override GTA's auto-turn-off animation.
    if (vehicle && vehicle.engine) {
        vehicle.engine = true;
    }
});

mp.events.add('vehicle:toggleEngine', (player) => {
    const veh = player.vehicle;
    if (!veh) return;
    
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
        // Only consume if engine is actually on
        if (veh.engine) {
            let fuel = veh.getVariable('fuel') || 0;
            if (fuel > 0) {
                fuel -= FUEL_CONSUMPTION_RATE;
                if (fuel < 0) fuel = 0;
                veh.setVariable('fuel', fuel);
            } else {
                // Out of fuel -> kill engine
                veh.engine = false;
                veh.setVariable('engine', false); 
            }
        }
    });
}, FUEL_TICK_RATE);

// ---------------------------------------------------------
// 3. REFUEL COMMAND
// ---------------------------------------------------------
mp.events.addCommand('refuel', (player) => {
    const veh = player.vehicle;
    if (!veh) return player.call('showNotification', ['Vehicle System', 'Must be in a vehicle.']);
    
    if (veh.engine) return player.call('showNotification', ['Vehicle System', 'Turn off engine first!']);
    
    player.call('showNotification', ['Vehicle System', 'Refueling...']);
    
    setTimeout(() => {
        if(mp.vehicles.exists(veh)) {
            if (playerManager.removeMoney(player, 50, "Gas Station")) {
                veh.setVariable('fuel', 100.0);
                player.call('showNotification', ['Vehicle System', 'Tank Full ($50).']);
            } else {
                player.call('showNotification', ['Vehicle System', 'You cannot afford fuel ($50)!']);
            }
        }
    }, 3000);
});