let creatorBrowser = null;
let creatorCam = null;

mp.events.add('client:creator:start', () => {
    // 1. Position Player
    const pos = new mp.Vector3(402.8664, -996.4108, -99.00027);
    mp.players.local.position = pos;
    mp.players.local.setHeading(180);
    mp.players.local.freezePosition(true);
    mp.players.local.setVisible(true, false);
    mp.players.local.setAlpha(255);

    // 2. Camera
    creatorCam = mp.cameras.new('default', new mp.Vector3(402.8664, -997.5, -98.3), new mp.Vector3(0,0,0), 40);
    creatorCam.pointAtCoord(402.8664, -996.4108, -98.5);
    creatorCam.setActive(true);
    mp.game.cam.renderScriptCams(true, false, 0, true, false);

    // 3. UI
    mp.gui.cursor.show(true, true);
    mp.game.ui.displayRadar(false);
    mp.game.ui.displayHud(false);

    if (!creatorBrowser) {
        creatorBrowser = mp.browsers.new("package://ui/creator/index.html");
    }
});

// --- UI EVENTS ---

mp.events.add('client:creator:updateGender', (gender) => {
    const model = (gender === 0) ? 'mp_m_freemode_01' : 'mp_f_freemode_01';
    mp.players.local.model = mp.game.joaat(model);
    mp.players.local.setDefaultComponentVariation();
});

mp.events.add('client:creator:updateHeadBlend', (mom, dad, mix) => {
    mp.players.local.setHeadBlendData(mom, dad, 0, mom, dad, 0, mix, mix, 0.0, false);
});

mp.events.add('client:creator:updateFaceFeature', (index, value) => {
    mp.players.local.setFaceFeature(parseInt(index), parseFloat(value));
});

mp.events.add('client:creator:updateHair', (style, color) => {
    mp.players.local.setComponentVariation(2, parseInt(style), 0, 0);
    mp.players.local.setHairColor(parseInt(color), 0);
});

mp.events.add('client:creator:updateClothes', (component, drawable, texture) => {
    mp.players.local.setComponentVariation(parseInt(component), parseInt(drawable), parseInt(texture), 0);
});

mp.events.add('client:creator:finish', (json) => {
    mp.events.callRemote('server:creator:save', json);
    
    // Cleanup
    if(creatorBrowser) {
        creatorBrowser.destroy();
        creatorBrowser = null;
    }
    mp.game.cam.renderScriptCams(false, true, 2000, true, false);
    if(creatorCam) creatorCam.destroy();
    mp.gui.cursor.show(false, false);
    mp.game.ui.displayRadar(true);
    mp.game.ui.displayHud(true);
});