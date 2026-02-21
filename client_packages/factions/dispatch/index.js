// client_packages/factions/dispatch/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Client-side dispatch handler.
//
// Responsibilities:
//   • Bind P key → toggle dispatch menu (only if in faction vehicle + on duty)
//   • Handle opening / closing the CEF browser
//   • Resolve zone name when /calltaxi is typed (client only API)
//   • Handle accepted call state → set custom blip, route, marker, and colshape
//   • Listen for server-pushed real-time updates while menu is open
// ─────────────────────────────────────────────────────────────────────────────

let dispatchBrowser = null;
let isDispatchOpen = false;

// Variables to track the active call route/marker
let activeCallBlip = null;
let activeCallMarker = null;
let activeCallColshape = null;
let activeCallCoords = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function openDispatchBrowser() {
    if (dispatchBrowser) return;
    dispatchBrowser = mp.browsers.new('package://ui/dispatch/index.html');
    mp.gui.cursor.visible = true;
}

function closeDispatchBrowser() {
    if (dispatchBrowser) {
        dispatchBrowser.destroy();
        dispatchBrowser = null;
    }
    mp.gui.cursor.visible = false;
    isDispatchOpen = false;
}

function cleanupActiveCall() {
    if (activeCallBlip) {
        try { activeCallBlip.setRoute(false); } catch(e) {}
        try { activeCallBlip.destroy(); } catch(e) {}
    }
    activeCallBlip = null;

    if (activeCallMarker) {
        try { activeCallMarker.destroy(); } catch(e) {}
    }
    activeCallMarker = null;

    if (activeCallColshape) {
        try { activeCallColshape.destroy(); } catch(e) {}
    }
    activeCallColshape = null;
    
    activeCallCoords = null;
}

// ── P Key — Toggle dispatch ───────────────────────────────────────────────────
mp.keys.bind(0x50, true, () => {
    // Block if any other cursor menu is open (inventory, playerMenu, phone, etc.)
    if (mp.gui.cursor.visible && !isDispatchOpen) return;

    const player = mp.players.local;

    // Client-side pre-check: must be driver of a vehicle
    if (!player.vehicle) return;
    if (player.vehicle.getPedInSeat(-1) !== player.handle) return;

    if (isDispatchOpen) {
        // Close
        isDispatchOpen = false;
        closeDispatchBrowser();
        mp.events.callRemote('server:dispatch:close');
        mp.events.call('interaction:restore');
    } else {
        // Request from server (server will validate duty + faction vehicle)
        mp.events.callRemote('server:dispatch:open');
    }
});

// ── Server → Client events ────────────────────────────────────────────────────

// Server says: open the menu with this payload
mp.events.add('client:dispatch:open', (payloadJson) => {
    isDispatchOpen = true;

    if (!dispatchBrowser) {
        openDispatchBrowser();

        // Wait for browser to be ready, then send data
        // Small delay gives the browser time to initialise
        setTimeout(() => {
            if (dispatchBrowser) {
                dispatchBrowser.execute(`receiveDispatchData(${JSON.stringify(payloadJson)})`);
            }
        }, 150);
    } else {
        // Already open — real-time update push
        dispatchBrowser.execute(`receiveDispatchData(${JSON.stringify(payloadJson)})`);
    }
});

// Server says: force-close (e.g. player exited vehicle)
mp.events.add('client:dispatch:close', () => {
    if (isDispatchOpen) {
        closeDispatchBrowser();
        mp.events.call('interaction:restore');
    }
});

// Server says: call was accepted — set waypoint, show HUD
mp.events.add('client:dispatch:accepted', (dataJson) => {
    isDispatchOpen = false;
    closeDispatchBrowser();
    mp.events.call('interaction:restore');

    try {
        const data = JSON.parse(dataJson);

        if (data.coords) {
            // Clean up any existing call markers/blips just in case
            cleanupActiveCall();

            const pos = new mp.Vector3(data.coords.x, data.coords.y, data.coords.z);
            activeCallCoords = pos;

            const playerDim = mp.players.local.dimension;

            // 1. Create a custom Blip with a route 
            activeCallBlip = mp.blips.new(280, pos, {
                name: `Taxi Request: ${data.callerName}`,
                color: 66,
                scale: 1.0,
                shortRange: false,
                dimension: playerDim
            });
            activeCallBlip.setRoute(true);
            activeCallBlip.setRouteColor(66);

            // 2. FIX: Subtract 1.0 from Z so it spawns on the ground, remove invalid drawDistance
            activeCallMarker = mp.markers.new(1, new mp.Vector3(pos.x, pos.y, pos.z - 1.0), 1.5, {
                color: [255, 204, 0, 200], // Yellow, mostly solid
                visible: true,
                dimension: playerDim
            });

            // 3. FIX: Pass the dimension directly as the 5th argument
            activeCallColshape = mp.colshapes.newSphere(pos.x, pos.y, pos.z, 10.0, playerDim);
            activeCallColshape.isTaxiCall = true; 
        }

    } catch (e) {
        console.error('[Dispatch] Error parsing accepted call data:', e);
    }
});

// Server says: error (call already taken, etc.)
mp.events.add('client:dispatch:error', (message) => {
    if (dispatchBrowser) {
        dispatchBrowser.execute(`showDispatchError(${JSON.stringify(message)})`);
    }
});

// Server notified caller their driver is coming — show a notification in overlay
mp.events.add('client:dispatch:callerNotified', (driverName) => {
    mp.events.call('overlay:notify', 'Taxi Dispatched', `${driverName} is heading your way!`);
});

// ── Arriving at the destination ───────────────────────────────────────────────
mp.events.add('playerEnterColshape', (shape) => {
    // If there is no active call, ignore
    if (!activeCallColshape || !activeCallCoords) return;

    const playerPos = mp.players.local.position;
    
    // Calculate distance mathematically 
    const dx = playerPos.x - activeCallCoords.x;
    const dy = playerPos.y - activeCallCoords.y;
    const dz = playerPos.z - activeCallCoords.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // If the player triggers ANY colshape while within 15 meters of the destination, they arrived
    if (dist <= 15.0) {
        mp.events.call('overlay:notify', 'Taxi', 'You have arrived at the caller\'s location.');
        cleanupActiveCall();
    }
});

// ── /calltaxi zone resolver ───────────────────────────────────────────────────
// Server asks client to resolve the zone name (getZoneName is client-only)
mp.events.add('client:dispatch:resolveZone', () => {
    const player = mp.players.local;
    const pos = player.position;

    let locationName = 'Unknown Area';
    try {
        // getNameOfZone returns a GXT hash key, gxt.get() resolves it to a readable string
        const zoneKey = mp.game.zone.getNameOfZone(pos.x, pos.y, pos.z);
        locationName = mp.game.gxt.get(zoneKey) || 'Unknown Area';
    } catch (e) {
        locationName = 'Unknown Area';
    }

    // Send back to server with current coords
    mp.events.callRemote('server:dispatch:submitCall', locationName, pos.x, pos.y, pos.z);
});

// ── CEF → Client bridge (mp.trigger from inside the browser) ─────────────────

// X button or Escape inside the dispatch UI
mp.events.add('client:dispatch:requestClose', () => {
    if (!isDispatchOpen) return;
    isDispatchOpen = false;
    closeDispatchBrowser();
    mp.events.callRemote('server:dispatch:close');
    mp.events.call('interaction:restore');
});

// Accept button inside the dispatch UI
mp.events.add('client:dispatch:requestAccept', (callIdStr) => {
    if (!isDispatchOpen) return;
    mp.events.callRemote('server:dispatch:accept', callIdStr);
});
