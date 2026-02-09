// client_packages/jobs/farmer.js
let markers = [];
let fieldBlips = []; 
let sellerBlip = null;
let sellerMenu = null;
let cropObjects = {}; 
let cropColshapes = {}; 
let cropData = []; 
let jobWaypoint = null;
let eggObjects = [];
let attachedProp = null;
let isMinigameActive = false;
let nearbyEgg = null;

const CROP_MODELS = {
    'seed_pumpkin': { start: 'prop_veg_crop_04_leaf', end: 'prop_veg_crop_03_pump', zOff: -0.05 },
    'seed_cabbage': { start: 'prop_veg_crop_04_leaf', end: 'prop_veg_crop_03_cab', zOff: -0.05 }
};

// --- MARKERS & WAYPOINTS ---

mp.events.add('client:farmer:setWaypoint', (x, y, z, label) => {
    // 1. Blip
    if (jobWaypoint) jobWaypoint.destroy();
    jobWaypoint = mp.blips.new(1, new mp.Vector3(x, y, z), {
        name: label, color: 1, shortRange: false, scale: 1.0
    });
    jobWaypoint.setRoute(true);

    // 2. Marker
    markers.forEach(m => m.destroy());
    markers = [];
    markers.push(mp.markers.new(1, new mp.Vector3(x, y, z - 1.0), 1.5, {
        color: [255, 255, 0, 150], visible: true
    }));
});

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
    if (jobWaypoint) { jobWaypoint.destroy(); jobWaypoint = null; }
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
                name: 'Crop Wholesaler', color: 2, shortRange: true, scale: 0.8
            });
        }
    } else {
        if (sellerBlip) { sellerBlip.destroy(); sellerBlip = null; }
    }
});

// --- MENU & UI ---

mp.events.add('client:farmer:openMenu', (itemsJson) => {
    if (sellerMenu) {
        sellerMenu.execute(`loadItems('${itemsJson}')`);
        return;
    }
    sellerMenu = mp.browsers.new('package://ui/appleSeller.html');
    mp.events.add('client:farmer:browserReady', () => {
         if(sellerMenu) sellerMenu.execute(`loadItems('${itemsJson}')`);
    });
    mp.gui.cursor.show(true, true);
});

mp.events.add('client:farmer:closeMenu', () => {
    if (sellerMenu) { sellerMenu.destroy(); sellerMenu = null; mp.gui.cursor.show(false, false); }
});

mp.events.add('client:farmer:sellAction', (itemId, amount) => {
    mp.events.callRemote('server:farmer:sell', itemId, amount);
});

mp.events.add('client:freezePlayer', (state) => {
    mp.players.local.freezePosition(state);
});

mp.events.add('client:warpIntoVehicle', (vehId, seat) => {
    const veh = mp.vehicles.at(vehId);
    if (veh) mp.players.local.setIntoVehicle(veh.handle, seat);
});

// --- ANIMAL KEEPER VISUALS ---

// EGG PROPS
mp.events.add('client:farmer:spawnEggs', (json) => {
    mp.events.call('client:farmer:clearEggs'); 
    const eggs = JSON.parse(json);
    eggs.forEach(e => {
        // FIXED: Using small realistic egg model
        const obj = mp.objects.new(mp.game.joaat('m24_2_prop_m42_oegg_01a'), new mp.Vector3(e.x, e.y, e.z), {
            dimension: 0
        });
        obj.eggId = e.id; 
        obj.setCollision(false, false);
        eggObjects.push(obj);
    });
});

mp.events.add('client:farmer:clearEggs', () => {
    eggObjects.forEach(o => { if (mp.objects.exists(o)) o.destroy(); });
    eggObjects = [];
});

setInterval(() => {
    if (eggObjects.length === 0) return;

    const pPos = mp.players.local.position;
    let found = null;

    for (const egg of eggObjects) {
        if (mp.game.system.vdist(pPos.x, pPos.y, pPos.z, egg.position.x, egg.position.y, egg.position.z) < 1.2) {
            found = egg;
            break;
        }
    }

    if (found && !nearbyEgg) {
        nearbyEgg = found;
        mp.events.call('showInteraction', 'Fresh Egg', 'Pick Up');
    } else if (!found && nearbyEgg) {
        nearbyEgg = null;
        mp.events.call('hideInteraction');
    }
}, 300);

// DETECT E ON EGGS
mp.keys.bind(0x45, true, function() {
    if (mp.gui.cursor.visible) return;
    if (eggObjects.length > 0) {
        const pPos = mp.players.local.position;
        let foundEgg = null;
        let index = -1;
        for (let i = 0; i < eggObjects.length; i++) {
            const egg = eggObjects[i];
            if (mp.game.system.vdist(pPos.x, pPos.y, pPos.z, egg.position.x, egg.position.y, egg.position.z) < 1.2) {
                foundEgg = egg;
                index = i;
                break;
            }
        }
        if (foundEgg) {
            mp.events.callRemote('server:farmer:collectEgg', foundEgg.eggId);
            foundEgg.destroy();
            eggObjects.splice(index, 1);
        }
    }
});

// MILKING MINIGAME
mp.events.add('client:farmer:startMilking', () => {
    mp.gui.chat.push("!{FFFF00}[TUTORIAL] Press SPACE when the bar is GREEN!");
    mp.players.local.freezePosition(true);
    mp.events.callRemote('client:playAnimation', 'amb@world_human_gardener_plant@male@base', 'base', 1); 

    isMinigameActive = true;
    let progress = 0;
    let direction = 1;
    let speed = 1.0; 
    const successStart = 45;
    const successEnd = 65;

    const renderEvent = new mp.Event('render', () => {
        if (!isMinigameActive) return;
        progress += speed * direction;
        if (progress >= 100) direction = -1;
        if (progress <= 0) direction = 1;

        const w = 0.25; const h = 0.03; const x = 0.5; const y = 0.8;
        mp.game.graphics.drawRect(x, y, w, h, 0, 0, 0, 180);
        const zoneW = (successEnd - successStart) / 100 * w;
        const zoneX = (x - w/2) + ((successStart/100) * w) + (zoneW/2);
        mp.game.graphics.drawRect(zoneX, y, zoneW, h, 0, 200, 0, 220);
        const cursorX = (x - w/2) + ((progress/100) * w);
        mp.game.graphics.drawRect(cursorX, y, 0.003, h + 0.015, 255, 255, 255, 255);
    });

    const keyHandler = new mp.Event('keyPress', (key) => {
        if (key === 32 && isMinigameActive) {
            isMinigameActive = false;
            renderEvent.destroy();
            keyHandler.destroy();
            if (progress >= successStart && progress <= successEnd) {
                mp.events.callRemote('server:farmer:milkSuccess');
            } else {
                mp.events.call('showNotification', 'Failed', 'You spilled the milk!');
                mp.players.local.stopAnimation();
            }
            mp.players.local.freezePosition(false);
        }
    });
});

// PROPS
mp.events.add('client:farmer:attachProp', (model, bone) => {
    if (attachedProp && mp.objects.exists(attachedProp)) attachedProp.destroy();
    attachedProp = mp.objects.new(mp.game.joaat(model), mp.players.local.position, {
        dimension: mp.players.local.dimension
    });
    setTimeout(() => {
        if (attachedProp && mp.objects.exists(attachedProp)) {
            attachedProp.attachTo(mp.players.local.handle, bone, 0.1, 0.1, 0.0, 0, 90, 0, true, true, false, false, 2, true);
        }
    }, 100);
});

mp.events.add('client:farmer:detachProp', () => {
    if (attachedProp && mp.objects.exists(attachedProp)) attachedProp.destroy();
    attachedProp = null;
});

mp.events.add('client:farmer:playSound', (sound, ref) => {
    mp.game.audio.playSoundFrontend(-1, sound, ref, true);
});

// --- CROP SYNC ---

mp.events.add('client:farmer:syncCrops', (json) => {
    let newCrops;
    try { newCrops = JSON.parse(json); } catch (e) { return; }
    
    cropData = newCrops;
    const newIds = new Set(newCrops.map(c => c.id));

    Object.keys(cropObjects).forEach(k => {
        const id = parseInt(k);
        if (!newIds.has(id)) {
            if (cropObjects[id] && mp.objects.exists(cropObjects[id])) cropObjects[id].destroy();
            delete cropObjects[id];
        }
    });

    Object.keys(cropColshapes).forEach(k => {
        const id = parseInt(k);
        if (!newIds.has(id)) {
            if (cropColshapes[id] && mp.colshapes.exists(cropColshapes[id])) cropColshapes[id].destroy();
            delete cropColshapes[id];
        }
    });

    newCrops.forEach(crop => {
        const def = CROP_MODELS[crop.item];
        if (!def) return; 

        const isReady = Date.now() >= crop.ready;
        const modelName = isReady ? def.end : def.start;
        const modelHash = mp.game.joaat(modelName);

        if (!cropObjects[crop.id] || !mp.objects.exists(cropObjects[crop.id])) {
            cropObjects[crop.id] = mp.objects.new(modelHash, new mp.Vector3(crop.x, crop.y, crop.z + def.zOff), {
                rotation: new mp.Vector3(0, 0, crop.h), dimension: 0
            });
            const obj = cropObjects[crop.id];
            if (obj) { obj.setInvincible(true); obj.freezePosition(true); }
        } else {
            const obj = cropObjects[crop.id];
            if (obj.model !== modelHash) obj.model = modelHash;
        }

        if (isReady) {
            if (!cropColshapes[crop.id] || !mp.colshapes.exists(cropColshapes[crop.id])) {
                const col = mp.colshapes.newSphere(crop.x, crop.y, crop.z, 1.5, 0);
                col.interaction = {
                    title: 'Harvest Crop', text: 'Press E to harvest',
                    event: 'server:farmer:harvestCrop', data: crop.id, requireOnFoot: true
                };
                cropColshapes[crop.id] = col;
            }
        }
    });
});

mp.events.add('client:farmer:clearCrops', () => {
    Object.values(cropObjects).forEach(o => { if (mp.objects.exists(o)) o.destroy(); });
    Object.values(cropColshapes).forEach(c => { if (mp.colshapes.exists(c)) c.destroy(); });
    cropObjects = {}; cropColshapes = {}; cropData = [];
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
            
            let progress = 0;
            if (totalTime > 0) progress = elapsed / totalTime;
            if (progress > 1) progress = 1;

            if (progress < 1.0) {
                if (obj.model !== mp.game.joaat(def.start)) obj.model = mp.game.joaat(def.start);
                const startZ = (crop.z + def.zOff) - 0.3; 
                const endZ = (crop.z + def.zOff);
                const currentZ = startZ + ((endZ - startZ) * progress);
                obj.position = new mp.Vector3(crop.x, crop.y, currentZ);
            } else {
                if (obj.model !== mp.game.joaat(def.end)) obj.model = mp.game.joaat(def.end);
                obj.position = new mp.Vector3(crop.x, crop.y, crop.z + def.zOff);
            }
        }
        
        if (now >= crop.ready) {
             mp.game.graphics.drawMarker(
                1, crop.x, crop.y, crop.z + 0.3, 
                0, 0, 0, 0, 0, 0, 0.6, 0.6, 0.4, 0, 255, 0, 100,          
                true, false, 2, false, null, null, false
             );
        }
    });
});