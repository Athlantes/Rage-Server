// client_packages/phone/index.js

let phoneBrowser = null;
let isPhoneOpen = false;

// --- PHONE PROP VARIABLES ---
let phoneProp = null;
const ANIM_DICT = "cellphone@";
const ANIM_NAME = "cellphone_text_read_base";
const PROP_NAME = "prop_npc_phone_02";

// --- SCOOTER TRACKING VARIABLES ---
let scooterBlip = null;
let scooterMarker = null;

mp.events.add('playerReady', () => {
    if (!phoneBrowser) {
        phoneBrowser = mp.browsers.new('package://phone/ui/index.html');
        phoneBrowser.active = true;
    }
    // Preload animation dictionary
    mp.game.streaming.requestAnimDict(ANIM_DICT);
});

// --- KEYBINDS ---
mp.keys.bind(0x26, true, () => { // Up Arrow
    if (mp.gui.chat.visible) return;
    if (mp.gui.cursor.visible && !isPhoneOpen) return;
    
    // Block if Camera is active (using global variable from camera.js)
    if (global.isCameraActive) return;

    isPhoneOpen = !isPhoneOpen;
    
    if (isPhoneOpen) {
        createPhoneProp(); // Create Visual Prop + Animation
        
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
    
    destroyPhoneProp(); // Remove Visual Prop
}

// --- PHONE PROP & ANIMATION HELPERS ---
function createPhoneProp() {
    if (phoneProp) return;
    
    const player = mp.players.local;
    
    // 1. Play Animation (Upper body only, allows walking)
    player.taskPlayAnim(ANIM_DICT, ANIM_NAME, 8.0, 1.0, -1, 49, 0, false, false, false);

    // 2. Create Object
    phoneProp = mp.objects.new(mp.game.joaat(PROP_NAME), player.position, {
        rotation: new mp.Vector3(0,0,0),
        alpha: 255,
        dimension: player.dimension
    });

    // 3. Attach to Right Hand (Bone 57005)
    // Offsets: x (forward/back), y (left/right), z (up/down) relative to bone
    phoneProp.attachTo(
        player.handle, 
        player.getBoneIndex(57005), 
        0.13, 0.05, -0.02, 
        -10, 110, 0, 
        true, true, false, false, 2, true
    );
}

function destroyPhoneProp() {
    const player = mp.players.local;
    
    // Stop Animation
    player.stopAnimTask(ANIM_DICT, ANIM_NAME, 3.0);
    
    // Destroy Object
    if (phoneProp) {
        phoneProp.destroy();
        phoneProp = null;
    }
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
        // New Camera App Action
        case 'openCamera': 
            closePhone(); // Removes UI and Prop
            mp.events.call('client:toggleCamera'); // Starts Native Camera
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