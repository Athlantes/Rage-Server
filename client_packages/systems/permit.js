// client_packages/systems/permit.js
// ─────────────────────────────────────────────────────────────────────────────
//  Client — Family Business Permit System
//  Handles:
//   • Opening the City Hall permit board UI
//   • Delivery mission flow: pickup area → board van → drive to dropoff → complete
// ─────────────────────────────────────────────────────────────────────────────

let permitBrowser = null;

// ── Delivery state ────────────────────────────────────────────────────────────
let delivery = {
    active:          false,
    data:            null,
    phase:           null,   // 'pickup' | 'board' | 'dropoff'
    pickupColshape:  null,
    pickupBlip:      null,
    pickupMarker:    null,
    dropoffColshape: null,
    dropoffBlip:     null,
    dropoffMarker:   null,
};

// ── City Hall Permit Board ────────────────────────────────────────────────────

mp.events.add('client:permit:openBoard', () => {
    if (permitBrowser) {
        permitBrowser.active = true;
        mp.gui.cursor.show(true, true);
        mp.events.callRemote('server:permit:getBoardData');
        return;
    }

    permitBrowser = mp.browsers.new('package://systems/permit_board/index.html');
    permitBrowser.active = true;
    mp.gui.cursor.show(true, true);
    // Data is sent after 'client:permit:browserReady' fires from the HTML window.onload
});

mp.events.add('client:permit:browserReady', () => {
    mp.events.callRemote('server:permit:getBoardData');
});

mp.events.add('client:permit:closeBoard', () => {
    if (permitBrowser) {
        permitBrowser.active = false;
        mp.gui.cursor.show(false, false);
    }
});

// ── Board data push from server ───────────────────────────────────────────────

mp.events.add('client:permit:boardData', (jsonStr) => {
    if (!permitBrowser || !permitBrowser.active) return;
    permitBrowser.execute(`onBoardData(${JSON.stringify(jsonStr)})`);
});

mp.events.add('client:permit:raffleEntries', (jsonStr) => {
    if (!permitBrowser || !permitBrowser.active) return;
    permitBrowser.execute(`onRaffleEntries(${JSON.stringify(jsonStr)})`);
});

// ── UI → Server bridge ────────────────────────────────────────────────────────

mp.events.add('client:permit:enterRaffle', (bizId, tickets) => {
    mp.events.callRemote('server:permit:enterRaffle', bizId, tickets);
    setTimeout(() => mp.events.call('client:permit:closeBoard'), 800);
});

mp.events.add('client:permit:viewEntries', (cycleId) => {
    mp.events.callRemote('server:permit:getRaffleEntries', cycleId);
});

// Called by the family menu UI when the player clicks "Start Delivery"
mp.events.add('client:permit:requestDelivery', (bizId) => {
    if (delivery.active) {
        mp.gui.chat.push('!{#ff4444}[Delivery] You already have an active delivery run!');
        return;
    }
    mp.events.callRemote('server:permit:startDelivery', bizId);
});

// ── Delivery Mission ──────────────────────────────────────────────────────────
// Triggered by server after all checks pass (FP deducted, van spawned).

mp.events.add('client:permit:startDelivery', (jsonStr) => {
    if (delivery.active) {
        mp.gui.chat.push('!{#ff4444}[Delivery] You already have an active delivery!');
        return;
    }

    delivery.data   = JSON.parse(jsonStr);
    delivery.active = true;
    delivery.phase  = 'pickup';

    const { pickup, pickupRadius, bizName } = delivery.data;

    mp.gui.chat.push(
        `!{#ffaa00}[Mission] !{#ffffff}Go pick up the delivery van at the !{#00ff00}port!{#ffffff}. ` +
        `Business: !{#ffff00}${bizName}`
    );

    // ── Pickup blip + marker ──────────────────────────────────────────────────
    delivery.pickupBlip = mp.blips.new(
        67,
        new mp.Vector3(pickup.x, pickup.y, pickup.z),
        { name: `${bizName} — Van Pickup`, shortRange: false, color: 2 }
    );
    delivery.pickupBlip.setRoute(true);

    delivery.pickupMarker = mp.markers.new(
        1,
        new mp.Vector3(pickup.x, pickup.y, pickup.z - 1.0),
        8.0,
        { color: [0, 220, 80, 160], visible: true }
    );

    delivery.pickupColshape = mp.colshapes.newSphere(
        pickup.x, pickup.y, pickup.z, pickupRadius || 14.0
    );
});

// ── Colshape enter handler ────────────────────────────────────────────────────

mp.events.add('playerEnterColshape', (shape) => {
    if (!delivery.active || !delivery.data) return;

    if (delivery.phase === 'pickup' && shape === delivery.pickupColshape) {
        _onArrivePickup();
    } else if (delivery.phase === 'dropoff' && shape === delivery.dropoffColshape) {
        _onArriveDropoff();
    }
});

// ── Phase: arrived at pickup zone ─────────────────────────────────────────────
function _onArrivePickup() {
    _destroyPickupObjects();

    mp.gui.chat.push('!{#00ff00}Van is here — get in and secure the load!');
    delivery.phase = 'board';

    // Poll until the player enters any vehicle (the spawned van)
    const boardInterval = setInterval(() => {
        if (!delivery.active || !delivery.data) {
            clearInterval(boardInterval);
            return;
        }
        if (mp.players.local.vehicle) {
            clearInterval(boardInterval);
            _showDropoff();
        }
    }, 1000);

    delivery.data._boardInterval = boardInterval;
}

// ── Phase: boarded, show dropoff ──────────────────────────────────────────────
function _showDropoff() {
    if (delivery.data._boardInterval) {
        clearInterval(delivery.data._boardInterval);
        delivery.data._boardInterval = null;
    }

    delivery.phase = 'dropoff';

    const { dropoff, dropoffRadius, bizName } = delivery.data;

    mp.gui.chat.push(
        `!{#ffaa00}[Mission] !{#ffffff}Deliver the goods to the !{#00ff00}24/7 store!{#ffffff}. ` +
        `Business: !{#ffff00}${bizName}`
    );

    delivery.dropoffBlip = mp.blips.new(
        1,
        new mp.Vector3(dropoff.x, dropoff.y, dropoff.z),
        { name: `${bizName} — Drop-off`, shortRange: false, color: 3 }
    );
    delivery.dropoffBlip.setRoute(true);

    delivery.dropoffMarker = mp.markers.new(
        1,
        new mp.Vector3(dropoff.x, dropoff.y, dropoff.z - 1.0),
        8.0,
        { color: [255, 165, 0, 160], visible: true }
    );

    delivery.dropoffColshape = mp.colshapes.newSphere(
        dropoff.x, dropoff.y, dropoff.z, dropoffRadius || 12.0
    );
}

// ── Phase: arrived at dropoff ─────────────────────────────────────────────────
function _onArriveDropoff() {
    // Must still be in the van
    if (delivery.data.inVehicle && !mp.players.local.vehicle) {
        mp.gui.chat.push('!{#ff4444}Stay in the van to complete the drop-off!');
        return;
    }

    _destroyDropoffObjects();
    mp.game.ui.clearGpsMultiRoute();

    mp.events.callRemote('server:permit:completeDelivery', delivery.data.bizId);

    // Reset client state immediately — server confirms and cleans up the van
    _resetDelivery();

    mp.gui.chat.push('!{#00ff00}[Delivery Complete] !{#ffffff}Payment split between you and the family safe!');
}

// ── Cleanup helpers ───────────────────────────────────────────────────────────
function _destroyPickupObjects() {
    if (delivery.pickupColshape) { delivery.pickupColshape.destroy(); delivery.pickupColshape = null; }
    if (delivery.pickupBlip)     { delivery.pickupBlip.destroy();     delivery.pickupBlip     = null; }
    if (delivery.pickupMarker)   { delivery.pickupMarker.destroy();   delivery.pickupMarker   = null; }
}

function _destroyDropoffObjects() {
    if (delivery.dropoffColshape) { delivery.dropoffColshape.destroy(); delivery.dropoffColshape = null; }
    if (delivery.dropoffBlip)     { delivery.dropoffBlip.destroy();     delivery.dropoffBlip     = null; }
    if (delivery.dropoffMarker)   { delivery.dropoffMarker.destroy();   delivery.dropoffMarker   = null; }
}

function _resetDelivery() {
    if (delivery.data && delivery.data._boardInterval) {
        clearInterval(delivery.data._boardInterval);
    }
    _destroyPickupObjects();
    _destroyDropoffObjects();
    delivery.active = false;
    delivery.data   = null;
    delivery.phase  = null;
}

// ── Cancel delivery (e.g. player dies, disconnects, or cancels manually) ──────
mp.events.add('client:permit:cancelDelivery', () => {
    if (!delivery.active) return;
    _resetDelivery();
    mp.gui.chat.push('!{#ff4444}[Delivery] Cancelled.');
});
