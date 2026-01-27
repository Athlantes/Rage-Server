require('./keys.js');
require('./overlay.js');
require('./disableDefaults.js');
require('./interaction.js');
require('./inventory_client.js');
require('./cayo.js');
require('./polygons/index.js');
require('./zones/index.js');
require('./phone/index.js');

mp.events.add('client:setRoute', (blipId, enable, color) => {
    // We use a small timer to retry finding the blip, in case it hasn't streamed in yet
    let attempts = 0;
    const interval = setInterval(() => {
        // Find blip by its Server ID
        const blip = mp.blips.atRemoteId(blipId);
        
        if (blip) {
            blip.setRoute(enable); // Native GTA: SetBlipRoute
            if (color !== undefined) blip.setRouteColour(color);
            clearInterval(interval);
        }
        
        attempts++;
        if (attempts > 20) clearInterval(interval); // Stop trying after 2 seconds
    }, 100);
});

mp.events.add('client:attachProp', (remoteId, bone, x, y, z, rx, ry, rz) => {
    // 1. Find the object by its Server ID
    const obj = mp.objects.atRemoteId(remoteId);
    
    if (obj) {
        // 2. Attach it to the local player (Client-side attachment is smooth)
        // Note: We use mp.players.local.handle for the target
        obj.attachTo(mp.players.local.handle, bone, x, y, z, rx, ry, rz, false, false, false, false, 2, true);
    } else {
        // Fallback: Sometimes the object hasn't streamed in yet. Retry once.
        setTimeout(() => {
            const retryObj = mp.objects.atRemoteId(remoteId);
            if (retryObj) {
                retryObj.attachTo(mp.players.local.handle, bone, x, y, z, rx, ry, rz, false, false, false, false, 2, true);
            }
        }, 100);
    }
});

mp.events.add('client:warpIntoVehicle', (vehId, seat) => {
    // Attempt to find the vehicle by its Server ID
    const veh = mp.vehicles.atRemoteId(vehId);
    
    if (veh) {
        // Instant teleport into seat
        mp.players.local.setIntoVehicle(veh.handle, seat);
    } else {
        // Fallback: If vehicle hasn't streamed in yet, wait a tiny bit and try again
        setTimeout(() => {
            const retryVeh = mp.vehicles.atRemoteId(vehId);
            if (retryVeh) {
                mp.players.local.setIntoVehicle(retryVeh.handle, seat);
            }
        }, 200);
    }
});

mp.events.add("client:freezePlayer", (freeze) => {
    // Freeze/Unfreeze Controls
    mp.players.local.freezePosition(freeze);
    
    if (freeze) {
        // Enable Blur
        mp.game.graphics.transitionToBlurred(200);
        mp.gui.cursor.show(true, true);
    } else {
        // Disable Blur (The Fix)
        mp.game.graphics.transitionFromBlurred(200);
        mp.gui.cursor.show(false, false);
    }
});