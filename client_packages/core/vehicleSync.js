// client_packages/core/vehicleSync.js

// 1. Stop native auto-starting when entering a car
mp.events.add('playerEnterVehicle', (vehicle, seat) => {
    if (seat === -1) {
        let isEngineOn = vehicle.getVariable('engine') === true;
        
        // Force the engine to match the server state immediately
        vehicle.setEngineOn(isEngineOn, true, true);
    }
});

// 2. Keep engine running when exiting (GTA natively turns it off)
mp.events.add('playerLeaveVehicle', (vehicle, seat) => {
    if (vehicle) {
        let isEngineOn = vehicle.getVariable('engine') === true;
        if (isEngineOn) {
            vehicle.setEngineOn(true, true, false);
        }
    }
});
// 3. Listen for changes from the server (e.g., when you press '2')
mp.events.add('entityDataChange', (entity, key, value) => {
    if (entity.type === 'vehicle') {
        if (key === 'engine') {
            // Apply the engine state smoothly
            entity.setEngineOn(value, true, true);
        }
        
        // Optional: Advanced Lock Sync
        if (key === 'locked') {
            // 2 is locked, 1 is unlocked in GTA natives
            mp.game.invoke('0xB664292EAECF7FA6', entity.handle, value ? 2 : 1); // SetVehicleDoorsLocked
        }
    }
});