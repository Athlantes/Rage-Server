// client_packages/phone/index.js

let phoneBrowser = null;
let isPhoneOpen = false;

// --- SCOOTER TRACKING VARIABLES ---
let scooterBlip = null;
let scooterMarker = null;

// --- CAMERA VARIABLES ---
let isCameraActive = false;
let isSelfie = false;
let cam = null;
let phoneObject = null;
let cameraFlashAlpha = 0;
let camAngleX = 0.0;
let camAngleZ = 0.0;

const CONTROLS = mp.game.controls;

mp.events.add('playerReady', () => {
    if (!phoneBrowser) {
        // Ensure we enable local file access for screenshots if needed, 
        // though standard HTTP fetch works for http://screenshots/
        phoneBrowser = mp.browsers.new('package://phone/ui/index.html');
        phoneBrowser.active = true;
    }
});

// --- KEYBINDS ---
mp.keys.bind(0x26, true, () => { // Up Arrow
    if (mp.gui.chat.visible || isCameraActive) return;
    if (mp.gui.cursor.visible && !isPhoneOpen) return;
    
    isPhoneOpen = !isPhoneOpen;
    
    if (isPhoneOpen) {
        mp.events.callRemote('server:phone:open');
        mp.gui.cursor.show(true, true);
        mp.gui.chat.activate(false); 
        phoneBrowser.execute(`openPhone()`);
    } else {
        closePhone();
    }
});

mp.keys.bind(0x28, true, () => { // Down Arrow
    if(isPhoneOpen) closePhone();
});

// --- CAMERA CONTROLS ---

// LMB - Take Photo
mp.keys.bind(0x01, true, () => { 
    if (isCameraActive) {
        takePhoto();
    }
});

// TAB - Toggle Selfie
mp.keys.bind(0x09, true, () => {
    if (isCameraActive) {
        isSelfie = !isSelfie;
        updateCameraMode();
    }
});

// Backspace/Right Click - Exit Camera
mp.keys.bind(0x08, true, () => { if (isCameraActive) closeCamera(); });
mp.keys.bind(0x02, true, () => { if (isCameraActive) closeCamera(); });

// --- RENDER LOOP ---
mp.events.add('render', () => {
    
    // 1. Flash Effect
    if (cameraFlashAlpha > 0) {
        mp.game.graphics.drawRect(0.5, 0.5, 1.0, 1.0, 255, 255, 255, Math.floor(cameraFlashAlpha));
        cameraFlashAlpha -= 5;
        if (cameraFlashAlpha < 0) cameraFlashAlpha = 0;
    }

    if (isCameraActive) {
        // 2. Disable Gameplay Controls
        CONTROLS.disableControlAction(0, 30, true); // Move LR
        CONTROLS.disableControlAction(0, 31, true); // Move UD
        CONTROLS.disableControlAction(0, 24, true); // Attack
        CONTROLS.disableControlAction(0, 257, true); // Attack 2
        CONTROLS.disableControlAction(0, 44, true); // Cover
        CONTROLS.disableControlAction(0, 22, true); // Jump
        CONTROLS.disableControlAction(0, 0, true);  // View Mode

        // 3. Handle Mouse Look
        let mouseX = CONTROLS.getDisabledControlNormal(0, 1);
        let mouseY = CONTROLS.getDisabledControlNormal(0, 2);

        const sens = 4.0;
        camAngleZ -= mouseX * sens;
        camAngleX -= mouseY * sens;

        if (camAngleX > 89.0) camAngleX = 89.0;
        if (camAngleX < -89.0) camAngleX = -89.0;

        if (cam) {
            updateCameraPosition();
        }

        mp.game.graphics.drawText("TAB: FLIP | LMB: SNAP | BACKSPACE: EXIT", [0.5, 0.93], { 
            font: 4, color: [255, 255, 255, 200], scale: [0.4, 0.4], outline: true 
        });
    }
});

// --- CAMERA LOGIC ---

async function openCamera() {
    // 1. Close UI & Hide Cursor
    if(phoneBrowser) phoneBrowser.execute("app.closePhoneForCamera()");
    mp.gui.cursor.show(false, false);
    mp.game.ui.displayRadar(false);
    mp.game.ui.displayHud(false);

    isCameraActive = true;
    isSelfie = false;

    // 2. Load Animations
    await loadAnim("cellphone@");
    await loadAnim("cellphone@selfie");
    
    // 3. Create Phone Object (Safely)
    if (!phoneObject || !mp.objects.exists(phoneObject)) {
        const modelName = "prop_player_phone_01";
        const modelHash = mp.game.joaat(modelName);

        // Request Model
        mp.game.streaming.requestModel(modelHash);
        while (!mp.game.streaming.hasModelLoaded(modelHash)) await mp.game.waitAsync(10);
        
        // Create Object
        phoneObject = mp.objects.new(modelHash, mp.players.local.position, {
            rotation: new mp.Vector3(0,0,0),
            alpha: 255,
            dimension: mp.players.local.dimension
        });

        // SAFETY CHECK: Only attach if creation succeeded
        if (phoneObject) {
            // Wait 1 tick for the handle to be valid
            await mp.game.waitAsync(10);
            
            // Try/Catch the attachment just in case
            try {
                phoneObject.attachTo(mp.players.local.handle, 
                    mp.players.local.getBoneIndex(28422), // Right Hand
                    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, true, true, false, false, 2, true);
            } catch (e) {
                mp.game.graphics.notify("~r~Error attaching phone");
                console.error(e);
            }
        } else {
            mp.game.graphics.notify("~r~Error: Could not create phone object.");
        }
    }

    // 4. Create Camera
    if (cam) cam.destroy();
    cam = mp.cameras.new('default', mp.players.local.position, new mp.Vector3(0,0,0), 50);
    cam.setActive(true);
    mp.game.cam.renderScriptCams(true, false, 0, true, false);

    updateCameraMode();
}

function updateCameraMode() {
    const player = mp.players.local;
    player.clearTasks();

    if (isSelfie) {
        // SELFIE MODE
        player.taskPlayAnim("cellphone@selfie", "selfie", 8.0, 1.0, -1, 49, 0, false, false, false);
        
        // Attach camera to look at face
        cam.attachTo(player.handle, player.getBoneIndex(12844), 0.6, 0.0, 0.0, 0.0, 0.0, 0.0, true, false, false);
        cam.pointAtPedBone(player.handle, 12844, 0.0, 0.0, 0.0, true);
        
    } else {
        // BACK CAMERA (First Person-ish)
        player.taskPlayAnim("cellphone@", "cellphone_text_read_base", 8.0, 1.0, -1, 49, 0, false, false, false);
        
        // Attach camera slightly in front of head
        cam.attachTo(player.handle, player.getBoneIndex(12844), 0.0, 0.5, 0.0, 0.0, 0.0, 0.0, true, false, false);
        
        // Make it look where player is looking
        // (This simple attach is rigid; for better looking, we usually use the render loop from the previous code)
    }
}

function closeCamera() {
    isCameraActive = false;
    
    // 1. Destroy Camera
    if (cam) {
        cam.destroy();
        cam = null;
    }
    mp.game.cam.renderScriptCams(false, false, 0, true, false);

    // 2. Remove Phone Object
    if (phoneObject) {
        phoneObject.destroy();
        phoneObject = null;
    }

    // 3. Restore UI
    mp.game.ui.displayRadar(true);
    mp.game.ui.displayHud(true);
    mp.players.local.clearTasks();

    // 4. Re-open Phone UI and SHOW CURSOR
    mp.gui.cursor.show(true, true);
    if(phoneBrowser) phoneBrowser.execute("app.openPhoneFromCamera()");
}

async function loadAnim(dict) {
    mp.game.streaming.requestAnimDict(dict);
    while (!mp.game.streaming.hasAnimDictLoaded(dict)) await mp.game.waitAsync(10);
}

// --- NEW PHOTO SYSTEM ---
function takePhoto() {
    if(!phoneBrowser) return;

    cameraFlashAlpha = 200; 
    mp.game.audio.playSoundFrontend(-1, "Camera_Shoot", "Phone_SoundSet_Michael", true);
    
    // 1. Generate unique name
    const filename = `photo_${Date.now()}.png`;

    // 2. Take Screenshot (Saves to RAGEMP/screenshots/IP_PORT/filename)
    mp.gui.takeScreenshot(filename, 1, 100, 0);

    // 3. Wait for save, then tell UI to upload
    setTimeout(() => {
        mp.game.graphics.notify("~g~Uploading...");
        phoneBrowser.execute(`app.uploadScreenshot('${filename}')`);
    }, 1000); // 1s delay to ensure file write
}

// --- EVENTS & PROXY ---

mp.events.add('playerEnterVehicle', (vehicle, seat) => {
    if (isPhoneOpen) {
        closePhone();
        mp.game.graphics.notify("~y~Phone closed for safety.");
    }
    if (scooterBlip || scooterMarker) clearScooterMarkers();
});

function clearScooterMarkers() {
    if (scooterBlip) { scooterBlip.destroy(); scooterBlip = null; }
    if (scooterMarker) { scooterMarker.destroy(); scooterMarker = null; }
}

function closePhone() {
    isPhoneOpen = false;
    mp.gui.cursor.show(false, false);
    mp.gui.chat.activate(true); 
    if(phoneBrowser) phoneBrowser.execute(`closePhone()`);
}

// ... (Phone Initialize events remain the same) ...
mp.events.add('client:phone:initialize', (mailsJson) => {
    if(phoneBrowser) phoneBrowser.execute(`app.loadMails(${mailsJson})`);
});
mp.events.add('client:phone:receiveMail', (sender, title, message) => {
    if(phoneBrowser) phoneBrowser.execute(`app.receiveNotification('${sender}', '${title}', '${message}')`);
});
mp.events.add('client:phone:updateVehicles', (carsJson) => {
    if(phoneBrowser) phoneBrowser.execute(`app.loadVehicles(${carsJson})`);
});
mp.events.add('client:phone:updateGallery', (photosJson) => {
    if(phoneBrowser) phoneBrowser.execute(`app.loadGallery(${photosJson})`);
});
mp.events.add('client:closePhoneWrapper', () => {
    isPhoneOpen = false;
    mp.gui.cursor.show(false, false);
});
mp.events.add('client:phone:bank:data', (json) => {
    if (phoneBrowser) phoneBrowser.execute(`app.loadBankData(${json})`);
});
mp.events.add('client:phone:quickEats:update', (isActive, status, loc) => {
    if(phoneBrowser) phoneBrowser.execute(`app.updateQuickEatsUI(${isActive}, '${status}', ${loc ? `'${loc}'` : 'null'})`);
});

mp.events.add('client:phone:proxyResponse', (action, data) => {
    if (phoneBrowser && action === 'scooterAction') {
        phoneBrowser.execute(`if(app.scooter) app.scooter.onScanResult(${JSON.stringify(data)})`);
        // ... (Scooter marker logic remains same) ...
        if (data.status === 'started' && data.x && data.y) {
                clearScooterMarkers();
                const targetPos = new mp.Vector3(data.x, data.y, data.z);
                scooterBlip = mp.blips.new(522, targetPos, { name: "Your eScooter", color: 2, scale: 1.0, shortRange: false });
                scooterBlip.setRoute(true);
                scooterMarker = mp.markers.new(1, new mp.Vector3(data.x, data.y, data.z - 1.0), 1.2, {
                    direction: new mp.Vector3(0, 0, 0), rotation: new mp.Vector3(0, 0, 0), color: [50, 205, 50, 100], visible: true, dimension: mp.players.local.dimension
                });
        }
    }
});

mp.events.add('client:phone:appCallback', (appName, funcName) => {
    if (phoneBrowser && appName === 'scooter') {
        if (funcName === 'startRide') phoneBrowser.execute(`if(app.scooter) app.scooter.startRide()`);
        if (funcName === 'endRide') clearScooterMarkers();
    }
});

// --- UPDATED PROXY HANDLER ---
mp.events.add('client:proxyAction', (action, data) => {
    switch (action) {
        case 'openCamera': openCamera(); break;
        // NEW: Handle photo save from UI
        case 'savePhoto': mp.events.callRemote('server:phone:camera:save', data); break;
        
        case 'requestBankData': mp.events.callRemote('server:phone:bank:open'); break;
        case 'toggleQuickEats': mp.events.callRemote('server:phone:quickEats:toggle'); break;
        case 'bankTransfer': 
            const transferData = JSON.parse(data); 
            mp.events.callRemote('server:phone:bank:transfer', transferData.t, transferData.a);
            break;
        case 'readMail': mp.events.callRemote('server:phone:readMail', data); break;
        case 'readAllMails': mp.events.callRemote('server:phone:readAllMails'); break;
        case 'scooterAction': mp.events.callRemote('server:phone:scooterAction', data); break;
        default: mp.events.callRemote('server:phone:vehicleAction', action, data); break;
    }
});

mp.events.add('client:leaveVehicle', () => {
    const player = mp.players.local;
    if(player.vehicle) player.taskLeaveVehicle(player.vehicle.handle, 0);
});