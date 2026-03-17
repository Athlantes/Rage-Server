let craftingBrowser = null;

// ── Chunk accumulator ──────────────────────────────────────────────────────
let _chunksExpected = 0;
let _chunksReceived = 0;
let _recipesAccum   = [];
let _playerInfo     = null;

// Server sends this first: total number of recipe chunks + playerInfo JSON
mp.events.add('client:crafting:start', (totalChunks, playerInfoJson) => {
    _chunksExpected = totalChunks;
    _chunksReceived = 0;
    _recipesAccum   = [];
    _playerInfo     = JSON.parse(playerInfoJson);

    if (!craftingBrowser) {
        craftingBrowser = mp.browsers.new('package://ui/carCrafting/index.html');
        mp.gui.cursor.show(true, true);
    }
    // If browser already open, chunks will arrive and fire UI on last chunk
});

// Server sends one of these per chunk of recipes
mp.events.add('client:crafting:chunk', (chunkJson) => {
    const chunk = JSON.parse(chunkJson);
    _recipesAccum = _recipesAccum.concat(chunk);
    _chunksReceived++;

    if (_chunksReceived >= _chunksExpected) {
        // All chunks received — push to UI
        sendDataToUI();
    }
});

function sendDataToUI() {
    if (!craftingBrowser || !_playerInfo || _recipesAccum.length === 0) return;

    // Safe to send: each piece is tiny, no size limit issues
    const safeRecipes = encodeURIComponent(JSON.stringify(_recipesAccum));
    const safeInfo    = encodeURIComponent(JSON.stringify(_playerInfo));

    craftingBrowser.execute(
        'initCrafting(' +
        'JSON.parse(decodeURIComponent("' + safeRecipes + '")),' +
        'JSON.parse(decodeURIComponent("' + safeInfo + '")));'
    );
}

// Page signals it's ready (handles the case where browser finishes loading
// after all chunks already arrived)
mp.events.add('client:crafting:ready', () => {
    if (_chunksReceived >= _chunksExpected && _chunksExpected > 0) {
        sendDataToUI();
    }
});

mp.events.add('client:crafting:close', () => {
    if (craftingBrowser) {
        craftingBrowser.destroy();
        craftingBrowser = null;
    }
    _chunksExpected = 0;
    _chunksReceived = 0;
    _recipesAccum   = [];
    _playerInfo     = null;
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
