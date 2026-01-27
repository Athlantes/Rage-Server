// client_packages/overlay.js
let overlayBrowser = null;
let isHudVisible = true;

// --- 1. BROWSER CREATION (ROBUST) ---
function createOverlay() {
    if (!overlayBrowser) {
        overlayBrowser = mp.browsers.new("package://ui/overlay.html");
        // Ensure it is active/visible
        overlayBrowser.active = true;
    }
}

// Event: Player joins
mp.events.add('playerReady', createOverlay);

// FIX: If script reloaded and player is already here, create it NOW.
if (mp.players.local) {
    createOverlay();
}

// --- 2. SPEEDOMETER & HUD LOOP ---
mp.events.add('render', () => {
    // Safety: If browser crashed or isn't created, stop here
    if (!overlayBrowser) return;

    // Optional: If you want to hide HUD entirely when inventory is open
    // if (global.isInventoryOpen) return; 

    const player = mp.players.local;
    const vehicle = player.vehicle;

    // SPEEDOMETER LOGIC
    // Check if player is in vehicle AND is the driver (seat -1)
    if (vehicle && vehicle.getPedInSeat(-1) === player.handle) {
        
        // 1. Get Speed (km/h) - Native Function is faster
        const speed = (vehicle.getSpeed() * 3.6).toFixed(0);
        
        // 2. Get Fuel (Synced from Server)
        const fuel = vehicle.getVariable('fuel') || 0;
        
        // 3. Get Lock Status (2 or 4 means locked)
        const lockStatus = vehicle.getDoorLockStatus();
        const isLocked = (lockStatus === 2 || lockStatus === 4);

        // 4. Send to UI
        overlayBrowser.execute(`updateSpeedo(${speed}, ${fuel}, ${isLocked});`);
        
    } else {
        // Not driving? Ensure Speedo is hidden
        overlayBrowser.execute(`hideSpeedo();`);
    }
});

// --- 3. CLOCK & MONEY LOOP (Runs every 1s) ---
setInterval(() => {
    if(overlayBrowser) {
        const player = mp.players.local;
        const money = player.getVariable('money') || 0;
        
        const now = new Date();
        const fullDate = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} | ${now.getDate()}/${now.getMonth() + 1}`;
        
        overlayBrowser.execute(`updateInfoHud('${player.name}', ${money}, '${fullDate}');`);
    }
}, 1000);

// --- 4. EXPORTED EVENTS ---

// NOTIFICATIONS
mp.events.add('showNotification', (title, message) => {
    // REMOVED: if (global.isInventoryOpen) return;  <-- You wanted to see them!
    if(overlayBrowser) {
        overlayBrowser.execute(`showNotification(${JSON.stringify(title)}, ${JSON.stringify(message)})`);
    }
});

// INTERACTION PROMPT (E)
mp.events.add('showInteraction', (title, text) => {
    if(overlayBrowser) {
        overlayBrowser.execute(`setInteraction(true, ${JSON.stringify(title)}, ${JSON.stringify(text)})`);
    }
});

mp.events.add('hideInteraction', () => {
    if(overlayBrowser) {
        overlayBrowser.execute(`setInteraction(false, '', '')`);
    }
});

// TOGGLE HUD (Called by Inventory)
mp.events.add('client:setHUDVisible', (visible) => {
    isHudVisible = visible;
    if (overlayBrowser) {
        overlayBrowser.execute(`setGameHUD(${visible});`);
    }
});

// HOTBAR UPDATES
mp.events.add('updateOverlayHotbar', (itemsJson) => {
    if(overlayBrowser) {
        overlayBrowser.execute(`updateHotbar('${itemsJson}')`);
    }
});

mp.events.add('showOverlayHotbar', (index) => {
    if(overlayBrowser) {
        overlayBrowser.execute(`showHotbar(${index})`);
    }
});

mp.events.add('updateJobUI', (visible, text, current, max) => {
    if (overlayBrowser) {
        overlayBrowser.execute(`updateJobUI(${visible}, ${JSON.stringify(text)}, ${current}, ${max});`);
    }
});

mp.events.add('updateZoneOverlay', (visible, type) => {
    if (overlayBrowser) {
        overlayBrowser.execute(`updateZoneStatus(${visible}, '${type}')`);
    }
});