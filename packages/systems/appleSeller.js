// packages/systems/appleSeller.js
const Inventory = require('./inventory');
const PlayerManager = require('../core/playerManager'); 
const db = require('../core/database');

const CONFIG = {
    pricePerApple: 5, // Set your price here
    appleItemId: 'apple', 
    npc: {
        model: 's_m_m_migrant_01', // Farm worker model
        x: 1960.07, y: 3739.94, z: 32.34, h: -50.14
    }
};

// 1. Spawn the Static NPC
const sellerPed = mp.peds.new(
    mp.joaat(CONFIG.npc.model), 
    new mp.Vector3(CONFIG.npc.x, CONFIG.npc.y, CONFIG.npc.z),
    {
        heading: CONFIG.npc.h,
        dynamic: false,
        frozen: true,
        invincible: true,
        dimension: 0
    }
);

// 2. Interaction ColShape (The trigger)
const shape = mp.colshapes.newSphere(CONFIG.npc.x, CONFIG.npc.y, CONFIG.npc.z, 2.0, 0);

// Attach data for your interaction.js system
shape.setVariable('interaction', {
    title: 'Apple Merchant',
    text: 'Press E to Sell Apples',
    event: 'server:openAppleUI',
    requireOnFoot: true
});

// --- EVENTS ---

// Event: Player pressed E
mp.events.add('server:openAppleUI', (player) => {
    // 1. Job Check (Optional: Remove if anyone can sell)
    if (player.data.job !== 'farmer') {
        return player.call('showNotification', ['Market', 'We only buy from licensed farmers.']);
    }

    // 2. Vehicle Check
    if (player.vehicle) {
        return player.call('showNotification', ['Market', 'Step out of the vehicle first.']);
    }

    if (!player.inventory) return;

    // 3. Count Apples
    const totalApples = player.inventory
        .filter(i => i.itemId === CONFIG.appleItemId)
        .reduce((sum, i) => sum + i.count, 0);

    if (totalApples <= 0) {
        return player.call('showNotification', ['Market', 'You don\'t have any apples to sell.']);
    }

    // 4. Open Client UI
    player.call('client:openAppleBrowser', [totalApples, CONFIG.pricePerApple]);
});

// Event: Player clicked "SELL" in UI
mp.events.add('server:processAppleSale', async (player, amountToSell) => {
    amountToSell = parseInt(amountToSell);
    if (!amountToSell || amountToSell <= 0) return;

    // Re-Verify Inventory (Security against Cheat Engine/Packet injection)
    const appleStacks = player.inventory.filter(i => i.itemId === CONFIG.appleItemId);
    const totalCount = appleStacks.reduce((sum, i) => sum + i.count, 0);

    if (totalCount < amountToSell) {
        return player.call('showNotification', ['Market', 'You don\'t have that many apples!']);
    }

    // Remove Items Logic
    let remainingToRemove = amountToSell;
    let updates = [];
    let deletes = [];

    for (const stack of appleStacks) {
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
        // Execute DB changes
        await Promise.all([...updates, ...deletes]);
        
        // Sync Inventory to Client
        Inventory.syncClient(player);

        // Give Money & Save
        const totalReward = amountToSell * CONFIG.pricePerApple;
        await PlayerManager.addMoneyAndSave(player, totalReward, 'Sold Apples');

        // Feedback
        player.call('showNotification', ['Market', `Sold ${amountToSell} apples for $${totalReward}.`]);
        player.call('client:closeAppleBrowser');
        
        // Optional: Play a "Cha-ching" sound or animation
        // player.call('client:playSound', ['PURCHASE', 'HUD_FRONTEND_DEFAULT_SOUNDSET']);

    } catch (err) {
        console.error("Apple Sale Error:", err);
        player.call('showNotification', ['Error', 'Transaction failed.']);
    }
});