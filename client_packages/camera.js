let isCameraActive = false;
let isSelfieMode = false;
let photoProcessor = null;
let cameraOverlay = null; // HUD Browser
let isUploading = false;

// --- INITIALIZATION & RECONNECT FIX ---
mp.events.add('playerReady', () => {
    // 1. Force cleanup in case of reload/reconnect
    forceCloseCamera();
    ensurePhotoProcessor();
});

function ensurePhotoProcessor() {
    if (!photoProcessor) {
        photoProcessor = mp.browsers.new('package://utils/photoProcessor.html');
        // photoProcessor.active = true; // Debug
    }
}

function forceCloseCamera() {
    isCameraActive = false;
    isSelfieMode = false;
    isUploading = false; // Reset upload flag on force close
    
    // Reset Game States
    mp.game.mobile.cellCamActivate(false, false);
    mp.game.ui.displayRadar(true);
    mp.game.ui.displayHud(true);
    mp.game.invoke("0x3BC861DF703E5097", mp.players.local.handle, true); // Put away phone native
    
    // Destroy Overlay if exists
    if (cameraOverlay) {
        cameraOverlay.destroy();
        cameraOverlay = null;
    }
}

// --- CAMERA TOGGLE ---
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
    ensurePhotoProcessor(); // Ensure processor exists
    
    // 1. Activate Native Phone Camera Mode
    mp.game.mobile.createMobilePhone(0);
    mp.game.mobile.scriptIsMovingMobilePhoneOffscreen(false);
    mp.game.mobile.cellCamActivate(true, true);

    // 2. Hide Game HUD
    mp.game.ui.displayRadar(false);
    mp.game.ui.displayHud(false);

    // 3. Create Custom HUD Overlay
    if (!cameraOverlay) {
        cameraOverlay = mp.browsers.new("data:text/html," + getCameraOverlayHTML());
    }

    mp.gui.chat.push("Camera Active. [LMB] Capture | [RMB] Selfie | [ESC] Close");
}

function closeCamera() {
    forceCloseCamera();
    mp.gui.chat.push("Camera Closed.");
}

// --- INPUTS ---
mp.keys.bind(0x1B, false, () => { // ESC Key
    if (isCameraActive) closeCamera();
});

mp.events.add("render", () => {
    if (!isCameraActive) return;

    // Disable Attack controls while using camera
    mp.game.controls.disableControlAction(0, 24, true); // Attack
    mp.game.controls.disableControlAction(0, 25, true); // Aim
    mp.game.controls.disableControlAction(0, 200, true); // ESC (We handle it manually)

    // Take Photo [LMB]
    if (mp.game.controls.isDisabledControlJustPressed(0, 24)) {
        if (!isUploading) takePhoto();
    }

    // Selfie Mode [RMB]
    if (mp.game.controls.isDisabledControlJustPressed(0, 25)) { 
        isSelfieMode = !isSelfieMode;
        mp.game.invoke("0x015C49A93E3E086E", isSelfieMode); // Toggle Selfie Native
    }
});

function takePhoto() {
    if (isUploading) return;
    isUploading = true;
    ensurePhotoProcessor();

    // Hide Custom HUD for screenshot
    if (cameraOverlay) cameraOverlay.active = false;

    const filename = `img_${Date.now()}.png`;

    // Slight delay to ensure UI is hidden
    setTimeout(() => {
        // Take Screenshot
        mp.gui.takeScreenshot(filename, 1, 100, 0);
        
        // Flash Effect
        setTimeout(() => {
            mp.game.graphics.startScreenEffect("CameraFlash", 0, false);
            mp.game.audio.playSoundFrontend(-1, "Camera_Shoot", "Phone_SoundSet_Default", true);

            // Show HUDs again (Custom HUD)
            if (cameraOverlay) {
                cameraOverlay.active = true;
                cameraOverlay.execute(`triggerFlash()`); // Visual feedback on HUD
            }
            
            // Check for Photo Hunt Targets
            mp.events.call('client:cameraCapture');

            mp.gui.chat.push("~b~Processing photo...");

            // Process Upload
            setTimeout(() => {
                if (photoProcessor) {
                    photoProcessor.execute(`processPhoto('${filename}')`);
                } else {
                    isUploading = false;
                    mp.gui.chat.push("~r~Error: Photo Processor missing.");
                }
            }, 1000); 

        }, 100); 
    }, 150);
}

// --- UPLOAD HANDLERS (RESTORED) ---

mp.events.add('client:photo:startUpload', (totalChunks) => {
    mp.gui.chat.push(`~y~Starting upload (${totalChunks} chunks)...`);
    mp.events.callRemote('server:photo:initUpload', totalChunks);
});

mp.events.add('client:photo:sendChunk', (chunkData, index) => {
    // Sending chunk to server
    mp.events.callRemote('server:photo:receiveChunk', chunkData, index);
});

mp.events.add('client:photo:complete', () => {
    isUploading = false;
    mp.gui.chat.push("~g~Photo saved to Gallery!");
});

mp.events.add('client:photo:error', (msg) => {
    isUploading = false;
    mp.gui.chat.push(`~r~Error: ${msg}`);
});

mp.events.add('client:photo:log', (msg) => {
    // console.log(msg); // Optional debug
});

// --- HELPER: CUSTOM HUD HTML ---
function getCameraOverlayHTML() {
    return `
    <html>
    <head>
        <style>
            body { margin: 0; padding: 0; overflow: hidden; font-family: 'Arial', sans-serif; }
            .overlay { position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; }
            
            /* Camera Corners */
            .corner { position: absolute; width: 50px; height: 50px; border: 3px solid rgba(255,255,255,0.7); }
            .tl { top: 40px; left: 40px; border-right: none; border-bottom: none; }
            .tr { top: 40px; right: 40px; border-left: none; border-bottom: none; }
            .bl { bottom: 40px; left: 40px; border-right: none; border-top: none; }
            .br { bottom: 40px; right: 40px; border-left: none; border-top: none; }

            /* Controls Guide */
            .controls { position: absolute; bottom: 50px; width: 100%; text-align: center; color: white; text-shadow: 1px 1px 2px black; font-size: 14px; opacity: 0.8; }

            /* Focus Square */
            .focus-square { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80px; height: 80px; border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 0 10px rgba(0,0,0,0.2); }

            @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
        </style>
    </head>
    <body>
        <div class="overlay">
            <div class="corner tl"></div>
            <div class="corner tr"></div>
            <div class="corner bl"></div>
            <div class="corner br"></div>

            <div class="focus-square"></div>

            <div class="controls">
                LMB: SHOOT • RMB: SELFIE • ESC: CLOSE
            </div>
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