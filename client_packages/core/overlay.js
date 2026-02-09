// client_packages/core/overlay.js
let overlayBrowser = null;
let isHudVisible = true;
let currentJobLocation = null;

// --- HELPER: Client-Side Distance Calculation ---
function getDistance(v1, v2) {
    if (!v1 || !v2 || typeof v1.x !== 'number' || typeof v2.x !== 'number') return 0;
    const dist = mp.game.system.vdist(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
    return Math.max(0, dist);
}

// --- 1. BROWSER CREATION ---
function createOverlay() {
    if (!overlayBrowser) {
        overlayBrowser = mp.browsers.new("package://ui/overlay.html");
        overlayBrowser.active = true;
    }
}

mp.events.add('playerReady', createOverlay);

if (mp.players.local) {
    createOverlay();
}

mp.events.add('client:ui:toggleMic', (state) => {
    if (overlayBrowser) {
        overlayBrowser.execute(`toggleMic(${state});`);
    }
});

// --- 2. SPEEDOMETER & HUD LOOP ---
mp.events.add('render', () => {
    if (!overlayBrowser) return;

    const player = mp.players.local;
    const vehicle = player.vehicle;

    if (vehicle && vehicle.getPedInSeat(-1) === player.handle) {
        const speed = (vehicle.getSpeed() * 3.6).toFixed(0);
        const fuel = vehicle.getVariable('fuel') || 0;
        const lockStatus = vehicle.getDoorLockStatus();
        const isLocked = (lockStatus === 2 || lockStatus === 4);

        overlayBrowser.execute(`updateSpeedo(${speed}, ${fuel}, ${isLocked});`);
    } else {
        overlayBrowser.execute(`hideSpeedo();`);
    }
});

// --- 3. CLOCK, MONEY & JOB DISTANCE LOOP (Runs every 1s) ---
setInterval(() => {
    if(overlayBrowser) {
        const player = mp.players.local;
        
        // A. Update Clock & Money & ID
        const money = player.getVariable('money') || 0;
        const bank = player.getVariable('bank') || 0;
        const onlineId = player.getVariable('onlineId');
        const displayId = (onlineId !== undefined) ? onlineId : '-';
        
        const now = new Date();
        const fullDate = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} | ${now.getDate()}/${now.getMonth() + 1}`;
        
        // FIX: Escape the name to prevent syntax errors
        const safeName = player.name.replace(/'/g, "\\'");
        
        // Update UI with new ID parameter
        overlayBrowser.execute(`updateInfoHud('${displayId}', '${safeName}', ${money}, ${bank}, '${fullDate}');`);

        // B. Update Job Distance Live
        if (currentJobLocation) {
            const dist = getDistance(player.position, currentJobLocation);
            overlayBrowser.execute(`updateDistance(${dist});`);
        }
    }
}, 1000);

// --- 4. EXPORTED EVENTS ---

mp.events.add('showNotification', (title, message) => {
    if(overlayBrowser) {
        overlayBrowser.execute(`showNotification(${JSON.stringify(title)}, ${JSON.stringify(message)})`);
    }
});

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

mp.events.add('client:setHUDVisible', (visible) => {
    isHudVisible = visible;
    if (overlayBrowser) {
        overlayBrowser.execute(`setGameHUD(${visible});`);
    }
});

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

mp.events.add('updateJobUI', (visible, text, current, max, earned, x, y, z) => {
    
    if (overlayBrowser) {
        if (visible && x != null && y != null) {
            currentJobLocation = new mp.Vector3(x, y, z);
        } else {
            currentJobLocation = null;
        }

        const safeEarned = earned || 0;
        overlayBrowser.execute(`updateJobUI(${visible}, ${JSON.stringify(text)}, ${current}, ${max}, ${safeEarned}, 0);`);
        
        if (currentJobLocation) {
            const player = mp.players.local;
            const dist = getDistance(player.position, currentJobLocation);
            overlayBrowser.execute(`updateDistance(${dist});`);
        }
    }
});

mp.events.add('updateZoneOverlay', (visible, type) => {
    if (overlayBrowser) {
        overlayBrowser.execute(`updateZoneStatus(${visible}, '${type}')`);
    }
});