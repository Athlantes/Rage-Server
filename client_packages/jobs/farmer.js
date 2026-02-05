// client_packages/jobs/farmer.js
let sellerBrowser = null;
let treeMarkers = [];
let pendingData = null; // [NEW] Store data here while waiting for browser

let sellerEntities = {
    blip: null,
    ped: null,
    marker: null,
    colshape: null
};

const SELLER_COORDS = new mp.Vector3(1960.07, 3739.94, 32.34);
const SELLER_HEADING = -50.14;

// --- SELLER UI ---
mp.events.add('client:farmer:openMenu', (maxApples, price) => {
    // 1. Cleanup existing browser
    if (sellerBrowser) {
        sellerBrowser.destroy();
        sellerBrowser = null;
    }

    // 2. Store the data for later
    pendingData = { apples: maxApples, price: price };

    // 3. Create the browser
    sellerBrowser = mp.browsers.new("package://ui/appleSeller.html");
    mp.gui.cursor.show(true, true);
});

// [NEW] Triggered by the HTML file when it's actually loaded
mp.events.add('client:farmer:browserReady', () => {
    if (sellerBrowser && pendingData) {
        // Now it's safe to send the data
        sellerBrowser.execute(`updateInfo(${pendingData.apples}, ${pendingData.price});`);
        pendingData = null; // Clear queue
        mp.console.logInfo("[FARMER] Menu loaded and data sent.");
    }
});

mp.events.add('client:closeAppleBrowser', () => {
    if (sellerBrowser) {
        sellerBrowser.destroy();
        sellerBrowser = null;
    }
    mp.gui.cursor.show(false, false);
});

mp.events.add('client:submitAppleSale', (amount) => {
    mp.events.call('client:closeAppleBrowser');
    mp.events.callRemote('server:farmer:sell', amount);
});

// --- HELPER HANDLERS ---
mp.events.add('client:freezePlayer', (status) => {
    if (mp.players.local) mp.players.local.freezePosition(status);
});

// --- MARKER LOGIC ---
mp.events.add('client:farmer:updateMarkers', (markerData) => {
    treeMarkers.forEach(m => { if(mp.markers.exists(m)) m.destroy(); });
    treeMarkers = [];

    let positions;
    try { positions = JSON.parse(markerData); } catch (e) { return; }
    
    positions.forEach(pos => {
        const marker = mp.markers.new(0, new mp.Vector3(pos.x, pos.y, pos.z), 0.5, { 
            color: [0, 255, 0, 150], 
            visible: true,
            dimension: mp.players.local.dimension
        });
        treeMarkers.push(marker);
    });
});

mp.events.add('client:farmer:clearMarkers', () => {
    treeMarkers.forEach(m => { if(mp.markers.exists(m)) m.destroy(); });
    treeMarkers = [];
});

mp.events.add('client:farmer:toggleSeller', (state) => {
    if (state) {
        // 1. Create Blip
        sellerEntities.blip = mp.blips.new(605, SELLER_COORDS, {
            name: 'Apple Wholesaler',
            color: 1,
            shortRange: true,
            scale: 0.8,
            dimension: mp.players.local.dimension
        });

        // 2. Create Local Ped
        sellerEntities.ped = mp.peds.new(mp.game.joaat('cs_old_man2'), SELLER_COORDS, SELLER_HEADING, mp.players.local.dimension);
        sellerEntities.ped.freezePosition(true);
        sellerEntities.ped.setInvincible(true);
        sellerEntities.ped.setBlockingOfNonTemporaryEvents(true);

        // 3. Create Marker (Visual indicator)
        sellerEntities.marker = mp.markers.new(1, new mp.Vector3(SELLER_COORDS.x, SELLER_COORDS.y, SELLER_COORDS.z - 1.0), 1.0, {
            color: [255, 255, 0, 100],
            visible: true,
            dimension: mp.players.local.dimension
        });

        // 4. Create ColShape for Interaction
        sellerEntities.colshape = mp.colshapes.newSphere(SELLER_COORDS.x, SELLER_COORDS.y, SELLER_COORDS.z, 2.0, mp.players.local.dimension);

    } else {
        // Destroy everything
        if (sellerEntities.blip) { sellerEntities.blip.destroy(); sellerEntities.blip = null; }
        if (sellerEntities.ped) { sellerEntities.ped.destroy(); sellerEntities.ped = null; }
        if (sellerEntities.marker) { sellerEntities.marker.destroy(); sellerEntities.marker = null; }
        if (sellerEntities.colshape) { sellerEntities.colshape.destroy(); sellerEntities.colshape = null; }
    }
});

let insideSellerZone = false;

mp.events.add('playerEnterColshape', (shape) => {
    if (sellerEntities.colshape && shape === sellerEntities.colshape) {
        insideSellerZone = true;
        mp.gui.chat.push("Press E to sell apples."); // Simple prompt
    }
});

mp.events.add('playerExitColshape', (shape) => {
    if (sellerEntities.colshape && shape === sellerEntities.colshape) {
        insideSellerZone = false;
    }
});

// Bind 'E' Key (0x45)
mp.keys.bind(0x45, true, () => {
    if (insideSellerZone && !mp.gui.cursor.visible) {
        mp.events.callRemote('server:farmer:openSeller');
    }
});