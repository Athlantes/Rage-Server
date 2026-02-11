let craftingBrowser = null;

mp.events.add('client:crafting:open', (recipesJson, playerInfoJson) => {
    if (!craftingBrowser) {
        craftingBrowser = mp.browsers.new('package://ui/carCrafting/index.html');
        mp.gui.cursor.show(true, true);
        setTimeout(() => {
            if (craftingBrowser) craftingBrowser.execute(`initCrafting(${recipesJson}, ${playerInfoJson});`);
        }, 150);
    } else {
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

// Pass boost boolean to server
mp.events.add('client:crafting:tryCraft', (recipeId, useBoost) => {
    mp.events.callRemote('server:crafting:craft', recipeId, useBoost);
});

// Play sound/effect based on result
mp.events.add('client:crafting:result', (success, message) => {
    if (craftingBrowser) {
        craftingBrowser.execute(`showResult(${success}, '${message.replace(/'/g, "\\'")}');`);
    }
    if (success) mp.game.audio.playSoundFrontend(-1, "Hack_Success", "DLC_HEIST_BIOLAB_PREP_HACKING_SOUNDS", true);
    else mp.game.audio.playSoundFrontend(-1, "Hack_Failed", "DLC_HEIST_BIOLAB_PREP_HACKING_SOUNDS", true);
});