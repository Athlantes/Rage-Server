// client_packages/systems/permit.js
// ─────────────────────────────────────────────────────────────────────────────
//  Client — Family Business Permit System
//  Handles:
//   • Opening the City Hall permit board UI
//   • Delivery mission flow (drive to pickup → drive to dropoff)
//   • Receiving passive commission notifications
// ─────────────────────────────────────────────────────────────────────────────

let permitBrowser = null;
let deliveryActive = false;
let deliveryData   = null;

// Delivery route waypoints per business type
const DELIVERY_ROUTES = {
    gas_station:  { pickup: { x: 47.83,    y: -1761.50, z: 29.42 },  dropoff: null },   // set per biz
    restaurant:   { pickup: { x: -70.45,   y: -820.93,  z: 326.17 }, dropoff: null },
    mechanic:     { pickup: { x: 114.86,   y: -634.34,  z: 43.82 },  dropoff: null },
    convenience:  { pickup: { x: 25.49,    y: -1345.73, z: 29.50 },  dropoff: null },
    default:      { pickup: { x: 813.84,   y: -2157.49, z: 29.61 },  dropoff: null },
};

// ── City Hall Permit Board ────────────────────────────────────────────────────

mp.events.add('client:permit:openBoard', () => {
    if (permitBrowser) { permitBrowser.active = true; return; }

    permitBrowser = mp.browsers.new('package://systems/permit_board/index.html');
    permitBrowser.active = true;

    mp.gui.cursor.show(true, true);
    mp.input.reset();

    // Request board data from server
    mp.events.callRemote('server:permit:getBoardData');
});

mp.events.add('client:permit:closeBoard', () => {
    if (permitBrowser) {
        permitBrowser.active = false;
        mp.gui.cursor.show(false, false);
    }
});

// ── Board Data from Server ────────────────────────────────────────────────────

mp.events.add('client:permit:boardData', (jsonStr) => {
    if (!permitBrowser || !permitBrowser.active) return;
    permitBrowser.call('onBoardData', [jsonStr]);
});

mp.events.add('client:permit:raffleEntries', (jsonStr) => {
    if (!permitBrowser || !permitBrowser.active) return;
    permitBrowser.call('onRaffleEntries', [jsonStr]);
});

// ── UI → Server bridge ────────────────────────────────────────────────────────

mp.events.add('client:permit:enterRaffle', (bizId, tickets) => {
    mp.events.callRemote('server:permit:enterRaffle', bizId, tickets);
    // Close board after entering
    setTimeout(() => mp.events.call('client:permit:closeBoard'), 800);
});

mp.events.add('client:permit:viewEntries', (cycleId) => {
    mp.events.callRemote('server:permit:getRaffleEntries', cycleId);
});

// ── Delivery Mission ──────────────────────────────────────────────────────────

mp.events.add('client:permit:startDelivery', (jsonStr) => {
    if (deliveryActive) return mp.game.ui.displaySubtitle('~r~You already have an active delivery!', 4000);

    deliveryData   = JSON.parse(jsonStr);
    deliveryActive = true;

    const route = DELIVERY_ROUTES[deliveryData.bizType] || DELIVERY_ROUTES.default;

    // Set GPS to pickup
    mp.game.ui.setNewWaypoint(route.pickup.x, route.pickup.y);

    mp.game.ui.displaySubtitle(
        `~y~[Delivery] ~w~Head to the ~g~pickup point~w~ for ~y~${deliveryData.bizName}`, 8000
    );

    // Create pickup blip
    if (deliveryData._pickupBlip) deliveryData._pickupBlip.destroy();
    deliveryData._pickupBlip = mp.blips.new(
        67, // package icon
        new mp.Vector3(route.pickup.x, route.pickup.y, route.pickup.z),
        { name: `${deliveryData.bizName} Pickup`, shortRange: false, color: 2 }
    );

    // Poll for arrival at pickup
    deliveryData._pollInterval = setInterval(() => _checkPickupArrival(), 1000);
});

function _checkPickupArrival() {
    if (!deliveryActive || !deliveryData) return;
    const route   = DELIVERY_ROUTES[deliveryData.bizType] || DELIVERY_ROUTES.default;
    const pickup  = route.pickup;
    const myPos   = mp.players.local.position;
    const dist    = Math.sqrt(
        Math.pow(myPos.x - pickup.x, 2) +
        Math.pow(myPos.y - pickup.y, 2) +
        Math.pow(myPos.z - pickup.z, 2)
    );

    if (dist < 8.0) {
        clearInterval(deliveryData._pollInterval);
        if (deliveryData._pickupBlip) { deliveryData._pickupBlip.destroy(); }

        // Simulate loading goods (small anim / progress)
        mp.game.ui.displaySubtitle('~g~Loading goods...', 3000);

        setTimeout(() => {
            // Now set waypoint to business for drop-off
            // We use the business world position (server sent bizId — we'd normally
            // look up coords from a shared data file; using a generic city depot here)
            const dropoff = { x: -49.93, y: -1747.13, z: 29.42 };
            mp.game.ui.setNewWaypoint(dropoff.x, dropoff.y);

            mp.game.ui.displaySubtitle(
                `~y~[Delivery] ~w~Bring goods to ~g~${deliveryData.bizName}`, 8000
            );

            deliveryData._dropoffBlip = mp.blips.new(
                1, new mp.Vector3(dropoff.x, dropoff.y, dropoff.z),
                { name: `${deliveryData.bizName} Drop-off`, shortRange: false, color: 3 }
            );

            deliveryData._pollInterval = setInterval(() => _checkDropoffArrival(dropoff), 1000);
        }, 3000);
    }
}

function _checkDropoffArrival(dropoff) {
    if (!deliveryActive || !deliveryData) return;
    const myPos = mp.players.local.position;
    const dist  = Math.sqrt(
        Math.pow(myPos.x - dropoff.x, 2) +
        Math.pow(myPos.y - dropoff.y, 2) +
        Math.pow(myPos.z - dropoff.z, 2)
    );

    if (dist < 8.0) {
        clearInterval(deliveryData._pollInterval);
        if (deliveryData._dropoffBlip) deliveryData._dropoffBlip.destroy();

        mp.events.callRemote('server:permit:completeDelivery', deliveryData.bizId);
        mp.game.ui.clearGpsMultiRoute();

        const bizId = deliveryData.bizId;
        deliveryActive = false;
        deliveryData   = null;

        mp.game.ui.displaySubtitle(
            `~g~[Delivery Complete] ~w~Payment split between you and the family safe!`, 6000
        );
    }
}
