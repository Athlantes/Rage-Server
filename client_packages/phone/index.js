// client_packages/phone/index.js

let phoneBrowser = null;
let isPhoneOpen = false;

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
    if(isPhoneOpen) closePhone();
});

function closePhone() {
    isPhoneOpen = false;
    mp.gui.cursor.show(false, false);
    mp.gui.chat.activate(true); 
    if(phoneBrowser) phoneBrowser.execute(`closePhone()`);
}

// --- STANDARD APP EVENTS ---

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

mp.events.add('client:phone:bank:data', (json) => {
    if (phoneBrowser) phoneBrowser.execute(`app.loadBankData(${json})`);
});

mp.events.add('client:phone:quickEats:update', (isActive, status, loc) => {
    if(phoneBrowser) phoneBrowser.execute(`app.updateQuickEatsUI(${isActive}, '${status}', ${loc ? `'${loc}'` : 'null'})`);
});

// --- ESCOOTR UI EVENTS ---
// Note: Blip/GPS tracking is now handled in client_packages/systems/scooters.js

mp.events.add('client:phone:receiveScooters', (scooters) => {
    if (!phoneBrowser) return;
    
    // 1. Update the "Find List"
    phoneBrowser.execute(`app.loadScooterList(${JSON.stringify(scooters)})`);
    
    // 2. Check if we are riding one to update the Dashboard
    const veh = mp.players.local.vehicle;
    const isOnScooter = (veh && veh.getVariable('isScooter'));
    let timeLeft = 0;
    let battery = 0;
    
    if (isOnScooter) {
        // We use 'battery' variable now from the new system
        battery = veh.getVariable('battery') || 100;
        const endTime = veh.getVariable('rentEndTime') || 0;
        const now = Date.now();
        
        if (endTime > now) {
            timeLeft = Math.ceil((endTime - now) / 1000);
        }
    }
    
    // Update UI Dashboard
    phoneBrowser.execute(`app.updateScooterUI(${isOnScooter}, ${battery}, ${timeLeft})`);
});

mp.events.add('client:phone:rentSuccess', (endTime) => {
    // Force UI update to show the "Active Ride" screen immediately
    if (phoneBrowser) phoneBrowser.execute(`app.updateScooterUI(true, 100, 600)`);
});

// --- PROXY HANDLER ---

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
        case 'checkScooterStatus':
            mp.events.callRemote('server:phone:requestScooters');
            break;
            
        case 'locateScooter': 
            const scootId = parseInt(data);
            if (!isNaN(scootId)) {
                mp.events.callRemote('server:scooter:locate', scootId);
            } else {
                mp.gui.chat.push("~r~[Phone] Error: Invalid ID format.");
            }
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