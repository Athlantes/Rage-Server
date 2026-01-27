require('./keys.js');
require('./overlay.js');
require('./disableDefaults.js');
require('./interaction.js');
require('./inventory_client.js');
require('./cayo.js');
require('./phone/index.js');
require('./zones/index.js');
require('./draw-zone');

mp.events.add('client:setRoute', (blipId, enable, color) => {
    let attempts = 0;
    const interval = setInterval(() => {
        // Try to find by Remote ID
        let blip = mp.blips.atRemoteId(blipId);
        
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

// Keep waypoint routes visible when player sets a map marker manually
let waypointRouteBlip = null;
function clearWaypointRoute() {
    if (waypointRouteBlip && mp.blips.exists(waypointRouteBlip)) {
        waypointRouteBlip.setRoute(false);
        waypointRouteBlip.destroy();
    }
    waypointRouteBlip = null;
}

mp.events.add('playerCreateWaypoint', () => {
    clearWaypointRoute();
    
    // 8 is the blip ID for the Waypoint/Destination marker
    const waypointBlip = mp.game.ui.getFirstBlipInfoId(8);

    if (waypointBlip !== 0) {
        const pos = mp.game.ui.getBlipInfoIdCoord(waypointBlip);
        
        waypointRouteBlip = mp.blips.new(8, new mp.Vector3(pos.x, pos.y, pos.z), {
            name: 'Waypoint',
            color: 27, // light purple
            shortRange: false
        });
        
        waypointRouteBlip.setRoute(true);
        waypointRouteBlip.setRouteColour(27);
    }
});

mp.events.add('playerRemoveWaypoint', clearWaypointRoute);

mp.events.add('client:attachProp', (remoteId, bone, x, y, z, rx, ry, rz) => {
    // 1. Find the object by its Server ID
    const obj = mp.objects.atRemoteId(remoteId);
    
    if (obj) {
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