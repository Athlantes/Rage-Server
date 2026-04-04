// client_packages/systems/store.js
'use strict';

let storeBrowser = null;

// ---------------------------------------------------------------------------
// Setup Store Blips
// ---------------------------------------------------------------------------
mp.events.add('playerReady', () => {
    // We only need the locations for blips on the client now
    const storeLocations = [
        { x: 24.46, y: -1347.42, z: 29.50, name: "24/7 Store", sprite: 52, color: 4 },
        { x: 1164.71, y: -322.60, z: 69.21, name: "24/7 Store", sprite: 52, color: 4 },
        { x: -706.07, y: -913.61, z: 19.22, name: "24/7 Store", sprite: 52, color: 4 },
        { x: 1959.00, y: 3741.76, z: 32.34, name: "24/7 Store", sprite: 52, color: 4 },
    ];

    storeLocations.forEach(loc => {
        mp.blips.new(loc.sprite, new mp.Vector3(loc.x, loc.y, loc.z), {
            name: loc.name,
            scale: 0.75,
            color: loc.color,
            shortRange: true,
        });
    });
    console.log('[Store] Map Blips created.');
});

// ---------------------------------------------------------------------------
// UI Handling
// ---------------------------------------------------------------------------
mp.events.add('client:store:openUI', (catalogJson) => {
    if (storeBrowser) return;

    storeBrowser = mp.browsers.new('package://ui/store/index.html');
    mp.gui.cursor.show(true, true);

    setTimeout(() => {
        if (storeBrowser) storeBrowser.execute(`window.loadCatalog(${catalogJson})`);
    }, 150);
});

mp.events.add('client:store:purchaseOK', () => {
    if (storeBrowser) storeBrowser.execute(`window.onPurchaseSuccess()`);
});

// CEF -> Server Proxies
mp.events.add('client:store:purchase', (itemId, qty) => {
    mp.events.callRemote('server:store:purchase', itemId, qty);
});

mp.events.add('client:store:close', () => {
    closeStoreUI();
    mp.events.callRemote('server:store:close');
});

// Key: ESC – Backup Close Store
mp.keys.bind(0x1B, false, () => {
    if (storeBrowser) closeStoreUI();
});

// Hot-spawn an admin blip without reconnecting
mp.events.add('client:store:addBlip', (x, y, z) => {
    mp.blips.new(52, new mp.Vector3(x, y, z), { name: "24/7 Store", scale: 0.75, color: 4, shortRange: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function closeStoreUI() {
    if (storeBrowser) {
        storeBrowser.destroy();
        storeBrowser = null;
    }
    mp.gui.cursor.show(false, false);
    mp.events.call('interaction:restore'); // Restores the colshape interaction prompt if they are still standing there
}