// client_packages/phone/index.js
let phoneBrowser = null;
let isPhoneOpen = false;

// Initialize the browser but keep it hidden
mp.events.add('playerReady', () => {
    if (!phoneBrowser) {
        phoneBrowser = mp.browsers.new('package://phone/ui/index.html');
        phoneBrowser.active = true;
    }
});

// Keybind: Arrow Up (0x26) to Open/Close
mp.keys.bind(0x26, true, () => {
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

//Keybind Arrow Down to Close Phone
mp.keys.bind(0x28, true, () => {
    if(isPhoneOpen) {
        closePhone();
    }
});

function closePhone() {
    isPhoneOpen = false;
    mp.gui.cursor.show(false, false);
    mp.gui.chat.activate(true); 
    if(phoneBrowser) {
        phoneBrowser.execute(`closePhone()`);
    }
}

// --- Events from Server ---

mp.events.add('client:phone:initialize', (mailsJson) => {
    if(phoneBrowser) {
        phoneBrowser.execute(`app.loadMails(${mailsJson})`);
    }
});

mp.events.add('client:phone:receiveMail', (sender, title, message) => {
    if(phoneBrowser) {
        phoneBrowser.execute(`app.receiveNotification('${sender}', '${title}', '${message}')`);
    }
});

mp.events.add('client:phone:updateVehicles', (carsJson) => {
    if(phoneBrowser) {
        phoneBrowser.execute(`app.loadVehicles(${carsJson})`);
    }
});

mp.events.add('client:closePhoneWrapper', () => {
    isPhoneOpen = false;
    mp.gui.cursor.show(false, false);
});

mp.events.add('client:setWaypoint', (x, y) => {
    mp.game.ui.setNewWaypoint(x, y);
});

mp.events.add('client:proxyAction', (action, data) => {
    switch (action) {
        // --- BANKING ROUTES ---
        case 'requestBankData':
            // Just asks server to send back balance/history
            mp.events.callRemote('server:phone:bank:open');
            break;

        case 'bankTransfer':
            // Parse the JSON data we sent from the UI
            const transferData = JSON.parse(data); // { t: targetName, a: amount }
            mp.events.callRemote('server:phone:bank:transfer', transferData.t, transferData.a);
            break;

        // --- DEFAULT ROUTE (Vehicles & Mail) ---
        default:
            // Keeps existing logic for 'spawn', 'locate', 'readMail', etc.
            // The "data" argument here is usually the ID (vehicle ID or mail ID)
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

mp.events.add('client:phone:bank:data', (json) => {
    // Forward to Browser
    if (phoneBrowser) {
        phoneBrowser.execute(`app.loadBankData(${json})`);
    }
});