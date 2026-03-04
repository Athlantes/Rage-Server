// client_packages/core/overlay.js
let overlayBrowser = null;
let isHudVisible = true;
let currentJobLocation = null;

function getWeaponName(hash) {
    switch (hash) {
        case 0xA2719263: return "Fist";
        case 0x99B507EA: return "Knife";
        case 0x678B81B1: return "Bat";
        case 0x84BD7BFD: return "Crowbar";
        case 0x1B06D571: return "Pistol";
        case 0x5EF9FEC4: return "Combat Pistol";
        case 0x22D8FE39: return "AP Pistol";
        case 0x3656C8C1: return "Stun Gun";
        case 0x13532244: return "Micro SMG";
        case 0x2BE6766B: return "SMG";
        case 0x1D073A89: return "Pump Shotgun";
        case 0x7846A318: return "Sawed-Off";
        case 0xE284C527: return "Assault Shotgun";
        case 0x83BF0278: return "Carbine Rifle";
        case 0xBFEFFF6D: return "Assault Rifle";
        case 0xAF113F99: return "Advanced Rifle";
        case 0xC0A3098D: return "Special Carbine";
        case 0x7FD62962: return "Combat MG";
        case 0x05FC3C11: return "Sniper Rifle";
        case 0xB1CA77B1: return "RPG";
        default: return "WEAPON"; 
    }
}

function getDistance(v1, v2) {
    if (!v1 || !v2 || typeof v1.x !== 'number' || typeof v2.x !== 'number') return 0;
    const dist = mp.game.system.vdist(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
    return Math.max(0, dist);
}

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
    if (overlayBrowser) overlayBrowser.execute(`toggleMic(${state});`);
});

// --- RENDER LOOP ---
mp.events.add('render', () => {
    if (!overlayBrowser) return;

    const player = mp.players.local;
    const vehicle = player.vehicle;

    // --- INFINITE STAMINA LOGIC ---
    // If Thirst is > 10%, restore stamina to full every frame
    const thirst = player.getVariable('thirst') || 100;
    if (thirst > 10) {
        mp.game.player.restoreStamina(100);
    }
    // ------------------------------

    if (vehicle && vehicle.getPedInSeat(-1) === player.handle) {
        const speed = (vehicle.getSpeed() * 3.6).toFixed(0);
        const fuel = vehicle.getVariable('fuel') || 0;
        const lockStatus = vehicle.getDoorLockStatus();
        const isLocked = (lockStatus === 2 || lockStatus === 4);
        overlayBrowser.execute(`updateSpeedo(${speed}, ${fuel}, ${isLocked});`);
    } else {
        overlayBrowser.execute(`hideSpeedo();`);
    }

    const currentWeapon = player.weapon;
    
    // Check if the player is holding Aim (25) or Attack/Shoot (24)
    const isAimingOrShooting = mp.game.controls.isControlPressed(0, 25) || mp.game.controls.isControlPressed(0, 24);

    if (currentWeapon && currentWeapon !== 2725352035 && isHudVisible && isAimingOrShooting) {
        const ammoInClip = player.getAmmoInClip(currentWeapon);
        
        // Only proceed if ammo is actually defined (it becomes undefined when holstered in a car)
        if (ammoInClip !== undefined) {
            const totalAmmo = player.getAmmoInWeapon(currentWeapon) || 0;
            let reserveAmmo = totalAmmo - ammoInClip;
            
            if (reserveAmmo < 0 || isNaN(reserveAmmo)) reserveAmmo = 0; 
            
            const weaponName = getWeaponName(currentWeapon);
            overlayBrowser.execute(`updateWeaponStats(true, '${weaponName}', ${ammoInClip}, ${reserveAmmo});`);
        } else {
            // Hide the HUD if they are in a car and the weapon is technically "holstered"
            overlayBrowser.execute(`updateWeaponStats(false);`);
        }
    } else {
        // Hide the HUD if they are not aiming/shooting, or if they unequip their weapon
        overlayBrowser.execute(`updateWeaponStats(false);`);
    }
});

setInterval(() => {
    if(overlayBrowser) {
        const player = mp.players.local;
        const money = player.getVariable('money') || 0;
        const bank = player.getVariable('bank') || 0;
        const onlineId = player.getVariable('onlineId');
        const displayId = (onlineId !== undefined) ? onlineId : '-';
        
        const hunger = player.getVariable('hunger') || 100;
        const thirst = player.getVariable('thirst') || 100;

        const now = new Date();
        const fullDate = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} | ${now.getDate()}/${now.getMonth() + 1}`;
        const safeName = player.name.replace(/'/g, "\\'");
        
        overlayBrowser.execute(`updateInfoHud('${displayId}', '${safeName}', ${money}, ${bank}, '${fullDate}', ${hunger}, ${thirst});`);

        if (currentJobLocation) {
            const dist = getDistance(player.position, currentJobLocation);
            overlayBrowser.execute(`updateDistance(${dist});`);
        }
    }
}, 1000);

mp.events.add('showNotification', (title, message) => {
    if(overlayBrowser) overlayBrowser.execute(`showNotification(${JSON.stringify(title)}, ${JSON.stringify(message)})`);
});

mp.events.add('showInteraction', (title, text) => {
    if(overlayBrowser) overlayBrowser.execute(`setInteraction(true, ${JSON.stringify(title)}, ${JSON.stringify(text)})`);
});

mp.events.add('hideInteraction', () => {
    if(overlayBrowser) overlayBrowser.execute(`setInteraction(false, '', '')`);
});

mp.events.add('client:setHUDVisible', (visible) => {
    isHudVisible = visible;
    if (overlayBrowser) overlayBrowser.execute(`setGameHUD(${visible});`);
});

mp.events.add('updateOverlayHotbar', (itemsJson) => {
    if(overlayBrowser) overlayBrowser.execute(`updateHotbar('${itemsJson}')`);
});

mp.events.add('showOverlayHotbar', (index) => {
    if(overlayBrowser) overlayBrowser.execute(`showHotbar(${index})`);
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
    }
});

mp.events.add('updateZoneOverlay', (visible, type) => {
    if (overlayBrowser) overlayBrowser.execute(`updateZoneStatus(${visible}, '${type}')`);
});

mp.events.add('updatePaydayHUD', (minutesLeft) => {
    if (overlayBrowser) {
        overlayBrowser.execute(`updatePaydayTimer(${minutesLeft});`);
    }
});

mp.events.add('showCenterPopup', (title, subtitle, rewardsJson, duration) => {
    if (overlayBrowser) {
        const safeTitle = title.replace(/'/g, "\\'");
        const safeSubtitle = subtitle.replace(/'/g, "\\'");
        const safeRewards = rewardsJson.replace(/'/g, "\\'");
        const dur = duration || 6000;
        overlayBrowser.execute(`showCenterPopup('${safeTitle}', '${safeSubtitle}', '${safeRewards}', ${dur});`);
    }
});

mp.events.add('updateCooldowns', (cooldownsJson) => {
    if (overlayBrowser) {
        overlayBrowser.execute(`updateCooldowns('${cooldownsJson}');`);
    }
});
mp.events.add('showStopOrderNotification', (name, isSender) => {
    if (overlayBrowser) {
        overlayBrowser.execute(`showStopOrder(${JSON.stringify(name)}, ${isSender});`);
    }
});

mp.events.add('updateWantedHUD', (wantedType) => {
    if (overlayBrowser) {
        overlayBrowser.execute(`updateWantedHUD(${JSON.stringify(wantedType)});`);
    }
});