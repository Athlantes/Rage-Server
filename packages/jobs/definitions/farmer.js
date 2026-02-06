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
const APPLE_PRICE = 2; 
const RECOVERY_TIME_MS = 30 * 60 * 1000; 

// Crop Settings
const CROP_LIMIT_BASE = 10;
const CROP_LIMIT_MAX = 20;

const JOB_NPC = { x: 2395.16, y: 4983.64, z: 45.33, h: -155.93 };
const SELLER_NPC = { x: 1960.07, y: 3739.94, z: 32.34, h: -50.14 };
const VEHICLE_SPAWN = { x: 2411.58, y: 4988.95, z: 45.43, h: 133.84 };
const GARAGE_POS = { x: 2415.52, y: 4993.02, z: 46.22, h: 134.69 }; 

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
// Cache: { 'farm_field_1': [ { id, owner, item, x, y, z, ready... } ] }
const activeCrops = {}; 

// --- INITIALIZATION: LOAD CROPS ---
async function loadCrops() {
    const [rows] = await db.query('SELECT * FROM character_farm_crops');
    rows.forEach(row => {
        if (!activeCrops[row.field_id]) activeCrops[row.field_id] = [];
        activeCrops[row.field_id].push(formatCropRow(row));
    });
    console.log(`[FARMER] Loaded ${rows.length} active crops.`);
}
loadCrops();

function formatCropRow(row) {
    return {
        id: row.id,
        owner: row.character_id,
        item: row.seed_item_id,
        x: row.x, y: row.y, z: row.z, h: row.heading,
        planted: Number(row.planted_at),
        ready: Number(row.ready_at)
    };
}

// --- HELPER: Random Harvest Count ---
const getRandomHarvests = () => Math.floor(Math.random() * 6) + 1;

// --- JOB LOGIC ---
const logic = {
    onInteract: async (player, action) => { 
        // 1. APPLE COLLECTOR
        if (action === 'apple') {
            return startAppleJob(player);
        }

        // 2. CROP PLANTER (Assignments)
        if (action === 'crop') {
            return assignField(player);
        }

        if (action === 'animal') {
            return player.call('showNotification', ['Farmer', 'Animal keeping is coming soon!']);
        }
    },
    
    onStop: (player) => {
        const data = activeJobs.get(player.id);
        if (data && data.vehicle && mp.vehicles.exists(data.vehicle)) {
            data.vehicle.destroy();
        }
        activeJobs.delete(player.id);
        jobManager.clearObjective(player);
        player.call('client:farmer:clearMarkers'); 
        player.call('client:farmer:clearCrops'); 
        player.call('client:farmer:toggleSeller', [false]);
        player.data.assignedField = null;
    }
};

// --- SUB-LOGIC: APPLE ---
async function startAppleJob(player) {
    const level = jobManager.getJobLevel(player, JOB_KEY);
    if (level < JOB_REQUIREMENT_LEVEL) {
        return player.call('showNotification', ['Job Center', `You need Level ${JOB_REQUIREMENT_LEVEL} Farming.`]);
    }
    
    jobManager.startJobSession(player, JOB_KEY);
    
    const treeStates = {};
    try {
        const [rows] = await db.query('SELECT tree_id, harvests_left, cooldown_expiry FROM character_farm_trees WHERE character_id = ?', [player.data.dbId]);
        rows.forEach(row => {
            treeStates[row.tree_id] = { harvests_left: row.harvests_left, cooldown_expiry: Number(row.cooldown_expiry) };
        });
    } catch (err) { console.error(err); }

    activeJobs.set(player.id, { vehicle: null, treeStates: treeStates });
    syncTreeMarkers(player);
    player.call('client:farmer:toggleSeller', [true]);
    player.call('showNotification', ['Farmer', 'Apple Job started. Use the Garage or go to the orchard.']);
}

// --- SUB-LOGIC: CROP ASSIGNMENT ---
async function assignField(player) {
    const hasSeeds = player.inventory.some(i => ItemRegistry[i.itemId] && ItemRegistry[i.itemId].type === 'seed');
    const [existing] = await db.query('SELECT field_id FROM character_farm_crops WHERE character_id = ? LIMIT 1', [player.data.dbId]);
    
    if (!hasSeeds && existing.length === 0) {
        return player.call('showNotification', ['Farmer', 'You need seeds (buy at store) or active crops to start.']);
    }

    let assignedId = null;

    if (existing.length > 0) {
        assignedId = existing[0].field_id;
    } else {
        const fields = zones.Zones.filter(z => z.id.startsWith('farm_field_'));
        
        fields.sort((a, b) => {
            const countA = (activeCrops[a.id] || []).length;
            const countB = (activeCrops[b.id] || []).length;
            return (countA / a.maxCapacity) - (countB / b.maxCapacity);
        });

        for (const field of fields) {
            const currentCount = (activeCrops[field.id] || []).length;
            if (currentCount + 10 <= field.maxCapacity) {
                assignedId = field.id;
                break;
            }
        }
    }

    if (!assignedId) return player.call('showNotification', ['Farmer', 'All fields are currently full. Please wait.']);

    jobManager.startJobSession(player, JOB_KEY);
    player.data.assignedField = assignedId;
    activeJobs.set(player.id, { vehicle: null }); 

    syncCropsToPlayer(player, assignedId);
    
    player.call('showNotification', ['Farmer', `You are assigned to ${assignedId.replace('farm_field_', 'Field ')}.`]);
}

// --- CROP EVENTS ---

// 1. PLANT
mp.events.add('server:farmer:tryPlant', async (player, seedId, slot) => {
    if (player.activeJobId !== JOB_KEY) return player.call('showNotification', ['Farmer', 'Start the job first.']);
    if (!player.data.assignedField) return player.call('showNotification', ['Farmer', 'You have no assigned field.']);

    const seedDef = ItemRegistry[seedId];
    if (!seedDef) return;

    // Check Limits
    const level = jobManager.getJobLevel(player, JOB_KEY);
    const allowed = Math.min(CROP_LIMIT_MAX, CROP_LIMIT_BASE + Math.floor(level / 2));
    
    const [countRows] = await db.query('SELECT COUNT(*) as count FROM character_farm_crops WHERE character_id = ?', [player.data.dbId]);
    if (countRows[0].count >= allowed) {
        return player.call('showNotification', ['Farmer', `Limit Reached! (Level ${level}: ${allowed} crops)`]);
    }

    // Check Spacing
    const fieldId = player.data.assignedField;
    const zoneCrops = activeCrops[fieldId] || [];
    const tooClose = zoneCrops.some(crop => player.dist(new mp.Vector3(crop.x, crop.y, crop.z)) < 1.5);
    if (tooClose) return player.call('showNotification', ['Farmer', 'Too close to another crop.']);

    // Consume Item
    const itemObj = player.inventory.find(i => i.slot === slot);
    if (!itemObj) return;
    
    if (itemObj.count > 1) {
        itemObj.count--;
        await db.query('UPDATE character_inventory SET count = ? WHERE id = ?', [itemObj.count, itemObj.id]);
    } else {
        await inventory.removeItem(player, itemObj);
    }
    inventory.syncClient(player);

    // Animation
    // We adjust Z by -1.0 to ensure it spawns on ground, not chest level
    const groundZ = player.position.z - 1.0; 

    player.playAnimation('amb@world_human_gardener_plant@male@base', 'base', 1, 33);
    player.call('client:freezePlayer', [true]);

    setTimeout(async () => {
        if (!mp.players.exists(player)) return;
        player.stopAnimation();
        player.call('client:freezePlayer', [false]);

        const now = Date.now();
        const readyAt = now + (seedDef.data.growTime || 60000);

        // Save with groundZ
        const [res] = await db.query(
            'INSERT INTO character_farm_crops (character_id, field_id, seed_item_id, x, y, z, heading, planted_at, ready_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [player.data.dbId, fieldId, seedId, player.position.x, player.position.y, groundZ, player.heading, now, readyAt]
        );

        const newCrop = {
            id: res.insertId, owner: player.data.dbId, item: seedId,
            x: player.position.x, y: player.position.y, z: groundZ, h: player.heading,
            planted: now, ready: readyAt
        };

        if (!activeCrops[fieldId]) activeCrops[fieldId] = [];
        activeCrops[fieldId].push(newCrop);

        syncCropsToZone(fieldId);
        player.call('showNotification', ['Farmer', 'Seed planted!']);
    }, 4000);
});

// 2. HARVEST
mp.events.add('server:farmer:harvestCrop', async (player, cropId) => {
    let foundCrop = null;
    let foundField = null;

    for (const [fId, crops] of Object.entries(activeCrops)) {
        const c = crops.find(x => x.id === cropId);
        if (c) { foundCrop = c; foundField = fId; break; }
    }

    if (!foundCrop) return;
    if (foundCrop.owner !== player.data.dbId) return player.call('showNotification', ['Farmer', 'Not your crop.']);
    if (Date.now() < foundCrop.ready) return player.call('showNotification', ['Farmer', 'Not ready yet.']);

    const seedDef = ItemRegistry[foundCrop.item];
    const rewardId = seedDef.data.reward;
    
    if (await inventory.addItem(player, rewardId, 1)) {
        // [FIXED] Ground Animation
        player.playAnimation('amb@world_human_gardener_plant@male@base', 'base', 1, 33);
        player.call('client:freezePlayer', [true]);

        setTimeout(async () => {
             if(mp.players.exists(player)) {
                 player.stopAnimation(); // [FIXED] Stop animation
                 player.call('client:freezePlayer', [false]);
             }
        }, 4000);

        await db.query('DELETE FROM character_farm_crops WHERE id = ?', [cropId]);
        const idx = activeCrops[foundField].indexOf(foundCrop);
        if (idx > -1) activeCrops[foundField].splice(idx, 1);

        syncCropsToZone(foundField);
        await jobManager.addJobXp(player, JOB_KEY, 5);
        player.call('showNotification', ['Farmer', 'Harvested crop.']);
    } else {
        player.call('showNotification', ['Inventory', 'Inventory Full!']);
    }
});

function syncCropsToZone(fieldId) {
    const crops = activeCrops[fieldId] || [];
    const data = JSON.stringify(crops);
    mp.players.forEach(p => {
        if (p.activeJobId === JOB_KEY && p.data.assignedField === fieldId) {
            p.call('client:farmer:syncCrops', [data]);
        }
    });
}

function syncCropsToPlayer(player, fieldId) {
    const crops = activeCrops[fieldId] || [];
    player.call('client:farmer:syncCrops', [JSON.stringify(crops)]);
}

// --- APPLE LOGIC: TREE SYNC ---
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

    player.call('client:freezePlayer', [true]);
    player.playAnimation('amb@prop_human_movie_bulb@idle_a', 'idle_a', 1, 47);

    setTimeout(async () => {
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

// --- SELLER LOGIC ---
mp.events.add('server:farmer:openSeller', (player) => {
    if (player.activeJobId !== JOB_KEY) return;
    let appleCount = 0;
    if (player.inventory) player.inventory.forEach(item => { if (item.itemId === 'apple') appleCount += item.count; });
    
    if (appleCount === 0) return player.call('showNotification', ['Seller', "You don't have any apples."]);
    jobManager.clearObjective(player);
    player.call('client:farmer:openMenu', [appleCount, APPLE_PRICE]);
});

mp.events.add('server:farmer:sell', async (player, amount) => {
    if (player.activeJobId !== JOB_KEY) return;
    amount = parseInt(amount);
    if (amount <= 0) return;

    const appleItems = player.inventory.filter(i => i.itemId === 'apple');
    let totalApples = appleItems.reduce((acc, i) => acc + i.count, 0);

    if (totalApples < amount) return;

    let remaining = amount;
    const removalPromises = [];
    
    for (const item of appleItems) {
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

    const money = amount * APPLE_PRICE;
    const xp = Math.ceil(amount * 0.5); 
    await playerManager.addMoneyAndSave(player, money, 'Apple Sales');
    await jobManager.addJobXp(player, JOB_KEY, xp);
    player.call('showNotification', ['Seller', `Sold ${amount} apples for $${money}.`]);
    inventory.syncClient(player);
});

// --- INITIALIZATION ---
jobManager.register(JOB_KEY, {
    name: 'Farmer',
    description: "Work in the fields harvesting crops, planting seeds, or taking care of farm animals.",
    previewButtons: [
        { label: "Apple Collector", action: "apple" },
        { label: "Crop Planter", action: "crop" }, 
        { label: "Animal Keeper", action: "animal" }
    ],
    pedModel: 'a_m_m_farmer_01', 
    pos: JOB_NPC,
    blipSprite: 210, 
    blipColor: 25,
}, logic);

// Create Tree Interactions
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
    const model = level > 20 ? 'bodhi2' : 'warrener2'; 
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