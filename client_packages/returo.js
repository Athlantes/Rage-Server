// client_packages/returo.js
let returoBrowser = null;
global.isReturoOpen = false;

// --- VISUALS CONFIG ---
const RETURO_LOCATIONS = [
    { x: -317.98, y: -1511.58, z: 27.74 },
    { x: -319.19, y: -1511.62, z: 27.74 },
    { x: -320.23, y: -1511.67, z: 27.74 },
    { x: -321.41, y: -1511.68, z: 27.73 }
];

// 1. Create Map Blip (Single icon for the area)
mp.blips.new(467, new mp.Vector3(-319.49, -1512.91, 27.74), {
    name: 'Recycle',
    color: 2,          // Green
    shortRange: true,  // Only visible on minimap when close
    scale: 1.0,
    dimension: 0
});

// 2. Render Markers (Client-Side = No X-Ray Effect)
mp.events.add('render', () => {
    // Optimization: Don't render if menu is open
    if (global.isReturoOpen) return;

    const localPos = mp.players.local.position;

    RETURO_LOCATIONS.forEach(loc => {
        // Optimization: Only draw if player is within 20 meters
        if (mp.game.system.vdist(localPos.x, localPos.y, localPos.z, loc.x, loc.y, loc.z) < 20) {
            mp.game.graphics.drawMarker(
                1, // Type 1 (Cylinder)
                loc.x, loc.y, loc.z - 1.0, 
                0, 0, 0, 
                0, 0, 0, 
                0.8, 0.8, 0.5, // Scale (Smaller than gas pumps)
                0, 255, 0, 100, // Green Color
                false, false, 2, 
                false, // rotate
                null, null, false
            );
        }
    });
});

// --- UI LOGIC ---

mp.events.add('client:openReturoBrowser', (maxBottles, pricePerUnit) => {
    if (returoBrowser) return;

    // 1. Lock State
    global.isReturoOpen = true;

    // 2. Disable Controls & UI
    mp.gui.chat.activate(false); 
    mp.gui.chat.show(false);     
    mp.gui.cursor.show(true, true);
    
    // Create Browser
    returoBrowser = mp.browsers.new('package://ui/returo.html');
    
    // Pass data
    mp.events.add('browserDomReady', (browser) => {
        if (browser === returoBrowser) {
            returoBrowser.execute(`updateInfo(${maxBottles}, ${pricePerUnit})`);
        }
    });
});

mp.events.add('client:closeReturoBrowser', () => {
    if (returoBrowser) {
        returoBrowser.destroy();
        returoBrowser = null;
    }
    
    // 3. Unlock State
    global.isReturoOpen = false;
    
    // 4. Re-enable Controls
    mp.gui.chat.activate(true);
    mp.gui.chat.show(true);
    mp.gui.cursor.show(false, false);
});

mp.events.add('client:submitReturo', (amount) => {
    mp.events.callRemote('server:processRecycling', amount);
});