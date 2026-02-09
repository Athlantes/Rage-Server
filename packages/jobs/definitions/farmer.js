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

// Crop Settings
const CROP_LIMIT_MIN = 50;   
const CROP_LIMIT_MAX = 100;  

// Locations
const JOB_NPC = { x: 2434.66, y: 4976.76, z: 46.57, h: 43.95 };
const SELLER_NPC = { x: 1960.07, y: 3739.94, z: 32.34, h: -50.14 };
const VEHICLE_SPAWN = { x: 2411.58, y: 4988.95, z: 45.43, h: 133.84 };
const GARAGE_POS = { x: 2415.52, y: 4993.02, z: 46.22, h: 134.69 }; 

// Animal Keeper Locations
const SUPPLIES_POS = { x: 2167.0, y: 4995.0, z: 41.3 }; // Barn Shelf (Feed/Buckets)
const MILK_TANK_POS = { x: 2170.5, y: 4992.0, z: 41.3 }; // Barn Tank (Deposit Milk)
const COW_TROUGH = { x: 2172.0, y: 4975.0, z: 41.3 }; // Cow Feeding
const PIG_TROUGH = { x: 2150.0, y: 4995.0, z: 41.3 }; // Pig Feeding
const CHICKEN_CENTER = { x: 2378.54, y: 5053.44, z: 46.44 }; // Chicken Coop
const EGG_CRATE_POS = { x: 2374.5, y: 5051.0, z: 46.4 }; // Deposit Eggs

const COWS = [
    { x: 2176.41, y: 4986.26, z: 41.31, h: -139.70 },
    { x: 2168.50, y: 4979.81, z: 41.30, h: -139.97 },
    { x: 2161.93, y: 4972.65, z: 41.36, h: -140.70 },
    { x: 2154.46, y: 4965.56, z: 41.50, h: -136.00 },
    { x: 2196.79, y: 4968.49, z: 41.38, h: 42.74 },
    { x: 2188.92, y: 4961.02, z: 41.28, h: 48.98 },
    { x: 2178.07, y: 4951.24, z: 41.30, h: 51.69 },
    { x: 2174.46, y: 4947.18, z: 41.34, h: 39.83 },
];

const PIGS = [
    { x: 2165.78, y: 4996.82, z: 41.30, h: 44.35 },
    { x: 2158.07, y: 4989.39, z: 41.33, h: 40.66 },
    { x: 2151.51, y: 4982.47, z: 41.42, h: 39.98 },
    { x: 2144.21, y: 4975.33, z: 41.50, h: 44.65 },
    { x: 2128.30, y: 4991.68, z: 41.46, h: -141.70 },
    { x: 2136.05, y: 4998.37, z: 41.41, h: -136.79 },
    { x: 2142.56, y: 5005.97, z: 41.34, h: -133.91 },
    { x: 2149.99, y: 5013.23, z: 41.38, h: -138.22 },
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

// Wholesaler Configuration
const SELLABLE_ITEMS = {
    'apple': { price: 2, label: "Fresh Apple" },
    'pumpkin': { price: 15, label: "Giant Pumpkin" },
    'cabbage': { price: 10, label: "Green Cabbage" },
};

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

function spawnJobEntities() {
    // 1. Cows
    COWS.forEach((pos, i) => {
        mp.peds.new(mp.joaat('a_c_cow'), new mp.Vector3(pos.x, pos.y, pos.z), {
            heading: pos.h, dynamic: true, invincible: true
        });
        const col = mp.colshapes.newSphere(pos.x, pos.y, pos.z, 1.4);
        col.setVariable('interaction', {
            title: 'Dairy Cow', text: 'Milk', event: 'server:farmer:milkCow', requireOnFoot: true
        });
    });

    // 2. Pigs
    PIGS.forEach(pos => {
        mp.peds.new(mp.joaat('a_c_pig'), new mp.Vector3(pos.x, pos.y, pos.z), {
            heading: pos.h, dynamic: true, invincible: true
        });
    });
    
    // 3. Garage NPC
    mp.peds.new(mp.joaat('cs_old_man2'), new mp.Vector3(GARAGE_POS.x, GARAGE_POS.y, GARAGE_POS.z), {
        heading: GARAGE_POS.h, dynamic: false, invincible: true, frozen: true
    });
    
    // 4. Wholesaler NPC
    mp.peds.new(mp.joaat('s_m_m_migrant_01'), new mp.Vector3(SELLER_NPC.x, SELLER_NPC.y, SELLER_NPC.z), {
        heading: SELLER_NPC.h, dynamic: false, invincible: true, frozen: true
    });
}
spawnJobEntities();

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

// --- JOB MANAGER LOGIC ---

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
        
        // Cleanup Client
        player.call('client:farmer:clearMarkers'); 
        player.call('client:farmer:clearCrops'); 
        player.call('client:farmer:clearFieldBlips');
        player.call('client:farmer:toggleSeller', [false]);
        player.call('client:farmer:clearEggs');
        player.call('client:farmer:detachProp');
        
        // Reset Player Vars
        player.data.animalTask = null;
        player.data.isMilking = false;
        player.setVariable('hasSack', false);
    }
};

// =========================================================================
//                              ANIMAL KEEPER JOB
// =========================================================================

async function startAnimalJob(player) {
    jobManager.startJobSession(player, JOB_KEY);
    activeJobs.set(player.id, { vehicle: null });
    
    player.call('showNotification', ['Farmer', 'Animal Keeper started. Get a vehicle from the garage if needed.']);
    
    // Assign first task after delay
    setTimeout(() => {
        if(player.activeJobId === JOB_KEY) assignAnimalTask(player);
    }, 2000);
}

function assignAnimalTask(player) {
    const tasks = ['feed_cows', 'feed_pigs', 'milk_cows', 'collect_eggs'];
    const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
    
    let taskData = { type: randomTask, stage: 0, count: 0, target: 0, label: "" };

    switch(randomTask) {
        case 'feed_cows':
            taskData.label = "Feed: Cows";
            taskData.target = 1;
            player.call('showNotification', ['Farmer', 'Task: Feed the Cows. Grab a sack from the barn.']);
            createJobMarker(player, SUPPLIES_POS, "Get Feed Sack");
            break;
        case 'feed_pigs':
            taskData.label = "Feed: Pigs";
            taskData.target = 1;
            player.call('showNotification', ['Farmer', 'Task: Feed the Pigs. Grab a sack from the barn.']);
            createJobMarker(player, SUPPLIES_POS, "Get Feed Sack");
            break;
        case 'milk_cows':
            taskData.label = "Milk: 3 Cows";
            taskData.target = 3; 
            player.call('showNotification', ['Farmer', 'Task: Milk 3 Cows. Grab a bucket if needed.']);
            createJobMarker(player, SUPPLIES_POS, "Get Bucket"); 
            break;
        case 'collect_eggs':
            taskData.label = "Collect: 10 Eggs";
            taskData.target = 10;
            player.call('showNotification', ['Farmer', 'Task: Collect 10 Eggs and put them in the crate.']);
            spawnEggsForPlayer(player); 
            createJobMarker(player, CHICKEN_CENTER, "Chicken Coop");
            break;
    }

    player.data.animalTask = taskData;
    updateJobOverlay(player);
}

function updateJobOverlay(player) {
    if (!player.data.animalTask) return;
    const t = player.data.animalTask;
    // Syncs the objective bar on overlay.html
    player.call('updateJobUI', [true, t.label, t.count, t.target, player.data.jobEarnings || 0, null, null, null]);
}

function createJobMarker(player, pos, label) {
    player.call('client:farmer:setWaypoint', [pos.x, pos.y, pos.z, label]);
}

// --- INTERACTION HANDLERS ---

// 1. SUPPLY INTERACTION (Barn Shelf)
mp.events.add('server:farmer:interactSupplies', async (player) => {
    if (player.activeJobId !== JOB_KEY || !player.data.animalTask) return;
    const task = player.data.animalTask;

    // FEEDING TASKS
    if (task.type === 'feed_cows' || task.type === 'feed_pigs') {
        if (task.stage === 0) {
            // Visual: Attach sack
            player.call('client:farmer:attachProp', ['prop_cs_sack_01', 28422]); 
            player.setVariable('hasSack', true);
            
            task.stage = 1;
            player.call('showNotification', ['Farmer', 'You have the feed. Take it to the trough.']);
            
            const dest = (task.type === 'feed_cows') ? COW_TROUGH : PIG_TROUGH;
            createJobMarker(player, dest, "Fill Trough");
        }
    } 
    // MILKING TASK
    else if (task.type === 'milk_cows') {
        // Give bucket if they don't have one
        if (!player.inventory.some(i => i.itemId === 'bucket_empty')) {
             if (await inventory.addItem(player, 'bucket_empty', 1)) {
                player.call('showNotification', ['Farmer', 'Grabbed a bucket. Go milk the cows.']);
                createJobMarker(player, COW_TROUGH, "Milk Cows");
             } else {
                 player.call('showNotification', ['Inventory', 'Full! Cannot take bucket.']);
             }
        } else {
            player.call('showNotification', ['Farmer', 'You already have a bucket.']);
            createJobMarker(player, COW_TROUGH, "Milk Cows");
        }
    }
});

// 2. TROUGH INTERACTION (Pouring Feed)
mp.events.add('server:farmer:interactTrough', (player, type) => {
    if (player.activeJobId !== JOB_KEY || !player.data.animalTask) return;
    const task = player.data.animalTask;
    
    // Validate correct trough
    if ( (type === 'cow' && task.type !== 'feed_cows') || (type === 'pig' && task.type !== 'feed_pigs') ) {
        return player.call('showNotification', ['Farmer', 'Wrong trough!']);
    }

    if (task.stage === 1 && player.getVariable('hasSack')) {
        // FINISH FEEDING TASK
        player.call('client:farmer:detachProp');
        player.setVariable('hasSack', false);
        player.playAnimation('amb@world_human_gardener_plant@male@base', 'base', 1, 33);
        
        task.count = 1;
        updateJobOverlay(player);
        completeTask(player, 250); // Pay $250 for heavy lifting
    } else {
        player.call('showNotification', ['Farmer', 'You need a Feed Sack from the barn first!']);
    }
});

// 3. MILKING LOGIC (Interaction with Cow)
mp.events.add('server:farmer:milkCow', async (player) => {
    if (player.activeJobId !== JOB_KEY) return;
    const task = player.data.animalTask;
    if (!task || task.type !== 'milk_cows') return player.call('showNotification', ['Farmer', 'You do not have a milking task.']);
    
    // Require Empty Bucket
    const bucket = player.inventory.find(i => i.itemId === 'bucket_empty');
    if (!bucket) return player.call('showNotification', ['Farmer', 'You need an Empty Bucket!']);

    if (player.data.isMilking) return;
    player.data.isMilking = true;

    // Start Client Minigame
    player.call('client:farmer:startMilking');
});

mp.events.add('server:farmer:milkSuccess', async (player) => {
    player.data.isMilking = false;
    
    // Swap Empty Bucket for Full Bucket
    const bucket = player.inventory.find(i => i.itemId === 'bucket_empty');
    if (bucket) {
        await inventory.removeItem(player, bucket);
        await inventory.addItem(player, 'bucket_milk', 1);
        
        player.call('showNotification', ['Farmer', 'Bucket full! Pour it in the tank at the barn.']);
        createJobMarker(player, MILK_TANK_POS, "Deposit Milk");
    }
});

// 4. DEPOSIT MILK (Tank Interaction)
mp.events.add('server:farmer:depositMilk', async (player) => {
    if (player.activeJobId !== JOB_KEY) return;
    const task = player.data.animalTask;
    if (!task || task.type !== 'milk_cows') return;

    // Find Milk Buckets
    const milkBuckets = player.inventory.filter(i => i.itemId === 'bucket_milk');
    if (milkBuckets.length === 0) return player.call('showNotification', ['Farmer', 'You have no milk to pour.']);

    player.playAnimation('amb@world_human_gardener_plant@male@base', 'base', 1, 33); // Generic pour anim

    // Take milk, give empty buckets
    let count = 0;
    for (const mb of milkBuckets) {
        await inventory.removeItem(player, mb);
        await inventory.addItem(player, 'bucket_empty', 1);
        count++;
    }

    task.count += count;
    updateJobOverlay(player);
    player.call('showNotification', ['Farmer', `Deposited ${count} buckets.`]);

    if (task.count >= task.target) {
        // Remove empty buckets at end to clean up
        const empties = player.inventory.filter(i => i.itemId === 'bucket_empty');
        for (const eb of empties) await inventory.removeItem(player, eb);
        
        completeTask(player, 350); // Pay $350
    } else {
        player.call('showNotification', ['Farmer', `Need ${task.target - task.count} more.`]);
        createJobMarker(player, COW_TROUGH, "Milk Cows");
    }
});

// 5. EGG LOGIC
function spawnEggsForPlayer(player) {
    const eggs = [];
    for(let i=0; i<15; i++) {
        const offX = (Math.random() * 14) - 7;
        const offY = (Math.random() * 14) - 7;
        // Raise Z slightly to avoid ground clipping (-0.8 instead of -1.0)
        eggs.push({ 
            id: i, x: CHICKEN_CENTER.x + offX, y: CHICKEN_CENTER.y + offY, z: CHICKEN_CENTER.z - 0.8
        });
    }
    player.call('client:farmer:spawnEggs', [JSON.stringify(eggs)]);
}

mp.events.add('server:farmer:collectEgg', async (player, eggId) => {
    if (player.activeJobId !== JOB_KEY) return;
    
    const task = player.data.animalTask;
    if (!task || task.type !== 'collect_eggs') return;

    if (await inventory.addItem(player, 'egg', 1)) {
        // FIXED: Non-looping animation (Flag 0)
        player.playAnimation('random@domestic', 'pickup_low', 1, 0); 
        
        // FIXED: Update UI Progress
        task.count++; 
        updateJobOverlay(player);

        if (task.count >= 10) {
            player.call('showNotification', ['Farmer', 'You have enough eggs. Put them in the crate.']);
            createJobMarker(player, EGG_CRATE_POS, "Deposit Eggs");
            // Clear visual eggs
            player.call('client:farmer:clearEggs');
        }
    } else {
        player.call('showNotification', ['Inventory', 'Inventory Full!']);
    }
});

// 6. DEPOSIT EGGS (Crate Interaction)
mp.events.add('server:farmer:depositEggs', async (player) => {
    if (player.activeJobId !== JOB_KEY) return;
    const task = player.data.animalTask;
    if (!task || task.type !== 'collect_eggs') return;

    const eggs = player.inventory.filter(i => i.itemId === 'egg');
    const totalEggs = eggs.reduce((acc, i) => acc + i.count, 0);

    if (totalEggs === 0) return player.call('showNotification', ['Farmer', 'You have no eggs.']);

    // Remove Eggs
    for (const e of eggs) await inventory.removeItem(player, e);

    task.count += totalEggs; 
    updateJobOverlay(player);
    player.call('showNotification', ['Farmer', `Deposited ${totalEggs} eggs.`]);

    if (task.count >= task.target) {
        player.call('client:farmer:clearEggs');
        completeTask(player, 300); // Pay $300
    }
});

async function completeTask(player, payment) {
    player.call('showNotification', ['Farmer', `Task Complete! Paid $${payment}`]);
    player.call('client:farmer:playSound', ["Hack_Success", "DLC_HEIST_BIOLAB_PREP_HACKING_SOUNDS"]);
    
    await playerManager.addMoneyAndSave(player, payment, 'Farmer Task');
    player.data.jobEarnings = (player.data.jobEarnings || 0) + payment;
    player.data.animalTask = null;
    
    player.call('client:farmer:clearMarkers');
    updateJobOverlay(player);

    // Cooldown
    setTimeout(() => {
        if(player.activeJobId === JOB_KEY) assignAnimalTask(player);
    }, 4000);
}

// =========================================================================
//                              APPLE JOB (Legacy)
// =========================================================================

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

// =========================================================================
//                              CROP JOB (Legacy)
// =========================================================================

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

    if (tooClose) return player.call('showNotification', ['Farmer', 'Too close to your other crops.']);

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
            id: res.insertId, owner: player.data.dbId, item: seedId, 
            fieldId: inField.id, x: player.position.x, y: player.position.y, 
            z: groundZ, h: player.heading, planted: now, ready: readyAt 
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

// --- WHOLESALER ---

mp.events.add('server:farmer:openSeller', (player) => {
    if (player.activeJobId !== JOB_KEY) return player.call('showNotification', ['Farmer', 'You need to be on duty (Farmer).']);
    const clientItems = [];
    const inv = player.inventory;
    Object.keys(SELLABLE_ITEMS).forEach(itemId => {
        const config = SELLABLE_ITEMS[itemId];
        let count = 0;
        inv.forEach(i => { if(i.itemId === itemId) count += i.count; });
        clientItems.push({ id: itemId, label: config.label, price: config.price, count: count });
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

// --- REGISTER JOB ---

jobManager.register(JOB_KEY, {
    name: 'Farmer', description: "Work in the fields.",
    previewButtons: [ { label: "Apple Collector", action: "apple" }, { label: "Crop Planter", action: "crop" }, { label: "Animal Keeper", action: "animal" } ],
    pedModel: 'a_m_m_farmer_01', pos: JOB_NPC, blipSprite: 846, blipColor: 25,
}, logic);

// Interaction Shapes
const sellerCol = mp.colshapes.newSphere(SELLER_NPC.x, SELLER_NPC.y, SELLER_NPC.z, 2.0);
sellerCol.setVariable('interaction', {
    title: 'Farm Wholesaler', text: 'Sell Crops', event: 'server:farmer:openSeller', requireOnFoot: true
});

const garageCol = mp.colshapes.newSphere(GARAGE_POS.x, GARAGE_POS.y, GARAGE_POS.z, 2.0);
garageCol.setVariable('interaction', {
    title: 'Farmer Garage', text: 'Spawn Tractor', event: 'server:farmer:spawnTractor', requireOnFoot: true
});

TREES.forEach((tree, index) => {
    const col = mp.colshapes.newSphere(tree.x, tree.y, tree.z, 2.0);
    col.setVariable('interaction', {
        title: 'Apple Tree', text: 'Press E to Collect', event: 'server:farmer:collect', data: index, requireOnFoot: true
    });
});

// ANIMAL KEEPER COLSHAPES
const suppliesCol = mp.colshapes.newSphere(SUPPLIES_POS.x, SUPPLIES_POS.y, SUPPLIES_POS.z, 2.0);
suppliesCol.setVariable('interaction', {
    title: 'Farm Supplies', text: 'Get Equipment', event: 'server:farmer:interactSupplies', requireOnFoot: true
});

const milkTankCol = mp.colshapes.newSphere(MILK_TANK_POS.x, MILK_TANK_POS.y, MILK_TANK_POS.z, 1.5);
milkTankCol.setVariable('interaction', {
    title: 'Milk Tank', text: 'Deposit Milk', event: 'server:farmer:depositMilk', requireOnFoot: true
});

const eggCrateCol = mp.colshapes.newSphere(EGG_CRATE_POS.x, EGG_CRATE_POS.y, EGG_CRATE_POS.z, 1.5);
eggCrateCol.setVariable('interaction', {
    title: 'Egg Crate', text: 'Deposit Eggs', event: 'server:farmer:depositEggs', requireOnFoot: true
});

const cowTroughCol = mp.colshapes.newSphere(COW_TROUGH.x, COW_TROUGH.y, COW_TROUGH.z, 2.0);
cowTroughCol.setVariable('interaction', {
    title: 'Cow Trough', text: 'Pour Feed', event: 'server:farmer:interactTrough', data: 'cow', requireOnFoot: true
});

const pigTroughCol = mp.colshapes.newSphere(PIG_TROUGH.x, PIG_TROUGH.y, PIG_TROUGH.z, 2.0);
pigTroughCol.setVariable('interaction', {
    title: 'Pig Trough', text: 'Pour Feed', event: 'server:farmer:interactTrough', data: 'pig', requireOnFoot: true
});

mp.events.add('server:farmer:spawnTractor', (player) => {
    if (player.activeJobId !== JOB_KEY) return player.call('showNotification', ['Farmer', 'You are not on the clock.']);
    const data = activeJobs.get(player.id);
    if (!data) return;
    if (data.vehicle && mp.vehicles.exists(data.vehicle)) data.vehicle.destroy();
    
    data.vehicle = mp.vehicles.new(mp.joaat('tractor2'), new mp.Vector3(VEHICLE_SPAWN.x, VEHICLE_SPAWN.y, VEHICLE_SPAWN.z), {
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