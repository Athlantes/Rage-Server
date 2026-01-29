mp.events.add('render', () => {
    // --------------------------------------------------------------------
    // 1. HIDE HUD COMPONENTS (Visuals)
    // --------------------------------------------------------------------
    // ID 3 = Cash, ID 4 = MP Cash
    mp.game.ui.hideHudComponentThisFrame(3); 
    mp.game.ui.hideHudComponentThisFrame(4); 
    
    // ID 19 = Weapon Wheel, ID 20 = Weapon Wheel Stats
    mp.game.ui.hideHudComponentThisFrame(19);
    mp.game.ui.hideHudComponentThisFrame(20);

    // ID 6 = Vehicle Name, ID 7 = Area Name, ID 9 = Street Name
    mp.game.ui.hideHudComponentThisFrame(6);
    mp.game.ui.hideHudComponentThisFrame(7);
    mp.game.ui.hideHudComponentThisFrame(9);


    // --------------------------------------------------------------------
    // 2. DISABLE DEFAULTS (Input)
    // --------------------------------------------------------------------
    
    // Disable Weapon Wheel (TAB)
    mp.game.controls.disableControlAction(0, 37, true); 

    // Disable Radio Wheel (Q)
    mp.game.controls.disableControlAction(0, 85, true); 
    mp.game.controls.disableControlAction(0, 81, true); // Next Station
    mp.game.controls.disableControlAction(0, 82, true); // Prev Station

    mp.game.vehicle.defaultEngineBehaviour = false;

    mp.events.add('playerEnterVehicle', (vehicle, seat) => {
    mp.players.local.setConfigFlag(429, true);
    });

    mp.game.player.setDispatchsCops(false);
    mp.game.player.setWantedLevel(0);
    // --------------------------------------------------------------------
    // 3. JOB RESTRICTIONS (When Carrying Box)
    // --------------------------------------------------------------------
    // We check the variable set by the server in courier.js
    if (mp.players.local.getVariable('isJobCarrying')) {
        
        // Disable JUMP (Space)
        mp.game.controls.disableControlAction(0, 22, true); 
        
        // Disable ATTACK (LMB)
        mp.game.controls.disableControlAction(0, 24, true); 
        mp.game.controls.disableControlAction(0, 257, true); 
        
        // Disable AIM (RMB)
        mp.game.controls.disableControlAction(0, 25, true); 
        
        // Disable MELEE (R)
        mp.game.controls.disableControlAction(0, 140, true); 
        mp.game.controls.disableControlAction(0, 141, true); 
        mp.game.controls.disableControlAction(0, 142, true); 
        mp.game.controls.disableControlAction(0, 143, true); 

        // Disable ENTER VEHICLE (F)
        mp.game.controls.disableControlAction(0, 23, true); 
        mp.game.controls.disableControlAction(0, 75, true); 
    }
});

mp.events.add('playerReady', () => {
    // Flag 429: CPED_CONFIG_FLAG_DontStartEngineAutomatically
    mp.players.local.setConfigFlag(429, true);
});