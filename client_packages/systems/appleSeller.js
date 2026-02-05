// client_packages/systems/appleSeller.js
let appleBrowser = null;
global.isAppleMenuOpen = false;

const SELLER_POS = { x: 1960.07, y: 3739.94, z: 32.34 };

// 1. Create Map Blip
mp.blips.new(272, new mp.Vector3(SELLER_POS.x, SELLER_POS.y, SELLER_POS.z), {
    name: 'Apple Wholesaler',
    color: 17,         // Orange/Reddish
    shortRange: true,
    scale: 0.9,
    dimension: 0
});

// 2. UI Logic
mp.events.add('client:openAppleBrowser', (maxApples, pricePerUnit) => {
    if (appleBrowser) return;

    global.isAppleMenuOpen = true;

    // Disable Controls
    mp.gui.chat.activate(false); 
    mp.gui.chat.show(false);     
    mp.gui.cursor.show(true, true);
    
    // Create Browser
    appleBrowser = mp.browsers.new('package://ui/appleSeller.html');
    
    // Pass Data to UI
    mp.events.add('browserDomReady', (browser) => {
        if (browser === appleBrowser) {
            appleBrowser.execute(`updateInfo(${maxApples}, ${pricePerUnit})`);
        }
    });
});

mp.events.add('client:closeAppleBrowser', () => {
    if (appleBrowser) {
        appleBrowser.destroy();
        appleBrowser = null;
    }
    
    global.isAppleMenuOpen = false;
    
    // Re-enable Controls
    mp.gui.chat.activate(true);
    mp.gui.chat.show(true);
    mp.gui.cursor.show(false, false);
});

// 3. Forward Submit Event to Server
mp.events.add('client:submitAppleSale', (amount) => {
    mp.events.callRemote('server:processAppleSale', amount);
});