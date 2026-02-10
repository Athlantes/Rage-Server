let playerMenuBrowser = null;
let isplayerMenuOpen = false;
let lastToggleTime = 0;

// Key bind 'O'
mp.keys.bind(0x4F, true, function() {
    mp.events.call('client:toggleplayerMenu');
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

    } else {
        if (playerMenuBrowser) {
            playerMenuBrowser.active = false;
            playerMenuBrowser.destroy();
            playerMenuBrowser = null;
        }
        mp.gui.cursor.show(false, false);
        mp.game.graphics.transitionFromBlurred(500);
    }
});

mp.events.add('client:playerMenu:setSelfTag', (enabled) => {
    // Forward it to the nametag script
    mp.events.call('client:nametags:toggleSelf', enabled);
});

// Event to receive data from server and pass to UI
mp.events.add('client:playerMenu:receiveData', (json) => {
    if (playerMenuBrowser && isplayerMenuOpen) {
        playerMenuBrowser.execute(`receiveData('${json}')`);
    }
});

mp.events.add('client:closePlayerMenu', () => {
    mp.events.call('client:toggleplayerMenu', true);
});