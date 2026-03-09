// packages/jobs/definitions/fishing.js
// =============================================================================
//  FISHING JOB
//
//  FLOW:
//    1. Player starts shift at dock master NPC
//    2. Walk to any water edge, face the water, press E
//    3. Client validates → server:fishing:cast
//    4. Server rolls bite wait (reduced by level)
//    5. Bite → client:fishing:bite (minigame starts)
//    6. Player presses E inside green zone → server:fishing:reel (success)
//       OR outside → server:fishing:missReel (fail)
//    7. Timeout / fail → client:fishing:escapedFish
//    8. Success → fish added to inventory, client:fishing:reelDone with name/rarity/xp
//    9. Sell at fish market NPC
// =============================================================================

const jobManager    = require('../jobManager');
const playerManager = require('../../core/playerManager');
const Inventory     = require('../../systems/inventory');
const ItemRegistry  = require('../../data/items');
const QuestEvents   = require('../../core/questEvents');

const JOB_KEY = 'fishing';

// ---------------------------------------------------------------------------
//  FISH TABLE  (single pool — all fish available everywhere)
// ---------------------------------------------------------------------------
const FISH_POOL = [
    { itemId: 'fish_anchovy',   rarity: 'common',   basePrice: 8   },
    { itemId: 'fish_sardine',   rarity: 'common',   basePrice: 12  },
    { itemId: 'fish_carp',      rarity: 'common',   basePrice: 10  },
    { itemId: 'fish_tuna',      rarity: 'uncommon', basePrice: 35  },
    { itemId: 'fish_bass',      rarity: 'uncommon', basePrice: 28  },
    { itemId: 'fish_catfish',   rarity: 'uncommon', basePrice: 30  },
    { itemId: 'fish_swordfish', rarity: 'rare',     basePrice: 120 },
    { itemId: 'fish_sturgeon',  rarity: 'rare',     basePrice: 150 },
    { itemId: 'fish_salmon',    rarity: 'rare',     basePrice: 100 },
];

function getRarityChances(level) {
    if (level >= 60) return [50, 35, 15];
    if (level >= 30) return [60, 33,  7];
    if (level >= 10) return [72, 25,  3];
    return [85, 14, 1];
}

function getBiteWait(level) {
    const base      = 20000;
    const minimum   = 8000;
    const reduction = Math.min(level * 150, base - minimum);
    const wait      = base - reduction;
    const jitter    = wait * 0.3;
    return wait - jitter + Math.random() * jitter * 2;
}

// ---------------------------------------------------------------------------
//  MARKET CONFIG
// ---------------------------------------------------------------------------
const MARKET_POS     = { x: 374.36, y: -2572.51, z: 6.00, h: 270.0 };
const REEL_WINDOW_MS = 8000;

const SELLABLE_FISH = {};
FISH_POOL.forEach(fish => {
    SELLABLE_FISH[fish.itemId] = fish.basePrice;
});

// ---------------------------------------------------------------------------
//  STATE
// ---------------------------------------------------------------------------
const activeSessions = new Map();

// ---------------------------------------------------------------------------
//  HELPERS
// ---------------------------------------------------------------------------
function rollFish(level) {
    const chances    = getRarityChances(level);
    const commonPool   = FISH_POOL.filter(f => f.rarity === 'common');
    const uncommonPool = FISH_POOL.filter(f => f.rarity === 'uncommon');
    const rarePool     = FISH_POOL.filter(f => f.rarity === 'rare');
    const roll = Math.random() * 100;
    let selected;
    if      (roll < chances[2] && rarePool.length)                  selected = rarePool;
    else if (roll < chances[2] + chances[1] && uncommonPool.length) selected = uncommonPool;
    else                                                             selected = commonPool;
    return selected[Math.floor(Math.random() * selected.length)];
}

function cleanupSession(player) {
    const s = activeSessions.get(player.id);
    if (!s) return;
    if (s.biteTimer)  { clearTimeout(s.biteTimer);  s.biteTimer  = null; }
    if (s.reelTimer)  { clearTimeout(s.reelTimer);  s.reelTimer  = null; }
    activeSessions.delete(player.id);
}

// ---------------------------------------------------------------------------
//  UI HELPERS
// ---------------------------------------------------------------------------
function updateUI(player, text, caught, targetPos) {
    if (!mp.players.exists(player)) return;
    const x = targetPos ? targetPos.x : null;
    const y = targetPos ? targetPos.y : null;
    const z = targetPos ? targetPos.z : null;
    player.call('updateJobUI', [true, text, caught || 0, 0, 0, x, y, z]);
}

function hideUI(player) {
    if (mp.players.exists(player))
        player.call('updateJobUI', [false, '', 0, 0, 0, null, null, null]);
}

// Point GPS at the market when the player has fish in their inventory
function nudgeToMarket(player, caught) {
    jobManager.clearObjective(player);
    jobManager.createObjective(
        player,
        MARKET_POS,
        'Fish Market',
        3.0,
        () => {}, // entry handled by NPC colshape interaction, not here
        { blipSprite: 500, blipColor: 2, markerColor: [0, 150, 255, 120] }
    );
    updateUI(player, 'Sell your catch at the Fish Market', caught, MARKET_POS);
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
            casting:     false,
            biteReady:   false,
            biteTimer:   null,
            reelTimer:   null,
            pendingFish: null,
            caught:      0,
        });

        player.call('client:fishing:setupMarket', [MARKET_POS.x, MARKET_POS.y, MARKET_POS.z]);
        player.call('showNotification', ['Fishing', `Signed in as ${rankName} (Lvl ${level})`]);
        updateUI(player, 'Find water and press E to cast', 0, null);
    },

    onStop: (player) => {
        cleanupSession(player);
        jobManager.clearObjective(player);
        hideUI(player);
        if (mp.players.exists(player)) player.call('client:fishing:cleanup');
    }
};

// ---------------------------------------------------------------------------
//  CAST
// ---------------------------------------------------------------------------
mp.events.add('server:fishing:cast', (player) => {
    if (!player.activeJobId || player.activeJobId !== JOB_KEY) return;

    const session = activeSessions.get(player.id);
    if (!session || session.casting) return;

    session.casting   = true;
    session.biteReady = false;
    const level    = jobManager.getJobLevel(player, JOB_KEY);
    const biteWait = getBiteWait(level);

    player.call('client:fishing:startCast');
    const session_ui = activeSessions.get(player.id);
    updateUI(player, 'Waiting for a bite...', session_ui ? session_ui.caught : 0, null);

    session.biteTimer = setTimeout(() => {
        if (!mp.players.exists(player) || !activeSessions.has(player.id)) return;
        const s = activeSessions.get(player.id);
        if (!s || !s.casting) return;

        s.biteReady = true;
        // Pre-roll the fish now so rarity is known before the minigame starts
        const level = jobManager.getJobLevel(player, JOB_KEY);
        s.pendingFish = rollFish(level);
        player.call('client:fishing:bite', [s.pendingFish.rarity]);

        // Auto-escape timer — if player doesn't reel in time
        s.reelTimer = setTimeout(() => {
            if (!mp.players.exists(player) || !activeSessions.has(player.id)) return;
            const sr = activeSessions.get(player.id);
            if (!sr || !sr.casting) return;

            sr.casting    = false;
            sr.biteReady  = false;
            sr.biteTimer  = null;
            sr.reelTimer  = null;
            sr.pendingFish = null;

            player.call('client:fishing:escapedFish');
            const sr2 = activeSessions.get(player.id);
            updateUI(player, 'Fish escaped — press E to cast again', sr2 ? sr2.caught : 0, null);
        }, REEL_WINDOW_MS);

    }, biteWait);
});

// ---------------------------------------------------------------------------
//  REEL IN — success (player pressed E inside the green zone)
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
    const fish  = session.pendingFish || rollFish(level);
    session.pendingFish = null;
    const xp    = fish.rarity === 'rare' ? 15 : fish.rarity === 'uncommon' ? 6 : 2;
    const added = await Inventory.addItem(player, fish.itemId, 1);

    if (!added) {
        player.call('client:fishing:inventoryFull');
        const session_full = activeSessions.get(player.id);
        nudgeToMarket(player, session_full ? session_full.caught : 0);
        return;
    }

    await jobManager.addJobXp(player, JOB_KEY, xp);
    QuestEvents.emit(player, 'fishing_catch', { count: 1, rarity: fish.rarity });

    const def  = ItemRegistry[fish.itemId];
    const name = def ? def.name : fish.itemId;

    // Pass fish data to client so it renders the notification itself
    player.call('client:fishing:reelDone', [name, fish.rarity, xp]);

    // Increment caught counter and update objective system
    const session_after = activeSessions.get(player.id);
    if (session_after) {
        session_after.caught++;
        nudgeToMarket(player, session_after.caught);
    }
});

// ---------------------------------------------------------------------------
//  MISS REEL — player pressed E but the indicator was outside the zone
// ---------------------------------------------------------------------------
mp.events.add('server:fishing:missReel', (player) => {
    if (!player.activeJobId || player.activeJobId !== JOB_KEY) return;

    const session = activeSessions.get(player.id);
    if (!session || !session.casting) return;

    if (session.reelTimer) { clearTimeout(session.reelTimer); session.reelTimer = null; }
    if (session.biteTimer) { clearTimeout(session.biteTimer); session.biteTimer = null; }

    session.casting     = false;
    session.biteReady   = false;
    session.pendingFish = null;

    player.call('client:fishing:escapedFish');
    updateUI(player, 'Fish escaped — press E to cast again', session.caught || 0, null);
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
    if (player.isSellingFish) return;

    amount = parseInt(amount);
    if (!amount || amount <= 0) return;
    if (!SELLABLE_FISH[itemId]) {
        return player.call('showNotification', ['Fish Market', "We don't buy that."]);
    }

    player.isSellingFish = true;
    try {
        const db    = require('../../core/database');
        const inv   = player.inventory || [];
        const items = inv.filter(i => i.itemId === itemId);
        const total = items.reduce((a, i) => a + i.count, 0);

        if (total < amount) {
            return player.call('showNotification', ['Fish Market', 'Not enough fish.']);
        }

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

        const level = jobManager.getJobLevel(player, JOB_KEY);
        const price = SELLABLE_FISH[itemId] + Math.floor(level * 0.5);
        const money = amount * price;
        const xp    = Math.ceil(amount * 1.5);

        await playerManager.addMoneyAndSave(player, money, 'Fish Market Sale');
        await jobManager.addJobXp(player, JOB_KEY, xp);

        const def = ItemRegistry[itemId];
        player.call('showNotification', ['Fish Market',
            `Sold ~g~${amount}x ${def ? def.name : itemId}~w~ for ~g~$${money}~w~ (~y~+${xp} XP~w~)`]);

        // Refresh the menu with updated counts
        mp.events.call('server:fishing:openMarket', player);

        // Reset caught counter and return to fishing state
        const session_sell = activeSessions.get(player.id);
        if (session_sell) session_sell.caught = 0;
        jobManager.clearObjective(player);
        updateUI(player, 'Find water and press E to cast', 0, null);
    } finally {
        player.isSellingFish = false;
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
mp.peds.new(
    mp.joaat('s_m_m_dockwork_01'),
    new mp.Vector3(MARKET_POS.x, MARKET_POS.y, MARKET_POS.z),
    { heading: MARKET_POS.h, dynamic: false, invincible: true, frozen: true }
);

const marketCol = mp.colshapes.newSphere(MARKET_POS.x, MARKET_POS.y, MARKET_POS.z, 2.5);
marketCol.setVariable('interaction', {
    title: 'Fish Market',
    text: 'Press ~b~E~w~ to sell fish',
    event: 'server:fishing:openMarket',
    requireOnFoot: true
});

mp.events.add('playerQuit', (player) => { cleanupSession(player); });