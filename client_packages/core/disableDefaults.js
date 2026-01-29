// 1. AFK / Idle Camera Reset (MOVED OUTSIDE RENDER)
setInterval(() => {
    mp.game.invoke('0xF4F2C0D4EE209E20'); // Reset idle camera (on foot)
    mp.game.invoke('0x9E4CFFF989258472'); // Reset idle camera (vehicle)
}, 25000);

mp.events.add('render', () => {
    // --------------------------------------------------------------------
    // 2. PAUSE MENU HANDLER (The Fix)
    // --------------------------------------------------------------------
    // Disable default ESC menu
    mp.game.controls.disableControlAction(0, 199, true); // INPUT_FRONTEND_PAUSE
    mp.game.controls.disableControlAction(0, 200, true); // INPUT_FRONTEND_PAUSE_ALTERNATE

    // Manually check for ESC press to open OUR menu
    if (mp.game.controls.isDisabledControlJustPressed(0, 200)) {
        // [Fix] Only toggle if the Native Pause Menu (Map) is NOT active
        if (!mp.game.ui.isPauseMenuActive()) {
            mp.events.call('client:togglePauseMenu');
        }
    }

    // --------------------------------------------------------------------
    // 3. HIDE HUD COMPONENTS
    // --------------------------------------------------------------------
    mp.game.ui.hideHudComponentThisFrame(3);  // Cash
    mp.game.ui.hideHudComponentThisFrame(4);  // MP Cash
    mp.game.ui.hideHudComponentThisFrame(19); // Weapon Wheel
    mp.game.ui.hideHudComponentThisFrame(20); // Weapon Wheel Stats
    mp.game.ui.hideHudComponentThisFrame(6);  // Vehicle Name
    mp.game.ui.hideHudComponentThisFrame(7);  // Area Name
    mp.game.ui.hideHudComponentThisFrame(9);  // Street Name

    // --------------------------------------------------------------------
    // 4. DISABLE DEFAULTS (Input)
    // --------------------------------------------------------------------
    mp.game.controls.disableControlAction(0, 37, true); // Weapon Wheel (TAB)
    mp.game.controls.disableControlAction(0, 85, true); // Radio (Q)
    mp.game.controls.disableControlAction(0, 81, true); // Next Station
    mp.game.controls.disableControlAction(0, 82, true); // Prev Station

    // --------------------------------------------------------------------
    // 5. JOB RESTRICTIONS
    // --------------------------------------------------------------------
    if (mp.players.local.getVariable('isJobCarrying')) {
        mp.game.controls.disableControlAction(0, 22, true); // Jump
        mp.game.controls.disableControlAction(0, 24, true); // Attack
        mp.game.controls.disableControlAction(0, 257, true); // Attack 2
        mp.game.controls.disableControlAction(0, 25, true); // Aim
        mp.game.controls.disableControlAction(0, 140, true); // Melee
        mp.game.controls.disableControlAction(0, 141, true); // Melee
        mp.game.controls.disableControlAction(0, 142, true); // Melee
        mp.game.controls.disableControlAction(0, 143, true); // Melee
        mp.game.controls.disableControlAction(0, 23, true); // Enter Vehicle
        mp.game.controls.disableControlAction(0, 75, true); // Exit Vehicle
    }

    const player = mp.players.local;
    if (player.vehicle && player.vehicle.getIsEngineRunning()) {
        if (mp.game.invoke('0xE8AF77C4C06ADC93') !== 255) {
             mp.game.audio.setRadioToStationName("OFF");
        }
    }
});

mp.events.add('playerReady', () => {
    mp.game.vehicle.defaultEngineBehaviour = false;
    mp.players.local.setConfigFlag(429, true);
    mp.players.local.setConfigFlag(241, true);
});

mp.events.add('playerEnterVehicle', (vehicle, seat) => {
    mp.players.local.setConfigFlag(429, true);
    mp.players.local.setConfigFlag(241, true);
    mp.game.audio.setRadioToStationName("OFF");
    mp.game.audio.setUserRadioControlEnabled(false);

});

mp.events.add('playerLeaveVehicle', () => {
    mp.game.audio.setUserRadioControlEnabled(true);
});