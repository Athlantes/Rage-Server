// packages/your-resource/zone_manager.js

// --- 1. CONFIGURATION ---
// Add all your future zones here!
const ZoneConfig = [
    {
        name: "GoPostal Yard",
        type: "no_collision", // Type of zone
        minZ: -50,
        maxZ: 150,
        points: [
            [164.2904, 110.4888],
            [163.4998, 109.8766],
            [7.0136, 167.618],
            [-10.1773, 119.2615],
            [146.7692, 63.0557]
        ]
    },
    {
        name: "City Hall Safezone", 
        type: "safe_zone",
        minZ: -50,
        maxZ: 100,
        points: [
            // Paste coordinates for City Hall here in the future
        ]
    }
];

// --- 2. FACTORY (Do not touch) ---
// This loop creates the zones automatically based on the config above
ZoneConfig.forEach((zoneData) => {
    // 1. Create the Polygon
    const colshape = mp.colshapes.newPolygon(zoneData.points, zoneData.minZ, zoneData.maxZ);
    
    // 2. Attach data to the shape so we know what it is later
    colshape.setVariable('ZONE_TYPE', zoneData.type);
    colshape.setVariable('ZONE_NAME', zoneData.name);
});

// --- 3. EVENT HANDLERS ---
mp.events.add("playerEnterColshape", (player, shape) => {
    // Check if this shape is one of our special zones
    const zoneType = shape.getVariable('ZONE_TYPE');
    const zoneName = shape.getVariable('ZONE_NAME');

    if (zoneType) {
        // Tell client to activate the specific logic for this zone type
        player.call("Client:ZoneManager", [true, zoneType]);
        
        // Optional: Notify player
        if (zoneType === 'safe_zone') player.notify(`~g~Entered Safe Zone:~w~ ${zoneName}`);
        if (zoneType === 'no_collision') player.notify(`~b~Entered No-Clip Zone:~w~ ${zoneName}`);
    }
});

mp.events.add("playerExitColshape", (player, shape) => {
    const zoneType = shape.getVariable('ZONE_TYPE');
    
    if (zoneType) {
        // Tell client to deactivate
        player.call("Client:ZoneManager", [false, zoneType]);
    }
});