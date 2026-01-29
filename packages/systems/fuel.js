// packages/systems/fuel.js
const PlayerManager = require('../core/playerManager');
const FuelStations = require('../data/fuelLocations').FuelStations;

const CONFIG = {
    pricePerLiter: 2, 
    fuelTankCapacity: 100,
};

// 1. Initialize Pumps (Logic Only)
FuelStations.forEach((station) => {
    station.pumps.forEach((pump) => {
        // Interaction ColShape
        const shape = mp.colshapes.newSphere(pump.x, pump.y, pump.z, 2.0, 0); // Reduced radius to 2.0 to avoid overlap
        
        shape.setVariable('interaction', {
            title: station.name, // Use the specific station name
            text: 'Press E to Refuel',
            event: 'server:openFuelUI',
            requireVehicle: true, 
            requireDriver: true
        });
    });
});

// 2. Open UI Event
mp.events.add('server:openFuelUI', (player) => {
    const veh = player.vehicle;
    if (!veh) return;

    if (veh.engine) {
        veh.engine = false;
        veh.setVariable('engine', false);
        player.call('showNotification', ['Vehicle System', 'Engine turned off for refueling.']);
    }

    let currentFuel = veh.getVariable('fuel') || 0;
    if (currentFuel < 0) currentFuel = 0;
    
    const maxRefuelAmount = Math.floor(CONFIG.fuelTankCapacity - currentFuel);

    player.call('client:openFuelBrowser', [currentFuel, maxRefuelAmount, CONFIG.pricePerLiter]);
});

// 3. Process Transaction Event
mp.events.add('server:processRefuel', async (player, litersToFill) => {
    const veh = player.vehicle;
    if (!veh) return;

    litersToFill = parseInt(litersToFill);
    if (litersToFill <= 0) return;

    const cost = litersToFill * CONFIG.pricePerLiter;

    if (player.data.money < cost) {
        return player.call('showNotification', ['Gas Station', `You need $${cost} to fill ${litersToFill}L.`]);
    }

    let currentFuel = veh.getVariable('fuel') || 0;
    if ((currentFuel + litersToFill) > (CONFIG.fuelTankCapacity + 5)) { 
        return player.call('showNotification', ['Gas Station', 'Tank overflows!']);
    }

    const success = await PlayerManager.removeMoney(player, cost, "Fuel Station");
    
    if (success) {
        const newFuel = currentFuel + litersToFill;
        veh.setVariable('fuel', newFuel);
        player.call('showNotification', ['Gas Station', `Refueled ${litersToFill}L for $${cost}.`]);
        player.call('client:closeFuelBrowser'); 
    } else {
        player.call('showNotification', ['Gas Station', 'Transaction failed.']);
    }
});