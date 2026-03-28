/**
 * ============================================================================
 * TRUCKER JOB - CLIENT SIDE
 * Handles CEF communication and trailer hookup detection
 * ============================================================================
 */

let truckerBoardOpen = false;
let truckerBrowser = null;

/**
 * Open the trucker contract board
 * @param {string} dataJson - JSON string with routes and player info
 */
mp.events.add('client:trucker:openBoard', (dataJson) => {
    if (truckerBoardOpen) return;

    const data = JSON.parse(dataJson);

    // Create CEF browser if it doesn't exist
    if (!truckerBrowser) {
        truckerBrowser = mp.browsers.new('package://ui/trucker/index.html');
    }

    truckerBoardOpen = true;
    
    // Show cursor and disable controls
    mp.gui.cursor.visible = true;
    mp.game.ui.displayRadar(false);

    // Wait for CEF to be ready, then send data
    setTimeout(() => {
        if (truckerBrowser) {
            truckerBrowser.execute(`initBoard(${JSON.stringify(data)})`);
        }
    }, 100);
});

/**
 * Close the trucker contract board
 */
mp.events.add('client:trucker:closeBoard', () => {
    if (!truckerBoardOpen) return;

    truckerBoardOpen = false;
    mp.gui.cursor.visible = false;
    mp.game.ui.displayRadar(true);

    if (truckerBrowser) {
        truckerBrowser.execute('closeBoard()');
    }
});

/**
 * CEF calls this when player selects a contract
 */
mp.events.add('cef:trucker:selectContract', (routeId) => {
    // Close the board
    mp.events.call('client:trucker:closeBoard');
    
    // Tell server
    mp.events.callRemote('server:trucker:selectContract', routeId);
});

/**
 * CEF calls this when player closes the board
 */
mp.events.add('cef:trucker:closeBoard', () => {
    mp.events.call('client:trucker:closeBoard');
});

// ============================================================================
// TRAILER HOOKUP DETECTION
// ============================================================================

/**
 * Server asks us to check if trailer is hooked
 * This is called repeatedly while player is in pickup zone
 */
mp.events.add('client:trucker:checkTrailerHookup', () => {
    const player = mp.players.local;
    const vehicle = player.vehicle;

    if (!vehicle) return;

    // Check if vehicle has a trailer attached
    // RAGE:MP/GTA V native: vehicle.getTrailer()
    const trailer = vehicle.getTrailer();
    
    if (trailer && trailer !== 0) {
        // Trailer is attached! Tell server
        mp.events.callRemote('server:trucker:trailerHooked');
    }
});

// ============================================================================
// COUNTDOWN TIMERS (LOADING/UNLOADING)
// ============================================================================

/**
 * Update loading countdown (Lvl 1-19 only)
 */
mp.events.add('client:trucker:updateLoadingTimer', (secondsLeft) => {
});

/**
 * Update unloading countdown
 */
mp.events.add('client:trucker:updateUnloadingTimer', (secondsLeft) => {
});

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Clean up when player disconnects or changes character
 */
mp.events.add('playerQuit', () => {
    if (truckerBrowser) {
        truckerBrowser.destroy();
        truckerBrowser = null;
    }
    truckerBoardOpen = false;
    mp.gui.cursor.visible = false;
});