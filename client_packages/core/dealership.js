// client_packages/core/dealership.js
let dealershipBrowser = null;
let dealershipOpen = false;
let dealershipTier = null;
let previewCam = null;
let testDriveTimer = null;

// ─── Open Dealership UI ───
mp.events.add('client:dealership:open', (tier, dsName, vehiclesJson, typesJson, playerInfoJson, spawnPosJson, camPosJson, camLookAtJson) => {
    if (dealershipOpen) return;
    dealershipOpen = true;
    dealershipTier = tier;

    mp.gui.cursor.show(true, true);
    mp.game.ui.displayRadar(false);

    // Hide overlay HUD
    if (overlayBrowser && mp.browsers.exists(overlayBrowser)) {
        overlayBrowser.active = false;
    }

    // Create camera
    const camPos = JSON.parse(camPosJson);
    const camLook = JSON.parse(camLookAtJson);
    
    previewCam = mp.cameras.new('default', new mp.Vector3(camPos.x, camPos.y, camPos.z), new mp.Vector3(0, 0, 0), 60);
    previewCam.pointAtCoord(camLook.x, camLook.y, camLook.z);
    previewCam.setActive(true);
    mp.game.cam.renderScriptCams(true, true, 800, true, false);

    // Create browser
    dealershipBrowser = mp.browsers.new('package://ui/dealership/index.html');

    // Wait a moment for browser to load, then init data
    setTimeout(() => {
        if (!dealershipBrowser || !mp.browsers.exists(dealershipBrowser)) return;
        dealershipBrowser.execute(`initDealership('${tier}', '${dsName.replace(/'/g,"\\'")}', ${vehiclesJson}, ${typesJson}, ${playerInfoJson})`);
    }, 500);
});

// ─── Close Dealership ───
mp.events.add('client:dealership:close', () => {
    closeDealership();
});

function closeDealership() {
    if (!dealershipOpen) return;
    dealershipOpen = false;

    try { mp.gui.cursor.show(false, false); } catch(e) {}
    try { mp.game.ui.displayRadar(true); } catch(e) {}

    // Show overlay HUD again
    try {
        if (overlayBrowser && mp.browsers.exists(overlayBrowser)) {
            overlayBrowser.active = true;
        }
    } catch(e) {}

    // Destroy browser first (releases input capture)
    try {
        if (dealershipBrowser && mp.browsers.exists(dealershipBrowser)) {
            dealershipBrowser.destroy();
        }
    } catch(e) {}
    dealershipBrowser = null;

    // Destroy camera (instant switch, no easing to avoid freeze)
    try {
        if (previewCam) {
            mp.game.cam.renderScriptCams(false, false, 0, true, false);
            previewCam.destroy();
        }
    } catch(e) {}
    previewCam = null;

    // Tell server to cleanup preview vehicle
    try { mp.events.callRemote('server:dealership:close'); } catch(e) {}
    dealershipTier = null;
}

// ─── CEF callbacks ───
mp.events.add('cef:dealership:preview', (model) => {
    if (!dealershipTier) return;
    mp.events.callRemote('server:dealership:preview', model, dealershipTier);
});

mp.events.add('cef:dealership:buy', (model, payMethod) => {
    if (!dealershipTier) return;
    mp.events.callRemote('server:dealership:buy', model, payMethod);
});

mp.events.add('cef:dealership:buyFamily', (model) => {
    if (!dealershipTier) return;
    mp.events.callRemote('server:dealership:buy', model, 'family-safe', 'family');
});

mp.events.add('cef:dealership:testDrive', (model) => {
    if (!dealershipTier) return;
    mp.events.callRemote('server:dealership:testDrive', model, dealershipTier);
});

mp.events.add('cef:dealership:close', () => {
    closeDealership();
});

// ─── Test Drive Timer ───
mp.events.add('client:dealership:startTestTimer', (seconds) => {
    let remaining = seconds;
    
    if (testDriveTimer) clearInterval(testDriveTimer);

    testDriveTimer = setInterval(() => {
        remaining--;
        
        // Show countdown in chat or notification
        if (remaining === 30 || remaining === 10 || remaining === 5) {
            mp.events.call('showNotification', 'Test Drive', `${remaining} seconds remaining!`);
        }

        if (remaining <= 0) {
            clearInterval(testDriveTimer);
            testDriveTimer = null;
        }
    }, 1000);
});

mp.events.add('client:dealership:stopTestTimer', () => {
    if (testDriveTimer) {
        clearInterval(testDriveTimer);
        testDriveTimer = null;
    }
});

// ─── ESC to close ───
mp.keys.bind(0x1B, false, () => { // ESC
    if (dealershipOpen) {
        closeDealership();
    }
});

// Get overlay browser reference
let overlayBrowser = null;
mp.events.add('client:overlay:browserRef', (browser) => {
    overlayBrowser = browser;
});

// Ensure the overlay browser reference is available from global
setTimeout(() => {
    // Try to find overlay browser from the global scope if events haven't fired
    if (!overlayBrowser) {
        mp.browsers.forEach(b => {
            if (b && b.url && b.url.includes('overlay')) {
                overlayBrowser = b;
            }
        });
    }
}, 3000);
