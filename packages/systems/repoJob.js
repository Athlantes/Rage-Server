// packages/systems/repoJob.js
// ============================================================
// DAILY REPO JOB — "Salvatore's Collections" — PvE Minigame
// ============================================================

const db            = require('../core/database');
const playerManager = require('../core/playerManager');
const Inventory     = require('./inventory');

// ── CONFIG ──
const NPC_NAME         = 'Salvatore';
const NPC_MODEL        = 'g_m_importexport_01';
const NPC_POS          = { x: -179.86, y: -1178.80, z: 23.13, h: 219.01 };
const DELIVER_POS      = { x: -176.85, y: -1180.85, z: 23.15 };
const DELIVER_RADIUS   = 8.0;
const NPC_TALK_RADIUS  = 2.5;
const DAILY_RESET_HOUR = 7;
const MAX_JOBS_PER_DAY = 2;
const SECOND_JOB_PLAYTIME = 120; // minutes

const DUMMY_CAR_MODELS = ['blista', 'sultan', 'prairie', 'ingot', 'emperor', 'stanier', 'stratum', 'asea', 'asterope', 'premier'];
const WANTED_CAR_MODELS = ['zentorno', 't20', 'adder', 'osiris', 'fmj', 'turismor', 'entityxf', 'vacca', 'cheetah', 'infernus'];

const DUMMY_LOCATIONS = [
    { zoneCenter: { x: 266.43, y: -332.17, z: 44.20 }, carPos: { x: 266.43, y: -332.17, z: 44.20, h: -110.97 }, trunkMarkerPos: { x: 263.60, y: -331.12, z: 45.05 } }
];

const WANTED_LOCATIONS = [
    { carPos: { x: 234.48, y: -1772.20, z: 28.23, h: -99.88 }, pedSpawns: [{ x: 235.08, y: -1769.99, z: 28.66, h: -155.16 }, { x: 231.73, y: -1772.73, z: 28.69, h: -66.66 }, { x: 234.26, y: -1774.13, z: 28.68, h: -10.27 }] }
];

const AMBUSH_PED_MODELS = ['g_m_y_lost_01', 'g_m_y_lost_02', 'g_m_y_ballaorig_01', 'g_m_y_famca_01', 'g_m_y_mexgang_01'];
const AMBUSH_PED_COUNT_MIN = 1;
const AMBUSH_PED_COUNT_MAX = 3;
const TRUNK_INTERACT_DIST  = 4.0;

const REWARDS = { cashMin: 6000, cashMax: 12000, xp: 600, partChance: 0.5, partPool: ['car_part_uncommon', 'car_part_rare', 'car_part_epic'] };
const activeSessions = new Map();

// ── HELPERS ──
const rand = arr => arr[Math.floor(Math.random() * arr.length)];
function dist2D(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }

function cleanupSession(playerId) {
    if (!activeSessions.has(playerId)) return;
    const s = activeSessions.get(playerId);
    if (s.proximityInterval) clearInterval(s.proximityInterval);
    if (s.dummyCar && mp.vehicles.exists(s.dummyCar)) s.dummyCar.destroy();
    if (s.wantedCar && mp.vehicles.exists(s.wantedCar)) s.wantedCar.destroy();
    if (s.zoneColshape && mp.colshapes.exists(s.zoneColshape)) s.zoneColshape.destroy();
    if (s.trunkColshape && mp.colshapes.exists(s.trunkColshape)) s.trunkColshape.destroy();
    if (s.trunkMarker && mp.markers.exists(s.trunkMarker)) s.trunkMarker.destroy();
    activeSessions.delete(playerId);
}

// ── PHASES ──
function startPhase1(player, s) {
    s.phase = 'PHASE_1_FIND_DUMMY';
    const loc = s.dummyLocation;
    s.zoneColshape = mp.colshapes.newSphere(loc.zoneCenter.x, loc.zoneCenter.y, loc.zoneCenter.z, 10.0, 0);
    s.zoneColshape.setVariable('repoZone', player.id);
    player.call('client:repo:showZoneBlip', [loc.zoneCenter.x, loc.zoneCenter.y, loc.zoneCenter.z, 40.0]);
}

function startPhase2(player, s) {
    s.phase = 'PHASE_2_GET_TOOLS';
    const loc = s.dummyLocation;
    
    // Spawn Dummy Car
    s.dummyCar = mp.vehicles.new(mp.joaat(s.dummyModel), new mp.Vector3(loc.carPos.x, loc.carPos.y, loc.carPos.z), { heading: loc.carPos.h, color: [rand([0,1,2,3,11]), rand([0,1,2])], locked: false, engine: false, dimension: 0 });
    
    // Set standard integration flags
    s.dummyCar.setVariable('repoOwner', player.id);
    s.dummyCar.setVariable('fuel', 100);       // Full tank
    s.dummyCar.setVariable('engine', false);   // Engine off initially
    s.dummyCar.setVariable('locked', false);   // Unlocked for player
    s.dummyCar.engine = false;
    s.dummyCar.locked = false;
    
    const mp2 = loc.trunkMarkerPos;
    s.trunkMarker = mp.markers.new(1, new mp.Vector3(mp2.x, mp2.y, mp2.z - 1.0), 1.0, { color: { r: 255, g: 165, b: 0, a: 180 }, visible: true, dimension: 0 });
    s.trunkColshape = mp.colshapes.newSphere(mp2.x, mp2.y, mp2.z, TRUNK_INTERACT_DIST, 0);
    s.trunkColshape.setVariable('repoTrunk', player.id);
    s.trunkColshape.setVariable('interaction', { title: 'Dummy Car Trunk', text: 'Press ~b~E~w~ to grab the tools', event: 'server:repo:grabTools', requireOnFoot: true });
    
    player.call('client:repo:phaseGetTools', [mp2.x, mp2.y, mp2.z]);
    mp.events.call('server:phone:sendMail', player.data.dbId, 'Unknown', 'The package', 'Check the trunk of the car I left for you. Grab the lock-breaking tools. The car has a tracker installed to find the target.');
}

function startPhase3(player, s) {
    s.phase = 'PHASE_3_RADAR';
    if (s.trunkColshape && mp.colshapes.exists(s.trunkColshape)) { s.trunkColshape.destroy(); s.trunkColshape = null; }
    if (s.trunkMarker && mp.markers.exists(s.trunkMarker)) { s.trunkMarker.destroy(); s.trunkMarker = null; }
    
    const wp = s.wantedLocation.carPos;
    player.call('client:repo:phaseRadar', [s.dummyCar.id, wp.x, wp.y, wp.z]);
}

function startPhase4(player, s) {
    s.phase = 'PHASE_4_AMBUSH';
    const loc = s.wantedLocation;
    
    // Spawn Wanted Target Car
    s.wantedCar = mp.vehicles.new(mp.joaat(s.wantedModel), new mp.Vector3(loc.carPos.x, loc.carPos.y, loc.carPos.z), { heading: loc.carPos.h, color: [rand([0,1,2,3]), rand([0,1])], locked: true, engine: false, dimension: 0 });
    
    // Set standard integration flags
    s.wantedCar.setVariable('repoOwner', player.id);
    s.wantedCar.setVariable('fuel', 100);      // Full tank
    s.wantedCar.setVariable('engine', false);  // Engine off
    s.wantedCar.setVariable('locked', true);   // HARD LOCKED - Player must break it
    s.wantedCar.engine = false;
    s.wantedCar.locked = true;
    
    const count = Math.floor(Math.random() * (AMBUSH_PED_COUNT_MAX - AMBUSH_PED_COUNT_MIN + 1)) + AMBUSH_PED_COUNT_MIN;
    const pedSpawnData = loc.pedSpawns.slice(0, count).map(sp => ({ model: rand(AMBUSH_PED_MODELS), x: sp.x, y: sp.y, z: sp.z, h: sp.h }));
    
    player.call('client:repo:phaseAmbush', [s.wantedCar.id, JSON.stringify(pedSpawnData), loc.carPos.x, loc.carPos.y, loc.carPos.z]);
}

function startPhase5(player, s) {
    s.phase = 'PHASE_5_DELIVER';
    if (s.dummyCar && mp.vehicles.exists(s.dummyCar)) { s.dummyCar.destroy(); s.dummyCar = null; }
    
    // Unlock the car once the player breaks it successfully
    if (s.wantedCar && mp.vehicles.exists(s.wantedCar)) {
        s.wantedCar.locked = false;
        s.wantedCar.setVariable('locked', false);
    }
    
    player.call('client:repo:phaseDeliver', [DELIVER_POS.x, DELIVER_POS.y, DELIVER_POS.z]);
    
    s.proximityInterval = setInterval(() => {
        if (!mp.players.exists(player)) { cleanupSession(player.id); return; }
        const ss = activeSessions.get(player.id);
        if (!ss || ss.phase !== 'PHASE_5_DELIVER' || !player.vehicle || !ss.wantedCar || !mp.vehicles.exists(ss.wantedCar)) return;
        
        if (player.vehicle.id === ss.wantedCar.id && dist2D(player.position, DELIVER_POS) <= DELIVER_RADIUS) {
            clearInterval(ss.proximityInterval);
            ss.proximityInterval = null;
            completeJob(player, ss);
        }
    }, 1500);
}

// ── COMPLETION ──
async function completeJob(player, s) {
    s.phase = 'completed';
    try {
        await db.query("UPDATE repo_jobs SET status = 'completed' WHERE id = ?", [s.dbJobId]);
        player.removeFromVehicle();
        if (s.wantedCar && mp.vehicles.exists(s.wantedCar)) setTimeout(() => { if (mp.vehicles.exists(s.wantedCar)) s.wantedCar.destroy(); }, 1500);

        const cash = Math.floor(Math.random() * (REWARDS.cashMax - REWARDS.cashMin + 1)) + REWARDS.cashMin;
        await playerManager.addMoneyAndSave(player, cash, `Repo Job: ${s.wantedModel}`);

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

        const rewards = [{ type: 'money', value: `$${cash.toLocaleString()}` }, { type: 'xp', value: `${REWARDS.xp} XP` }];
        if (Math.random() < REWARDS.partChance) {
            const partId = rand(REWARDS.partPool);
            const added = await Inventory.addItem(player, partId, 1);
            if (added) {
                try {
                    const ItemRegistry = require('../data/items');
                    rewards.push({ type: 'generic', value: ItemRegistry[partId] ? ItemRegistry[partId].name : partId });
                } catch (_) {}
            }
        }

        player.call('showCenterPopup', ['REPO COMPLETE', `${s.wantedModel.toUpperCase()} delivered to ${NPC_NAME}`, JSON.stringify(rewards), 7000]);
        player.call('client:repo:cleanup', []);
        await syncPlayerRepoData(player);
        cleanupSession(player.id);
        setTimeout(() => { if (mp.players.exists(player)) RepoJob.checkSecondJob(player).catch(console.error); }, 3000);
    } catch (err) { console.error('[RepoJob] completeJob error:', err); }
}

async function syncPlayerRepoData(player) {
    if (!player.logged || !player.data.dbId) return;
    const today = new Date().toISOString().split('T')[0];
    const [jobs] = await db.query('SELECT job_number, status FROM repo_jobs WHERE user_id = ? AND job_date = ?', [player.data.dbId, today]);
    player.call('client:repo:sync', [JSON.stringify(jobs)]);
}

// ── MAIN JOB OBJECT ──
const RepoJob = {
    async init() {
        mp.peds.new(mp.joaat(NPC_MODEL), new mp.Vector3(NPC_POS.x, NPC_POS.y, NPC_POS.z), { heading: NPC_POS.h, dynamic: false, frozen: true, invincible: true }).setVariable('npcType', 'repo_collector');
        const talkShape = mp.colshapes.newSphere(NPC_POS.x, NPC_POS.y, NPC_POS.z, NPC_TALK_RADIUS, 0);
        talkShape.setVariable('interaction', { title: NPC_NAME, text: 'Press ~b~E~w~ to talk', event: 'server:repo:talk', requireOnFoot: true });
        mp.blips.new(479, new mp.Vector3(NPC_POS.x, NPC_POS.y, NPC_POS.z), { name: 'Repo Work', color: 1, shortRange: true, scale: 0.7, dimension: 0 });

        this.scheduleDailyReset();
        this.checkAndSendDailyJobs();
    },
    scheduleDailyReset() {
        const now = new Date(), next = new Date(now);
        next.setHours(DAILY_RESET_HOUR, 0, 0, 0);
        if (now >= next) next.setDate(next.getDate() + 1);
        setTimeout(() => { this.dailyReset(); setInterval(() => this.dailyReset(), 86400000); }, next.getTime() - now.getTime());
    },
    async dailyReset() { await this.assignJobsToEligiblePlayers(); },
    async checkAndSendDailyJobs() {
        const today = new Date().toISOString().split('T')[0];
        const [r] = await db.query('SELECT COUNT(*) as cnt FROM repo_jobs WHERE job_date = ?', [today]);
        if (r[0].cnt === 0) await this.assignJobsToEligiblePlayers();
    },
    async assignJobsToEligiblePlayers() {
        const today = new Date().toISOString().split('T')[0], cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
        const [eligible] = await db.query('SELECT id FROM users WHERE last_active >= ? AND level >= 10', [cutoff.toISOString().split('T')[0]]);
        for (const row of eligible) {
            const uid = row.id;
            const [ex] = await db.query('SELECT COUNT(*) as cnt FROM repo_jobs WHERE user_id = ? AND job_date = ?', [uid, today]);
            if (ex[0].cnt >= 1) continue;
            await db.query("INSERT INTO repo_jobs (user_id, job_date, job_number, target_model, status) VALUES (?, ?, 1, 'none', 'available')", [uid, today]);
            mp.events.call('server:phone:sendMail', uid, NPC_NAME, 'Got a job for you', `Hey, it's ${NPC_NAME}. I got some work for you. Come see me behind Luxury Motorsport.`);
            const online = mp.players.toArray().find(p => p.logged && p.data.dbId === uid);
            if (online) await syncPlayerRepoData(online);
        }
    },
    async talkToNpc(player) {
        if (!player.logged || !player.data.dbId) return;
        if (player.data.level < 10) return player.call('showNotification', [NPC_NAME, 'You need to be Level 10 to handle this work.']);
        if (activeSessions.has(player.id)) return player.call('showNotification', [NPC_NAME, 'Finish your current job first.']);

        const today = new Date().toISOString().split('T')[0];
        const [jobs] = await db.query("SELECT * FROM repo_jobs WHERE user_id = ? AND job_date = ? AND status = 'available' ORDER BY job_number ASC LIMIT 1", [player.data.dbId, today]);
        if (!jobs.length) return player.call('showNotification', [NPC_NAME, 'I got nothing for you right now. Come back later.']);

        player.call('client:job:openPreview', [{
            id: `repo_${jobs[0].id}`, name: NPC_NAME,
            description: `I'll set you up with a car and the tools you need. Drive to where I point you, grab the package, then follow the tracker to the target. There'll be heat — deal with it.`,
            pos: NPC_POS, buttons: [{ label: 'Accept', action: 'accept' }, { label: 'Decline', action: 'cancel' }]
        }]);
    },
    async acceptJob(player, dbJobId) {
        if (!player.logged || !player.data.dbId || activeSessions.has(player.id)) return;

        const activeDummyLocs = Array.from(activeSessions.values()).map(s => s.dummyLocation);
        const availableDummys = DUMMY_LOCATIONS.filter(l => !activeDummyLocs.includes(l));
        
        if (availableDummys.length === 0) {
            player.call('showNotification', [NPC_NAME, 'My drop spots are too hot right now. Give me a minute.']);
            return;
        }

        const [result] = await db.query("UPDATE repo_jobs SET status = 'pending' WHERE id = ? AND user_id = ? AND status = 'available'", [dbJobId, player.data.dbId]);
        if (result.affectedRows === 0) return player.call('showNotification', [NPC_NAME, 'Something went wrong. Try again.']);

        const session = {
            phase: 'idle', dbJobId,
            dummyLocation:  rand(availableDummys),
            wantedLocation: rand(WANTED_LOCATIONS),
            dummyModel:     rand(DUMMY_CAR_MODELS),
            wantedModel:    rand(WANTED_CAR_MODELS),
            dummyCar: null, wantedCar: null, zoneColshape: null, trunkColshape: null, trunkMarker: null, proximityInterval: null
        };
        activeSessions.set(player.id, session);
        player.call('showNotification', [NPC_NAME, 'Drive to the marker. A car with the tools is waiting for you.']);
        startPhase1(player, session);
    },
    async checkSecondJob(player) {
        if (!player.logged || !player.data.dbId) return;
        const today = new Date().toISOString().split('T')[0];
        const [jobs] = await db.query('SELECT * FROM repo_jobs WHERE user_id = ? AND job_date = ?', [player.data.dbId, today]);
        if (jobs.length >= MAX_JOBS_PER_DAY || !jobs.length) return;
        if (jobs.find(j => j.job_number === 1)?.status !== 'completed') return;
        if ((player.data.dailyPlaytimeBase || 0) + (player.data.activeMinutes || 0) < SECOND_JOB_PLAYTIME) return;

        await db.query("INSERT INTO repo_jobs (user_id, job_date, job_number, target_model, status) VALUES (?, ?, 2, 'none', 'available')", [player.data.dbId, today]);
        mp.events.call('server:phone:sendMail', player.data.dbId, NPC_NAME, 'More work available', "Good work earlier. I got another one for you. Come see me when you're ready.");
        await syncPlayerRepoData(player);
        player.call('showNotification', ['Repo Work', 'New repo job available! Go speak with Salvatore.']);
    },
    async onPlayerReady(player) {
        if (!player.logged || !player.data.dbId || player.data.level < 10) return;
        const today = new Date().toISOString().split('T')[0];
        const [ex] = await db.query('SELECT COUNT(*) as cnt FROM repo_jobs WHERE user_id = ? AND job_date = ?', [player.data.dbId, today]);
        if (ex[0].cnt === 0) {
            await db.query("INSERT INTO repo_jobs (user_id, job_date, job_number, target_model, status) VALUES (?, ?, 1, 'none', 'available')", [player.data.dbId, today]);
            mp.events.call('server:phone:sendMail', player.data.dbId, NPC_NAME, 'Got a job for you', `Hey, it's ${NPC_NAME}. Come see me behind Luxury Motorsport.`);
        }
        await syncPlayerRepoData(player);
    }
};

// ── EVENTS ──
mp.events.add('server:repo:talk', player => RepoJob.talkToNpc(player));
mp.events.add('server:job:continue', (player, jobId, action) => {
    if (typeof jobId !== 'string' || !jobId.startsWith('repo_')) return;
    const id = parseInt(jobId.replace('repo_', ''));
    if (!isNaN(id) && action === 'accept') RepoJob.acceptJob(player, id);
});
mp.events.add('playerEnterColshape', (player, shape) => {
    if (shape.getVariable('repoZone') !== player.id) return;
    const s = activeSessions.get(player.id);
    if (s && s.phase === 'PHASE_1_FIND_DUMMY') { shape.destroy(); s.zoneColshape = null; startPhase2(player, s); }
});
mp.events.add('server:repo:grabTools', player => {
    const s = activeSessions.get(player.id);
    if (s && s.phase === 'PHASE_2_GET_TOOLS') startPhase3(player, s);
});
mp.events.add('server:repo:boardedDummyCar', player => {});

mp.events.add('server:repo:triggerAmbush', (player) => {
    const s = activeSessions.get(player.id);
    if (!s || s.phase !== 'PHASE_3_RADAR') return;
    
    if (dist2D(player.position, s.wantedLocation.carPos) <= 160.0) {
        startPhase4(player, s);
    }
});

mp.events.add('server:repo:lockBroken', player => {
    const s = activeSessions.get(player.id);
    if (!s || s.phase !== 'PHASE_4_AMBUSH') return;
    
    if (!s.wantedCar || !mp.vehicles.exists(s.wantedCar) || dist2D(player.position, s.wantedCar.position) > 10.0) {
        return; 
    }

    s.wantedCar.locked = false;
    s.wantedCar.setVariable('locked', false);
    
    player.call('client:repo:enterWantedCar', [s.wantedCar.id]);
    startPhase5(player, s);
});

mp.events.add('server:repo:quit', player => {
    const s = activeSessions.get(player.id);
    if (!s) return;
    db.query("UPDATE repo_jobs SET status = 'available' WHERE id = ?", [s.dbJobId]).catch(() => {});
    player.call('client:repo:cleanup', []);
    cleanupSession(player.id);
});
mp.events.add('playerQuit', player => {
    const s = activeSessions.get(player.id);
    if (s) { db.query("UPDATE repo_jobs SET status = 'available' WHERE id = ?", [s.dbJobId]).catch(() => {}); cleanupSession(player.id); }
});
setInterval(() => { mp.players.forEach(p => { if (p.logged) RepoJob.checkSecondJob(p).catch(() => {}); }); }, 5 * 60 * 1000);

RepoJob.init();
module.exports = RepoJob;