// client_packages/phone/index.js

let phoneBrowser = null;
let isPhoneOpen = false;

// --- SCOOTER TRACKING VARIABLES ---
let scooterBlip = null;
let scooterMarker = null;

mp.events.add('playerReady', () => {
    if (!phoneBrowser) {
        phoneBrowser = mp.browsers.new('package://phone/ui/index.html');
        phoneBrowser.active = true;
    }
});

// --- KEYBINDS ---
mp.keys.bind(0x26, true, () => { // Up Arrow
    if (mp.gui.chat.visible) return;
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

mp.keys.bind(0x1B, false, function() {
    if (isPhoneOpen) closePhone();
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
    
    // If we have a scooter marker active, clear it when we get on a vehicle
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
                // Clear old ones just in case
                clearScooterMarkers();

                const targetPos = new mp.Vector3(data.x, data.y, data.z);

                // Create Blip (Icon on Map)
                scooterBlip = mp.blips.new(522, targetPos, {
                    name: "Your eScooter",
                    color: 2, 
                    scale: 1.0,
                    shortRange: false,
                });
                scooterBlip.setRoute(true); // Adds the yellow GPS path on minimap

                // Create Marker (Type 1 = Vertical Cylinder)
                // Adjusted Z - 1.0 to sit nicely on the ground
                scooterMarker = mp.markers.new(1, new mp.Vector3(data.x, data.y, data.z - 1.0), 1.2, {
                    direction: new mp.Vector3(0, 0, 0),
                    rotation: new mp.Vector3(0, 0, 0),
                    color: [50, 205, 50, 100], // Lime Green Transparent
                    visible: true,
                    dimension: mp.players.local.dimension
                });
            }
        }
    }
});

mp.events.add('client:phone:findScooterSpawn', () => {
    const player = mp.players.local;
    const pos = player.position;
    const heading = player.getHeading();
    const distance = 5.0; // Distance behind player (reduced slightly for reliability)

    // Calculate position behind the player
    const rad = heading * (Math.PI / 180);
    const backX = pos.x + (Math.sin(rad) * distance); 
    const backY = pos.y + (-Math.cos(rad) * distance);

    // FIX: Correct arguments for getClosestVehicleNode
    // Args: x, y, z, nodeType (1=roads), p5 (3.0), p6 (0)
    const spawnPos = mp.game.pathfind.getClosestVehicleNode(backX, backY, pos.z, 1, 3.0, 0);

    if (spawnPos) {
        // Found a valid road/sidewalk
        // spawnPos is usually returned as a Vector3 object directly
        mp.events.callRemote('server:scooter:performRent', spawnPos);
    } else {
        // Fallback: Just use the calculated back position if no node found
        mp.events.callRemote('server:scooter:performRent', new mp.Vector3(backX, backY, pos.z));
    }
});

mp.events.add('client:phone:appCallback', (appName, funcName) => {
    if (phoneBrowser && appName === 'scooter') {
        if (funcName === 'startRide') phoneBrowser.execute(`if(app.scooter) app.scooter.startRide()`);
        
        if (funcName === 'endRide') {
            clearScooterMarkers();
            phoneBrowser.execute(`if(app.scooter && app.scooter.endRide) app.scooter.endRide()`);
        }
    }
});

mp.events.add('client:phone:initialize', (mailsJson, photosJson, mediaUrl) => {
    // 1. Debug Log to Client Console (Press F8 to see this)
    mp.gui.chat.push(`[Phone Debug] Init Received.`);
    mp.gui.chat.push(`[Phone Debug] Photos JSON Length: ${photosJson ? photosJson.length : 'NULL'}`);
    mp.gui.chat.push(`[Phone Debug] URL: ${mediaUrl}`);

    if(phoneBrowser) {
        // 2. Load Mails safely
        if(mailsJson) {
            phoneBrowser.execute(`
                try { 
                    app.loadMails(${mailsJson}); 
                } catch(e) { 
                    console.error("Mail Load Error: " + e.message); 
                }
            `);
        }

        // 3. Load Photos safely
        // We check if photosJson is valid string, if not send empty array "[]"
        const safePhotos = (photosJson && photosJson.length > 2) ? photosJson : "[]";
        
        phoneBrowser.execute(`
            try {
                console.log("JS: Loading Photos...");
                app.loadPhotos(${safePhotos}, '${mediaUrl}');
            } catch(e) {
                console.error("Photo Load Error: " + e.message);
                // Visual feedback in browser
                document.getElementById('gallery-grid').innerHTML = 'JS Error: ' + e.message;
            }
        `);
    }
});

// --- OUTGOING ACTIONS ---
mp.events.add('client:proxyAction', (action, data) => {
    switch (action) {
        case 'requestBankData': mp.events.callRemote('server:phone:bank:open'); break;
        case 'toggleQuickEats': mp.events.callRemote('server:phone:quickEats:toggle'); break;
        case 'bankTransfer': 
            const transferData = JSON.parse(data); 
            mp.events.callRemote('server:phone:bank:transfer', transferData.t, transferData.a);
            break;
        case 'readMail': mp.events.callRemote('server:phone:readMail', data); break;
        case 'readAllMails': mp.events.callRemote('server:phone:readAllMails'); break;
        case 'scooterAction': mp.events.callRemote('server:phone:scooterAction', data); break;
        
        // --- NEW: Delete Photo ---
        case 'deletePhoto':
            const photoData = JSON.parse(data); 
            mp.events.callRemote('server:phone:deletePhoto', photoData.id, photoData.path);
            break;

        default: mp.events.callRemote('server:phone:vehicleAction', action, data); break;
    }
});

mp.events.add('client:leaveVehicle', () => {
    const player = mp.players.local;
    if(player.vehicle) {
        player.taskLeaveVehicle(player.vehicle.handle, 0);
    }
});