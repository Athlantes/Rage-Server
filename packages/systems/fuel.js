// packages/systems/fuel.js
const PlayerManager = require('../core/playerManager');

const CONFIG = {
    pricePerLiter: 2, // $2 per liter
    fuelTankCapacity: 100, // Max liters
    pumps: [
        // La Puerta Gas Station
    { x: -328.34, y: -1470.82, z: 30.55},
    { x: -323.23, y: -1479.51, z: 30.55},
    { x: -326.03, y: -1481.22, z: 30.55},
    { x: -331.24, y: -1472.54, z: 30.55},
    { x: -323.91, y: -1468.21, z: 30.55},
    { x: -318.68, y: -1477.00, z: 30.55},
    { x: -315.88, y: -1475.24, z: 30.55},
    { x: -320.58, y: -1466.33, z: 30.55},
    { x: -316.35, y: -1463.69, z: 30.55},
    { x: -311.15, y: -1472.61, z: 30.55},
    { x: -308.36, y: -1470.98, z: 30.55},
    { x: -313.38, y: -1462.15, z: 30.55},
    ]
};

const GAS_STATIONS = [
    // Paste your "/save gas_station_central" coords here:
    { name: "Gas Station", x: -319.57, y: -1471.50, z: 30.55 }, // La Puerta
];

// Create the Blips
GAS_STATIONS.forEach((station) => {
    mp.blips.new(361, new mp.Vector3(station.x, station.y, station.z), {
        name: station.name,
        color: 1,           // 1 = Red, 4 = White, 2 = Green
        shortRange: true,   // true = disappear when far away on minimap (cleaner)
        scale: 0.8,         // Size of the icon
        dimension: 0
    });
});

// 1. Initialize Pumps
CONFIG.pumps.forEach((loc) => {
    // Visual Marker (Red Cylinder)
    mp.markers.new(1, new mp.Vector3(loc.x, loc.y, loc.z - 1.0), 1.0, {
        color: [255, 50, 50, 100],
        visible: true,
        dimension: 0
    });

    // Interaction ColShape
    const shape = mp.colshapes.newSphere(loc.x, loc.y, loc.z, 4.0, 0);
    
    shape.setVariable('interaction', {
        title: 'Gas Station',
        text: 'Press E to Refuel',
        event: 'server:openFuelUI',
        requireVehicle: true, // Uses the new check we added
        requireDriver: true   // Only driver can pay
    });
});

// 2. Open UI Event
mp.events.add('server:openFuelUI', (player) => {
    const veh = player.vehicle;
    if (!veh) return;

    // A. Auto Turn Off Engine
    if (veh.engine) {
        veh.engine = false;
        veh.setVariable('engine', false);
        player.call('showNotification', ['Vehicle System', 'Engine turned off for refueling.']);
    }

    // B. Calculate Fuel Data
    let currentFuel = veh.getVariable('fuel') || 0;
    if (currentFuel < 0) currentFuel = 0;
    
    // Calculate how much space is left in the tank
    const maxRefuelAmount = Math.floor(CONFIG.fuelTankCapacity - currentFuel);

    // C. Open Client UI
    // sending: [currentFuel, maxRefuelAmount, pricePerLiter]
    player.call('client:openFuelBrowser', [currentFuel, maxRefuelAmount, CONFIG.pricePerLiter]);
});

// 3. Process Transaction Event
mp.events.add('server:processRefuel', async (player, litersToFill) => {
    const veh = player.vehicle;
    if (!veh) return;

    litersToFill = parseInt(litersToFill);
    if (litersToFill <= 0) return;

    const cost = litersToFill * CONFIG.pricePerLiter;

    // Verify Money
    if (player.data.money < cost) {
        return player.call('showNotification', ['Gas Station', `You need $${cost} to fill ${litersToFill}L.`]);
    }

    // Verify Tank Capacity (Anti-cheat/Bug prevention)
    let currentFuel = veh.getVariable('fuel') || 0;
    if ((currentFuel + litersToFill) > (CONFIG.fuelTankCapacity + 5)) { // +5 buffer
        return player.call('showNotification', ['Gas Station', 'Tank overflows!']);
    }

    // Transaction
    const success = await PlayerManager.removeMoney(player, cost, "Fuel Station");
    
    if (success) {
        const newFuel = currentFuel + litersToFill;
        veh.setVariable('fuel', newFuel);
        
        player.call('showNotification', ['Gas Station', `Refueled ${litersToFill}L for $${cost}.`]);
        player.call('client:closeFuelBrowser'); // Close UI
    } else {
        player.call('showNotification', ['Gas Station', 'Transaction failed.']);
    }
});