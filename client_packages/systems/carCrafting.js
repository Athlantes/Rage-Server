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

const CHUNK_SIZE = 20;

function toBase64(str) {
    // Node.js Buffer-based base64 (available in RAGEMP client scripts)
    return Buffer.from(str).toString('base64');
}

function sendDataToUI() {
    if (!craftingBrowser || !pendingRecipes || !pendingInfo) return;

    const recipes = JSON.parse(pendingRecipes);
    const chunks  = [];
    for (let i = 0; i < recipes.length; i += CHUNK_SIZE) {
        chunks.push(recipes.slice(i, i + CHUNK_SIZE));
    }

    // Step 1: tell the page how many chunks are coming and pass playerInfo
    const infoB64 = toBase64(pendingInfo);
    craftingBrowser.execute('startCraftLoad(' + chunks.length + ', "' + infoB64 + '");');

    // Step 2: send each chunk — each call is ~8KB, safe under the CEF execute limit
    for (let i = 0; i < chunks.length; i++) {
        const chunkB64 = toBase64(JSON.stringify(chunks[i]));
        craftingBrowser.execute('receiveCraftChunk("' + chunkB64 + '");');
    }
}

mp.events.add('client:crafting:close', () => {
    if (craftingBrowser) {
        craftingBrowser.destroy();
        craftingBrowser = null;
    }
    pendingRecipes = null;
    pendingInfo    = null;
    mp.gui.cursor.show(false, false);
});

mp.events.add('client:crafting:tryCraft', (recipeId, useBoost) => {
    mp.events.callRemote('server:crafting:craft', recipeId, useBoost);
});

mp.events.add('client:crafting:result', (success, message) => {
    if (craftingBrowser) {
        craftingBrowser.execute("showResult(" + success + ", '" + message.replace(/'/g, "\\'") + "');");
    }
    if (success) mp.game.audio.playSoundFrontend(-1, "Hack_Success", "DLC_HEIST_BIOLAB_PREP_HACKING_SOUNDS", true);
    else         mp.game.audio.playSoundFrontend(-1, "Hack_Failed",  "DLC_HEIST_BIOLAB_PREP_HACKING_SOUNDS", true);
});
