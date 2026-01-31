// client_packages/systems/zones.js

// ===========================================================================
//                              ZONING SYSTEM
// ===========================================================================

let activeBroadZones = new Map();   
let activePreciseZones = new Set(); 
let renderInterval = null;          
let debugMode = false;              // Toggle for showing lines

const localPlayer = mp.players.local;

// --- MATH HELPER ---
function isPointInPolygon(point, vs) {
    let x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y;
        let xj = vs[j].x, yj = vs[j].y;
        let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// --- EFFECT APPLICATOR ---
function applyZoneEffects(zoneId, typeDef, enable) {
    if (enable) {
        if (typeDef.visualEffects) mp.events.call('updateZoneOverlay', true, typeDef.id);
        if (typeDef.invincible) localPlayer.setInvincible(true);
        if (typeDef.ghost && localPlayer.vehicle) localPlayer.vehicle.setAlpha(150); 
    } else {
        if (typeDef.visualEffects) mp.events.call('updateZoneOverlay', false, typeDef.id);
        if (typeDef.invincible) localPlayer.setInvincible(false);
        if (typeDef.ghost && localPlayer.vehicle) localPlayer.vehicle.setAlpha(255);
    }
}

// --- SERVER EVENTS ---
mp.events.add('client:zone:enterBroad', (zoneId, zoneData, typeDef) => {
    activeBroadZones.set(zoneId, { data: zoneData, config: typeDef });
    startRenderLoopIfNeeded();
});

mp.events.add('client:zone:exitBroad', (zoneId) => {
    if (activePreciseZones.has(zoneId)) {
        const zone = activeBroadZones.get(zoneId);
        if (zone) applyZoneEffects(zoneId, zone.config, false);
        activePreciseZones.delete(zoneId);
    }
    activeBroadZones.delete(zoneId);
});

// --- DEBUG COMMAND ---
mp.events.add('console:showzones', () => {
    debugMode = !debugMode;
    mp.gui.chat.push(debugMode ? "!{00FF00}[Zones] Debug lines ENABLED" : "!{FF0000}[Zones] Debug lines DISABLED");
});
// To use this, type /showzones in chat. You need to register the command on server side to call this event, 
// OR simpler: just type `mp.events.call('console:showzones')` in F11 console.
// BETTER: Add this temporary command below to client-side for easy testing:
mp.events.add("playerCommand", (command) => {
    if (command === "showzones") {
        debugMode = !debugMode;
        mp.gui.chat.push(debugMode ? "Debug lines ON" : "Debug lines OFF");
        return true;
    }
});


// --- RENDER LOOP (Physics & Visuals) ---
mp.events.add("render", () => {
    // 1. Ghost Mode Logic
    let inGhostZone = false;
    activePreciseZones.forEach(id => {
        const z = activeBroadZones.get(id);
        if (z && z.config.ghost) inGhostZone = true;
    });

    if (inGhostZone && localPlayer.vehicle) {
        mp.vehicles.forEachInStreamRange((veh) => {
            if (veh.handle !== localPlayer.vehicle.handle) {
                mp.game.entity.setNoCollisionEntity(localPlayer.vehicle.handle, veh.handle, false);
                mp.game.entity.setNoCollisionEntity(veh.handle, localPlayer.vehicle.handle, false);
            }
        });
    }

    // 2. DEBUG DRAWING (This solves your "I don't see it" issue)
    if (debugMode) {
        activeBroadZones.forEach((zone) => {
            if (zone.data.shape === 'polygon') {
                const vs = zone.data.vertices;
                const zHeight = localPlayer.position.z; // Draw at player height
                
                for (let i = 0; i < vs.length; i++) {
                    const p1 = vs[i];
                    const p2 = vs[(i + 1) % vs.length]; // Connect back to start
                    
                    // Draw Line (White)
                    mp.game.graphics.drawLine(p1.x, p1.y, zHeight - 10, p2.x, p2.y, zHeight - 10, 255, 255, 255, 255);
                    mp.game.graphics.drawLine(p1.x, p1.y, zHeight + 10, p2.x, p2.y, zHeight + 10, 255, 255, 255, 255);
                    
                    // Draw Vertical Pillars at corners (Red)
                    mp.game.graphics.drawLine(p1.x, p1.y, zHeight - 20, p1.x, p1.y, zHeight + 20, 255, 0, 0, 255);
                }
            }
        });
    }
});

// --- CHECKER LOOP ---
function startRenderLoopIfNeeded() {
    if (renderInterval) return;
    renderInterval = setInterval(() => {
        if (activeBroadZones.size === 0) {
            clearInterval(renderInterval);
            renderInterval = null;
            return;
        }
        const pos = localPlayer.position;
        const pObj = { x: pos.x, y: pos.y };

        activeBroadZones.forEach((zone, id) => {
            let isInside = false;
            if (zone.data.shape === 'polygon') isInside = isPointInPolygon(pObj, zone.data.vertices);
            else isInside = true; 

            const wasInside = activePreciseZones.has(id);
            if (isInside && !wasInside) {
                activePreciseZones.add(id);
                applyZoneEffects(id, zone.config, true);
            } else if (!isInside && wasInside) {
                activePreciseZones.delete(id);
                applyZoneEffects(id, zone.config, false);
            }
        });
    }, 200); 
}