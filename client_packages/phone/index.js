// client_packages/phone/index.js

let phoneBrowser = null;
let isPhoneOpen = false;

// --- SCOOTER TRACKING VARIABLES ---
let scooterBlip = null;
let scooterMarker = null;

// --- SHARED LOCATION VARIABLES ---
let locationBlip = null;
let locationColshape = null; 

let chatPhotoTarget = null;

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
        // CUSTOM NOTIFICATION: Phone Closed
        mp.events.call('showNotification', 'System', 'Phone closed for safety.');
    }
    // End active call when entering vehicle (realistic RP)
    if (callState === 'active' || callState === 'ringing' || callState === 'incoming') {
        mp.events.callRemote('server:phone:endCall');
    }
    
    if (scooterBlip || scooterMarker) {
        clearScooterMarkers();
    }
});

function clearScooterMarkers() {
    if (scooterBlip) { scooterBlip.destroy(); scooterBlip = null; }
    if (scooterMarker) { scooterMarker.destroy(); scooterMarker = null; }
}

// --- CLEAR FUNCTION ---
function clearLocationBlip() {
    if (locationBlip) {
        if(mp.blips.exists(locationBlip)) locationBlip.destroy();
        locationBlip = null;
    }
    if (locationColshape) {
        if(mp.colshapes.exists(locationColshape)) locationColshape.destroy();
        locationColshape = null;
    }
}

function closePhone() {
    isPhoneOpen = false;
    mp.gui.cursor.show(false, false);
    mp.gui.chat.activate(true); 
    if(phoneBrowser) phoneBrowser.execute(`closePhone()`);
}

// --- CALL STATE TRACKING ---
let callState = null; // null | 'ringing' | 'incoming' | 'active'
let callTimer = null;
let callSeconds = 0;

// --- INCOMING CALL: other player is calling us ---
mp.events.add('client:phone:incomingCall', (callerNumber, callerName) => {
    callState = 'incoming';
    const safeName = (callerName || callerNumber).replace(/'/g, "\\'");
    if (phoneBrowser) {
        phoneBrowser.execute(`
            (function() {
                if(typeof app.showIncomingCall === 'function') {
                    app.showIncomingCall('${callerNumber}', '${safeName}');
                } else {
                    app.receiveNotification('${callerNumber}', 'Incoming Call', '${safeName} is calling...', 'phone');
                }
            })();
        `);
    }
    // Play ringtone sound if phone is closed
    if (!isPhoneOpen) {
        mp.events.call('showNotification', 'Phone', `${safeName} is calling...`);
    }
});

// --- CALL RINGING: we started a call, waiting for answer ---
mp.events.add('client:phone:callRinging', (targetNumber, targetName) => {
    callState = 'ringing';
    const safeName = (targetName || targetNumber).replace(/'/g, "\\'");
    if (phoneBrowser) {
        phoneBrowser.execute(`
            (function() {
                if(typeof app.showOutgoingCall === 'function') {
                    app.showOutgoingCall('${targetNumber}', '${safeName}');
                } else {
                    app.receiveNotification('Phone', 'Calling...', 'Ringing ${safeName}...', 'phone');
                }
            })();
        `);
    }
});

// --- CALL CONNECTED: call accepted by other party ---
mp.events.add('client:phone:callConnected', (partnerNumber, partnerName) => {
    callState = 'active';
    callSeconds = 0;
    const safeName = (partnerName || partnerNumber).replace(/'/g, "\\'");
    
    // Start call timer
    if (callTimer) clearInterval(callTimer);
    callTimer = setInterval(() => {
        callSeconds++;
        const mins = Math.floor(callSeconds / 60).toString().padStart(2, '0');
        const secs = (callSeconds % 60).toString().padStart(2, '0');
        if (phoneBrowser) {
            phoneBrowser.execute(`
                if(typeof app.updateCallTimer === 'function') app.updateCallTimer('${mins}:${secs}');
            `);
        }
    }, 1000);

    if (phoneBrowser) {
        phoneBrowser.execute(`
            (function() {
                if(typeof app.showActiveCall === 'function') {
                    app.showActiveCall('${partnerNumber}', '${safeName}');
                } else {
                    app.receiveNotification('Phone', 'Connected', 'Call with ${safeName}', 'phone');
                }
            })();
        `);
    }
    mp.events.call('showNotification', 'Phone', `Connected to ${safeName}`);
});

// --- CALL ENDED ---
mp.events.add('client:phone:callEnded', (reason) => {
    callState = null;
    callSeconds = 0;
    if (callTimer) { clearInterval(callTimer); callTimer = null; }
    
    const safeReason = (reason || 'Call ended.').replace(/'/g, "\\'");
    if (phoneBrowser) {
        phoneBrowser.execute(`
            (function() {
                if(typeof app.hideCallUI === 'function') app.hideCallUI();
                app.receiveNotification('Phone', '${safeReason}', '', 'phone');
            })();
        `);
    }
    mp.events.call('showNotification', 'Phone', safeReason);
});

// --- STANDARD APP EVENTS ---

mp.events.add('client:camera:photoSaved', (filename) => {
    // If we have a target waiting for a photo
    if (chatPhotoTarget) {
        
        // 1. Close Camera
        mp.events.call('client:forceCloseCamera');

        // 2. Send SMS via Server
        const body = filename; // The filename from camera.js
        mp.events.callRemote('server:phone:sendSMS', chatPhotoTarget, body, 'photo');

        // 3. Re-open Phone
        isPhoneOpen = true;
        mp.gui.cursor.show(true, true);
        mp.gui.chat.activate(false); 
        phoneBrowser.execute(`openPhone()`);

        // 4. Force UI to open the specific chat thread and "echo" the message
        phoneBrowser.execute(`
            (function() {
                // Open Chat UI
                app.open('phone-app');
                const name = app.phoneApp.getContactName('${chatPhotoTarget}');
                app.phoneApp.openChat('${chatPhotoTarget}', name);

                // Echo message to UI immediately
                app.phoneApp.messages.push({
                    number: '${chatPhotoTarget}',
                    body: '${body}',
                    type: 'photo',
                    isMine: true,
                    is_read: 1,
                    time: new Date().toISOString()
                });
                app.phoneApp.renderChatBubbles();
            })();
        `);

        // 5. Reset target
        chatPhotoTarget = null;
    }
});

mp.events.add('client:phone:receiveMail', (id, sender, title, message) => {
    if(phoneBrowser) {
        const safeBody = message.replace(/'/g, "\\'");
        const safeTitle = title.replace(/'/g, "\\'");
        const safeSender = sender.replace(/'/g, "\\'");
        
        phoneBrowser.execute(`
            if(typeof app.receiveMail === 'function') {
                app.receiveMail(${id}, '${safeSender}', '${safeTitle}', '${safeBody}');
            } else {
                app.receiveNotification('${safeSender}', '${safeTitle}', '${safeBody}');
            }
        `);
    }
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

// --- RECEIVE SMS EVENT ---
mp.events.add('client:phone:receiveSMS', (number, body, type) => {
    if(phoneBrowser) {
        const msgObj = { 
            number: number, 
            body: body,
            type: type || 'text',
            isMine: false, 
            is_read: 0, 
            time: new Date().toISOString() 
        };
        
        phoneBrowser.execute(`
            (function() {
                if(app.phoneApp) {
                    app.phoneApp.messages.push(${JSON.stringify(msgObj)});
                    
                    const isChatting = (app.phoneApp.activeChatNumber == '${number}') && 
                                       (!app.isLocked) && 
                                       (!document.getElementById('phone-shell').classList.contains('hidden'));

                    if(isChatting) {
                        app.phoneApp.messages[app.phoneApp.messages.length - 1].is_read = 1;
                        mp.trigger('client:proxyAction', 'markMessagesRead', '${number}');
                        app.phoneApp.renderChatBubbles();
                    } else {
                        app.phoneApp.renderMessageList();
                        let notifyMsg = '${body.replace(/'/g, "\\'")}';
                        if('${type}' === 'photo') notifyMsg = 'Sent a photo';
                        if('${type}' === 'location') notifyMsg = 'Shared location';
                        app.receiveNotification('${number}', 'New Message', notifyMsg, 'phone');
                    }
                }
            })();
        `);
    }
});

// --- COLSHAPE ENTER EVENT ---
mp.events.add("playerEnterColshape", (shape) => {
    if (shape === locationColshape) {
        // CUSTOM NOTIFICATION: Arrived
        mp.events.call('showNotification', 'GPS', 'You have arrived at the location.');
        clearLocationBlip(); 
    }
});

// --- PROXY HANDLER ---
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

        case 'acceptCall':
             mp.events.callRemote('server:phone:acceptCall');
             break;

        case 'declineCall':
             mp.events.callRemote('server:phone:declineCall');
             break;

        case 'endCall':
             mp.events.callRemote('server:phone:endCall');
             break;

        case 'shareLocation':
            const player = mp.players.local;
            const pos = player.position;
            const locBody = `${pos.x.toFixed(2)},${pos.y.toFixed(2)}`;
            
            mp.events.callRemote('server:phone:sendSMS', data, locBody, 'location');
            
            if(phoneBrowser) {
                const echoScript = `
                    (function() {
                        if(app.phoneApp) {
                            app.phoneApp.messages.push({
                                number: '${data}',
                                body: '${locBody}',
                                type: 'location',
                                isMine: true,
                                is_read: 1,
                                time: new Date().toISOString()
                            });
                            app.phoneApp.renderChatBubbles();
                            app.phoneApp.renderMessageList();
                        }
                    })();
                `;
                phoneBrowser.execute(echoScript);
            }
            break;

        case 'sharePhoto':
            const pData = JSON.parse(data);
            mp.events.callRemote('server:phone:sendSMS', pData.target, pData.image, 'photo');

            if(phoneBrowser) {
                const echoScript = `
                    (function() {
                        if(app.phoneApp) {
                            app.phoneApp.messages.push({
                                number: '${pData.target}',
                                body: '${pData.image}',
                                type: 'photo',
                                isMine: true,
                                is_read: 1,
                                time: new Date().toISOString()
                            });
                            app.phoneApp.renderChatBubbles();
                            app.phoneApp.renderMessageList();
                        }
                    })();
                `;
                phoneBrowser.execute(echoScript);
            }
            break;

        case 'camera':
            if (data === 'open') {
                closePhone();
                chatPhotoTarget = null; // Ensure we don't auto-send
                mp.events.call('client:toggleCamera'); 
            }
            break;

        case 'cameraForChat':
            // data is the phone number of the person we are chatting with
            chatPhotoTarget = data; 
            closePhone();
            mp.events.call('client:toggleCamera');
            break;

        case 'setWaypoint':
            // 1. Clear previous
            clearLocationBlip();

            // 2. Parse coordinates
            const coords = data.split(',');
            if (coords.length >= 2) {
                const x = parseFloat(coords[0]);
                const y = parseFloat(coords[1]);
                
                // 3. Create Blip
                locationBlip = mp.blips.new(1, new mp.Vector3(x, y, 0), {
                    name: "Shared Location",
                    color: 5, 
                    shortRange: false, 
                    scale: 1.0
                });
                locationBlip.setRoute(true);

                // 4. Create Colshape (Trigger)
                locationColshape = mp.colshapes.newCircle(x, y, 15.0);

                // CUSTOM NOTIFICATION: Route Set
                mp.events.call('showNotification', 'GPS', 'Route set to location.');
            }
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