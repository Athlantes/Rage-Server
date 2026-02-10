// client_packages/core/overlay.js
let overlayBrowser = null;
let isHudVisible = true;
let currentJobLocation = null;

// --- HELPER: Weapon Name Converter ---
function getWeaponName(hash) {
    switch (hash) {
        // Melee
        case 0xA2719263: return "Fist";
        case 0x99B507EA: return "Knife";
        case 0x678B81B1: return "Bat";
        case 0x84BD7BFD: return "Crowbar";
        case 0x92A27487: return "Dagger";
        case 0xF9E6AA4B: return "Bottle";
        case 0xDFE37640: return "Switchblade";
        case 0x958A4A8F: return "Bat";
        case 0x19044EE0: return "Wrench";
        case 0x8BB05FD7: return "Flashlight";
        
        // Pistols
        case 0x99AEEB3B: return ".50 Pistol";
        case 0x1B06D571: return "Pistol";
        case 0x5EF9FEC4: return "Combat Pistol";
        case 0x22D8FE39: return "AP Pistol";
        case 0x3656C8C1: return "Stun Gun";
        case 0x99AEEB3B: return "Vintage Pistol";
        case 0xD205520E: return "Heavy Pistol";
        case 0x97EA20B8: return "Double Action";
        case 0xAF3696A1: return "Up-n-Atomizer";

        // SMGs
        case 0x13532244: return "Micro SMG";
        case 0x2BE6766B: return "SMG";
        case 0xEFE7E2DF: return "Assault SMG";
        case 0x0A3D4D34: return "Combat PDW";
        case 0xDB1AA450: return "Machine Pistol";
        case 0xBD248B55: return "Mini SMG";

        // Shotguns
        case 0x1D073A89: return "Pump Shotgun";
        case 0x7846A318: return "Sawed-Off";
        case 0xE284C527: return "Assault Shotgun";
        case 0x9D61E50F: return "Bullpup Shotgun";
        case 0x3AABBBAA: return "Heavy Shotgun";
        case 0xEF951FBB: return "Double Barrel";

        // Rifles
        case 0x83BF0278: return "Carbine Rifle";
        case 0xBFEFFF6D: return "Assault Rifle";
        case 0xAF113F99: return "Advanced Rifle";
        case 0xC0A3098D: return "Special Carbine";
        case 0x7F229F94: return "Bullpup Rifle";
        case 0x624FE830: return "Compact Rifle";

        // Heavy / Sniper
        case 0x9D07F764: return "MG";
        case 0x7FD62962: return "Combat MG";
        case 0x05FC3C11: return "Sniper Rifle";
        case 0x0C472904: return "Heavy Sniper";
        case 0xA4BAC071: return "Marksman Rifle";
        case 0xB1CA77B1: return "RPG";

        default: return "WEAPON"; 
    }
}

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

    // A. Vehicle HUD
    if (vehicle && vehicle.getPedInSeat(-1) === player.handle) {
        const speed = (vehicle.getSpeed() * 3.6).toFixed(0);
        const fuel = vehicle.getVariable('fuel') || 0;
        const lockStatus = vehicle.getDoorLockStatus();
        const isLocked = (lockStatus === 2 || lockStatus === 4);

        overlayBrowser.execute(`updateSpeedo(${speed}, ${fuel}, ${isLocked});`);
    } else {
        overlayBrowser.execute(`hideSpeedo();`);
    }

    // B. Weapon HUD
    // Check if player has a weapon equipped (Hash 2725352035 / 0xA2719263 is 'Unarmed/Fist')
    const currentWeapon = player.weapon;
    
    // We only show HUD if weapon is NOT Unarmed (Fist)
    if (currentWeapon && currentWeapon !== 2725352035 && isHudVisible) {
        
        // 1. Get Ammo in Clip (Loaded)
        const ammoInClip = player.getAmmoInClip(currentWeapon);
        
        // 2. Get Total Ammo (Includes loaded ammo)
        const totalAmmo = player.getAmmoInWeapon(currentWeapon);
        
        // 3. Calculate Reserve (Total - Loaded)
        let reserveAmmo = totalAmmo - ammoInClip;
        if (reserveAmmo < 0) reserveAmmo = 0; // Safety check

        const weaponName = getWeaponName(currentWeapon);
        
        // Send (Loaded) / (Reserve)
        overlayBrowser.execute(`updateWeaponStats(true, '${weaponName}', ${ammoInClip}, ${reserveAmmo});`);
    } else {
        overlayBrowser.execute(`updateWeaponStats(false);`);
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

mp.events.add('updateHUD', (minutesPlayed) => {
    if (global.hudBrowser) { // Use your browser variable name
        // Execute the function we wrote in Step 1
        global.hudBrowser.execute(`updatePaydayTimer(${minutesPlayed});`);
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