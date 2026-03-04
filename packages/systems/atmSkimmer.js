// =============================================================================
//  packages/systems/atmSkimmer.js  —  ATM Skimmer Robbery System (Server-Side)
// =============================================================================
//
//  HOW IT WORKS:
//    1. Criminal approaches a robbable ATM, opens circleMenu → "Install Skimmer"
//    2. Server checks: exposure < 40, ATM not on cooldown, has "skimmer" item
//    3. If valid → marks ATM as "compromised", starts a 10-min collection timer
//    4. After 10 min the criminal gets a notification on their phone to retrieve
//    5. Criminal returns → circleMenu shows "Collect Funds"
//    6. On collect → pays out, consumes skimmer, +60 Exposure, ATM cools 20 min
//    7. PD on duty → circleMenu shows "Inspect ATM" → detects skimmer if present
//       + logs an automatic dispatch call with the ATM location
//
// =============================================================================

'use strict';

const db              = require('../core/database');
const playerManager   = require('../core/playerManager');
const wantedManager   = require('../factions/lspd/wantedManager');
const dispatchManager = require('../factions/dispatch/dispatchManager');
const Inventory       = require('./inventory');

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const CFG = {
    REQUIRED_ITEM:        'skimmer_device',
    EXPOSURE_ON_COLLECT:  60,
    EXPOSURE_MAX_TO_ROB:  39,        // must be ≤ this to install
    EXPOSURE_DECAY_RATE:  1,         // pts per tick
    EXPOSURE_DECAY_MS:    90_000,    // 1.5 min
    ATM_COOLDOWN_MS:      20 * 60_000,
    COLLECT_READY_MS:     10 * 60_000, // 10 min before funds are collectable
    MIN_REWARD:           1_200,
    MAX_REWARD:           3_800,
};

// ─────────────────────────────────────────────────────────────────────────────
//  ROBBABLE ATM INDEX LIST
//  These are indices into the shared ATM_LOCATIONS array (client + server both
//  reference the same list). Chosen to be spread across the map.
// ─────────────────────────────────────────────────────────────────────────────
const ROBBABLE_ATM_INDICES = [
    1,   // Downtown
    4,   // LSIA area
    11,  // Elysian Island
    23,  // Strawberry Ave
    25,  // Legion Square
    30,  // Vinewood
    34,  // Richman
    44,  // Morningwood
    62,  // Vespucci
    70,  // Rockford Hills
    85,  // Paleto Bay
    91,  // Sandy Shores
];

// ─────────────────────────────────────────────────────────────────────────────
//  SERVER-SIDE ATM LOCATIONS (mirror of client atm.js ATM_LOCATIONS)
// ─────────────────────────────────────────────────────────────────────────────
const ATM_LOCATIONS = [
    // prop_atm_01
    {x: 228.03,   y: 337.85,   z: 104.50},  // 0
    {x: 158.79,   y: 234.74,   z: 105.64},  // 1  ← robbable
    {x: -57.17,   y: -92.37,   z: 56.75},   // 2
    {x: 357.12,   y: 174.08,   z: 102.05},  // 3
    {x: -1044.46, y: -2739.64, z: 8.12},    // 4  ← robbable
    {x: -1415.48, y: -212.33,  z: 45.49},   // 5
    {x: -1430.66, y: -211.35,  z: 45.47},   // 6
    {x: -1282.09, y: -210.55,  z: 41.43},   // 7
    {x: -1286.70, y: -213.78,  z: 41.43},   // 8
    {x: -1289.74, y: -227.16,  z: 41.43},   // 9
    {x: -1285.13, y: -223.94,  z: 41.43},   // 10
    {x: -1110.22, y: -1691.15, z: 3.37},    // 11 ← robbable
    {x: -1091.88, y: 2709.05,  z: 17.91},   // 12
    {x: -3144.88, y: 1127.81,  z: 19.83},   // 13
    {x: 2563.99,  y: 2584.55,  z: 37.06},   // 14
    {x: 1687.39,  y: 4815.90,  z: 41.00},   // 15
    {x: 1700.69,  y: 6426.76,  z: 31.63},   // 16
    {x: 1822.97,  y: 3682.57,  z: 33.26},   // 17
    {x: 1171.52,  y: 2703.13,  z: 37.14},   // 18
    {x: 1172.45,  y: 2703.13,  z: 37.14},   // 19
    {x: 363.08,   y: 5366.32,  z: 669.83},  // 20
    {x: 461.64,   y: 5380.71,  z: 671.87},  // 21
    {x: 1968.12,  y: 3743.59,  z: 32.34},   // 22
    // prop_atm_02
    {x: 24.59,    y: -945.54,  z: 28.33},   // 23 ← robbable
    {x: 5.68,     y: -919.95,  z: 28.48},   // 24
    {x: 296.17,   y: -896.23,  z: 28.29},   // 25 ← robbable
    {x: 296.87,   y: -894.31,  z: 28.26},   // 26
    {x: 527.77,   y: -160.66,  z: 56.13},   // 27
    {x: 285.34,   y: 142.97,   z: 103.16},  // 28
    {x: 1137.81,  y: -468.86,  z: 65.69},   // 29
    {x: 1167.06,  y: -455.65,  z: 65.81},   // 30 ← robbable
    {x: 1077.77,  y: -776.96,  z: 57.25},   // 31
    {x: 289.52,   y: -1256.78, z: 28.44},   // 32
    {x: 289.26,   y: -1282.32, z: 28.65},   // 33
    {x: -846.65,  y: -341.50,  z: 37.66},   // 34 ← robbable
    {x: -847.20,  y: -340.42,  z: 37.67},   // 35
    {x: -720.62,  y: -415.52,  z: 33.97},   // 36
    {x: -1410.73, y: -98.92,   z: 51.39},   // 37
    {x: -1410.18, y: -100.64,  z: 51.39},   // 38
    {x: -712.93,  y: -818.48,  z: 22.74},   // 39
    {x: -710.08,  y: -818.47,  z: 22.73},   // 40
    {x: -660.67,  y: -854.48,  z: 23.45},   // 41
    {x: -594.61,  y: -1160.85, z: 21.33},   // 42
    {x: -596.12,  y: -1160.85, z: 21.33},   // 43
    {x: -1569.83, y: -547.03,  z: 33.93},   // 44 ← robbable
    {x: -1570.76, y: -547.70,  z: 33.93},   // 45
    {x: -1305.70, y: -706.68,  z: 24.31},   // 46
    {x: -2071.92, y: -317.28,  z: 12.31},   // 47
    {x: -821.89,  y: -1081.55, z: 10.13},   // 48
    {x: -2295.85, y: 357.93,   z: 173.60},  // 49
    {x: -2295.06, y: 356.25,   z: 173.60},  // 50
    {x: -2294.29, y: 354.60,   z: 173.60},  // 51
    {x: 2558.32,  y: 350.98,   z: 107.59},  // 52
    {x: 156.18,   y: 6643.20,  z: 30.59},   // 53
    {x: 173.82,   y: 6638.21,  z: 30.59},   // 54
    {x: -282.71,  y: 6226.43,  z: 30.49},   // 55
    {x: -95.87,   y: 6457.46,  z: 30.47},   // 56
    {x: -97.63,   y: 6455.73,  z: 30.46},   // 57
    {x: -132.66,  y: 6366.87,  z: 30.47},   // 58
    {x: -386.45,  y: 6046.41,  z: 30.47},   // 59
    // prop_atm_03
    {x: -301.65,  y: -829.58,  z: 31.41},   // 60
    {x: -303.22,  y: -829.31,  z: 31.41},   // 61
    {x: -204.01,  y: -861.00,  z: 29.27},   // 62 ← robbable
    {x: 118.64,   y: -883.56,  z: 30.13},   // 63
    {x: 112.47,   y: -819.80,  z: 30.33},   // 64
    {x: 111.38,   y: -774.84,  z: 30.43},   // 65
    {x: 114.54,   y: -775.97,  z: 30.41},   // 66
    {x: -256.63,  y: -715.88,  z: 32.78},   // 67
    {x: -259.27,  y: -723.26,  z: 32.70},   // 68
    {x: -254.52,  y: -692.88,  z: 32.57},   // 69
    {x: -27.89,   y: -724.10,  z: 43.22},   // 70 ← robbable
    {x: -30.09,   y: -723.28,  z: 43.22},   // 71
    {x: 89.81,    y: 2.88,     z: 67.35},   // 72
    {x: -165.58,  y: 234.76,   z: 93.92},   // 73
    {x: -165.58,  y: 232.69,   z: 93.92},   // 74
    {x: -867.01,  y: -187.99,  z: 36.88},   // 75
    {x: -867.97,  y: -186.34,  z: 36.88},   // 76
    {x: -617.80,  y: -708.85,  z: 29.04},   // 77
    {x: -617.80,  y: -706.85,  z: 29.04},   // 78
    {x: -614.51,  y: -705.59,  z: 30.22},   // 79
    {x: -611.85,  y: -705.59,  z: 30.22},   // 80
    {x: -537.80,  y: -854.93,  z: 28.27},   // 81
    {x: -526.77,  y: -1223.37, z: 17.45},   // 82
    {x: -1315.41, y: -834.43,  z: 15.95},   // 83
    {x: -1314.46, y: -835.69,  z: 15.95},   // 84
    {x: -2956.84, y: 487.21,   z: 14.47},   // 85 ← robbable
    {x: -2958.97, y: 487.30,   z: 14.47},   // 86
    {x: -2974.58, y: 380.12,   z: 14.00},   // 87
    {x: -3043.83, y: 594.16,   z: 6.73},    // 88
    {x: -3241.45, y: 997.90,   z: 11.54},   // 89
    // prop_fleeca_atm
    {x: 147.47,   y: -1036.21, z: 28.36},   // 90
    {x: 145.83,   y: -1035.62, z: 28.36},   // 91 ← robbable
    {x: -1205.37, y: -326.52,  z: 36.85},   // 92
    {x: -1206.14, y: -325.03,  z: 36.85},   // 93
];

// ─────────────────────────────────────────────────────────────────────────────
//  RUNTIME STATE
//  Map<atmIndex, { state, ownerId, ownerName, installedAt, reward, cooldownAt }>
//  state: 'clean' | 'compromised' | 'ready' | 'cooldown'
// ─────────────────────────────────────────────────────────────────────────────
const atmState = new Map();

function getAtm(idx) {
    if (!atmState.has(idx)) {
        atmState.set(idx, { state: 'clean', ownerId: null, ownerName: null, installedAt: null, reward: null, cooldownAt: null });
    }
    return atmState.get(idx);
}

// ─────────────────────────────────────────────────────────────────────────────
//  DB PERSISTENCE — save & restore ATM state across server restarts
// ─────────────────────────────────────────────────────────────────────────────
async function saveAtmState(idx) {
    const atm = getAtm(idx);
    await db.query(
        `INSERT INTO atm_skimmer_state (atm_index, state, owner_id, installed_at, reward, cooldown_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           state        = VALUES(state),
           owner_id     = VALUES(owner_id),
           installed_at = VALUES(installed_at),
           reward       = VALUES(reward),
           cooldown_at  = VALUES(cooldown_at)`,
        [
            idx,
            atm.state,
            atm.ownerId    || null,
            atm.installedAt ? new Date(atm.installedAt) : null,
            atm.reward     || null,
            atm.cooldownAt ? new Date(atm.cooldownAt) : null,
        ]
    ).catch(err => console.error(`[Skimmer] Failed to save ATM #${idx} state:`, err));
}

async function deleteAtmState(idx) {
    await db.query('DELETE FROM atm_skimmer_state WHERE atm_index = ?', [idx])
        .catch(err => console.error(`[Skimmer] Failed to delete ATM #${idx} state:`, err));
}

async function loadAtmStates() {
    try {
        const [rows] = await db.query('SELECT * FROM atm_skimmer_state');
        const now = Date.now();

        for (const row of rows) {
            const idx        = row.atm_index;
            const installedAt = row.installed_at ? new Date(row.installed_at).getTime() : null;
            const cooldownAt  = row.cooldown_at  ? new Date(row.cooldown_at).getTime()  : null;

            // ── ATM_COOLDOWN expired while server was down → clean up ──
            if (row.state === 'cooldown' && cooldownAt && (now - cooldownAt) >= CFG.ATM_COOLDOWN_MS) {
                await deleteAtmState(idx);
                console.log(`[Skimmer] ATM #${idx} cooldown expired during downtime — cleaned.`);
                continue;
            }

            // ── Restore state ──
            const atm = getAtm(idx);
            atm.state      = row.state;
            atm.ownerId    = row.owner_id  || null;
            atm.installedAt = installedAt;
            atm.reward     = row.reward    || null;
            atm.cooldownAt = cooldownAt;

            // ── Reschedule "ready" notification if still in compromised state ──
            if (row.state === 'compromised' && installedAt) {
                const elapsed   = now - installedAt;
                const remaining = CFG.COLLECT_READY_MS - elapsed;

                if (remaining <= 0) {
                    // Should have become ready while server was down
                    atm.state = 'ready';
                    await saveAtmState(idx);
                    console.log(`[Skimmer] ATM #${idx} became ready during downtime.`);
                } else {
                    // Still waiting — reschedule
                    setTimeout(async () => {
                        if (atm.state !== 'compromised') return;
                        atm.state = 'ready';
                        await saveAtmState(idx);

                        const p = mp.players.toArray().find(p => p.logged && p.data.dbId === atm.ownerId);
                        if (p && mp.players.exists(p)) {
                            p.call('client:phone:notification', [JSON.stringify({
                                app: 'messages', title: 'Unknown Number',
                                body: 'The package is ready for pickup.', icon: 'fa-envelope',
                            })]);
                            p.call('showNotification', ['Skimmer', 'Your skimmer has collected enough data. Go retrieve it!']);
                        }
                        console.log(`[Skimmer] ATM #${idx} is now ready for collection.`);
                    }, remaining);
                    console.log(`[Skimmer] ATM #${idx} restored (compromised) — ready in ${Math.ceil(remaining/60000)} min.`);
                }
            }

            if (row.state === 'ready')    console.log(`[Skimmer] ATM #${idx} restored — ready for collection.`);
            if (row.state === 'cooldown') console.log(`[Skimmer] ATM #${idx} restored — on cooldown.`);
        }

        console.log(`[Skimmer] Loaded ${rows.length} persisted ATM state(s).`);
    } catch (err) {
        console.error('[Skimmer] Failed to load ATM states from DB:', err);
    }
}

// Boot — load persisted state as soon as the module initialises
loadAtmStates();

function isRobbable(idx) {
    return ROBBABLE_ATM_INDICES.includes(idx);
}

function getAtmStateForClient() {
    const out = {};
    ROBBABLE_ATM_INDICES.forEach(idx => {
        const a = getAtm(idx);
        out[idx] = a.state === 'cooldown' ? 'cooldown' : 'available';
    });
    return out;
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXPOSURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function getExposure(player) {
    return typeof player.data.exposure === 'number' ? player.data.exposure : 0;
}

async function setExposure(player, value) {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    player.data.exposure = v;
    player.setVariable('exposure', v);
    if (player.data.dbId) {
        await db.query('UPDATE users SET exposure = ? WHERE id = ?', [v, player.data.dbId]).catch(console.error);
    }
    player.call('client:exposure:update', [v]);
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXPOSURE DECAY LOOP — 1pt per 1.5 min
// ─────────────────────────────────────────────────────────────────────────────
setInterval(() => {
    mp.players.forEach(player => {
        if (!player.logged) return;
        const exp = getExposure(player);
        if (exp > 0) setExposure(player, exp - CFG.EXPOSURE_DECAY_RATE);
    });
}, CFG.EXPOSURE_DECAY_MS);

// ─────────────────────────────────────────────────────────────────────────────
//  ATM COOLDOWN CHECKER — clears cooldown state after 20 min
// ─────────────────────────────────────────────────────────────────────────────
setInterval(() => {
    const now = Date.now();
    atmState.forEach((data, idx) => {
        if (data.state === 'cooldown' && data.cooldownAt && (now - data.cooldownAt) >= CFG.ATM_COOLDOWN_MS) {
            data.state = 'clean';
            data.ownerId = null;
            data.ownerName = null;
            data.installedAt = null;
            data.reward = null;
            data.cooldownAt = null;
            // Broadcast updated blip states to all clients
            broadcastAtmStates();
            deleteAtmState(idx); // remove from DB — ATM is clean
            console.log(`[Skimmer] ATM #${idx} cooldown expired — back to clean.`);
        }
    });
}, 60_000);

// ─────────────────────────────────────────────────────────────────────────────
//  BROADCAST ATM STATES TO ALL / SINGLE PLAYER
// ─────────────────────────────────────────────────────────────────────────────
function broadcastAtmStates() {
    const payload = JSON.stringify(getAtmStateForClient());
    mp.players.forEach(p => {
        if (p.logged) p.call('client:atm:updateStates', [payload]);
    });
}

function sendAtmStatesToPlayer(player) {
    player.call('client:atm:updateStates', [JSON.stringify(getAtmStateForClient())]);
}

// ─────────────────────────────────────────────────────────────────────────────
//  LOAD EXPOSURE ON LOGIN + SEND INITIAL ATM STATES
// ─────────────────────────────────────────────────────────────────────────────
mp.events.add('server:loadAccount', (player) => {
    const raw = player.data.exposure;
    const exp = typeof raw === 'number' ? raw : (raw ? parseInt(raw) : 0);
    player.data.exposure = Math.max(0, Math.min(100, exp));
    player.setVariable('exposure', player.data.exposure);

    // FIX: Restore the pending ATM variable if the player has an active skimmer
    for (const [idx, atm] of atmState.entries()) {
        if ((atm.state === 'compromised' || atm.state === 'ready') && atm.ownerId === player.data.dbId) {
            player.setVariable('skimmer_pending_atm', idx);
            break;
        }
    }
});

mp.events.add('server:spawn:player', (player) => {
    setTimeout(() => {
        if (mp.players.exists(player) && player.logged) {
            // Send the global ATM states (available/cooldown) to the client
            sendAtmStatesToPlayer(player);

            // Restore the player's personal skimmer variable if they have an active one
            for (const [idx, atm] of atmState.entries()) {
                if ((atm.state === 'compromised' || atm.state === 'ready') && atm.ownerId === player.data.dbId) {
                    player.setVariable('skimmer_pending_atm', idx);
                    break; // A player can only have 1 active skimmer, so we can stop searching
                }
            }
        }
    }, 1500);
});

// ─────────────────────────────────────────────────────────────────────────────
//  EVENT: INSTALL SKIMMER
// ─────────────────────────────────────────────────────────────────────────────
mp.events.add('server:atm:installSkimmer', async (player, atmIndexRaw) => {
    if (!player.logged) return;

    const idx = parseInt(atmIndexRaw);
    if (isNaN(idx) || !isRobbable(idx)) {
        return player.call('showNotification', ['ATM', 'This ATM cannot be tampered with.']);
    }

    // Exposure check
    const exposure = getExposure(player);
    if (exposure > CFG.EXPOSURE_MAX_TO_ROB) {
        const minsLeft = Math.ceil((exposure - CFG.EXPOSURE_MAX_TO_ROB) * (CFG.EXPOSURE_DECAY_MS / 60_000));
        return player.call('showNotification', ['ATM Skimmer', `Too exposed (${exposure}/100). Wait ~${minsLeft} min.`]);
    }

    // ATM state check
    const atm = getAtm(idx);
    if (atm.state === 'cooldown') {
        const remaining = Math.ceil((CFG.ATM_COOLDOWN_MS - (Date.now() - atm.cooldownAt)) / 60_000);
        return player.call('showNotification', ['ATM Skimmer', `ATM just got serviced. Wait ${remaining} min.`]);
    }
    if (atm.state === 'compromised' || atm.state === 'ready') {
        return player.call('showNotification', ['ATM Skimmer', 'A skimmer is already installed here.']);
    }

    // 1-skimmer limit — check if this player already has one active on any ATM
    for (const [activeIdx, activeAtm] of atmState.entries()) {
        if ((activeAtm.state === 'compromised' || activeAtm.state === 'ready') && activeAtm.ownerId === player.data.dbId) {
            return player.call('showNotification', ['ATM Skimmer', 'You already have a skimmer active. Collect it first.']);
        }
    }

    // Item check
    const skimmerItem = player.inventory && player.inventory.find(i => i.itemId === CFG.REQUIRED_ITEM && i.count > 0);
    if (!skimmerItem) {
        return player.call('showNotification', ['ATM Skimmer', 'You need a Skimmer Device to do this.']);
    }

    // ── ALL CHECKS PASSED ──

    // Consume item
    await Inventory.removeItem(player, skimmerItem);

    // Set ATM state
    const reward = Math.floor(Math.random() * (CFG.MAX_REWARD - CFG.MIN_REWARD + 1)) + CFG.MIN_REWARD;
    atm.state     = 'compromised';
    atm.ownerId   = player.data.dbId;
    atm.ownerName = player.name;
    atm.installedAt = Date.now();
    atm.reward    = reward;

    // Tell client which ATM this player owns (drives "Collect Funds" prompt)
    player.setVariable('skimmer_pending_atm', idx);

    // Persist to DB immediately
    await saveAtmState(idx);

    // Schedule "ready" notification after 10 min
    setTimeout(async () => {
        if (atm.state !== 'compromised') return; // was already collected/cleared
        atm.state = 'ready';
        await saveAtmState(idx); // persist ready state

        // Send phone notification to the player if online
        const p = mp.players.toArray().find(p => p.logged && p.data.dbId === atm.ownerId);
        if (p && mp.players.exists(p)) {
            p.call('client:phone:notification', [JSON.stringify({
                app: 'messages',
                title: 'Unknown Number',
                body: 'The package is ready for pickup.',
                icon: 'fa-envelope',
            })]);
            p.call('showNotification', ['Skimmer', 'Your skimmer has collected enough data. Go retrieve it!']);
        }
        console.log(`[Skimmer] ATM #${idx} is now ready for collection.`);
    }, CFG.COLLECT_READY_MS);

    player.call('showNotification', ['ATM Skimmer', 'Device installed. Come back in ~10 minutes to collect.']);
    player.outputChatBox('!{#f0c400}[SKIMMER] !{#ffffff}Skimmer installed. Return in 10 minutes to collect the funds.');

    // Start the HUD countdown timer (10 min)
    await playerManager.setCooldown(player, 'skimmer_collect', CFG.COLLECT_READY_MS / 60_000);

    console.log(`[Skimmer] ${player.name} installed skimmer on ATM #${idx}. Reward: $${reward}`);
});

// ─────────────────────────────────────────────────────────────────────────────
//  EVENT: COLLECT SKIMMER
// ─────────────────────────────────────────────────────────────────────────────
mp.events.add('server:atm:collectSkimmer', async (player, atmIndexRaw) => {
    if (!player.logged) return;

    const idx = parseInt(atmIndexRaw);
    if (isNaN(idx)) return;

    const atm = getAtm(idx);

    // Must be the owner
    if (atm.ownerId !== player.data.dbId) {
        return player.call('showNotification', ['ATM Skimmer', "This isn't your device."]);
    }

    if (atm.state === 'compromised') {
        const readyInMs = CFG.COLLECT_READY_MS - (Date.now() - atm.installedAt);
        const mins = Math.ceil(readyInMs / 60_000);
        return player.call('showNotification', ['ATM Skimmer', `Not ready yet. Wait ~${mins} more min.`]);
    }

    if (atm.state !== 'ready') {
        return player.call('showNotification', ['ATM Skimmer', 'Nothing to collect here.']);
    }

    // ── COLLECT ──
    const reward = atm.reward;

    // Set ATM to cooldown
    atm.state      = 'cooldown';
    atm.cooldownAt = Date.now();
    atm.ownerId    = null;
    atm.ownerName  = null;
    atm.installedAt = null;
    atm.reward     = null;

    // Clear client-side pending flag
    player.setVariable('skimmer_pending_atm', null);

    // Persist cooldown state to DB
    await saveAtmState(idx);

    // Pay player
    await playerManager.addMoneyAndSave(player, reward, 'ATM Skimmer Payout');

    // Apply exposure
    const newExposure = getExposure(player) + CFG.EXPOSURE_ON_COLLECT;
    await setExposure(player, newExposure);

    // Apply wanted — robbery RoS (skimmer = armed robbery would be too harsh)
    wantedManager.applyOffense(player, 'robbery', null);

    // Dispatch
    const loc = ATM_LOCATIONS[idx];
    dispatchManager.addCall(2, {
        callerName: 'Bank Alert',
        callerServerId: null,
        coords: new mp.Vector3(loc.x, loc.y, loc.z),
        location: 'ATM Skimmer Detected',
        callType: 'ATM Fraud',
        isWanted: false,
    });

    // Broadcast updated blip states (ATM now on cooldown → red)
    broadcastAtmStates();

    player.call('showNotification', ['ATM Skimmer', `+$${reward.toLocaleString()} collected! Lay low.`]);
    player.outputChatBox(`!{#ff4757}[SKIMMER] !{#ffffff}You retrieved $${reward.toLocaleString()}. Your Exposure is now ${Math.min(100, newExposure)}/100.`);
    console.log(`[Skimmer] ${player.name} collected $${reward} from ATM #${idx}. Exposure: ${Math.min(100, newExposure)}`);
});

// ─────────────────────────────────────────────────────────────────────────────
//  EVENT: PD INSPECT ATM
// ─────────────────────────────────────────────────────────────────────────────
mp.events.add('server:atm:pdInspect', (officer, atmIndexRaw) => {
    if (!officer.logged) return;
    if (officer.factionId !== 2 || !officer.getVariable('factionDuty')) {
        return officer.call('showNotification', ['ATM', 'Only on-duty officers can inspect ATMs.']);
    }

    const idx = parseInt(atmIndexRaw);
    if (isNaN(idx)) return;

    const atm = getAtm(idx);

    if (atm.state === 'compromised' || atm.state === 'ready') {
        const installedMinsAgo = Math.floor((Date.now() - atm.installedAt) / 60_000);
        officer.outputChatBox(`!{#00a8ff}[ATM INSPECTION] !{#ff4757}SKIMMER DETECTED! !{#ffffff}Installed ~${installedMinsAgo} min ago. Suspect unknown.`);
        officer.call('showNotification', ['ATM Inspection', '⚠ Skimmer device found! Filing dispatch report...']);

        // Log dispatch
        const loc = ATM_LOCATIONS[idx];
        dispatchManager.addCall(2, {
            callerName: `Officer ${officer.name.replace(/_/g, ' ')}`,
            callerServerId: officer.id,
            coords: new mp.Vector3(loc.x, loc.y, loc.z),
            location: 'ATM Skimmer Found — Fraud Investigation',
            callType: 'ATM Inspection',
            isWanted: false,
        });
    } else if (atm.state === 'cooldown') {
        officer.outputChatBox('!{#00a8ff}[ATM INSPECTION] !{#ffffff}ATM recently serviced. Bank was notified.');
        officer.call('showNotification', ['ATM Inspection', 'ATM was recently tampered with. Bank alerted.']);
    } else {
        officer.outputChatBox('!{#00a8ff}[ATM INSPECTION] !{#2ecc71}No anomalies detected. ATM is clean.');
        officer.call('showNotification', ['ATM Inspection', 'ATM is clean. No devices found.']);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
//  EVENT: CLIENT REQUESTS CURRENT ATM STATES (e.g. on reconnect / respawn)
// ─────────────────────────────────────────────────────────────────────────────
mp.events.add('server:atm:requestStates', (player) => {
    sendAtmStatesToPlayer(player);
});

// ─────────────────────────────────────────────────────────────────────────────
//  SAVE EXPOSURE ON ACCOUNT SAVE (patch playerManager.saveAccount)
// ─────────────────────────────────────────────────────────────────────────────
const _origSave = playerManager.saveAccount.bind(playerManager);
playerManager.saveAccount = async (player) => {
    // 1. Check if the player object is still valid right now
    if (!mp.players.exists(player) || !player.data) {
        return await _origSave(player);
    }

    // 2. Cache the variables BEFORE the asynchronous await pause
    const dbId = player.data.dbId;
    const exposure = player.data.exposure;

    // 3. Await the original save function
    await _origSave(player);

    // 4. Use the cached variables to save exposure instead of the player object
    if (dbId && typeof exposure === 'number') {
        await db.query('UPDATE users SET exposure = ? WHERE id = ?', [exposure, dbId])
            .catch(err => console.error('[Skimmer] Failed to save exposure:', err));
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  EXPORTS (used by playerMenu.js)
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
    getExposure,
    setExposure,
    ROBBABLE_ATM_INDICES,
    CFG,
};