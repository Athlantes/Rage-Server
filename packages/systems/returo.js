// packages/systems/returo.js
const Inventory = require('./inventory');
const PlayerManager = require('../core/playerManager'); 
const db = require('../core/database');
const DailyQuests = require('./dailyQuests');

const CONFIG = {
    rewardPerBottle: 5,
    bottleItemId: 'plastic_bottle', 
    locations: [
        { x: -317.98, y: -1511.58, z: 27.74 },
        { x: -319.19, y: -1511.62, z: 27.74 },
        { x: -320.23, y: -1511.67, z: 27.74 },
        { x: -321.41, y: -1511.68, z: 27.73 }
    ]
};

// Initialize Locations (Logic Only - No Visuals)
CONFIG.locations.forEach((loc) => {
    // 1. Interaction ColShape (Invisible Trigger)
    const shape = mp.colshapes.newSphere(loc.x, loc.y, loc.z, 1.5, 0);
    
    // Attach data for interaction.js
    shape.setVariable('interaction', {
        title: 'Returo',
        text: 'Press E to Recycle Bottles',
        event: 'server:openReturoUI',
        requireOnFoot: true // Ensures player is not in a vehicle
    });
});

// Event: Player pressed E
mp.events.add('server:openReturoUI', (player) => {
    // Security: Vehicle Check
    if (player.vehicle) {
        return player.call('showNotification', ['Returo', 'You must be on foot to recycle.']);
    }

    if (!player.inventory) return;

    // Calculate total bottles in inventory
    const totalBottles = player.inventory
        .filter(i => i.itemId === CONFIG.bottleItemId)
        .reduce((sum, i) => sum + i.count, 0);

    // Open Client UI with data
    player.call('client:openReturoBrowser', [totalBottles, CONFIG.rewardPerBottle]);
});

// Event: Player clicked "Recycle" in UI
mp.events.add('server:processRecycling', async (player, amountToRecycle) => {
    amountToRecycle = parseInt(amountToRecycle);
    if (!amountToRecycle || amountToRecycle <= 0) return;

    const bottleId = CONFIG.bottleItemId;
    
    // 1. Re-Verify Inventory (Security)
    const bottleStacks = player.inventory.filter(i => i.itemId === bottleId);
    const totalCount = bottleStacks.reduce((sum, i) => sum + i.count, 0);

    if (totalCount < amountToRecycle) {
        return player.call('showNotification', ['Returo', 'You do not have that many bottles!']);
    }

    // 2. Remove Items Logic
    let remainingToRemove = amountToRecycle;
    let updates = [];
    let deletes = [];

    for (const stack of bottleStacks) {
        if (remainingToRemove <= 0) break;

        if (stack.count <= remainingToRemove) {
            // Remove entire stack
            remainingToRemove -= stack.count;
            const idx = player.inventory.indexOf(stack);
            if (idx > -1) player.inventory.splice(idx, 1);
            
            deletes.push(db.query('DELETE FROM character_inventory WHERE id = ?', [stack.id]));
        } else {
            // Remove partial stack
            stack.count -= remainingToRemove;
            remainingToRemove = 0;
            
            updates.push(db.query('UPDATE character_inventory SET count = ? WHERE id = ?', [stack.count, stack.id]));
        }
    }

    try {
        await Promise.all([...updates, ...deletes]);
        
        // 3. Sync Inventory
        Inventory.syncClient(player);

        // 4. Give Money & Save
        const totalReward = amountToRecycle * CONFIG.rewardPerBottle;
        await PlayerManager.addMoneyAndSave(player, totalReward, 'Returo Recycle');

        DailyQuests.progress(player, 'recycle_bottles', amountToRecycle);

        player.call('showNotification', ['Returo', `Recycled ${amountToRecycle} bottles for $${totalReward}.`]);
        player.call('client:closeReturoBrowser');

    } catch (err) {
        console.error(err);
        player.call('showNotification', ['Error', 'Transaction failed.']);
    }
});