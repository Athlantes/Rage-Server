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