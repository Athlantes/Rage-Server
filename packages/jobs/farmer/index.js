const db = require('../../core/database');
const inventory = require('../../systems/inventory');
const zones = require('../../zones/index');
const jobManager = require('../jobManager');

// --- CONFIGURATION ---
const JOB_LEVEL_REQ = 10;
const TREE_COOLDOWN = 30 * 60 * 1000; // 30 Minutes
const JOB_BLIP_COORDS = new mp.Vector3(2415.25, 4977.49, 46.23);

// --- COORDINATES ---
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

// --- HELPER: CUSTOM CHAT ---
function sendChat(player, message) {
    if(!player || !mp.players.exists(player)) return;
    player.outputChatBox(message);
    if ('call' in player) player.call('chat:push', [message]);
}

// --- INITIALIZATION ---
async function initFarmerJob() {
    console.log("[Farmer] Initializing Grapeseed Farm...");

    // 1. CREATE MAIN JOB BLIP
    mp.blips.new(88, JOB_BLIP_COORDS, {
        name: "Farmer Job",
        color: 25, 
        shortRange: true,
        scale: 1.0,
        dimension: 0
    });

    // 2. SPAWN WORKER NPCs
    spawnWorkerNPC('s_m_m_migrant_01', 2395.16, 4983.64, 45.33, -155.93, "Orchard Keeper", "Sell Apples");
    spawnWorkerNPC('s_m_m_countrybar_01', 2416.11, 4993.71, 46.23, 134.87, "Animal Handler", "Manage Livestock");
    spawnWorkerNPC('s_m_y_airworker', 2435.55, 4975.88, 46.57, 47.72, "Field Manager", "Crop Info");

    // 3. SETUP TREES
    EXISTING_TREES.forEach(tree => {
        createInteractionPoint(tree.x, tree.y, tree.z, "Apple Tree", `server:farmer:treeInteract`, tree.id);
    });

    // 4. LOAD CROPS (Crops persist, Job does not)
    try {
        const [rows] = await db.query("SELECT * FROM player_crops");
        if(rows) rows.forEach(spawnCropVisual);
    } catch (e) { console.log("[Farmer] DB Error: " + e); }
}

// --- FUNCTIONS ---
function spawnWorkerNPC(model, x, y, z, h, name, jobPart) {
    const ped = mp.peds.new(mp.joaat(model), new mp.Vector3(x, y, z), {
        heading: h,
        dynamic: false,
        frozen: true,
        invincible: true,
        dimension: 0
    });
    
    mp.labels.new(`${name}\n~y~${jobPart}`, new mp.Vector3(x, y, z + 2.0), { 
        los: true, font: 4, drawDistance: 10, dimension: 0 
    });

    createInteractionPoint(x, y, z, name, 'server:farmer:npcTalk', name);
}

function createInteractionPoint(x, y, z, label, eventName, dataStr) {
    const shape = mp.colshapes.newTube(x, y, z, 1.5, 2.0, 0);
    shape.setVariable('interaction', {
        title: label,
        text: "Press E",
        key: 69, 
        event: eventName,
        data: dataStr
    });
}

function spawnCropVisual(cropData) {
    if (!CROP_TYPES[cropData.type]) return;
    const model = CROP_TYPES[cropData.type].object;
    const obj = mp.objects.new(mp.joaat(model), new mp.Vector3(cropData.x, cropData.y, cropData.z - 1.0), {
        rotation: new mp.Vector3(0, 0, Math.random() * 360),
        dimension: 0
    });
    cropData.objectHandle = obj;
    activeCrops.push(cropData);
}

// --- EVENTS ---

mp.events.add('server:farmer:npcTalk', (player, npcName) => {
    // 1. Level Check
    if (player.data.level < JOB_LEVEL_REQ) {
        return player.notify(`~r~You need Level ${JOB_LEVEL_REQ} for this work.`);
    }

    // 2. Assign Temporary Job (RAM only)
    if (player.data.job !== 'farmer') {
        player.data.job = 'farmer'; // Sets it for this session only
        
        sendChat(player, "!{#00FF00}[Farm] !{#FFFFFF}You signed in. This job resets when the city sleeps.");
        player.notify("~g~You are now a Farmer!");
    }

    // 3. Dialogue
    if (npcName === "Orchard Keeper") {
        sendChat(player, "!{#FFFF00}[Keeper] !{#FFFFFF}Go to the trees behind me. Pick apples, but don't overharvest!");
    } 
    else if (npcName === "Animal Handler") {
        sendChat(player, "!{#FFFF00}[Handler] !{#FFFFFF}The cows are hungry. Grab sacks from the barn.");
    }
    else if (npcName === "Field Manager") {
        sendChat(player, "!{#FFFF00}[Manager] !{#FFFFFF}Plant seeds in the marked fields. I'll text you when they grow.");
    }
});

mp.events.add('server:farmer:treeInteract', async (player, treeId) => {
    // Security Check
    if (player.data.job !== 'farmer') return player.notify("~r~You must sign in with the Orchard Keeper first.");

    try {
        // A. Check Cooldown (Keep DB for this so they can't relog to reset trees)
        const [rows] = await db.query("SELECT last_action FROM player_farm_cooldowns WHERE user_id = ? AND object_id = ?", [player.data.dbId, treeId]);
        
        if (rows.length > 0) {
            const diff = Date.now() - rows[0].last_action;
            if (diff < TREE_COOLDOWN) {
                const minLeft = Math.ceil((TREE_COOLDOWN - diff) / 60000);
                return player.notify(`~y~Tree is empty. Ready in ${minLeft} min.`);
            }
        }

        // B. Animation
        player.playAnimation('amb@prop_human_movie_bulb@idle_a', 'idle_a', 1, 47);
        player.notify("~g~Harvesting...");

        // C. Give Item
        setTimeout(async () => {
            if (!mp.players.exists(player)) return;
            player.stopAnimation();

            const amount = Math.floor(Math.random() * 3) + 1;
            const success = await inventory.addItem(player, 'apple', amount); // Fixed function call

            if (success) {
                player.notify(`~g~+${amount} Apples`);
                sendChat(player, `!{#00FF00}[Farm] !{#FFFFFF}You collected ${amount} apples.`);
                
                await db.query(`INSERT INTO player_farm_cooldowns (user_id, object_id, last_action) VALUES (?, ?, ?) 
                    ON DUPLICATE KEY UPDATE last_action = VALUES(last_action)`, 
                    [player.data.dbId, treeId, Date.now()]
                );
            } else {
                player.notify("~r~Inventory Full!");
            }
        }, 4000);

    } catch (err) {
        console.error(err);
        player.notify("~r~Server Error");
    }
});

initFarmerJob();
module.exports = { initFarmerJob };