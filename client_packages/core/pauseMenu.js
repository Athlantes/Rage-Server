let pauseMenuBrowser = null;
let isPauseMenuOpen = false;
let lastToggleTime = 0;
let isMapOpen = false; // [Fix] Track if we sent player to map

// [NEW] Bind 'O' key (0x4F) to toggle the menu
mp.keys.bind(0x4F, true, function() {
    mp.events.call('client:togglePauseMenu');
});

mp.events.add('client:updateQuestUI', (questJson) => {
    if (pauseMenuBrowser) {
        pauseMenuBrowser.execute(`updateQuests('${questJson}')`);
    }
    mp.events.call('client:storeQuestData', questJson);
});

let cachedQuestData = "[]";
mp.events.add('client:storeQuestData', (data) => {
    cachedQuestData = data;
    if (pauseMenuBrowser && isPauseMenuOpen) {
        pauseMenuBrowser.execute(`updateQuests('${cachedQuestData}')`);
    }
});

// [Fix] added 'force' parameter to bypass checks when switching menus
mp.events.add('client:togglePauseMenu', (force = false) => {
    const now = Date.now();
    
    // Only check cooldown/cursor if NOT forced
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
        pauseMenuBrowser.execute(`updateQuests('${cachedQuestData}')`);
        mp.gui.cursor.show(true, true);
        mp.game.graphics.transitionToBlurred(500);
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

mp.events.add('client:pauseMenuAction', (action) => {
    switch(action) {
        case 'map':
            mp.events.call('client:togglePauseMenu', true); // Force Close
            mp.game.ui.activateFrontendMenu(mp.game.joaat("FE_MENU_VERSION_MP_PAUSE"), false, -1);
            isMapOpen = true; // [Fix] Start watching for map close
            break;
        case 'jobs':
            mp.events.call('client:togglePauseMenu', true); // Force Close
            mp.events.call('client:openJobMenu');
            break;
        case 'quests':
            mp.events.call('client:togglePauseMenu', true); // Force Close
            mp.events.call('client:toggleQuestMenu');
            break;
        // [MODIFIED] Removed 'resume' and 'quit' cases
    }
});

mp.events.add('client:requestQuestData', () => {
    mp.events.callRemote('server:getQuestData');
});

mp.events.add('render', () => {
    if (isMapOpen) {
        // If the native pause menu is NO LONGER active
        if (!mp.game.ui.isPauseMenuActive()) {
            isMapOpen = false;
            // Force reopen our custom menu
            mp.events.call('client:togglePauseMenu', true);
        }
    }
});