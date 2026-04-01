// ============================================================
//  CHARACTER CREATOR - Client-Side Event Handlers (Overhauled)
// ============================================================

let creatorBrowser = null;
let creatorCam = null;

// --- CAMERA POSITIONS ---
const cameraPoses = {
    top: { pos: new mp.Vector3(402.8664, -997.5, -98.3), target: new mp.Vector3(402.8664, -996.4108, -98.5) },
    legs: { pos: new mp.Vector3(402.8664, -997.5, -99.2), target: new mp.Vector3(402.8664, -996.4108, -99.0) },
    shoes: { pos: new mp.Vector3(402.8664, -997.5, -99.7), target: new mp.Vector3(402.8664, -996.4108, -99.5) }
};

// --- START CREATOR ---
mp.events.add('client:creator:start', () => {
    // 1. Position Player in interior
    const pos = new mp.Vector3(402.8664, -996.4108, -99.00027);
    mp.players.local.position = pos;
    mp.players.local.setHeading(180);
    mp.players.local.freezePosition(true);
    mp.players.local.setVisible(true, false);
    mp.players.local.setAlpha(255);

    // 2. Camera setup (face-level view)
    creatorCam = mp.cameras.new('default', cameraPoses.top.pos, new mp.Vector3(0, 0, 0), 40);
    creatorCam.pointAtCoord(cameraPoses.top.target.x, cameraPoses.top.target.y, cameraPoses.top.target.z);
    creatorCam.setActive(true);
    mp.game.cam.renderScriptCams(true, false, 0, true, false);

    // 3. UI
    mp.gui.cursor.show(true, true);
    mp.game.ui.displayRadar(false);
    mp.game.ui.displayHud(false);

    // Hide overlay (food, water, payday)
    mp.events.callLocal('toggleOverlay', false);

    if (!creatorBrowser) {
        creatorBrowser = mp.browsers.new("package://ui/creator/index.html");
    }
});

// --- UPDATE CAMERA VIEW ---
mp.events.add('client:creator:updateCameraView', (clothingPart) => {
    if (!creatorCam) return;
    
    let camPose = cameraPoses.top; // default to top
    if (clothingPart === 'legs') camPose = cameraPoses.legs;
    if (clothingPart === 'shoes') camPose = cameraPoses.shoes;
    
    // Smoothly move camera to new position
    creatorCam.setCoord(camPose.pos.x, camPose.pos.y, camPose.pos.z);
    creatorCam.pointAtCoord(camPose.target.x, camPose.target.y, camPose.target.z);
});

// --- GENDER CHANGE ---
mp.events.add('client:creator:updateGender', (gender) => {
    const model = (gender === 0) ? 'mp_m_freemode_01' : 'mp_f_freemode_01';
    mp.players.local.model = mp.game.joaat(model);
    mp.players.local.setDefaultComponentVariation();

    mp.players.local.setComponentVariation(3, 15, 0, 0); 
    mp.players.local.setComponentVariation(8, 15, 0, 0); 
    mp.players.local.setComponentVariation(11, 15, 0, 0); 
});

// --- HERITAGE (Head Blend) ---
mp.events.add('client:creator:updateHeadBlend', (mom, dad, shapeMix, skinMix) => {
    mp.players.local.setHeadBlendData(
        parseInt(mom), parseInt(dad), 0,
        parseInt(mom), parseInt(dad), 0,
        parseFloat(shapeMix), parseFloat(skinMix), 0.0,
        false
    );
});

// --- FACE FEATURE ---
mp.events.add('client:creator:updateFaceFeature', (index, value) => {
    mp.players.local.setFaceFeature(parseInt(index), parseFloat(value));
});

// --- HAIR ---
mp.events.add('client:creator:updateHair', (style, color) => {
    mp.players.local.setComponentVariation(2, parseInt(style), 0, 0);
    mp.players.local.setHairColor(parseInt(color), 0);
});

// --- CLOTHING ---
mp.events.add('client:creator:updateClothes', (component, drawable, texture) => {
    mp.players.local.setComponentVariation(parseInt(component), parseInt(drawable), parseInt(texture), 0);
});

// --- ROTATE ---
mp.events.add('client:creator:rotate', (amount) => {
    let currentHeading = mp.players.local.getHeading();
    mp.players.local.setHeading(currentHeading + amount);
});

// --- EYE COLOR ---
mp.events.add('client:creator:updateEyeColor', (color) => {
    mp.players.local.setEyeColor(parseInt(color));
});

// --- FACE OVERLAYS (Eyebrows, Facial Hair, Makeup, etc.) ---
mp.events.add('client:creator:updateOverlay', (overlayId, style, opacity, color1, color2) => {
    overlayId = parseInt(overlayId);
    style     = parseInt(style);
    opacity   = parseFloat(opacity);
    color1    = parseInt(color1);
    color2    = parseInt(color2);

    // RAGE:MP Client-side expects separate arguments, NOT an array
    if (style === 0) {
        // 255 = clear overlay
        mp.players.local.setHeadOverlay(overlayId, 255, 0.0, 0, 0);
    } else {
        mp.players.local.setHeadOverlay(overlayId, style, opacity, color1, color2);
    }
});

// --- FINISH & SAVE ---
mp.events.add('client:creator:finish', (json) => {
    mp.events.callRemote('server:creator:save', json);

    // Cleanup
    if (creatorBrowser) {
        creatorBrowser.destroy();
        creatorBrowser = null;
    }
    mp.game.cam.renderScriptCams(false, true, 2000, true, false);
    if (creatorCam) {
        creatorCam.destroy();
        creatorCam = null;
    }
    mp.gui.cursor.show(false, false);
    mp.game.ui.displayRadar(true);
    mp.game.ui.displayHud(true);
    mp.players.local.freezePosition(false);

    // Show overlay again (food, water, payday)
    mp.events.callLocal('toggleOverlay', true);
});
