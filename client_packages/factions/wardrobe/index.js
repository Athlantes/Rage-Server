// client_packages/factions/wardrobe/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Faction Wardrobe Client — Opens the wardrobe UI browser, handles preview
// and selection communication between CEF ↔ Client ↔ Server.
// ─────────────────────────────────────────────────────────────────────────────

let wardrobeBrowser = null;
let isWardrobeOpen = false;
let currentFactionId = null;
let cursorVisible = true;

function openWardrobe(data) {
    if (isWardrobeOpen) return;

    const payload = JSON.parse(data);
    currentFactionId = payload.factionId;

    if (!wardrobeBrowser) {
        wardrobeBrowser = mp.browsers.new('package://ui/wardrobe/index.html');
    }

    wardrobeBrowser.active = true;
    mp.gui.cursor.show(true, true);
    cursorVisible = true;

    // Wait a moment for the browser to load, then push data
    setTimeout(() => {
        if (wardrobeBrowser) {
            wardrobeBrowser.execute(`receiveWardrobeData(${JSON.stringify(data)})`);
        }
    }, 200);

    isWardrobeOpen = true;

    // Freeze player
    mp.players.local.freezePosition(true);
}

function closeWardrobe() {
    if (!isWardrobeOpen) return;

    if (wardrobeBrowser) {
        wardrobeBrowser.active = false;
        wardrobeBrowser.destroy();
        wardrobeBrowser = null;
    }

    mp.gui.cursor.show(false, false);
    mp.players.local.freezePosition(false);

    isWardrobeOpen = false;

    // Tell server to restore clothes
    mp.events.callRemote('server:wardrobe:close');

    // Restore interaction prompt if applicable
    mp.events.call('interaction:restore');
}

// ── Server → Client Events ────────────────────────────────────────────────────

mp.events.add('client:wardrobe:open', (data) => {
    openWardrobe(data);
});

// ── CEF → Client Events (triggered from browser JS) ──────────────────────────

mp.events.add('cef:wardrobe:preview', (index) => {
    if (!isWardrobeOpen || currentFactionId === null) return;
    mp.events.callRemote('server:wardrobe:preview', currentFactionId, index);
});

mp.events.add('cef:wardrobe:select', (index) => {
    if (!isWardrobeOpen || currentFactionId === null) return;
    mp.events.callRemote('server:wardrobe:select', currentFactionId, index);
    closeWardrobe();
});

mp.events.add('cef:wardrobe:close', () => {
    closeWardrobe();
});

// ── Right Alt key to toggle cursor (0xA5 = VK_RMENU) ─────────────────────────
mp.keys.bind(0xA5, true, () => {
    if (!isWardrobeOpen) return;
    cursorVisible = !cursorVisible;
    mp.gui.cursor.show(cursorVisible, cursorVisible);
});

// ── ESC key to close ──────────────────────────────────────────────────────────
mp.keys.bind(0x1B, true, () => {
    if (isWardrobeOpen) {
        closeWardrobe();
    }
});
