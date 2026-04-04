// packages/systems/store.js
'use strict';

const { STORES, STORE_CATALOG } = require('../data/stores');
const ItemRegistry              = require('../data/items');
const InventorySystem           = require('./inventory');

const CATALOG_MAP = new Map(STORE_CATALOG.map(entry => [entry.itemId, entry]));

// Pre-build catalog data to send to the UI
const CATALOG_DATA = STORE_CATALOG.map(entry => {
    const def = ItemRegistry[entry.itemId];
    if (!def) return null;
    return {
        itemId:   entry.itemId,
        name:     def.name,
        icon:     def.icon,
        weight:   def.weight,
        maxStack: def.maxStack,
        category: entry.category,
        price:    entry.price,
    };
}).filter(Boolean);

// ---------------------------------------------------------------------------
// Spawning System
// ---------------------------------------------------------------------------
function spawnSingleStore(store) {
    // 1. Handle missing model or heading gracefully
    const pedModel = store.npc.model || 'mp_m_shopkeep_01';
    const pedHeading = store.npc.heading || store.npc.h || 0; 
    
    const pos = new mp.Vector3(store.npc.x, store.npc.y, store.npc.z);

    // 2. Spawn EXACTLY like your Job System (no explicit dimension string)
    const ped = mp.peds.new(mp.joaat(pedModel), pos, {
        heading: pedHeading,
        dynamic: false, 
        invincible: true, 
        frozen: true
    });

    // 3. Sync with your existing client_packages/jobs/manager.js
    ped.setVariable('static', true);
    ped.setVariable('storeId', store.id);
    ped.setVariable('staticAnim', { dict: 'anim@heists@heist_corona@single_team', name: 'single_team_loop_boss', flag: 1 });

    // 4. Create the Job-style interaction Colshape 
    const shape = mp.colshapes.newTube(pos.x, pos.y, pos.z - 1.0, 2.0, 2.5);
    shape.setVariable('interaction', {
        title: store.name || '24/7 Store',
        text: "Press E to Browse",
        event: "server:store:open",
        data: store.id
    });
}

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

// Triggered globally by your Colshape interaction script when they press E
mp.events.add('server:store:open', (player, storeId) => {
    if (player.getVariable('storeBusy')) return;
    
    player.setVariable('storeBusy', true);
    player.call('client:store:openUI', [JSON.stringify(CATALOG_DATA)]);
});

mp.events.add('server:store:purchase', async (player, itemId, qty) => {
    qty = parseInt(qty, 10);

    if (!itemId || isNaN(qty) || qty < 1 || qty > 99) {
        return player.call('showNotification', ['Store', 'Invalid purchase request.']);
    }

    const catalogEntry = CATALOG_MAP.get(itemId);
    const itemDef = ItemRegistry[itemId];

    if (!catalogEntry || !itemDef) {
        return player.call('showNotification', ['Store', 'Item unavailable.']);
    }

    if (itemDef.maxStack && qty > itemDef.maxStack) qty = itemDef.maxStack;

    const totalCost = catalogEntry.price * qty;
    const balance = player.data.money || 0; // Read directly from your custom player.data memory

    if (balance < totalCost) {
        return player.call('showNotification', ['Store', `Not enough cash. Need $${totalCost}.`]);
    }

    // Process payment
    player.data.money -= totalCost;
    player.setVariable('money', player.data.money);

    // Give Item via your native Inventory
    const success = await InventorySystem.addItem(player, itemId, qty);

    if (success) {
        player.call('showNotification', ['Store', `Bought ${qty}x ${itemDef.name} for $${totalCost}.`]);
        player.call('client:store:purchaseOK');
    } else {
        // Refund if inventory is full/heavy
        player.data.money += totalCost;
        player.setVariable('money', player.data.money);
        player.call('showNotification', ['Store', 'Inventory full or too heavy.']);
    }
});

mp.events.add('server:store:close', (player) => {
    player.setVariable('storeBusy', false);
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
try {
    STORES.forEach(store => spawnSingleStore(store));
    console.log(`[Store] System loaded – ${CATALOG_DATA.length} items.`);
} catch (err) {
    console.error(`[Store] Error during startup:`, err);
}

module.exports = { spawnSingleStore };