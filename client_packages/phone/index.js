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
        const safeSender = JSON.stringify(sender);
        const safeTitle = JSON.stringify(title);
        const safeBody = JSON.stringify(message);
        
        phoneBrowser.execute(`
            if(typeof app.receiveMail === 'function') {
                app.receiveMail(${id}, ${safeSender}, ${safeTitle}, ${safeBody});
            } else {
                app.receiveNotification(${safeSender}, ${safeTitle}, ${safeBody});
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

    // Block if player is in an interior (non-zero dimension)
    if (player.dimension !== 0) {
        mp.events.call('showNotification', 'eScootr', 'Go outside to spawn a scooter.');
        return;
    }

    // Try to detect interior via native (some interiors are in dim 0)
    try {
        const interiorId = mp.game.interior.getInteriorAtCoords(pos.x, pos.y, pos.z);
        if (interiorId !== 0) {
            mp.events.call('showNotification', 'eScootr', 'Go outside to spawn a scooter.');
            return;
        }
    } catch (e) { /* native may not be available, fall through */ }

    const heading = player.getHeading();
    const distance = 5.0;
    const rad = heading * (Math.PI / 180);
    const behindX = pos.x + (Math.sin(rad) * distance);
    const behindY = pos.y + (-Math.cos(rad) * distance);

    // Find nearest road node behind the player
    const roadNode = mp.game.pathfind.getClosestVehicleNode(behindX, behindY, pos.z, 1, 3.0, 0);

    let finalPos;
    if (roadNode) {
        // Validate the road node isn't absurdly far (tunnel/underground)
        const dx = roadNode.x - pos.x;
        const dy = roadNode.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 30) {
            // Road node is too far — use position behind player with Z offset
            finalPos = { x: behindX, y: behindY, z: pos.z + 0.5 };
        } else {
            finalPos = { x: roadNode.x, y: roadNode.y, z: roadNode.z + 0.3 };
        }
    } else {
        // No road node found — use behind-player with slight Z offset
        finalPos = { x: behindX, y: behindY, z: pos.z + 0.5 };
    }

    mp.events.callRemote('server:scooter:performRent', JSON.stringify(finalPos));
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

// --- MAPS / GPS APP ---
mp.events.add('client:phone:requestMapBlips', () => {
    // Send player position along with the request so server can calculate distances
    const pos = mp.players.local.position;
    mp.events.callRemote('server:phone:requestGPS', pos.x, pos.y, pos.z);
});

mp.events.add('client:phone:receiveGPS', (locationsJson) => {
    if (phoneBrowser) {
        phoneBrowser.execute(`app.mapsApp.loadBlips(${locationsJson})`);
        // Also feed GPS data to the Taxi app
        phoneBrowser.execute(`if(app.taxiApp) app.taxiApp.loadLocations(${locationsJson})`);
    }
});

mp.events.add('client:phone:setGPSRoute', (dataJson) => {
    const data = JSON.parse(dataJson);

    // Clear any previous route
    clearLocationBlip();

    const destName = data.name || 'GPS Destination';

    // Create red blip at destination
    locationBlip = mp.blips.new(1, new mp.Vector3(data.x, data.y, data.z), {
        name: destName,
        color: 1, // Red
        shortRange: false,
        scale: 1.0
    });

    // Enable GPS route line to the blip
    locationBlip.setRoute(true);

    // Force route colour to red
    try { mp.game.invoke('0x837155CD2F63DA09', locationBlip.handle, 1); } catch(e) {}

    // Create colshape for arrival detection (20m radius)
    locationColshape = mp.colshapes.newCircle(data.x, data.y, 20.0);

    mp.events.call('showNotification', 'Maps', `Route set to ${destName}.`);
});

// --- TAXI APP ---
mp.events.add('client:phone:requestTaxiData', () => {
    mp.events.callRemote('server:taxi:requestAppData');
    // Also request GPS locations for the taxi app (same data as Maps)
    const pos = mp.players.local.position;
    mp.events.callRemote('server:phone:requestGPS', pos.x, pos.y, pos.z);
});

mp.events.add('client:taxi:receiveAppData', (dataJson) => {
    if (phoneBrowser) {
        const data = JSON.parse(dataJson);
        phoneBrowser.execute(`app.taxiApp.loadAppData(${JSON.stringify(data)})`);
    }
});

// Waypoint check for "My Waypoint" button
mp.events.add('client:phone:getWaypoint', () => {
    const wpHandle = mp.game.ui.getFirstBlipInfoId(8);
    if (!wpHandle || wpHandle === 0) {
        if (phoneBrowser) phoneBrowser.execute(`app.taxiApp.onWaypointResult({ error: 'Set a waypoint on map first.' })`);
        return;
    }

    const coords = mp.game.ui.getBlipInfoIdCoord(wpHandle);
    if (!coords || (Math.abs(coords.x) < 1.0 && Math.abs(coords.y) < 1.0)) {
        if (phoneBrowser) phoneBrowser.execute(`app.taxiApp.onWaypointResult({ error: 'Set a waypoint on map first.' })`);
        return;
    }

    let zoneName = 'Custom Location';
    try {
        const key = mp.game.zone.getNameOfZone(coords.x, coords.y, coords.z);
        zoneName = mp.game.gxt.get(key) || 'Custom Location';
    } catch (_) {}

    // Calculate distance from player to waypoint
    const pos = mp.players.local.position;
    const dx = coords.x - pos.x;
    const dy = coords.y - pos.y;
    const dist = Math.round(Math.sqrt(dx * dx + dy * dy) / 100) / 10; // km

    if (phoneBrowser) {
        phoneBrowser.execute(`app.taxiApp.onWaypointResult(${JSON.stringify({
            name: zoneName,
            x: coords.x,
            y: coords.y,
            z: coords.z,
            dist: dist
        })})`);
    }
});

// Call taxi from phone
mp.events.add('client:phone:callTaxi', (dataJson) => {
    const data = JSON.parse(dataJson);

    // Resolve the caller's current zone name for the pickup location
    const pos = mp.players.local.position;
    let pickupZone = 'Unknown Area';
    try {
        const zoneKey = mp.game.zone.getNameOfZone(pos.x, pos.y, pos.z);
        pickupZone = mp.game.gxt.get(zoneKey) || 'Unknown Area';
    } catch (_) {}

    mp.events.callRemote('server:taxi:callFromPhone', data.name, data.x, data.y, data.z, pickupZone);
});

// Taxi call placed confirmation
mp.events.add('client:taxi:callPlaced', (dataJson) => {
    const data = JSON.parse(dataJson);
    if (phoneBrowser) {
        phoneBrowser.execute(`app.taxiApp.onCallPlaced(${JSON.stringify(data)})`);
    }
    mp.events.call('showNotification', 'Taxi', 'Ride request sent! A driver will accept shortly.');
});

// Taxi call error
mp.events.add('client:taxi:callError', (message) => {
    if (phoneBrowser) {
        phoneBrowser.execute(`app.taxiApp.onCallError(${JSON.stringify(message)})`);
    }
});

// Taxi progress updates (phase changes)
mp.events.add('client:taxi:phoneProgress', (dataJson) => {
    const data = JSON.parse(dataJson);
    if (phoneBrowser) {
        phoneBrowser.execute(`app.taxiApp.updateProgress(${JSON.stringify(data)})`);
    }

    // Show notifications for key events
    if (data.phase === 1) {
        mp.events.call('showNotification', 'Taxi', `${data.driverName || 'A driver'} accepted your ride!`);
    } else if (data.phase === 2) {
        mp.events.call('showNotification', 'Taxi', 'Your driver has arrived! Get in the taxi.');
    } else if (data.phase === 3) {
        mp.events.call('showNotification', 'Taxi', 'On the way to your destination.');
    } else if (data.phase === 4) {
        mp.events.call('showNotification', 'Taxi', "You've arrived! Rate your ride.");
    }
});

// Cancel taxi from phone
mp.events.add('client:phone:cancelTaxi', () => {
    mp.events.callRemote('server:taxi:cancelCall');
});

mp.events.add('client:taxi:callCancelled', () => {
    if (phoneBrowser) {
        phoneBrowser.execute(`app.taxiApp.onCallCancelled()`);
    }
});

// Fix 2: Handle call expiry — no driver accepted in time
mp.events.add('client:taxi:callExpired', () => {
    if (phoneBrowser) {
        phoneBrowser.execute(`app.taxiApp.onCallCancelled()`);
    }
    mp.events.call('showNotification', 'Taxi', 'No drivers were available. Your request has expired.');
    // Acknowledge the expiry to the server so it cleans up activePhoneCalls
    mp.events.callRemote('server:taxi:callExpired');
});

// Submit rating
mp.events.add('client:phone:submitTaxiRating', (stars) => {
    mp.events.callRemote('server:taxi:submitRating', stars);
});

mp.events.add('client:taxi:ratingSubmitted', () => {
    if (phoneBrowser) {
        phoneBrowser.execute(`app.taxiApp.onRatingConfirmed()`);
    }
    mp.events.call('showNotification', 'Taxi', 'Ride completed! Thanks for your rating!');
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

// Sell vehicle from phone
mp.events.add('client:phone:sellVehicle', (vehicleId) => {
    mp.events.callRemote('server:dealership:sell', vehicleId);
});

mp.events.add('client:leaveVehicle', () => {
    const player = mp.players.local;
    if(player.vehicle) {
        player.taskLeaveVehicle(player.vehicle.handle, 0);
    }
});