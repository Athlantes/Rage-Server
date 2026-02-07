let isCameraActive = false;
let isSelfieMode = false;
let photoProcessor = null;
let isUploading = false; // Flag to prevent spam

mp.events.add('playerReady', () => {
    if (!photoProcessor) {
        photoProcessor = mp.browsers.new('package://utils/photoProcessor.html');
        // photoProcessor.active = true; // Debug only
    }
});

// --- Camera Toggle ---
mp.events.add("client:toggleCamera", () => {
    if (isUploading) return mp.gui.chat.push("~r~Please wait, uploading previous photo...");

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

// --- Inputs ---
mp.events.add("render", () => {
    if (!isCameraActive) return;

    mp.game.controls.disableControlAction(0, 24, true); 
    mp.game.controls.disableControlAction(0, 25, true); 

    if (mp.game.controls.isDisabledControlJustPressed(0, 24)) {
        if (!isUploading) takePhoto();
    }

    if (mp.game.controls.isDisabledControlJustPressed(0, 25)) { 
        isSelfieMode = !isSelfieMode;
        mp.game.invoke("0x015C49A93E3E086E", isSelfieMode); 
    }
});

function takePhoto() {
    isUploading = true; // Lock camera
    mp.game.ui.displayRadar(false);
    mp.game.ui.displayHud(false);

    const filename = `img_${Date.now()}.png`; // RAGE saves as png locally first

    setTimeout(() => {
        mp.gui.takeScreenshot(filename, 1, 100, 0);
        
        mp.game.graphics.startScreenEffect("CameraFlash", 0, false);
        mp.game.ui.displayRadar(true);
        mp.game.ui.displayHud(true);
        mp.gui.chat.push("~b~Processing image...");

        // Wait 1s for disk save
        setTimeout(() => {
            if (photoProcessor) {
                photoProcessor.execute(`processPhoto('${filename}')`);
            } else {
                isUploading = false;
            }
        }, 1000); 

    }, 100);
}

// --- Upload Events ---

mp.events.add('client:photo:startUpload', (totalChunks) => {
    mp.gui.chat.push(`~y~Starting upload (${totalChunks} chunks)...`);
    mp.events.callRemote('server:photo:initUpload', totalChunks);
});

mp.events.add('client:photo:sendChunk', (chunkData, index) => {
    // We don't log every chunk anymore to prevent chat spam
    mp.events.callRemote('server:photo:receiveChunk', chunkData, index);
});

mp.events.add('client:photo:complete', () => {
    isUploading = false;
    mp.gui.chat.push("~g~Upload Complete!");
});

mp.events.add('client:photo:error', (msg) => {
    isUploading = false;
    mp.gui.chat.push(`~r~Error: ${msg}`);
});

mp.events.add('client:photo:log', (msg) => {
    // console.log(msg); // Optional debug
});