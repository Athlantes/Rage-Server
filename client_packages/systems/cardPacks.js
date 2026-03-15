/**
 * cardPacks.js  (client-side)
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the Card Packs CEF browser lifecycle and acts as the relay layer
 * between the RAGE:MP game client (server events) and the CEF UI.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

let packBrowser = null;
let isPackOpen  = false;

// ─── Browser Lifecycle ────────────────────────────────────────────────────────

function openPackUI() {
    if (packBrowser) return; // Already open

    packBrowser = mp.browsers.new('package://ui/cardPacks/index.html');
    packBrowser.active = true;

    mp.gui.cursor.visible = true;
    mp.game.ui.setFrontendActive(false);
    isPackOpen = true;
    global.isCardPackOpen = true;
}

function closePackUI() {
    if (!packBrowser) return;

    packBrowser.active = false;
    packBrowser.destroy();
    packBrowser = null;

    mp.gui.cursor.visible = false;
    isPackOpen = false;
    global.isCardPackOpen = false;
}

// ─── SERVER → CEF (via client bridge) ────────────────────────────────────────

mp.events.add('client:cardPack:openPreview', (previewJson) => {
    openPackUI();

    // Give the browser a moment to initialise before sending data
    setTimeout(() => {
        if (packBrowser) {
            packBrowser.execute(`window.onPreviewData(${previewJson})`);
        }
    }, 350);
});

mp.events.add('client:cardPack:startUnboxing', (sessionJson) => {
    if (!packBrowser) return;
    packBrowser.execute(`window.onStartUnboxing(${sessionJson})`);
});

mp.events.add('client:cardPack:revealCard', (payloadJson) => {
    if (!packBrowser) return;
    packBrowser.execute(`window.onCardRevealed(${payloadJson})`);
});

mp.events.add('client:cardPack:rerollReady', (payloadJson) => {
    if (!packBrowser) return;
    packBrowser.execute(`window.onRerollReady(${payloadJson})`);
});

mp.events.add('client:cardPack:sessionEnd', (_payloadJson) => {
    // Give the UI a moment to play its closing animation before destroying
    setTimeout(() => closePackUI(), 2400);
});

mp.events.add('client:cardPack:error', (errorJson) => {
    if (packBrowser) {
        packBrowser.execute(`window.onServerError(${errorJson})`);
    }
    // Close after a short delay so the player can read the error
    setTimeout(() => closePackUI(), 2500);
});

// ─── CEF → SERVER ────────────────────────────────────────────────────────────

// NOTE: Added 'itemSlot' here to match the CEF's trigger call
mp.events.add('client:cardPack:cef:confirmOpen', (itemSlot) => {
    mp.events.callRemote('server:cardPack:confirmOpen', itemSlot);
});

mp.events.add('client:cardPack:cef:cancel', () => {
    mp.events.callRemote('server:cardPack:cancel');
    closePackUI();
});

mp.events.add('client:cardPack:cef:pickCard', (visualIndex) => {
    mp.events.callRemote('server:cardPack:pickCard', visualIndex);
});

mp.events.add('client:cardPack:cef:claimReward', () => {
    mp.events.callRemote('server:cardPack:claimReward');
});

mp.events.add('client:cardPack:cef:reRoll', () => {
    mp.events.callRemote('server:cardPack:reRoll');
});

mp.events.add('client:cardPack:cef:forceClose', () => {
    closePackUI();
});

// ─── ESC KEY BIND ────────────────────────────────────────────────────────────
mp.keys.bind(0x1B, true, () => {
    if (isPackOpen) {
        // Only allow ESC on the preview screen (not mid-unboxing)
        if (packBrowser) {
            packBrowser.execute('window.onEscapePressed()');
        }
    }
});