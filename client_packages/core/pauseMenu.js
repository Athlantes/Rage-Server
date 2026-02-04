let pauseMenuBrowser = null;
let isPauseMenuOpen = false;
let lastToggleTime = 0;

// Key bind 'O'
mp.keys.bind(0x4F, true, function() {
    mp.events.call('client:togglePauseMenu');
});

mp.events.add('client:togglePauseMenu', (force = false) => {
    const now = Date.now();
    if (!force) {
        if ((now - lastToggleTime) < 1000) return;
        if (mp.gui.cursor.visible && !isPauseMenuOpen) return;
    }

    lastToggleTime = now;
    isPauseMenuOpen = !isPauseMenuOpen;
    
    if (isPauseMenuOpen) {
        if (!pauseMenuBrowser) {
            pauseMenuBrowser = mp.browsers.new("package://ui/pauseMenu/index.html");
        }
        pauseMenuBrowser.active = true;
        mp.gui.cursor.show(true, true);
        mp.game.graphics.transitionToBlurred(500);

        // REQUEST DATA FROM SERVER
        mp.events.callRemote('server:playerMenu:getData');

    } else {
        if (pauseMenuBrowser) {
            pauseMenuBrowser.active = false;
            pauseMenuBrowser.destroy();
            pauseMenuBrowser = null;
        }
        mp.gui.cursor.show(false, false);
        mp.game.graphics.transitionFromBlurred(500);
    }
});

// Event to receive data from server and pass to UI
mp.events.add('client:playerMenu:receiveData', (json) => {
    if (pauseMenuBrowser && isPauseMenuOpen) {
        pauseMenuBrowser.execute(`receiveData('${json}')`);
    }
});

mp.events.add('client:closePlayerMenu', () => {
    mp.events.call('client:togglePauseMenu', true);
});