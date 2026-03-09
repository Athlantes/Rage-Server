/**
 * inventory.js  (client-side)
 * Handles inventory CEF browser lifecycle, key bindings, and the
 * relay layer between the game client and the server/CEF UI.
 *
 * Vue CEF compatibility notes:
 *   - window.loadInventory()    exposed by app.js — called on every sync
 *   - window.showNotification() exposed by app.js — called for toast popups
 *   - window.resetSearch()      exposed by app.js — clears search state through
 *                               Vue reactivity instead of direct DOM access
 */

global.isInventoryOpen = false;
let invBrowser      = null;
let isSearchFocused = false;
let lastToggle      = 0;
let lastCloseTimer  = 0; // Buffer to prevent pause menu glitch after ESC

let lastInventoryData = [];

// ─── Browser Init ─────────────────────────────────────────────────────────────

mp.events.add('playerReady', () => {
    invBrowser = mp.browsers.new('package://ui/inventory/index.html');
    invBrowser.active = false;
});

// ─── Search Focus Sync ────────────────────────────────────────────────────────
// Triggered by the Vue app (@focus / @blur on the search input).
// Prevents the "I" key from closing the inventory while the player is typing.

mp.events.add('client:setSearchFocus', (state) => {
    isSearchFocused = state;
});

// ─── Key Bindings ─────────────────────────────────────────────────────────────

// Open / Close — "I" key
mp.keys.bind(0x49, true, () => {
    if (Date.now() - lastToggle < 200) return;
    if (mp.gui.cursor.visible && !isInventoryOpen) return;
    if (isSearchFocused) return;
    if (global.isReturoOpen) return;
    if (mp.game.ui.isPauseMenuActive()) return;

    isInventoryOpen = !isInventoryOpen;
    toggleInventory(isInventoryOpen);
    lastToggle = Date.now();
});

// Close — "ESC" key
mp.keys.bind(0x1B, true, () => {
    if (global.isInventoryOpen) {
        lastCloseTimer = Date.now();
        isInventoryOpen = false;
        toggleInventory(false);
        lastToggle = Date.now();
    }
});

// ─── Render Loop — Pause Menu Suppression ────────────────────────────────────
// Keep the pause menu disabled while the inventory is open OR within 1 second
// of closing (so ESC doesn't trigger it immediately after).

mp.events.add('render', () => {
    if (global.isInventoryOpen || (Date.now() - lastCloseTimer < 1000)) {
        mp.game.controls.disableControlAction(0, 200, true); // Pause menu (ESC)
        mp.game.controls.disableControlAction(0, 199, true); // Pause menu (P)
        mp.game.controls.disableControlAction(0, 202, true); // Back / cancel
        mp.game.ui.setPauseMenuActive(false);
    }
});

// ─── toggleInventory ─────────────────────────────────────────────────────────

function toggleInventory(state) {
    global.isInventoryOpen = state;

    if (invBrowser) {
        invBrowser.active = state;
        mp.gui.cursor.show(state, state);

        if (state) {
            // Clear any leftover search state via the Vue bridge.
            // window.resetSearch() resets searchQuery + currentMatchIndex
            // through Vue reactivity — no direct DOM access needed.
            invBrowser.execute(`window.resetSearch && window.resetSearch();`);
            isSearchFocused = false;
        }
    }

    if (state) {
        mp.gui.chat.activate(false);
        mp.events.call('client:setHUDVisible', false);
        mp.events.callRemote('requestInventory');
    } else {
        mp.gui.chat.activate(true);
        mp.events.call('client:setHUDVisible', true);
        mp.game.ui.setPauseMenuActive(false);
    }
}

// ─── Server → CEF Sync ───────────────────────────────────────────────────────

mp.events.add('client:updateInventory', (json) => {
    lastInventoryData = JSON.parse(json).inventory;

    if (invBrowser) {
        // window.loadInventory() is exposed by app.js via the window bridge.
        // It updates all Vue reactive state in one assignment — no DOM writes.
        invBrowser.execute(`window.loadInventory(${json});`);
    }

    mp.events.call('updateOverlayHotbar', JSON.stringify(lastInventoryData));
});

// ─── Hotbar Fast-Use (1–5 keys) ──────────────────────────────────────────────

[0x31, 0x32, 0x33, 0x34, 0x35].forEach((key, index) => {
    mp.keys.bind(key, true, () => {
        if (mp.gui.cursor.visible || mp.players.local.vehicle || global.isInventoryOpen) return;
        mp.events.call('showOverlayHotbar', index);
        mp.events.callRemote('server:useFastSlot', index);
    });
});

// ─── CEF → Client → Server Relay ─────────────────────────────────────────────
// The Vue app calls mp.trigger() which fires these client-side events,
// which then relay to the server via callRemote().

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

// ─── Notification Bridge ──────────────────────────────────────────────────────
// The server fires showNotification on the client, which relays it to the
// Vue CEF via window.showNotification() (exposed in app.js).

mp.events.add('showNotification', (title, message) => {
    if (global.isInventoryOpen && invBrowser) {
        invBrowser.execute(`window.showNotification(${JSON.stringify(title)}, ${JSON.stringify(message)});`);
    }
});

// ─── Force Close ─────────────────────────────────────────────────────────────

mp.events.add('client:inventory:forceClose', () => {
    if (global.isInventoryOpen) {
        toggleInventory(false);
    }
});
