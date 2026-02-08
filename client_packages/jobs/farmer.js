// client_packages/jobs/farmer.js
let markers = [];
let fieldBlips = []; 
let sellerBlip = null;
let sellerMenu = null;
let cropObjects = {}; 
let cropColshapes = {}; // Store colshapes for interactions
let cropData = []; 

const CROP_MODELS = {
    'seed_pumpkin': { start: 'prop_veg_crop_04_leaf', end: 'prop_veg_crop_03_pump', zOff: -0.05 },
};

// --- MARKERS & BLIPS ---

mp.events.add('client:farmer:updateMarkers', (json) => {
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

mp.events.add('client:farmer:createFieldBlips', (json) => {
    fieldBlips.forEach(b => b.destroy());
    fieldBlips = [];
    const positions = JSON.parse(json);
    positions.forEach(pos => {
        const blip = mp.blips.new(88, new mp.Vector3(pos.x, pos.y, pos.z), {
            name: 'Farm Field', color: 25, shortRange: true, scale: 0.8
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

    // 1. Remove old objects & colshapes
    Object.keys(cropObjects).forEach(k => {
        const id = parseInt(k);
        if (!newIds.has(id)) {
            if (mp.objects.exists(cropObjects[id])) cropObjects[id].destroy();
            delete cropObjects[id];
        }
    });

    Object.keys(cropColshapes).forEach(k => {
        const id = parseInt(k);
        if (!newIds.has(id)) {
            if (mp.colshapes.exists(cropColshapes[id])) cropColshapes[id].destroy();
            delete cropColshapes[id];
        }
    });

    // 2. Add/Update objects
    newCrops.forEach(crop => {
        const def = CROP_MODELS[crop.item];
        if (!def) return;

        const isReady = Date.now() >= crop.ready;
        const model = isReady ? def.end : def.start;

        // --- Object Management ---
        if (!cropObjects[crop.id]) {
            cropObjects[crop.id] = mp.objects.new(mp.game.joaat(model), new mp.Vector3(crop.x, crop.y, crop.z + def.zOff), {
                rotation: new mp.Vector3(0, 0, crop.h),
                dimension: 0
            });
            const obj = cropObjects[crop.id];
            obj.freezePosition(true);  
            obj.setInvincible(true);
            obj.setProofs(true, true, true, true, true, true, true, true); 
        } else {
            // Re-enforce state just in case
            const obj = cropObjects[crop.id];
            if(mp.objects.exists(obj)) {
                 obj.freezePosition(true);
            }
        }

        // --- ColShape Interaction Management ---
        // Only create an interaction prompt if the crop is READY
        if (isReady) {
            if (!cropColshapes[crop.id]) {
                const col = mp.colshapes.newSphere(crop.x, crop.y, crop.z, 1.5, 0); // 1.5m radius
                
                col.interaction = {
                    title: 'Harvest Crop',
                    text: 'Press E to harvest',
                    event: 'server:farmer:harvestCrop',
                    data: crop.id,
                    requireOnFoot: true
                };
                
                cropColshapes[crop.id] = col;
            }
        }
    });
});

mp.events.add('client:farmer:clearCrops', () => {
    Object.values(cropObjects).forEach(o => { if (mp.objects.exists(o)) o.destroy(); });
    Object.values(cropColshapes).forEach(c => { if (mp.colshapes.exists(c)) c.destroy(); });
    cropObjects = {};
    cropColshapes = {};
    cropData = [];
});

mp.events.add('render', () => {
    if (cropData.length === 0) return;

    const now = Date.now();
    
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
                // Growing: ensure leaf model and lerp Z
                if (obj.model !== mp.game.joaat(def.start)) {
                    obj.model = mp.game.joaat(def.start);
                }
                const startZ = (crop.z + def.zOff) - 0.3; 
                const endZ = (crop.z + def.zOff);
                const currentZ = startZ + ((endZ - startZ) * progress);
                obj.position = new mp.Vector3(crop.x, crop.y, currentZ);

            } else {
                // Ready: ensure pumpkin model and fixed Z
                if (obj.model !== mp.game.joaat(def.end)) {
                    obj.model = mp.game.joaat(def.end);
                }
                obj.position = new mp.Vector3(crop.x, crop.y, crop.z + def.zOff);
            }
        }
        
        // Draw marker if ready (visual aid only, interaction is handled by ColShape)
        if (now >= crop.ready) {
             mp.game.graphics.drawMarker(
                1,                       
                crop.x, crop.y, crop.z + 0.3, 
                0, 0, 0, 0, 0, 0,                 
                0.6, 0.6, 0.4,           
                0, 255, 0, 100,          
                true, false, 2, false, null, null, false
             );

            if (!cropColshapes[crop.id]) {
                const col = mp.colshapes.newSphere(crop.x, crop.y, crop.z, 1.5, 0);
                col.interaction = {
                    title: 'Harvest Crop',
                    text: 'Press E to harvest',
                    event: 'server:farmer:harvestCrop',
                    data: crop.id,
                    requireOnFoot: true
                };
                cropColshapes[crop.id] = col;
             }
        }
    });
});