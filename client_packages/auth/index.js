// client_packages/auth/index.js

let authBrowser   = null;
let authCam       = null;
let isAuthOpen    = false;

// ── Open Auth Screen ──────────────────────────────────────────────────────────

mp.events.add('client:auth:show', (recentJson) => {
    if (authBrowser) return;
    isAuthOpen = true;

    authBrowser = mp.browsers.new('package://ui/auth/index.html');

    mp.gui.cursor.show(true, true);
    mp.gui.chat.show(false);
    mp.game.ui.displayRadar(false);
    mp.game.ui.displayHud(false);
    mp.players.local.freezePosition(true);
    mp.players.local.setVisible(false, false);

    // Wait for Vue to mount, then send recent accounts.
    // recentJson is already a JSON string — embed it directly as a JS literal
    // (JSON is valid JS, no quote-injection risk).
    setTimeout(() => {
        if (authBrowser) {
            authBrowser.execute(`window.loadRecent(${recentJson});`);
        }
    }, 200);
});

// ── Disable Game Controls ─────────────────────────────────────────────────────

mp.events.add('render', () => {
    if (isAuthOpen) {
        mp.game.controls.disableAllControlActions(0);
        if (!mp.gui.cursor.visible) mp.gui.cursor.show(true, true);
    }
});

// ── CEF → Client → Server Relay ──────────────────────────────────────────────

mp.events.add('client:auth:login', (user, pass) => {
    mp.events.callRemote('server:auth:login', user, pass);
});

mp.events.add('client:auth:register', (user, pass) => {
    mp.events.callRemote('server:auth:register', user, pass);
});

mp.events.add('client:auth:tryAutoLogin', (user) => {
    mp.events.callRemote('server:auth:autoLogin', user);
});

// ── Server → CEF ─────────────────────────────────────────────────────────────

mp.events.add('client:auth:error', (msg) => {
    if (!authBrowser) return;
    // JSON.stringify safely escapes any quotes/special chars in msg.
    // Previously this was: `showError('${msg}')` which broke on apostrophes.
    authBrowser.execute(`window.showError(${JSON.stringify(msg)});`);
});

mp.events.add('client:auth:destroy', () => {
    isAuthOpen = false;
    if (authBrowser) { authBrowser.destroy(); authBrowser = null; }
    if (authCam)     { authCam.destroy();     authCam = null;     }
});

mp.events.add('client:auth:success', (shouldSpawnSelector, lastPos) => {
    isAuthOpen = false;

    if (authBrowser) { authBrowser.destroy(); authBrowser = null; }

    if (shouldSpawnSelector) {
        // Hand off to spawn selector — radar stays hidden until spawn confirms
        mp.gui.cursor.show(false, false);
        mp.events.call('client:spawn:openMenu', lastPos);
    } else {
        // Auto-spawn at last location — re-enable everything now
        mp.gui.cursor.show(false, false);

        const player = mp.players.local;
        player.freezePosition(false);
        player.setVisible(true, false);
        player.setAlpha(255);
        player.setInvincible(false);

        mp.game.ui.displayRadar(true);
        mp.game.ui.displayHud(true);
        mp.game.cam.renderScriptCams(false, false, 0, true, false);
    }
});
