// client_packages/jobs/farmer.js
let sellerBrowser = null;
let treeMarkers = [];
let pendingData = null; // [NEW] Store data here while waiting for browser

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