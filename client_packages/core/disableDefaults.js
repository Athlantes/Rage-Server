// client_packages/core/disableDefaults.js

// --------------------------------------------------------------------
// 1. CONSTANTS & STATE
// --------------------------------------------------------------------
const player = mp.players.local;

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