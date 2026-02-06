let markers = [];
let sellerBlip = null;
let sellerMenu = null;
let cropObjects = {}; 
let cropData = []; 

const CROP_MODELS = {
    'seed_pumpkin': { start: 'prop_veg_crop_03_cab', end: 'prop_veg_crop_03_pump', zOff: -0.05 }
};

mp.events.add('client:farmer:updateMarkers', (json) => {
    // Clear old
    markers.forEach(m => m.destroy());
    markers = [];

    const treePositions = JSON.parse(json);
    treePositions.forEach(pos => {
        const m = mp.markers.new(1, new mp.Vector3(pos.x, pos.y, pos.z - 1.0), 1.0, {
            color: [255, 0, 0, 150], visible: true
        });
        markers.push(m);
    });
});

mp.events.add('client:farmer:clearMarkers', () => {
    markers.forEach(m => m.destroy());
    markers = [];
});

mp.events.add('client:farmer:toggleSeller', (state) => {
    if (state) {
        if (!sellerBlip) {
            sellerBlip = mp.blips.new(500, new mp.Vector3(1960.07, 3739.94, 32.34), {
                name: 'Apple Seller', color: 2, shortRange: true, scale: 0.8
            });
        }
    } else {
        if (sellerBlip) { sellerBlip.destroy(); sellerBlip = null; }
    }
});

mp.events.add('client:farmer:openMenu', (count, price) => {
    if (sellerMenu) return;
    sellerMenu = mp.browsers.new('package://ui/appleSeller.html');
    sellerMenu.execute(`setup(${count}, ${price})`);
    mp.gui.cursor.show(true, true);
});

mp.events.add('client:farmer:closeMenu', () => {
    if (sellerMenu) {
        sellerMenu.destroy();
        sellerMenu = null;
        mp.gui.cursor.show(false, false);
    }
});

mp.events.add('client:farmer:sellAction', (amount) => {
    mp.events.callRemote('server:farmer:sell', amount);
    if (sellerMenu) { sellerMenu.destroy(); sellerMenu = null; }
    mp.gui.cursor.show(false, false);
});

mp.events.add('client:freezePlayer', (state) => {
    mp.players.local.freezePosition(state);
});

mp.events.add('client:warpIntoVehicle', (vehId, seat) => {
    const veh = mp.vehicles.at(vehId);
    if (veh) mp.players.local.setIntoVehicle(veh.handle, seat);
});

// --- CROP SYSTEM ---

mp.events.add('client:farmer:syncCrops', (json) => {
    const newCrops = JSON.parse(json);
    cropData = newCrops;

    const newIds = new Set(newCrops.map(c => c.id));

    // 1. Remove old
    Object.keys(cropObjects).forEach(k => {
        const id = parseInt(k);
        if (!newIds.has(id)) {
            if (mp.objects.exists(cropObjects[id])) cropObjects[id].destroy();
            delete cropObjects[id];
        }
    });

    // 2. Add/Update
    newCrops.forEach(crop => {
        const def = CROP_MODELS[crop.item];
        if (!def) return;

        const isReady = Date.now() >= crop.ready;
        const model = isReady ? def.end : def.start;

        if (!cropObjects[crop.id]) {
            // Create the object
            cropObjects[crop.id] = mp.objects.new(mp.game.joaat(model), new mp.Vector3(crop.x, crop.y, crop.z + def.zOff), {
                rotation: new mp.Vector3(0, 0, crop.h),
                dimension: 0
            });

            // --- ADD THESE LINES TO PROTECT THE CROP ---
            const obj = cropObjects[crop.id];
            obj.freezePosition(true);  // Stops it from moving when hit by cars
            obj.setInvincible(true);   // Stops it from breaking if shot/damaged
            obj.setProofs(true, true, true, true, true, true, true, true); // Bullet, Fire, Explosion, etc.
            // -------------------------------------------
            
        } else {
            // Update model if grew
            const obj = cropObjects[crop.id];
            if (obj.model !== mp.game.joaat(model)) {
                obj.model = mp.game.joaat(model);
                // Re-apply protections just in case model change resets them
                obj.freezePosition(true);
                obj.setInvincible(true);
            }
        }
    });
});

mp.events.add('client:farmer:clearCrops', () => {
    Object.values(cropObjects).forEach(o => { if (mp.objects.exists(o)) o.destroy(); });
    cropObjects = {};
    cropData = [];
});

mp.events.add('render', () => {
    if (cropData.length === 0) return;

    const now = Date.now();
    const playerPos = mp.players.local.position;
    const myDbId = mp.players.local.getVariable('dbId'); 

    cropData.forEach(crop => {
        // Visual Update for Growth (Client side prediction)
        if (cropObjects[crop.id] && now >= crop.ready) {
            const def = CROP_MODELS[crop.item];
            if (def && cropObjects[crop.id].model !== mp.game.joaat(def.end)) {
                 const obj = cropObjects[crop.id];
                 obj.model = mp.game.joaat(def.end);
                 
                 // Re-apply protections (from your previous request)
                 obj.freezePosition(true);
                 obj.setInvincible(true);
            }
        }

        // Interaction & Markers
        // Only for my crops that are ready
        if (crop.owner === myDbId && now >= crop.ready) {
            
             // --- NEW: DRAW MARKER ---
             // Type 0 (Inverted Cone) or 1 (Cylinder). 
             // We use Type 20 (Upside down Chevron) or Type 1 (like trees) but smaller.
             // Here is a small Cylinder (Type 1) floating slightly above the crop:
             mp.game.graphics.drawMarker(
                1,                       // type (1 = Cylinder, same as trees)
                crop.x, crop.y, crop.z + 0.3, // position (z + 0.3 puts it around the crop base/middle)
                0, 0, 0,                 // direction
                0, 0, 0,                 // rotation
                0.6, 0.6, 0.4,           // scale (Small: 0.6 width, 0.4 height)
                0, 255, 0, 100,          // color (R, G, B, Alpha) -> Green for "Ready"
                true,                    // bobUpAndDown (Animates it slightly)
                false, 2, false, null, null, false
             );
             // ------------------------

             const dist = mp.game.system.vdist(playerPos.x, playerPos.y, playerPos.z, crop.x, crop.y, crop.z);
             if (dist < 1.5) {
                 mp.game.graphics.drawText("Press [E] to Harvest", [0.5, 0.8], { 
                    font: 4, color: [255, 255, 255, 255], scale: [0.4, 0.4], outline: true 
                });
                
                if (mp.keys.isDown(69)) { // E
                    if (!global.lastHarvest || now - global.lastHarvest > 1000) {
                        global.lastHarvest = now;
                        mp.events.callRemote('server:farmer:harvestCrop', crop.id);
                    }
                }
             }
        }
    });
});