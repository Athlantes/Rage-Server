// client_packages/camera.js

let isCameraActive = false;
let isSelfieMode = false;
let photoProcessor = null; // Hidden browser reference

// Initialize the hidden processor
mp.events.add('playerReady', () => {
    if (!photoProcessor) {
        photoProcessor = mp.browsers.new('package://utils/photoProcessor.html');
        photoProcessor.active = false; // Keep it hidden
    }
});

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

    if (mp.game.controls.isDisabledControlJustPressed(0, 25)) { 
        isSelfieMode = !isSelfieMode;
        mp.game.invoke("0x015C49A93E3E086E", isSelfieMode); 
    }
});

function takePhoto() {
    // Hide UI for clean shot
    mp.game.ui.displayRadar(false);
    mp.game.ui.displayHud(false);

    const filename = `photo_${Date.now()}.png`;

    setTimeout(() => {
        // 1. Take Screenshot (Saves to client's "screenshots" folder)
        mp.gui.takeScreenshot(filename, 1, 100, 0);

        // Flash Effect
        mp.game.graphics.startScreenEffect("CameraFlash", 0, false);
        mp.game.ui.displayRadar(true);
        mp.game.ui.displayHud(true);
        mp.gui.chat.push("Processing photo...");

        // 2. Wait 1 second for file to save, then process
        setTimeout(() => {
            if (photoProcessor) {
                photoProcessor.execute(`processPhoto('${filename}')`);
            }
        }, 1000);

    }, 50);
}

// 3. Receive Data from HTML and send to Server
mp.events.add('client:photo:uploadData', (base64Data) => {
    mp.events.callRemote('server:photo:save', base64Data);
    mp.gui.chat.push("~g~Uploading photo to server...");
});

mp.events.add('client:photo:error', (msg) => {
    mp.gui.chat.push(`~r~Error: ${msg}`);
});