// packages/jobs/definitions/farmer.js
const jobManager = require('../jobManager');
const inventory = require('../../systems/inventory');
const playerManager = require('../../core/playerManager');

// --- CONFIGURATION ---
const JOB_KEY = 'farmer';
const JOB_REQUIREMENT_LEVEL = 1; 
const APPLE_PRICE = 4; // Price per apple
const TREE_COOLDOWN_MS = 60 * 1000; // 1 Minute refresh rate

// Locations
const JOB_NPC = { x: 2395.16, y: 4983.64, z: 45.33, h: -155.93 };
const SELLER_NPC = { x: 1960.07, y: 3739.94, z: 32.34, h: -50.14 };
const GARAGE_POS = { x: 2415.52, y: 4993.02, z: 46.22 }; 
const VEHICLE_SPAWN = { x: 2411.58, y: 4988.95, z: 45.43, h: 133.84 };
const ORCHARD_CENTER = { x: 2361.55, y: 4975.87, z: 43.23 }; 

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

// --- JOB LOGIC ---
const logic = {
    onInteract: (player) => {
        // 1. Check Level
        const level = jobManager.getJobLevel(player, JOB_KEY);
        if (level < JOB_REQUIREMENT_LEVEL) {
            return player.call('showNotification', ['Job Center', `You need Level ${JOB_REQUIREMENT_LEVEL} Farming.`]);
        }

        // 2. Start Job Session
        jobManager.startJobSession(player, JOB_KEY);
        
        // 3. Initialize Data
        activeJobs.set(player.id, {
            cooldowns: {},
            vehicle: null,
            collected: 0
        });

        // 4. Step 1: Go to Garage
        setObjectiveGarage(player);
    },
    
    onStop: (player) => {
        const data = activeJobs.get(player.id);
        if (data && data.vehicle && mp.vehicles.exists(data.vehicle)) {
            data.vehicle.destroy();
        }
        activeJobs.delete(player.id);
        jobManager.clearObjective(player);
    }
};

// --- OBJECTIVES ---

function setObjectiveGarage(player) {
    player.call('showNotification', ['Farmer', 'Go to the Garage to get your tractor.']);
    
    // Uses jobManager to create the yellow marker/blip automatically
    jobManager.createObjective(player, GARAGE_POS, "Farm Garage", 2.0, (p) => {
        // Callback when they enter the marker
        if (p.vehicle) return p.call('showNotification', ['Farmer', 'Exit your vehicle first.']);
        spawnTractor(p);
    });
}

function spawnTractor(player) {
    const data = activeJobs.get(player.id);
    if (!data) return;

    // Remove garage objective
    jobManager.clearObjective(player);

    if (data.vehicle && mp.vehicles.exists(data.vehicle)) data.vehicle.destroy();

    // Determine Vehicle based on Level
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

    // Warp in
    setTimeout(() => {
        if (mp.players.exists(player) && mp.vehicles.exists(data.vehicle)) {
            player.call('client:warpIntoVehicle', [data.vehicle.id, -1]);
        }
    }, 200);

    player.call('showNotification', ['Farmer', 'Go to the fields and collect Apples!']);
    
    // Point to the Orchard
    jobManager.createObjective(player, ORCHARD_CENTER, "Apple Orchard", 10.0, (p) => {
        // Just a visual guide, clears when they arrive
        jobManager.clearObjective(p);
        p.call('showNotification', ['Farmer', 'Walk up to trees and press E.']);
    }, { blipSprite: 1, markerColor: [0, 255, 0, 100] });
}

function checkInventoryStatus(player) {
    // If inventory is full (or high amount), suggest selling
    let appleCount = 0;
    if (player.inventory) {
        player.inventory.forEach(item => { if (item.itemId === 'apple') appleCount += item.count; });
    }

    if (appleCount >= 60) {
        player.call('showNotification', ['Farmer', 'Your basket is getting full. Go sell them!']);
        // Create Seller Objective
        jobManager.createObjective(player, SELLER_NPC, "Apple Wholesaler", 3.0, null, {
            blipSprite: 605, blipColor: 1
        });
    }
}

// --- TREE INTERACTION ---
mp.events.add('server:farmer:collect', async (player, treeIndex) => {
    if (player.activeJobId !== JOB_KEY) return player.call('showNotification', ['Farmer', 'You are not on the clock.']);
    
    const data = activeJobs.get(player.id);
    if (!data) return;

    const now = Date.now();
    const lastPick = data.cooldowns[treeIndex] || 0;
    if (now - lastPick < TREE_COOLDOWN_MS) {
        return player.call('showNotification', ['Farmer', 'This tree is empty.']);
    }

    // Freeze & Animate
    player.call('client:freezePlayer', [true]);
    player.playAnimation('amb@prop_human_movie_bulb@idle_a', 'idle_a', 1, 47);

    setTimeout(async () => {
        if (!mp.players.exists(player)) return;
        player.stopAnimation();
        player.call('client:freezePlayer', [false]);

        // Inventory Check
        const amount = Math.floor(Math.random() * 3) + 2; // 2-4 Apples
        if (await inventory.addItem(player, 'apple', amount)) {
            data.cooldowns[treeIndex] = Date.now();
            player.call('showNotification', ['Farmer', `Collected ${amount} Apples.`]);
            
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
    
    // Clear objective if they are here
    jobManager.clearObjective(player);
    player.call('client:farmer:openMenu', [appleCount, APPLE_PRICE]);
});

mp.events.add('server:farmer:sell', async (player, amount) => {
    amount = parseInt(amount);
    if (amount <= 0) return;

    const appleItems = player.inventory.filter(i => i.itemId === 'apple');
    let totalApples = appleItems.reduce((acc, i) => acc + i.count, 0);

    if (totalApples < amount) return;

    // Remove Items
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
            // Assuming your inventory system has update, if not we query DB directly
            // For now using inventory.removeItem logic as base, but complex splits might need custom logic
            // Re-using the logic from your old file for safety:
             removalPromises.push(require('../../core/database').query('UPDATE character_inventory SET count = ? WHERE id = ?', [item.count, item.id]));
        }
    }
    await Promise.all(removalPromises);

    // Reward
    const money = amount * APPLE_PRICE;
    const xp = Math.ceil(amount * 0.5); // 0.5 XP per apple

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

// Seller Static Ped
mp.peds.new(mp.joaat('cs_old_man2'), new mp.Vector3(SELLER_NPC.x, SELLER_NPC.y, SELLER_NPC.z), {
    heading: SELLER_NPC.h, dynamic: false, invincible: true, frozen: true
});
mp.blips.new(605, new mp.Vector3(SELLER_NPC.x, SELLER_NPC.y, SELLER_NPC.z), {
    name: 'Apple Wholesaler', color: 1, shortRange: true, scale: 0.8
});