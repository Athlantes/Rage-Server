let craftingBrowser = null;
let pendingRecipes = null, pendingInfo = null;

mp.events.add('client:crafting:open', (recipesJson, playerInfoJson) => {
    pendingRecipes = recipesJson;
    pendingInfo    = playerInfoJson;
    
    if (!craftingBrowser) {
        craftingBrowser = mp.browsers.new('package://ui/carCrafting/index.html');
        mp.gui.cursor.show(true, true);
    } else {
        sendDataToUI();
    }
});

mp.events.add('client:crafting:ready', () => {
    sendDataToUI();
});

function sendDataToUI() {
    if (craftingBrowser && pendingRecipes && pendingInfo) {
        // Safely encode the JSON to prevent CEF syntax errors when evaluating strings
        let safeRecipes = encodeURIComponent(pendingRecipes);
        let safeInfo = encodeURIComponent(pendingInfo);
        
        craftingBrowser.execute(`
            var decodedRecipes = JSON.parse(decodeURIComponent("${safeRecipes}"));
            var decodedInfo = JSON.parse(decodeURIComponent("${safeInfo}"));
            initCrafting(decodedRecipes, decodedInfo);
        `);
    }
}

mp.events.add('client:crafting:close', () => {
    if (craftingBrowser) {
        craftingBrowser.destroy();
        craftingBrowser = null;
    }
    mp.gui.cursor.show(false, false);
});

mp.events.add('client:crafting:tryCraft', (recipeId, useBoost) => {
    mp.events.callRemote('server:crafting:craft', recipeId, useBoost);
});

mp.events.add('client:crafting:result', (success, message) => {
    if (craftingBrowser) {
        craftingBrowser.execute(`showResult(${success}, '${message.replace(/'/g, "\\'")}');`);
    }
    if (success) mp.game.audio.playSoundFrontend(-1, "Hack_Success", "DLC_HEIST_BIOLAB_PREP_HACKING_SOUNDS", true);
    else mp.game.audio.playSoundFrontend(-1, "Hack_Failed", "DLC_HEIST_BIOLAB_PREP_HACKING_SOUNDS", true);
});