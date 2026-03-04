// client_packages/factions/dispatch/index.js
// ─────────────────────────────────────────────────────────────────────────────
// KEY ARCHITECTURE NOTE:
//   Every player runs this same script. Two separate state objects exist so
//   the driver's ride state and the caller's waypoint poll can NEVER clobber
//   each other:
//
//     `ride`   – only written by the DRIVER's events
//     `caller` – only written by the CALLER's events
//
//   Board detection (phase 2→3) is done SERVER-SIDE via playerEnterVehicle,
//   not client-side via getPedInSeat, avoiding NPC false-positives entirely.
//
// Ride phases (driver):
//   1  En-route to caller        blip + marker, proximity tick
//   2  Waiting for caller        server fires when caller boards
//   3  Caller boarded            server auto-routes to destination (phone rides)
//   4  En-route to destination   red blip + marker, proximity tick
// ─────────────────────────────────────────────────────────────────────────────

let dispatchBrowser = null;
let isDispatchOpen  = false;

// ── Driver state (written only by driver-targeted events) ─────────────────────
const ride = {
    phase:      0,
    callerName: null,
    blip:       null,
    marker:     null,
    destBlip:   null,
    destMarker: null,
    tick:       null,
};

// ── Caller state (written only by caller-targeted events) ─────────────────────
let callerWaypointTick = null;

// ── Shared helpers ────────────────────────────────────────────────────────────

function destroyBlip(b)   { if (!b) return; try { b.setRoute(false); } catch(_){} try { b.destroy(); } catch(_){} }
function destroyMarker(m) { if (!m) return; try { m.destroy(); } catch(_){} }

function notify(title, msg) { mp.events.call('showNotification', title, msg); }

function dist3(a, b) {
    const dx = a.x-b.x, dy = a.y-b.y, dz = a.z-b.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

function dist2(a, b) {
    const dx = a.x-b.x, dy = a.y-b.y;
    return Math.sqrt(dx*dx + dy*dy);
}

// ── Driver helpers ────────────────────────────────────────────────────────────

function clearRideTick() {
    if (ride.tick !== null) { clearInterval(ride.tick); ride.tick = null; }
}

function cleanupRide() {
    clearRideTick();
    destroyBlip(ride.blip);         ride.blip       = null;
    destroyMarker(ride.marker);     ride.marker     = null;
    destroyBlip(ride.destBlip);     ride.destBlip   = null;
    destroyMarker(ride.destMarker); ride.destMarker = null;
    ride.phase      = 0;
    ride.callerName = null;
}

// ── Dispatch menu ─────────────────────────────────────────────────────────────

function openDispatchBrowser() {
    if (dispatchBrowser) return;
    dispatchBrowser = mp.browsers.new('package://ui/dispatch/index.html');
    mp.gui.cursor.visible = true;
}

function closeDispatchBrowser() {
    if (dispatchBrowser) { dispatchBrowser.destroy(); dispatchBrowser = null; }
    mp.gui.cursor.visible = false;
    isDispatchOpen = false;
}

// ── P Key ─────────────────────────────────────────────────────────────────────
mp.keys.bind(0x50, true, () => {
    if (mp.gui.cursor.visible && !isDispatchOpen) return;
    const player = mp.players.local;
    if (!player.vehicle) return;
    if (player.vehicle.getPedInSeat(-1) !== player.handle) return;

    if (isDispatchOpen) {
        isDispatchOpen = false;
        closeDispatchBrowser();
        mp.events.callRemote('server:dispatch:close');
        mp.events.call('interaction:restore');
    } else {
        mp.events.callRemote('server:dispatch:open');
    }
});

// ── Dispatch menu events ──────────────────────────────────────────────────────

mp.events.add('client:dispatch:open', (payloadJson) => {
    isDispatchOpen = true;
    if (!dispatchBrowser) {
        openDispatchBrowser();
        setTimeout(() => {
            if (dispatchBrowser)
                dispatchBrowser.execute(`receiveDispatchData(${JSON.stringify(payloadJson)})`);
        }, 150);
    } else {
        dispatchBrowser.execute(`receiveDispatchData(${JSON.stringify(payloadJson)})`);
    }
});

mp.events.add('client:dispatch:close', () => {
    if (isDispatchOpen) { closeDispatchBrowser(); mp.events.call('interaction:restore'); }
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — PHASE 1: accepted call, head to caller
// ─────────────────────────────────────────────────────────────────────────────
mp.events.add('client:dispatch:accepted', (dataJson) => {
    isDispatchOpen = false;
    closeDispatchBrowser();
    mp.events.call('interaction:restore');

    let data;
    try { data = JSON.parse(dataJson); }
    catch (e) { console.error('[Taxi] Bad JSON in accepted:', e); return; }
    if (!data || !data.coords) return;

    cleanupRide();

    ride.phase      = 1;
    ride.callerName = data.callerName || 'Passenger';

    const pos = new mp.Vector3(data.coords.x, data.coords.y, data.coords.z);
    const dim = mp.players.local.dimension;

    ride.blip = mp.blips.new(280, pos, {
        name: `Taxi: ${ride.callerName}`, color: 66, scale: 1.0, shortRange: false,
    });
    ride.blip.setRoute(true);

    ride.marker = mp.markers.new(1,
        new mp.Vector3(pos.x, pos.y, pos.z - 1.0), 1.5,
        { color: [255, 204, 0, 200], visible: true, dimension: dim }
    );

    notify('Taxi Dispatch', `Picking up ${ride.callerName}`);

    ride.tick = setInterval(() => {
        if (ride.phase !== 1) { clearRideTick(); return; }
        if (dist3(mp.players.local.position, pos) <= 10.0) {
            clearRideTick();
            notify('Taxi', `You have arrived at ${ride.callerName}'s location.`);
            mp.events.callRemote('server:dispatch:driverArrived');

            destroyBlip(ride.blip);     ride.blip   = null;
            destroyMarker(ride.marker); ride.marker = null;

            ride.phase = 2;
            notify('Taxi', `Wait for ${ride.callerName} to get in`);
        }
    }, 500);
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — AUTO-ASSIGN: passenger already in taxi, skip pickup phases
// ─────────────────────────────────────────────────────────────────────────────
mp.events.add('client:taxi:autoAssignRide', (dataJson) => {
    let data;
    try { data = JSON.parse(dataJson); }
    catch (e) { console.error('[Taxi] Bad JSON in autoAssignRide:', e); return; }
    if (!data || !data.coords) return;

    cleanupRide();

    ride.callerName = data.callerName || 'Passenger';
    ride.phase = 4;

    const pos = new mp.Vector3(data.coords.x, data.coords.y, data.coords.z);
    const dim = mp.players.local.dimension;

    ride.destBlip = mp.blips.new(38, pos, {
        name: `Drop off: ${ride.callerName}`, color: 1, scale: 1.0, shortRange: false,
    });
    ride.destBlip.setRoute(true);

    ride.destMarker = mp.markers.new(1,
        new mp.Vector3(pos.x, pos.y, mp.players.local.position.z - 1.0), 3.0,
        { color: [255, 50, 50, 200], visible: true, dimension: dim }
    );

    notify('Taxi', `${ride.callerName} set a destination: ${data.location || 'Unknown'}. Head there now!`);

    ride.tick = setInterval(() => {
        if (ride.phase !== 4) { clearRideTick(); return; }

        const pPos = mp.players.local.position;

        if (ride.destMarker) {
            try {
                ride.destMarker.position = new mp.Vector3(pos.x, pos.y, pPos.z - 1.0);
            } catch (_) {}
        }

        if (dist3(pPos, pos) <= 50.0) { // Fix 5: 3D distance check
            clearRideTick();
            mp.events.callRemote('server:dispatch:rideComplete');
            notify('Taxi', 'You have arrived at the destination. Ride complete!');
            cleanupRide();
        }
    }, 500);
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — PHASE 2→3: server confirmed caller boarded (legacy flow only)
// ─────────────────────────────────────────────────────────────────────────────
mp.events.add('client:taxi:callerBoarded', () => {
    if (ride.phase !== 2) return;
    ride.phase = 3;
    notify('Taxi', `Wait for ${ride.callerName} to set a waypoint`);
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — PHASE 3→4: destination set (phone auto-route or legacy waypoint)
// ─────────────────────────────────────────────────────────────────────────────
mp.events.add('client:taxi:setDestination', (dataJson) => {
    let data;
    try { data = JSON.parse(dataJson); }
    catch (e) { console.error('[Taxi] Bad JSON in setDestination:', e); return; }
    if (!data || !data.coords) return;

    if (ride.phase < 2) return;

    ride.phase = 4;

    const pos = new mp.Vector3(data.coords.x, data.coords.y, data.coords.z);
    const dim = mp.players.local.dimension;

    ride.destBlip = mp.blips.new(38, pos, {
        name: `Drop off: ${ride.callerName}`, color: 1, scale: 1.0, shortRange: false,
    });
    ride.destBlip.setRoute(true);

    ride.destMarker = mp.markers.new(1,
        new mp.Vector3(pos.x, pos.y, mp.players.local.position.z - 1.0), 3.0,
        { color: [255, 50, 50, 200], visible: true, dimension: dim }
    );

    notify('Taxi', `Head to ${data.location || 'the destination'}.`);

    ride.tick = setInterval(() => {
        if (ride.phase !== 4) { clearRideTick(); return; }
        
        const pPos = mp.players.local.position;

        if (ride.destMarker) {
            try {
                ride.destMarker.position = new mp.Vector3(pos.x, pos.y, pPos.z - 1.0);
            } catch (_) {}
        }

        if (dist3(pPos, pos) <= 50.0) { // Fix 5: 3D distance check
            clearRideTick();
            mp.events.callRemote('server:dispatch:rideComplete');
            notify('Taxi', 'You have arrived at the destination. Ride complete!');
            cleanupRide();
        }
    }, 500);
});

// ─────────────────────────────────────────────────────────────────────────────
// CALLER — waypoint prompt + poll (legacy flow for non-phone calls)
// ─────────────────────────────────────────────────────────────────────────────
mp.events.add('client:taxi:promptWaypoint', () => {
    if (callerWaypointTick !== null) { clearInterval(callerWaypointTick); callerWaypointTick = null; }

    try { mp.game.ui.setWaypointOff(); } catch (_) {}

    notify('Taxi', 'Open your map (ESC) and place a waypoint for your destination.');

    setTimeout(() => {
        callerWaypointTick = setInterval(() => {
            const wpHandle = mp.game.ui.getFirstBlipInfoId(8);
            if (!wpHandle || wpHandle === 0) return;

            const coords = mp.game.ui.getBlipInfoIdCoord(wpHandle);
            if (!coords || (Math.abs(coords.x) < 1.0 && Math.abs(coords.y) < 1.0)) return;

            clearInterval(callerWaypointTick);
            callerWaypointTick = null;

            let destZone = 'Unknown Area';
            try {
                const key = mp.game.zone.getNameOfZone(coords.x, coords.y, coords.z);
                destZone  = mp.game.gxt.get(key) || 'Unknown Area';
            } catch (_) {}

            mp.events.callRemote('server:dispatch:waypointSet', coords.x, coords.y, coords.z, destZone);
            notify('Taxi', `Destination set: ${destZone}. Your driver will head there now.`);

        }, 800);
    }, 1500);
});

// ─────────────────────────────────────────────────────────────────────────────
// Cancellation
// ─────────────────────────────────────────────────────────────────────────────
mp.events.add('client:dispatch:callCleared', () => {
    if (callerWaypointTick !== null) { clearInterval(callerWaypointTick); callerWaypointTick = null; }
    cleanupRide();
    notify('Taxi Dispatch', 'The call has been cancelled.');
});

// ── Misc ──────────────────────────────────────────────────────────────────────

mp.events.add('client:dispatch:error', (message) => {
    if (dispatchBrowser)
        dispatchBrowser.execute(`showDispatchError(${JSON.stringify(message)})`);
});

mp.events.add('client:dispatch:resolveZone', () => {
    const player = mp.players.local;
    const pos    = player.position;
    let locationName = 'Unknown Area';
    try {
        const zoneKey = mp.game.zone.getNameOfZone(pos.x, pos.y, pos.z);
        locationName  = mp.game.gxt.get(zoneKey) || 'Unknown Area';
    } catch (_) {}
    mp.events.callRemote('server:dispatch:submitCall', locationName, pos.x, pos.y, pos.z);
});

mp.events.add('client:dispatch:requestClose', () => {
    if (!isDispatchOpen) return;
    isDispatchOpen = false;
    closeDispatchBrowser();
    mp.events.callRemote('server:dispatch:close');
    mp.events.call('interaction:restore');
});

mp.events.add('client:dispatch:requestAccept', (callIdStr) => {
    if (!isDispatchOpen) return;
    mp.events.callRemote('server:dispatch:accept', callIdStr);
});

// Listen for the UI triggering a search
mp.events.add('client:dispatch:triggerSearch', (nameQuery) => {
    mp.events.callRemote('server:dispatch:searchPlayer', nameQuery);
});

// Receive the search result from the server and send it to the UI
mp.events.add('client:dispatch:searchResult', (profileDataJson) => {
    if (dispatchBrowser) { // Replace 'dispatchBrowser' with the actual variable name of your UI browser!
        dispatchBrowser.execute(`showProfile('${profileDataJson}')`);
    }
});

// Listen for the UI triggering the Apply Wanted button
mp.events.add('client:dispatch:triggerWanted', (targetId, offenseKey) => {
    mp.events.callRemote('server:dispatch:applyWanted', targetId, offenseKey);
});