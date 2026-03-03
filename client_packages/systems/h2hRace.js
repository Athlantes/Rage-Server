// client_packages/systems/h2hRace.js
// ============================================================================
//  HEAD-TO-HEAD RACE SYSTEM  — Client Side (v2)
//  Features: Smooth interpolated cameras, Custom CEF race UI
// ============================================================================

let raceState = 'idle'; // idle | countdown | racing | ended
let checkpointBlip = null;
let checkpointMarker = null;
let checkpointPos = null;
let checkpointName = '';
let opponentVehiclePos = null;
let raceStartTime = 0;
let initialDistance = 0;

// Camera system
let camSequence = [];     // Array of camera handles created during cinematic
let activeCamIndex = -1;

// CEF Browser
let raceBrowser = null;

// HUD update throttle
let lastHudUpdate = 0;
const HUD_UPDATE_INTERVAL = 100; // ms

// ═══════════════════════════════════════════════════════════════════════════
//  BROWSER — Create / Destroy
// ═══════════════════════════════════════════════════════════════════════════

function createBrowser() {
    if (raceBrowser) return;
    raceBrowser = mp.browsers.new('package://ui/h2hRace/index.html');
}

function destroyBrowser() {
    if (raceBrowser) {
        raceBrowser.destroy();
        raceBrowser = null;
    }
}

function browserExec(code) {
    if (raceBrowser) raceBrowser.execute(code);
}

// ═══════════════════════════════════════════════════════════════════════════
//  1. COUNTDOWN — Freeze, Smooth Cinematic Camera, CEF Timer
// ═══════════════════════════════════════════════════════════════════════════

mp.events.add('h2h:countdown', (seconds, oppVehX, oppVehY, oppVehZ, oppHeading, cpX, cpY, cpZ, cpName) => {
    if (raceState !== 'idle') return;

    raceState = 'countdown';
    checkpointPos = { x: cpX, y: cpY, z: cpZ };
    checkpointName = cpName;
    opponentVehiclePos = { x: oppVehX, y: oppVehY, z: oppVehZ };

    const localPlayer = mp.players.local;
    const localVeh = localPlayer.vehicle;

    // ── Freeze the vehicle ──
    if (localVeh) {
        localVeh.setInvincible(true);
        localVeh.freezePosition(true);
    }
    localPlayer.freezePosition(true);

    // ── Let them rev the engine ──
    if (localVeh) {
        localVeh.setEngineOn(true, true, false);
    }

    // ── Create browser & show countdown ──
    createBrowser();
    // Small delay to let the browser DOM load
    setTimeout(() => {
        browserExec(`showCountdown(${seconds})`);
    }, 200);

    // ── Start smooth cinematic camera sequence ──
    startCinematicCamera(localVeh, opponentVehiclePos, seconds);
});

// ═══════════════════════════════════════════════════════════════════════════
//  2. GO! — Unfreeze, Smooth Camera Return, Show HUD
// ═══════════════════════════════════════════════════════════════════════════

mp.events.add('h2h:go', () => {
    if (raceState !== 'countdown') return;

    raceState = 'racing';
    raceStartTime = Date.now();

    const localPlayer = mp.players.local;
    const localVeh = localPlayer.vehicle;

    // ── Unfreeze ──
    localPlayer.freezePosition(false);
    if (localVeh) {
        localVeh.freezePosition(false);
        localVeh.setInvincible(false);
    }

    // ── Smoothly return to gameplay camera ──
    destroyCinematicCamera(true);

    // ── Create checkpoint blip & marker ──
    createCheckpoint();

    // ── Calculate initial distance for progress bar ──
    const pPos = localPlayer.position;
    initialDistance = mp.game.system.vdist(
        pPos.x, pPos.y, pPos.z,
        checkpointPos.x, checkpointPos.y, checkpointPos.z
    );

    // ── CEF: Show "GO!" flash + race HUD ──
    browserExec(`showGo()`);
    setTimeout(() => {
        browserExec(`showHud('${checkpointName.replace(/'/g, "\\'")}')`);
    }, 1200);

    // ── Screen effect ──
    mp.game.graphics.animpostfxPlay('FocusIn', 0, false);
    setTimeout(() => {
        mp.game.graphics.animpostfxStop('FocusIn');
    }, 800);
});

// ═══════════════════════════════════════════════════════════════════════════
//  3. END RACE — Cleanup everything
// ═══════════════════════════════════════════════════════════════════════════

mp.events.add('h2h:end', (winnerId) => {
    const wasRacing = raceState === 'racing' || raceState === 'countdown';
    raceState = 'ended';

    // Unfreeze just in case
    const localPlayer = mp.players.local;
    localPlayer.freezePosition(false);
    if (localPlayer.vehicle) {
        localPlayer.vehicle.freezePosition(false);
        localPlayer.vehicle.setInvincible(false);
    }

    // Destroy camera if still active
    destroyCinematicCamera(false);

    // Remove checkpoint
    removeCheckpoint();

    // Show result via CEF
    if (wasRacing && winnerId >= 0) {
        const elapsed = ((Date.now() - raceStartTime) / 1000).toFixed(1);
        const isWin = winnerId === localPlayer.remoteId;
        browserExec(`showResult(${isWin}, '${elapsed}s')`);
    }

    // Reset after delay (match the result animation duration)
    setTimeout(() => {
        destroyBrowser();
        raceState = 'idle';
        checkpointPos = null;
        checkpointName = '';
        opponentVehiclePos = null;
        initialDistance = 0;
    }, 6000);
});

// ═══════════════════════════════════════════════════════════════════════════
//  4. SMOOTH CINEMATIC CAMERA  (Interpolated transitions)
// ═══════════════════════════════════════════════════════════════════════════

function startCinematicCamera(localVeh, oppPos, durationSeconds) {
    if (!localVeh) return;

    const playerPos = localVeh.position;
    const playerHeading = localVeh.getHeading();
    const totalMs = durationSeconds * 1000;
    const segmentMs = totalMs / 3;

    // ── Interpolation duration for smooth transitions (ms) ──
    const interpDuration = Math.min(1500, segmentMs * 0.7);

    // ── Camera 1: Low angle front-side shot of player's car ──
    const headRad = (playerHeading + 30) * Math.PI / 180;
    const cam1 = mp.cameras.new('default',
        new mp.Vector3(
            playerPos.x + Math.sin(headRad) * 5,
            playerPos.y + Math.cos(headRad) * 5,
            playerPos.z + 0.8
        ),
        new mp.Vector3(0, 0, 0), 50
    );
    cam1.pointAtCoord(playerPos.x, playerPos.y, playerPos.z + 0.5);
    cam1.setActive(true);
    mp.game.cam.renderScriptCams(true, true, 800, true, false);
    camSequence.push(cam1);
    activeCamIndex = 0;

    // ── Camera 2: Sweep over to opponent vehicle (after 1/3) ──
    setTimeout(() => {
        if (raceState !== 'countdown') return;

        const cam2 = mp.cameras.new('default',
            new mp.Vector3(
                oppPos.x + 4,
                oppPos.y + 4,
                oppPos.z + 5
            ),
            new mp.Vector3(0, 0, 0), 45
        );
        cam2.pointAtCoord(oppPos.x, oppPos.y, oppPos.z + 0.5);
        camSequence.push(cam2);
        activeCamIndex = 1;

        // Smooth interpolation from cam1 → cam2
        cam2.setActiveWithInterp(cam1.handle, interpDuration, 2, 2);
    }, segmentMs);

    // ── Camera 3: Pull-back behind player car (after 2/3) ──
    setTimeout(() => {
        if (raceState !== 'countdown') return;

        const backRad = (playerHeading + 180) * Math.PI / 180;
        const cam3 = mp.cameras.new('default',
            new mp.Vector3(
                playerPos.x + Math.sin(backRad) * 7,
                playerPos.y + Math.cos(backRad) * 7,
                playerPos.z + 3
            ),
            new mp.Vector3(0, 0, 0), 50
        );
        cam3.pointAtCoord(playerPos.x, playerPos.y, playerPos.z + 0.5);
        camSequence.push(cam3);
        activeCamIndex = 2;

        const prevCam = camSequence[1] || cam1;
        cam3.setActiveWithInterp(prevCam.handle, interpDuration, 2, 2);
    }, segmentMs * 2);
}

function destroyCinematicCamera(smooth) {
    if (camSequence.length === 0) return;

    // Smooth return to gameplay camera
    const duration = smooth ? 800 : 0;
    mp.game.cam.renderScriptCams(false, true, duration, true, false);

    // Deactivate and destroy all created cameras
    for (const cam of camSequence) {
        try {
            cam.setActive(false);
            cam.destroy();
        } catch (e) { /* already destroyed */ }
    }
    camSequence = [];
    activeCamIndex = -1;
}

// ═══════════════════════════════════════════════════════════════════════════
//  5. CHECKPOINT MARKER + BLIP
// ═══════════════════════════════════════════════════════════════════════════

function createCheckpoint() {
    if (!checkpointPos) return;

    // Blip (checkered flag icon)
    checkpointBlip = mp.blips.new(38, new mp.Vector3(checkpointPos.x, checkpointPos.y, checkpointPos.z), {
        name: `Race: ${checkpointName}`,
        color: 46,
        shortRange: false,
        scale: 1.2
    });

    // Draw route on minimap
    checkpointBlip.setRoute(true);

    // Checkpoint marker (cylinder)
    checkpointMarker = mp.markers.new(1, new mp.Vector3(checkpointPos.x, checkpointPos.y, checkpointPos.z - 1), 1.0, {
        color: [255, 215, 0, 150], // Gold
        dimension: mp.players.local.dimension,
        visible: true,
        scale: 15.0
    });
}

function removeCheckpoint() {
    if (checkpointBlip) {
        checkpointBlip.destroy();
        checkpointBlip = null;
    }
    if (checkpointMarker) {
        checkpointMarker.destroy();
        checkpointMarker = null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  6. RACE HUD — CEF updates via render loop
// ═══════════════════════════════════════════════════════════════════════════

mp.events.add('render', () => {
    if (raceState !== 'racing' || !checkpointPos || !raceBrowser) return;

    // Throttle updates to avoid spamming the browser
    const now = Date.now();
    if (now - lastHudUpdate < HUD_UPDATE_INTERVAL) return;
    lastHudUpdate = now;

    const playerPos = mp.players.local.position;
    const dist = mp.game.system.vdist(
        playerPos.x, playerPos.y, playerPos.z,
        checkpointPos.x, checkpointPos.y, checkpointPos.z
    );

    const elapsed = (now - raceStartTime) / 1000;

    // Progress: how much of the distance has been covered (0-100)
    const progress = initialDistance > 0
        ? Math.min(100, ((initialDistance - dist) / initialDistance) * 100)
        : 0;

    browserExec(`updateHud(${dist.toFixed(1)}, ${elapsed.toFixed(1)}, ${progress.toFixed(1)})`);
});

// ═══════════════════════════════════════════════════════════════════════════
//  7. SAFETY — Cleanup on disconnect / death
// ═══════════════════════════════════════════════════════════════════════════

mp.events.add('playerDeath', () => {
    if (raceState !== 'idle') {
        destroyCinematicCamera(false);
        removeCheckpoint();
        destroyBrowser();
        raceState = 'idle';
    }
});

console.log('[H2H Race] Client-side race system v2 loaded.');