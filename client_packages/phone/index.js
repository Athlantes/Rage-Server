// client_packages/phone/index.js

let phoneBrowser = null;
let isPhoneOpen  = false;

// --- SCOOTER TRACKING ---
let scooterBlip   = null;
let scooterMarker = null;

// --- SHARED LOCATION ---
let locationBlip     = null;
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

mp.keys.bind(0x1B, false, () => { if (isPhoneOpen) closePhone(); });
mp.keys.bind(0x28, true,  () => { if (isPhoneOpen) closePhone(); }); // Down Arrow

// --- VEHICLE ENTRY ---
mp.events.add('playerEnterVehicle', () => {
    if (isPhoneOpen) {
        closePhone();
        mp.events.call('showNotification', 'System', 'Phone closed for safety.');
    }
    if (callState === 'active' || callState === 'ringing' || callState === 'incoming') {
        mp.events.callRemote('server:phone:endCall');
    }
    if (scooterBlip || scooterMarker) clearScooterMarkers();
});

function clearScooterMarkers() {
    if (scooterBlip)   { scooterBlip.destroy();   scooterBlip   = null; }
    if (scooterMarker) { scooterMarker.destroy();  scooterMarker = null; }
}

function clearLocationBlip() {
    if (locationBlip && mp.blips.exists(locationBlip))       { locationBlip.destroy();     locationBlip     = null; }
    if (locationColshape && mp.colshapes.exists(locationColshape)) { locationColshape.destroy(); locationColshape = null; }
}

function closePhone() {
    isPhoneOpen = false;
    mp.gui.cursor.show(false, false);
    mp.gui.chat.activate(true);
    if (phoneBrowser) phoneBrowser.execute(`closePhone()`);
}

// --- CALL STATE ---
let callState   = null; // null | 'ringing' | 'incoming' | 'active'
let callTimer   = null;
let callSeconds = 0;

// --- INCOMING CALL ---
mp.events.add('client:phone:incomingCall', (callerNumber, callerName) => {
    callState = 'incoming';
    if (phoneBrowser) {
        phoneBrowser.execute(`
            (function() {
                if (typeof app !== 'undefined') {
                    if (typeof app.showIncomingCall === 'function') {
                        app.showIncomingCall(${JSON.stringify(callerNumber)}, ${JSON.stringify(callerName || callerNumber)});
                    } else {
                        app.receiveNotification(${JSON.stringify(callerNumber)}, 'Incoming Call', ${JSON.stringify((callerName || callerNumber) + ' is calling...')}, 'phone');
                    }
                }
            })();
        `);
    }
    if (!isPhoneOpen) {
        mp.events.call('showNotification', 'Phone', `${callerName || callerNumber} is calling...`);
    }
});

// --- CALL RINGING ---
mp.events.add('client:phone:callRinging', (targetNumber, targetName) => {
    callState = 'ringing';
    if (phoneBrowser) {
        phoneBrowser.execute(`
            (function() {
                if (typeof app !== 'undefined') {
                    if (typeof app.showOutgoingCall === 'function') {
                        app.showOutgoingCall(${JSON.stringify(targetNumber)}, ${JSON.stringify(targetName || targetNumber)});
                    } else {
                        app.receiveNotification('Phone', 'Calling...', ${JSON.stringify('Ringing ' + (targetName || targetNumber) + '...')}, 'phone');
                    }
                }
            })();
        `);
    }
});

// --- CALL CONNECTED ---
mp.events.add('client:phone:callConnected', (partnerNumber, partnerName) => {
    callState   = 'active';
    callSeconds = 0;
    if (callTimer) clearInterval(callTimer);
    callTimer = setInterval(() => {
        callSeconds++;
        const mins = Math.floor(callSeconds / 60).toString().padStart(2, '0');
        const secs = (callSeconds % 60).toString().padStart(2, '0');
        if (phoneBrowser) {
            phoneBrowser.execute(`
                if (typeof app !== 'undefined' && typeof app.updateCallTimer === 'function') {
                    app.updateCallTimer(${JSON.stringify(mins + ':' + secs)});
                }
            `);
        }
    }, 1000);

    if (phoneBrowser) {
        phoneBrowser.execute(`
            (function() {
                if (typeof app !== 'undefined') {
                    if (typeof app.showActiveCall === 'function') {
                        app.showActiveCall(${JSON.stringify(partnerNumber)}, ${JSON.stringify(partnerName || partnerNumber)});
                    } else {
                        app.receiveNotification('Phone', 'Connected', ${JSON.stringify('Call with ' + (partnerName || partnerNumber))}, 'phone');
                    }
                }
            })();
        `);
    }
    mp.events.call('showNotification', 'Phone', `Connected to ${partnerName || partnerNumber}`);
});

// --- CALL ENDED ---
mp.events.add('client:phone:callEnded', (reason) => {
    callState   = null;
    callSeconds = 0;
    if (callTimer) { clearInterval(callTimer); callTimer = null; }

    const safeReason = reason || 'Call ended.';
    if (phoneBrowser) {
        phoneBrowser.execute(`
            (function() {
                if (typeof app !== 'undefined') {
                    if (typeof app.hideCallUI === 'function') app.hideCallUI();
                    app.receiveNotification('Phone', ${JSON.stringify(safeReason)}, '', 'phone');
                }
            })();
        `);
    }
    mp.events.call('showNotification', 'Phone', safeReason);
});

// --- RECEIVE MAIL ---
mp.events.add('client:phone:receiveMail', (id, sender, title, message) => {
    if (phoneBrowser) {
        phoneBrowser.execute(`
            if (typeof app !== 'undefined') {
                if (typeof app.receiveMail === 'function') {
                    app.receiveMail(${JSON.stringify(id)}, ${JSON.stringify(sender)}, ${JSON.stringify(title)}, ${JSON.stringify(message)});
                } else {
                    app.receiveNotification(${JSON.stringify(sender)}, ${JSON.stringify(title)}, ${JSON.stringify(message)});
                }
            }
        `);
    }
});

// --- UPDATE VEHICLES ---
mp.events.add('client:phone:updateVehicles', (carsJson) => {
    if (phoneBrowser) phoneBrowser.execute(`
        if (typeof app !== 'undefined') app.loadVehicles(${carsJson});
    `);
});

// --- CLOSE WRAPPER ---
mp.events.add('client:closePhoneWrapper', () => {
    isPhoneOpen = false;
    mp.gui.cursor.show(false, false);
});

// --- BANK DATA ---
mp.events.add('client:phone:bank:data', (json) => {
    if (phoneBrowser) phoneBrowser.execute(`
        if (typeof app !== 'undefined') app.loadBankData(${json});
    `);
});

// --- QUICKEATS UPDATE ---
mp.events.add('client:phone:quickEats:update', (isActive, status, loc) => {
    if (phoneBrowser) phoneBrowser.execute(`
        if (typeof app !== 'undefined') {
            app.updateQuickEatsUI(${JSON.stringify(isActive)}, ${JSON.stringify(status)}, ${loc ? JSON.stringify(loc) : 'null'});
        }
    `);
});

// --- RECEIVE SMS ---
mp.events.add('client:phone:receiveSMS', (number, body, type) => {
    if (phoneBrowser) {
        phoneBrowser.execute(`
            if (typeof app !== 'undefined') {
                app.receiveSMS(${JSON.stringify(number)}, ${JSON.stringify(body)}, ${JSON.stringify(type || 'text')});
            }
        `);
    }
});

// --- COLSHAPE ENTER ---
mp.events.add('playerEnterColshape', (shape) => {
    if (shape === locationColshape) {
        mp.events.call('showNotification', 'GPS', 'You have arrived at the location.');
        clearLocationBlip();
    }
});

// --- PROXY RESPONSE ---
mp.events.add('client:phone:proxyResponse', (action, data) => {
    if (phoneBrowser) {
        if (action === 'scooterAction') {
            phoneBrowser.execute(`
                if (typeof app !== 'undefined' && app.scooter) {
                    app.scooter.onScanResult(${JSON.stringify(data)});
                }
            `);

            if (data.status === 'started' && data.x && data.y) {
                clearScooterMarkers();
                const targetPos = new mp.Vector3(data.x, data.y, data.z);

                scooterBlip = mp.blips.new(522, targetPos, {
                    name: 'Your eScooter', color: 2, scale: 1.0, shortRange: false,
                });
                scooterBlip.setRoute(true);

                scooterMarker = mp.markers.new(1, new mp.Vector3(data.x, data.y, data.z - 1.0), 1.2, {
                    direction: new mp.Vector3(0, 0, 0),
                    rotation:  new mp.Vector3(0, 0, 0),
                    color:     [50, 205, 50, 100],
                    visible:   true,
                    dimension: mp.players.local.dimension,
                });
            }
        }
    }
});

// --- SCOOTER SPAWN FINDER ---
mp.events.add('client:phone:findScooterSpawn', () => {
    const player = mp.players.local;
    const pos    = player.position;

    if (player.dimension !== 0) {
        mp.events.call('showNotification', 'eScootr', 'Go outside to spawn a scooter.');
        return;
    }

    try {
        const interiorId = mp.game.interior.getInteriorAtCoords(pos.x, pos.y, pos.z);
        if (interiorId !== 0) {
            mp.events.call('showNotification', 'eScootr', 'Go outside to spawn a scooter.');
            return;
        }
    } catch (e) { /* native may not be available */ }

    const heading  = player.getHeading();
    const distance = 5.0;
    const rad      = heading * (Math.PI / 180);
    const behindX  = pos.x + (Math.sin(rad) * distance);
    const behindY  = pos.y + (-Math.cos(rad) * distance);

    const roadNode = mp.game.pathfind.getClosestVehicleNode(behindX, behindY, pos.z, 1, 3.0, 0);

    let finalPos;
    if (roadNode) {
        const dx = roadNode.x - pos.x;
        const dy = roadNode.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        finalPos = dist > 30
            ? { x: behindX, y: behindY, z: pos.z + 0.5 }
            : { x: roadNode.x, y: roadNode.y, z: roadNode.z + 0.3 };
    } else {
        finalPos = { x: behindX, y: behindY, z: pos.z + 0.5 };
    }

    mp.events.callRemote('server:scooter:performRent', JSON.stringify(finalPos));
});

// --- APP CALLBACK ---
mp.events.add('client:phone:appCallback', (appName, funcName) => {
    if (phoneBrowser && appName === 'scooter') {
        if (funcName === 'startRide') {
            phoneBrowser.execute(`
                if (typeof app !== 'undefined' && app.scooter) app.scooter.startRide();
            `);
        }
        if (funcName === 'endRide') {
            clearScooterMarkers();
            phoneBrowser.execute(`
                if (typeof app !== 'undefined' && app.scooter) app.scooter.endRide();
            `);
        }
    }

    if (appName === 'camera' && funcName === 'open') {
        closePhone();
        mp.events.call('client:toggleCamera');
    }
});

// --- CAMERA PHOTO SAVED ---
mp.events.add('client:camera:photoSaved', (filename) => {
    if (!chatPhotoTarget) return;

    mp.events.call('client:forceCloseCamera');
    mp.events.callRemote('server:phone:sendSMS', chatPhotoTarget, filename, 'photo');

    isPhoneOpen = true;
    mp.gui.cursor.show(true, true);
    mp.gui.chat.activate(false);
    phoneBrowser.execute(`openPhone()`);

    const target = chatPhotoTarget;
    phoneBrowser.execute(`
        (function() {
            if (typeof app === 'undefined') return;
            app.open('phone-app');
            const name = app.app.phoneApp.getContactName(${JSON.stringify(target)});
            app.app.phoneApp.openChat(${JSON.stringify(target)}, name);
            app.app.phoneApp.sendSMSInternal(${JSON.stringify(target)}, ${JSON.stringify(filename)}, 'photo');
        })();
    `);

    chatPhotoTarget = null;
});

// --- INITIALIZE PHONE ---
mp.events.add('client:phone:initialize', (mailsJson, photosJson, mediaUrl, settingsJson, contactsJson, messagesJson) => {
    mp.gui.chat.push('[Phone Debug] Init Data Received.');

    if (phoneBrowser) {
        phoneBrowser.execute(`
            (function() {
                if (typeof app === 'undefined') return;
                try {
                    try { app.loadMails(${mailsJson || '[]'}); }                       catch(e) { console.error('Mail:', e); }
                    try { app.loadPhotos(${photosJson && photosJson.length > 2 ? photosJson : '[]'}, ${JSON.stringify(mediaUrl || '')}); } catch(e) { console.error('Photos:', e); }
                    try { app.app.settings.init(${settingsJson || '{}'}); }            catch(e) { console.error('Settings:', e); }
                    try { app.app.phoneApp.init(${contactsJson || '[]'}, ${messagesJson || '[]'}); } catch(e) { console.error('PhoneApp:', e); }
                } catch(err) { console.error('Phone Init Error:', err); }
            })();
        `);
    }
});

// --- PROXY ACTION HANDLER ---
mp.events.add('client:proxyAction', (action, data) => {
    switch (action) {

        case 'requestBankData':
            mp.events.callRemote('server:phone:bank:open');
            break;

        case 'toggleQuickEats':
            mp.events.callRemote('server:phone:quickEats:toggle');
            break;

        case 'bankTransfer': {
            const d = JSON.parse(data);
            mp.events.callRemote('server:phone:bank:transfer', d.t, d.a);
            break;
        }

        case 'readMail':
            mp.events.callRemote('server:phone:readMail', data);
            break;

        case 'readAllMails':
            mp.events.callRemote('server:phone:readAllMails');
            break;

        case 'scooterAction':
            mp.events.callRemote('server:phone:scooterAction', data);
            break;

        case 'deletePhoto': {
            const d = JSON.parse(data);
            mp.events.callRemote('server:phone:deletePhoto', d.id, d.path);
            break;
        }

        case 'saveSetting': {
            const d = JSON.parse(data);
            mp.events.callRemote('server:phone:saveSetting', d.key, d.val);
            break;
        }

        case 'saveContact': {
            const d = JSON.parse(data);
            mp.events.callRemote('server:phone:addContact', d.name, d.number);
            break;
        }

        case 'sendSMS': {
            const d = JSON.parse(data);
            mp.events.callRemote('server:phone:sendSMS', d.number, d.body, d.type);
            break;
        }

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

        case 'shareLocation': {
            const player = mp.players.local;
            const pos    = player.position;
            const locBody = `${pos.x.toFixed(2)},${pos.y.toFixed(2)}`;

            mp.events.callRemote('server:phone:sendSMS', data, locBody, 'location');

            if (phoneBrowser) {
                phoneBrowser.execute(`
                    if (typeof app !== 'undefined') {
                        app.app.phoneApp.sendSMSInternal(${JSON.stringify(data)}, ${JSON.stringify(locBody)}, 'location');
                    }
                `);
            }
            break;
        }

        case 'sharePhoto': {
            const d = JSON.parse(data);
            mp.events.callRemote('server:phone:sendSMS', d.target, d.image, 'photo');

            if (phoneBrowser) {
                phoneBrowser.execute(`
                    if (typeof app !== 'undefined') {
                        app.app.phoneApp.sendSMSInternal(${JSON.stringify(d.target)}, ${JSON.stringify(d.image)}, 'photo');
                    }
                `);
            }
            break;
        }

        case 'camera':
            if (data === 'open') {
                closePhone();
                chatPhotoTarget = null;
                mp.events.call('client:toggleCamera');
            }
            break;

        case 'cameraForChat':
            chatPhotoTarget = data;
            closePhone();
            mp.events.call('client:toggleCamera');
            break;

        case 'setWaypoint': {
            clearLocationBlip();
            const coords = data.split(',');
            if (coords.length >= 2) {
                const x = parseFloat(coords[0]);
                const y = parseFloat(coords[1]);

                locationBlip = mp.blips.new(1, new mp.Vector3(x, y, 0), {
                    name: 'Shared Location', color: 5, shortRange: false, scale: 1.0,
                });
                locationBlip.setRoute(true);
                locationColshape = mp.colshapes.newCircle(x, y, 15.0);
                mp.events.call('showNotification', 'GPS', 'Route set to location.');
            }
            break;
        }

        default:
            mp.events.callRemote('server:phone:vehicleAction', action, data);
            break;
    }
});

// --- SELL VEHICLE ---
mp.events.add('client:phone:sellVehicle', (vehicleId) => {
    mp.events.callRemote('server:dealership:sell', vehicleId);
});

mp.events.add('client:leaveVehicle', () => {
    const player = mp.players.local;
    if (player.vehicle) player.taskLeaveVehicle(player.vehicle.handle, 0);
});
