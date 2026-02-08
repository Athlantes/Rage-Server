let isCameraActive = false;
let isSelfieMode = false;
let photoProcessor = null;
let cameraOverlay = null; 
let isUploading = false;

let lastTakenPhotoName = ""; 

mp.events.add('playerReady', () => {
    forceCloseCamera();
    ensurePhotoProcessor();
});

function ensurePhotoProcessor() {
    if (!photoProcessor) {
        photoProcessor = mp.browsers.new('package://utils/photoProcessor.html');
    }
}

function forceCloseCamera() {
    isCameraActive = false;
    isSelfieMode = false;
    isUploading = false;
    
    mp.game.mobile.cellCamActivate(false, false);
    mp.game.ui.displayRadar(true);
    mp.game.ui.displayHud(true);
    mp.game.invoke("0x3BC861DF703E5097", mp.players.local.handle, true); 
    
    if (cameraOverlay) {
        cameraOverlay.destroy();
        cameraOverlay = null;
    }
}

// --- EXPORTED EVENTS ---
mp.events.add("client:forceCloseCamera", () => {
    closeCamera();
});

mp.events.add("client:toggleCamera", () => {
    if (isUploading) return mp.gui.chat.push("~r~Please wait, uploading previous photo...");

    if (isCameraActive) {
        closeCamera();
    } else {
        openCamera();
    }
});

function openCamera() {
    isCameraActive = true;
    ensurePhotoProcessor(); 
    
    mp.game.mobile.createMobilePhone(0);
    mp.game.mobile.scriptIsMovingMobilePhoneOffscreen(false);
    mp.game.mobile.cellCamActivate(true, true);

    mp.game.ui.displayRadar(false);
    mp.game.ui.displayHud(false);

    if (!cameraOverlay) {
        cameraOverlay = mp.browsers.new("data:text/html," + getCameraOverlayHTML());
    }

    mp.gui.chat.push("Camera Active. [LMB] Capture | [RMB] Selfie | [ESC] Close");
}

function closeCamera() {
    forceCloseCamera();
}

mp.keys.bind(0x1B, false, () => { 
    if (isCameraActive) closeCamera();
});

mp.events.add("render", () => {
    if (!isCameraActive) return;

    mp.game.controls.disableControlAction(0, 24, true); 
    mp.game.controls.disableControlAction(0, 25, true); 
    mp.game.controls.disableControlAction(0, 200, true); 

    if (mp.game.controls.isDisabledControlJustPressed(0, 24)) {
        if (!isUploading) takePhoto();
    }

    if (mp.game.controls.isDisabledControlJustPressed(0, 25)) { 
        isSelfieMode = !isSelfieMode;
        mp.game.invoke("0x015C49A93E3E086E", isSelfieMode); 
    }
});

function takePhoto() {
    if (isUploading) return;
    isUploading = true;
    ensurePhotoProcessor();

    if (cameraOverlay) cameraOverlay.active = false;

    // --- FILENAME LOGIC (User ID + Timestamp) ---
    const myDbId = mp.players.local.getVariable('dbId') || 0;
    lastTakenPhotoName = `${myDbId}_${Date.now()}.jpg`;

    setTimeout(() => {
        // Type 0 = JPEG, Quality 100
        mp.gui.takeScreenshot(lastTakenPhotoName, 0, 100, 0);
        
        setTimeout(() => {
            mp.game.graphics.startScreenEffect("CameraFlash", 0, false);
            mp.game.audio.playSoundFrontend(-1, "Camera_Shoot", "Phone_SoundSet_Default", true);

            if (cameraOverlay) {
                cameraOverlay.active = true;
                cameraOverlay.execute(`triggerFlash()`); 
            }
            
            mp.events.call('client:cameraCapture');
            mp.gui.chat.push("~b~Processing photo...");

            setTimeout(() => {
                if (photoProcessor) {
                    photoProcessor.execute(`processPhoto('${lastTakenPhotoName}')`);
                } else {
                    isUploading = false;
                    mp.gui.chat.push("~r~Error: Photo Processor missing.");
                }
            }, 1000); 

        }, 100); 
    }, 150);
}

// --- UPLOAD HANDLERS ---

mp.events.add('client:photo:startUpload', (totalChunks) => {
    mp.gui.chat.push(`~y~Starting upload (${totalChunks} chunks)...`);
    // IMPORTANT: Send the specific filename to server so they match
    mp.events.callRemote('server:photo:initUpload', totalChunks, lastTakenPhotoName);
});

mp.events.add('client:photo:sendChunk', (chunkData, index) => {
    mp.events.callRemote('server:photo:receiveChunk', chunkData, index);
});

// Triggered by local CEF when it finishes sending data
mp.events.add('client:photo:complete', () => {
    // Wait for server confirmation now
    mp.gui.chat.push("~y~Finalizing...");
});

// --- NEW: TRIGGERED BY SERVER WHEN FILE IS SAFE ON DISK ---
mp.events.add('client:camera:uploadSuccess', (serverFilename) => {
    isUploading = false;
    mp.gui.chat.push("~g~Photo saved to Gallery!");
    
    // Now safe to tell Phone to display it
    mp.events.call('client:camera:photoSaved', serverFilename);
});

mp.events.add('client:photo:error', (msg) => {
    isUploading = false;
    mp.gui.chat.push(`~r~Error: ${msg}`);
});

mp.events.add('client:photo:log', (msg) => { });

function getCameraOverlayHTML() {
    return `
    <html>
    <head>
        <style>
            body { margin: 0; padding: 0; overflow: hidden; font-family: 'Arial', sans-serif; }
            .overlay { position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; }
            .corner { position: absolute; width: 50px; height: 50px; border: 3px solid rgba(255,255,255,0.7); }
            .tl { top: 40px; left: 40px; border-right: none; border-bottom: none; }
            .tr { top: 40px; right: 40px; border-left: none; border-bottom: none; }
            .bl { bottom: 40px; left: 40px; border-right: none; border-top: none; }
            .br { bottom: 40px; right: 40px; border-left: none; border-top: none; }
            .controls { position: absolute; bottom: 50px; width: 100%; text-align: center; color: white; text-shadow: 1px 1px 2px black; font-size: 14px; opacity: 0.8; }
            .focus-square { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80px; height: 80px; border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 0 10px rgba(0,0,0,0.2); }
        </style>
    </head>
    <body>
        <div class="overlay">
            <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
            <div class="focus-square"></div>
            <div class="controls">LMB: SHOOT • RMB: SELFIE • ESC: CLOSE</div>
        </div>
        <script>
            function triggerFlash() {
                document.body.style.backgroundColor = 'white';
                setTimeout(() => { document.body.style.backgroundColor = 'transparent'; }, 100);
            }
        </script>
    </body>
    </html>
    `;
}