require('./keys.js');
require('./overlay.js');
require('./disableDefaults.js');
require('./interaction.js');
require('./inventory_client.js');
require('./phone/index.js');
require('./zones/index.js');
require('./draw-zone');
require('./dumpster.js');
require('./returo.js');

// --- 1. ROBUST GPS ROUTE ---
mp.events.add('client:setRoute', (blipId, enable, color) => {
    let attempts = 0;
    const interval = setInterval(() => {
        let blip = mp.blips.atRemoteId(blipId);
        
        // Search manually if not found directly
        if (!blip) {
            mp.blips.forEach(_blip => {
                if (_blip.remoteId === blipId) blip = _blip;
            });
        }

        if (blip && mp.blips.exists(blip)) {
            blip.setRoute(enable);
            if (color !== undefined) blip.setRouteColour(color);
            clearInterval(interval);
        }
        
        attempts++;
        if (attempts > 50) clearInterval(interval); 
    }, 100);
});

// --- 2. ROBUST ATTACHMENT (FIXED SHAKING) ---
mp.events.add('client:attachProp', (remoteId, bone, x, y, z, rx, ry, rz) => {
    let attempts = 0;
    const interval = setInterval(() => {
        // Find object by Server ID
        const obj = mp.objects.atRemoteId(remoteId);
        
        if (obj && obj.handle !== 0) {
            // CRITICAL FIX: Disable collision so it doesn't shake the player
            obj.setCollision(false, true); 
            
            // Attach to player (Bone, Offsets, Rotations, ..., Collision=False, ...)
            obj.attachTo(mp.players.local.handle, bone, x, y, z, rx, ry, rz, false, false, false, false, 2, true);
            
            clearInterval(interval);
        }

        attempts++;
        if (attempts > 40) clearInterval(interval); // Stop after 2 seconds
    }, 50);
});

// --- 3. VEHICLE WARP ---
mp.events.add('client:warpIntoVehicle', (vehId, seat) => {
    const veh = mp.vehicles.atRemoteId(vehId);
    if (veh) {
        mp.players.local.setIntoVehicle(veh.handle, seat);
    } else {
        setTimeout(() => {
            const retryVeh = mp.vehicles.atRemoteId(vehId);
            if (retryVeh) mp.players.local.setIntoVehicle(retryVeh.handle, seat);
        }, 200);
    }
});

// --- 4. FREEZE PLAYER ---
mp.events.add("client:freezePlayer", (freeze) => {
    mp.players.local.freezePosition(freeze);
});