// client_packages/systems/h2hRace.js
// ============================================================================
//  HEAD-TO-HEAD RACE SYSTEM  — Client Side
//  Handles: cinematic camera, countdown HUD, checkpoint marker, freeze/unfreeze
// ============================================================================

let raceState = 'idle'; // idle | countdown | racing | ended
let countdownTimer = null;
let checkpointBlip = null;
let checkpointMarker = null;
let checkpointPos = null;
let checkpointName = '';
let opponentVehiclePos = null;
let cinematicCamHandle = null;
let raceHudInterval = null;
let countdownValue = 0;
let raceStartTime = 0;

// ═══════════════════════════════════════════════════════════════════════════
//  1. COUNTDOWN — Freeze, Cinematic Camera, Timer
// ═══════════════════════════════════════════════════════════════════════════

mp.events.add('h2h:countdown', (seconds, oppVehX, oppVehY, oppVehZ, oppHeading, cpX, cpY, cpZ, cpName) => {
    if (raceState !== 'idle') return;

    raceState = 'countdown';
    countdownValue = seconds;
    checkpointPos = { x: cpX, y: cpY, z: cpZ };
    checkpointName = cpName;
    opponentVehiclePos = { x: oppVehX, y: oppVehY, z: oppVehZ };

    const localPlayer = mp.players.local;
    const localVeh = localPlayer.vehicle;

    // ── Freeze the vehicle ──
    if (localVeh) {
        mp.game.invoke('0xDF7E3ACB9CAE107D', localVeh.handle, true); // SET_ENTITY_INVINCIBLE
        localVeh.freezePosition(true);
    }
    localPlayer.freezePosition(true);

    // ── Let them rev the engine ──
    if (localVeh) {
        mp.game.invoke('0x2497C4717C8B881E', localVeh.handle, true); // SET_VEHICLE_ENGINE_ON
    }

    // ── Start cinematic camera sequence ──
    startCinematicCamera(localVeh, opponentVehiclePos, seconds);

    // ── Countdown text ──
    showCountdown(seconds);
});

// ═══════════════════════════════════════════════════════════════════════════
//  2. GO! — Unfreeze, Reset Camera, Show Checkpoint
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
        mp.game.invoke('0xDF7E3ACB9CAE107D', localVeh.handle, false); // SET_ENTITY_INVINCIBLE off
    }

    // ── Destroy cinematic cam, restore gameplay camera ──
    destroyCinematicCamera();

    // ── Create checkpoint blip & marker ──
    createCheckpoint();

    // ── Show "GO!" flash ──
    showGoFlash();

    // ── Start HUD with distance ──
    startRaceHud();
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
        mp.game.invoke('0xDF7E3ACB9CAE107D', localPlayer.vehicle.handle, false);
    }

    // Destroy camera if still active
    destroyCinematicCamera();

    // Remove checkpoint
    removeCheckpoint();

    // Stop HUD
    stopRaceHud();

    // Show result
    if (wasRacing && winnerId >= 0) {
        if (winnerId === localPlayer.remoteId) {
            showBigText('~g~YOU WIN!', 5000);
        } else {
            showBigText('~r~YOU LOSE!', 5000);
        }
    }

    // Reset after brief delay
    setTimeout(() => {
        raceState = 'idle';
        countdownValue = 0;
        checkpointPos = null;
        checkpointName = '';
        opponentVehiclePos = null;
    }, 5000);
});

// ═══════════════════════════════════════════════════════════════════════════
//  4. CINEMATIC CAMERA  (NFS-style intro)
// ═══════════════════════════════════════════════════════════════════════════

function startCinematicCamera(localVeh, oppPos, durationSeconds) {
    if (!localVeh) return;

    const playerPos = localVeh.position;
    const playerHeading = localVeh.getHeading();

    // ── Camera 1: Low angle shot of player's car (front-side)  ──
    const headRad = (playerHeading + 30) * Math.PI / 180;
    const cam1Pos = {
        x: playerPos.x + Math.sin(headRad) * 5,
        y: playerPos.y + Math.cos(headRad) * 5,
        z: playerPos.z + 0.8  // Low to the ground
    };

    cinematicCamHandle = mp.cameras.new('default', cam1Pos, new mp.Vector3(0, 0, 0), 50);
    cinematicCamHandle.pointAtCoord(playerPos.x, playerPos.y, playerPos.z + 0.5);
    cinematicCamHandle.setActive(true);
    mp.game.cam.renderScriptCams(true, true, 500, true, false);

    // ── Camera 2: Pan to opponent vehicle (after 1/3 of countdown) ──
    const switchTime1 = (durationSeconds * 1000) / 3;
    setTimeout(() => {
        if (raceState !== 'countdown') return;

        // Swooping angle from above toward opponent
        const cam2Pos = {
            x: oppPos.x + 3,
            y: oppPos.y + 3,
            z: oppPos.z + 4
        };

        if (cinematicCamHandle) {
            cinematicCamHandle.setCoord(cam2Pos.x, cam2Pos.y, cam2Pos.z);
            cinematicCamHandle.pointAtCoord(oppPos.x, oppPos.y, oppPos.z + 0.5);
        }
    }, switchTime1);

    // ── Camera 3: Pull-back behind player car (final third, before GO) ──
    const switchTime2 = (durationSeconds * 1000) * 2 / 3;
    setTimeout(() => {
        if (raceState !== 'countdown') return;

        // Behind the car, slightly elevated
        const backRad = (playerHeading + 180) * Math.PI / 180;
        const cam3Pos = {
            x: playerPos.x + Math.sin(backRad) * 6,
            y: playerPos.y + Math.cos(backRad) * 6,
            z: playerPos.z + 2.5
        };

        if (cinematicCamHandle) {
            cinematicCamHandle.setCoord(cam3Pos.x, cam3Pos.y, cam3Pos.z);
            cinematicCamHandle.pointAtCoord(playerPos.x, playerPos.y, playerPos.z + 0.5);
        }
    }, switchTime2);
}

function destroyCinematicCamera() {
    if (cinematicCamHandle) {
        mp.game.cam.renderScriptCams(false, true, 500, true, false);
        cinematicCamHandle.setActive(false);
        cinematicCamHandle.destroy();
        cinematicCamHandle = null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  5. COUNTDOWN HUD (3, 2, 1, GO!)
// ═══════════════════════════════════════════════════════════════════════════

function showCountdown(seconds) {
    let remaining = seconds;

    // Immediate first tick
    showBigText(`~y~${remaining}`, 900);

    countdownTimer = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            showBigText(`~y~${remaining}`, 900);
        } else if (remaining === 0) {
            showBigText('~g~GO!', 1200);
            clearInterval(countdownTimer);
            countdownTimer = null;
        }
    }, 1000);
}

function showGoFlash() {
    // Extra visual punch
    mp.game.graphics.animpostfxPlay('FocusIn', 0, false);
    setTimeout(() => {
        mp.game.graphics.animpostfxStop('FocusIn');
    }, 800);
}

function showBigText(text, durationMs) {
    // Use GTA's native notification scaleform for big centered text
    const scaleform = mp.game.graphics.requestScaleformMovie('MP_BIG_MESSAGE_FREEMODE');

    const startTime = Date.now();
    const interval = setInterval(() => {
        if (mp.game.graphics.hasScaleformMovieLoaded(scaleform)) {
            mp.game.graphics.pushScaleformMovieFunction(scaleform, 'SHOW_SHARD_WASTED_MP_MESSAGE');
            mp.game.graphics.pushScaleformMovieFunctionParameterString(text);
            mp.game.graphics.pushScaleformMovieFunctionParameterString('');
            mp.game.graphics.pushScaleformMovieFunctionParameterInt(5); // color type
            mp.game.graphics.endScaleformMovieMethod();
            clearInterval(interval);

            // Draw it for duration
            const drawInterval = setInterval(() => {
                mp.game.graphics.drawScaleformMovieFullscreen(scaleform, 255, 255, 255, 255, 0);
            }, 0);

            setTimeout(() => {
                clearInterval(drawInterval);
                mp.game.graphics.setScaleformMovieAsNoLongerNeeded(scaleform);
            }, durationMs);
        }

        // Timeout safety
        if (Date.now() - startTime > 3000) clearInterval(interval);
    }, 10);
}

// ═══════════════════════════════════════════════════════════════════════════
//  6. CHECKPOINT MARKER + BLIP
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
    mp.game.invoke('0x4F7D8A9BFB0B43E9', checkpointBlip.handle, true); // SET_BLIP_ROUTE
    mp.game.invoke('0x837155CD2F63DA09', checkpointBlip.handle, 46);    // SET_BLIP_ROUTE_COLOUR

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
//  7. RACE HUD — Distance / Timer overlay
// ═══════════════════════════════════════════════════════════════════════════

function startRaceHud() {
    raceHudInterval = setInterval(() => {
        // intentionally left for the render event
    }, 100);
}

function stopRaceHud() {
    if (raceHudInterval) {
        clearInterval(raceHudInterval);
        raceHudInterval = null;
    }
}

// ── Render event for race HUD ──
mp.events.add('render', () => {
    if (raceState !== 'racing' || !checkpointPos) return;

    const playerPos = mp.players.local.position;
    const dist = mp.game.system.vdist(
        playerPos.x, playerPos.y, playerPos.z,
        checkpointPos.x, checkpointPos.y, checkpointPos.z
    );

    const elapsed = ((Date.now() - raceStartTime) / 1000).toFixed(1);
    const distText = dist > 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`;

    // Draw text on screen — top center
    drawText(`~y~🏁 HEAD TO HEAD`, 0.5, 0.02, 0.55, 4, true);
    drawText(`~w~Distance: ${distText}  |  Time: ${elapsed}s`, 0.5, 0.055, 0.4, 4, false);
    drawText(`~w~Destination: ~y~${checkpointName}`, 0.5, 0.085, 0.35, 4, false);
});

function drawText(text, x, y, scale, font, outline) {
    mp.game.graphics.drawText(text, [x, y], {
        font: font,
        color: [255, 255, 255, 255],
        scale: [scale, scale],
        outline: outline,
        centre: true,
    });
}

// ═══════════════════════════════════════════════════════════════════════════
//  8. SAFETY — Cleanup on disconnect / death
// ═══════════════════════════════════════════════════════════════════════════

mp.events.add('playerDeath', () => {
    if (raceState !== 'idle') {
        destroyCinematicCamera();
        removeCheckpoint();
        stopRaceHud();
        raceState = 'idle';
    }
});

mp.events.add('render', () => {
    // During countdown, disable all vehicle control except revving
    if (raceState === 'countdown') {
        const localVeh = mp.players.local.vehicle;
        if (localVeh) {
            localVeh.freezePosition(true);
        }
    }
});

console.log('[H2H Race] Client-side race system loaded.');
