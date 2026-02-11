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
mp.events.add('client:attachProp', (objId, ownerId, boneId, x, y, z, rx, ry, rz) => {
    const object = mp.objects.atRemoteId(objId);
    const owner = mp.players.atRemoteId(ownerId); //

    if (object && mp.objects.exists(object) && owner && mp.players.exists(owner)) {
        const boneIndex = owner.getBoneIndex(boneId); // Get bone index of the target player
        object.attachTo(owner.handle, boneIndex, x, y, z, rx, ry, rz, false, false, false, false, 2, true);
    } else {
        // Retry if object or player not streamed in yet
        setTimeout(() => {
            mp.events.call('client:attachProp', objId, ownerId, boneId, x, y, z, rx, ry, rz);
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

// --- 5. PLAY ANIMATION ---
mp.events.add('client:playAnim', (dict, name, flag) => {
    // 1. Request the dictionary
    mp.game.streaming.requestAnimDict(dict);
    
    // 2. Wait for it to load
    let attempts = 0;
    const interval = setInterval(() => {
        if (mp.game.streaming.hasAnimDictLoaded(dict)) {
            mp.players.local.taskPlayAnim(dict, name, 8.0, 1.0, -1, flag, 1.0, false, false, false);
            clearInterval(interval);
        }
        attempts++;
        if (attempts > 50) clearInterval(interval);
    }, 50);
});

// --- 6. REPO JOB SYNC ---
mp.events.add('client:repo:sync', (json) => {
    // Store repo data locally for UI access
    try {
        global.repoJobs = JSON.parse(json);
    } catch(e) {
        global.repoJobs = [];
    }
});