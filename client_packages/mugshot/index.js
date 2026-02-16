// client_packages/mugshot/index.js
let pedHeadShot;
let screenResolution  = false;
let takingScreenshot  = false;
let headshotTexture   = false;
let screenshotBrowser = false;
let frameCount        = 0;
let pendingCapture    = false;

// ── Server trigger ────────────────────────────────────────────────────────────
mp.events.add('client:mugshot:capture', () => {
    pendingCapture = true;
    // Fallback for auto-spawn path (no spawn selector shown)
    setTimeout(() => {
        if (pendingCapture) {
            pendingCapture = false;
            mp.events.call('prepareScreenshot');
        }
    }, 3500);
});

// ── After spawn selector confirm ──────────────────────────────────────────────
// client:spawn:select is where setVisible(true) + freezePosition(false) happen.
mp.events.add('client:spawn:select', () => {
    if (!pendingCapture) return;
    pendingCapture = false;
    setTimeout(() => {
        mp.events.call('prepareScreenshot');
    }, 3000);
});

// ── Core capture logic ────────────────────────────────────────────────────────
mp.events.add('prepareScreenshot', () => {
    pedHeadShot      = mp.players.local.registerheadshot();
    const res        = mp.game.graphics.getScreenActiveResolution(100, 100);
    screenResolution = JSON.stringify(res);

    setTimeout(() => {
        if (
            mp.game.ped.isPedheadshotValid(pedHeadShot) &&
            mp.game.ped.isPedheadshotReady(pedHeadShot)
        ) {
            headshotTexture  = mp.game.ped.getPedheadshotTxdString(pedHeadShot);
            frameCount       = 0;
            takingScreenshot = true;
        } else {
            mp.players.local.unregisterheadshot(pedHeadShot);
            console.warn('[Mugshot] Headshot not ready, aborting capture.');
        }
    }, 2000);
});

// ── Render loop — draw sprite for 1 frame then take screenshot ────────────────
mp.events.add('render', () => {
    if (!takingScreenshot) return;

    mp.game.graphics.drawSprite(
        headshotTexture, headshotTexture,
        0.045, 0.085, 0.10, 0.18,
        0.0, 255, 255, 255, 1000
    );

    if (frameCount === 1) {
        mp.gui.takeScreenshot('player_headshot.jpg', 0, 100, 0);
        takingScreenshot = false;
        mp.players.local.unregisterheadshot(pedHeadShot);

        // Wait for takeScreenshot to finish writing to disk before opening browser.
        // capture.html will also retry up to 10x every 500ms if the file isn't ready yet.
        setTimeout(() => {
            mp.events.call('playerheadshot_taken');
        }, 2000);
    }
    frameCount++;
});

// ── Browser reads the file and converts to base64 ────────────────────────────
mp.events.add('playerheadshot_taken', () => {
    screenshotBrowser = mp.browsers.new('package://mugshot/capture.html');
});

mp.events.add('browserDomReady', (browser) => {
    if (browser !== screenshotBrowser) return;
    screenshotBrowser.call('recieveHeadshotImage', 'http://screenshots/player_headshot.jpg', screenResolution);
});

mp.events.add('uploadHeadshot', (base64) => {
    mp.events.callRemote('uploadPlayerHeadshot', base64);
    if (screenshotBrowser) {
        screenshotBrowser.destroy();
        screenshotBrowser = false;
    }
});

// Server confirms saved — silent
mp.events.add('client:mugshot:saved', () => {
    console.log('[Mugshot] Mugshot saved successfully.');
});
