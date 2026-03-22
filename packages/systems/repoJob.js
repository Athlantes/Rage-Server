// packages/systems/repoJob.js
// ============================================================
// DAILY REPO JOB — "Salvatore's Collections" — PvE Minigame
// ============================================================
//
// STATE MACHINE (per-player):
//   idle
//     → [talk to NPC, accept preview]
//   PHASE_1_FIND_DUMMY      — zone blip shown, player drives to area
//     → [enter zone colshape]
//   PHASE_2_GET_TOOLS       — dummy car + trunk marker spawned
//     → [press E at trunk marker]
//   PHASE_3_RADAR           — player boards dummy car; tracker CEF shown
//     → [server proximity poll: player within AMBUSH_SPAWN_DIST of wanted loc]
//   PHASE_4_AMBUSH          — wanted car + NPC peds spawned, NPCs hostile
//     → [client: lock-break complete] → server:repo:lockBroken
//   PHASE_5_DELIVER         — radar closed; waypoint set to DELIVER_POS
//     → [server proximity poll: player at DELIVER_POS in wanted car]
//   completed
//
// ============================================================

const db            = require('../core/database');
const playerManager = require('../core/playerManager');
const Inventory     = require('./inventory');

// ──────────────────────────────────────────────────────────────
// CONFIG — NPC / DELIVERY
// ──────────────────────────────────────────────────────────────
const NPC_NAME         = 'Salvatore';
const NPC_MODEL        = 'g_m_importexport_01';
const NPC_POS          = { x: -179.86, y: -1178.80, z: 23.13, h: 219.01 };
const DELIVER_POS      = { x: -176.85, y: -1180.85, z: 23.15 };
const DELIVER_RADIUS   = 8.0;
const NPC_TALK_RADIUS  = 2.5;
const DAILY_RESET_HOUR = 7;
const MAX_JOBS_PER_DAY = 2;
const SECOND_JOB_PLAYTIME = 120; // minutes

// ──────────────────────────────────────────────────────────────
// CONFIG — CAR MODELS
// ──────────────────────────────────────────────────────────────
const DUMMY_CAR_MODELS = [
    'blista', 'sultan', 'prairie', 'ingot', 'emperor',
    'stanier', 'stratum', 'asea', 'asterope', 'premier'
];

const WANTED_CAR_MODELS = [
    'zentorno', 't20', 'adder', 'osiris', 'fmj',
    'turismor', 'entityxf', 'vacca', 'cheetah', 'infernus'
];

// ──────────────────────────────────────────────────────────────
// CONFIG — DUMMY CAR LOCATIONS
// zoneCenter: center of the 40m entry zone
// carPos: where the dummy car spawns (within zone)
// trunkMarkerPos: E-interact point at trunk
// ──────────────────────────────────────────────────────────────
const DUMMY_LOCATIONS = [
    {
        zoneCenter:      { x: -707.10, y: -934.21, z: 19.22 },
        carPos:          { x: -707.10, y: -934.21, z: 19.22, h: 90.0 },
        trunkMarkerPos:  { x: -710.50, y: -934.21, z: 19.22 }
    },
    {
        zoneCenter:      { x: 122.90,  y: -1072.50, z: 29.19 },
        carPos:          { x: 122.90,  y: -1072.50, z: 29.19, h: 0.0 },
        trunkMarkerPos:  { x: 122.90,  y: -1069.00, z: 29.19 }
    },
    {
        zoneCenter:      { x: -1380.00, y: -488.00, z: 30.00 },
        carPos:          { x: -1380.00, y: -488.00, z: 30.00, h: 180.0 },
        trunkMarkerPos:  { x: -1380.00, y: -491.50, z: 30.00 }
    },
    {
        zoneCenter:      { x: 812.00,  y: -775.00, z: 26.18 },
        carPos:          { x: 812.00,  y: -775.00, z: 26.18, h: 270.0 },
        trunkMarkerPos:  { x: 815.50,  y: -775.00, z: 26.18 }
    },
    {
        zoneCenter:      { x: -65.00,  y: -835.00, z: 31.50 },
        carPos:          { x: -65.00,  y: -835.00, z: 31.50, h: 45.0 },
        trunkMarkerPos:  { x: -67.70,  y: -837.70, z: 31.50 }
    }
];

// ──────────────────────────────────────────────────────────────
// CONFIG — WANTED CAR LOCATIONS + PED AMBUSH SPAWNS
// pedSpawns: 3 possible spawn points (1-3 will be used at random)
// ──────────────────────────────────────────────────────────────
const WANTED_LOCATIONS = [
    {
        carPos:    { x: 130.00,  y: 6621.00, z: 31.80, h: 180.0 },
        pedSpawns: [
            { x: 127.00,  y: 6616.00, z: 31.80, h: 180.0 },
            { x: 133.00,  y: 6616.00, z: 31.80, h: 180.0 },
            { x: 130.00,  y: 6626.00, z: 31.80, h: 0.0   }
        ]
    },
    {
        carPos:    { x: -1850.00, y: 2055.00, z: 139.00, h: 90.0 },
        pedSpawns: [
            { x: -1855.00, y: 2055.00, z: 139.00, h: 90.0 },
            { x: -1845.00, y: 2052.00, z: 139.00, h: 270.0 },
            { x: -1850.00, y: 2060.00, z: 139.00, h: 180.0 }
        ]
    },
    {
        carPos:    { x: 2534.00,  y: 2596.00, z: 37.95, h: 270.0 },
        pedSpawns: [
            { x: 2538.00,  y: 2593.00, z: 37.95, h: 270.0 },
            { x: 2538.00,  y: 2599.00, z: 37.95, h: 270.0 },
            { x: 2530.00,  y: 2596.00, z: 37.95, h: 90.0  }
        ]
    },
    {
        carPos:    { x: -353.00,  y: 6196.00, z: 31.45, h: 0.0 },
        pedSpawns: [
            { x: -356.00,  y: 6192.00, z: 31.45, h: 0.0 },
            { x: -350.00,  y: 6192.00, z: 31.45, h: 0.0 },
            { x: -353.00,  y: 6200.00, z: 31.45, h: 180.0 }
        ]
    },
    {
        carPos:    { x: 1209.00,  y: 2715.00, z: 37.95, h: 90.0 },
        pedSpawns: [
            { x: 1205.00,  y: 2712.00, z: 37.95, h: 90.0 },
            { x: 1205.00,  y: 2718.00, z: 37.95, h: 90.0 },
            { x: 1213.00,  y: 2715.00, z: 37.95, h: 270.0 }
        ]
    }
];

// ──────────────────────────────────────────────────────────────
// CONFIG — AMBUSH PEDS
// ──────────────────────────────────────────────────────────────
const AMBUSH_PED_MODELS = [
    'g_m_y_lost_01', 'g_m_y_lost_02', 'g_m_y_ballaorig_01',
    'g_m_y_famca_01', 'g_m_y_mexgang_01'
];
const AMBUSH_PED_COUNT_MIN = 1;
const AMBUSH_PED_COUNT_MAX = 3;
const AMBUSH_SPAWN_DIST    = 150.0; // metres
const TRUNK_INTERACT_DIST  = 4.0;   // colshape radius

// ──────────────────────────────────────────────────────────────
// CONFIG — REWARDS
// ──────────────────────────────────────────────────────────────
const REWARDS = {
    cashMin:    6000,
    cashMax:    12000,
    xp:         600,
    partChance: 0.5,
    partPool:   ['car_part_uncommon', 'car_part_rare', 'car_part_epic']
};

// ──────────────────────────────────────────────────────────────
// SESSION STORE — keyed by player.id (RAGE entity id)
// ──────────────────────────────────────────────────────────────
const activeSessions = new Map();

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────

const rand = arr => arr[Math.floor(Math.random() * arr.length)];

function dist2D(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function cleanupSession(playerId) {
    if (!activeSessions.has(playerId)) return;
    const s = activeSessions.get(playerId);
    console.log(`[RepoJob] Cleaning up session for player #${playerId} (phase: ${s.phase})`);

    if (s.proximityInterval) clearInterval(s.proximityInterval);
    if (s.dummyCar   && mp.vehicles.exists(s.dummyCar))   s.dummyCar.destroy();
    if (s.wantedCar  && mp.vehicles.exists(s.wantedCar))  s.wantedCar.destroy();
    if (s.zoneColshape  && mp.colshapes.exists(s.zoneColshape))  s.zoneColshape.destroy();
    if (s.trunkColshape && mp.colshapes.exists(s.trunkColshape)) s.trunkColshape.destroy();
    if (s.trunkMarker   && mp.markers.exists(s.trunkMarker))     s.trunkMarker.destroy();

    activeSessions.delete(playerId);
}

// ──────────────────────────────────────────────────────────────
// PHASE TRANSITIONS
// ──────────────────────────────────────────────────────────────

function startPhase1(player, s) {
    s.phase = 'PHASE_1_FIND_DUMMY';
    console.log(`[RepoJob] ${player.name} PHASE_1_FIND_DUMMY`);

    const loc = s.dummyLocation;
    s.zoneColshape = mp.colshapes.newSphere(loc.zoneCenter.x, loc.zoneCenter.y, loc.zoneCenter.z, 40.0, 0);
    s.zoneColshape.setVariable('repoZone', player.id);

    // Client creates a radius blip + sets a waypoint to the zone
    player.call('client:repo:showZoneBlip', [loc.zoneCenter.x, loc.zoneCenter.y, loc.zoneCenter.z, 40.0]);
}

function startPhase2(player, s) {
    s.phase = 'PHASE_2_GET_TOOLS';
    console.log(`[RepoJob] ${player.name} PHASE_2_GET_TOOLS`);

    const loc = s.dummyLocation;

    s.dummyCar = mp.vehicles.new(mp.joaat(s.dummyModel),
        new mp.Vector3(loc.carPos.x, loc.carPos.y, loc.carPos.z),
        { heading: loc.carPos.h, color: [rand([0,1,2,3,11,12]), rand([0,1,2])], locked: false, engine: false, dimension: 0 }
    );
    s.dummyCar.setVariable('repoOwner', player.id);
    console.log(`[RepoJob] Spawned dummy car: ${s.dummyModel} (id ${s.dummyCar.id})`);

    const mp2 = loc.trunkMarkerPos;
    s.trunkMarker = mp.markers.new(1,
        new mp.Vector3(mp2.x, mp2.y, mp2.z - 1.0), 1.0,
        { color: { r: 255, g: 165, b: 0, a: 180 }, visible: true, dimension: 0 }
    );

    s.trunkColshape = mp.colshapes.newSphere(mp2.x, mp2.y, mp2.z, TRUNK_INTERACT_DIST, 0);
    s.trunkColshape.setVariable('repoTrunk', player.id);
    s.trunkColshape.setVariable('interaction', {
        title: 'Dummy Car Trunk',
        text: 'Press ~b~E~w~ to grab the tools',
        event: 'server:repo:grabTools',
        requireOnFoot: true
    });

    // Remove zone blip, add waypoint to trunk marker
    player.call('client:repo:phaseGetTools', [mp2.x, mp2.y, mp2.z]);

    mp.events.call('server:phone:sendMail', player.data.dbId, 'Unknown', 'The package',
        'Check the trunk of the car I left for you. Grab the lock-breaking tools. The car has a tracker installed to find the target.');
}

function startPhase3(player, s) {
    s.phase = 'PHASE_3_RADAR';
    console.log(`[RepoJob] ${player.name} PHASE_3_RADAR`);

    // Clean up trunk interaction objects
    if (s.trunkColshape && mp.colshapes.exists(s.trunkColshape)) { s.trunkColshape.destroy(); s.trunkColshape = null; }
    if (s.trunkMarker   && mp.markers.exists(s.trunkMarker))     { s.trunkMarker.destroy();   s.trunkMarker   = null; }

    const wp = s.wantedLocation.carPos;

    // Tell client: play tool animation, wait for player to board dummy car,
    // then open tracker CEF pointing at wantedPos
    player.call('client:repo:phaseRadar', [s.dummyCar.id, wp.x, wp.y, wp.z]);

    // Server proximity poll: once player is within AMBUSH_SPAWN_DIST, spawn the ambush
    s.proximityInterval = setInterval(() => {
        if (!mp.players.exists(player)) { cleanupSession(player.id); return; }
        const ss = activeSessions.get(player.id);
        if (!ss || ss.phase !== 'PHASE_3_RADAR') return;

        if (dist2D(player.position, wp) <= AMBUSH_SPAWN_DIST) {
            clearInterval(ss.proximityInterval);
            ss.proximityInterval = null;
            startPhase4(player, ss);
        }
    }, 2000);
}

function startPhase4(player, s) {
    s.phase = 'PHASE_4_AMBUSH';
    console.log(`[RepoJob] ${player.name} PHASE_4_AMBUSH`);

    const loc = s.wantedLocation;

    // Spawn locked wanted car (server-side — it needs to be real so player can enter it)
    s.wantedCar = mp.vehicles.new(mp.joaat(s.wantedModel),
        new mp.Vector3(loc.carPos.x, loc.carPos.y, loc.carPos.z),
        { heading: loc.carPos.h, color: [rand([0,1,2,3,11,12]), rand([0,1,2])], locked: true, engine: false, dimension: 0 }
    );
    s.wantedCar.setVariable('repoOwner', player.id);
    console.log(`[RepoJob] Spawned wanted car: ${s.wantedModel} (id ${s.wantedCar.id})`);

    // Build ped spawn data — peds are spawned CLIENT-SIDE only (invisible to other players)
    const count = Math.floor(Math.random() * (AMBUSH_PED_COUNT_MAX - AMBUSH_PED_COUNT_MIN + 1)) + AMBUSH_PED_COUNT_MIN;
    const pedSpawnData = loc.pedSpawns.slice(0, count).map(sp => ({
        model: rand(AMBUSH_PED_MODELS),
        x: sp.x, y: sp.y, z: sp.z, h: sp.h
    }));
    console.log(`[RepoJob] Sending ${pedSpawnData.length} client-side ped spawn(s) to ${player.name}`);

    // Tell client: spawn peds locally, set up lock-break interaction
    player.call('client:repo:phaseAmbush', [
        s.wantedCar.id,
        JSON.stringify(pedSpawnData),
        loc.carPos.x, loc.carPos.y, loc.carPos.z
    ]);
}

function startPhase5(player, s) {
    s.phase = 'PHASE_5_DELIVER';
    console.log(`[RepoJob] ${player.name} PHASE_5_DELIVER`);

    // Destroy dummy car
    if (s.dummyCar && mp.vehicles.exists(s.dummyCar)) { s.dummyCar.destroy(); s.dummyCar = null; }

    // Unlock wanted car
    if (s.wantedCar && mp.vehicles.exists(s.wantedCar)) s.wantedCar.locked = false;

    // Tell client: close radar, set waypoint to DELIVER_POS
    player.call('client:repo:phaseDeliver', [DELIVER_POS.x, DELIVER_POS.y, DELIVER_POS.z]);

    // Poll for delivery
    s.proximityInterval = setInterval(() => {
        if (!mp.players.exists(player)) { cleanupSession(player.id); return; }
        const ss = activeSessions.get(player.id);
        if (!ss || ss.phase !== 'PHASE_5_DELIVER') return;
        if (!player.vehicle) return;
        if (!ss.wantedCar || !mp.vehicles.exists(ss.wantedCar)) return;
        if (player.vehicle.id !== ss.wantedCar.id) return;

        if (dist2D(player.position, DELIVER_POS) <= DELIVER_RADIUS) {
            clearInterval(ss.proximityInterval);
            ss.proximityInterval = null;
            completeJob(player, ss);
        }
    }, 1500);
}

// ──────────────────────────────────────────────────────────────
// COMPLETION
// ──────────────────────────────────────────────────────────────

async function completeJob(player, s) {
    s.phase = 'completed';
    console.log(`[RepoJob] ${player.name} completed repo job! DB ID: ${s.dbJobId}`);

    try {
        await db.query("UPDATE repo_jobs SET status = 'completed' WHERE id = ?", [s.dbJobId]);

        player.removeFromVehicle();
        if (s.wantedCar && mp.vehicles.exists(s.wantedCar)) {
            setTimeout(() => { if (mp.vehicles.exists(s.wantedCar)) s.wantedCar.destroy(); }, 1500);
        }

        // Cash
        const cash = Math.floor(Math.random() * (REWARDS.cashMax - REWARDS.cashMin + 1)) + REWARDS.cashMin;
        await playerManager.addMoneyAndSave(player, cash, `Repo Job: ${s.wantedModel}`);

        // XP
        player.data.xp = (player.data.xp || 0) + REWARDS.xp;
        let xpNeeded = playerManager.calculateNextLevelXp(player.data.level);
        while (player.data.xp >= xpNeeded) {
            player.data.xp -= xpNeeded;
            player.data.level++;
            player.outputChatBox(`!{#f0c400}LEVEL UP! You are now Level ${player.data.level}!`);
            xpNeeded = playerManager.calculateNextLevelXp(player.data.level);
        }
        player.setVariable('level', player.data.level);
        player.setVariable('xp', player.data.xp);
        player.setVariable('xpMax', xpNeeded);

        const rewards = [
            { type: 'money', value: `$${cash.toLocaleString()}` },
            { type: 'xp', value: `${REWARDS.xp} XP` }
        ];
        if (Math.random() < REWARDS.partChance) {
            const partId = rand(REWARDS.partPool);
            const added = await Inventory.addItem(player, partId, 1);
            if (added) {
                try {
                    const ItemRegistry = require('../data/items');
                    const partDef = ItemRegistry[partId];
                    rewards.push({ type: 'generic', value: partDef ? partDef.name : partId });
                } catch (_) {}
            }
        }

        player.call('showCenterPopup', [
            'REPO COMPLETE',
            `${s.wantedModel.toUpperCase()} delivered to ${NPC_NAME}`,
            JSON.stringify(rewards),
            7000
        ]);
        player.call('client:repo:cleanup', []);

        await syncPlayerRepoData(player);
        cleanupSession(player.id);

        setTimeout(() => { if (mp.players.exists(player)) RepoJob.checkSecondJob(player).catch(console.error); }, 3000);
    } catch (err) {
        console.error('[RepoJob] completeJob error:', err);
    }
}

// ──────────────────────────────────────────────────────────────
// SYNC HELPER
// ──────────────────────────────────────────────────────────────

async function syncPlayerRepoData(player) {
    if (!player.logged || !player.data.dbId) return;
    const today = new Date().toISOString().split('T')[0];
    const [jobs] = await db.query('SELECT job_number, status FROM repo_jobs WHERE user_id = ? AND job_date = ?', [player.data.dbId, today]);
    player.call('client:repo:sync', [JSON.stringify(jobs)]);
}

// ──────────────────────────────────────────────────────────────
// MAIN JOB OBJECT — scheduling, login, NPC talk, accept
// ──────────────────────────────────────────────────────────────

const RepoJob = {
    async init() {
        mp.peds.new(mp.joaat(NPC_MODEL), new mp.Vector3(NPC_POS.x, NPC_POS.y, NPC_POS.z),
            { heading: NPC_POS.h, dynamic: false, frozen: true, invincible: true }
        ).setVariable('npcType', 'repo_collector');

        const talkShape = mp.colshapes.newSphere(NPC_POS.x, NPC_POS.y, NPC_POS.z, NPC_TALK_RADIUS, 0);
        talkShape.setVariable('interaction', {
            title: NPC_NAME, text: 'Press ~b~E~w~ to talk',
            event: 'server:repo:talk', requireOnFoot: true
        });

        mp.blips.new(479, new mp.Vector3(NPC_POS.x, NPC_POS.y, NPC_POS.z),
            { name: 'Repo Work', color: 1, shortRange: true, scale: 0.7, dimension: 0 }
        );

        this.scheduleDailyReset();
        this.checkAndSendDailyJobs();
        console.log(`[RepoJob] Initialized. NPC "${NPC_NAME}" ready.`);
    },

    scheduleDailyReset() {
        const now = new Date(), next = new Date(now);
        next.setHours(DAILY_RESET_HOUR, 0, 0, 0);
        if (now >= next) next.setDate(next.getDate() + 1);
        const ms = next.getTime() - now.getTime();
        setTimeout(() => { this.dailyReset(); setInterval(() => this.dailyReset(), 86400000); }, ms);
        console.log(`[RepoJob] Next daily reset in ${Math.round(ms / 60000)} min.`);
    },

    async dailyReset() {
        console.log('[RepoJob] Daily reset running...');
        await this.assignJobsToEligiblePlayers();
    },

    async checkAndSendDailyJobs() {
        const today = new Date().toISOString().split('T')[0];
        const [r] = await db.query('SELECT COUNT(*) as cnt FROM repo_jobs WHERE job_date = ?', [today]);
        if (r[0].cnt === 0) await this.assignJobsToEligiblePlayers();
    },

    async assignJobsToEligiblePlayers() {
        const today = new Date().toISOString().split('T')[0];
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
        const [eligible] = await db.query('SELECT id FROM users WHERE last_active >= ? AND level >= 10', [cutoff.toISOString().split('T')[0]]);
        if (!eligible.length) return console.log('[RepoJob] No eligible players.');

        for (const row of eligible) {
            const uid = row.id;
            const [ex] = await db.query('SELECT COUNT(*) as cnt FROM repo_jobs WHERE user_id = ? AND job_date = ?', [uid, today]);
            if (ex[0].cnt >= 1) continue;
            await db.query("INSERT INTO repo_jobs (user_id, job_date, job_number, target_model, status) VALUES (?, ?, 1, 'pending_minigame', 'available')", [uid, today]);
            mp.events.call('server:phone:sendMail', uid, NPC_NAME, 'Got a job for you', `Hey, it's ${NPC_NAME}. I got some work for you. Come see me behind Luxury Motorsport when you get a chance.`);
            const online = mp.players.toArray().find(p => p.logged && p.data.dbId === uid);
            if (online) await syncPlayerRepoData(online);
        }
        console.log(`[RepoJob] Daily jobs assigned for ${today}.`);
    },

    async talkToNpc(player) {
        if (!player.logged || !player.data.dbId) return;
        if (player.data.level < 10) { player.call('showNotification', [NPC_NAME, 'You need to be Level 10 to handle this work.']); return; }
        if (activeSessions.has(player.id)) { player.call('showNotification', [NPC_NAME, 'Finish your current job first.']); return; }

        const today = new Date().toISOString().split('T')[0];
        const [jobs] = await db.query("SELECT * FROM repo_jobs WHERE user_id = ? AND job_date = ? AND status = 'available' ORDER BY job_number ASC LIMIT 1", [player.data.dbId, today]);
        if (!jobs.length) { player.call('showNotification', [NPC_NAME, 'I got nothing for you right now. Come back later.']); return; }

        const job = jobs[0];
        const LINES = [
            "Some crew thinks they can stiff me on a payment. Teach them a lesson — and bring me their car.",
            "Got a high-roller who owes me big. His ride's somewhere in the city. Go collect it — armed boys may be watching.",
            "Word is there's a sweet car parked up, owned by some clown who ghosted my calls. Bring it back. Watch yourself.",
            "I need someone with nerve for this one. The car you're after is protected. Clear the area, grab the ride.",
            "Easy money: find the ride, deal with whoever thinks they can stop you, drive it here."
        ];

        player.call('client:job:openPreview', [{
            id: `repo_${job.id}`,
            name: NPC_NAME,
            description: `${LINES[Math.floor(Math.random() * LINES.length)]}\n\nI'll set you up with a car and the tools you need. Drive to where I point you, grab the package, then follow the tracker to the target. There'll be heat — deal with it.\n\nPay is good. Don't mess this up.`,
            pos: NPC_POS,
            buttons: [{ label: 'Accept', action: 'accept' }, { label: 'Decline', action: 'cancel' }]
        }]);
    },

    async acceptJob(player, dbJobId) {
        if (!player.logged || !player.data.dbId) return;
        if (activeSessions.has(player.id)) return;

        const [result] = await db.query("UPDATE repo_jobs SET status = 'in_progress' WHERE id = ? AND user_id = ? AND status = 'available'", [dbJobId, player.data.dbId]);
        if (result.affectedRows === 0) { player.call('showNotification', [NPC_NAME, 'Something went wrong. Try again.']); return; }

        const session = {
            phase: 'idle', dbJobId,
            dummyLocation:  rand(DUMMY_LOCATIONS),
            wantedLocation: rand(WANTED_LOCATIONS),
            dummyModel:     rand(DUMMY_CAR_MODELS),
            wantedModel:    rand(WANTED_CAR_MODELS),
            dummyCar: null, wantedCar: null,
            zoneColshape: null, trunkColshape: null, trunkMarker: null,
            proximityInterval: null
        };
        activeSessions.set(player.id, session);

        player.call('showNotification', [NPC_NAME, 'Drive to the marker. A car with the tools is waiting for you.']);
        startPhase1(player, session);
        console.log(`[RepoJob] ${player.name} accepted job #${dbJobId}. Dummy: ${session.dummyModel}, Wanted: ${session.wantedModel}`);
    },

    async checkSecondJob(player) {
        if (!player.logged || !player.data.dbId) return;
        const today = new Date().toISOString().split('T')[0];
        const [jobs] = await db.query('SELECT * FROM repo_jobs WHERE user_id = ? AND job_date = ?', [player.data.dbId, today]);
        if (jobs.length >= MAX_JOBS_PER_DAY || !jobs.length) return;
        const first = jobs.find(j => j.job_number === 1);
        if (!first || first.status !== 'completed') return;
        const playedToday = (player.data.dailyPlaytimeBase || 0) + (player.data.activeMinutes || 0);
        if (playedToday < SECOND_JOB_PLAYTIME) return;

        await db.query("INSERT INTO repo_jobs (user_id, job_date, job_number, target_model, status) VALUES (?, ?, 2, 'pending_minigame', 'available')", [player.data.dbId, today]);
        mp.events.call('server:phone:sendMail', player.data.dbId, NPC_NAME, 'More work available', "Good work earlier. I got another one for you. Come see me when you're ready.");
        await syncPlayerRepoData(player);
        player.call('showNotification', ['Repo Work', 'New repo job available! Go speak with Salvatore.']);
    },

    async onPlayerReady(player) {
        if (!player.logged || !player.data.dbId || player.data.level < 10) return;
        const today = new Date().toISOString().split('T')[0];
        const [ex] = await db.query('SELECT COUNT(*) as cnt FROM repo_jobs WHERE user_id = ? AND job_date = ?', [player.data.dbId, today]);
        if (ex[0].cnt === 0) {
            await db.query("INSERT INTO repo_jobs (user_id, job_date, job_number, target_model, status) VALUES (?, ?, 1, 'pending_minigame', 'available')", [player.data.dbId, today]);
            mp.events.call('server:phone:sendMail', player.data.dbId, NPC_NAME, 'Got a job for you', `Hey, it's ${NPC_NAME}. I got some work for you. Come see me behind Luxury Motorsport when you get a chance.`);
            player.call('showNotification', ['Repo Work', `${NPC_NAME} wants to speak with you.`]);
        }
        await syncPlayerRepoData(player);
    }
};

// ──────────────────────────────────────────────────────────────
// SERVER EVENTS
// ──────────────────────────────────────────────────────────────

mp.events.add('server:repo:talk', player => RepoJob.talkToNpc(player));

mp.events.add('server:job:continue', (player, jobId, action) => {
    if (typeof jobId !== 'string' || !jobId.startsWith('repo_')) return;
    const id = parseInt(jobId.replace('repo_', ''));
    if (!isNaN(id) && action === 'accept') RepoJob.acceptJob(player, id);
});

// Zone colshape entered (server-side playerEnterColshape)
mp.events.add('playerEnterColshape', (player, shape) => {
    const zoneOwner = shape.getVariable('repoZone');
    if (zoneOwner == null || zoneOwner !== player.id) return;
    const s = activeSessions.get(player.id);
    if (!s || s.phase !== 'PHASE_1_FIND_DUMMY') return;
    console.log(`[RepoJob] ${player.name} entered dummy zone.`);
    shape.destroy();
    s.zoneColshape = null;
    startPhase2(player, s);
});

// Player pressed E at trunk colshape (routed via interaction.js)
mp.events.add('server:repo:grabTools', player => {
    const s = activeSessions.get(player.id);
    if (!s || s.phase !== 'PHASE_2_GET_TOOLS') return;
    console.log(`[RepoJob] ${player.name} grabbed tools.`);
    startPhase3(player, s);
});

// Client confirmed player boarded dummy car (optional debug hook)
mp.events.add('server:repo:boardedDummyCar', player => {
    console.log(`[RepoJob] ${player.name} boarded dummy car — tracker CEF active.`);
});

// Client signals lock-break progress bar complete
mp.events.add('server:repo:lockBroken', player => {
    const s = activeSessions.get(player.id);
    if (!s || s.phase !== 'PHASE_4_AMBUSH') return;
    console.log(`[RepoJob] ${player.name} broke the lock.`);
    if (s.wantedCar && mp.vehicles.exists(s.wantedCar)) s.wantedCar.locked = false;
    player.call('client:repo:enterWantedCar', [s.wantedCar ? s.wantedCar.id : -1]);
    startPhase5(player, s);
});

// Player quits job voluntarily
mp.events.add('server:repo:quit', player => {
    const s = activeSessions.get(player.id);
    if (!s) return;
    console.log(`[RepoJob] ${player.name} quit the repo job.`);
    db.query("UPDATE repo_jobs SET status = 'available' WHERE id = ?", [s.dbJobId]).catch(console.error);
    player.call('client:repo:cleanup', []);
    cleanupSession(player.id);
});

// Disconnect cleanup
mp.events.add('playerQuit', player => {
    const s = activeSessions.get(player.id);
    if (s) {
        db.query("UPDATE repo_jobs SET status = 'available' WHERE id = ?", [s.dbJobId]).catch(console.error);
        cleanupSession(player.id);
    }
});

// 2nd job periodic check
setInterval(() => {
    mp.players.forEach(p => { if (p.logged) RepoJob.checkSecondJob(p).catch(console.error); });
}, 5 * 60 * 1000);

RepoJob.init();
module.exports = RepoJob;
