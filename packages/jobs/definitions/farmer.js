// packages/jobs/definitions/farmer.js
const jobManager = require('../jobManager');
const inventory = require('../../systems/inventory');
const playerManager = require('../../core/playerManager');
const db = require('../../core/database');
const zones = require('../../zones/config');
const ItemRegistry = require('../../data/items');

// --- CONFIGURATION ---
const JOB_KEY = 'farmer';
const JOB_REQUIREMENT_LEVEL = 1; 
const RECOVERY_TIME_MS = 30 * 60 * 1000; 
const PLANT_RADIUS = 2.5; 

// Wholesaler Configuration
const SELLABLE_ITEMS = {
    'apple': { price: 2, label: "Fresh Apple" },
    'pumpkin': { price: 15, label: "Giant Pumpkin" },
    'cabbage': { price: 10, label: "Green Cabbage" },
};

// Crop Settings
const CROP_LIMIT_MIN = 50;   
const CROP_LIMIT_MAX = 100;  

const JOB_NPC = { x: 2434.66, y: 4976.76, z: 46.57, h: 43.95 };
const SELLER_NPC = { x: 1960.07, y: 3739.94, z: 32.34, h: -50.14 };
const VEHICLE_SPAWN = { x: 2411.58, y: 4988.95, z: 45.43, h: 133.84 };
const GARAGE_POS = { x: 2415.52, y: 4993.02, z: 46.22, h: 134.69 }; 

// --- ANIMAL KEEPER CONFIG ---
const ANIMAL_PAYOUTS = {
    'feed': 10,   // Pay for feeding
    'milk': 15,   // Pay for milking
    'collect': 5 // Pay for collecting eggs/wool
};

const ANIMAL_COOLDOWN_MS = 120000; // 120 seconds wait per animal

const ANIMAL_ZONES = [
    { 
        name: "Chicken Coop", 
        x: 2378.54, y: 5053.44, z: 46.44, 
        sprite: 256 // "Hen House" sprite (or use 442)
    }, 
    { 
        name: "Livestock Barn", 
        x: 2170.00, y: 4990.00, z: 41.30, // Centered between cows and pigs
        sprite: 442 // "Animal/Paw" sprite
    }
];

// Animal Data (Compiled from your coords)
const ANIMALS = [
    // --- CHICKENS ---
    { id: 100, type: 'hen', model: 'a_c_hen', x: 2378.54, y: 5053.44, z: 46.14, h: -37.47 },
    { id: 101, type: 'hen', model: 'a_c_hen', x: 2380.00, y: 5054.50, z: 46.14, h: 45.00 },
    { id: 102, type: 'hen', model: 'a_c_hen', x: 2377.00, y: 5055.00, z: 46.14, h: 90.00 },
    { id: 103, type: 'hen', model: 'a_c_hen', x: 2379.50, y: 5052.00, z: 46.14, h: 180.00 },
    { id: 104, type: 'hen', model: 'a_c_hen', x: 2376.50, y: 5052.50, z: 46.14, h: 270.00 },

    // --- COWS ---
    { id: 200, type: 'cow', model: 'a_c_cow', x: 2176.41, y: 4986.26, z: 41.01, h: -139.70 },
    { id: 201, type: 'cow', model: 'a_c_cow', x: 2168.50, y: 4979.81, z: 41.00, h: -139.97 },
    { id: 202, type: 'cow', model: 'a_c_cow', x: 2161.93, y: 4972.65, z: 41.06, h: -140.70 },
    { id: 203, type: 'cow', model: 'a_c_cow', x: 2154.46, y: 4965.56, z: 41.20, h: -136.00 },
    { id: 204, type: 'cow', model: 'a_c_cow', x: 2196.79, y: 4968.49, z: 41.08, h: 42.74 },
    { id: 205, type: 'cow', model: 'a_c_cow', x: 2188.92, y: 4961.02, z: 40.98, h: 48.98 },
    { id: 206, type: 'cow', model: 'a_c_cow', x: 2178.07, y: 4951.24, z: 41.00, h: 51.69 },
    { id: 207, type: 'cow', model: 'a_c_cow', x: 2174.46, y: 4947.18, z: 41.04, h: 39.83 },

    // --- PIGS ---
    { id: 300, type: 'pig', model: 'a_c_pig', x: 2165.78, y: 4996.82, z: 41.00, h: 44.35 },
    { id: 301, type: 'pig', model: 'a_c_pig', x: 2158.07, y: 4989.39, z: 41.03, h: 40.66 },
    { id: 302, type: 'pig', model: 'a_c_pig', x: 2151.51, y: 4982.47, z: 41.12, h: 39.98 },
    { id: 303, type: 'pig', model: 'a_c_pig', x: 2144.21, y: 4975.33, z: 41.20, h: 44.65 },
    { id: 304, type: 'pig', model: 'a_c_pig', x: 2128.30, y: 4991.68, z: 41.16, h: -141.70 },
    { id: 305, type: 'pig', model: 'a_c_pig', x: 2136.05, y: 4998.37, z: 41.11, h: -136.79 },
    { id: 306, type: 'pig', model: 'a_c_pig', x: 2142.56, y: 5005.97, z: 41.04, h: -133.91 },
    { id: 307, type: 'pig', model: 'a_c_pig', x: 2149.99, y: 5013.23, z: 41.08, h: -138.22 },
];

const TREES = [
    { id: 'tree_1', x: 2389.63, y: 4991.62, z: 45.15 },
    { id: 'tree_2', x: 2374.04, y: 4988.31, z: 43.99 },
    { id: 'tree_3', x: 2361.55, y: 4975.87, z: 43.23 },
    { id: 'tree_4', x: 2389.29, y: 5004.06, z: 45.67 },
    { id: 'tree_5', x: 2377.58, y: 5004.48, z: 44.64 },
    { id: 'tree_6', x: 2362.02, y: 4989.36, z: 43.36 },
    { id: 'tree_7', x: 2348.72, y: 4976.06, z: 42.76 },
    { id: 'tree_8', x: 2335.88, y: 4976.37, z: 42.61 },
    { id: 'tree_9', x: 2349.02, y: 4989.14, z: 43.03 },
    { id: 'tree_10', x: 2360.45, y: 5001.72, z: 43.39 },
    { id: 'tree_11', x: 2369.90, y: 5010.62, z: 44.35 },
    { id: 'tree_12', x: 2376.14, y: 5016.28, z: 45.36 },
    { id: 'tree_13', x: 2357.63, y: 5021.00, z: 43.96 },
    { id: 'tree_14', x: 2343.97, y: 5008.01, z: 42.72 },
    { id: 'tree_15', x: 2331.52, y: 4996.04, z: 42.12 },
    { id: 'tree_16', x: 2317.15, y: 4984.59, z: 41.81 },
    { id: 'tree_17', x: 2317.90, y: 4994.66, z: 42.07 },
    { id: 'tree_18', x: 2330.72, y: 5007.31, z: 42.35 },
    { id: 'tree_19', x: 2343.42, y: 5022.12, z: 43.48 },
    { id: 'tree_20', x: 2342.03, y: 5035.54, z: 44.37 },
    { id: 'tree_21', x: 2330.37, y: 5021.35, z: 42.88 },
    { id: 'tree_22', x: 2317.33, y: 5009.22, z: 42.53 },
    { id: 'tree_23', x: 2304.36, y: 4997.27, z: 42.35 },
    { id: 'tree_24', x: 2316.15, y: 5023.19, z: 43.33 },
    { id: 'tree_25', x: 2329.89, y: 5036.98, z: 44.43 },
];

const activeJobs = new Map();
const activeCropsByPlayer = new Map(); 

// --- INITIALIZATION ---
async function loadCrops() {
    try {
        const [rows] = await db.query('SELECT * FROM character_farm_crops');
        rows.forEach(row => {
            const charId = parseInt(row.character_id); 
            if (!activeCropsByPlayer.has(charId)) activeCropsByPlayer.set(charId, []);
            activeCropsByPlayer.get(charId).push(formatCropRow(row));
        });
        console.log(`[FARMER] Loaded crops for ${activeCropsByPlayer.size} players.`);
    } catch (e) { console.error(e); }
}
loadCrops();

function formatCropRow(row) {
    return {
        id: row.id, owner: row.character_id, item: row.seed_item_id,
        fieldId: row.field_id,
        x: row.x, y: row.y, z: row.z, h: row.heading,
        planted: Number(row.planted_at), ready: Number(row.ready_at)
    };
}

const getRandomHarvests = () => Math.floor(Math.random() * 6) + 1;

// --- UTILS ---
function isPointInPolygon(p, vertices) {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x, yi = vertices[i].y;
        const xj = vertices[j].x, yj = vertices[j].y;
        const intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function getDistance(v1, v2) {
    const dx = v1.x - v2.x;
    const dy = v1.y - v2.y;
    const dz = v1.z - v2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

const logic = {
    onInteract: async (player, action) => { 
        if (action === 'apple') return startAppleJob(player);
        if (action === 'crop') return startCropJob(player);
        if (action === 'animal') return startAnimalJob(player);
    },
    onStop: (player) => {
        const data = activeJobs.get(player.id);
        if (data && data.vehicle && mp.vehicles.exists(data.vehicle)) data.vehicle.destroy();
        activeJobs.delete(player.id);
        jobManager.clearObjective(player);
        
        // Clear all client-side visuals
        player.call('client:farmer:clearMarkers'); 
        player.call('client:farmer:clearCrops'); 
        player.call('client:farmer:clearFieldBlips');
        
        // [NEW] Clear Animal Blips
        player.call('client:farmer:clearAnimalBlips'); 

        player.call('client:farmer:toggleSeller', [false]);
    }
};

// --- ANIMAL JOB LOGIC ---
async function startAnimalJob(player) {
    jobManager.startJobSession(player, JOB_KEY);
    
    // Initialize per-player animal states (tracking cooldowns)
    const animalStates = {};
    ANIMALS.forEach(a => {
        animalStates[a.id] = { nextReady: 0 };
    });

    activeJobs.set(player.id, { 
        type: 'animal', 
        animalStates: animalStates 
    });

    // Create visual markers for the animals
    syncAnimalMarkers(player);
    player.call('client:farmer:createAnimalBlips', [JSON.stringify(ANIMAL_ZONES)]);

    player.call('showNotification', ['Farmer', 'Animal Keeper Job started. Check map for locations.']);
}

function syncAnimalMarkers(player) {
    const data = activeJobs.get(player.id);
    if (!data || data.type !== 'animal') return;

    const now = Date.now();
    const validPositions = [];

    ANIMALS.forEach(anim => {
        const state = data.animalStates[anim.id];
        // Only show marker if animal is ready for interaction
        if (state && now >= state.nextReady) {
            validPositions.push({ x: anim.x, y: anim.y, z: anim.z + 1.0 }); // Float above animal
        }
    });

    player.call('client:farmer:updateMarkers', [JSON.stringify(validPositions)]);
}

mp.events.add('server:farmer:interactAnimal', async (player, animalId) => {
    if (player.activeJobId !== JOB_KEY) return player.call('showNotification', ['Farmer', 'You are not on the clock.']);
    if (player.data.isBusy) return;

    const data = activeJobs.get(player.id);
    if (!data || !data.animalStates) return;

    const animalDef = ANIMALS.find(a => a.id === animalId);
    const state = data.animalStates[animalId];
    
    if (!animalDef || !state) return;

    const now = Date.now();
    if (now < state.nextReady) {
        const seconds = Math.ceil((state.nextReady - now) / 1000);
        return player.call('showNotification', ['Farmer', `Animal is resting. Wait ${seconds}s.`]);
    }

    // Determine Action
    let actionType = 'feed';
    let animDict = 'amb@world_human_gardener_plant@male@base';
    let animName = 'base';
    let duration = 4000;
    let msg = "Fed the animal.";

    // Logic based on animal type
    if (animalDef.type === 'cow') {
        if (Math.random() > 0.5) {
            actionType = 'milk';
            msg = "Collected fresh milk.";
            animDict = 'amb@medic@standing@kneel@base';
            animName = 'base'; 
        } else {
            msg = "Fed the cow.";
        }
    } else if (animalDef.type === 'hen') {
        actionType = 'collect';
        msg = "Collected eggs.";
        animDict = 'amb@prop_human_movie_bulb@idle_a'; 
        animName = 'idle_a'; 
    }

    // Start Action
    player.data.isBusy = true;
    player.call('client:freezePlayer', [true]);
    player.playAnimation(animDict, animName, 1, 33);

    setTimeout(async () => {
        player.data.isBusy = false;
        if (!mp.players.exists(player)) return;

        player.stopAnimation();
        player.call('client:freezePlayer', [false]);

        // Payment
        const pay = ANIMAL_PAYOUTS[actionType];
        await playerManager.addMoneyAndSave(player, pay, 'Farmer Job');
        await jobManager.addJobXp(player, JOB_KEY, 2);

        player.call('showNotification', ['Farmer', `+ $${pay} | ${msg}`]);

        // Set Cooldown
        state.nextReady = Date.now() + ANIMAL_COOLDOWN_MS;
        
        // Refresh markers
        syncAnimalMarkers(player);

    }, duration);
});

// --- APPLE JOB LOGIC ---
async function startAppleJob(player) {
    const level = jobManager.getJobLevel(player, JOB_KEY);
    if (level < JOB_REQUIREMENT_LEVEL) return player.call('showNotification', ['Job Center', `Need Level ${JOB_REQUIREMENT_LEVEL}.`]);
    jobManager.startJobSession(player, JOB_KEY);
    const treeStates = {};
    try {
        const [rows] = await db.query('SELECT tree_id, harvests_left, cooldown_expiry FROM character_farm_trees WHERE character_id = ?', [player.data.dbId]);
        rows.forEach(r => treeStates[r.tree_id] = { harvests_left: r.harvests_left, cooldown_expiry: Number(r.cooldown_expiry) });
    } catch (e) {}
    activeJobs.set(player.id, { vehicle: null, treeStates });
    syncTreeMarkers(player);
    player.call('client:farmer:toggleSeller', [true]);
    player.call('showNotification', ['Farmer', 'Apple Job started.']);
}

// --- CROP JOB LOGIC ---
async function startCropJob(player) {
    jobManager.startJobSession(player, JOB_KEY);
    activeJobs.set(player.id, { vehicle: null }); 
    syncCropsToPlayer(player);
    player.call('client:farmer:toggleSeller', [true]); 

    const farmFields = zones.Zones.filter(z => z.id && z.id.startsWith('farm_field_')).map(z => {
        let sumX = 0, sumY = 0;
        if (z.vertices && z.vertices.length > 0) {
            z.vertices.forEach(v => { sumX += v.x; sumY += v.y; });
            return { x: sumX / z.vertices.length, y: sumY / z.vertices.length, z: z.minZ || 40.0 };
        }
        return null;
    }).filter(p => p !== null);
    
    if(farmFields.length > 0) player.call('client:farmer:createFieldBlips', [JSON.stringify(farmFields)]);
    player.call('showNotification', ['Farmer', `Crop Job Started.`]);
}

mp.events.add('server:farmer:tryPlant', async (player, seedId, slot) => {
    if (player.activeJobId !== JOB_KEY) return player.call('showNotification', ['Farmer', 'Start the job first.']);
    
    if (player.data.isPlanting) return;

    const pPos = player.position;
    const fields = zones.Zones.filter(z => z.id.startsWith('farm_field_'));
    const inField = fields.find(z => {
        if (z.minZ && pPos.z < z.minZ) return false;
        if (z.maxZ && pPos.z > z.maxZ) return false;
        return z.vertices && isPointInPolygon(pPos, z.vertices);
    });

    if (!inField) return player.call('showNotification', ['Farmer', 'You must be inside a Farming Field.']);

    // Capacity Check
    if (inField.maxCapacity) {
        let totalInField = 0;
        for (const crops of activeCropsByPlayer.values()) {
            for (const c of crops) {
                if (c.fieldId === inField.id) totalInField++;
            }
        }
        if (totalInField >= inField.maxCapacity) {
             return player.call('showNotification', ['Farmer', `Field is full! (${totalInField}/${inField.maxCapacity})`]);
        }
    }

    const seedDef = ItemRegistry[seedId];
    if (!seedDef) return;

    const level = jobManager.getJobLevel(player, JOB_KEY);
    const variableAmount = Math.floor((Math.min(level, 100) / 100) * (CROP_LIMIT_MAX - CROP_LIMIT_MIN));
    const allowed = CROP_LIMIT_MIN + variableAmount;
    
    const charId = parseInt(player.data.dbId);
    const myCrops = activeCropsByPlayer.get(charId) || [];
    
    if (myCrops.length >= allowed) return player.call('showNotification', ['Farmer', `Personal Limit Reached! (Max: ${allowed})`]);
    
    const tooClose = myCrops.some(crop => {
        const d = getDistance(pPos, {x: crop.x, y: crop.y, z: crop.z});
        return d < PLANT_RADIUS;
    });

    if (tooClose) {
        return player.call('showNotification', ['Farmer', 'Too close to your other crops.']);
    }

    const itemObj = player.inventory.find(i => i.slot === slot);
    if (!itemObj) return;

    if (itemObj.count > 1) {
        itemObj.count--;
        await db.query('UPDATE character_inventory SET count = ? WHERE id = ?', [itemObj.count, itemObj.id]);
    } else {
        await inventory.removeItem(player, itemObj);
    }
    inventory.syncClient(player);

    player.data.isPlanting = true;
    
    const groundZ = player.position.z - 1.0; 
    player.playAnimation('amb@world_human_gardener_plant@male@base', 'base', 1, 33);
    player.call('client:freezePlayer', [true]);

    setTimeout(async () => {
        player.data.isPlanting = false;

        if (!mp.players.exists(player)) return;
        player.stopAnimation();
        player.call('client:freezePlayer', [false]);
        
        const now = Date.now();
        const readyAt = now + (seedDef.data.growTime || 60000);
        
        const [res] = await db.query('INSERT INTO character_farm_crops (character_id, field_id, seed_item_id, x, y, z, heading, planted_at, ready_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [player.data.dbId, inField.id, seedId, player.position.x, player.position.y, groundZ, player.heading, now, readyAt]);

        const newCrop = { 
            id: res.insertId, 
            owner: player.data.dbId, 
            item: seedId, 
            fieldId: inField.id, 
            x: player.position.x, 
            y: player.position.y, 
            z: groundZ, 
            h: player.heading, 
            planted: now, 
            ready: readyAt 
        };
        
        if (!activeCropsByPlayer.has(charId)) activeCropsByPlayer.set(charId, []);
        activeCropsByPlayer.get(charId).push(newCrop);
        
        syncCropsToPlayer(player);
        player.call('showNotification', ['Farmer', 'Seed planted!']);
    }, 4000);
});

mp.events.add('server:farmer:harvestCrop', async (player, cropId) => {
    if (player.data.isHarvesting) return;
    const charId = parseInt(player.data.dbId);
    const myCrops = activeCropsByPlayer.get(charId) || [];
    const foundCrop = myCrops.find(x => x.id === cropId);

    if (!foundCrop) return player.call('showNotification', ['Farmer', 'Crop error.']);
    if (Date.now() < foundCrop.ready) return player.call('showNotification', ['Farmer', 'Not ready yet.']);

    const seedDef = ItemRegistry[foundCrop.item];
    const rewardId = seedDef.data.reward;
    
    player.data.isHarvesting = true;
    player.playAnimation('amb@world_human_gardener_plant@male@base', 'base', 1, 33);
    player.call('client:freezePlayer', [true]);

    setTimeout(async () => {
        player.data.isHarvesting = false;
        if (mp.players.exists(player)) {
            player.stopAnimation();
            player.call('client:freezePlayer', [false]);
            if (await inventory.addItem(player, rewardId, 1)) {
                await db.query('DELETE FROM character_farm_crops WHERE id = ?', [cropId]);
                const idx = myCrops.findIndex(x => x.id === cropId);
                if (idx > -1) myCrops.splice(idx, 1);
                syncCropsToPlayer(player);
                await jobManager.addJobXp(player, JOB_KEY, 5);
                player.call('showNotification', ['Farmer', 'Harvested crop.']);
            } else {
                player.call('showNotification', ['Inventory', 'Inventory Full!']);
            }
        }
    }, 4000); 
});

function syncCropsToPlayer(player) {
    const charId = parseInt(player.data.dbId);
    const crops = activeCropsByPlayer.get(charId) || [];
    player.call('client:farmer:syncCrops', [JSON.stringify(crops)]);
}

function syncTreeMarkers(player) {
    const data = activeJobs.get(player.id);
    if (!data) return;
    const validTrees = [];
    const now = Date.now();
    TREES.forEach(tree => {
        const state = data.treeStates[tree.id];
        let isAvailable = true;
        if (state) {
            if (state.harvests_left <= 0 && state.cooldown_expiry > now) isAvailable = false;
        }
        if (isAvailable) validTrees.push({ x: tree.x, y: tree.y, z: tree.z });
    });
    player.call('client:farmer:updateMarkers', [JSON.stringify(validTrees)]);
}

mp.events.add('server:farmer:collect', async (player, treeIndex) => {
    if (player.activeJobId !== JOB_KEY) return player.call('showNotification', ['Farmer', 'You are not on the clock.']);
    if (player.data.isCollecting) return;

    const data = activeJobs.get(player.id);
    if (!data || !data.treeStates) return;
    const treeInfo = TREES[treeIndex];
    if (!treeInfo) return;
    const treeId = treeInfo.id;
    let state = data.treeStates[treeId];
    if (!state) {
        state = { harvests_left: getRandomHarvests(), cooldown_expiry: 0 };
        data.treeStates[treeId] = state;
    }
    const now = Date.now();
    let requiresSync = false;
    if (state.cooldown_expiry > now) {
        const minsLeft = Math.ceil((state.cooldown_expiry - now) / 60000);
        return player.call('showNotification', ['Farmer', `This tree is recovering. Available in ${minsLeft} mins.`]);
    }
    if (state.harvests_left <= 0 && state.cooldown_expiry <= now) {
        state.harvests_left = getRandomHarvests();
        state.cooldown_expiry = 0;
        requiresSync = true; 
    }

    player.data.isCollecting = true;
    player.call('client:freezePlayer', [true]);
    player.playAnimation('amb@prop_human_movie_bulb@idle_a', 'idle_a', 1, 47);
    
    setTimeout(async () => {
        player.data.isCollecting = false;
        if (!mp.players.exists(player)) return;
        player.stopAnimation();
        player.call('client:freezePlayer', [false]);
        if (await inventory.addItem(player, 'apple', 1)) {
            state.harvests_left--;
            if (state.harvests_left <= 0) {
                state.cooldown_expiry = Date.now() + RECOVERY_TIME_MS;
                player.call('showNotification', ['Farmer', `Collected Apple. Tree depleted.`]);
                requiresSync = true;
            } else {
                player.call('showNotification', ['Farmer', `Collected Apple.`]);
            }
            try {
                await db.query(`
                    INSERT INTO character_farm_trees (character_id, tree_id, harvests_left, cooldown_expiry) 
                    VALUES (?, ?, ?, ?) 
                    ON DUPLICATE KEY UPDATE harvests_left = VALUES(harvests_left), cooldown_expiry = VALUES(cooldown_expiry)
                `, [player.data.dbId, treeId, state.harvests_left, state.cooldown_expiry]);
            } catch(e) { console.error(e); }
            if (requiresSync) syncTreeMarkers(player);
            await jobManager.addJobXp(player, JOB_KEY, 1);
        } else {
            player.call('showNotification', ['Inventory', 'Inventory Full!']);
        }
    }, 4000);
});

// --- WHOLESALER SYSTEM ---
mp.events.add('server:farmer:openSeller', (player) => {
    if (player.activeJobId !== JOB_KEY) return player.call('showNotification', ['Farmer', 'You need to be on duty (Farmer).']);
    
    // Build list of sellable items
    const clientItems = [];
    const inv = player.inventory;

    Object.keys(SELLABLE_ITEMS).forEach(itemId => {
        const config = SELLABLE_ITEMS[itemId];
        let count = 0;
        inv.forEach(i => { if(i.itemId === itemId) count += i.count; });

        clientItems.push({
            id: itemId,
            label: config.label,
            price: config.price,
            count: count
        });
    });

    jobManager.clearObjective(player);
    player.call('client:farmer:openMenu', [JSON.stringify(clientItems)]);
});

mp.events.add('server:farmer:sell', async (player, itemId, amount) => {
    if (player.activeJobId !== JOB_KEY) return;
    amount = parseInt(amount);
    if (amount <= 0) return;

    const config = SELLABLE_ITEMS[itemId];
    if (!config) return player.call('showNotification', ['Seller', 'We do not buy this item.']);

    const items = player.inventory.filter(i => i.itemId === itemId);
    let totalCount = items.reduce((acc, i) => acc + i.count, 0);

    if (totalCount < amount) return player.call('showNotification', ['Seller', `You don't have enough ${config.label}.`]);
    
    let remaining = amount;
    const removalPromises = [];
    for (const item of items) {
        if (remaining <= 0) break;
        if (item.count <= remaining) {
            remaining -= item.count;
            removalPromises.push(inventory.removeItem(player, item));
        } else {
            item.count -= remaining;
            remaining = 0;
             removalPromises.push(db.query('UPDATE character_inventory SET count = ? WHERE id = ?', [item.count, item.id]));
        }
    }
    await Promise.all(removalPromises);
    
    const money = amount * config.price;
    const xp = Math.ceil(amount * 0.5); 
    
    await playerManager.addMoneyAndSave(player, money, 'Farm Sales');
    await jobManager.addJobXp(player, JOB_KEY, xp);
    
    player.call('showNotification', ['Seller', `Sold ${amount} ${config.label} for $${money}.`]);
    inventory.syncClient(player);
    mp.events.call('server:farmer:openSeller', player);
});

jobManager.register(JOB_KEY, {
    name: 'Farmer', description: "Work in the fields.",
    previewButtons: [ { label: "Apple Collector", action: "apple" }, { label: "Crop Planter", action: "crop" }, { label: "Animal Keeper", action: "animal" } ],
    pedModel: 'a_m_m_farmer_01', pos: JOB_NPC, blipSprite: 846, blipColor: 25,
}, logic);

mp.peds.new(mp.joaat('s_m_m_migrant_01'), new mp.Vector3(SELLER_NPC.x, SELLER_NPC.y, SELLER_NPC.z), {
    heading: SELLER_NPC.h, dynamic: false, invincible: true, frozen: true
});

const sellerCol = mp.colshapes.newSphere(SELLER_NPC.x, SELLER_NPC.y, SELLER_NPC.z, 2.0);
sellerCol.setVariable('interaction', {
    title: 'Farm Wholesaler', text: 'Sell Crops', event: 'server:farmer:openSeller', requireOnFoot: true
});

// --- SPAWN OBJECTS ---

TREES.forEach((tree, index) => {
    const col = mp.colshapes.newSphere(tree.x, tree.y, tree.z, 2.0);
    col.setVariable('interaction', {
        title: 'Apple Tree', text: 'Press E to Collect', event: 'server:farmer:collect', data: index, requireOnFoot: true
    });
});

mp.events.add('server:farmer:spawnTractor', (player) => {
    if (player.activeJobId !== JOB_KEY) return player.call('showNotification', ['Farmer', 'You are not on the clock.']);
    const data = activeJobs.get(player.id);
    if (!data) return;
    if (data.vehicle && mp.vehicles.exists(data.vehicle)) data.vehicle.destroy();
    const level = jobManager.getJobLevel(player, JOB_KEY);
    const model = level > 20 ? 'warrener2' : 'tractor2'; 
    data.vehicle = mp.vehicles.new(mp.joaat(model), new mp.Vector3(VEHICLE_SPAWN.x, VEHICLE_SPAWN.y, VEHICLE_SPAWN.z), {
        heading: VEHICLE_SPAWN.h, numberPlate: 'FARMER', dimension: player.dimension, locked: false, engine: false
    });
    data.vehicle.jobOwner = player.id;
    data.vehicle.setVariable('fuel', 100);
    setTimeout(() => {
        if (mp.players.exists(player) && mp.vehicles.exists(data.vehicle)) {
            player.call('client:warpIntoVehicle', [data.vehicle.id, -1]);
        }
    }, 200);
});

const garageCol = mp.colshapes.newSphere(GARAGE_POS.x, GARAGE_POS.y, GARAGE_POS.z, 2.0);
garageCol.setVariable('interaction', {
    title: 'Farmer Garage', text: 'Spawn Tractor', event: 'server:farmer:spawnTractor', requireOnFoot: true
});
mp.peds.new(mp.joaat('cs_old_man2'), new mp.Vector3(GARAGE_POS.x, GARAGE_POS.y, GARAGE_POS.z), {
    heading: GARAGE_POS.h, dynamic: false, invincible: true, frozen: true
});

// --- SPAWN ANIMALS & ZONES ---
ANIMALS.forEach((anim) => {
    // 1. Spawn the Animal Ped (Global, Invincible, Frozen)
    mp.peds.new(mp.joaat(anim.model), new mp.Vector3(anim.x, anim.y, anim.z), {
        heading: anim.h,
        dynamic: false,
        invincible: true,
        frozen: true
    });

    // 2. Create Interaction Sphere
    const col = mp.colshapes.newSphere(anim.x, anim.y, anim.z, 1.5);
    col.setVariable('interaction', {
        title: 'Farm Animal',
        text: 'Press E to Interact',
        event: 'server:farmer:interactAnimal',
        data: anim.id,
        requireOnFoot: true
    });
});