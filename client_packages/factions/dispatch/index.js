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
//   2  Waiting for caller        HUD only, server fires when caller boards
//   3  Waiting for destination   HUD only, server fires when waypoint set
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
// Completely separate so it can never interfere with `ride`
let callerWaypointTick = null;

// ── Shared helpers ────────────────────────────────────────────────────────────

function destroyBlip(b)   { if (!b) return; try { b.setRoute(false); } catch(_){} try { b.destroy(); } catch(_){} }
function destroyMarker(m) { if (!m) return; try { m.destroy(); } catch(_){} }

function notify(title, msg) { mp.events.call('showNotification', title, msg); }

function dist3(a, b) {
    const dx = a.x-b.x, dy = a.y-b.y, dz = a.z-b.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
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
    mp.events.call('updateJobUI', false, '', 0, 0, 0);
    ride.phase      = 0;
    ride.callerName = null;
}

function setHUD(label) { mp.events.call('updateJobUI', true, label, 0, 1, 0); }

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

    setHUD(`Picking up ${ride.callerName}`);

    ride.tick = setInterval(() => {
        if (ride.phase !== 1) { clearRideTick(); return; }
        if (dist3(mp.players.local.position, pos) <= 10.0) {
            clearRideTick();
            notify('Taxi', `You have arrived at ${ride.callerName}'s location.`);
            mp.events.callRemote('server:dispatch:driverArrived');

            destroyBlip(ride.blip);     ride.blip   = null;
            destroyMarker(ride.marker); ride.marker = null;

            // Phase 2: server will fire callerBoarded via playerEnterVehicle
            ride.phase = 2;
            setHUD(`Wait for ${ride.callerName} to get in`);
        }
    }, 500);
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — PHASE 2→3: server confirmed caller boarded
// Triggered by server:dispatch:callerBoarded → server detects playerEnterVehicle
// ─────────────────────────────────────────────────────────────────────────────
mp.events.add('client:taxi:callerBoarded', () => {
    if (ride.phase !== 2) return;
    ride.phase = 3;
    setHUD(`Wait for ${ride.callerName} to set a waypoint`);
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — PHASE 3→4: server confirmed waypoint, here's the destination
// ─────────────────────────────────────────────────────────────────────────────
mp.events.add('client:taxi:setDestination', (dataJson) => {
    let data;
    try { data = JSON.parse(dataJson); }
    catch (e) { console.error('[Taxi] Bad JSON in setDestination:', e); return; }
    if (!data || !data.coords) return;

    // Accept from any phase ≥ 2 so we don't get stuck if a phase event was slightly late
    if (ride.phase < 2) return;

    ride.phase = 4;

    const pos = new mp.Vector3(data.coords.x, data.coords.y, data.coords.z);
    const dim = mp.players.local.dimension;

    ride.destBlip = mp.blips.new(38, pos, {
        name: `Drop off: ${ride.callerName}`, color: 1, scale: 1.0, shortRange: false,
    });
    ride.destBlip.setRoute(true);

    ride.destMarker = mp.markers.new(1,
        new mp.Vector3(pos.x, pos.y, pos.z - 1.0), 3.0,
        { color: [255, 50, 50, 200], visible: true, dimension: dim }
    );

    setHUD(`Drop off ${ride.callerName}`);
    notify('Taxi', `Head to ${data.location || 'the destination'}.`);

    ride.tick = setInterval(() => {
        if (ride.phase !== 4) { clearRideTick(); return; }
        if (dist3(mp.players.local.position, pos) <= 20.0) {
            clearRideTick();
            mp.events.callRemote('server:dispatch:rideComplete');
            notify('Taxi', 'You have arrived at the destination. Ride complete!');
            cleanupRide();
        }
    }, 500);
});

// ─────────────────────────────────────────────────────────────────────────────
// CALLER — waypoint prompt + poll
// Isolated from `ride` entirely — uses its own `callerWaypointTick` variable
// ─────────────────────────────────────────────────────────────────────────────
mp.events.add('client:taxi:promptWaypoint', () => {
    // Stop any previous poll that may still be running
    if (callerWaypointTick !== null) { clearInterval(callerWaypointTick); callerWaypointTick = null; }

    // Clear any stale waypoint so the poll doesn't fire on the old one
    try { mp.game.ui.setWaypointOff(); } catch (_) {}

    notify('Taxi', 'Open your map (ESC) and place a waypoint for your destination.');

    // Small grace delay — give the player time to open the map before we start
    // polling, otherwise the "no waypoint" state might briefly return a stale handle
    setTimeout(() => {
        callerWaypointTick = setInterval(() => {
            // getFirstBlipInfoId(8) always returns a handle; check coords are non-zero
            const wpHandle = mp.game.ui.getFirstBlipInfoId(8);
            if (!wpHandle || wpHandle === 0) return;

            const coords = mp.game.ui.getBlipInfoIdCoord(wpHandle);
            // Require both X and Y to be meaningfully non-zero (GTA map center is 0,0)
            if (!coords || (Math.abs(coords.x) < 1.0 && Math.abs(coords.y) < 1.0)) return;

            // Valid waypoint found — stop polling immediately
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
    }, 1500); // 1.5 s grace period before polling starts
});

// ─────────────────────────────────────────────────────────────────────────────
// Cancellation — clears both driver ride and caller waypoint poll
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

mp.events.add('client:dispatch:callerNotified', (driverName) => {
    notify('Taxi Dispatched', `${driverName} is heading your way!`);
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