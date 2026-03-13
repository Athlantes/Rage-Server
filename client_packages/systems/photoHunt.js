// client_packages/systems/photoHunt.js
let activeLandmarks = [];
let blips = {};

mp.events.add('client:setupPhotoHunt', (dataJson) => {
    activeLandmarks = JSON.parse(dataJson);
    refreshBlips();
});

function refreshBlips() {
    Object.values(blips).forEach(b => b.destroy());
    blips = {};

    activeLandmarks.forEach(lm => {
        if (!lm.completed) {
            const blip = mp.blips.new(744, new mp.Vector3(lm.pos.x, lm.pos.y, lm.pos.z), {
                name: `Landmark Spotter`,
                scale: 0.7,
                color: 13,
                shortRange: true
            });
            blips[lm.id] = blip;
        }
    });
}

/**
 * Builds a list of sample points for a landmark to check against the screen.
 * For a tall/large building, we check base, mid, top, and 4 sides.
 * If ANY of these points is on screen, the landmark counts as photographed.
 */
function getSamplePoints(lm) {
    const { x, y, z } = lm.pos;
    const radius = lm.radius || 15;   // horizontal spread in meters (default 15m)
    const height = lm.height || 20;   // vertical height of the landmark (default 20m)

    return [
        // Center column: base, mid, top
        new mp.Vector3(x, y, z),
        new mp.Vector3(x, y, z + height * 0.5),
        new mp.Vector3(x, y, z + height),

        // Four cardinal sides at mid-height (catches angled shots from the side)
        new mp.Vector3(x + radius, y,          z + height * 0.5),
        new mp.Vector3(x - radius, y,          z + height * 0.5),
        new mp.Vector3(x,          y + radius, z + height * 0.5),
        new mp.Vector3(x,          y - radius, z + height * 0.5),

        // Top corners (helps with shots looking up at tall buildings)
        new mp.Vector3(x + radius, y,          z + height),
        new mp.Vector3(x - radius, y,          z + height),
        new mp.Vector3(x,          y + radius, z + height),
        new mp.Vector3(x,          y - radius, z + height),
    ];
}

/**
 * Converts a GTA rotation (Euler degrees, rotationOrder 2 = YXZ) to a forward unit vector.
 * GTA convention: pitch = rot.x, roll = rot.y, yaw = rot.z
 */
function rotationToForward(rot) {
    const pitch = (rot.x * Math.PI) / 180;
    const yaw   = (rot.z * Math.PI) / 180;
    return {
        x: -Math.sin(yaw) * Math.abs(Math.cos(pitch)),
        y:  Math.cos(yaw) * Math.abs(Math.cos(pitch)),
        z:  Math.sin(pitch)
    };
}

/**
 * Returns true if the player's camera is roughly facing toward the target position.
 * Prevents false positives where world3dToScreen2d wraps behind the player.
 */
function isFacingTarget(playerPos, targetPos) {
    let camDir;
    try {
        // rotationOrder 2 = YXZ, the standard GTA rotation order
        const rot = mp.game.cam.getFinalRenderedRot(2);
        camDir = rotationToForward(rot);
    } catch (e) {
        // If the native fails for any reason, skip the facing check and allow the shot
        return true;
    }

    const dx = targetPos.x - playerPos.x;
    const dy = targetPos.y - playerPos.y;
    const dz = targetPos.z - playerPos.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len === 0) return true;

    // Dot product > 0 = target is in front of the camera (within 90 degrees)
    const dot = (dx / len) * camDir.x + (dy / len) * camDir.y + (dz / len) * camDir.z;
    return dot > 0;
}

/**
 * Checks if a 3D point projects onto the screen (with a small edge margin).
 */
function isPointOnScreen(worldPos) {
    const screenPos = mp.game.graphics.world3dToScreen2d(worldPos.x, worldPos.y, worldPos.z);
    if (!screenPos) return false;

    const margin = 0.05;
    return (
        screenPos.x >= -margin && screenPos.x <= 1 + margin &&
        screenPos.y >= -margin && screenPos.y <= 1 + margin
    );
}

// Called from camera.js when player takes a picture
mp.events.add('client:cameraCapture', () => {
    if (activeLandmarks.length === 0) return;

    const myPos = mp.players.local.position;
    let foundTarget = null;

    for (const lm of activeLandmarks) {
        if (lm.completed) continue;

        const center = new mp.Vector3(lm.pos.x, lm.pos.y, lm.pos.z);
        const maxDist = lm.maxDist || 150; // per-landmark max distance override, default 150m

        // 1. Broad distance check
        const dist = mp.game.system.vdist(myPos.x, myPos.y, myPos.z, center.x, center.y, center.z);
        if (dist > maxDist) continue;

        // 2. Camera facing check — must be looking roughly toward the landmark
        if (!isFacingTarget(myPos, center)) continue;

        // 3. Check multiple sample points spread across the landmark's volume.
        //    If ANY point is on screen, the shot counts.
        const samplePoints = getSamplePoints(lm);
        const anyOnScreen = samplePoints.some(pt => isPointOnScreen(pt));

        if (anyOnScreen) {
            foundTarget = lm;
            break;
        }
    }

    if (foundTarget) {
        mp.events.callRemote('server:claimLandmarkPhoto', foundTarget.id);
    }
});

mp.events.add('client:photoSuccess', (landmarkId) => {
    const lm = activeLandmarks.find(l => l.id === landmarkId);
    if (lm) {
        lm.completed = true;
        if (blips[landmarkId]) {
            blips[landmarkId].destroy();
            delete blips[landmarkId];
        }
        mp.game.audio.playSoundFrontend(-1, "Hack_Success", "DLC_HEIST_BIOLAB_PREP_HACKING_SOUNDS", true);
    }
});