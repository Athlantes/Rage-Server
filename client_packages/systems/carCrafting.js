let craftingBrowser = null;

mp.events.add('client:crafting:open', (recipesJson, playerInfoJson) => {
    // 1. If browser does NOT exist, create it and initialize
    if (!craftingBrowser) {
        craftingBrowser = mp.browsers.new('package://ui/carCrafting/index.html');
        mp.gui.cursor.show(true, true);
        
        // Wait for DOM to load before sending initial data
        setTimeout(() => {
            if (craftingBrowser) {
                craftingBrowser.execute(`initCrafting(${recipesJson}, ${playerInfoJson});`);
            }
        }, 150);
    } 
    else {
        craftingBrowser.execute(`initCrafting(${recipesJson}, ${playerInfoJson});`);
    }
});

mp.events.add('client:crafting:close', () => {
    if (craftingBrowser) {
        craftingBrowser.destroy();
        craftingBrowser = null;
    }
    mp.gui.cursor.show(false, false);
});

// Event triggered from UI to request crafting
mp.events.add('client:crafting:tryCraft', (recipeId) => {
    mp.events.callRemote('server:crafting:craft', recipeId);
});