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

mp.events.add('client:phone:quickEats:update', (isActive, status, loc) => {
    if(phoneBrowser) {
        phoneBrowser.execute(`app.updateQuickEatsUI(${isActive}, '${status}', ${loc ? `'${loc}'` : 'null'})`);
    }
});

mp.events.add('client:proxyAction', (action, data) => {
    switch (action) {
        // --- BANKING ROUTES ---
        case 'requestBankData':
            // Just asks server to send back balance/history
            mp.events.callRemote('server:phone:bank:open');
            break;

        case 'toggleQuickEats':
            mp.events.callRemote('server:phone:quickEats:toggle');
            break;

        case 'bankTransfer':
            // Parse the JSON data we sent from the UI
            const transferData = JSON.parse(data); // { t: targetName, a: amount }
            mp.events.callRemote('server:phone:bank:transfer', transferData.t, transferData.a);
            break;

        case 'requestScooters':
            mp.events.callRemote('server:phone:requestScooters');
            break;

        case 'setWaypoint':
            const pos = JSON.parse(data);
            
            mp.game.ui.setNewWaypoint(pos.x, pos.y);
            
            if (pos.id !== undefined) {
                mp.events.callRemote('server:scooter:enableTracking', pos.id);
            }
            break;

        case 'checkScooterStatus':
            mp.events.callRemote('server:phone:requestScooters');
            break;
            
        case 'rentScooter':
            // Use the scooterId stored on the vehicle you are sitting on
            const veh = mp.players.local.vehicle;
            if (veh && veh.getVariable('isScooter')) {
                 mp.events.callRemote('server:phone:rentScooter', veh.getVariable('scooterId'), data);
            }
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

mp.events.add('client:phone:receiveScooters', (scooters) => {
    if (!phoneBrowser) return;

    phoneBrowser.execute(`app.loadScooterList(${JSON.stringify(scooters)})`);
    
    const veh = mp.players.local.vehicle;
    const isOnScooter = (veh && veh.getVariable('isScooter'));
    
    let timeLeft = 0;
    let fuel = 0;

    if (isOnScooter) {
        fuel = veh.getVariable('fuel') || 100;
        
        const endTime = veh.getVariable('rentEndTime') || 0;
        const now = Date.now();
        
        if (endTime > now) {
            timeLeft = Math.ceil((endTime - now) / 1000);
        }
    }
    
    phoneBrowser.execute(`app.updateScooterUI(${isOnScooter}, ${fuel}, ${timeLeft})`);
});

mp.events.add('client:phone:rentSuccess', (endTime) => {
    if (!phoneBrowser) return;
    // FIX: Use phoneBrowser.execute
    phoneBrowser.execute(`app.updateScooterUI(true, 100, 600)`); 
});

mp.events.add('client:scooter:lostTrack', () => {
    // Clear the purple user waypoint
    mp.game.invoke('0x6CDD5893CF43E1F9', 4); 
    
    // Visual feedback
    mp.game.graphics.notify("~r~Target scooter rented by another player!");
});