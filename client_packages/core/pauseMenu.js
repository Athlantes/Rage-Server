let pauseMenuBrowser = null;
let isPauseMenuOpen = false;

mp.events.add('client:togglePauseMenu', () => {
    if (mp.gui.cursor.visible && !isPauseMenuOpen) return; // Don't open if other UI is up

    isPauseMenuOpen = !isPauseMenuOpen;
    
    if (isPauseMenuOpen) {
        if (!pauseMenuBrowser) {
            pauseMenuBrowser = mp.browsers.new("package://ui/pauseMenu/index.html");
        }
        pauseMenuBrowser.active = true;
        mp.gui.cursor.show(true, true);
        mp.game.graphics.transitionToBlurred(500); // Beautiful blur effect
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

// UI Callbacks
mp.events.add('client:pauseMenuAction', (action) => {
    switch(action) {
        case 'map':
            mp.events.call('client:togglePauseMenu'); // Close custom menu
            mp.game.ui.activateFrontendMenu(mp.game.joaat("FE_MENU_VERSION_MP_PAUSE"), false, -1); // Open Real Map
            break;
        case 'jobs':
            mp.events.call('client:togglePauseMenu'); // Close main menu
            mp.events.call('client:openJobMenu');     // Open Job Menu
            break;
        case 'resume':
            mp.events.call('client:togglePauseMenu');
            break;
        case 'quit':
            mp.events.callRemote('server:kickPlayer'); // Example server call
            break;
    }
});