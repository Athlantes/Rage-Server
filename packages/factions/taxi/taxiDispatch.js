// packages/factions/taxi/taxiDispatch.js
const dispatchManager = require('../dispatch/dispatchManager');
const DISPATCH_CONFIGS = require('../dispatch/dispatchConfig');
const taxiCommand = require('./taxiCommand');

// Phase 2 – Driver arrived at pickup
mp.events.add('server:dispatch:driverArrived', (driver) => {
    const a = dispatchManager.getAssignment(driver.id);
    if (!a || a.factionId !== 1) return;

    a.phase = 2;
    // Update vehicle ID, but keep the previous stored ID if driver stepped out momentarily
    if (driver.vehicle) {
        a.driverVehicleId = driver.vehicle.id;
    } else if (!a.driverVehicleId && driver.factionVehicle && mp.vehicles.exists(driver.factionVehicle)) {
        a.driverVehicleId = driver.factionVehicle.id;
    }

    const config = DISPATCH_CONFIGS[1];
    if (a.callerServerId !== null) {
        const caller = mp.players.at(a.callerServerId);
        if (caller && mp.players.exists(caller)) {
            caller.outputChatBox(`!{${config.accentColor}}${config.chatTag} !{#ffffff}${config.messages.arrived}`);
        }
        // Notify phone app
        taxiCommand.onDriverArrived(a.callerServerId);
    }

    console.log('[Dispatch] Taxi driver ' + driver.name + ' arrived at pickup for call #' + a.callId);
});

// Phase 3 – Caller boarded (detected via playerEnterVehicle server event)
mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
    if (seat === -1 || !player.logged) return;

    const { assignment, driverId } = dispatchManager.getAssignmentByCaller(player.id);
    if (!assignment || assignment.factionId !== 1) return;

    if (assignment.phase === 2) {
        // Match by stored vehicle ID OR by checking the driver is currently in this vehicle
        const driver = mp.players.at(driverId);
        const vehicleMatch = assignment.driverVehicleId === vehicle.id ||
            (driver && mp.players.exists(driver) && driver.vehicle && driver.vehicle.id === vehicle.id);
        if (!vehicleMatch) return;

        assignment.phase = 3;

        // Notify phone app (handles fare deduction)
        taxiCommand.onCallerBoarded(player.id);

        // Phone-booked ride: destination is pre-set, send directly to driver
        if (assignment.destCoords) {
            // Skip waypoint prompt — send destination to driver immediately
            assignment.phase = 4;

            if (driver && mp.players.exists(driver)) {
                driver.call('client:taxi:setDestination', [JSON.stringify({
                    coords: assignment.destCoords,
                    location: assignment.destLocation || 'Destination',
                })]);
            }

            console.log('[Dispatch] Phone-booked ride: auto-routing driver to ' + (assignment.destLocation || 'destination'));
        } else {
            // Legacy support: prompt caller for waypoint
            if (driver && mp.players.exists(driver)) {
                driver.call('client:taxi:callerBoarded', []);
            }
            player.call('client:taxi:promptWaypoint', []);
            console.log('[Dispatch] Caller boarded, waiting for waypoint');
        }
    }
});

// Phase 4 – Caller set waypoint (legacy flow only, phone rides skip this)
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

    // Notify phone app (handles final fare + rating prompt)
    if (a.callerServerId !== null) {
        taxiCommand.onRideComplete(a.callerServerId);

        const config = DISPATCH_CONFIGS[1];
        const caller = mp.players.at(a.callerServerId);
        if (caller && mp.players.exists(caller)) {
            caller.outputChatBox(`!{${config.accentColor}}${config.chatTag} !{#ffffff}${config.messages.completed}`);
        }
    }

    dispatchManager.removeAssignment(driver.id);
    console.log('[Dispatch] Taxi ride #' + a.callId + ' completed by ' + driver.name);
});