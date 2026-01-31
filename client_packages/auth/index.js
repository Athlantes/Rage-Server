// client_packages/auth/index.js
let authBrowser = null;
let authCam = null;
let isAuthOpen = false; // Track state

// --- 1. SETUP CAMERA & UI ---
mp.events.add('client:auth:show', (recentJson) => {
    if (authBrowser) return;
    isAuthOpen = true;
    
    // 2. Create Browser
    authBrowser = mp.browsers.new("package://ui/auth/index.html");
    
    // 3. LOCK INPUTS & SHOW CURSOR
    mp.gui.cursor.show(true, true);       // Show cursor
    mp.gui.chat.show(false);              // Hide chat to prevent conflict
    mp.game.ui.displayRadar(false);
    mp.game.ui.displayHud(false);
    
    mp.players.local.freezePosition(true);
    mp.players.local.setVisible(false, false);

    // 4. Load Recent Data
    setTimeout(() => {
        if(authBrowser) authBrowser.execute(`loadRecent('${recentJson}')`);
    }, 200);
});

// --- 2. DISABLE GAME CONTROLS LOOP ---
// This runs every frame to ensure you cannot move/look while logging in
mp.events.add('render', () => {
    if (isAuthOpen) {
        // Disable all controls (Movement, combat, looking, pause menu, etc)
        mp.game.controls.disableAllControlActions(0);
        
        // Optionally enable cursor again if it gets lost
        if (!mp.gui.cursor.visible) mp.gui.cursor.show(true, true);
    }
});

// --- 3. AUTH ACTIONS ---
mp.events.add('client:auth:login', (user, pass) => {
    mp.events.callRemote('server:auth:login', user, pass);
});

mp.events.add('client:auth:register', (user, pass) => {
    mp.events.callRemote('server:auth:register', user, pass);
});

mp.events.add('client:auth:tryAutoLogin', (user) => {
    mp.events.callRemote('server:auth:autoLogin', user);
});

// --- 4. SERVER RESPONSES ---
mp.events.add('client:auth:error', (msg) => {
    if(authBrowser) authBrowser.execute(`showError('${msg}')`);
});

mp.events.add('client:auth:success', () => {
    isAuthOpen = false; // Stop the control disable loop

    // Cleanup Browser
    if (authBrowser) {
        authBrowser.destroy();
        authBrowser = null;
    }
    
    // Reset Camera
    mp.game.cam.renderScriptCams(false, true, 2000, true, false);
    if(authCam) authCam.destroy();

    // Reset Player & UI
    mp.gui.cursor.show(false, false);
    mp.gui.chat.show(true);  // Re-enable chat
    mp.game.ui.displayRadar(true);
    mp.game.ui.displayHud(true);
    mp.players.local.freezePosition(false);
    mp.players.local.setVisible(true, true);
});