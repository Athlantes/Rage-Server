const Inventory = require('./inventory');
const PlayerManager = require('../core/playerManager'); 
const db = require('../core/database');

const CONFIG = {
    rewardPerBottle: 5,
    bottleItemId: 'plastic_bottle', 
    locations: [
        { x: -317.98, y: -1511.58, z: 27.74, h: 7.69 },
        { x: -319.19, y: -1511.62, z: 27.74, h: 94.05 },
        { x: -320.23, y: -1511.67, z: 27.74, h: 90.61 },
        { x: -321.41, y: -1511.68, z: 27.73, h: 93.77 }
    ]
};

// --- NEW: Create Map Blip ---
mp.blips.new(467, new mp.Vector3(-319.49, -1512.91, 27.74), {
    name: 'Recycle',
    color: 2,          // Green
    shortRange: true,  // Only visible on minimap when close (remove for global visibility)
    scale: 1.0,
    dimension: 0
});

// Initialize Locations
CONFIG.locations.forEach((loc) => {
    // 1. Visual Marker
    mp.markers.new(1, new mp.Vector3(loc.x, loc.y, loc.z - 1.0), 0.5, {
        color: [0, 255, 0, 100], 
        visible: true,
        dimension: 0
    });

    // 2. Interaction ColShape
    const shape = mp.colshapes.newSphere(loc.x, loc.y, loc.z, 1.5, 0);
    
    shape.setVariable('interaction', {
        title: 'Returo',
        text: 'Press E to Recycle Bottles',
        event: 'server:openReturoUI',
        requireOnFoot: true // Security Check
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

        player.call('showNotification', ['Returo', `Recycled ${amountToRecycle} bottles for $${totalReward}.`]);
        player.call('client:closeReturoBrowser');

    } catch (err) {
        console.error(err);
        player.call('showNotification', ['Error', 'Transaction failed.']);
    }
});