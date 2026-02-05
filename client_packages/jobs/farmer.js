// client_packages/jobs/farmer.js
let sellerBrowser = null;
let jobMarker = null;

// --- SELLER UI HANDLERS ---
mp.events.add('client:farmer:openMenu', (maxApples, price) => {
    if (sellerBrowser) return;

    sellerBrowser = mp.browsers.new("package://ui/appleSeller.html");
    mp.gui.cursor.show(true, true);
    
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

// --- VISUALS (JOB MARKER) ---
mp.events.add('client:farmer:toggleJob', (state, pos) => {

    if (state && pos) {
        if (!jobMarker) {
             // Creating the Marker at the Interaction Point
             jobMarker = mp.markers.new(1, new mp.Vector3(pos.x, pos.y, pos.z - 1.0), 1.5, {
                color: [255, 165, 0, 150], // Orange
                visible: true,
                dimension: mp.players.local.dimension
            });
        }
    } else {
        if (jobMarker) { 
            jobMarker.destroy(); 
            jobMarker = null; 
        }
    }
});