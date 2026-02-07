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

// --- NEW: RECEIVE SMS EVENT (Fixed Notification) ---
mp.events.add('client:phone:receiveSMS', (number, body) => {
    if(phoneBrowser) {
        const msgObj = { 
            number: number, 
            body: body, 
            isMine: false, 
            is_read: 0, // IMPORTANT: New messages are unread by default
            time: new Date().toISOString() 
        };
        
        phoneBrowser.execute(`
            (function() {
                if(app.phoneApp) {
                    app.phoneApp.messages.push(${JSON.stringify(msgObj)});
                    
                    if(app.phoneApp.activeChatNumber == '${number}') {
                        // If chat is open, immediately mark read and render
                        app.phoneApp.messages[app.phoneApp.messages.length - 1].is_read = 1;
                        mp.trigger('client:proxyAction', 'markMessagesRead', '${number}'); // Sync to DB
                        app.phoneApp.renderChatBubbles();
                    } else {
                        // Else, notification
                        app.phoneApp.renderMessageList();
                        app.receiveNotification('${number}', 'New Message', '${body.replace(/'/g, "\\'")}', 'phone');
                    }
                }
            })();
        `);
    }
});

// --- PROXY HANDLER (Handling Server Responses) ---
mp.events.add('client:phone:proxyResponse', (action, data) => {
    if (phoneBrowser) {
        if (action === 'scooterAction') {
            phoneBrowser.execute(`if(app.scooter) app.scooter.onScanResult(${JSON.stringify(data)})`);

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

mp.events.add('client:phone:findScooterSpawn', () => {
    const player = mp.players.local;
    const pos = player.position;
    const heading = player.getHeading();
    const distance = 5.0; 

    const rad = heading * (Math.PI / 180);
    const backX = pos.x + (Math.sin(rad) * distance); 
    const backY = pos.y + (-Math.cos(rad) * distance);

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
        closePhone(); 
        mp.events.call('client:toggleCamera'); 
    }
});

mp.events.add('client:phone:initialize', (mailsJson, photosJson, mediaUrl, settingsJson, contactsJson, messagesJson) => {
    mp.gui.chat.push(`[Phone Debug] Init Data Received.`);

    if(phoneBrowser) {
        const safeMails = mailsJson || '[]';
        const safePhotos = (photosJson && photosJson.length > 2) ? photosJson : '[]';
        const safeSettings = settingsJson || '{}';
        const safeMediaUrl = mediaUrl || '';
        const safeContacts = contactsJson || '[]';
        const safeMessages = messagesJson || '[]';

        phoneBrowser.execute(`
            (function() {
                try {
                    try { app.loadMails(${safeMails}); } 
                    catch(e) { console.error("Mail Load Error:", e); }

                    try { app.loadPhotos(${safePhotos}, '${safeMediaUrl}'); } 
                    catch(e) { console.error("Photo Load Error:", e); }

                    try { app.settings.init(${safeSettings}); } 
                    catch(e) { console.error("Settings Load Error:", e); }

                    try { 
                        if(app.phoneApp) app.phoneApp.init(${safeContacts}, ${safeMessages}); 
                    } catch(e) { console.error("Phone App Init Error:", e); }

                } catch(err) {
                    console.error("Critical Phone Init Error:", err);
                }
            })();
        `);
    }
});

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

        case 'saveContact':
            const contactData = JSON.parse(data);
            mp.events.callRemote('server:phone:addContact', contactData.name, contactData.number);
            break;

        case 'sendSMS':
            const smsData = JSON.parse(data);
            mp.events.callRemote('server:phone:sendSMS', smsData.number, smsData.body);
            break;

        case 'markMessagesRead':
            mp.events.callRemote('server:phone:markMessagesRead', data);
            break;

        case 'startCall':
             mp.events.callRemote('server:phone:startCall', data); 
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