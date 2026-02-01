// client_packages/phone/index.js
let phoneBrowser = null;
let isPhoneOpen = false;

// SCOOTER TRACKING VARIABLES
let activeScooterTrace = {
    blip: null,
    checkpoint: null,
    colshape: null
};

mp.events.add('playerReady', () => {
    if (!phoneBrowser) {
        phoneBrowser = mp.browsers.new('package://phone/ui/index.html');
        phoneBrowser.active = true;
    }
});

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

function clearScooterTrace() {
    if (activeScooterTrace.blip) {
        activeScooterTrace.blip.destroy();
        activeScooterTrace.blip = null;
    }
    if (activeScooterTrace.checkpoint) {
        activeScooterTrace.checkpoint.destroy();
        activeScooterTrace.checkpoint = null;
    }
    // Note: We don't destroy colshapes client-side usually, 
    // but if we used one for detection we would here.
}

// --- Events from Server ---

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

// NEW: Event to receive authoritative scooter location
mp.events.add('client:scooter:setLocate', (x, y, z) => {
    clearScooterTrace(); // Clean up old ones

    // 1. Set GPS Route (Purple line)
    mp.game.ui.setNewWaypoint(x, y);

    // 2. Create Visible Map Blip (Icon 665 = Scooter)
    activeScooterTrace.blip = mp.blips.new(665, new mp.Vector3(x, y, z), {
        name: 'Target Scooter',
        scale: 1.0,
        color: 83, // Purple to match waypoint
        shortRange: false,
    });
    activeScooterTrace.blip.setRoute(true); // Shows path on minimap

    // 3. Create 3D World Checkpoint (Visible column of light)
    activeScooterTrace.checkpoint = mp.checkpoints.new(1, new mp.Vector3(x, y, z - 1.0), 2.0, {
        direction: new mp.Vector3(0, 0, 75),
        color: [200, 50, 200, 200], // Purple
        visible: true,
        dimension: 0
    });
    
    // Notify app
    if(phoneBrowser) phoneBrowser.execute(`app.showToast('eScootr', 'GPS Set', 'Route and visual marker set.')`);
});

mp.events.add('client:phone:quickEats:update', (isActive, status, loc) => {
    if(phoneBrowser) phoneBrowser.execute(`app.updateQuickEatsUI(${isActive}, '${status}', ${loc ? `'${loc}'` : 'null'})`);
});

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
        
        // CHANGED: Locate logic now calls server for specific ID
        case 'locateScooter': 
            mp.events.callRemote('server:scooter:locate', data); // data is the ID
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

mp.events.add('client:phone:bank:data', (json) => {
    if (phoneBrowser) phoneBrowser.execute(`app.loadBankData(${json})`);
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
    clearScooterTrace(); // Remove marker if we rented one
    if (phoneBrowser) phoneBrowser.execute(`app.updateScooterUI(true, 100, 600)`); 
});

mp.events.add('client:scooter:lostTrack', () => {
    clearScooterTrace(); // Remove marker if someone else took it
    mp.game.graphics.notify("~r~Target scooter rented by another player!");
});

// Clean up checkpoints if we enter a vehicle (optional QoL)
mp.events.add('playerEnterVehicle', (vehicle, seat) => {
    if(activeScooterTrace.blip) {
        const dist = mp.players.local.dist(activeScooterTrace.blip.getCoords());
        if(dist < 5.0) clearScooterTrace();
    }
});