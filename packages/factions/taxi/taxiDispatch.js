// packages/factions/taxi/taxiDispatch.js
const dispatchManager = require('../dispatch/dispatchManager');
const DISPATCH_CONFIGS = require('../dispatch/dispatchConfig');

// Phase 2 – Driver arrived at pickup
mp.events.add('server:dispatch:driverArrived', (driver) => {
    const a = dispatchManager.getAssignment(driver.id);
    if (!a || a.factionId !== 1) return; // Ignore if not a taxi assignment (Faction 1)

    a.phase = 2;
    // Refresh vehicle ID in case driver spawned a new cab after accepting
    a.driverVehicleId = driver.vehicle ? driver.vehicle.id : null;

    const config = DISPATCH_CONFIGS[1];
    if (a.callerServerId !== null) {
        const caller = mp.players.at(a.callerServerId);
        if (caller && mp.players.exists(caller)) {
            caller.outputChatBox(`!{${config.accentColor}}${config.chatTag} !{#ffffff}${config.messages.arrived}`);
        }
    }

    console.log('[Dispatch] Taxi driver ' + driver.name + ' arrived at pickup for call #' + a.callId);
});

// Phase 3 – Caller boarded (detected via playerEnterVehicle server event)
mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
    // Only care about passenger seats (seat -1 = driver)
    if (seat === -1 || !player.logged) return;

    // Check if this player is a caller waiting for a taxi
    const { assignment, driverId } = dispatchManager.getAssignmentByCaller(player.id);
    if (!assignment || assignment.factionId !== 1) return;

    // Only proceed if the driver has already arrived (phase 2) and they enter the correct vehicle
    if (assignment.phase === 2 && assignment.driverVehicleId === vehicle.id) {
        assignment.phase = 3;

        // Tell the driver their HUD should advance to phase 3
        const driver = mp.players.at(driverId);
        if (driver && mp.players.exists(driver)) {
            driver.call('client:taxi:callerBoarded', []);
        }

        // Prompt the caller to set a waypoint
        player.call('client:taxi:promptWaypoint', []);

        console.log('[Dispatch] Caller boarded for taxi call #' + assignment.callId + ', waiting for waypoint');
    }
});

// Phase 4 – Caller set waypoint, send destination to driver
mp.events.add('server:dispatch:waypointSet', (caller, x, y, z, location) => {
    const { assignment, driverId } = dispatchManager.getAssignmentByCaller(caller.id);
    if (!assignment || assignment.factionId !== 1) return;

    assignment.phase = 4;
    assignment.destCoords = { x: parseFloat(x), y: parseFloat(y), z: parseFloat(z) };
    assignment.destLocation = location;

    const driver = mp.players.at(driverId);
    if (driver && mp.players.exists(driver)) {
        driver.call('client:taxi:setDestination', [JSON.stringify({
            coords: { x: assignment.destCoords.x, y: assignment.destCoords.y, z: assignment.destCoords.z },
            location: location || 'Unknown Area',
        })]);
    }

    console.log('[Dispatch] Destination set for taxi call #' + assignment.callId + ': ' + location);
});

// Phase 5 – Driver reached destination
mp.events.add('server:dispatch:rideComplete', (driver) => {
    const a = dispatchManager.getAssignment(driver.id);
    if (!a || a.factionId !== 1) return;

    dispatchManager.removeAssignment(driver.id); // Clear them from the active list

    const config = DISPATCH_CONFIGS[1];
    if (a.callerServerId !== null) {
        const caller = mp.players.at(a.callerServerId);
        if (caller && mp.players.exists(caller)) {
            caller.outputChatBox(`!{${config.accentColor}}${config.chatTag} !{#ffffff}${config.messages.completed}`);
        }
    }

    console.log('[Dispatch] Taxi ride #' + a.callId + ' completed by ' + driver.name);
});