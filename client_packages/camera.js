// client_packages/camera.js

global.isCameraActive = false;
let isSelfieMode = false;

mp.events.add("client:toggleCamera", () => {
    // Toggle state
    global.isCameraActive = !global.isCameraActive;

    if (global.isCameraActive) {
        mp.game.mobile.createMobilePhone(0);
        mp.game.mobile.scriptIsMovingMobilePhoneOffscreen(false);
        mp.game.mobile.cellCamActivate(true, true);
    } else {
        closeCamera();
    }
});

function closeCamera() {
    global.isCameraActive = false;
    isSelfieMode = false; 
    
    mp.game.mobile.cellCamActivate(false, false);
    mp.game.invoke("0x3BC861DF703E5097", mp.players.local.handle, true); 
    
    mp.gui.chat.activate(true);
}

// 1. Add Escape Key to Close Camera
mp.keys.bind(0x1B, true, () => { // ESC Key
    if (global.isCameraActive) {
        closeCamera();
    }
});

mp.events.add("render", () => {
    if (!global.isCameraActive) return;

    // 2. Disable Pause Menu so ESC doesn't open the map
    mp.game.controls.disableControlAction(0, 199, true); // P
    mp.game.controls.disableControlAction(0, 200, true); // ESC
    mp.game.ui.setPauseMenuActive(false);

    mp.game.controls.disableControlAction(0, 24, true); 
    mp.game.controls.disableControlAction(0, 25, true); 

    if (mp.game.controls.isDisabledControlJustPressed(0, 24)) {
        takePhoto();
    }

    if (mp.game.controls.isDisabledControlJustPressed(0, 25)) { 
        isSelfieMode = !isSelfieMode;
        mp.game.invoke("0x015C49A93E3E086E", isSelfieMode); 
    }
});

function takePhoto() {
    mp.game.ui.displayRadar(false);
    mp.game.ui.displayHud(false);

    setTimeout(() => {
        mp.gui.takeScreenshot(`photo_${Date.now()}.png`, 1, 100, 0);
        mp.game.graphics.startScreenEffect("CameraFlash", 0, false);
        mp.game.ui.displayRadar(true);
        mp.game.ui.displayHud(true);
    }, 50);
}

mp.events.add('playerReady', () => {
    global.isCameraActive = false;
    isSelfieMode = false;
    
    // Force destroy the phone and camera natives
    mp.game.mobile.cellCamActivate(false, false);
    mp.game.invoke("0x3BC861DF703E5097", mp.players.local.handle, true); // Destroy Mobile Phone Native
});