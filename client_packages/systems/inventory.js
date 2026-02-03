global.isInventoryOpen = false; 
let invBrowser = null;
let isSearchFocused = false;
let lastToggle = 0;
let lastCloseTimer = 0; // NEW: Timer to prevent pause menu glitch

let lastInventoryData = [];

mp.events.add('playerReady', () => {
    invBrowser = mp.browsers.new('package://ui/inventory.html');
    invBrowser.active = false;
});

mp.events.add('client:setSearchFocus', (state) => {
    isSearchFocused = state;
});

// --- TOGGLE LOGIC (Open with I) ---
mp.keys.bind(0x49, true, () => { // "I" Key
    if (Date.now() - lastToggle < 200) return;
    if (mp.gui.cursor.visible && !isInventoryOpen) return;
    if (isSearchFocused) return;
    if (global.isReturoOpen) return;
    if (mp.game.ui.isPauseMenuActive()) return;

    // BLOCK IF CAMERA IS ACTIVE
    if (global.isCameraActive) return;

    isInventoryOpen = !isInventoryOpen;
    toggleInventory(isInventoryOpen);
    lastToggle = Date.now();
});

// --- CLOSE LOGIC (Close with ESC) ---
mp.keys.bind(0x1B, true, () => { // "ESC" Key
    if (global.isInventoryOpen) {
        // 1. Mark the time we closed it
        lastCloseTimer = Date.now();
        
        // 2. Close the inventory
        isInventoryOpen = false;
        toggleInventory(false);
        lastToggle = Date.now();
    }
});

mp.events.add('render', () => {
    // LOGIC: Check if inventory is open OR if we just closed it less than 1 second ago
    // This "buffer time" prevents the Pause Menu from catching the ESC key press
    if (global.isInventoryOpen || (Date.now() - lastCloseTimer < 1000)) {
        
        // Disable Pause Menu (ESC / P)
        mp.game.controls.disableControlAction(0, 200, true); 
        mp.game.controls.disableControlAction(0, 199, true);
        
        // Disable Back/Cancel (Right Click / Backspace)
        mp.game.controls.disableControlAction(0, 202, true); 

        // Force the pause menu specifically to stay closed
        mp.game.ui.setPauseMenuActive(false);
    }
});

function toggleInventory(state) {
    global.isInventoryOpen = state;

    if (invBrowser) {
        invBrowser.active = state;
        mp.gui.cursor.show(state, state);

        if (state) {
            invBrowser.execute(`
                if(document.getElementById('search-input')) {
                    document.getElementById('search-input').value = ''; 
                    document.getElementById('search-input').blur();
                }
                handleSearch('');
            `);
            isSearchFocused = false; 
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
        
        // Final nuke to ensure pause menu stays dead
        mp.game.ui.setPauseMenuActive(false);
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