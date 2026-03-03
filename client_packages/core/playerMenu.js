let playerMenuBrowser = null;
let isplayerMenuOpen = false;
let lastToggleTime = 0;
let isInputFocused = false; // True when a text input inside the CEF is focused

// Key bind 'O'
mp.keys.bind(0x4F, true, function() {
    if (isInputFocused) return; // Don't close while typing
    mp.events.call('client:toggleplayerMenu');
});

// CEF fires this when any input gains / loses focus
mp.events.add('client:playerMenu:setInputFocus', (focused) => {
    isInputFocused = !!focused;
});

mp.events.add('client:toggleplayerMenu', (force = false) => {
    const now = Date.now();
    if (!force) {
        if ((now - lastToggleTime) < 1000) return;
        if (mp.gui.cursor.visible && !isplayerMenuOpen) return;
    }

    lastToggleTime = now;
    isplayerMenuOpen = !isplayerMenuOpen;
    
    if (isplayerMenuOpen) {
        if (!playerMenuBrowser) {
            playerMenuBrowser = mp.browsers.new("package://ui/playerMenu/index.html");
        }
        playerMenuBrowser.active = true;
        mp.gui.cursor.show(true, true);
        mp.game.graphics.transitionToBlurred(500);

        // REQUEST DATA FROM SERVER
        mp.events.callRemote('server:playerMenu:getData');

        // Send saved settings state to UI
        setTimeout(() => {
            if (playerMenuBrowser) {
                let voiceVol = 100, voiceEnabled = true, selfTag = false;
                try {
                    const sv = mp.storage.data.voiceVolume;
                    if (sv !== undefined && sv !== null) voiceVol = sv;
                    const se = mp.storage.data.voiceEnabled;
                    if (se !== undefined && se !== null) voiceEnabled = se;
                    const st = mp.storage.data.showSelfTag;
                    if (st !== undefined && st !== null) selfTag = st;
                } catch(e) {}
                const settingsJson = JSON.stringify({ voiceVolume: voiceVol, voiceEnabled: voiceEnabled, showSelfTag: selfTag });
                playerMenuBrowser.execute(`applySettings('${settingsJson}')`);
            }
        }, 200);

    } else {
        if (playerMenuBrowser) {
            playerMenuBrowser.active = false;
            playerMenuBrowser.destroy();
            playerMenuBrowser = null;
        }
        isInputFocused = false; // Reset — can't be stuck if menu is gone
        mp.gui.cursor.show(false, false);
        mp.game.graphics.transitionFromBlurred(500);
    }
});

mp.events.add('setHouseWaypoint', (x, y) => {
    mp.game.ui.setNewWaypoint(x, y);
    mp.gui.chat.push("!{00FF00}GPS set to your house.");
});

mp.events.add('client:playerMenu:setSelfTag', (enabled) => {
    // Persist the nametag setting
    try { mp.storage.data.showSelfTag = enabled; mp.storage.flush(); } catch(e) {}
    // Forward it to the nametag script
    mp.events.call('client:nametags:toggleSelf', enabled);
});

// Event to receive data from server and pass to UI
mp.events.add('client:playerMenu:receiveData', (json) => {
    if (playerMenuBrowser && isplayerMenuOpen) {
        const safe = json.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
        playerMenuBrowser.execute(`receiveData('${safe}')`);
    }
});

mp.events.add('client:closePlayerMenu', () => {
    mp.events.call('client:toggleplayerMenu', true);
});

// ── Mugshot Reset (Settings tab) ──
mp.events.add('client:mugshot:reset', () => {
    mp.events.callRemote('server:mugshot:reset');
});

mp.events.add('client:mugshot:resetDone', () => {
    if (playerMenuBrowser && isplayerMenuOpen) {
        playerMenuBrowser.execute('mugshotResetDone()');
    }
    mp.gui.chat.push('~y~Mugshot reset. Rejoin the server to take a new one.');
});