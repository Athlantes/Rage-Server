// client_packages/mugshot/index.js
let pedHeadShot;
let screenResolution  = false;
let takingScreenshot  = false;
let headshotTexture   = false;
let screenshotBrowser = false;
let frameCount        = 0;
let pendingCapture    = false;
let mugshotFilename   = 'mugshot_temp.jpg'; 
let headScreenPos     = { x: 0, y: 0 }; // Store head coordinates

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
    pedHeadShot = mp.players.local.registerheadshot();
    
    // 2. Get screen resolution
    const res = mp.game.graphics.getScreenActiveResolution(0, 0);
    screenResolution = JSON.stringify(res);

    // 3. Calculate Head Position for Cropping
    let headPos = mp.players.local.getBoneCoords(12844, 0, 0, 0); // Head Bone
    let screenPos = mp.game.graphics.world3dToScreen2d(headPos);
    
    // Save normalized (0.0-1.0) coordinates to use later
    if (screenPos) {
        headScreenPos = { x: screenPos.x, y: screenPos.y };
    } else {
        headScreenPos = { x: 0.5, y: 0.5 }; // Fallback to center
    }

    DBG(`Screen res: ${screenResolution} | Head Screen Pos: ${JSON.stringify(headScreenPos)}`);

    setTimeout(() => {
        // ... (Keep your existing validation logic here, it is fine) ...
        const valid = mp.game.ped.isPedheadshotValid(pedHeadShot);
        const ready = mp.game.ped.isPedheadshotReady(pedHeadShot);

        if (valid && ready) {
            headshotTexture = mp.game.ped.getPedheadshotTxdString(pedHeadShot);
            frameCount = 0;
            takingScreenshot = true;
        } else {
            // ... (Keep your retry logic here) ...
             setTimeout(() => {
                const v2 = mp.game.ped.isPedheadshotValid(pedHeadShot);
                const r2 = mp.game.ped.isPedheadshotReady(pedHeadShot);
                if (v2 && r2) {
                    headshotTexture = mp.game.ped.getPedheadshotTxdString(pedHeadShot);
                    frameCount = 0;
                    takingScreenshot = true;
                } else {
                    mp.players.local.unregisterheadshot(pedHeadShot);
                    ERR('Headshot texture not ready. Aborting.');
                }
            }, 1500);
        }
    }, 2000);
});

// ── Render loop ───────────────────────────────────────────────────────────────
mp.events.add('render', () => {
    if (!takingScreenshot) return;

    mp.game.graphics.drawSprite(
        headshotTexture, headshotTexture,
        0.045, 0.085, 0.10, 0.18,
        0.0, 255, 255, 255, 1000
    );

    if (frameCount === 15) {
        setTimeout(() => {
            // Take the full screenshot locally
            mp.gui.takeScreenshot(mugshotFilename, 1, 100, 0); // 1 = PNG (better quality)

            setTimeout(() => {
                takingScreenshot = false;
                mp.players.local.unregisterheadshot(pedHeadShot);
                mp.events.call('playerheadshot_taken');
            }, 2000); // 2 seconds is usually enough
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
    
    // RAGE:MP allows accessing screenshots via this virtual URL
    const url = 'http://screenshots/' + mugshotFilename;
    
    DBG(`>> browserDomReady — Sending to CEF. Crop X:${headScreenPos.x} Y:${headScreenPos.y}`);
    
    // 4. Pass the Head Position to the browser
    screenshotBrowser.execute(`recieveHeadshotImage('${url}', '${screenResolution}', ${headScreenPos.x}, ${headScreenPos.y})`);
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