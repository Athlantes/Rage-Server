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

mp.events.add('client:phone:chat:loadChats', (chatsJson) => {
    if (phoneBrowser) phoneBrowser.execute(`messenger.loadChats('${chatsJson.replace(/'/g, "\\'")}')`);
});

mp.events.add('client:phone:chat:loadHistory', (targetNumber, msgsJson) => {
    if (phoneBrowser) phoneBrowser.execute(`messenger.loadHistory('${targetNumber}', '${msgsJson.replace(/'/g, "\\'")}')`);
});

// Real-time receive
mp.events.add('client:phone:chat:receive', (sender, content, type, timestamp, msgId) => {
    if (phoneBrowser) {
        // Create a temporary object to pass to appendMessage
        const msgObj = JSON.stringify({
            sender_number: sender,
            message: content,
            created_at: timestamp
        });
        
        phoneBrowser.execute(`
            if (messenger.activeChatNumber === '${sender}') {
                messenger.appendMessage(${msgObj});
            } else {
                app.showToast('${sender}', 'New Message', '${content}');
                // Optional: refresh list if they are on the list screen
                if(!document.getElementById('msg-list-screen').classList.contains('hidden')) {
                     mp.trigger('client:proxyAction', 'chat:fetchChats');
                }
            }
        `);
    }
});

// Real-time sent (Echo back)
mp.events.add('client:phone:chat:messageSent', (target, content, type, timestamp, msgId) => {
    if (phoneBrowser) {
         const msgObj = JSON.stringify({
            sender_number: 'me', // distinct from target
            message: content,
            created_at: timestamp
        });
        phoneBrowser.execute(`if(messenger.activeChatNumber === '${target}') messenger.appendMessage(${msgObj});`);
    }
});

mp.events.add('client:phone:contacts:load', (contactsJson) => {
    if (phoneBrowser) phoneBrowser.execute(`messenger.loadContacts('${contactsJson.replace(/'/g, "\\'")}')`);
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
        mp.events.callRemote('server:scooter:performRent', spawnPos);
    } else {
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

    if (appName === 'camera' && funcName === 'open') {
        closePhone(); // Close the phone UI (hide cursor/browser)
        mp.events.call('client:toggleCamera'); // Trigger the camera script
    }
});

// --- OPTIMIZED INITIALIZATION ---
mp.events.add('client:phone:initialize', (mailsJson, photosJson, mediaUrl, settingsJson) => {
    // Debug Log
    mp.gui.chat.push(`[Phone Debug] Init Data Received.`);

    if(phoneBrowser) {
        // Prepare safe strings to prevent JS errors in the browser
        const safeMails = mailsJson || '[]';
        // Ensure photos is a valid array string, otherwise '[]'
        const safePhotos = (photosJson && photosJson.length > 2) ? photosJson : '[]';
        const safeSettings = settingsJson || '{}';
        const safeMediaUrl = mediaUrl || '';

        // Execute all loads in ONE go to prevent flickering and double-loading
        phoneBrowser.execute(`
            (function() {
                try {
                    // 1. Load Mails
                    try { app.loadMails(${safeMails}); } 
                    catch(e) { console.error("Mail Load Error:", e); }

                    // 2. Load Photos
                    try { app.loadPhotos(${safePhotos}, '${safeMediaUrl}'); } 
                    catch(e) { console.error("Photo Load Error:", e); }

                    // 3. Init Settings (Wallpapers, etc.)
                    try { app.settings.init(${safeSettings}); } 
                    catch(e) { console.error("Settings Load Error:", e); }

                } catch(err) {
                    console.error("Critical Phone Init Error:", err);
                }
            })();
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
        case 'deletePhoto':
            const photoData = JSON.parse(data); 
            mp.events.callRemote('server:phone:deletePhoto', photoData.id, photoData.path);
            break;
        case 'saveSetting':
            const payload = JSON.parse(data); 
            mp.events.callRemote('server:phone:saveSetting', payload.key, payload.val);
            break;
        case 'chat:fetchChats':
            mp.events.callRemote('server:phone:chat:fetchChats');
            break; 
        case 'chat:fetchMessages':
            mp.events.callRemote('server:phone:chat:fetchMessages', data); 
            break; 
        case 'chat:send':
            const chatData = JSON.parse(data);
            mp.events.callRemote('server:phone:chat:send', chatData.target, chatData.content);
            break;
        case 'contacts:fetch':
            mp.events.callRemote('server:phone:contacts:fetch');
            break;
        case 'contacts:add':
            const contactData = JSON.parse(data);
            mp.events.callRemote('server:phone:contacts:add', contactData.name, contactData.number);
            break;

        default:
            if (action.startsWith('server:')) break; 
            mp.events.callRemote('server:phone:vehicleAction', action, data); 
            break;
    }
});

mp.events.add('client:leaveVehicle', () => {
    const player = mp.players.local;
    if(player.vehicle) {
        player.taskLeaveVehicle(player.vehicle.handle, 0);
    }
});