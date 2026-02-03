// client_packages/phone/index.js

let phoneBrowser = null;
let isPhoneOpen = false;
let nativePhoneInitiated = false; // [NEW] Track if native phone exists

// --- SCOOTER TRACKING VARIABLES ---
let scooterBlip = null;
let scooterMarker = null;

mp.events.add('playerReady', () => {
    // [FIX] Reset state on load
    nativePhoneInitiated = false; 
    // Force destroy any lingering native phone from previous sessions
    mp.game.invoke("0x3BC861DF703E5097", mp.players.local.handle, true); 

    if (!phoneBrowser) {
        phoneBrowser = mp.browsers.new('package://phone/ui/index.html');
        phoneBrowser.active = true;
    }
});

// --- KEYBINDS ---
mp.keys.bind(0x26, true, () => { // Up Arrow
    if (mp.gui.chat.visible) return;
    if (mp.gui.cursor.visible && !isPhoneOpen) return;
    if (global.isCameraActive) return;

    isPhoneOpen = !isPhoneOpen;
    
    if (isPhoneOpen) {
        createPhoneProp(); // Use Native Phone
        
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

// --- CLEAR MARKERS ON ENTRY ---
mp.events.add('playerEnterVehicle', (vehicle, seat) => {
    if (isPhoneOpen) {
        closePhone();
        mp.game.graphics.notify("~y~Phone closed for safety.");
    }
    if (scooterBlip || scooterMarker) {
        clearScooterMarkers();
    }
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
    
    destroyPhoneProp(); // This now just "hides" it
}

// --- NATIVE PHONE HELPERS (FIXED) ---
function createPhoneProp() {
    // [FIX] Only create the native phone ONCE.
    if (!nativePhoneInitiated) {
        mp.game.mobile.createMobilePhone(0); // 0 = iFruit
        nativePhoneInitiated = true;
    }
    
    // [FIX] Just tell the game to "Show" the phone (Pull it out)
    mp.game.mobile.scriptIsMovingMobilePhoneOffscreen(false);
}

function destroyPhoneProp() {
    // [FIX] Do NOT destroy the phone object. Just tell game to "Hide" it (Put in pocket)
    mp.game.mobile.scriptIsMovingMobilePhoneOffscreen(true);
}

// --- RENDER LOOP: DISABLE NATIVE INPUTS ---
mp.events.add('render', () => {
    if (isPhoneOpen) {
        // [IMPORTANT] Block controls so you don't navigate the native phone underneath
        mp.game.controls.disableControlAction(0, 27, true); 
        mp.game.controls.disableControlAction(0, 172, true); 
        mp.game.controls.disableControlAction(0, 173, true); 
        mp.game.controls.disableControlAction(0, 174, true); 
        mp.game.controls.disableControlAction(0, 175, true); 
        mp.game.controls.disableControlAction(0, 176, true); 
        mp.game.controls.disableControlAction(0, 177, true); 
    }
});

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
mp.events.add('client:closePhoneWrapper', () => {
    closePhone();
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

// --- OUTGOING ACTIONS ---
mp.events.add('client:proxyAction', (action, data) => {
    switch (action) {
        case 'openCamera': 
            closePhone(); 
            mp.events.call('client:toggleCamera'); 
            break;
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