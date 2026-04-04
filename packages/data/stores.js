// packages/data/stores.js
'use strict';

const STORE_CATALOG = [
    { itemId: 'burger',         price: 8,   category: 'food'  },
    { itemId: 'apple',          price: 3,   category: 'food'  },
    { itemId: 'water',          price: 4,   category: 'drink' },
    { itemId: 'plastic_bottle', price: 1,   category: 'misc'  },
];

const STORES = [
    {
        id: 1,
        name: '24/7 – Strawberry',
        npc:  { x: 24.46, y: -1347.42, z: 29.50, h: -93.9, model: 'mp_m_shopkeep_01' },
        blip: { x: 24.46, y: -1347.42, z: 29.50, sprite: 52, color: 4, scale: 0.75 }
    },

    {
        id: 2,
        name: '24/7 – Mirror Park',
        npc:  { x: 1164.71, y: -322.60, z: 69.21, h: 102.32, model: 'mp_m_shopkeep_01' },
        blip: { x: 1164.71, y: -322.60, z: 69.21, sprite: 52, color: 4, scale: 0.75 }
    },

    {
        id: 3,
        name: '24/7 – Little Seoul',
        npc:  { x: -706.07, y: -913.61, z: 19.22, h: 96.74, model: 'mp_m_shopkeep_01' },
        blip: { x: -706.07, y: -913.61, z: 19.22, sprite: 52, color: 4, scale: 0.75 }
    },
    
    {
        id: 4,
        name: '24/7 – Sandy Shores',
        npc:  { x: 1959.00, y: 3741.76, z: 32.34, h: -55.14, model: 'mp_m_shopkeep_01' },
        blip: { x: 1959.00, y: 3741.76, z: 32.34, sprite: 52, color: 4, scale: 0.75 }
    },
];

module.exports = { STORES, STORE_CATALOG };