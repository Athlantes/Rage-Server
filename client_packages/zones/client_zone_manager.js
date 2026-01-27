// --- 1. CONFIGURATION ---
const ZoneConfig = [
    {
        name: "GoPostal Yard",
        type: "no_collision",
        height: 100, 
        z: -50,      
        points: [
            [164.2904, 110.4888],
            [163.4998, 109.8766],
            [7.0136, 167.618],
            [-10.1773, 119.2615],
            [146.7692, 63.0557]
        ]
    }
];

// --- 2. INITIALIZATION FUNCTION ---
function loadZones() {
    // Prevent double loading
    if (global.zonesLoaded) return; 
    global.zonesLoaded = true;

    mp.console.logInfo(`[Zones] Starting to load ${ZoneConfig.length} zones...`);

    ZoneConfig.forEach((zone) => {
        // Convert points to Vector3
        const vertices = zone.points.map(p => new mp.Vector3(p[0], p[1], zone.z));
        
        // Create Polygon
        const poly = mp.polygons.add(vertices, zone.height, {
            visible: true, // DEBUG: Set to TRUE to see the lines!
            dimension: 0,
            lineColorRGBA: [0, 0, 255, 255]
        });

        // Attach Data
        poly.zoneName = zone.name;
        poly.zoneType = zone.type;

        mp.console.logInfo(`[Zones] Created zone: ${zone.name} (Type: ${zone.type})`);
    });
}

// --- 3. INIT TRIGGERS ---
// Trigger 1: If player joins
mp.events.add('playerReady', loadZones);

// Trigger 2: If script reloaded (Hot-Reload Fix)
if (mp.players.local) {
    loadZones();
}

// --- 4. EVENT HANDLERS ---
mp.events.add('playerEnterPolygon', (polygon) => {
    if (polygon.zoneType) {
        mp.console.logInfo(`[Zones] Entered: ${polygon.zoneName}`); // Debug to F11
        applyZoneEffect(polygon.zoneType, true);
        mp.events.call('updateZoneOverlay', true, polygon.zoneType);
        mp.gui.chat.push(`Entered Zone: ${polygon.zoneName}`);
    }
});

mp.events.add('playerLeavePolygon', (polygon) => {
    if (polygon.zoneType) {
        mp.console.logInfo(`[Zones] Left: ${polygon.zoneName}`); // Debug to F11
        applyZoneEffect(polygon.zoneType, false);
        mp.events.call('updateZoneOverlay', false, polygon.zoneType);
        mp.gui.chat.push(`Left Zone: ${polygon.zoneName}`);
    }
});

// --- 5. EFFECT LOGIC ---
let noCollisionActive = false;
let safeZoneActive = false;

function applyZoneEffect(type, enable) {
    if (type === 'no_collision') {
        noCollisionActive = enable;
        const veh = mp.players.local.vehicle;
        if (veh) veh.setAlpha(enable ? 150 : 255);
    } 
    else if (type === 'safe_zone') {
        safeZoneActive = enable;
        mp.players.local.setInvincible(enable);
    }
}

// --- 6. RENDER LOOP ---
mp.events.add('render', () => {
    if (noCollisionActive) {
        const localVeh = mp.players.local.vehicle;
        if (localVeh) {
            mp.vehicles.forEachInStreamRange((otherVeh) => {
                if (localVeh !== otherVeh) {
                    mp.game.entity.setNoCollisionEntity(localVeh.handle, otherVeh.handle, false);
                    mp.game.entity.setNoCollisionEntity(otherVeh.handle, localVeh.handle, false);
                }
            });
        }
    }

    if (safeZoneActive) {
        mp.game.controls.disableControlAction(0, 24, true); 
        mp.game.controls.disableControlAction(0, 37, true); 
    }
});