// client_packages/systems/permit.js
// ─────────────────────────────────────────────────────────────────────────────
//  Client — Family Business Permit System
//  Handles:
//   • Opening the City Hall permit board UI
//   • Delivery mission flow (drive to pickup → drive to dropoff)
//   • Receiving passive commission notifications
// ─────────────────────────────────────────────────────────────────────────────

let permitBrowser = null;
// Delivery variables
let deliveryActive = false;
let deliveryData   = null;

// ── City Hall Permit Board ────────────────────────────────────────────────────

mp.events.add('client:permit:openBoard', () => {
    if (permitBrowser) {
        permitBrowser.active = true;
        mp.gui.cursor.show(true, true);
        // Re-request fresh data when re-opening an existing browser
        mp.events.callRemote('server:permit:getBoardData');
        return;
    }

    permitBrowser = mp.browsers.new('package://systems/permit_board/index.html');
    permitBrowser.active = true;

    mp.gui.cursor.show(true, true);
    // NOTE: Do NOT call getBoardData here — the browser HTML fires
    // mp.trigger('client:permit:browserReady') once its window.load event
    // fires, guaranteeing the DOM + JS context is ready before data arrives.
});

// Browser signals it is fully loaded and ready to receive data
mp.events.add('client:permit:browserReady', () => {
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
    permitBrowser.execute(`onBoardData(${JSON.stringify(jsonStr)})`);
});

mp.events.add('client:permit:raffleEntries', (jsonStr) => {
    if (!permitBrowser || !permitBrowser.active) return;
    permitBrowser.execute(`onRaffleEntries(${JSON.stringify(jsonStr)})`);
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

// Handle UI button clicks for delivery
mp.events.add('server:permit:startDelivery', (bizId) => {
    mp.events.callRemote('server:permit:startDelivery', bizId);
});

// ── Delivery Mission ──────────────────────────────────────────────────────────

mp.events.add('client:permit:startDelivery', (jsonStr) => {
    if (deliveryActive) return mp.gui.chat.push('!{#ff0000}You already have an active delivery!');

    deliveryData   = JSON.parse(jsonStr);
    deliveryActive = true;

    // Use dynamic coordinates provided by the server
    const pickupX = deliveryData.pickup.x;
    const pickupY = deliveryData.pickup.y;
    const pickupZ = deliveryData.pickup.z;

    let pickupMsg = `!{#ffff00}[Delivery] !{#ffffff}Head to the !{#00ff00}pickup point!{#ffffff} for !{#ffff00}${deliveryData.bizName}`;
    if (deliveryData.missionType === 'van') {
        pickupMsg = `!{#ffff00}[Mission] !{#ffffff}Go to the port and pick up the !{#00ff00}Van!{#ffffff}.`;
    }

    mp.gui.chat.push(pickupMsg);

    // Create pickup blip
    if (deliveryData._pickupBlip) deliveryData._pickupBlip.destroy();
    deliveryData._pickupBlip = mp.blips.new(
        deliveryData.missionType === 'van' ? 67 : 67, // package icon
        new mp.Vector3(pickupX, pickupY, pickupZ),
        { name: `${deliveryData.bizName} Pickup`, shortRange: false, color: 2 }
    );
    deliveryData._pickupBlip.setRoute(true);

    if (deliveryData._pickupMarker) deliveryData._pickupMarker.destroy();
    deliveryData._pickupMarker = mp.markers.new(
        1, 
        new mp.Vector3(pickupX, pickupY, pickupZ - 1.0),
        deliveryData.missionType === 'van' ? 8.0 : 4.0, 
        {
            color: [0, 255, 0, 150],
            visible: true
        }
    );

    // Performance Update: Use colshape instead of setInterval
    deliveryData._pickupColshape = mp.colshapes.newSphere(pickupX, pickupY, pickupZ, deliveryData.missionType === 'van' ? 12.0 : 8.0);
});

mp.events.add('playerEnterColshape', (shape) => {
    if (!deliveryActive || !deliveryData) return;

    if (shape === deliveryData._pickupColshape) {
        _handlePickupArrival();
    } else if (shape === deliveryData._dropoffColshape) {
        _handleDropoffArrival();
    }
});

function _handlePickupArrival() {
    if (deliveryData._pickupColshape) {
        deliveryData._pickupColshape.destroy();
        deliveryData._pickupColshape = null;
    }
    if (deliveryData._pickupBlip) { 
        deliveryData._pickupBlip.destroy(); 
        deliveryData._pickupBlip = null;
    }
    if (deliveryData._pickupMarker) {
        deliveryData._pickupMarker.destroy();
        deliveryData._pickupMarker = null;
    }

    if (deliveryData.missionType === 'van') {
        mp.gui.chat.push('!{#00ff00}Get in the van and secure the load...');
        
        let waitInterval = setInterval(() => {
            if (!deliveryActive || !deliveryData) {
                clearInterval(waitInterval);
                return;
            }
            if (mp.players.local.vehicle) {
                clearInterval(waitInterval);
                _showDropoff();
            }
        }, 1000);
    } else {
        mp.gui.chat.push('!{#00ff00}Loading goods...');
        setTimeout(() => {
            if (!deliveryActive || !deliveryData) return;
            _showDropoff();
        }, 3000);
    }
}

function _showDropoff() {
    // Use dynamic dropoff coordinates provided by the server
    const dropoffX = deliveryData.dropoff.x;
    const dropoffY = deliveryData.dropoff.y;
    const dropoffZ = deliveryData.dropoff.z;

    let dropMsg = `!{#ffff00}[Delivery] !{#ffffff}Bring goods to !{#00ff00}${deliveryData.bizName}`;
    if (deliveryData.missionType === 'van') {
        dropMsg = `!{#ffff00}[Mission] !{#ffffff}Deliver the van to the !{#00ff00}24/7 store`;
    }

    mp.gui.chat.push(dropMsg);

    deliveryData._dropoffBlip = mp.blips.new(
        1, new mp.Vector3(dropoffX, dropoffY, dropoffZ),
        { name: `${deliveryData.bizName} Drop-off`, shortRange: false, color: 3 }
    );
    deliveryData._dropoffBlip.setRoute(true);

    if (deliveryData._dropoffMarker) deliveryData._dropoffMarker.destroy();
    deliveryData._dropoffMarker = mp.markers.new(
        1, 
        new mp.Vector3(dropoffX, dropoffY, dropoffZ - 1.0),
        deliveryData.missionType === 'van' ? 8.0 : 4.0, 
        {
            color: [0, 255, 0, 150],
            visible: true
        }
    );

    deliveryData._dropoffColshape = mp.colshapes.newSphere(dropoffX, dropoffY, dropoffZ, deliveryData.missionType === 'van' ? 12.0 : 8.0);
}

function _handleDropoffArrival() {
    if (deliveryData.missionType === 'van') {
        // Enforce that player must be in a vehicle for van missions
        const playerVeh = mp.players.local.vehicle;
        if (!playerVeh) {
            return mp.gui.chat.push('!{#ff0000}You must be inside the delivery van!');
        }
    }
    if (deliveryData._dropoffColshape) {
        deliveryData._dropoffColshape.destroy();
        deliveryData._dropoffColshape = null;
    }
    if (deliveryData._dropoffBlip) deliveryData._dropoffBlip.destroy();
    if (deliveryData._dropoffMarker) {
        deliveryData._dropoffMarker.destroy();
        deliveryData._dropoffMarker = null;
    }

    mp.events.callRemote('server:permit:completeDelivery', deliveryData.bizId);
    mp.game.ui.clearGpsMultiRoute();

    deliveryActive = false;
    deliveryData   = null;

    mp.gui.chat.push('!{#00ff00}[Delivery Complete] !{#ffffff}Payment split between you and the family safe!');
}