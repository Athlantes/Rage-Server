// client_packages/spawn/index.js

let spawnBrowser = null;
let spawnCam     = null;

// Mirrors the spawn list in ui/spawn/app.js — used for 3D coordinates on confirm
const spawnLocations = [
    { x:  206.56, y:  -909.89, z:  30.0 }, // Legion Square
    { x:  384.62, y:   260.67, z:  90.0 }, // Vinewood Blvd
    { x: 1941.40, y:  3747.01, z:  32.0 }, // Sandy Shores
    { x: -113.84, y:  6445.62, z:  31.0 }, // Paleto Bay
    { x:-1037.76, y: -2737.67, z:  13.0 }, // LS Airport
];

// ── Open Spawn Menu ───────────────────────────────────────────────────────────

mp.events.add('client:spawn:openMenu', (lastPos) => {
    if (spawnBrowser) return;

    // Overhead cinematic camera
    const camPos = new mp.Vector3(0, 0, 3500);
    const camRot = new mp.Vector3(-90, 0, 0);
    spawnCam = mp.cameras.new('default', camPos, camRot, 40);
    spawnCam.setActive(true);
    mp.game.cam.renderScriptCams(true, false, 0, true, false);

    spawnBrowser = mp.browsers.new('package://ui/spawn/index.html');
    mp.gui.cursor.show(true, true);
    mp.gui.chat.show(false);

    // Wait for Vue to mount and onMounted map init to complete,
    // then send last position via the window bridge.
    // JSON.stringify(lastPos) produces a valid JS literal — safe to embed directly.
    setTimeout(() => {
        if (spawnBrowser && lastPos) {
            spawnBrowser.execute(`window.addLastLocation(${JSON.stringify(lastPos)});`);
            if (housePos) spawnBrowser.execute(`window.addHouseLocation(${JSON.stringify(housePos)});`);
        }
    }, 350);
});

// ── Spawn Confirmed (from CEF via mp.trigger) ─────────────────────────────────

mp.events.add('client:spawn:select', (index) => {
    if (!spawnBrowser) return;

    spawnBrowser.destroy();
    spawnBrowser = null;
    mp.gui.cursor.show(false, false);

    // Tell server which spawn was chosen (-1 = last location, 0-4 = standard)
    mp.events.callRemote('server:spawn:player', index);

    const player = mp.players.local;
    player.freezePosition(false);
    player.setVisible(true, false);
    player.setAlpha(255);
    player.setInvincible(false);

    mp.game.ui.displayRadar(true);
    mp.game.ui.displayHud(true);

    setTimeout(() => {
        mp.game.cam.renderScriptCams(false, true, 5000, true, false);
        if (spawnCam) { spawnCam.destroy(); spawnCam = null; }
    }, 500);
});
