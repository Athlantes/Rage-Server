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
    setTimeout(() => {
        if (pendingCapture) {
            pendingCapture = false;
            mp.events.call('prepareScreenshot');
        }
    }, 3500);
});

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
        if (mp.game.ped.isPedheadshotValid(pedHeadShot) && mp.game.ped.isPedheadshotReady(pedHeadShot)) {
            headshotTexture  = mp.game.ped.getPedheadshotTxdString(pedHeadShot);
            frameCount       = 0;
            takingScreenshot = true;
        } else {
            mp.players.local.unregisterheadshot(pedHeadShot);
        }
    }, 2000);
});

// ── Render loop (Increased to 15 frames for stability) ────────────────────────
mp.events.add('render', () => {
    if (!takingScreenshot) return;

    mp.game.graphics.drawSprite(
        headshotTexture, headshotTexture,
        0.045, 0.085, 0.10, 0.18,
        0.0, 255, 255, 255, 1000
    );

    if (frameCount === 15) {
        mp.gui.takeScreenshot('player_headshot.jpg', 0, 100, 0);
    }
    
    if (frameCount >= 16) {
        takingScreenshot = false;
        mp.players.local.unregisterheadshot(pedHeadShot);

        setTimeout(() => {
            mp.events.call('playerheadshot_taken');
        }, 2000);
    }
    frameCount++;
});

mp.events.add('playerheadshot_taken', () => {
    screenshotBrowser = mp.browsers.new('package://mugshot/capture.html');
});

mp.events.add('browserDomReady', (browser) => {
    if (browser !== screenshotBrowser) return;
    screenshotBrowser.call('recieveHeadshotImage', 'http://screenshots/player_headshot.jpg', screenResolution);
});

// ── CHUNK BRIDGES (Browser -> Client -> Server) ──────────────────────────────
mp.events.add('client:mugshot:startUpload', (totalChunks) => {
    mp.events.callRemote('server:mugshot:initUpload', totalChunks);
});

mp.events.add('client:mugshot:sendChunk', (chunk, index) => {
    mp.events.callRemote('server:mugshot:receiveChunk', chunk, index);
});

mp.events.add('client:mugshot:saved', () => {
    if (screenshotBrowser) {
        screenshotBrowser.destroy();
        screenshotBrowser = false;
    }
    console.log('[Mugshot] Saved successfully.');
});