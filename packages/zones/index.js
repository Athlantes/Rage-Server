require('./zone-saver.js');

// --- CONFIGURATION ---
const ZoneTypes = {
    SAFE_ZONE: 'safe_zone',
    NO_COLLISION: 'no_collision'
};

// Add your zones here. 
const ZoneConfig = [
    {
        id: 'gopostal_zone',
        type: ZoneTypes.NO_COLLISION,
        shape: 'polygon',
        minZ: 29.0,   
        maxZ: 130.0,
        vertices: [
            { x: 163.4998, y: 109.8766 },
            { x: 7.0136,   y: 167.6180 },
            { x: -10.1773, y: 119.2615 },
            { x: 146.7692, y: 63.0557  }
        ]
    }
];

// --- LOGIC ---
const Zones = {};

// Helper: Calculate Bounding Box for a Polygon
function getBoundingBox(vertices, minZ, maxZ) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    vertices.forEach(v => {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.x > maxX) maxX = v.x;
        if (v.y > maxY) maxY = v.y;
    });

    const width = maxX - minX;
    const depth = maxY - minY;
    const height = maxZ - minZ;

    // RAGE Cuboids are defined by the center, but dimensions are full width/depth
    // We position the cuboid at the center of the polygon bounds
    const centerX = minX + (width / 2);
    const centerY = minY + (depth / 2);
    const centerZ = minZ + (height / 2); // Approximation

    return { x: centerX, y: centerY, z: centerZ, width, depth, height };
}

// 1. Initialize Zones
ZoneConfig.forEach((zone) => {
    let colshape;

    if (zone.shape === 'cuboid') {
        colshape = mp.colshapes.newCuboid(
            zone.position.x, zone.position.y, zone.position.z,
            zone.size.width, zone.size.depth, zone.size.height
        );
    } 
    else if (zone.shape === 'sphere') {
        colshape = mp.colshapes.newSphere(
            zone.position.x, zone.position.y, zone.position.z,
            zone.range
        );
    }
    // --- NEW POLYGON LOGIC ---
    else if (zone.shape === 'polygon') {
        // Create a "Rough" Cuboid around the polygon to trigger client-side check
        const bounds = getBoundingBox(zone.vertices, zone.minZ, zone.maxZ);
        
        colshape = mp.colshapes.newCuboid(
            bounds.x, bounds.y, bounds.z,
            bounds.width, bounds.depth, bounds.height
        );
    }

    // Attach data
    colshape.zoneData = zone;
    Zones[zone.id] = colshape;
});

// 2. Event Handlers
mp.events.add("playerEnterColshape", (player, shape) => {
    if (shape.zoneData) {
        if (shape.zoneData.shape === 'polygon') {
            // Tell client to start calculating precise math
            player.call("client:enterZoneBounds", [shape.zoneData.type, shape.zoneData.vertices]);
        } else {
            // Standard Shape: Apply immediately
            player.call("client:applyZoneEffect", [shape.zoneData.type]);
        }
    }
});

mp.events.add("playerExitColshape", (player, shape) => {
    if (shape.zoneData) {
        if (shape.zoneData.shape === 'polygon') {
            // Tell client to stop calculating
            player.call("client:exitZoneBounds");
        } else {
            // Standard Shape: Remove immediately
            player.call("client:removeZoneEffect", [shape.zoneData.type]);
        }
    }
});