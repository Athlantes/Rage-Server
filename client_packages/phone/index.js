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
    // 1. Prevent opening if chat is open (Fixed: removed mp.console check)
    if (mp.gui.chat.visible) return;

    // 2. If another menu is open (cursor visible) and phone is CLOSED, don't open phone
    if (mp.gui.cursor.visible && !isPhoneOpen) return;

    isPhoneOpen = !isPhoneOpen;
    
    if (isPhoneOpen) {
        // Fetch fresh data
        mp.events.callRemote('server:phone:open');
        
        // Show UI & Cursor
        mp.gui.cursor.show(true, true);
        phoneBrowser.execute(`openPhone()`);
    } else {
        closePhone();
    }
});

function closePhone() {
    isPhoneOpen = false;
    mp.gui.cursor.show(false, false);
    
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

// Allow the HTML/JS to close the phone (e.g. via the power button)
mp.events.add('client:closePhoneWrapper', () => {
    isPhoneOpen = false;
    mp.gui.cursor.show(false, false);
});

mp.events.add('client:setWaypoint', (x, y) => {
    mp.game.ui.setNewWaypoint(x, y);
});

mp.events.add('client:proxyAction', (action, vehId) => {
    mp.events.callRemote('server:phone:vehicleAction', action, vehId);
});

mp.events.add('client:leaveVehicle', () => {
    const player = mp.players.local;
    if(player.vehicle) {
        player.taskLeaveVehicle(player.vehicle.handle, 0);
    }
});