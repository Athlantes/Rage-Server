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
    if (activeCallBlip && mp.blips.exists(activeCallBlip)) {
        activeCallBlip.setRoute(false);
        activeCallBlip.destroy();
    }
    activeCallBlip = null;

    if (activeCallMarker && mp.markers.exists(activeCallMarker)) {
        activeCallMarker.destroy();
    }
    activeCallMarker = null;

    if (activeCallColshape && mp.colshapes.exists(activeCallColshape)) {
        activeCallColshape.destroy();
    }
    activeCallColshape = null;
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

            // 1. Create a custom Blip with a route 
            // 280 is a generic map marker, 66 is Taxi Yellow color
            activeCallBlip = mp.blips.new(280, pos, {
                name: `Taxi Request: ${data.callerName}`,
                color: 66,
                scale: 1.0,
                shortRange: false,
                dimension: mp.players.local.dimension
            });
            activeCallBlip.setRoute(true);
            activeCallBlip.setRouteColor(66);

            // 2. Create a Marker on the ground (Cylinder type 1)
            activeCallMarker = mp.markers.new(0, new mp.Vector3(pos.x, pos.y, pos.z + 1.5), 1.5, {
                color: [255, 204, 0, 200], // Yellow, mostly solid
                visible: true,
                dimension: mp.players.local.dimension
            });

            // 3. Create a Colshape to detect when the driver arrives
            activeCallColshape = mp.colshapes.newSphere(pos.x, pos.y, pos.z, 15.0);
            activeCallColshape.dimension = mp.players.local.dimension;
            activeCallColshape.isTaxiCall = true; // custom flag to identify it
        }

        // Show fare HUD strip (handled in overlay.js via client event)
        mp.events.call('dispatch:showFareHUD', data);

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
    // Check if the shape exists and its ID matches our active call colshape
    if (activeCallColshape && shape && shape.id === activeCallColshape.id) {
        
        // Safely notify the driver using your overlay system
        mp.events.call('overlay:notify', 'Taxi', 'You have arrived at the caller\'s location.');
        
        // Clean up the route, marker, and blip
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
// Fires when driver accepts a call — overlay.js listens to this event
// to show the active fare strip (caller name + location)
// This is handled in client_packages/factions/dispatch/fareHUD.js (overlay addons)