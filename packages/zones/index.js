require('./zone-saver.js');

// --- CONFIGURATION ---
const ZoneTypes = {
    SAFE_ZONE: 'safe_zone',
    NO_COLLISION: 'no_collision',
    JOB_ZONE: 'job_zone'
};

const ZoneConfig = [
    {
        id: 'gopostal_zone',
        type: ZoneTypes.NO_COLLISION,
        shape: 'polygon',
        minZ: 29.0, maxZ: 130.0,
        vertices: [ { x: 163.4, y: 109.8 }, { x: 7.0, y: 167.6 }, { x: -10.1, y: 119.2 }, { x: 146.7, y: 63.0 } ]
    },
    {
        id: 'garbage_zone',
        type: ZoneTypes.NO_COLLISION,
        shape: 'polygon',
        minZ: 20.0,   
        maxZ: 150.0,
        vertices: [
            { x: -293.1287, y: -1512.1006 },
            { x: -315.3958, y: -1502.7332 },
            { x: -375.5942, y: -1499.8154 },
            { x: -378.6655, y: -1556.174 },
            { x: -367.7623, y: -1584.1227 },
            { x: -368.223, y: -1626.9672 },
            { x: -362.6947, y: -1640.0201 },
            { x: -323.3815, y: -1573.6802 },
            { x: -303.8786, y: -1541.1245 }
        ]
    },
    {
        id: 'los_santos_city',
        type: ZoneTypes.JOB_ZONE, 
        shape: 'polygon',
        minZ: -50.0, maxZ: 800.0,
        vertices: [
            { x: -2991.2, y: 96.7 }, { x: -2562.2, y: 594.9 }, { x: -2091.7, y: 664.1 }, { x: -1556.6, y: 701.0 },
            { x: -1268.1, y: 727.6 }, { x: -1066.5, y: 922.9 }, { x: -780.7, y: 941.6 }, { x: -607.5, y: 943.9 },
            { x: -289.8, y: 1091.7 }, { x: 256.2, y: 1040.9 }, { x: 603.7, y: 916.3 }, { x: 1394.1, y: 476.7 },
            { x: 1604.1, y: 2.5 }, { x: 2080.5, y: -478.3 }, { x: 2353.7, y: -844.1 }, { x: 2127.9, y: -1589.2 },
            { x: 1748.6, y: -2602.9 }, { x: 1380.5, y: -3381.9 }, { x: -468.3, y: -3489.1 }, { x: -1414.4, y: -3744.2 },
            { x: -2294.9, y: -3261.0 }, { x: -1546.0, y: -1881.5 }
        ]
    }
];

// --- LOGIC ---
const Zones = {};

// 1. Math Helper (Ray Casting)
function isPointInPolygon(p, vertices) {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        let xi = vertices[i].x, yi = vertices[i].y;
        let xj = vertices[j].x, yj = vertices[j].y;
        let intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function getBoundingBox(vertices, minZ, maxZ) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    vertices.forEach(v => {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.x > maxX) maxX = v.x;
        if (v.y > maxY) maxY = v.y;
    });
    return { x: minX + (maxX - minX)/2, y: minY + (maxY - minY)/2, z: minZ + (maxZ - minZ)/2, width: maxX - minX, depth: maxY - minY, height: maxZ - minZ };
}

ZoneConfig.forEach((zone) => {
    let colshape;
    if (zone.shape === 'polygon') {
        const bounds = getBoundingBox(zone.vertices, zone.minZ, zone.maxZ);
        colshape = mp.colshapes.newCuboid(bounds.x, bounds.y, bounds.z, bounds.width, bounds.depth, bounds.height);
    } else {
        colshape = mp.colshapes.newSphere(zone.position.x, zone.position.y, zone.position.z, zone.range || 10);
    }
    colshape.zoneData = zone;
    Zones[zone.id] = colshape;
});

// 2. Handling Logic
function handleEnterZone(player, shape) {
    if (!shape.zoneData) return;

    if (!player.activeZones) player.activeZones = new Set();
    player.activeZones.add(shape.zoneData.id);

    // Only trigger client effects for non-jobs (Prevents visual conflicts for job zones)
    if (shape.zoneData.type !== ZoneTypes.JOB_ZONE) {
        if (shape.zoneData.shape === 'polygon') {
            player.call("client:enterZoneBounds", [shape.zoneData.type, shape.zoneData.vertices]);
        } else {
            player.call("client:applyZoneEffect", [shape.zoneData.type]);
        }
    }
}

function handleExitZone(player, shape) {
    if (!shape.zoneData) return;
    
    // We only remove THIS specific zone ID. The others remain in the Set.
    if (player.activeZones) player.activeZones.delete(shape.zoneData.id);

    if (shape.zoneData.type !== ZoneTypes.JOB_ZONE) {
        if (shape.zoneData.shape === 'polygon') {
            player.call("client:exitZoneBounds");
        } else {
            player.call("client:removeZoneEffect", [shape.zoneData.type]);
        }
    }
}

// --- EVENTS ---
mp.events.add("playerEnterColshape", (player, shape) => {
    handleEnterZone(player, shape);
});

mp.events.add("playerExitColshape", (player, shape) => {
    handleExitZone(player, shape);
});

// --- INITIALIZATION LOOP ---
// This loops through all players when the server starts/reloads
// and manually adds them to zones they are already standing in.
mp.players.forEach((player) => {
    if(!player.activeZones) player.activeZones = new Set();
    
    Object.values(Zones).forEach((shape) => {
        if(shape.isPointWithin(player.position)) {
            handleEnterZone(player, shape);
        }
    });
});

// --- EXPORT PRECISE CHECKER ---
module.exports = {
    isPlayerInZone: (player, zoneId) => {
        // 1. Fast Check: Are they in the Rectangle?
        if (!player.activeZones || !player.activeZones.has(zoneId)) return false;

        // 2. Precise Check: Are they in the Polygon?
        const shape = Zones[zoneId];
        if (!shape || !shape.zoneData) return false;

        if (shape.zoneData.shape === 'polygon') {
            return isPointInPolygon(player.position, shape.zoneData.vertices);
        }
        
        return true;
    }
};