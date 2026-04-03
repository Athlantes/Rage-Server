// packages/data/stores.js
// 24/7 Store Locations & Catalog Configuration

'use strict';

// ---------------------------------------------------------------------------
// STORE CATALOG
// Items sold at every 24/7 store. Add/remove/edit prices here freely.
// ---------------------------------------------------------------------------
const STORE_CATALOG = [
    // ── FOOD ────────────────────────────────────────────────────────────────
    { itemId: 'burger',       price: 8,   category: 'food'  },
    { itemId: 'apple',        price: 3,   category: 'food'  },

    // ── DRINKS ──────────────────────────────────────────────────────────────
    { itemId: 'water',        price: 4,   category: 'drink' },

    // ── MISC / UTILITY ──────────────────────────────────────────────────────
    { itemId: 'plastic_bottle', price: 1, category: 'misc' },
];

// ---------------------------------------------------------------------------
// STORE LOCATIONS
// npc   – where the NPC clerk is spawned (x, y, z, heading)
// blip  – map marker position (usually same x/y, same z)
// name  – display name shown in the UI header
// ---------------------------------------------------------------------------
const STORES = [
    {
        id: 1,
        name: '24/7 – Strawberry',
        npc:  { x: 24.46, y: -1347.42, z: 29.50, heading: -93.9 },
        blip: { x: 24.46, y: -1347.42, z: 29.50 },
    },
];

module.exports = { STORES, STORE_CATALOG };
