// client_packages/auth/index.js
let authBrowser = null;
let authCam = null;
let isAuthOpen = false;

// --- 1. SETUP CAMERA & UI ---
mp.events.add('client:auth:show', (recentJson) => {
    if (authBrowser) return;
    isAuthOpen = true;
    
    authBrowser = mp.browsers.new("package://ui/auth/index.html");
    
    mp.gui.cursor.show(true, true);
    mp.gui.chat.show(false);
    
    // THIS DISABLES THE MAP. WE MUST RE-ENABLE IT LATER.
    mp.game.ui.displayRadar(false);
    mp.game.ui.displayHud(false);
    
    mp.players.local.freezePosition(true);
    mp.players.local.setVisible(false, false);

    setTimeout(() => {
        if(authBrowser) authBrowser.execute(`loadRecent('${recentJson}')`);
    }, 200);
});

// --- 2. DISABLE GAME CONTROLS LOOP ---
mp.events.add('render', () => {
    if (isAuthOpen) {
        mp.game.controls.disableAllControlActions(0);
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

mp.events.add('client:auth:destroy', () => {
    isAuthOpen = false;
    if (authBrowser) {
        authBrowser.destroy();
        authBrowser = null;
    }
    if (authCam) {
        authCam.destroy();
        authCam = null;
    }
});

mp.events.add('client:auth:success', (shouldSpawnSelector, lastPos) => {
    isAuthOpen = false; 

    // 1. Destroy Login Browser
    if (authBrowser) {
        authBrowser.destroy();
        authBrowser = null;
    }

    // 2. Logic Split
    if (shouldSpawnSelector) {
        // Case A: Going to Spawn Selector
        // We DON'T enable Radar yet, because we want the clean spawn menu.
        // The Radar must be enabled in client_packages/ui/spawn/index.js
        mp.gui.cursor.show(false, false);
        mp.events.call('client:spawn:openMenu', lastPos);
    } else {
        // Case B: Auto-Spawn (Last Location)
        // [FIX] WE MUST ENABLE RADAR/HUD HERE
        mp.gui.cursor.show(false, false);

        const player = mp.players.local;
        player.freezePosition(false);
        player.setVisible(true, false);
        player.setAlpha(255);
        player.setInvincible(false);

        // --- ENABLE UI HERE ---
        mp.game.ui.displayRadar(true);
        mp.game.ui.displayHud(true);
        // ----------------------

        mp.game.cam.renderScriptCams(false, false, 0, true, false);
    }
});