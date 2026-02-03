let isCameraActive = false;
let isSelfieMode = false; // 1. New variable to track selfie state

mp.events.add("client:toggleCamera", () => {
    isCameraActive = !isCameraActive;

    if (isCameraActive) {
        mp.game.mobile.createMobilePhone(0);
        mp.game.mobile.scriptIsMovingMobilePhoneOffscreen(false);
        mp.game.mobile.cellCamActivate(true, true);
        mp.gui.chat.push("Camera Active. [LMB] Photo | [RMB] Selfie");
    } else {
        closeCamera();
    }
});

function closeCamera() {
    isCameraActive = false;
    
    // 2. Reset selfie mode so it doesn't stay stuck for next time
    isSelfieMode = false; 
    
    mp.game.mobile.cellCamActivate(false, false);
    mp.game.invoke("0x3BC861DF703E5097", mp.players.local.handle, true); 
    mp.gui.chat.push("Camera Closed.");
}

mp.events.add("render", () => {
    if (!isCameraActive) return;

    mp.game.controls.disableControlAction(0, 24, true); 
    mp.game.controls.disableControlAction(0, 25, true); 

    if (mp.game.controls.isDisabledControlJustPressed(0, 24)) {
        takePhoto();
    }

    if (mp.game.controls.isDisabledControlJustPressed(0, 25)) { // Right Mouse Button
        // 3. Flip the variable (true -> false, or false -> true)
        isSelfieMode = !isSelfieMode;
        
        // 4. Pass the variable instead of "true"
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