const db = require('../core/database');
const playerManager = require('../core/playerManager');
const inventory = require('./inventory');
const ItemRegistry = require('../data/items');

// ─── CONFIGURATION ───
const WORKBENCHES = [
    { x: -227.67, y: -1327.65, z: 30.89, h: 95.12 },
    { x: -1146.72, y: -2002.67, z: 13.18, h: 48.86 },
    { x: 737.76, y: -1077.85, z: 22.17, h: -91.26 },
    { x: -345.39, y: -130.90, z: 39.01, h: 70.51 },
    { x: 1188.76, y: 2640.73, z: 38.40, h: -90.48 },
    { x: 101.16, y: 6616.53, z: 32.44, h: 140.58 }
];

const RECIPES = [
    {
        id: 'common_part',
        resultId: 'car_part_common',
        name: 'Common Car Part',
        description: "Basic parts used for entry-level tuning.",
        rarity: 'common',
        inputs: [
            { itemId: 'scrap_metal', count: 5 }
        ],
        cost: 100
    },
    {
        id: 'uncommon_part',
        resultId: 'car_part_uncommon',
        name: 'Uncommon Car Part',
        description: "Improved parts for mid-tier performance upgrades.",
        rarity: 'uncommon',
        inputs: [
            { itemId: 'car_part_common', count: 3 }
        ],
        cost: 500
    },
    {
        id: 'rare_part',
        resultId: 'car_part_rare',
        name: 'Rare Car Part',
        description: "High-performance parts for serious racers.",
        rarity: 'rare',
        inputs: [
            { itemId: 'car_part_uncommon', count: 3 }
        ],
        cost: 1500
    },
    {
        id: 'epic_part',
        resultId: 'car_part_epic',
        name: 'Epic Car Part',
        description: "Professional grade parts. Very hard to come by.",
        rarity: 'epic',
        inputs: [
            { itemId: 'car_part_rare', count: 3 }
        ],
        cost: 5000
    },
    {
        id: 'legendary_part',
        resultId: 'car_part_legendary',
        name: 'Legendary Car Part',
        description: "The pinnacle of automotive engineering.",
        rarity: 'legendary',
        inputs: [
            { itemId: 'car_part_epic', count: 3 }
        ],
        cost: 20000
    }
];

// ─── HELPER FUNCTIONS (Matches Tuning System Logic) ───
function countPlayerItem(player, itemId) {
    if (!player.inventory) return 0;
    return player.inventory
        .filter(i => i.itemId === itemId)
        .reduce((sum, i) => sum + i.count, 0);
}

async function removePlayerItems(player, itemId, amount) {
    if (!player.inventory) return false;
    let remaining = amount;
    // Sort stacks by count ascending to use small stacks first
    const stacks = player.inventory.filter(i => i.itemId === itemId).sort((a, b) => a.count - b.count);

    for (const stack of stacks) {
        if (remaining <= 0) break;
        if (stack.count <= remaining) {
            remaining -= stack.count;
            await db.query('DELETE FROM character_inventory WHERE id = ?', [stack.id]);
            player.inventory = player.inventory.filter(i => i !== stack);
        } else {
            stack.count -= remaining;
            remaining = 0;
            await db.query('UPDATE character_inventory SET count = ? WHERE id = ?', [stack.count, stack.id]);
        }
    }
    inventory.syncClient(player);
    return remaining <= 0;
}

// ─── INIT ───
mp.events.add('packagesLoaded', () => {
    WORKBENCHES.forEach((wb, idx) => {
        // Blip (Gear/Cog icon)
        mp.blips.new(643, new mp.Vector3(wb.x, wb.y, wb.z), {
            name: "Crafting Workbench",
            color: 47, // Orange to match Tuning
            shortRange: true,
            scale: 0.8
        });

        // Marker
        mp.markers.new(1, new mp.Vector3(wb.x, wb.y, wb.z - 1.0), 1.0, {
            color: [255, 165, 0, 150],
            visible: true,
            dimension: 0
        });

        // Colshape
        const colshape = mp.colshapes.newSphere(wb.x, wb.y, wb.z, 2.0);
        colshape.setVariable('interaction', {
            title: 'Workbench',
            text: 'Press E to craft parts',
            event: 'server:crafting:open',
            requireOnFoot: true
        });
    });
    console.log(`[Crafting] ${WORKBENCHES.length} workbenches initialized.`);
});

// ─── EVENTS ───

// Open Menu
mp.events.add('server:crafting:open', (player) => {
    if (!player.logged) return;
    sendCraftingData(player);
});

async function sendCraftingData(player) {
    // Build recipe list with player's current inventory counts attached
    const recipeData = RECIPES.map(r => {
        const inputData = r.inputs.map(input => {
            const def = ItemRegistry[input.itemId];
            return {
                itemId: input.itemId,
                name: def ? def.name : input.itemId,
                count: input.count,
                playerHas: countPlayerItem(player, input.itemId)
            };
        });

        return {
            ...r,
            inputs: inputData,
            canCraft: r.inputs.every(i => countPlayerItem(player, i.itemId) >= i.count) && player.data.money >= r.cost
        };
    });

    const playerInfo = {
        cash: player.data.money || 0
    };

    player.call('client:crafting:open', [JSON.stringify(recipeData), JSON.stringify(playerInfo)]);
}

// Handle Crafting Request
mp.events.add('server:crafting:craft', async (player, recipeId) => {
    if (!player.logged) return;

    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;

    // 1. Validate Cash
    if (player.data.money < recipe.cost) {
        return player.call('showNotification', ['Crafting', `Insufficient funds! Need $${recipe.cost.toLocaleString()}.`]);
    }

    // 2. Validate Items
    for (const input of recipe.inputs) {
        const has = countPlayerItem(player, input.itemId);
        if (has < input.count) {
            const def = ItemRegistry[input.itemId];
            return player.call('showNotification', ['Crafting', `Missing materials: ${def ? def.name : input.itemId}`]);
        }
    }

    // 3. Check Weight / Space (Optional, but good practice)
    const resultDef = ItemRegistry[recipe.resultId];
    if (resultDef) {
        const currentWeight = parseFloat(inventory.getWeight(player));
        if (currentWeight + resultDef.weight > 40.0) {
            return player.call('showNotification', ['Crafting', 'Inventory full!']);
        }
    }

    // 4. Consume Resources
    const moneyOk = await playerManager.removeMoneyAndSave(player, recipe.cost, `Crafting: ${recipe.name}`);
    if (!moneyOk) return player.call('showNotification', ['Crafting', 'Transaction error.']);

    for (const input of recipe.inputs) {
        await removePlayerItems(player, input.itemId, input.count);
    }

    // 5. Give Reward
    await inventory.addItem(player, recipe.resultId, 1);

    player.call('showNotification', ['Crafting', `Crafted ${recipe.name}!`]);
    
    // Refresh UI
    sendCraftingData(player);
});