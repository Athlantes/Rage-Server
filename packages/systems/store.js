// packages/systems/store.js
// Server-side 24/7 Store System

'use strict';

const { STORES, STORE_CATALOG }   = require('../data/stores');
const ItemRegistry                 = require('../data/items');
const InventorySystem              = require('./inventory');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const NPC_MODEL   = 'mp_m_shopkeep_01';
const NPC_RANGE   = 2.5;           // metres – interaction radius

// Pre-build a lookup map of valid items for O(1) purchase validation
const CATALOG_MAP = new Map(STORE_CATALOG.map(entry => [entry.itemId, entry]));

// Enrich catalog with item registry data once at startup
const CATALOG_DATA = STORE_CATALOG.map(entry => {
    const def = ItemRegistry[entry.itemId];
    if (!def) {
        console.warn(`[Store] Item '${entry.itemId}' in STORE_CATALOG not found in ItemRegistry!`);
        return null;
    }
    return {
        itemId:  entry.itemId,
        name:    def.name,
        icon:    def.icon,
        weight:  def.weight,
        maxStack: def.maxStack,
        category: entry.category,
        price:   entry.price,
    };
}).filter(Boolean);

// ---------------------------------------------------------------------------
// NPC Spawning
// ---------------------------------------------------------------------------

/**
 * Spawns a single store NPC. Called both at startup and by /addstore at runtime.
 * @param {Object} store  – a store entry object from STORES
 */
function spawnSingleStore(store) {
    const ped = mp.peds.new(
        mp.joaat(NPC_MODEL),
        new mp.Vector3(store.npc.x, store.npc.y, store.npc.z),
        store.npc.heading,
        -1  // World dimension
    );

    ped.setVariable('storeId', store.id);
    ped.freezePosition(true);
    ped.setInvincible(true);
    ped.taskSetBlockingOfNonTemporaryEvents(true);

    console.log(`[Store] Spawned NPC for "${store.name}" (storeId=${store.id})`);
}

function spawnStoreNpcs() {
    STORES.forEach(store => {
        try {
            spawnSingleStore(store);
        } catch (err) {
            console.error(`[Store] Failed to spawn NPC for store ${store.id}:`, err);
        }
    });
}

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

// Client requests to open the store UI
mp.events.add('server:store:open', (player) => {
    // Anti-spam: if already shopping, ignore
    if (player.getVariable('storeBusy')) return;

    // Send the catalog to the client so the UI can render it
    player.call('client:store:openUI', [JSON.stringify(CATALOG_DATA)]);
});

// Client submits a purchase
mp.events.add('server:store:purchase', async (player, itemId, qty) => {
    // ── Validation ──────────────────────────────────────────────────────────
    qty = parseInt(qty, 10);

    if (!itemId || isNaN(qty) || qty < 1 || qty > 99) {
        return player.call('showNotification', ['Store', 'Invalid purchase request.']);
    }

    const catalogEntry = CATALOG_MAP.get(itemId);
    if (!catalogEntry) {
        return player.call('showNotification', ['Store', 'This item is not for sale.']);
    }

    const itemDef = ItemRegistry[itemId];
    if (!itemDef) {
        return player.call('showNotification', ['Store', 'Item data error. Contact an admin.']);
    }

    // Respect maxStack
    if (itemDef.maxStack && qty > itemDef.maxStack) {
        qty = itemDef.maxStack;
    }

    const totalCost = catalogEntry.price * qty;

    // ── Bank balance check ───────────────────────────────────────────────────
    const balance = player.getVariable('money') ?? 0;
    if (balance < totalCost) {
        return player.call('showNotification', [
            'Store',
            `Not enough cash. Need $${totalCost}, you have $${balance}.`
        ]);
    }

    // ── Deduct money ─────────────────────────────────────────────────────────
    player.setVariable('money', balance - totalCost);

    // Sync to DB if you have a persist helper (adapt to your save pattern)
    if (typeof player.data === 'object' && player.data !== null) {
        player.data.money = balance - totalCost;
        // If your server has a savePlayer / markDirty pattern, call it here:
        // playerManager.markDirty(player);
    }

    // ── Give items ───────────────────────────────────────────────────────────
    const success = await InventorySystem.addItem(player, itemId, qty);

    if (success) {
        player.call('showNotification', [
            'Store',
            `Purchased ${qty}x ${itemDef.name} for $${totalCost}.`
        ]);
        // Tell the UI the purchase went through
        player.call('client:store:purchaseOK');
    } else {
        // addItem returned false – weight / other hard limit
        // CityBox overflow is handled inside addItem itself, so this path
        // means something unexpected. Refund the player.
        player.setVariable('money', balance);
        if (typeof player.data === 'object' && player.data !== null) {
            player.data.money = balance;
        }
        player.call('showNotification', [
            'Store',
            'Could not add items to inventory.'
        ]);
    }
});

// Client closed the store UI
mp.events.add('server:store:close', (player) => {
    player.setVariable('storeBusy', false);
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
mp.events.add('packageLoaded', () => {
    spawnStoreNpcs();
    console.log(`[Store] System loaded – ${STORES.length} stores, ${CATALOG_DATA.length} items.`);
});

// ---------------------------------------------------------------------------
// Exports — used by /addstore in commands.js for hot-spawning
// ---------------------------------------------------------------------------
module.exports = { spawnSingleStore };
