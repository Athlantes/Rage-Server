global.isInventoryOpen = false; 
let invBrowser = null;
let isSearchFocused = false; // <--- NEW STATE

let lastInventoryData = [];

mp.events.add('playerReady', () => {
    invBrowser = mp.browsers.new('package://ui/inventory.html');
    invBrowser.active = false;
});

// Sync focus state from HTML
mp.events.add('client:setSearchFocus', (state) => {
    isSearchFocused = state;
});

mp.keys.bind(0x49, true, () => {
    // 1. If typing in chat (cursor visible + inventory closed), ignore
    if (mp.gui.cursor.visible && !isInventoryOpen) return;
    
    // 2. NEW: If typing in Search bar inside Inventory, ignore
    if (isSearchFocused) return;
    if (global.isReturoOpen) return;

    isInventoryOpen = !isInventoryOpen;
    toggleInventory(isInventoryOpen);
});

function toggleInventory(state) {
    global.isInventoryOpen = state;

    if (invBrowser) {
        invBrowser.active = state;
        mp.gui.cursor.show(state, state);

        if (state) {
            // Reset Search on Open
            invBrowser.execute(`
                if(document.getElementById('search-input')) {
                    document.getElementById('search-input').value = ''; 
                    document.getElementById('search-input').blur();
                }
                handleSearch('');
            `);
            isSearchFocused = false; // Reset state
        }
    }

    if (state) {
        mp.gui.chat.activate(false);
        mp.events.call('client:setHUDVisible', false);
        mp.events.callRemote('requestInventory');
        mp.game.graphics.transitionToBlurred(200);
    } else {
        mp.gui.chat.activate(true);
        mp.events.call('client:setHUDVisible', true);
        mp.game.graphics.transitionFromBlurred(200);
    }
}

mp.events.add('client:updateInventory', (json) => {
    lastInventoryData = JSON.parse(json).inventory;
    if (invBrowser) invBrowser.execute(`loadInventory(${json});`);
    mp.events.call('updateOverlayHotbar', JSON.stringify(lastInventoryData));
});

[0x31, 0x32, 0x33, 0x34, 0x35].forEach((key, index) => {
    mp.keys.bind(key, true, () => {
        if (mp.gui.cursor.visible || mp.players.local.vehicle || global.isInventoryOpen) return;
        mp.events.call('showOverlayHotbar', index);
        mp.events.callRemote('server:useFastSlot', index);
    });
});

mp.events.add('gui:moveItem', (fromSlot, toSlot) => {
    mp.events.callRemote('server:moveItem', fromSlot, toSlot);
});

mp.events.add('client:useItem', (slot) => {
    mp.events.callRemote('server:useItem', slot);
});

mp.events.add('client:equipItem', (slot) => {
    mp.events.callRemote('server:equipItem', slot);
});

mp.events.add('client:dropItem', (slot) => {
    mp.events.callRemote('server:moveItem', slot, 'GROUND');
});

mp.events.add('client:splitItem', (slot, amount) => {
    mp.events.callRemote('server:splitItem', slot, amount);
});

mp.events.add('client:stackItem', (slot) => {
    mp.events.callRemote('server:stackItem', slot);
});

mp.events.add('client:reqSort', () => {
    mp.game.audio.playSoundFrontend(-1, "SELECT", "HUD_FRONTEND_DEFAULT_SOUNDSET", true);
    mp.events.callRemote('server:sortInventory');
});

mp.events.add('client:reqStack', () => {
    mp.game.audio.playSoundFrontend(-1, "Grab_Parachute", "BASEJUMPS_SOUNDS", true);
    mp.events.callRemote('server:stackAllItems');
});

mp.events.add('showNotification', (title, message) => {
    if (global.isInventoryOpen && invBrowser) {
        invBrowser.execute(`showNotification(${JSON.stringify(title)}, ${JSON.stringify(message)})`);
    }
});