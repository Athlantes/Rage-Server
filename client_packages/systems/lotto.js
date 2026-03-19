// ============================================================
//  client_packages/systems/lotto.js
//  6/49 Lotto System — Client Side
// ============================================================

// ────────────────────────────────────────────────────────────
//  Machine locations — add your coords here after placing props
// ────────────────────────────────────────────────────────────
const LOTTO_LOCATIONS = [
    // { x: 0.0, y: 0.0, z: 0.0 },   ← paste your machine coords here
    { x: -1390.82, y: -578.56, z: 30.44 },  // example: near Diamond Casino
];

// ────────────────────────────────────────────────────────────
//  Spawn blips, markers, and interaction colshapes
// ────────────────────────────────────────────────────────────
LOTTO_LOCATIONS.forEach((pos, index) => {
    // Map blip
    mp.blips.new(398, new mp.Vector3(pos.x, pos.y, pos.z), {
        name:       'Lotto 6/49',
        color:      5,          // yellow
        shortRange: true,
        scale:      0.85,
    });

    // Ground marker (cylinder, gold-ish)
    mp.markers.new(1, new mp.Vector3(pos.x, pos.y, pos.z - 1.0), 1.2, {
        color:     [255, 215, 0, 160],
        visible:   true,
        dimension: 0,
    });

    // Interaction colshape — handled by core/interaction.js
    const col = mp.colshapes.newSphere(pos.x, pos.y, pos.z, 2.0);
    col.interaction = {
        title: [{ key: 'E', label: 'Buy Lotto Ticket' }],
        text:         null,
        requireOnFoot: true,
        event:        'server:lotto:requestOpen',
        data:          index,
    };
});

// ────────────────────────────────────────────────────────────
//  CEF browser reference
// ────────────────────────────────────────────────────────────
let lottoBrowser = null;

function openBrowser(dataJson) {
    if (lottoBrowser) return;
    lottoBrowser = mp.browsers.new('package://ui/lotto/index.html');
    mp.gui.cursor.show(true, true);
    mp.gui.chat.activate(false);

    // Small delay so the HTML has time to initialize
    setTimeout(() => {
        if (lottoBrowser) lottoBrowser.execute(`loadData('${dataJson}')`);
    }, 150);
}

function closeBrowser() {
    if (lottoBrowser) {
        lottoBrowser.destroy();
        lottoBrowser = null;
    }
    mp.gui.cursor.show(false, false);
    mp.gui.chat.activate(true);
    mp.events.call('interaction:restore');
}

// ────────────────────────────────────────────────────────────
//  Server → Client events
// ────────────────────────────────────────────────────────────

/** Server sends the open payload — show the UI */
mp.events.add('client:lotto:openUI', (dataJson) => {
    openBrowser(dataJson);
});

/** Ticket was bought successfully — update UI to show receipt */
mp.events.add('client:lotto:ticketConfirmed', (numbers, bet, newJackpot) => {
    if (lottoBrowser) {
        lottoBrowser.execute(`onTicketConfirmed('${numbers}', ${bet}, ${newJackpot})`);
    }
});

/** Server reported an error (validation, not enough cash, etc.) */
mp.events.add('client:lotto:error', (message) => {
    if (lottoBrowser) {
        lottoBrowser.execute(`onError('${message}')`);
    }
});

/** Prize notification — delivered via phone mail only, no GTA overlay */
mp.events.add('client:lotto:prizeNotification', (_amount, _reason) => {
    // Results are sent via phone mail — no additional notification needed
});

// ────────────────────────────────────────────────────────────
//  Draw Overlay Browser
// ────────────────────────────────────────────────────────────
let drawBrowser = null;

function openDrawOverlay(payload) {
    if (drawBrowser) {
        drawBrowser.destroy();
        drawBrowser = null;
    }
    drawBrowser = mp.browsers.new('package://ui/lotto/draw-overlay.html');
    setTimeout(() => {
        if (drawBrowser) drawBrowser.execute(`startDraw('${JSON.stringify(payload)}')`);
    }, 200);
}

function closeDrawOverlay() {
    if (drawBrowser) {
        drawBrowser.destroy();
        drawBrowser = null;
    }
}

/** Server broadcasts the draw — show cinematic overlay to all players */
mp.events.add('client:lotto:drawStart', (payloadJson) => {
    const payload = JSON.parse(payloadJson);
    openDrawOverlay(payload);
});

/** Called from the overlay HTML when animation is done */
mp.events.add('client:lotto:drawDismiss', () => {
    closeDrawOverlay();
});

// ────────────────────────────────────────────────────────────
//  Client → Server proxy events (called from HTML via mp.trigger)
// ────────────────────────────────────────────────────────────

/** HTML calls: window.mp.trigger('client:lotto:buy', numbersJson, bet) */
mp.events.add('client:lotto:buy', (numbersJson, bet) => {
    mp.events.callRemote('server:lotto:buyTicket', numbersJson, bet);
});

/** HTML calls: window.mp.trigger('client:lotto:close') */
mp.events.add('client:lotto:close', () => {
    closeBrowser();
});