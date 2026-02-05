// client_packages/jobs/farmer.js
let sellerBrowser = null;
let treeMarkers = [];
let pendingData = null;

// [NEW] Local Seller Entities
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
    if (sellerBrowser) {
        sellerBrowser.destroy();
        sellerBrowser = null;
    }
    pendingData = { apples: maxApples, price: price };
    sellerBrowser = mp.browsers.new("package://ui/appleSeller.html");
    mp.gui.cursor.show(true, true);
});

mp.events.add('client:farmer:browserReady', () => {
    if (sellerBrowser && pendingData) {
        sellerBrowser.execute(`updateInfo(${pendingData.apples}, ${pendingData.price});`);
        pendingData = null;
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

// --- TREE MARKER LOGIC ---
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

// --- [NEW] LOCAL SELLER TOGGLE ---
mp.events.add('client:farmer:toggleSeller', (state) => {
    if (state) {
        // 1. Create Blip
        if (!sellerEntities.blip) {
            sellerEntities.blip = mp.blips.new(605, SELLER_COORDS, {
                name: 'Apple Wholesaler',
                color: 1,
                shortRange: true,
                scale: 0.8,
                dimension: mp.players.local.dimension
            });
        }

        // 2. Create Ped
        if (!sellerEntities.ped) {
            sellerEntities.ped = mp.peds.new(mp.game.joaat('cs_old_man2'), SELLER_COORDS, SELLER_HEADING, mp.players.local.dimension);
            sellerEntities.ped.freezePosition(true);
            sellerEntities.ped.setInvincible(true);
            sellerEntities.ped.setBlockingOfNonTemporaryEvents(true);
        }

        // 3. Create ColShape
        if (!sellerEntities.colshape) {
            sellerEntities.colshape = mp.colshapes.newSphere(SELLER_COORDS.x, SELLER_COORDS.y, SELLER_COORDS.z, 2.0, mp.players.local.dimension);
        }

    } else {
        // Destroy Everything
        if (sellerEntities.blip && mp.blips.exists(sellerEntities.blip)) {
            sellerEntities.blip.destroy();
            sellerEntities.blip = null;
        }
        if (sellerEntities.ped && mp.peds.exists(sellerEntities.ped)) {
            sellerEntities.ped.destroy();
            sellerEntities.ped = null;
        }
        if (sellerEntities.colshape && mp.colshapes.exists(sellerEntities.colshape)) {
            sellerEntities.colshape.destroy();
            sellerEntities.colshape = null;
        }
    }
});

// --- [NEW] LOCAL INTERACTION KEYBIND ---
let insideSellerZone = false;

mp.events.add('playerEnterColshape', (shape) => {
    if (sellerEntities.colshape && shape === sellerEntities.colshape) {
        insideSellerZone = true;
        mp.game.graphics.notify("Press ~b~E~w~ to sell apples.");
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