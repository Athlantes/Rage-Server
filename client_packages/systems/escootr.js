// client_packages/escootr/index.js

// 1. Engine Lock Logic
mp.events.add('playerEnterVehicle', (vehicle, seat) => {
    if (vehicle.getVariable('isScooter')) {
        vehicle.setEngineOn(false, true, true); // Ensure engine is off initially
    }
});

// Prevent engine start if not rented
mp.keys.bind(0x59, true, function() { // Y key (or Engine Toggle key)
    const player = mp.players.local;
    const vehicle = player.vehicle;

    if (vehicle && vehicle.getVariable('isScooter') && player.seat === -1) {
        const renterId = vehicle.getVariable('rentedBy');
        // Assuming player.getVariable('dbId') is available locally or synced
        const myDbId = mp.players.local.getVariable('remoteId'); // Or however you sync DB ID

        // If not rented, or rented by someone else
        if (renterId === null || renterId === undefined) {
             mp.game.graphics.notify("~r~This scooter is locked. Rent it via the eScootr app.");
             vehicle.setEngineOn(false, true, true);
             return; // Block default engine toggle
        }
    }
});

// Enforce engine state based on variable change
mp.events.add('entityStreamIn', (entity) => {
    if (entity.type === 'vehicle' && entity.getVariable('isScooter')) {
        const renter = entity.getVariable('rentedBy');
        const engineState = (renter !== null);
        entity.setEngineOn(engineState, true, true);
    }
});

mp.events.addDataHandler("rentedBy", (entity, value) => {
    if (entity.type === 'vehicle' && entity.getVariable('isScooter')) {
        const engineState = (value !== null);
        entity.setEngineOn(engineState, true, true);
    }
});

// 2. Phone UI Events (Example Logic)
mp.events.add('client:phone:updateScootrApp', (viewType, data) => {
    // This assumes you have a browser instance for the phone
    // browser.execute(`escootrApp.updateView('${viewType}', ${JSON.stringify(data)})`);
    
    if (viewType === 'list') {
        mp.gui.chat.push(`[Phone] Found ${data.length} scooters nearby.`);
    } else {
        mp.gui.chat.push(`[Phone] Fuel: ${data.fuel}% | Status: ${data.canRent ? "Available" : "Active"}`);
    }
});