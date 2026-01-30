let pauseMenuBrowser = null;
let isPauseMenuOpen = false;
let lastToggleTime = 0;
let isMapOpen = false; // [Fix] Track if we sent player to map
let mapBrowser = null;

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
    if (action === 'map') {
        mp.events.call('client:togglePauseMenu', true); // Close pause menu
        
        if (!mapBrowser) {
            mapBrowser = mp.browsers.new("package://ui/WebMap/index.html");
            mp.gui.cursor.show(true, true);
            
            // Sync current game data to web map
            const blips = [];
            mp.blips.forEach(b => {
                blips.push({ x: b.position.x, y: b.position.y, name: b.getName() || "Marker" });
            });
            
            const player = {
                x: mp.players.local.position.x,
                y: mp.players.local.position.y,
                angle: mp.players.local.getHeading()
            };

            setTimeout(() => {
                if(mapBrowser) mapBrowser.execute(`initializeMapData('${JSON.stringify(blips)}', '${JSON.stringify(player)}')`);
            }, 250);
        }
    } else
    switch(action) {
        case 'jobs':
            mp.events.call('client:togglePauseMenu', true);
            mp.events.call('client:openJobMenu');
            break;
        case 'quests':
            mp.events.call('client:togglePauseMenu', true);
            mp.events.call('client:toggleQuestMenu');
            break;
        case 'resume':
            mp.events.call('client:togglePauseMenu', false);
            break;
        case 'quit':
            mp.events.callRemote('server:kickPlayer');
            break;
    }
});

mp.events.add('client:requestQuestData', () => {
    mp.events.callRemote('server:getQuestData');
});

// --- NEW MAP FUNCTIONS ---

// Function to close the map (called from Web JS)
mp.events.add('client:closeMap', () => {
    if (mapBrowser) {
        mapBrowser.destroy();
        mapBrowser = null;
        mp.gui.cursor.show(false, false);
        // Optional: Re-open pause menu if you want "Back" to go to menu
        // mp.events.call('client:togglePauseMenu', false); 
    }
});

// Function to set Waypoint (called from Web JS)
mp.events.add('client:setMapWaypoint', (x, y) => {
    mp.game.ui.setNewWaypoint(parseFloat(x), parseFloat(y));
});

// Helper to gather Blips and send to Web
function loadGameBlipsToWeb() {
    if (!mapBrowser) return;

    let blipList = [];
    mp.blips.forEach(blip => {
        // We only send necessary data to keep it fast
        blipList.push({
            x: blip.position.x,
            y: blip.position.y,
            name: blip.getName() || "Unknown",
            sprite: blip.getSprite(), // The icon ID
            color: blip.getColour()
        });
    });

    // Send player position too for "You are here"
    const playerPos = mp.players.local.position;
    const playerData = { x: playerPos.x, y: playerPos.y, angle: mp.players.local.getHeading() };

    // Execute JS on the web page
    mapBrowser.execute(`initializeMapData('${JSON.stringify(blipList)}', '${JSON.stringify(playerData)}')`);
}

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