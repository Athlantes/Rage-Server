const db = require('../../core/database');
const zones = require('../../zones/index');
const jobManager = require('../jobManager');

// --- CONFIGURATION ---
const JOB_LEVEL_REQ = 10;
const TREE_COOLDOWN = 30 * 60 * 1000; // 30 Minutes

// COORDINATES FOR EXISTING MAP TREES
// Go in-game, stand next to a tree, type /save tree, and copy the coords here.
const EXISTING_TREES = [
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

const CROP_TYPES = {
    'tomato': { name: "Tomato", time: 10, object: 'prop_veg_crop_04_leaf', price: 15 },
    'pumpkin': { name: "Pumpkin", time: 20, object: 'prop_veg_crop_03_pump', price: 30 }
};

let activeCrops = [];

// --- INIT ---
async function initFarmerJob() {
    console.log("[Farmer] Initializing Real-Map Integration...");

    // 1. CREATE THE GENERIC JOB BLIP & JOB UNLOCK
    // This places the Blip on the map
    jobManager.register('farmer', {
        name: "Farmer",
        pos: { x: 2446.0, y: 4975.0, z: 46.5, h: 45 }, // Main Farm House
        pedModel: 's_m_m_gardener_01', 
        blipSprite: 88, // Farm icon
        blipColor: 25,  // Earthy color
        onStart: (player) => {
            if (player.data.level < JOB_LEVEL_REQ) {
                player.notify(`~r~You need Level ${JOB_LEVEL_REQ} to work here.`);
                return jobManager.stopJob(player);
            }
            // Give Uniform
            player.setClothes(11, 120, 0, 0); 
            player.setClothes(4, 98, 0, 0);
            player.notify("~g~You are now a Farmer. Talk to the section managers.");
        }
    }, {}); // Passing empty object {} as options

    // 2. SPAWN THE 3 SUB-NPCS (No Blips)
    
    // NPC A: Orchard Keeper (Near the trees)
    spawnWorkerNPC('s_m_m_migrant_01', 2395.16, 4983.64, 45.33, -155.93, "Orchard Keeper", "Sell Apples");
    
    // NPC B: Animal Handler (Near the barns)
    spawnWorkerNPC('a_c_cow', 2441.0, 4755.0, 34.0, 45, "Head Cow", "Moo?"); // Just a joke placeholder, swap for a human model if needed
    spawnWorkerNPC('s_m_m_countrybar_01', 2416.11, 4993.71, 46.23, 134.87, "Animal Handler", "Manage Livestock");

    // NPC C: Field Manager (Near the fields)
    spawnWorkerNPC('s_m_y_airworker', 2435.55, 4975.88, 46.57, 47.72, "Field Manager", "Crop Info");

    // 3. SETUP EXISTING TREES (Invisible Interactions)
    EXISTING_TREES.forEach(tree => {
        // We do NOT spawn an object. We just put the interaction point.
        createInteractionPoint(tree.x, tree.y, tree.z, "Apple Tree", `server:farmer:tree`, tree.id);
    });

    // 4. LOAD CROPS FROM DB
    const [rows] = await db.query("SELECT * FROM player_crops");
    rows.forEach(spawnCropVisual);
}
initFarmerJob();

// --- HELPER FUNCTIONS ---

function spawnWorkerNPC(model, x, y, z, h, name, interactionText) {
    const ped = mp.peds.new(mp.joaat(model), new mp.Vector3(x, y, z), {
        heading: h,
        dynamic: false,
        invincible: true
    });
    
    // Create text label above head (optional)
    mp.labels.new(name, new mp.Vector3(x, y, z + 2.0), { los: true, font: 4, drawDistance: 10 });

    // Interaction point
    createInteractionPoint(x, y, z, name, 'server:farmer:npcTalk', name); 
}

function createInteractionPoint(x, y, z, label, eventName, dataStr) {
    const shape = mp.colshapes.newTube(x, y, z, 2.0, 2.0);
    shape.setVariable('interaction', {
        title: label,
        text: "Press E",
        event: eventName,
        data: dataStr
    });
}

function spawnCropVisual(cropData) {
    const model = CROP_TYPES[cropData.type].object;
    const obj = mp.objects.new(mp.joaat(model), new mp.Vector3(cropData.x, cropData.y, cropData.z - 1.0), {
        rotation: new mp.Vector3(0, 0, Math.random() * 360)
    });
    cropData.objectHandle = obj;
    activeCrops.push(cropData);
}

// --- EVENTS ---

mp.events.add('server:farmer:tree', async (player, treeId) => {
    // 1. Check Job
    if (player.activeJobId !== 'farmer') return player.notify("~r~Farmers only.");

    // 2. Check Cooldown
    const [rows] = await db.query("SELECT last_action FROM player_farm_cooldowns WHERE user_id = ? AND object_id = ?", [player.data.dbId, treeId]);
    if (rows.length > 0) {
        const diff = Date.now() - rows[0].last_action;
        if (diff < TREE_COOLDOWN) return player.notify("~y~Tree empty.");
    }

    // 3. Animation & Reward
    player.playAnimation('amb@prop_human_movie_bulb@idle_a', 'idle_a', 1, 47);
    setTimeout(async () => {
        player.stopAnimation();
        // Give Apples (Add to your inventory logic)
        // inventory.giveItem(player, 'apple', 3);
        player.notify("~g~Collected Apples.");

        // Set Cooldown
        await db.query(`INSERT INTO player_farm_cooldowns (user_id, object_id, last_action) VALUES (?, ?, ?) 
            ON DUPLICATE KEY UPDATE last_action = VALUES(last_action)`, 
            [player.data.dbId, treeId, Date.now()]
        );
    }, 4000);
});

// Event for talking to the specific NPCs
mp.events.add('server:farmer:npcTalk', (player, npcName) => {
    if (npcName === "Orchard Keeper") {
        player.notify("~b~Keeper: ~w~Go find the ripe trees. I buy apples for $2 each.");
        // Open a selling menu here if you want
    }
    else if (npcName === "Animal Handler") {
        player.notify("~b~Handler: ~w~Bring me grain sacks to feed the cows.");
    }
    else if (npcName === "Field Manager") {
        player.notify("~b~Manager: ~w~Plant seeds in the designated zones.");
    }
});