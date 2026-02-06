// client_packages/jobs/farmer.js
let markers = [];
let fieldBlips = []; // Stores blips for farm fields
let sellerBlip = null;
let sellerMenu = null;
let cropObjects = {}; 
let cropData = []; 

//
const CROP_MODELS = {
    // start: The leaf model that rises from the ground
    // end: The final pumpkin model
    'seed_pumpkin': { start: 'prop_veg_crop_04_leaf', end: 'prop_veg_crop_03_pump', zOff: -0.05 },
    // You can add more seed definitions here
};

// --- MARKERS & BLIPS ---

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

// NEW: Create blips for all valid farming fields
mp.events.add('client:farmer:createFieldBlips', (json) => {
    // Clear existing just in case
    fieldBlips.forEach(b => b.destroy());
    fieldBlips = [];

    const positions = JSON.parse(json);
    positions.forEach(pos => {
        const blip = mp.blips.new(88, new mp.Vector3(pos.x, pos.y, pos.z), {
            name: 'Farm Field',
            color: 25,
            shortRange: true,
            scale: 0.8
        });
        fieldBlips.push(blip);
    });
});

mp.events.add('client:farmer:clearFieldBlips', () => {
    fieldBlips.forEach(b => b.destroy());
    fieldBlips = [];
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

// --- MENU & UI ---

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

    // 1. Remove old objects that are no longer in the list
    Object.keys(cropObjects).forEach(k => {
        const id = parseInt(k);
        if (!newIds.has(id)) {
            if (mp.objects.exists(cropObjects[id])) cropObjects[id].destroy();
            delete cropObjects[id];
        }
    });

    // 2. Add/Update new objects
    newCrops.forEach(crop => {
        const def = CROP_MODELS[crop.item];
        if (!def) return;

        const isReady = Date.now() >= crop.ready;
        const model = isReady ? def.end : def.start;

        if (!cropObjects[crop.id]) {
            // Create the object at the calculated Z
            cropObjects[crop.id] = mp.objects.new(mp.game.joaat(model), new mp.Vector3(crop.x, crop.y, crop.z + def.zOff), {
                rotation: new mp.Vector3(0, 0, crop.h),
                dimension: 0
            });

            // Apply protections
            const obj = cropObjects[crop.id];
            obj.freezePosition(true);  
            obj.setInvincible(true);   
            obj.setProofs(true, true, true, true, true, true, true, true); 
            
        } else {
            // Maintenance for existing objects
            const obj = cropObjects[crop.id];
            if(mp.objects.exists(obj)) {
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
    // We don't need to check crop.owner anymore because cropData only contains OUR crops sent by server.

    cropData.forEach(crop => {
        const obj = cropObjects[crop.id];
        if (!obj || !obj.handle) return;

        const def = CROP_MODELS[crop.item];
        if (def) {
            const totalTime = crop.ready - crop.planted;
            const elapsed = now - crop.planted;
            
            // Calculate progress (0.0 to 1.0)
            let progress = 0;
            if (totalTime > 0) progress = elapsed / totalTime;
            if (progress < 0) progress = 0;
            if (progress > 1) progress = 1;

            if (progress < 1.0) {
                // --- GROWING PHASE (SPROUTING) ---
                
                // 1. Ensure Model is the Start Prop (Leaf)
                if (obj.model !== mp.game.joaat(def.start)) {
                    obj.model = mp.game.joaat(def.start);
                    obj.freezePosition(true);
                    obj.setInvincible(true);
                    obj.setProofs(true, true, true, true, true, true, true, true);
                }

                // 2. Rising Animation (Z-Axis Lerp)
                // Start: 0.3 units below target (Underground)
                // End: Target Z (Surface)
                const startZ = (crop.z + def.zOff) - 0.3; 
                const endZ = (crop.z + def.zOff);
                const currentZ = startZ + ((endZ - startZ) * progress);

                obj.position = new mp.Vector3(crop.x, crop.y, currentZ);

            } else {
                // --- READY PHASE ---
                
                // 1. Ensure Model is the End Prop (Pumpkin)
                if (obj.model !== mp.game.joaat(def.end)) {
                    obj.model = mp.game.joaat(def.end);
                    obj.freezePosition(true);
                    obj.setInvincible(true);
                    obj.setProofs(true, true, true, true, true, true, true, true);
                }

                // 2. Lock to Final Z
                obj.position = new mp.Vector3(crop.x, crop.y, crop.z + def.zOff);
            }
        }

        // --- INTERACTION & MARKERS ---
        if (now >= crop.ready) {
             
             // Green Marker above crop
             mp.game.graphics.drawMarker(
                1,                       
                crop.x, crop.y, crop.z + 0.3, 
                0, 0, 0,                 
                0, 0, 0,                 
                0.6, 0.6, 0.4,           
                0, 255, 0, 100,          
                true,                    
                false, 2, false, null, null, false
             );

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