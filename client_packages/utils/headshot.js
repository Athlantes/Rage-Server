// client_packages/utils/headshot.js

let headshotHandle = null;
let headshotTxd = null;
let photoBrowser = null;

// 1. Create the hidden browser for processing
mp.events.add('playerReady', () => {
    if (!photoBrowser) {
        photoBrowser = mp.browsers.new("package://utils/photoProcessor.html");
        photoBrowser.active = false; // Keep it hidden
    }
});

// 2. Event triggered by Server to start the process
mp.events.add('client:headshot:take', () => {
    const player = mp.players.local;
    
    // Register the GTA V Mugshot
    headshotHandle = mp.game.ped.registerPedheadshot(player.handle);
    
    // Wait for it to be ready
    let attempts = 0;
    let checkInterval = setInterval(() => {
        if (mp.game.ped.isPedheadshotValid(headshotHandle) && mp.game.ped.isPedheadshotReady(headshotHandle)) {
            clearInterval(checkInterval);
            
            // Get the texture string
            headshotTxd = mp.game.ped.getPedheadshotTxdString(headshotHandle);
            
            // Start rendering it to the screen
            mp.events.add("render", renderHeadshot);
            
            // Take the screenshot after a brief moment (to ensure it's drawn)
            setTimeout(() => {
                // Screenshot name matches what photoProcessor expects
                mp.gui.takeScreenshot("temp_headshot.png", 1, 100, 0); 
                
                // Stop rendering after capture
                setTimeout(() => {
                    mp.events.remove("render", renderHeadshot);
                    cleanupHeadshot();
                    
                    // Tell the processor to work its magic
                    // We rely on the screenshot saving to disk, which takes ~100-500ms
                    setTimeout(() => {
                        if(photoBrowser) {
                            photoBrowser.execute(`processPhoto('temp_headshot.png')`);
                        }
                    }, 1000); 
                }, 100);
            }, 250);
        }
        
        attempts++;
        if (attempts > 50) { // Timeout after 5 seconds
            clearInterval(checkInterval);
            cleanupHeadshot();
        }
    }, 100);
});

function renderHeadshot() {
    if (headshotTxd) {
        // Draw the headshot texture over the entire screen
        // x=0.5, y=0.5, w=1.0, h=1.0 (Full Screen)
        mp.game.graphics.drawSprite(headshotTxd, headshotTxd, 0.5, 0.5, 1.0, 1.0, 0, 255, 255, 255, 255);
        
        // Hide HUD for clean picture
        mp.game.ui.hideHudAndRadarThisFrame();
    }
}

function cleanupHeadshot() {
    if (headshotHandle) {
        mp.game.ped.unregisterPedheadshot(headshotHandle);
        headshotHandle = null;
        headshotTxd = null;
    }
}

// --- Events from photoProcessor.html ---

mp.events.add('client:photo:log', (msg) => {
    mp.console.logInfo(msg);
});

mp.events.add('client:photo:error', (msg) => {
    mp.console.logError(msg);
});

// Forwarding Upload Events to Server
mp.events.add('client:photo:startUpload', (totalChunks) => {
    mp.events.callRemote('server:photo:init', totalChunks);
});

mp.events.add('client:photo:sendChunk', (chunkData, chunkId) => {
    mp.events.callRemote('server:photo:chunk', chunkData, chunkId);
});

mp.events.add('client:photo:complete', () => {
    mp.events.callRemote('server:photo:finish');
});