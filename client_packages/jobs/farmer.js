// client_packages/jobs/farmer.js
let sellerBrowser = null;

// --- SELLER UI ---
mp.events.add('client:farmer:openMenu', (maxApples, price) => {
    // FIX: If browser exists (stuck), destroy it first so we can open a fresh one
    if (sellerBrowser) {
        sellerBrowser.destroy();
        sellerBrowser = null;
    }

    // Create new browser
    sellerBrowser = mp.browsers.new("package://ui/appleSeller.html");
    mp.gui.cursor.show(true, true);
    
    // Debug log (Press F11 in-game to see this)
    mp.console.logInfo("[FARMER] Opening Seller Menu...");

    setTimeout(() => {
        if (sellerBrowser) {
            sellerBrowser.execute(`updateInfo(${maxApples}, ${price});`);
        }
    }, 150);
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
let treeMarkers = [];

mp.events.add('client:farmer:updateMarkers', (markerData) => {
    // 1. Clear existing markers
    treeMarkers.forEach(m => { 
        if(mp.markers.exists(m)) m.destroy(); 
    });
    treeMarkers = [];

    // 2. Parse data and create new markers
    const positions = JSON.parse(markerData);
    
    positions.forEach(pos => {
        // Type 2 = Chevron (Arrow), z+1.5 puts it above the tree
        const marker = mp.markers.new(2, new mp.Vector3(pos.x, pos.y, pos.z + 1.5), { 
            color: [0, 255, 0, 180], // Green with transparency
            visible: true,
            dimension: mp.players.local.dimension
        });
        treeMarkers.push(marker);
    });
});

mp.events.add('client:farmer:clearMarkers', () => {
    treeMarkers.forEach(m => { 
        if(mp.markers.exists(m)) m.destroy(); 
    });
    treeMarkers = [];
});