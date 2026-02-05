// packages/jobs/definitions/farmer.js
const jobManager = require('../jobManager');
const inventory = require('../../systems/inventory');
const playerManager = require('../../core/playerManager');
const db = require('../../core/database');

// --- CONFIGURATION ---
const JOB_KEY = 'farmer';
const JOB_REQUIREMENT_LEVEL = 10;
const APPLE_PRICE = 2;
const TREE_COOLDOWN_MS = 30 * 60 * 1000; // 30 Minutes

const JOB_NPC = { x: 2395.16, y: 4983.64, z: 45.33, h: -155.93 };
const SELLER_NPC = { x: 1960.07, y: 3739.94, z: 32.34, h: -50.14 };

// Vehicle Config
const VEHICLE_INTERACTION_POS = { x: 2415.52, y: 4993.02, z: 46.22 };
const VEHICLE_SPAWN_POS = { x: 2411.58, y: 4988.95, z: 45.43, h: 133.84 };
const VEHICLE_MODEL = 'warrener2';

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

// --- JOB DEFINITION ---
const logic = {
    onInteract: (player) => {
        if (player.data.level < JOB_REQUIREMENT_LEVEL) {
            return player.call('showNotification', ['Job Center', `You must be Level ${JOB_REQUIREMENT_LEVEL} to work as a Farmer.`]);
        }

        if (player.activeJobId === JOB_KEY) {
            jobManager.stopJob(player, "You clocked out from the Farm.");
        } else {
            if (player.activeJobId) {
                return player.call('showNotification', ['Job Center', 'Please quit your current job first.']);
            }
            jobManager.startJobSession(player, JOB_KEY);
            player.call('showNotification', ['Farmer', 'Go to the trees and collect apples.']);
            
            // Show vehicle marker
            player.call('client:farmer:toggleJob', [true, VEHICLE_INTERACTION_POS]);
        }
    },
    onStop: (player) => {
        // Hide vehicle marker
        player.call('client:farmer:toggleJob', [false]);

        // Cleanup Vehicle
        if (player.farmerVehicle && mp.vehicles.exists(player.farmerVehicle)) {
            player.farmerVehicle.destroy();
            player.farmerVehicle = null;
        }
    }
};

jobManager.register(JOB_KEY, {
    name: 'Farmer',
    pedModel: 'a_m_m_farmer_01', 
    pos: JOB_NPC,
    blipSprite: 496, 
    blipColor: 25,
}, logic);

// --- PERSISTENCE HELPERS ---
async function loadFarmerData(player) {
    player.farmerData = { cooldowns: {} };
    if (!player.data.dbId) return;

    try {
        const [rows] = await db.query('SELECT data FROM character_job_data WHERE character_id = ? AND job_key = ?', [player.data.dbId, JOB_KEY]);
        if (rows.length > 0 && rows[0].data) {
            player.farmerData = JSON.parse(rows[0].data);
        }
    } catch (err) { console.error(`[Farmer] Error loading data:`, err); }
}

async function saveFarmerData(player) {
    if (!player.data.dbId || !player.farmerData) return;
    try {
        await db.query(`
            INSERT INTO character_job_data (character_id, job_key, data) VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE data = VALUES(data)
        `, [player.data.dbId, JOB_KEY, JSON.stringify(player.farmerData)]);
    } catch (err) { console.error(`[Farmer] Error saving data:`, err); }
}

// --- INITIALIZATION ---
TREES.forEach((tree, index) => {
    const col = mp.colshapes.newSphere(tree.x, tree.y, tree.z, 2.0);
    col.setVariable('interaction', {
        title: 'Apple Tree', text: 'Press E to Collect', event: 'server:farmer:collect', data: index, requireOnFoot: true
    });
});

const sellerCol = mp.colshapes.newSphere(SELLER_NPC.x, SELLER_NPC.y, SELLER_NPC.z, 2.0);
sellerCol.setVariable('interaction', {
    title: 'Apple Seller', text: 'Press E to Sell Apples', event: 'server:farmer:openSeller', requireOnFoot: true
});

mp.peds.new(mp.joaat('cs_old_man2'), new mp.Vector3(SELLER_NPC.x, SELLER_NPC.y, SELLER_NPC.z), {
    heading: SELLER_NPC.h, dynamic: false, invincible: true, frozen: true
});

mp.blips.new(605, new mp.Vector3(SELLER_NPC.x, SELLER_NPC.y, SELLER_NPC.z), {
    name: 'Apple Wholesaler', color: 1, shortRange: true, scale: 0.8
});

// Vehicle Interaction Point
const vehCol = mp.colshapes.newSphere(VEHICLE_INTERACTION_POS.x, VEHICLE_INTERACTION_POS.y, VEHICLE_INTERACTION_POS.z, 1.5);
vehCol.setVariable('interaction', {
    title: 'Farm Garage', text: 'Press E to Spawn Vehicle', event: 'server:farmer:spawnVehicle', requireOnFoot: true
});

// --- EVENTS ---
mp.events.add('server:loadAccount', async (player) => { await loadFarmerData(player); });

mp.events.add('server:farmer:collect', async (player, treeIndex) => {
    if (player.activeJobId !== JOB_KEY) return player.call('showNotification', ['Farmer', 'You must be employed as a Farmer.']);
    if (!player.farmerData) player.farmerData = { cooldowns: {} };

    const now = Date.now();
    const lastPick = player.farmerData.cooldowns[treeIndex] || 0;
    const diff = now - lastPick;

    if (diff < TREE_COOLDOWN_MS) {
        const minutesLeft = Math.ceil((TREE_COOLDOWN_MS - diff) / 60000);
        return player.call('showNotification', ['Farmer', `This tree needs time to regrow (${minutesLeft}m).`]);
    }

    player.playAnimation('amb@prop_human_movie_bulb@idle_a', 'idle_a', 1, 47);
    player.call('client:freezePlayer', [true]);

    setTimeout(async () => {
        if (!mp.players.exists(player)) return;
        player.stopAnimation();
        player.call('client:freezePlayer', [false]);

        if ((Date.now() - (player.farmerData.cooldowns[treeIndex] || 0)) < TREE_COOLDOWN_MS) return;

        const amount = Math.floor(Math.random() * (6 - 2 + 1)) + 2;
        if (await inventory.addItem(player, 'apple', amount)) {
            player.farmerData.cooldowns[treeIndex] = Date.now();
            saveFarmerData(player);
            player.call('showNotification', ['Farmer', `You collected ${amount} Apples.`]);
        } else {
            player.call('showNotification', ['Inventory', 'Inventory full!']);
        }
    }, 3000);
});

mp.events.add('server:farmer:spawnVehicle', (player) => {
    if (player.activeJobId !== JOB_KEY) return player.call('showNotification', ['Farmer', 'Restricted to Farm employees.']);
    
    if (player.farmerVehicle && mp.vehicles.exists(player.farmerVehicle)) {
        return player.call('showNotification', ['Farmer', 'You already have a vehicle out.']);
    }
    
    player.farmerVehicle = mp.vehicles.new(mp.joaat(VEHICLE_MODEL), new mp.Vector3(VEHICLE_SPAWN_POS.x, VEHICLE_SPAWN_POS.y, VEHICLE_SPAWN_POS.z), {
        heading: VEHICLE_SPAWN_POS.h,
        numberPlate: 'FARMER',
        dimension: player.dimension,
        locked: false,
        engine: false
    });
    player.farmerVehicle.setVariable('engine', false);
    player.farmerVehicle.setVariable('fuel', 100.0);
    player.farmerVehicle.jobOwner = player.id;
    
    // FIX: Using client-side warp for reliability (Seat -1 is Driver)
    setTimeout(() => {
        if(mp.players.exists(player) && mp.vehicles.exists(player.farmerVehicle)) {
             player.call('client:warpIntoVehicle', [player.farmerVehicle.id, -1]);
        }
    }, 250); // Increased delay slightly to ensure vehicle stream-in
    
    player.call('showNotification', ['Farmer', 'Vehicle spawned. Do not abandon it.']);
});

mp.events.add('server:farmer:openSeller', (player) => {
    let appleCount = 0;
    if (player.inventory) {
        player.inventory.forEach(item => { if (item.itemId === 'apple') appleCount += item.count; });
    }
    if (appleCount === 0) return player.call('showNotification', ['Seller', "You don't have any apples to sell."]);
    
    player.call('client:farmer:openMenu', [appleCount, APPLE_PRICE]);
});

mp.events.add('server:farmer:sell', async (player, amountToSell) => {
    amountToSell = parseInt(amountToSell);
    if (amountToSell <= 0) return;

    const appleItems = player.inventory.filter(i => i.itemId === 'apple');
    let totalApples = appleItems.reduce((acc, i) => acc + i.count, 0);

    if (totalApples < amountToSell) return player.call('showNotification', ['Seller', "You don't have enough apples."]);

    let remaining = amountToSell;
    const removalPromises = [];
    appleItems.sort((a, b) => a.count - b.count);

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
    inventory.syncClient(player);
    const earnings = amountToSell * APPLE_PRICE;
    await playerManager.addMoneyAndSave(player, earnings, 'Apple Sales');
    player.call('showNotification', ['Seller', `Sold ${amountToSell} apples for $${earnings}.`]);
});