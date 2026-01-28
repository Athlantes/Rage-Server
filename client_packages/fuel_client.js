let fuelBrowser = null;
global.isFuelOpen = false;

mp.events.add('client:openFuelBrowser', (currentFuel, maxRefuel, price) => {
    if (fuelBrowser) return;

    global.isFuelOpen = true;

    // Disable HUD/Chat/Controls
    mp.gui.chat.activate(false);
    mp.gui.chat.show(false);
    mp.gui.cursor.show(true, true);

    // Create Browser
    fuelBrowser = mp.browsers.new('package://ui/fuel.html');
    
    mp.events.add('browserDomReady', (browser) => {
        if (browser === fuelBrowser) {
            // Pass data to UI
            fuelBrowser.execute(`updateInfo(${currentFuel.toFixed(1)}, ${maxRefuel}, ${price})`);
        }
    });
});

mp.events.add('client:closeFuelBrowser', () => {
    if (fuelBrowser) {
        fuelBrowser.destroy();
        fuelBrowser = null;
    }
    
    global.isFuelOpen = false;
    
    mp.gui.chat.activate(true);
    mp.gui.chat.show(true);
    mp.gui.cursor.show(false, false);
});

mp.events.add('client:submitRefuel', (amount) => {
    mp.events.callRemote('server:processRefuel', amount);
});