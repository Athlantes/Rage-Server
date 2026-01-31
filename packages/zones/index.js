// packages/zones/index.js
require('./zone-saver.js'); // Keeping your existing saver
const ZoneConfig = require('./config.js');

const Zones = new Map();

// --- MATH HELPERS ---
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

function createZone(zoneData) {
    let colshape;
    const typeDef = ZoneConfig.Types[zoneData.type] || {};

    if (zoneData.shape === 'polygon') {
        // Calculate Bounding Box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        zoneData.vertices.forEach(v => {
            if (v.x < minX) minX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.x > maxX) maxX = v.x;
            if (v.y > maxY) maxY = v.y;
        });

        const width = maxX - minX;
        const depth = maxY - minY;
        const height = zoneData.maxZ - zoneData.minZ;
        const centerX = minX + width / 2;
        const centerY = minY + depth / 2;
        const centerZ = zoneData.minZ + height / 2;

        colshape = mp.colshapes.newCuboid(centerX, centerY, centerZ, width, depth, height);
    } else {
        colshape = mp.colshapes.newSphere(zoneData.position.x, zoneData.position.y, zoneData.position.z, zoneData.range || 10);
    }

    colshape.zoneId = zoneData.id;
    colshape.zoneData = zoneData;
    colshape.typeDef = typeDef;
    
    Zones.set(zoneData.id, colshape);

    if (zoneData.blip) {
        // Calculate a center point for the blip
        let centerX = 0, centerY = 0;
        
        if (zoneData.shape === 'polygon') {
            // Average the vertices to find center
            zoneData.vertices.forEach(v => { centerX += v.x; centerY += v.y; });
            centerX /= zoneData.vertices.length;
            centerY /= zoneData.vertices.length;
        } else {
            centerX = zoneData.position.x;
            centerY = zoneData.position.y;
        }

        mp.blips.new(zoneData.blip.sprite, new mp.Vector3(centerX, centerY, 0), {
            name: zoneData.blip.name,
            color: zoneData.blip.color,
            shortRange: zoneData.blip.shortRange,
            scale: 0.8
        });
    }
}


// Initialize Zones
ZoneConfig.Zones.forEach(createZone);

// --- PLAYER MANAGEMENT ---
function enterBroadPhase(player, colshape) {
    if (!player.broadZones) player.broadZones = new Set();
    player.broadZones.add(colshape.zoneId);

    // Notify client they are in the "Area" (Broad Phase)
    // We send config so client knows if it should run precise math or effects
    player.call('client:zone:enterBroad', [colshape.zoneId, colshape.zoneData, colshape.typeDef]);
}

function exitBroadPhase(player, colshape) {
    if (player.broadZones) player.broadZones.delete(colshape.zoneId);
    player.call('client:zone:exitBroad', [colshape.zoneId]);
}

// --- EVENTS ---
mp.events.add('playerEnterColshape', (player, shape) => {
    if (shape.zoneId) enterBroadPhase(player, shape);
});

mp.events.add('playerExitColshape', (player, shape) => {
    if (shape.zoneId) exitBroadPhase(player, shape);
});

// Sync on login/reload
mp.players.forEach(player => {
    if(!player.broadZones) player.broadZones = new Set();
    Zones.forEach(shape => {
        if(shape.isPointWithin(player.position)) {
            enterBroadPhase(player, shape);
        }
    });
});

// --- EXPORTED API ---
module.exports = {
    // Check if player is strictly inside the polygon
    isPlayerInZone: (player, zoneId) => {
        // 1. Broad Phase Check (Bounding Box)
        if (!player.broadZones || !player.broadZones.has(zoneId)) return false;

        // 2. Precise Phase Check (Polygon)
        const shape = Zones.get(zoneId);
        if (!shape) return false;

        if (shape.zoneData.shape === 'polygon') {
            return isPointInPolygon(player.position, shape.zoneData.vertices);
        }
        return true; // Spheres are handled by the colshape check sufficiently
    },
    
    getBroadPhaseZones: (player) => {
        return player.broadZones ? Array.from(player.broadZones) : [];
    }
};