// client_packages/core/disableDefaults.js

// --------------------------------------------------------------------
// 1. CONSTANTS & STATE
// --------------------------------------------------------------------
const player = mp.players.local;
let isCamShaking = false;

// --------------------------------------------------------------------
// 3. CORE EVENTS
// --------------------------------------------------------------------
mp.events.add('playerReady', () => {

    // General Configs
    mp.game.vehicle.defaultEngineBehaviour = false;
    player.setConfigFlag(429, true); // Disable seatbelt chime/auto-helmet
    player.setConfigFlag(241, true); // Disable auto-helmet
});

mp.events.add('render', () => {
    mp.gui.chat.show(false);
    
    // [MODIFIED] Removed Pause Menu & ESC Disabling to restore native menu
    
    const hudComponents = [1, 2, 3, 4, 19, 20, 6, 7, 8, 9];
    hudComponents.forEach(id => mp.game.ui.hideHudComponentThisFrame(id));

    // 2. Disable Specific Default Inputs
    mp.game.controls.disableControlAction(0, 37, true); // Tab
    mp.game.controls.disableControlAction(0, 85, true); // Radio
    
    // 3. Radio OFF Fix
    if (player.vehicle && player.vehicle.getIsEngineRunning()) {
        if (mp.game.invoke('0xE8AF77C4C06ADC93') !== 255) { // If radio station is not "OFF"
             mp.game.audio.setRadioToStationName("OFF");
        }
    }

    // 4. Job Restrictions
    if (player.getVariable('isJobCarrying')) {
        const disabledControls = [22, 24, 257, 25, 140, 141, 142, 143, 23, 75];
        disabledControls.forEach(ctrl => mp.game.controls.disableControlAction(0, ctrl, true));
    }

    // --------------------------------------------------------------------
    // 5. DRIVER SHOOTING RESTRICTIONS
    // --------------------------------------------------------------------
    if (player.vehicle && player.vehicle.getPedInSeat(-1) === player.handle) {
        const vehicle = player.vehicle;
        const speed = vehicle.getSpeed() * 3.6; // km/h
        const weaponHash = player.weapon;
        const weaponGroup = mp.game.weapon.getWeapontypeGroup(weaponHash);
        const PISTOL_GROUP = 416676503;

        // 1. RESTRICT: Disable controls if Speed > 50 OR Weapon is NOT a Pistol
        if (speed > 50 || weaponGroup !== PISTOL_GROUP) {
            mp.game.controls.disableControlAction(0, 68, true); // Aim
            mp.game.controls.disableControlAction(0, 69, true); // Attack
            mp.game.controls.disableControlAction(0, 70, true); // Attack 2
        }

        // 2. EFFECT: Apply Shake & Handling Difficulty while Aiming
        const isAiming = mp.game.controls.isControlPressed(0, 68);
        
        // Only apply if they are allowed to shoot (Pistol & < 50km/h) AND are aiming
        if (isAiming && speed <= 50 && weaponGroup === PISTOL_GROUP) {
            
            // Check '!isCamShaking' to ensure we only trigger the start ONCE
            if (!isCamShaking) {
                mp.game.cam.shakeGameplayCam("HAND_SHAKE", 2.0); 
                isCamShaking = true;
            }

            // Disable Handbrake to make driving harder (no drifting/sharp turns)
            mp.game.controls.disableControlAction(0, 76, true); 

        } else {
            // Stop shake ONLY if it is currently active
            if (isCamShaking) {
                mp.game.cam.stopGameplayCamShaking(true);
                isCamShaking = false;
            }
        } 
    } else {
        // Safety: Stop shake if player leaves vehicle/seat while aiming
        if (isCamShaking) {
            mp.game.cam.stopGameplayCamShaking(true);
            isCamShaking = false;
        }
    }
});

// --------------------------------------------------------------------
// 4. VEHICLE & EXTRAS
// --------------------------------------------------------------------
mp.events.add('playerEnterVehicle', () => {
    player.setConfigFlag(429, true);
    player.setConfigFlag(241, true);
    mp.game.audio.setUserRadioControlEnabled(false);
});

mp.events.add('playerLeaveVehicle', () => {
    mp.game.audio.setUserRadioControlEnabled(true);
});

// AFK Camera Fix
setInterval(() => {
    mp.game.invoke('0xF4F2C0D4EE209E20'); 
    mp.game.invoke('0x9E4CFFF989258472'); 
}, 25000);

