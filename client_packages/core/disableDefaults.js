// --------------------------------------------------------------------
// 1. CONSTANTS & STATE
// --------------------------------------------------------------------
const player = mp.players.local;
let isCayoActive = false;

const CAYO_IPLs = [
    "h4_islandairstrip", "h4_islandairstrip_props", "h4_islandx_mansion", "h4_islandx_mansion_props",
    "h4_islandx_props", "h4_islandxdock", "h4_islandxdock_props", "h4_islandxdock_water_hatch",
    "h4_beach", "h4_beach_props", "h4_beach_bar_props", "h4_islandx_barrack_props",
    "h4_islandx_checkpoint", "h4_islandx_checkpoint_props", "h4_islandx_Mansion_Office",
    "h4_islandx_Mansion_LockUp_01", "h4_islandx_Mansion_LockUp_02", "h4_islandx_Mansion_LockUp_03",
    "h4_islandairstrip_hangar_props", "h4_IslandX_Mansion_B", "h4_islandairstrip_doorsclosed",
    "h4_Underwater_Gate_Closed", "h4_mansion_gate_closed", "h4_aa_guns", "h4_islandx_terrain_01",
    "h4_islandx_terrain_02", "h4_islandx_terrain_03", "h4_islandx_terrain_04", "h4_islandx_terrain_05",
    "h4_islandx_terrain_06", "h4_ne_ipl_00", "h4_ne_ipl_01", "h4_ne_ipl_02", "h4_ne_ipl_03",
    "h4_ne_ipl_04", "h4_ne_ipl_05", "h4_ne_ipl_06", "h4_ne_ipl_07", "h4_ne_ipl_08", "h4_ne_ipl_09",
    "h4_nw_ipl_00", "h4_nw_ipl_01", "h4_nw_ipl_02", "h4_nw_ipl_03", "h4_nw_ipl_04", "h4_nw_ipl_05",
    "h4_nw_ipl_06", "h4_nw_ipl_07", "h4_nw_ipl_08", "h4_nw_ipl_09", "h4_se_ipl_00", "h4_se_ipl_01",
    "h4_se_ipl_02", "h4_se_ipl_03", "h4_se_ipl_04", "h4_se_ipl_05", "h4_se_ipl_06", "h4_se_ipl_07",
    "h4_se_ipl_08", "h4_se_ipl_09", "h4_sw_ipl_00", "h4_sw_ipl_01", "h4_sw_ipl_02", "h4_sw_ipl_03",
    "h4_sw_ipl_04", "h4_sw_ipl_05", "h4_sw_ipl_06", "h4_sw_ipl_07", "h4_sw_ipl_08", "h4_sw_ipl_09",
    "h4_islandx_mansion", "h4_islandxtower", "h4_islandx_sea_mines", "h4_islandx",
    "h4_islandx_barrack_hatch", "h4_islandxdock_water_hatch", "h4_mph4_terrain_01_grass_0",
    "h4_mph4_terrain_01_grass_1", "h4_mph4_terrain_02_grass_0", "h4_mph4_terrain_02_grass_1",
    "h4_mph4_terrain_02_grass_2", "h4_mph4_terrain_02_grass_3", "h4_mph4_terrain_04_grass_0",
    "h4_mph4_terrain_04_grass_1", "h4_mph4_terrain_04_grass_2", "h4_mph4_terrain_04_grass_3",
    "h4_mph4_terrain_05_grass_0", "h4_mph4_terrain_06_grass_0" 
];

// --------------------------------------------------------------------
// 2. THE MANAGER (Runs every 2 seconds to save performance)
// --------------------------------------------------------------------
setInterval(() => {
    const pos = player.position;
    
    // Check if player is in the "Cayo Perico" southern half of the world
    const shouldBeCayo = pos.y < -3500; 

    if (shouldBeCayo && !isCayoActive) {
        // TURN ON CAYO
        mp.game.invoke("0x9A9D1BA639675CF1", "HeistIsland", true); // Enable Island Map/Water
        mp.game.ui.setRadarAsExteriorThisFrame(); 
        mp.game.ui.refreshWaypoint();
        isCayoActive = true;
    } 
    else if (!shouldBeCayo && isCayoActive) {
        // TURN ON LOS SANTOS
        mp.game.invoke("0x9A9D1BA639675CF1", "HeistIsland", false); // Disable Island Map/Water
        mp.game.ui.refreshWaypoint();
        isCayoActive = false;
    }
}, 2000);

// --------------------------------------------------------------------
// 3. CORE EVENTS
// --------------------------------------------------------------------
mp.events.add('playerReady', () => {
    // Load the Physical objects immediately so they are ready when we arrive
    CAYO_IPLs.forEach(ipl => mp.game.streaming.requestIpl(ipl));

    // General Configs
    mp.game.vehicle.defaultEngineBehaviour = false;
    player.setConfigFlag(429, true); // Disable seatbelt chime/auto-helmet
    player.setConfigFlag(241, true); // Disable auto-helmet
});

mp.events.add('render', () => {
    // 1. Pause Menu & HUD Management
    mp.game.controls.disableControlAction(0, 199, true); 
    mp.game.controls.disableControlAction(0, 200, true); 

    if (mp.game.controls.isDisabledControlJustPressed(0, 200)) {
        if (!mp.game.ui.isPauseMenuActive()) {
            mp.events.call('client:togglePauseMenu');
        }
    }

    const hudComponents = [3, 4, 19, 20, 6, 7, 9];
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