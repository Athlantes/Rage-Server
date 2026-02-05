// client_packages/spawn/index.js

let spawnBrowser = null;
let spawnCam = null;

// Definition matches the UI (for coordinate usage if needed here)
const spawnLocations = [
    { x: 206.56, y: -909.89, z: 30.0 },    // Legion
    { x: 384.62, y: 260.67, z: 90.0 },     // Vinewood
    { x: 1941.40, y: 3747.01, z: 32.0 },   // Sandy
    { x: -113.84, y: 6445.62, z: 31.0 },   // Paleto
    { x: -1037.76, y: -2737.67, z: 13.0 }  // Airport
];

mp.events.add('client:spawn:openMenu', (lastPos) => {
    if (spawnBrowser) return;

    // Setup Cam (Keep your existing code)
    const camPos = new mp.Vector3(0, 0, 3500); 
    const camRot = new mp.Vector3(-90, 0, 0);
    spawnCam = mp.cameras.new('default', camPos, camRot, 40);
    spawnCam.setActive(true);
    mp.game.cam.renderScriptCams(true, false, 0, true, false);

    // Create Browser
    spawnBrowser = mp.browsers.new("package://ui/spawn/index.html");
    mp.gui.cursor.show(true, true);
    mp.gui.chat.show(false);

    // WAIT for browser to load, then send the Last Location data
    setTimeout(() => {
        if(spawnBrowser && lastPos) {
            // We pass it as a JSON string
            spawnBrowser.execute(`addLastLocation('${JSON.stringify(lastPos)}');`);
        }
    }, 300);
});

mp.events.add('client:spawn:select', (index) => {
    if (!spawnBrowser) return;
    
    spawnBrowser.destroy();
    spawnBrowser = null;
    mp.gui.cursor.show(false, false);
    
    // Call Server
    mp.events.callRemote('server:spawn:player', index);

    const player = mp.players.local;
    player.freezePosition(false);
    player.setVisible(true, false);
    player.setAlpha(255);
    player.setInvincible(false);
    
    // --- ENABLE UI HERE ---
    mp.game.ui.displayRadar(true);
    mp.game.ui.displayHud(true);
    // ----------------------
    
    setTimeout(() => {
        mp.game.cam.renderScriptCams(false, true, 5000, true, false);
        if (spawnCam) {
            spawnCam.destroy();
            spawnCam = null;
        }
    }, 500);
});