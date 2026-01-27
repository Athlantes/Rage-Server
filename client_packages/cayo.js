// --- CONFIGURATION ---
const CayoCenter = new mp.Vector3(4840.57, -5174.42, 2.0); 
const SwitchDistance = 2200.0;
let isCayoMode = false;
let checkInterval = null;

const cayoIPLs = [
    "h4_islandairstrip", "h4_islandairstrip_props", "h4_islandx_mansion",
    "h4_islandx_mansion_props", "h4_islandx_terrain_01", "h4_islandx_terrain_02",
    "h4_islandx_terrain_03", "h4_islandx_terrain_04", "h4_islandx_terrain_05",
    "h4_islandx_terrain_06", "h4_mph4_terrain_01", "h4_mph4_terrain_02",
    "h4_mph4_terrain_03", "h4_mph4_terrain_04", "h4_mph4_terrain_05",
    "h4_mph4_terrain_06", "h4_islandx_sea_mines", "h4_islandx", 
    "h4_islandx_props", "h4_mph4_terrain_01_long_0", "h4_mph4_terrain_02_grass_0",
    "h4_mph4_terrain_02_grass_1", "h4_mph4_terrain_02_grass_2", "h4_mph4_terrain_02_grass_3",
    "h4_islandx_terrain_01_slod", "h4_islandx_terrain_02_slod"
];

// --- INITIALIZATION ---
mp.events.add('playerReady', () => {
    // 1. Reset Map to Los Santos on join
    mp.game.invoke("0x9A9D1BA639675CF1", "HeistIsland", false); // World Switch
    mp.game.invoke("0xF74B1FFA4A15FBEA", "HeistIsland", false); // Pause Map Switch
    
    // 2. Start checking
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(checkMapZone, 1000);
});

// --- RENDER LOOP (CRITICAL FOR MINIMAP) ---
mp.events.add('render', () => {
    if (isCayoMode) {
        // This native forces the Minimap to draw the Cayo texture "h4_fake_islandx"
        // It must be called EVERY FRAME to work.
        mp.game.invoke("0x5E1460624D194A38", "h4_fake_islandx", 4840.57, -5174.42, 0, 0, 0, 0, 0);
    }
});

function checkMapZone() {
    const playerPos = mp.players.local.position;
    const distanceToCayo = mp.game.system.vdist(playerPos.x, playerPos.y, playerPos.z, CayoCenter.x, CayoCenter.y, CayoCenter.z);

    if (distanceToCayo < SwitchDistance && !isCayoMode) {
        enableCayoMode();
    } 
    else if (distanceToCayo >= SwitchDistance && isCayoMode) {
        enableLosSantosMode();
    }
}

function enableCayoMode() {
    isCayoMode = true;
    mp.gui.chat.push("🌊 Entering Cayo Perico...");

    // 1. Switch Physical World
    mp.game.invoke("0x9A9D1BA639675CF1", "HeistIsland", true); 

    // 2. Switch Pause Menu Map (Requires String + Bool)
    mp.game.invoke("0xF74B1FFA4A15FBEA", "HeistIsland", true);

    // 3. Load IPLs
    cayoIPLs.forEach(ipl => mp.game.streaming.requestIpl(ipl));

    // 4. Fix Water
    mp.game.water.setDeepOceanScaler(0.0);
}

function enableLosSantosMode() {
    isCayoMode = false;
    mp.gui.chat.push("🏙️ Returning to Los Santos...");

    // 1. Switch Physical World Back
    mp.game.invoke("0x9A9D1BA639675CF1", "HeistIsland", false); 

    // 2. Switch Pause Menu Map Back
    mp.game.invoke("0xF74B1FFA4A15FBEA", "HeistIsland", false);

    // 3. Unload IPLs
    cayoIPLs.forEach(ipl => mp.game.streaming.removeIpl(ipl));

    // 4. Restore Water
    mp.game.water.resetDeepOceanScaler();
}