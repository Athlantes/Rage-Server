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
        inputs: [{ itemId: 'scrap_metal', count: 5 }],
        cost: 100,
        baseChance: 90 // 90% Success Rate
    },
    {
        id: 'uncommon_part',
        resultId: 'car_part_uncommon',
        name: 'Uncommon Car Part',
        description: "Improved parts for mid-tier performance upgrades.",
        rarity: 'uncommon',
        inputs: [{ itemId: 'car_part_common', count: 3 }],
        cost: 500,
        baseChance: 75 // 75% Success Rate
    },
    {
        id: 'rare_part',
        resultId: 'car_part_rare',
        name: 'Rare Car Part',
        description: "High-performance parts for serious racers.",
        rarity: 'rare',
        inputs: [{ itemId: 'car_part_uncommon', count: 3 }],
        cost: 1500,
        baseChance: 60
    },
    {
        id: 'epic_part',
        resultId: 'car_part_epic',
        name: 'Epic Car Part',
        description: "Professional grade parts. Very hard to come by.",
        rarity: 'epic',
        inputs: [{ itemId: 'car_part_rare', count: 3 }],
        cost: 5000,
        baseChance: 45
    },
    {
        id: 'legendary_part',
        resultId: 'car_part_legendary',
        name: 'Legendary Car Part',
        description: "The pinnacle of automotive engineering.",
        rarity: 'legendary',
        inputs: [{ itemId: 'car_part_epic', count: 3 }],
        cost: 20000,
        baseChance: 30
    }
];

// ─── HELPER FUNCTIONS ───
function countPlayerItem(player, itemId) {
    if (!player.inventory) return 0;
    return player.inventory
        .filter(i => i.itemId === itemId)
        .reduce((sum, i) => sum + i.count, 0);
}

async function removePlayerItems(player, itemId, amount) {
    if (!player.inventory) return false;
    let remaining = amount;
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
    WORKBENCHES.forEach((wb) => {
        mp.blips.new(643, new mp.Vector3(wb.x, wb.y, wb.z), { name: "Crafting Workbench", color: 47, shortRange: true, scale: 0.8 });
        mp.markers.new(1, new mp.Vector3(wb.x, wb.y, wb.z - 1.0), 1.0, { color: [255, 165, 0, 150], visible: true, dimension: 0 });
        const colshape = mp.colshapes.newSphere(wb.x, wb.y, wb.z, 2.0);
        colshape.setVariable('interaction', { title: 'Workbench', text: 'Press E to craft parts', event: 'server:crafting:open', requireOnFoot: true });
    });
    console.log(`[Crafting] ${WORKBENCHES.length} workbenches initialized.`);
});

// ─── EVENTS ───
mp.events.add('server:crafting:open', (player) => {
    if (!player.logged) return;
    sendCraftingData(player);
});

async function sendCraftingData(player) {
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

        // Boost costs 25% of base price to add 15% chance
        const boostCost = Math.floor(r.cost * 0.25);
        const boostAmount = 15;

        return {
            ...r,
            inputs: inputData,
            boostCost: boostCost,
            boostAmount: boostAmount,
            canCraft: r.inputs.every(i => countPlayerItem(player, i.itemId) >= i.count)
        };
    });

    const playerInfo = { cash: player.data.money || 0 };
    player.call('client:crafting:open', [JSON.stringify(recipeData), JSON.stringify(playerInfo)]);
}

mp.events.add('server:crafting:craft', async (player, recipeId, useBoost) => {
    if (!player.logged) return;

    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;

    // Calculate Costs
    let totalMoneyCost = recipe.cost;
    let chance = recipe.baseChance;

    if (useBoost) {
        const boostCost = Math.floor(recipe.cost * 0.25);
        totalMoneyCost += boostCost;
        chance += 15; // +15% Boost
    }
    if (chance > 100) chance = 100;

    // 1. Validate Resources
    if (player.data.money < totalMoneyCost) {
        return player.call('showNotification', ['Crafting', `Insufficient funds! Need $${totalMoneyCost.toLocaleString()}.`]);
    }

    for (const input of recipe.inputs) {
        if (countPlayerItem(player, input.itemId) < input.count) {
            return player.call('showNotification', ['Crafting', `Missing materials.`]);
        }
    }

    // 2. Consume EVERYTHING first (Risk phase)
    const moneyOk = await playerManager.removeMoneyAndSave(player, totalMoneyCost, `Crafting Attempt: ${recipe.name}`);
    if (!moneyOk) return player.call('showNotification', ['Crafting', 'Transaction error.']);

    for (const input of recipe.inputs) {
        await removePlayerItems(player, input.itemId, input.count);
    }

    // 3. Roll for Success
    const roll = Math.random() * 100;
    const success = roll <= chance;

    if (success) {
        // SUCCESS: Give Item
        await inventory.addItem(player, recipe.resultId, 1);
        player.call('showNotification', ['Crafting', `Success! Crafted ${recipe.name}.`]);
        player.call('client:crafting:result', [true, `Successfully crafted ${recipe.name}`]);
    } else {
        // FAILURE: Refund Logic
        let refundMsg = "Crafting Failed! Refunded: ";
        
        // 50% Money Refund
        const refundMoney = Math.floor(totalMoneyCost * 0.5);
        await playerManager.addMoneyAndSave(player, refundMoney, `Crafting Refund (Fail)`);
        refundMsg += `$${refundMoney}`;

        // 80% Item Refund (Rounded down)
        for (const input of recipe.inputs) {
            const refundAmt = Math.floor(input.count * 0.8);
            if (refundAmt > 0) {
                await inventory.addItem(player, input.itemId, refundAmt);
                refundMsg += `, ${refundAmt}x ${ItemRegistry[input.itemId].name}`;
            }
        }
        
        player.call('showNotification', ['Crafting', 'Construction Failed. Materials damaged.']);
        player.call('client:crafting:result', [false, `Construction Failed.\n${refundMsg}`]);
    }
    
    // Refresh UI
    sendCraftingData(player);
});