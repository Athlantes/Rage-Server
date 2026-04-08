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

// Backward-compatible waypoint setter used by server modules.
mp.events.add('client:setWaypoint', (x, y) => {
    const px = parseFloat(x);
    const py = parseFloat(y);
    if (isNaN(px) || isNaN(py)) return;
    mp.game.ui.setNewWaypoint(px, py);
});

// --- LIVE VEHICLE LOCATOR (BLIP + ROUTE + MARKER) ---
let trackedVehicleBlip = null;
let trackedVehicleMarker = null;
let trackedVehicleDbId = null;
let trackedVehicleLabel = 'Tracked Vehicle';

function destroyTrackedVehicleVisuals() {
    if (trackedVehicleBlip && mp.blips.exists(trackedVehicleBlip)) {
        try { trackedVehicleBlip.setRoute(false); } catch (_) {}
        trackedVehicleBlip.destroy();
    }
    trackedVehicleBlip = null;

    if (trackedVehicleMarker && mp.markers.exists(trackedVehicleMarker)) {
        trackedVehicleMarker.destroy();
    }
    trackedVehicleMarker = null;
}

function stopVehicleLocator(showReason, reason) {
    destroyTrackedVehicleVisuals();
    trackedVehicleDbId = null;
    trackedVehicleLabel = 'Tracked Vehicle';

    if (showReason && reason) {
        mp.events.call('showNotification', 'GPS', reason);
    }
}

function updateVehicleLocatorVisuals(vehicleDbId, x, y, z, label) {
    const px = parseFloat(x);
    const py = parseFloat(y);
    const pz = parseFloat(z) || 0;
    const parsedDbId = parseInt(vehicleDbId);

    if (isNaN(px) || isNaN(py) || isNaN(parsedDbId)) return;

    if (trackedVehicleDbId !== null && trackedVehicleDbId !== parsedDbId) {
        destroyTrackedVehicleVisuals();
    }

    trackedVehicleDbId = parsedDbId;
    trackedVehicleLabel = String(label || 'Tracked Vehicle');
    const pos = new mp.Vector3(px, py, pz);

    if (!trackedVehicleBlip || !mp.blips.exists(trackedVehicleBlip)) {
        trackedVehicleBlip = mp.blips.new(225, pos, {
            name: trackedVehicleLabel,
            color: 5,
            scale: 0.9,
            shortRange: false
        });
        trackedVehicleBlip.setRoute(true);
        trackedVehicleBlip.setRouteColour(5);
    } else {
        trackedVehicleBlip.setCoords(pos);
    }

    if (trackedVehicleMarker && mp.markers.exists(trackedVehicleMarker)) {
        trackedVehicleMarker.destroy();
    }

    trackedVehicleMarker = mp.markers.new(36, pos, 1.0, {
        color: [0, 174, 255, 180],
        visible: true,
        dimension: mp.players.local.dimension
    });
}

mp.events.add('client:vehicleLocator:start', (vehicleDbId, x, y, z, label) => {
    updateVehicleLocatorVisuals(vehicleDbId, x, y, z, label);
    mp.events.call('showNotification', 'GPS', `${trackedVehicleLabel} tracker enabled.`);
});

mp.events.add('client:vehicleLocator:update', (vehicleDbId, x, y, z, label) => {
    updateVehicleLocatorVisuals(vehicleDbId, x, y, z, label);
});

mp.events.add('client:vehicleLocator:stop', (reason) => {
    stopVehicleLocator(true, reason);
});

// --- WAYPOINT TELEPORTATION ---
mp.events.add('client:teleportToWaypoint', () => {
    // 8 is the native GTA V blip ID for the purple custom waypoint
    const waypointBlip = mp.game.ui.getFirstBlipInfoId(8); 

    // Make sure the blip actually exists on the map
    if (mp.game.ui.doesBlipExist(waypointBlip)) {
        const coords = mp.game.ui.getBlipInfoIdCoord(waypointBlip);
        
        // Start by throwing them high in the sky in case the map isn't loaded
        let z = 200.0; 
        
        // Try to find the actual ground height at those coordinates
        const groundZ = mp.game.gameplay.getGroundZFor3dCoord(coords.x, coords.y, 1000.0, 0, false);
        if (groundZ) {
            z = groundZ + 1.0; // Add 1 to avoid clipping into the asphalt
        }

        // Send the found coordinates back to the server
        mp.events.callRemote('server:tpCoordsWaypoint', coords.x, coords.y, z);
    } else {
        mp.gui.chat.push("!{FF0000}[Admin] You don't have a waypoint set on the map!");
    }
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
let repoDeliveryMarker = null;
let repoDeliveryColshape = null;
const REPO_DELIVER_POS = { x: -176.85, y: -1180.85, z: 23.15 };

mp.events.add('client:repo:sync', (json) => {
    try {
        global.repoJobs = JSON.parse(json);
    } catch(e) {
        global.repoJobs = [];
    }

    // Show delivery marker + colshape only when a job is pending (accepted)
    const hasPending = global.repoJobs.some(j => j.status === 'pending');

    if (hasPending && !repoDeliveryMarker) {
        repoDeliveryMarker = mp.markers.new(25,
            new mp.Vector3(REPO_DELIVER_POS.x, REPO_DELIVER_POS.y, REPO_DELIVER_POS.z - 0.8),
            3.0, { color: [255, 50, 50, 180], visible: true, dimension: 0 }
        );
        repoDeliveryColshape = mp.colshapes.newSphere(
            REPO_DELIVER_POS.x, REPO_DELIVER_POS.y, REPO_DELIVER_POS.z, 8.0, 0
        );
        repoDeliveryColshape.interaction = {
            title: 'Repo Delivery',
            text: 'Press ~r~E~w~ to deliver the vehicle',
            event: 'server:repo:deliver',
            requireVehicle: true,
            requireDriver: true
        };
    } else if (!hasPending && repoDeliveryMarker) {
        repoDeliveryMarker.destroy(); repoDeliveryMarker = null;
        repoDeliveryColshape.destroy(); repoDeliveryColshape = null;
    }
});

// --- 7. EMPTY VEHICLE BLIPS ---
const emptyVehicleBlips = new Map();

setInterval(() => {
    // Iterate through all vehicles currently streamed in for the client
    mp.vehicles.forEachInStreamRange(veh => {
        if (veh && mp.vehicles.exists(veh) && veh.handle !== 0) {
            // Check if the driver seat (-1) is free
            const isDriverSeatEmpty = mp.game.vehicle.isSeatFree(veh.handle, -1);

            if (isDriverSeatEmpty) {
                // If the blip doesn't exist yet, create it
                if (!emptyVehicleBlips.has(veh.id)) {
                    let blip = mp.blips.new(1, veh.position, { // Sprite 1 is a small dot
                        name: "Empty Vehicle",
                        color: 22, // Color 5 is gray
                        alpha: 150, // Semi-transparent
                        scale: 0.7, // Make it small so it's not distracting
                        shortRange: true, // Only show on the minimap when close
                        dimension: mp.players.local.dimension
                    });
                    blip.setDisplay(8); // 8 = Shows on map & minimap but NOT selectable
                    mp.game.ui.setBlipHiddenOnLegend(blip.handle, true);

                    emptyVehicleBlips.set(veh.id, blip);
                } else {
                    // Update position if the empty vehicle moved (e.g. rolled down a hill)
                    let blip = emptyVehicleBlips.get(veh.id);
                    if (blip && mp.blips.exists(blip)) {
                        blip.setCoords(veh.position);
                    }
                }
            } else {
                // If someone gets into the vehicle, destroy the blip
                if (emptyVehicleBlips.has(veh.id)) {
                    let blip = emptyVehicleBlips.get(veh.id);
                    if (blip && mp.blips.exists(blip)) blip.destroy();
                    emptyVehicleBlips.delete(veh.id);
                }
            }
        }
    });

    // Clean up blips for vehicles that are no longer streamed in (player drove away)
    emptyVehicleBlips.forEach((blip, vehId) => {
        let veh = mp.vehicles.at(vehId);
        // If vehicle doesn't exist or is no longer streamed in
        if (!veh || veh.handle === 0) {
            if (blip && mp.blips.exists(blip)) {
                blip.destroy();
            }
            emptyVehicleBlips.delete(vehId);
        }
    });
}, 1000); // Checks every 1 second (1000ms) to maintain performance