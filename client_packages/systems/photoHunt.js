// client_packages/systems/photoHunt.js
let activeLandmarks = [];
let blips = {};

mp.events.add('client:setupPhotoHunt', (dataJson) => {
    activeLandmarks = JSON.parse(dataJson);
    refreshBlips();
});

function refreshBlips() {
    // Clear existing
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

// Called from camera.js when player takes a picture
mp.events.add('client:cameraCapture', () => {
    if (activeLandmarks.length === 0) return;

    const myPos = mp.players.local.position;
    let foundTarget = null;

    for (const lm of activeLandmarks) {
        if (lm.completed) continue;

        const targetPos = new mp.Vector3(lm.pos.x, lm.pos.y, lm.pos.z);
        const dist = mp.game.system.vdist(myPos.x, myPos.y, myPos.z, targetPos.x, targetPos.y, targetPos.z);

        // 1. Distance Check (must be within 100m)
        if (dist < 100) {
            // 2. Screen Visibility Check
            // Projects 3D world coordinates to 2D screen space (0.0 to 1.0)
            const screenPos = mp.game.graphics.world3dToScreen2d(targetPos.x, targetPos.y, targetPos.z);
            
            // If screenPos is valid (not undefined) and x/y are between 0 and 1, it's on screen
            if (screenPos && screenPos.x >= 0 && screenPos.x <= 1 && screenPos.y >= 0 && screenPos.y <= 1) {
                foundTarget = lm;
                break;
            }
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