let currentZone = null; 
let activePolygon = null; // Stores vertices if we are inside a polygon bounding box
let renderInterval = null; // Timer for checking polygon math

const ATTACH_BONE = 60309;
const ATTACH_OFFSET = [-0.05, 0.35, 0.20, -180.0, 180.0, 0.0];

// --- MATH HELPER: Ray Casting Algorithm ---
// Returns true if 'point' {x,y} is inside 'vs' (array of {x,y})
function isPointInPolygon(point, vs) {
    let x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y;
        let xj = vs[j].x, yj = vs[j].y;
        
        let intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// --- EFFECT APPLICATOR ---
function setZoneEffects(enable, zoneType) {
    const localPlayer = mp.players.local;
    
    if (enable) {
        currentZone = zoneType;
        
        if (zoneType === 'safe_zone') {
            localPlayer.setInvincible(true);
            if (localPlayer.vehicle) localPlayer.vehicle.setAlpha(255);
        } else if (zoneType === 'no_collision') {
            if (localPlayer.vehicle) localPlayer.vehicle.setAlpha(255);
        }
        mp.events.call('updateZoneOverlay', true, zoneType);
    } else {
        currentZone = null;
        localPlayer.setInvincible(false);
        if (localPlayer.vehicle) localPlayer.vehicle.setAlpha(255);
        mp.events.call('updateZoneOverlay', false, zoneType);
    }
}

// --- EVENTS ---

// 1. Standard Entry (Cuboid/Sphere)
mp.events.add("client:applyZoneEffect", (zoneType) => {
    setZoneEffects(true, zoneType);
});

mp.events.add("client:removeZoneEffect", (zoneType) => {
    setZoneEffects(false, zoneType);
});

// 2. Polygon Entry (Entered the "Broad Phase" box)
mp.events.add("client:enterZoneBounds", (zoneType, vertices) => {
    activePolygon = { type: zoneType, vertices: vertices };
    
    // Start a fast check loop (every 200ms is usually enough for "Enter/Exit" logic)
    // If you need pixel perfect instant collision updates, use mp.events.add('render', ...)
    if (renderInterval) clearInterval(renderInterval);
    
    let wasInside = false;

    renderInterval = setInterval(() => {
        const pos = mp.players.local.position;
        const isInside = isPointInPolygon({x: pos.x, y: pos.y}, activePolygon.vertices);

        if (isInside && !wasInside) {
            // Player actually walked inside the polygon shape
            setZoneEffects(true, activePolygon.type);
            wasInside = true;
        } 
        else if (!isInside && wasInside) {
            // Player stepped out of the polygon (but is still in the bounding box)
            setZoneEffects(false, activePolygon.type);
            wasInside = false;
        }
    }, 200);
});

mp.events.add("client:exitZoneBounds", () => {
    // Player left the broad area entirely
    if (renderInterval) {
        clearInterval(renderInterval);
        renderInterval = null;
    }
    if (activePolygon) {
        setZoneEffects(false, activePolygon.type); // Ensure effects are off
        activePolygon = null;
    }
});


// --- RENDER LOOP (Collision Logic) ---
// This runs every frame ONLY if effects are active
mp.events.add("render", () => {
    if (!currentZone) return;

    const localPlayer = mp.players.local;
    const localVehicle = localPlayer.vehicle;

    if (localVehicle) {
        mp.vehicles.forEachInStreamRange((veh) => {
            if (veh.handle !== localVehicle.handle) {
                mp.game.entity.setNoCollisionEntity(localVehicle.handle, veh.handle, false);
                mp.game.entity.setNoCollisionEntity(veh.handle, localVehicle.handle, false);
            }
        });

        mp.players.forEachInStreamRange((p) => {
            if (p.handle !== localPlayer.handle) {
                mp.game.entity.setNoCollisionEntity(localVehicle.handle, p.handle, false);
            }
        });
    }
});

function attachBox(player, objRemoteId) {
    let attempts = 0;
    const interval = setInterval(() => {
        const obj = mp.objects.atRemoteId(objRemoteId);
        if (obj && obj.handle !== 0) {
            obj.attachTo(player.handle, ATTACH_BONE, ...ATTACH_OFFSET, false, false, false, false, 2, true);
            clearInterval(interval);
        }
        attempts++;
        if (attempts > 50) clearInterval(interval); // Stop after 5 seconds if not found
    }, 100);
}

// Handle players already nearby or just driving into range
mp.events.add('entityStreamIn', (entity) => {
    if (entity.type === 'player') {
        const objId = entity.getVariable('attachedObject');
        if (objId !== undefined && objId !== null) {
            attachBox(entity, objId);
        }
    }
});

// Handle when the box is first picked up
mp.events.addDataHandler('attachedObject', (entity, value) => {
    if (entity.type === 'player') {
        if (value !== null && value !== undefined) {
            attachBox(entity, value);
        }
    }
});