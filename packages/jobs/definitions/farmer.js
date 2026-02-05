// packages/jobs/definitions/farmer.js
const jobManager = require('../jobManager');
const inventory = require('../../systems/inventory');
const playerManager = require('../../core/playerManager');
const db = require('../../core/database');

// --- CONFIGURATION ---
const JOB_KEY = 'farmer';
const JOB_REQUIREMENT_LEVEL = 1; 
const APPLE_PRICE = 2; 
const RECOVERY_TIME_MS = 30 * 60 * 1000; // 30 Minutes

// Locations
const JOB_NPC = { x: 2395.16, y: 4983.64, z: 45.33, h: -155.93 };
const SELLER_NPC = { x: 1960.07, y: 3739.94, z: 32.34, h: -50.14 };
const VEHICLE_SPAWN = { x: 2411.58, y: 4988.95, z: 45.43, h: 133.84 };
const GARAGE_POS = { x: 2415.52, y: 4993.02, z: 46.22 }; 
const ORCHARD_CENTER = { x: 2358.96, y: 5009.84, z: 43.34 }; 

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

// --- HELPER: Random Harvest Count ---
const getRandomHarvests = () => Math.floor(Math.random() * 6) + 1; // 1 to 6 harvests

// --- JOB LOGIC ---
const logic = {
    onInteract: async (player) => { 
        // 1. Check Level
        const level = jobManager.getJobLevel(player, JOB_KEY);
        if (level < JOB_REQUIREMENT_LEVEL) {
            return player.call('showNotification', ['Job Center', `You need Level ${JOB_REQUIREMENT_LEVEL} Farming.`]);
        }

        // 2. Start Job Session
        jobManager.startJobSession(player, JOB_KEY);
        
        // 3. Load Tree Data from DB
        const treeStates = {};
        try {
            const [rows] = await db.query('SELECT tree_id, harvests_left, cooldown_expiry FROM character_farm_trees WHERE character_id = ?', [player.data.dbId]);
            rows.forEach(row => {
                treeStates[row.tree_id] = {
                    harvests_left: row.harvests_left,
                    cooldown_expiry: Number(row.cooldown_expiry) 
                };
            });
        } catch (err) {
            console.error(`[FARMER] Failed to load tree data for ${player.name}:`, err);
        }

        // 4. Initialize Data
        activeJobs.set(player.id, {
            vehicle: null,
            treeStates: treeStates 
        });

        // 5. Sync Visual Markers (NEW)
        syncTreeMarkers(player);

        // 6. Step 1: Go to Garage
        setObjectiveGarage(player);
    },
    
    onStop: (player) => {
        const data = activeJobs.get(player.id);
        if (data && data.vehicle && mp.vehicles.exists(data.vehicle)) {
            data.vehicle.destroy();
        }
        activeJobs.delete(player.id);
        jobManager.clearObjective(player);
        player.call('client:farmer:clearMarkers'); // Clear visual markers
    }
};

// --- OBJECTIVES ---

function setObjectiveGarage(player) {
    player.call('showNotification', ['Farmer', 'Go to the Garage to get your vehicle.']);
    jobManager.createObjective(player, GARAGE_POS, "Farm Garage", 2.0, (p) => {
        if (p.vehicle) return p.call('showNotification', ['Farmer', 'Exit your vehicle first.']);
        spawnTractor(p);
    });
}

function spawnTractor(player) {
    const data = activeJobs.get(player.id);
    if (!data) return;

    jobManager.clearObjective(player);

    if (data.vehicle && mp.vehicles.exists(data.vehicle)) data.vehicle.destroy();

    const level = jobManager.getJobLevel(player, JOB_KEY);
    const model = level > 20 ? 'bodhi2' : 'warrener2'; 

    data.vehicle = mp.vehicles.new(mp.joaat(model), new mp.Vector3(VEHICLE_SPAWN.x, VEHICLE_SPAWN.y, VEHICLE_SPAWN.z), {
        heading: VEHICLE_SPAWN.h,
        numberPlate: 'FARMER',
        dimension: player.dimension,
        locked: false,
        engine: false
    });
    data.vehicle.jobOwner = player.id;
    data.vehicle.setVariable('fuel', 100);

    setTimeout(() => {
        if (mp.players.exists(player) && mp.vehicles.exists(data.vehicle)) {
            player.call('client:warpIntoVehicle', [data.vehicle.id, -1]);
        }
    }, 200);

    player.call('showNotification', ['Farmer', 'Go to the fields and collect Apples!']);
    
    jobManager.createObjective(player, ORCHARD_CENTER, "Apple Orchard", 10.0, (p) => {
        jobManager.clearObjective(p);
        p.call('showNotification', ['Farmer', 'Walk up to trees and press E.']);
    }, { blipSprite: 1, markerColor: [0, 255, 0, 100] });
}

function checkInventoryStatus(player) {
    let appleCount = 0;
    if (player.inventory) {
        player.inventory.forEach(item => { if (item.itemId === 'apple') appleCount += item.count; });
    }

    if (appleCount >= 60) {
        player.call('showNotification', ['Farmer', 'Your basket is getting full. Go sell them!']);
        jobManager.createObjective(player, SELLER_NPC, "Apple Wholesaler", 3.0, null, {
            blipSprite: 605, blipColor: 1
        });
    }
}

// --- HELPER: SYNC MARKERS ---
function syncTreeMarkers(player) {
    const data = activeJobs.get(player.id);
    if (!data) return;

    const validTrees = [];
    const now = Date.now();

    TREES.forEach(tree => {
        const state = data.treeStates[tree.id];
        
        // A tree is available if:
        // 1. It has no state (never picked)
        // 2. OR state exists but Cooldown is expired (it will reset on next interact)
        // 3. OR state exists and Harvests are > 0
        
        let isAvailable = true;
        if (state) {
            // It is NOT available ONLY if it is empty AND cooldown is active
            if (state.harvests_left <= 0 && state.cooldown_expiry > now) {
                isAvailable = false;
            }
        }

        if (isAvailable) {
            validTrees.push({ x: tree.x, y: tree.y, z: tree.z });
        }
    });

    player.call('client:farmer:updateMarkers', [JSON.stringify(validTrees)]);
}

// --- TREE INTERACTION ---
mp.events.add('server:farmer:collect', async (player, treeIndex) => {
    if (player.activeJobId !== JOB_KEY) return player.call('showNotification', ['Farmer', 'You are not on the clock.']);
    
    const data = activeJobs.get(player.id);
    if (!data || !data.treeStates) return;

    const treeInfo = TREES[treeIndex];
    if (!treeInfo) return;
    const treeId = treeInfo.id;

    // Get or Init Tree State
    let state = data.treeStates[treeId];
    if (!state) {
        state = { harvests_left: getRandomHarvests(), cooldown_expiry: 0 };
        data.treeStates[treeId] = state;
    }

    const now = Date.now();
    let requiresSync = false;

    // Logic: Check Cooldown
    if (state.cooldown_expiry > now) {
        const minsLeft = Math.ceil((state.cooldown_expiry - now) / 60000);
        return player.call('showNotification', ['Farmer', `This tree is recovering. Available in ${minsLeft} mins.`]);
    }

    // Logic: Reset if cooldown finished
    if (state.harvests_left <= 0 && state.cooldown_expiry <= now) {
        state.harvests_left = getRandomHarvests();
        state.cooldown_expiry = 0;
        requiresSync = true; // Tree came back online, show marker
    }

    // Freeze & Animate
    player.call('client:freezePlayer', [true]);
    player.playAnimation('amb@prop_human_movie_bulb@idle_a', 'idle_a', 1, 47);

    setTimeout(async () => {
        if (!mp.players.exists(player)) return;
        player.stopAnimation();
        player.call('client:freezePlayer', [false]);

        // Inventory Check
        const amount = 1; 
        if (await inventory.addItem(player, 'apple', amount)) {
            
            state.harvests_left--;

            if (state.harvests_left <= 0) {
                // Depleted -> Set Cooldown
                state.cooldown_expiry = Date.now() + RECOVERY_TIME_MS;
                player.call('showNotification', ['Farmer', `Collected Apple.`]);
                player.call('showNotification', ['Farmer', `Tree depleted. Recovering...`]);
                requiresSync = true; // Tree died, remove marker
            } else {
                player.call('showNotification', ['Farmer', `Collected Apple.`]);
            }

            // Save to DB
            try {
                await db.query(`
                    INSERT INTO character_farm_trees (character_id, tree_id, harvests_left, cooldown_expiry) 
                    VALUES (?, ?, ?, ?) 
                    ON DUPLICATE KEY UPDATE harvests_left = VALUES(harvests_left), cooldown_expiry = VALUES(cooldown_expiry)
                `, [player.data.dbId, treeId, state.harvests_left, state.cooldown_expiry]);
            } catch(e) { console.error(e); }

            // Sync visual markers if status changed
            if (requiresSync) syncTreeMarkers(player);

            // Give XP
            await jobManager.addJobXp(player, JOB_KEY, 1);
            checkInventoryStatus(player);

        } else {
            player.call('showNotification', ['Inventory', 'Inventory Full! Go sell your apples.']);
            jobManager.createObjective(player, SELLER_NPC, "Apple Wholesaler", 3.0, null);
        }
    }, 4000);
});

// --- SELLER INTERACTION ---
mp.events.add('server:farmer:openSeller', (player) => {
    let appleCount = 0;
    if (player.inventory) {
        player.inventory.forEach(item => { if (item.itemId === 'apple') appleCount += item.count; });
    }
    
    if (appleCount === 0) return player.call('showNotification', ['Seller', "You don't have any apples."]);
    
    jobManager.clearObjective(player);
    player.call('client:farmer:openMenu', [appleCount, APPLE_PRICE]);
});

mp.events.add('server:farmer:sell', async (player, amount) => {
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
    player.call('client:showJobSubtitle', [`+$${money} | +${xp} XP`]);
    inventory.syncClient(player);
});

// --- INITIALIZATION ---
jobManager.register(JOB_KEY, {
    name: 'Farmer',
    pedModel: 'a_m_m_farmer_01', 
    pos: JOB_NPC,
    blipSprite: 496, 
    blipColor: 25,
}, logic);

// Create Tree Interactions
TREES.forEach((tree, index) => {
    const col = mp.colshapes.newSphere(tree.x, tree.y, tree.z, 2.0);
    col.setVariable('interaction', {
        title: 'Apple Tree', 
        text: 'Press E to Collect', 
        event: 'server:farmer:collect', 
        data: index, 
        requireOnFoot: true
    });
});

// Create Seller Interaction
const sellerCol = mp.colshapes.newSphere(SELLER_NPC.x, SELLER_NPC.y, SELLER_NPC.z, 2.0);
sellerCol.setVariable('interaction', {
    title: 'Apple Seller', 
    text: 'Press E to Sell', 
    event: 'server:farmer:openSeller', 
    requireOnFoot: true
});

mp.peds.new(mp.joaat('cs_old_man2'), new mp.Vector3(SELLER_NPC.x, SELLER_NPC.y, SELLER_NPC.z), {
    heading: SELLER_NPC.h, dynamic: false, invincible: true, frozen: true
});
mp.blips.new(605, new mp.Vector3(SELLER_NPC.x, SELLER_NPC.y, SELLER_NPC.z), {
    name: 'Apple Wholesaler', color: 1, shortRange: true, scale: 0.8
});