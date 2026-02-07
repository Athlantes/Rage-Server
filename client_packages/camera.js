let isCameraActive = false;
let isSelfieMode = false;
let photoProcessor = null;

mp.events.add('playerReady', () => {
    if (!photoProcessor) {
        photoProcessor = mp.browsers.new('package://utils/photoProcessor.html');
        // photoProcessor.active = true; // Uncomment if you need to debug the white screen
    }
});

mp.events.add('client:photo:startUpload', (totalChunks, filename) => {
    mp.gui.chat.push(`~y~[Camera] Uploading... (0/${totalChunks})`);
    // Tell server a new upload is coming
    mp.events.callRemote('server:photo:initUpload', totalChunks);
});

mp.events.add('client:photo:sendChunk', (chunkData) => {
    // Send individual chunk to server
    mp.events.callRemote('server:photo:receiveChunk', chunkData);
});

// Helper for debug logs
mp.events.add('client:photo:log', (msg) => {
    mp.gui.chat.push(`~y~[Debug] ${msg}`);
});

mp.events.add('client:photo:error', (msg) => {
    mp.gui.chat.push(`~r~Photo Error: ${msg}`);
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
    mp.game.ui.displayRadar(false);
    mp.game.ui.displayHud(false);

    const filename = `img_${Date.now()}.png`;

    setTimeout(() => {
        mp.gui.takeScreenshot(filename, 1, 100, 0);
        
        mp.game.graphics.startScreenEffect("CameraFlash", 0, false);
        mp.game.ui.displayRadar(true);
        mp.game.ui.displayHud(true);

        setTimeout(() => {
            if (photoProcessor) {
                photoProcessor.execute(`processPhoto('${filename}')`);
            }
        }, 1000); 
    }, 100);
}

mp.events.add('client:photo:uploadData', (base64Data) => {
    mp.gui.chat.push("~g~Uploading to server...");
    // 3. Send to Server
    mp.events.callRemote('server:photo:save', base64Data);
});

mp.events.add('client:photo:error', (msg) => {
    mp.gui.chat.push(`~r~Error: ${msg}`);
});