// =============================================================================
//  packages/jobs/definitions/train.js
//  Train Driver Job — Enhanced Version (With Carriages & Fixed Spawns)
// =============================================================================

'use strict';

const jobManager    = require('../jobManager');
const playerManager = require('../../core/playerManager');
const QuestEvents   = require('../../core/questEvents');

const JOB_KEY = 'train';
const DEFAULT_SPEED_CAP = 20.0; // m/s (~72 km/h)

// ── FIXED: Proper Train Track Spawn Coordinates ──────────────────────────────
// Elysian Island / Terminal Freight Tracks (Snaps directly to rail nodes)
const TRAIN_SPAWN = { x: 221.79, y: -2804.30, z: 6.70, h: -0.12 };

// ── FIXED: NPC Placement ─────────────────────────────────────────────────────
// Placed right next to the Elysian Island tracks where the train spawns
const DEPOT_POS = { x: 275.0, y: -2875.0, z: 5.5, h: 270.0 };

// ── ROUTE ─────────────────────────────────────────────────────────────────────
const TRAIN_STATIONS = [
    { name: 'Elysian Island Terminal', x: 286.5, y: -2875.2, z: 4.3 }, // 0 — spawn
    { name: 'La Mesa Rail Yard',       x: 1207.8, y: -2050.0, z: 30.2 }, // 1
    { name: 'Sandy Shores Depot',      x: 1697.0, y: 3077.0, z: 41.2 },  // 2
    { name: 'Paleto Bay Terminal',     x: -1433.0, y: 6330.0, z: 14.0 }, // 3 — final
];

const REWARD = { payPerMeter: 0.12, xpPerMeter: 0.02, levelPayBonus: 0.005, levelXpBonus: 0.010, routeCompBonus: 0.10 };
const STATION_TRIGGER_RADIUS = 30.0;
const STATION_DWELL_MS = 10_000;

const activeJobs = new Map();

function dist3(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2); }

function updateUI(player, statusText, targetPos = null) {
    if (!mp.players.exists(player)) return;
    const job = activeJobs.get(player.id);
    const earned = job ? (job.totalSessionEarnings || 0) : 0;
    const current = job ? job.stationsCompleted : 0;
    const total = TRAIN_STATIONS.length - 1;
    const x = targetPos ? targetPos.x : null;
    const y = targetPos ? targetPos.y : null;
    const z = targetPos ? targetPos.z : null;
    player.call('updateJobUI', [true, statusText, current, total, earned, x, y, z]);
}

function destroyStationShape(job) {
    if (job.stationShape && mp.colshapes.exists(job.stationShape)) job.stationShape.destroy();
    job.stationShape = null;
}

function startJob(player) {
    jobManager.startJobSession(player, JOB_KEY);
    const level = jobManager.getJobLevel(player, JOB_KEY);
    const rankName = jobManager.getRankName(level);

    // 1. Spawn Locomotive
    const train = mp.vehicles.new(mp.joaat('freight'), new mp.Vector3(TRAIN_SPAWN.x, TRAIN_SPAWN.y, TRAIN_SPAWN.z), {
        heading: TRAIN_SPAWN.h, numberPlate: 'LSRR', locked: false, engine: true, dimension: player.dimension
    });

    // 2. ENHANCEMENT: Spawn Carriages behind the engine on the tracks
    // GTA automatically snaps them to the nearest rail node
    /*const carriage1 = mp.vehicles.new(mp.joaat('freightcar'), new mp.Vector3(TRAIN_SPAWN.x - 20, TRAIN_SPAWN.y + 15, TRAIN_SPAWN.z), {
        heading: TRAIN_SPAWN.h, dimension: player.dimension
    });
    const carriage2 = mp.vehicles.new(mp.joaat('freightcar'), new mp.Vector3(TRAIN_SPAWN.x - 40, TRAIN_SPAWN.y + 30, TRAIN_SPAWN.z), {
        heading: TRAIN_SPAWN.h, dimension: player.dimension
    }); */

    train.setVariable('fuel', 100.0);
    train.setVariable('engine', true);
    train.jobOwner = player.id;

    setTimeout(() => {
        if (!mp.players.exists(player) || !mp.vehicles.exists(train)) return;
        player.call('client:warpIntoVehicle', [train.id, -1]);
        
        // Send Engine and Carriage IDs to the client so they move together
        player.call('client:train:setupJob', [train.id, [], DEFAULT_SPEED_CAP]);
    }, 400);

    activeJobs.set(player.id, {
        train,
        carriages: [],
        currentStationIndex: 1,
        stationsCompleted: 0,
        totalRouteEarnings: 0,
        totalSessionEarnings: 0,
        routesCompleted: 0,
        isAtStation: false,
        dwellTimer: null,
        stationShape: null,
        speedCap: DEFAULT_SPEED_CAP,
    });

    player.call('showNotification', ['LSRR Dispatch', `Signed in — Rank: ${rankName} (Lvl ${level})`]);
    setTimeout(() => {
        if (!mp.players.exists(player) || !activeJobs.has(player.id)) return;
        dispatchNextStation(player);
    }, 800);
}

function dispatchNextStation(player) {
    const job = activeJobs.get(player.id);
    if (!job) return;
    const station = TRAIN_STATIONS[job.currentStationIndex];
    destroyStationShape(job);

    const shape = mp.colshapes.newSphere(station.x, station.y, station.z, STATION_TRIGGER_RADIUS);
    shape.dimension = player.dimension;
    shape.isTrainStation = true;
    shape.ownerId = player.id;
    job.stationShape = shape;

    player.call('client:train:setStation', [station.name, station.x, station.y, station.z]);
    updateUI(player, `Drive to ${station.name}`, station);
}

function arriveAtStation(player) {
    const job = activeJobs.get(player.id);
    if (!job || job.isAtStation || !player.vehicle || player.vehicle !== job.train) return;

    job.isAtStation = true;
    destroyStationShape(job);

    const currStation = TRAIN_STATIONS[job.currentStationIndex];
    const segmentDist = dist3(TRAIN_STATIONS[job.currentStationIndex - 1], currStation);
    const level = jobManager.getJobLevel(player, JOB_KEY);
    const segmentPay = Math.floor(segmentDist * REWARD.payPerMeter * (1 + (level * REWARD.levelPayBonus)));
    const segmentXp = Math.floor(segmentDist * REWARD.xpPerMeter * (1 + (level * REWARD.levelXpBonus)));

    player.call('client:train:arrived', [currStation.name, STATION_DWELL_MS]);
    updateUI(player, `Loading/Unloading — ${currStation.name}`, null);

    job.dwellTimer = setTimeout(async () => {
        if (!mp.players.exists(player) || !activeJobs.has(player.id)) return;

        await playerManager.addMoneyAndSave(player, segmentPay, `Train: ${currStation.name}`);
        await jobManager.addJobXp(player, JOB_KEY, segmentXp);
        QuestEvents.emit(player, 'train_station', { count: 1, station: currStation.name });

        job.stationsCompleted++;
        job.totalRouteEarnings += segmentPay;
        job.totalSessionEarnings += segmentPay;
        job.isAtStation = false;
        job.currentStationIndex++;

        player.call('client:showJobSubtitle', [`+$${segmentPay} | +${segmentXp} XP  —  ${currStation.name}`]);

        if (job.currentStationIndex >= TRAIN_STATIONS.length) finishRoute(player);
        else dispatchNextStation(player);
    }, STATION_DWELL_MS);
}

async function finishRoute(player) {
    const job = activeJobs.get(player.id);
    job.routesCompleted++;
    const bonus = Math.floor(job.totalRouteEarnings * REWARD.routeCompBonus);
    job.totalRouteEarnings = 0; 

    if (bonus > 0) {
        await playerManager.addMoneyAndSave(player, bonus, 'Train Route Completion Bonus');
        job.totalSessionEarnings += bonus;
    }

    player.call('client:train:routeComplete');
    player.call('showNotification', ['LSRR Dispatch', `Full route done! Session earnings: ~g~$${job.totalSessionEarnings}~w~`]);
    updateUI(player, 'Route complete — /stopwork', null);
}

function cleanupJob(player) {
    const job = activeJobs.get(player.id);
    if (!job) return;

    if (job.dwellTimer) clearTimeout(job.dwellTimer);
    destroyStationShape(job);
    if (job.train && mp.vehicles.exists(job.train)) job.train.destroy();
    
    // ENHANCEMENT: Clean up carriages
    if (job.carriages) {
        job.carriages.forEach(c => { if (mp.vehicles.exists(c)) c.destroy(); });
    }

    if (mp.players.exists(player)) {
        player.call('client:train:routeComplete');
        player.call('client:train:setupJob', [null, [], 0]); // Disable loop
        player.call('updateJobUI', [false, '', 0, 0, 0, null, null, null]);
    }
    activeJobs.delete(player.id);
}

const JOB_CONFIG = {
    name: 'Train Driver',
    description: 'Operate the LSRR freight locomotive from the LS Freight Depot up to Paleto Bay.',
    previewButtons: [{ label: 'Start Shift', action: 'default' }],
    pedModel: 'S_M_M_GenTransport',
    blipSprite: 326,
    blipColor: 4,
    pos: { ...DEPOT_POS },
};

jobManager.register(JOB_KEY, JOB_CONFIG, {
    onStart: (player) => { startJob(player); },
    onStop:  (player) => { cleanupJob(player); },
});

mp.events.add('playerEnterColshape', (player, shape) => {
    if (shape && shape.isTrainStation && activeJobs.has(player.id) && shape.ownerId === player.id) {
        arriveAtStation(player);
    }
});

mp.events.add('vehicleDeath', (vehicle) => {
    activeJobs.forEach((job, playerId) => {
        if (job.train === vehicle) {
            const player = mp.players.at(playerId);
            if (player && mp.players.exists(player)) {
                player.call('showNotification', ['Job Failed', '~r~The freight locomotive was destroyed!']);
                jobManager.stopJob(player, 'Train Destroyed');
            }
        }
    });
});