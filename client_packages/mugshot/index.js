// client_packages/mugshot/index.js
let pedHeadShot;
let screenResolution  = false;
let takingScreenshot  = false;
let headshotTexture   = false;
let screenshotBrowser = false;
let frameCount        = 0;
let pendingCapture    = false;
let mugshotFilename   = 'mugshot_headshot.jpg';

const DBG = (...args) => console.log('[Mugshot]', ...args);
const ERR = (...args) => console.error('[Mugshot][ERROR]', ...args);

// ── Server trigger ────────────────────────────────────────────────────────────
mp.events.add('client:mugshot:capture', () => {
    DBG('>> client:mugshot:capture received — pendingCapture=true, waiting 3500ms for spawn select...');
    pendingCapture = true;
    setTimeout(() => {
        if (pendingCapture) {
            DBG('Timeout elapsed, spawn:select never fired — calling prepareScreenshot now');
            pendingCapture = false;
            mp.events.call('prepareScreenshot');
        }
    }, 3500);
});

mp.events.add('client:spawn:select', () => {
    if (!pendingCapture) return;
    DBG('>> client:spawn:select fired with pendingCapture=true — waiting 3000ms then calling prepareScreenshot');
    pendingCapture = false;
    setTimeout(() => {
        mp.events.call('prepareScreenshot');
    }, 3000);
});

// ── Core capture logic ────────────────────────────────────────────────────────
mp.events.add('prepareScreenshot', () => {
    DBG('>> prepareScreenshot — calling registerheadshot...');
    pedHeadShot      = mp.players.local.registerheadshot();
    const res        = mp.game.graphics.getScreenActiveResolution(100, 100);
    screenResolution = JSON.stringify(res);
    DBG(`Screen resolution: ${screenResolution} | headshot handle: ${pedHeadShot}`);

    setTimeout(() => {
        const valid = mp.game.ped.isPedheadshotValid(pedHeadShot);
        const ready = mp.game.ped.isPedheadshotReady(pedHeadShot);
        DBG(`Headshot check (attempt 1) — valid=${valid} ready=${ready}`);

        if (valid && ready) {
            headshotTexture  = mp.game.ped.getPedheadshotTxdString(pedHeadShot);
            DBG(`Headshot texture: "${headshotTexture}" — starting render loop`);
            frameCount       = 0;
            takingScreenshot = true;
        } else {
            DBG('Not ready yet, retrying in 1500ms...');
            setTimeout(() => {
                const v2 = mp.game.ped.isPedheadshotValid(pedHeadShot);
                const r2 = mp.game.ped.isPedheadshotReady(pedHeadShot);
                DBG(`Headshot check (attempt 2) — valid=${v2} ready=${r2}`);

                if (v2 && r2) {
                    headshotTexture  = mp.game.ped.getPedheadshotTxdString(pedHeadShot);
                    DBG(`Headshot texture (retry): "${headshotTexture}" — starting render loop`);
                    frameCount       = 0;
                    takingScreenshot = true;
                } else {
                    mp.players.local.unregisterheadshot(pedHeadShot);
                    ERR('Headshot texture not ready after both retries. Aborting.');
                }
            }, 1500);
        }
    }, 2000);
});

// ── Render loop ───────────────────────────────────────────────────────────────
mp.events.add('render', () => {
    if (!takingScreenshot) return;

    // Draw the headshot sprite every frame so it's visible on screen
    mp.game.graphics.drawSprite(
        headshotTexture, headshotTexture,
        0.045, 0.085, 0.10, 0.18,
        0.0, 255, 255, 255, 1000
    );

    // Log when the loop first starts running
    if (frameCount === 0) {
        DBG('Render loop started — drawing headshot sprite...');
    }

    // Frame 15: sprite has been on screen long enough — schedule screenshot.
    // IMPORTANT: mp.gui.takeScreenshot must NOT be called directly inside render.
    // It must be deferred via setTimeout so it executes outside the render callback.
    if (frameCount === 15) {
        DBG(`Frame 15 — scheduling takeScreenshot via setTimeout (filename="${mugshotFilename}")`);
        setTimeout(() => {
            DBG(`takeScreenshot firing now for "${mugshotFilename}"`);
            mp.gui.takeScreenshot(mugshotFilename, 0, 100, 0);

            // Give the engine time to flush the file to disk, then open the processor
            setTimeout(() => {
                DBG('File flush wait done — stopping render loop and firing playerheadshot_taken');
                takingScreenshot = false;
                mp.players.local.unregisterheadshot(pedHeadShot);
                mp.events.call('playerheadshot_taken');
            }, 3000);
        }, 0);
    }

    frameCount++;
});

mp.events.add('playerheadshot_taken', () => {
    DBG('>> playerheadshot_taken — creating capture browser (package://mugshot/capture.html)');
    if (screenshotBrowser) {
        DBG('Destroying stale screenshotBrowser from previous run');
        screenshotBrowser.destroy();
        screenshotBrowser = false;
    }
    screenshotBrowser = mp.browsers.new('package://mugshot/capture.html');
    DBG('capture.html browser created — waiting for browserDomReady...');
});

mp.events.add('browserDomReady', (browser) => {
    if (browser !== screenshotBrowser) return;
    const url = 'http://screenshots/' + mugshotFilename;
    DBG(`>> browserDomReady — calling recieveHeadshotImage | url="${url}" | res=${screenResolution}`);
    screenshotBrowser.call('recieveHeadshotImage', url, screenResolution);
});

// ── CEF → Client log bridge (capture.html can't console.log directly) ────────
mp.events.add('client:mugshot:log', (msg) => {
    console.log(msg);
});

// ── CHUNK BRIDGES (Browser -> Client -> Server) ──────────────────────────────
mp.events.add('client:mugshot:startUpload', (totalChunks) => {
    DBG(`>> client:mugshot:startUpload — totalChunks=${totalChunks} — forwarding to server`);
    mp.events.callRemote('server:mugshot:initUpload', totalChunks);
});

mp.events.add('client:mugshot:sendChunk', (chunk, index) => {
    // Only log every 10th chunk to avoid spam
    if (index % 10 === 0) DBG(`Forwarding chunk #${index} (${chunk.length} bytes) to server`);
    mp.events.callRemote('server:mugshot:receiveChunk', chunk, index);
});

mp.events.add('client:mugshot:uploadComplete', () => {
    DBG('>> client:mugshot:uploadComplete — all chunks sent to server, awaiting client:mugshot:saved...');
});

// ── Server confirms save ──────────────────────────────────────────────────────
mp.events.add('client:mugshot:saved', () => {
    DBG('>> client:mugshot:saved received from server — destroying capture browser');
    if (screenshotBrowser) {
        screenshotBrowser.destroy();
        screenshotBrowser = false;
    }
    DBG('Pipeline complete. Mugshot saved successfully.');
});