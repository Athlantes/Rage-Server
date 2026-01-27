// --- 1. CONFIGURATION ---
const ZoneConfig = [
    {
        name: "GoPostal Yard",
        type: "no_collision",
        height: 100, // How tall the zone is
        z: -50,      // The bottom Z level
        points: [    // The Points you drew with your tool
            [164.2904, 110.4888],
            [163.4998, 109.8766],
            [7.0136, 167.618],
            [-10.1773, 119.2615],
            [146.7692, 63.0557]
        ]
    },
    // Add more zones here...
];

// --- 2. CREATE ZONES USING POLYGON API ---
mp.events.add('playerReady', () => {
    ZoneConfig.forEach((zone) => {
        // Convert 2D points [x,y] to Vector3 [x,y,z] required by the API
        const vertices = zone.points.map(p => new mp.Vector3(p[0], p[1], zone.z));
        
        // Create the polygon using the library
        // mp.polygons.add(vertices, height, options)
        const poly = mp.polygons.add(vertices, zone.height, {
            visible: false, // Set to true if you want to see lines for debugging
            dimension: 0
        });

        // Attach our custom data to the polygon object directly
        poly.zoneName = zone.name;
        poly.zoneType = zone.type;
    });
});

// --- 3. EVENT HANDLERS (From the API) ---

// When entering a polygon
mp.events.add('playerEnterPolygon', (polygon) => {
    if (polygon.zoneType) {
        // 1. Activate Logic
        applyZoneEffect(polygon.zoneType, true);

        // 2. Show Overlay (The blue/green banner)
        mp.events.call('updateZoneOverlay', true, polygon.zoneType);

        // 3. Notification
        mp.gui.chat.push(`Entered ${polygon.zoneName}`);
    }
});

// When leaving a polygon
mp.events.add('playerLeavePolygon', (polygon) => {
    if (polygon.zoneType) {
        // 1. Deactivate Logic
        applyZoneEffect(polygon.zoneType, false);

        // 2. Hide Overlay
        mp.events.call('updateZoneOverlay', false, polygon.zoneType);
        
        mp.gui.chat.push(`Left ${polygon.zoneName}`);
    }
});

// --- 4. EFFECT LOGIC (Ghost Mode / Safe Zone) ---
let noCollisionActive = false;
let safeZoneActive = false;

function applyZoneEffect(type, enable) {
    if (type === 'no_collision') {
        noCollisionActive = enable;
        // Visual: Make car transparent
        const veh = mp.players.local.vehicle;
        if (veh) veh.setAlpha(enable ? 150 : 255);
    } 
    else if (type === 'safe_zone') {
        safeZoneActive = enable;
        mp.players.local.setInvincible(enable);
    }
}

// --- 5. RENDER LOOP (Runs every frame) ---
mp.events.add('render', () => {
    // Logic: No Collision
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

    // Logic: Safe Zone (Disable Weapons)
    if (safeZoneActive) {
        mp.game.controls.disableControlAction(0, 24, true); // Attack
        mp.game.controls.disableControlAction(0, 37, true); // Weapon Wheel
        // ... add other controls if needed
    }
});