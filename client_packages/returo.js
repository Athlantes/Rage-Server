let returoBrowser = null;
global.isReturoOpen = false; // Global flag to block other keys

mp.events.add('client:openReturoBrowser', (maxBottles, pricePerUnit) => {
    if (returoBrowser) return;

    // 1. Lock State
    global.isReturoOpen = true;

    // 2. Disable Controls & UI
    mp.gui.chat.activate(false); // Disable Chat
    mp.gui.chat.show(false);     // Hide Chat (Optional, keeps UI clean)
    mp.gui.cursor.show(true, true);
    
    // Create Browser
    returoBrowser = mp.browsers.new('package://ui/returo.html');
    
    // Pass data
    mp.events.add('browserDomReady', (browser) => {
        if (browser === returoBrowser) {
            returoBrowser.execute(`updateInfo(${maxBottles}, ${pricePerUnit})`);
        }
    });
});

mp.events.add('client:closeReturoBrowser', () => {
    if (returoBrowser) {
        returoBrowser.destroy();
        returoBrowser = null;
    }
    
    // 3. Unlock State
    global.isReturoOpen = false;
    
    // 4. Re-enable Controls
    mp.gui.chat.activate(true);
    mp.gui.chat.show(true);
    mp.gui.cursor.show(false, false);
});

mp.events.add('client:submitReturo', (amount) => {
    mp.events.callRemote('server:processRecycling', amount);
});