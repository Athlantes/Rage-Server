// packages/jobs/definitions/fishing.js
// =============================================================================
//  FISHING JOB
//
//  Players can fish anywhere there is >= 1.5m of water depth.
//  No fixed spots. The client validates facing + depth before casting.
//  The server derives ocean/lake/river from the player's position to
//  determine which fish pool to use.
//
//  FLOW:
//    1. Player starts shift at dock master NPC
//    2. Walk to any water edge, face the water
//    3. Press E → client validates (facing + depth) → server:fishing:cast
//    4. Server rolls bite wait (reduced by level)
//    5. Fish bites → client:fishing:bite (shake + notification)
//    6. Player has REEL_WINDOW_MS to press E → server:fishing:reel
//    7. Miss → fish escapes, can cast again immediately
//    8. Catch → fish item added to inventory
//    9. Sell at fish market NPC
// =============================================================================

const jobManager    = require('../jobManager');
const playerManager = require('../../core/playerManager');
const Inventory     = require('../../systems/inventory');
const ItemRegistry  = require('../../data/items');
const QuestEvents   = require('../../core/questEvents');

const JOB_KEY = 'fishing';

// ---------------------------------------------------------------------------
//  WATER TYPE ZONES
//  Lightweight bounding-box checks to classify the player's location.
//  Everything outside these boxes defaults to 'ocean'.
// ---------------------------------------------------------------------------
const WATER_ZONES = [
    // Alamo Sea (large inland salt lake, east of map)
    { type: 'lake',  minX: 800,   maxX: 2200,  minY: 2800, maxY: 4200 },
    // Zancudo River / west coast river mouth area
    { type: 'river', minX: -3000, maxX: -1800, minY: 3200, maxY: 5000 },
    // Raton Canyon river
    { type: 'river', minX: -1400, maxX: -700,  minY: 4600, maxY: 5400 },
];

function getWaterType(x, y) {
    for (const z of WATER_ZONES) {
        if (x >= z.minX && x <= z.maxX && y >= z.minY && y <= z.maxY) return z.type;
    }
    return 'ocean';
}

// ---------------------------------------------------------------------------
//  FISH TABLE
// ---------------------------------------------------------------------------
const FISH_BY_TYPE = {
    ocean: [
        { itemId: 'fish_anchovy',   rarity: 'common',   basePrice: 8   },
        { itemId: 'fish_sardine',   rarity: 'common',   basePrice: 12  },
        { itemId: 'fish_tuna',      rarity: 'uncommon', basePrice: 35  },
        { itemId: 'fish_swordfish', rarity: 'rare',     basePrice: 120 },
    ],
    lake: [
        { itemId: 'fish_carp',      rarity: 'common',   basePrice: 10  },
        { itemId: 'fish_bass',      rarity: 'uncommon', basePrice: 28  },
        { itemId: 'fish_sturgeon',  rarity: 'rare',     basePrice: 150 },
    ],
    river: [
        { itemId: 'fish_carp',      rarity: 'common',   basePrice: 10  },
        { itemId: 'fish_catfish',   rarity: 'uncommon', basePrice: 30  },
        { itemId: 'fish_salmon',    rarity: 'rare',     basePrice: 100 },
    ],
};

// Rarity chances [common%, uncommon%, rare%] by level bracket
function getRarityChances(level) {
    if (level >= 60) return [50, 35, 15];
    if (level >= 30) return [60, 33,  7];
    if (level >= 10) return [72, 25,  3];
    return [85, 14, 1];
}

// Bite wait in ms — reduces with level, has ±30% jitter
function getBiteWait(level) {
    const base      = 20000;
    const minimum   = 8000;
    const reduction = Math.min(level * 150, base - minimum);
    const wait      = base - reduction;
    const jitter    = wait * 0.3;
    return wait - jitter + Math.random() * jitter * 2;
}

// ---------------------------------------------------------------------------
//  MARKET
// ---------------------------------------------------------------------------
const MARKET_POS     = { x: 374.36, y: -2572.51, z: 6.00, h: 270.0 };
const REEL_WINDOW_MS = 8000;

// Build a flat sellable map from all fish pools
const SELLABLE_FISH = {};
Object.values(FISH_BY_TYPE).forEach(pool => {
    pool.forEach(fish => {
        if (!SELLABLE_FISH[fish.itemId]) SELLABLE_FISH[fish.itemId] = fish.basePrice;
    });
});

// ---------------------------------------------------------------------------
//  STATE
// ---------------------------------------------------------------------------
const activeSessions = new Map();

// ---------------------------------------------------------------------------
//  HELPERS
// ---------------------------------------------------------------------------
function rollFish(waterType, level) {
    const pool    = FISH_BY_TYPE[waterType] || FISH_BY_TYPE.ocean;
    const chances = getRarityChances(level);

    const commonPool   = pool.filter(f => f.rarity === 'common');
    const uncommonPool = pool.filter(f => f.rarity === 'uncommon');
    const rarePool     = pool.filter(f => f.rarity === 'rare');

    const roll = Math.random() * 100;
    let selected;
    if      (roll < chances[2] && rarePool.length)                   selected = rarePool;
    else if (roll < chances[2] + chances[1] && uncommonPool.length)  selected = uncommonPool;
    else                                                              selected = commonPool.length ? commonPool : pool;

    return selected[Math.floor(Math.random() * selected.length)];
}

function cleanupSession(player) {
    const s = activeSessions.get(player.id);
    if (!s) return;
    if (s.biteTimer) { clearTimeout(s.biteTimer); s.biteTimer = null; }
    if (s.reelTimer) { clearTimeout(s.reelTimer); s.reelTimer = null; }
    activeSessions.delete(player.id);
}

// ---------------------------------------------------------------------------
//  JOB LOGIC
// ---------------------------------------------------------------------------
const logic = {
    onStart: (player) => {
        jobManager.startJobSession(player, JOB_KEY);

        const level    = jobManager.getJobLevel(player, JOB_KEY);
        const rankName = jobManager.getRankName(level);

        activeSessions.set(player.id, {
            casting:   false,
            biteReady: false,
            biteTimer: null,
            reelTimer: null,
        });

        player.call('client:fishing:setupMarket', [MARKET_POS.x, MARKET_POS.y, MARKET_POS.z]);
        player.call('showNotification', ['Fishing', `Signed in as ${rankName} (Lvl ${level})`]);
        player.call('showNotification', ['Fishing', 'Stand at any water edge and press ~b~E~w~ to cast.']);
    },

    onStop: (player) => {
        cleanupSession(player);
        if (mp.players.exists(player)) player.call('client:fishing:cleanup');
    }
};

// ---------------------------------------------------------------------------
//  CAST
// ---------------------------------------------------------------------------
mp.events.add('server:fishing:cast', (player) => { // Removed passed posX, posY args
    if (!player.activeJobId || player.activeJobId !== JOB_KEY) return;

    const session = activeSessions.get(player.id);
    if (!session || session.casting) return;

    session.casting   = true;
    session.biteReady = false;
    
    // Security Fix: Always use the player's true server-side position
    session.waterType = getWaterType(player.position.x, player.position.y);

    const level    = jobManager.getJobLevel(player, JOB_KEY);
    const biteWait = getBiteWait(level);

    player.call('client:fishing:startCast');

    session.biteTimer = setTimeout(() => {
        if (!mp.players.exists(player) || !activeSessions.has(player.id)) return;
        const s = activeSessions.get(player.id);
        if (!s || !s.casting) return;

        s.biteReady = true;
        player.call('client:fishing:bite');
        player.call('showNotification', ['Fishing', '🐟 Fish on the line! Press ~b~E~w~ to reel in!']);

        s.reelTimer = setTimeout(() => {
            if (!mp.players.exists(player) || !activeSessions.has(player.id)) return;
            const sr = activeSessions.get(player.id);
            if (!sr || !sr.casting) return;

            sr.casting   = false;
            sr.biteReady = false;
            sr.biteTimer = null;
            sr.reelTimer = null;

            player.call('client:fishing:escapedFish');
            player.call('showNotification', ['Fishing', 'The fish got away! Press E to cast again.']);
        }, REEL_WINDOW_MS);

    }, biteWait);
});

// ---------------------------------------------------------------------------
//  REEL IN
// ---------------------------------------------------------------------------
mp.events.add('server:fishing:reel', async (player) => {
    if (!player.activeJobId || player.activeJobId !== JOB_KEY) return;

    const session = activeSessions.get(player.id);
    if (!session || !session.casting || !session.biteReady) return;

    if (session.reelTimer) { clearTimeout(session.reelTimer); session.reelTimer = null; }
    if (session.biteTimer) { clearTimeout(session.biteTimer); session.biteTimer = null; }

    session.casting   = false;
    session.biteReady = false;

    const level = jobManager.getJobLevel(player, JOB_KEY);
    const fish  = rollFish(session.waterType, level);
    const xp    = fish.rarity === 'rare' ? 15 : fish.rarity === 'uncommon' ? 6 : 2;
    const added = await Inventory.addItem(player, fish.itemId, 1);

    player.call('client:fishing:reelDone');

    if (!added) {
        player.call('showNotification', ['Inventory', 'Inventory full! Sell your fish first.']);
        return;
    }

    await jobManager.addJobXp(player, JOB_KEY, xp);
    QuestEvents.emit(player, 'fishing_catch', { count: 1, rarity: fish.rarity });

    const def  = ItemRegistry[fish.itemId];
    const name = def ? def.name : fish.itemId;
    const tag  = fish.rarity === 'rare'     ? '!{FFD700}[RARE] '     :
                 fish.rarity === 'uncommon' ? '!{00BFFF}[UNCOMMON] ' : '';

    player.call('showNotification', ['Fishing', `${tag}Caught a ${name}! (+${xp} XP)`]);
});

// ---------------------------------------------------------------------------
//  MARKET — open sell menu
// ---------------------------------------------------------------------------
mp.events.add('server:fishing:openMarket', (player) => {
    if (!player.activeJobId || player.activeJobId !== JOB_KEY) {
        return player.call('showNotification', ['Fish Market', 'You need to be working as a fisherman.']);
    }

    const level    = jobManager.getJobLevel(player, JOB_KEY);
    const inv      = player.inventory || [];
    const sellable = Object.entries(SELLABLE_FISH).map(([itemId, basePrice]) => {
        const price = basePrice + Math.floor(level * 0.5);
        const count = inv.filter(i => i.itemId === itemId).reduce((a, i) => a + i.count, 0);
        const def   = ItemRegistry[itemId];
        return { id: itemId, label: def ? def.name : itemId, price, count };
    });

    player.call('client:fishing:openMarket', [JSON.stringify(sellable)]);
});

// ---------------------------------------------------------------------------
//  MARKET — sell
// ---------------------------------------------------------------------------
mp.events.add('server:fishing:sell', async (player, itemId, amount) => {
    if (!player.activeJobId || player.activeJobId !== JOB_KEY) return;
    if (player.isSellingFish) return; // DB Race condition lock

    amount = parseInt(amount);
    if (!amount || amount <= 0) return;
    if (!SELLABLE_FISH[itemId]) return player.call('showNotification', ['Fish Market', "We don't buy that."]);

    player.isSellingFish = true; // Lock player

    try {
        const db    = require('../../core/database');
        const inv   = player.inventory || [];
        const items = inv.filter(i => i.itemId === itemId);
        const total = items.reduce((a, i) => a + i.count, 0);

        if (total < amount) return player.call('showNotification', ['Fish Market', 'Not enough fish.']);

        let remaining = amount;
        for (const item of items) {
            if (remaining <= 0) break;
            if (item.count <= remaining) {
                remaining -= item.count;
                await Inventory.removeItem(player, item);
            } else {
                item.count -= remaining;
                await db.query('UPDATE character_inventory SET count = ? WHERE id = ?', [item.count, item.id]);
                remaining = 0;
            }
        }
        Inventory.syncClient(player);

        const level  = jobManager.getJobLevel(player, JOB_KEY);
        const price  = SELLABLE_FISH[itemId] + Math.floor(level * 0.5);
        const money  = amount * price;
        const xp     = Math.ceil(amount * 1.5);

        await playerManager.addMoneyAndSave(player, money, 'Fish Market Sale');
        await jobManager.addJobXp(player, JOB_KEY, xp);

        const def = ItemRegistry[itemId];
        player.call('showNotification', ['Fish Market', `Sold ${amount}x ${def ? def.name : itemId} for $${money}`]);

        // Auto-refresh the market menu data
        mp.events.call('server:fishing:openMarket', player);
    } finally {
        player.isSellingFish = false; // Unlock player safely
    }
});

// ---------------------------------------------------------------------------
//  REGISTRATION
// ---------------------------------------------------------------------------
jobManager.register(JOB_KEY, {
    name:           'Fisherman',
    description:    'Fish anywhere there is deep enough water, then sell your catch at the fish market.',
    previewButtons: [{ label: 'Start Shift', action: 'default' }],
    pedModel:       's_m_m_dockwork_01',
    blipSprite:     500,
    blipColor:      3,
    pos:            { x: -2187.95, y: -408.90, z: 13.16, h: -133.03 }
}, logic);

// Market NPC
mp.peds.new(mp.joaat('s_m_m_dockwork_01'),
    new mp.Vector3(MARKET_POS.x, MARKET_POS.y, MARKET_POS.z), {
        heading: MARKET_POS.h, dynamic: false, invincible: true, frozen: true
    }
);
const marketCol = mp.colshapes.newSphere(MARKET_POS.x, MARKET_POS.y, MARKET_POS.z, 2.5);
marketCol.setVariable('interaction', {
    title: 'Fish Market', text: 'Press ~b~E~w~ to sell fish',
    event: 'server:fishing:openMarket', requireOnFoot: true
});

mp.events.add('playerQuit', (player) => { cleanupSession(player); });