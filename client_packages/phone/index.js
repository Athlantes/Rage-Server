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
// const camDist = 0.6; // Not strictly needed if calculated dynamically

const CONTROLS = mp.game.controls;

mp.events.add('playerReady', () => {
    if (!phoneBrowser) {
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
        toggleCameraMode();
    }
});

// Backspace/Right Click - Exit Camera
mp.keys.bind(0x08, true, () => { if (isCameraActive) closeCamera(); });
mp.keys.bind(0x02, true, () => { if (isCameraActive) closeCamera(); });

// --- RENDER LOOP (CONTROLS & CAMERA) ---
mp.events.add('render', () => {
    
    // 1. Flash Effect
    if (cameraFlashAlpha > 0) {
        mp.game.graphics.drawRect(0.5, 0.5, 1.0, 1.0, 255, 255, 255, Math.floor(cameraFlashAlpha));
        cameraFlashAlpha -= 5;
        if (cameraFlashAlpha < 0) cameraFlashAlpha = 0;
    }

    if (isCameraActive) {
        // 2. Disable Gameplay Controls (Movement & Combat)
        // Note: HUD hiding is now handled in openCamera/closeCamera to avoid the 'not a function' error
        
        CONTROLS.disableControlAction(0, 30, true); // Move LR (A/D)
        CONTROLS.disableControlAction(0, 31, true); // Move UD (W/S)
        CONTROLS.disableControlAction(0, 24, true); // Attack (LMB)
        CONTROLS.disableControlAction(0, 257, true); // Attack 2
        CONTROLS.disableControlAction(0, 44, true); // Cover
        CONTROLS.disableControlAction(0, 22, true); // Jump
        CONTROLS.disableControlAction(0, 0, true);  // Camera View Mode (V)

        // 3. Handle Mouse Look for Custom Camera
        let mouseX = CONTROLS.getDisabledControlNormal(0, 1);
        let mouseY = CONTROLS.getDisabledControlNormal(0, 2);

        // Adjust sensitivity
        const sens = 4.0;
        camAngleZ -= mouseX * sens;
        camAngleX -= mouseY * sens;

        // Clamp Vertical Angle
        if (camAngleX > 89.0) camAngleX = 89.0;
        if (camAngleX < -89.0) camAngleX = -89.0;

        if (cam) {
            updateCameraPosition();
        }

        // UI Text
        mp.game.graphics.drawText("TAB: FLIP | LMB: SNAP | BACKSPACE: EXIT", [0.5, 0.93], { 
            font: 4, color: [255, 255, 255, 200], scale: [0.4, 0.4], outline: true 
        });
    }
});

// --- CAMERA LOGIC ---

async function openCamera() {
    closePhone(); // Close UI
    isCameraActive = true;
    isSelfie = false;
    
    mp.gui.chat.show(false);
    mp.game.ui.displayRadar(false);
    mp.game.ui.displayHud(false); // Explicitly hide HUD

    // Initialize Rotation to player's current heading
    camAngleZ = mp.players.local.getRotation(2).z + 180; // Looking forward
    camAngleX = 0.0;

    // Load Anims & Model
    await loadAnim("cellphone@");
    await loadAnim("cellphone@selfie");
    
    // Create Phone Prop
    if (!phoneObject) {
        const modelName = "prop_player_phone_01";
        mp.game.streaming.requestModel(mp.game.joaat(modelName));
        while (!mp.game.streaming.hasModelLoaded(mp.game.joaat(modelName))) await mp.game.waitAsync(10);
        
        phoneObject = mp.objects.new(mp.game.joaat(modelName), mp.players.local.position, {
            rotation: new mp.Vector3(0,0,0),
            alpha: 255,
            dimension: mp.players.local.dimension
        });
        // Attach to Right Hand (Bone 28422)
        phoneObject.attachTo(mp.players.local.handle, 
            mp.players.local.getBoneIndex(28422), 
            0.0, 0.0, 0.0, 0.0, 0.0, 0.0, true, true, false, false, 2, true);
    }

    // Create Camera Object
    if (cam) cam.destroy();
    cam = mp.cameras.new('default', mp.players.local.position, new mp.Vector3(0,0,0), 40);
    cam.setActive(true);
    mp.game.cam.renderScriptCams(true, false, 0, true, false);

    setCameraMode("back");
}

function closeCamera() {
    isCameraActive = false;
    
    // Reset Visibility
    mp.players.local.setAlpha(255);
    mp.game.ui.displayRadar(true);
    mp.game.ui.displayHud(true); // Restore HUD
    mp.gui.chat.show(true);

    // Destroy Cam
    if (cam) {
        cam.destroy();
        cam = null;
    }
    mp.game.cam.renderScriptCams(false, false, 0, true, false);

    // Destroy Prop
    if (phoneObject) {
        phoneObject.destroy();
        phoneObject = null;
    }

    // Stop Anim
    mp.players.local.clearTasks();

    // Re-open Phone UI
    isPhoneOpen = true;
    mp.events.callRemote('server:phone:open');
    mp.gui.cursor.show(true, true);
    phoneBrowser.execute(`openPhone()`);
}

function toggleCameraMode() {
    isSelfie = !isSelfie;
    setCameraMode(isSelfie ? "selfie" : "back");
}

function setCameraMode(mode) {
    mp.players.local.clearTasks();

    if (mode === "back") {
        // BACK CAMERA
        // 1. Hide Player (so we don't see head clipping)
        mp.players.local.setAlpha(0);
        // 2. Play generic holding anim
        mp.players.local.taskPlayAnim("cellphone@", "cellphone_text_read_base", 8.0, 1.0, -1, 49, 0, false, false, false);
    } else {
        // SELFIE CAMERA
        // 1. Show Player
        mp.players.local.setAlpha(255);
        // 2. Play selfie anim
        mp.players.local.taskPlayAnim("cellphone@selfie", "selfie", 8.0, 1.0, -1, 49, 0, false, false, false);
        
        // Reset angle to look AT player roughly
        camAngleZ = mp.players.local.getRotation(2).z; 
        camAngleX = 0.0;
    }
    updateCameraPosition();
}

function updateCameraPosition() {
    if (!cam) return;

    // Convert spherical coordinates to Cartesian for rotation
    const radZ = camAngleZ * (Math.PI / 180);
    const radX = camAngleX * (Math.PI / 180);

    // Direction vector of the camera
    const dirX = -Math.sin(radZ) * Math.cos(radX);
    const dirY = Math.cos(radZ) * Math.cos(radX);
    const dirZ = Math.sin(radX);

    const headPos = mp.players.local.getBoneCoords(12844, 0, 0, 0); // Head Bone

    if (isSelfie) {
        // Orbit around the head
        // Cam pos is roughly in front of face
        const dist = 0.7; // Arm length approx
        
        // We want the camera to be "dist" away in the direction of our angles
        const camPos = new mp.Vector3(
            headPos.x - (dirX * dist),
            headPos.y - (dirY * dist),
            headPos.z - (dirZ * dist)
        );
        cam.setCoord(camPos.x, camPos.y, camPos.z);
        
        // Camera looks AT the head
        cam.pointAtCoord(headPos.x, headPos.y, headPos.z);
    } else {
        // First Person / Back Cam
        // Cam is exactly at eye level (or slightly forward to prevent hair clipping)
        const camPos = new mp.Vector3(
            headPos.x + (dirX * 0.1),
            headPos.y + (dirY * 0.1),
            headPos.z + (dirZ * 0.1)
        );
        
        cam.setCoord(camPos.x, camPos.y, camPos.z);
        cam.setRot(camAngleX, 0, camAngleZ, 2);
    }
}

async function loadAnim(dict) {
    mp.game.streaming.requestAnimDict(dict);
    while (!mp.game.streaming.hasAnimDictLoaded(dict)) await mp.game.waitAsync(10);
}

function takePhoto() {
    cameraFlashAlpha = 200; // Visual Flash
    mp.game.audio.playSoundFrontend(-1, "Camera_Shoot", "Phone_SoundSet_Michael", true);
    
    // Simulate upload delay
    setTimeout(() => {
        const mockUrl = "https://picsum.photos/400/600?random=" + Math.floor(Math.random() * 1000); 
        mp.events.callRemote('server:phone:camera:save', mockUrl);
    }, 200);
}

// --- STANDARD APP EVENTS ---

// Clear markers on entry
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

// Phone Events
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

// Proxy Handler
mp.events.add('client:phone:proxyResponse', (action, data) => {
    if (phoneBrowser) {
        if (action === 'scooterAction') {
            phoneBrowser.execute(`if(app.scooter) app.scooter.onScanResult(${JSON.stringify(data)})`);

            if (data.status === 'started' && data.x && data.y) {
                clearScooterMarkers();
                const targetPos = new mp.Vector3(data.x, data.y, data.z);

                scooterBlip = mp.blips.new(522, targetPos, { name: "Your eScooter", color: 2, scale: 1.0, shortRange: false });
                scooterBlip.setRoute(true);

                scooterMarker = mp.markers.new(1, new mp.Vector3(data.x, data.y, data.z - 1.0), 1.2, {
                    direction: new mp.Vector3(0, 0, 0),
                    rotation: new mp.Vector3(0, 0, 0),
                    color: [50, 205, 50, 100], 
                    visible: true,
                    dimension: mp.players.local.dimension
                });
            }
        }
    }
});

mp.events.add('client:phone:appCallback', (appName, funcName) => {
    if (phoneBrowser && appName === 'scooter') {
        if (funcName === 'startRide') phoneBrowser.execute(`if(app.scooter) app.scooter.startRide()`);
        if (funcName === 'endRide') clearScooterMarkers();
    }
});

// Outgoing Actions
mp.events.add('client:proxyAction', (action, data) => {
    switch (action) {
        case 'openCamera': openCamera(); break;
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