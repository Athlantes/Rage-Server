// client_packages/phone/index.js

let phoneBrowser = null;
let isPhoneOpen = false;

// --- SCOOTER TRACKING VARIABLES ---
let scooterBlip = null;
let scooterMarker = null;

// --- CAMERA VARIABLES ---
let isCameraActive = false;
let cameraFlashAlpha = 0;

mp.events.add('playerReady', () => {
    if (!phoneBrowser) {
        phoneBrowser = mp.browsers.new('package://phone/ui/index.html');
        phoneBrowser.active = true;
    }
});

// --- KEYBINDS ---
mp.keys.bind(0x26, true, () => { // Up Arrow
    if (mp.gui.chat.visible || isCameraActive) return; // Block phone if camera is active
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

// Camera Shutter Button (Left Click - 0x01)
mp.keys.bind(0x01, true, () => {
    if (isCameraActive) {
        takePhoto();
    }
});

// Exit Camera (Right Click - 0x02 or Backspace - 0x08)
mp.keys.bind(0x08, true, () => {
    if (isCameraActive) {
        closeCamera();
    }
});

// --- CLEAR MARKERS ON ENTRY ---
mp.events.add('playerEnterVehicle', (vehicle, seat) => {
    if (isPhoneOpen) {
        closePhone();
        mp.game.graphics.notify("~y~Phone closed for safety.");
    }
    
    // If we have a scooter marker active, clear it when we get on a vehicle
    if (scooterBlip || scooterMarker) {
        clearScooterMarkers();
    }
});

// --- RENDER FLASH EFFECT ---
mp.events.add('render', () => {
    if (cameraFlashAlpha > 0) {
        mp.game.graphics.drawRect(0.5, 0.5, 1.0, 1.0, 255, 255, 255, Math.floor(cameraFlashAlpha));
        cameraFlashAlpha -= 5; // Fade out speed
        if (cameraFlashAlpha < 0) cameraFlashAlpha = 0;
    }
    
    // Optional: Draw simple camera viewfinder text
    if (isCameraActive) {
        mp.game.graphics.drawText("LMB: SNAP | BACKSPACE: EXIT", [0.5, 0.9], { 
            font: 4, 
            color: [255, 255, 255, 255], 
            scale: [0.5, 0.5], 
            outline: true 
        });
    }
});

// --- HELPER FUNCTIONS ---

function closePhone() {
    isPhoneOpen = false;
    mp.gui.cursor.show(false, false);
    mp.gui.chat.activate(true); 
    if(phoneBrowser) phoneBrowser.execute(`closePhone()`);
}

function clearScooterMarkers() {
    if (scooterBlip) { scooterBlip.destroy(); scooterBlip = null; }
    if (scooterMarker) { scooterMarker.destroy(); scooterMarker = null; }
}

// --- CAMERA FUNCTIONS ---

function openCamera() {
    closePhone(); // Close UI first
    isCameraActive = true;
    mp.game.ui.displayRadar(false); // Hide Minimap
    mp.gui.chat.show(false); // Hide Chat
    
    // Optional: Force First Person View
    // mp.game.cam.setFollowPedCamViewMode(4); 
}

function closeCamera() {
    isCameraActive = false;
    mp.game.ui.displayRadar(true);
    mp.gui.chat.show(true);
    
    // Re-open phone automatically for convenience
    isPhoneOpen = true;
    mp.events.callRemote('server:phone:open');
    mp.gui.cursor.show(true, true);
    phoneBrowser.execute(`openPhone()`);
}

function takePhoto() {
    cameraFlashAlpha = 200; // Trigger Flash Visual
    mp.game.audio.playSoundFrontend(-1, "Camera_Shoot", "Phone_SoundSet_Michael", true);

    // Simulated upload delay
    setTimeout(() => {
        // Placeholder image URL. 
        // In a real server, use mp.gui.takeScreenshot to get base64 and upload it.
        const mockUrl = "https://picsum.photos/400/600?random=" + Math.floor(Math.random() * 1000); 
        
        mp.events.callRemote('server:phone:camera:save', mockUrl);
    }, 200);
}

// --- STANDARD APP EVENTS ---
mp.events.add('client:phone:initialize', (mailsJson) => {
    if(phoneBrowser) phoneBrowser.execute(`app.loadMails(${mailsJson})`);
});
mp.events.add('client:phone:receiveMail', (sender, title, message) => {
    if(phoneBrowser) phoneBrowser.execute(`app.receiveNotification('${sender}', '${title}', '${message}')`);
});
mp.events.add('client:phone:updateVehicles', (carsJson) => {
    if(phoneBrowser) phoneBrowser.execute(`app.loadVehicles(${carsJson})`);
});
// [NEW] Update Gallery
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

// --- PROXY HANDLER (Handling Server Responses) ---
mp.events.add('client:phone:proxyResponse', (action, data) => {
    if (phoneBrowser) {
        if (action === 'scooterAction') {
            
            // 1. Pass data to UI
            phoneBrowser.execute(`if(app.scooter) app.scooter.onScanResult(${JSON.stringify(data)})`);

            // 2. Handle Visuals (Blip/Marker)
            if (data.status === 'started' && data.x && data.y) {
                clearScooterMarkers();

                const targetPos = new mp.Vector3(data.x, data.y, data.z);

                scooterBlip = mp.blips.new(522, targetPos, {
                    name: "Your eScooter",
                    color: 2, 
                    scale: 1.0,
                    shortRange: false,
                });
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

// --- OUTGOING ACTIONS ---
mp.events.add('client:proxyAction', (action, data) => {
    switch (action) {
        case 'openCamera': openCamera(); break; // [NEW]
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
    if(player.vehicle) {
        player.taskLeaveVehicle(player.vehicle.handle, 0);
    }
});