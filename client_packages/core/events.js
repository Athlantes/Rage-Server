// client_packages/core/events.js

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
mp.events.add('client:attachProp', (objId, boneId, x, y, z, rx, ry, rz) => {
    const object = mp.objects.atRemoteId(objId);
    
    if (object && mp.objects.exists(object)) {
        const boneIndex = mp.players.local.getBoneIndex(boneId);
        object.attachTo(mp.players.local.handle, boneIndex, x, y, z, rx, ry, rz, false, false, false, false, 2, true);
    } else {
        setTimeout(() => {
            mp.events.call('client:attachProp', objId, boneId, x, y, z, rx, ry, rz);
        }, 50);
    }
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