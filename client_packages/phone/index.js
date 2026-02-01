// client_packages/phone/index.js
let phoneBrowser = null;
let isPhoneOpen = false;

// --- ESCOOTR 2.0 TRACKING SYSTEM ---
let activeScooterTrace = {
    blip: null,
    checkpoint: null,
    routeSet: false
};

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

mp.keys.bind(0x28, true, () => { // Down Arrow
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

// --- SCOOTER TRACE HELPERS ---

function clearScooterTrace() {
    if (activeScooterTrace.blip && mp.blips.exists(activeScooterTrace.blip)) {
        activeScooterTrace.blip.destroy();
        activeScooterTrace.blip = null;
    }
    if (activeScooterTrace.checkpoint && mp.checkpoints.exists(activeScooterTrace.checkpoint)) {
        activeScooterTrace.checkpoint.destroy();
        activeScooterTrace.checkpoint = null;
    }
    if (activeScooterTrace.routeSet) {
        mp.game.ui.clearGpsPlayerWaypoint(); // Clears purple route
        activeScooterTrace.routeSet = false;
    }
}

// --- EVENTS FROM SERVER ---

// 1. Core Phone Events
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

// 2. Banking Events
mp.events.add('client:phone:bank:data', (json) => {
    if (phoneBrowser) phoneBrowser.execute(`app.loadBankData(${json})`);
});

// 3. Quick Eats Events
mp.events.add('client:phone:quickEats:update', (isActive, status, loc) => {
    if(phoneBrowser) phoneBrowser.execute(`app.updateQuickEatsUI(${isActive}, '${status}', ${loc ? `'${loc}'` : 'null'})`);
});

// --- ESCOOTR EVENTS (NEW) ---

// Receive list of nearby scooters from server
mp.events.add('client:phone:receiveScooters', (scooters) => {
    if (!phoneBrowser) return;
    
    // Send list to UI
    phoneBrowser.execute(`app.loadScooterList(${JSON.stringify(scooters)})`);
    
    // Check if player is currently sitting on a scooter to update UI state
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

// Receive authoritative coordinates to track
mp.events.add('client:scooter:setLocate', (x, y, z) => {
    clearScooterTrace(); // Clean up old markers

    // 1. Set GPS Route (Purple line on minimap)
    mp.game.ui.setNewWaypoint(x, y);
    activeScooterTrace.routeSet = true;

    // 2. Create Map Blip (Icon 522 or 665 = Scooter)
    activeScooterTrace.blip = mp.blips.new(522, new mp.Vector3(x, y, z), {
        name: 'Requested eScootr',
        scale: 1.0,
        color: 83, // Purple
        shortRange: false,
    });
    activeScooterTrace.blip.setRoute(true); // Highlights path

    // 3. Create 3D World Checkpoint (Visual Column)
    activeScooterTrace.checkpoint = mp.checkpoints.new(1, new mp.Vector3(x, y, z - 1.0), 2.0, {
        direction: new mp.Vector3(0, 0, 75),
        color: [200, 50, 200, 150], // Purple transparent
        visible: true,
        dimension: 0
    });
    
    if(phoneBrowser) phoneBrowser.execute(`app.showToast('eScootr', 'GPS Set', 'Route calculated to scooter.')`);
});

mp.events.add('client:scooter:lostTrack', () => {
    clearScooterTrace(); // Remove marker if someone else took it
    mp.game.graphics.notify("~r~[eScootr]~w~ Signal lost (Vehicle Rented).");
});

mp.events.add('client:phone:rentSuccess', (endTime) => {
    clearScooterTrace(); // Remove marker if we successfully rented it
    if (phoneBrowser) phoneBrowser.execute(`app.updateScooterUI(true, 100, 600)`); 
    mp.game.graphics.notify("~g~[eScootr]~w~ Rental started. Engine unlocked.");
});

// Auto-remove checkpoint if we get close to it or enter a vehicle
mp.events.add('render', () => {
    if (activeScooterTrace.checkpoint) {
        const dist = mp.players.local.dist(activeScooterTrace.checkpoint.position);
        if (dist < 5.0) {
            mp.game.graphics.notify("~g~[eScootr]~w~ You have arrived.");
            clearScooterTrace();
        }
    }
});

// --- PROXY HANDLER (UI -> SERVER) ---

mp.events.add('client:proxyAction', (action, data) => {
    switch (action) {
        case 'requestBankData':
            mp.events.callRemote('server:phone:bank:open');
            break;
        case 'toggleQuickEats':
            mp.events.callRemote('server:phone:quickEats:toggle');
            break;
        case 'bankTransfer':
            const transferData = JSON.parse(data); 
            mp.events.callRemote('server:phone:bank:transfer', transferData.t, transferData.a);
            break;
        case 'requestScooters':
            mp.events.callRemote('server:phone:requestScooters');
            break;
        
        // NEW: "Find" logic now sends ID, not coords
        case 'locateScooter': 
            mp.events.callRemote('server:scooter:locate', data); 
            break;

        case 'checkScooterStatus':
            mp.events.callRemote('server:phone:requestScooters');
            break;
        case 'rentScooter':
            const veh = mp.players.local.vehicle;
            if (veh && veh.getVariable('isScooter')) {
                 mp.events.callRemote('server:phone:rentScooter', veh.getVariable('scooterId'), data);
            }
            break;
        case 'readMail':
            mp.events.callRemote('server:phone:readMail', data);
            break;
        case 'readAllMails':
            mp.events.callRemote('server:phone:readAllMails');
            break;
        default:
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