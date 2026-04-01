let classSelectorBrowser = null;
let classSelectionActive = false;

// ─────────────────────────────────────────────────────────────────────────────
// START CLASS SELECTOR (triggered by server after character creation)
// ─────────────────────────────────────────────────────────────────────────────

mp.events.add('client:classSelector:start', () => {
    if (classSelectionActive) return;

    classSelectionActive = true;

    mp.gui.cursor.show(true, true);
    mp.game.ui.displayRadar(false);
    mp.game.ui.displayHud(false);

    if (!classSelectorBrowser) {
        classSelectorBrowser = mp.browsers.new('package://ui/classSelector/index.html');
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PAGE READY HANDSHAKE
// CEF fires this once window 'load' fires and mp is available
// ─────────────────────────────────────────────────────────────────────────────

mp.events.add('client:classSelector:pageReady', () => {
    // Browser is fully loaded and ready — nothing extra needed here.
    // app.js initialises itself on load.
});

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM SELECTION (fired from CEF via mp.trigger)
// ─────────────────────────────────────────────────────────────────────────────

mp.events.add('client:classSelector:confirm', (classId, subclassId) => {
    mp.events.callRemote('server:class:save', classId, subclassId);
});

// ─────────────────────────────────────────────────────────────────────────────
// SERVER CONFIRMATION — class saved successfully
// ─────────────────────────────────────────────────────────────────────────────

mp.events.add('client:class:saved', (success) => {
    if (success) {
        if (classSelectorBrowser) {
            classSelectorBrowser.destroy();
            classSelectorBrowser = null;
        }

        classSelectionActive = false;
        mp.gui.cursor.show(false, false);
        mp.game.ui.displayRadar(true);
        mp.game.ui.displayHud(true);

        mp.events.callLocal('toggleOverlay', true);
        mp.events.callLocal('client:classSelector:closed');
    } else {
        if (classSelectorBrowser) {
            classSelectorBrowser.execute('showError("Failed to save class. Please try again.");');
        }
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// CLOSE (internal use only — ESC is intentionally blocked during class selection)
// ─────────────────────────────────────────────────────────────────────────────

mp.events.add('client:classSelector:close', () => {
    if (!classSelectionActive) return;

    if (classSelectorBrowser) {
        classSelectorBrowser.destroy();
        classSelectorBrowser = null;
    }

    classSelectionActive = false;
    mp.gui.cursor.show(false, false);
    mp.game.ui.displayRadar(true);
    mp.game.ui.displayHud(true);
});

// Block ESC during class selection — player must make a choice
mp.keys.bind(0x1B, false, () => {
    // intentionally empty while classSelectionActive
});