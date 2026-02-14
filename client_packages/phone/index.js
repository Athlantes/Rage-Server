// client_packages/phone/index.js
// UPDATED FOR VUE.JS INTEGRATION

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
        
        // Debug log
        mp.gui.chat.push('[Phone] Opening phone...');
        
        if (phoneBrowser) {
            phoneBrowser.execute(`
                console.log('[CEF] openPhone() being called');
                if (typeof openPhone === 'function') {
                    openPhone();
                    console.log('[CEF] openPhone() executed');
                } else {
                    console.error('[CEF] openPhone is not a function!');
                }
            `);
        } else {
            mp.gui.chat.push('[Phone] ERROR: phoneBrowser is null!');
        }
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
        mp.events.call('showNotification', 'System', 'Phone closed for safety.');
    }
    
    // End active call when entering vehicle
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
    
    mp.gui.chat.push('[Phone] Closing phone...');
    
    if(phoneBrowser) {
        phoneBrowser.execute(`
            console.log('[CEF] closePhone() being called');
            if (typeof closePhone === 'function') {
                closePhone();
                console.log('[CEF] closePhone() executed');
            } else {
                console.error('[CEF] closePhone is not a function!');
            }
        `);
    }
}

// --- CALL STATE TRACKING ---
let callState = null; // null | 'ringing' | 'incoming' | 'active'
let callTimer = null;
let callSeconds = 0;

// ============================================
// VUE INTEGRATION: DATA UPDATE EVENTS
// ============================================

// --- PHONE NUMBER UPDATE ---
mp.events.add('client:phone:setPhoneNumber', (phoneNumber) => {
    if (phoneBrowser) {
        phoneBrowser.execute(`setPhoneNumber('${phoneNumber}')`);
    }
});

// --- MAIL UPDATES ---
mp.events.add('client:phone:updateMails', (mailsJson) => {
    if (phoneBrowser) {
        phoneBrowser.execute(`updateMails(${mailsJson})`);
    }
});

mp.events.add('client:phone:newMail', (sender, subject, body) => {
    const mail = {
        id: Date.now(),
        sender: sender,
        subject: subject,
        body: body,
        timestamp: new Date().toISOString(),
        read: false
    };
    
    if (phoneBrowser) {
        phoneBrowser.execute(`
            (function() {
                store.mails.unshift(${JSON.stringify(mail)});
                store.unreadMails++;
                if (store.isLocked) {
                    store.addNotification('mail', '${sender}', '${subject}');
                }
            })();
        `);
    }
});

// --- CONTACT UPDATES ---
mp.events.add('client:phone:updateContacts', (contactsJson) => {
    if (phoneBrowser) {
        phoneBrowser.execute(`updateContacts(${contactsJson})`);
    }
});

mp.events.add('client:phone:addContact', (name, number) => {
    if (phoneBrowser) {
        phoneBrowser.execute(`
            (function() {
                store.contacts.push({
                    id: Date.now(),
                    name: '${name}',
                    number: '${number}'
                });
            })();
        `);
    }
});

// --- MESSAGE UPDATES ---
mp.events.add('client:phone:updateMessages', (messagesJson) => {
    if (phoneBrowser) {
        phoneBrowser.execute(`updateMessages(${messagesJson})`);
    }
});

mp.events.add('client:phone:newMessage', (contact, message) => {
    if (phoneBrowser) {
        const safeContact = contact.replace(/'/g, "\\'");
        const safeMessage = message.replace(/'/g, "\\'");
        
        phoneBrowser.execute(`
            (function() {
                const existingConvo = store.messages.find(m => m.contact === '${safeContact}');
                if (existingConvo) {
                    existingConvo.lastMessage = '${safeMessage}';
                    existingConvo.timestamp = new Date().toISOString();
                } else {
                    store.messages.unshift({
                        id: Date.now(),
                        contact: '${safeContact}',
                        lastMessage: '${safeMessage}',
                        timestamp: new Date().toISOString()
                    });
                }
                if (store.isLocked) {
                    store.addNotification('phone', '${safeContact}', '${safeMessage}');
                }
            })();
        `);
    }
});

// --- BANK UPDATES ---
mp.events.add('client:phone:updateBankData', (balance, historyJson) => {
    if (phoneBrowser) {
        phoneBrowser.execute(`updateBankData(${balance}, ${historyJson})`);
    }
});

mp.events.add('client:phone:bankTransaction', (type, description, amount) => {
    if (phoneBrowser) {
        phoneBrowser.execute(`
            (function() {
                store.bankData.history.unshift({
                    id: Date.now(),
                    type: '${type}',
                    description: '${description}',
                    amount: ${amount},
                    timestamp: new Date().toISOString()
                });
                store.bankData.balance += ${amount};
            })();
        `);
    }
});

// --- VEHICLE UPDATES ---
mp.events.add('client:phone:updateVehicles', (vehiclesJson) => {
    if (phoneBrowser) {
        phoneBrowser.execute(`updateVehicles(${vehiclesJson})`);
    }
});

mp.events.add('client:phone:updateVehicleStatus', (vehicleId, status, fuel) => {
    if (phoneBrowser) {
        phoneBrowser.execute(`
            (function() {
                const vehicle = store.vehicles.find(v => v.id === ${vehicleId});
                if (vehicle) {
                    vehicle.status = '${status}';
                    vehicle.fuel = ${fuel};
                }
            })();
        `);
    }
});

// --- NOTIFICATION SYSTEM ---
mp.events.add('client:phone:notification', (appType, title, message) => {
    if (phoneBrowser) {
        const safeTitle = title.replace(/'/g, "\\'");
        const safeMessage = message.replace(/'/g, "\\'");
        phoneBrowser.execute(`receiveNotification('system', '${safeTitle}', '${safeMessage}', '${appType}')`);
    }
});

// ============================================
// CALL SYSTEM (UPDATED FOR VUE)
// ============================================

// --- INCOMING CALL: other player is calling us ---
mp.events.add('client:phone:incomingCall', (callerNumber, callerName) => {
    callState = 'incoming';
    const safeName = (callerName || callerNumber).replace(/'/g, "\\'");
    if (phoneBrowser) {
        phoneBrowser.execute(`showIncomingCall('${callerNumber}', '${safeName}')`);
    }
    if (!isPhoneOpen) {
        mp.events.call('showNotification', 'Phone', `${safeName} is calling...`);
    }
});

// --- CALL RINGING: we started a call, waiting for answer ---
mp.events.add('client:phone:callRinging', (targetNumber, targetName) => {
    callState = 'ringing';
    const safeName = (targetName || targetNumber).replace(/'/g, "\\'");
    if (phoneBrowser) {
        phoneBrowser.execute(`showOutgoingCall('${targetNumber}', '${safeName}')`);
    }
});

// --- CALL CONNECTED: call accepted by other party ---
mp.events.add('client:phone:callConnected', (partnerNumber, partnerName) => {
    callState = 'active';
    callSeconds = 0;
    
    // Start call timer
    if (callTimer) clearInterval(callTimer);
    callTimer = setInterval(() => {
        callSeconds++;
        const mins = Math.floor(callSeconds / 60).toString().padStart(2, '0');
        const secs = (callSeconds % 60).toString().padStart(2, '0');
        if (phoneBrowser) {
            phoneBrowser.execute(`updateCallTimer('${mins}:${secs}')`);
        }
    }, 1000);

    if (phoneBrowser) {
        const safeName = (partnerName || partnerNumber).replace(/'/g, "\\'");
        phoneBrowser.execute(`
            (function() {
                store.callState = 'active';
                store.callData = { number: '${partnerNumber}', name: '${safeName}' };
            })();
        `);
    }
});

// --- CALL ENDED ---
mp.events.add('client:phone:callEnded', () => {
    callState = null;
    if (callTimer) {
        clearInterval(callTimer);
        callTimer = null;
    }
    callSeconds = 0;
    
    if (phoneBrowser) {
        phoneBrowser.execute(`endCall()`);
    }
});

// --- CALL REJECTED ---
mp.events.add('client:phone:callRejected', () => {
    callState = null;
    if (phoneBrowser) {
        phoneBrowser.execute(`
            (function() {
                endCall();
                store.addNotification('system', 'Call Ended', 'The call was rejected.');
            })();
        `);
    }
});

// ============================================
// PHONE APP CALLBACKS (FROM CEF TO CLIENT)
// ============================================

mp.events.add('client:phone:appCallback', (appName, action, dataJson) => {
    const data = dataJson ? JSON.parse(dataJson) : null;
    
    switch (appName) {
        case 'phone':
            handlePhoneAppCallback(action, data);
            break;
        case 'bank':
            handleBankAppCallback(action, data);
            break;
        case 'vehicles':
            handleVehiclesAppCallback(action, data);
            break;
        case 'camera':
            handleCameraAppCallback(action, data);
            break;
        case 'quickeats':
            handleQuickEatsCallback(action, data);
            break;
        case 'escootr':
            handleEScootrCallback(action, data);
            break;
    }
});

function handlePhoneAppCallback(action, data) {
    switch (action) {
        case 'startCall':
            mp.events.callRemote('server:phone:startCall', data.number);
            break;
        case 'endCall':
            mp.events.callRemote('server:phone:endCall');
            break;
        case 'acceptCall':
            mp.events.callRemote('server:phone:acceptCall');
            break;
        case 'rejectCall':
            mp.events.callRemote('server:phone:rejectCall');
            break;
        case 'sendMessage':
            mp.events.callRemote('server:phone:sendMessage', data.number, data.message);
            break;
        case 'addContact':
            mp.events.callRemote('server:phone:addContact', data.name, data.number);
            break;
        case 'deleteContact':
            mp.events.callRemote('server:phone:deleteContact', data.contactId);
            break;
    }
}

function handleBankAppCallback(action, data) {
    switch (action) {
        case 'transfer':
            mp.events.callRemote('server:bank:transfer', data.target, data.amount);
            break;
        case 'requestHistory':
            mp.events.callRemote('server:bank:requestHistory');
            break;
    }
}

function handleVehiclesAppCallback(action, data) {
    switch (action) {
        case 'spawn':
            mp.events.callRemote('server:vehicle:spawn', data.vehicleId);
            break;
        case 'despawn':
            mp.events.callRemote('server:vehicle:despawn', data.vehicleId);
            break;
        case 'locate':
            mp.events.callRemote('server:vehicle:locate', data.vehicleId);
            break;
        case 'sell':
            mp.events.callRemote('server:vehicle:sell', data.vehicleId);
            break;
    }
}

function handleCameraAppCallback(action, data) {
    switch (action) {
        case 'open':
            // Camera logic
            mp.events.callRemote('server:camera:open');
            break;
        case 'takePhoto':
            mp.events.callRemote('server:camera:takePhoto');
            break;
    }
}

function handleQuickEatsCallback(action, data) {
    switch (action) {
        case 'order':
            mp.events.callRemote('server:quickeats:order', data.items, data.location);
            break;
    }
}

function handleEScootrCallback(action, data) {
    switch (action) {
        case 'rent':
            mp.events.callRemote('server:escootr:rent', data.location);
            break;
        case 'endRental':
            mp.events.callRemote('server:escootr:endRental');
            break;
    }
}

// ============================================
// LOCATION & MAP FEATURES
// ============================================

mp.events.add('client:phone:showLocationBlip', (x, y, z, name) => {
    clearLocationBlip();
    
    const position = new mp.Vector3(x, y, z);
    locationBlip = mp.blips.new(1, position, {
        name: name || 'Destination',
        scale: 1.0,
        color: 3,
        shortRange: false
    });
    
    locationColshape = mp.colshapes.newSphere(x, y, z, 5.0);
});

mp.events.add('playerEnterColshape', (colshape) => {
    if (colshape === locationColshape) {
        if (phoneBrowser) {
            phoneBrowser.execute(`
                receiveNotification('system', 'Destination', 'You have arrived at your destination.', 'system')
            `);
        }
        clearLocationBlip();
    }
});

mp.events.add('client:phone:clearLocationBlip', () => {
    clearLocationBlip();
});

// --- ESCOOTR TRACKING ---
mp.events.add('client:escootr:showLocation', (x, y, z) => {
    clearScooterMarkers();
    
    const position = new mp.Vector3(x, y, z);
    scooterBlip = mp.blips.new(1, position, {
        name: 'eScootr Rental',
        scale: 0.8,
        color: 25,
        shortRange: false
    });
    
    scooterMarker = mp.markers.new(1, position, 1.5, {
        color: [86, 171, 47, 150],
        visible: true
    });
});

mp.events.add('client:escootr:clearLocation', () => {
    clearScooterMarkers();
});

// ============================================
// SETTINGS & PREFERENCES
// ============================================

mp.events.add('client:phone:updateSettings', (settingsJson) => {
    if (phoneBrowser) {
        phoneBrowser.execute(`
            (function() {
                const settings = ${settingsJson};
                Object.assign(store.settings, settings);
            })();
        `);
    }
});

// ============================================
// GALLERY & MEDIA
// ============================================

mp.events.add('client:phone:updatePhotos', (photosJson, baseUrl) => {
    if (phoneBrowser) {
        phoneBrowser.execute(`
            (function() {
                store.photos = ${photosJson};
                store.mediaBaseUrl = '${baseUrl}';
            })();
        `);
    }
});

mp.events.add('client:phone:addPhoto', (photoUrl) => {
    if (phoneBrowser) {
        phoneBrowser.execute(`
            (function() {
                store.photos.unshift({
                    id: Date.now(),
                    url: '${photoUrl}',
                    timestamp: new Date().toISOString()
                });
            })();
        `);
    }
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

mp.events.add('client:phone:toast', (title, message) => {
    if (phoneBrowser) {
        phoneBrowser.execute(`receiveNotification('system', '${title}', '${message}', 'system')`);
    }
});

mp.events.add('client:phone:lockScreen', () => {
    if (phoneBrowser) {
        phoneBrowser.execute(`store.lock()`);
    }
});

// ============================================
// DEBUG & TESTING
// ============================================

mp.events.add('client:phone:debug', (message) => {
    mp.gui.chat.push(`[Phone Debug] ${message}`);
});
