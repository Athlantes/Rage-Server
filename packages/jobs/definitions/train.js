// =============================================================================
//  packages/jobs/definitions/train.js
//  Train Driver Job — Los Santos & Rockford Railroad (LSRR)
//
//  ROUTE:  LS Freight Depot → La Mesa Rail Yard → Sandy Shores Depot → Paleto Bay Terminal
//  PAY:    Distance-based ($ per meter between consecutive stations) + level bonus + route bonus
//  END:    At Paleto Bay, player chooses /continueshift (respawn at depot) or /stopwork
//
//  HOW TO ADD THIS JOB TO YOUR SERVER:
//    1. Add `require('./definitions/train');` to packages/jobs/index.js
//    2. Add `require('./train.js');`         to client_packages/jobs/index.js
//
//  SYNC NOTE:
//    The freight train is spawned server-side via mp.vehicles.new so it is
//    natively replicated to all clients by RageMP's entity replication system.
//    No manual netVar broadcasting is needed for the vehicle itself.
// =============================================================================

'use strict';

const jobManager    = require('../jobManager');
const playerManager = require('../../core/playerManager');
const QuestEvents   = require('../../core/questEvents');

// ---------------------------------------------------------------------------
//  CONSTANTS & CONFIGURATION
// ---------------------------------------------------------------------------

const JOB_KEY = 'train';

// ── Speed Cap ────────────────────────────────────────────────────────────────
// Maximum speed sent to the client (m/s). The client applies this via native.
// 20 m/s ≈ 72 km/h — safe for all corners on the freight line.
// Change this value here to reconfigure it server-wide.
const DEFAULT_SPEED_CAP = 20.0; // m/s

// ── Train spawn position ─────────────────────────────────────────────────────
// On the south LS freight track, facing north-east toward La Mesa.
// Fine-tune these coords in-game if the train clips terrain on spawn.
const TRAIN_SPAWN = { x: -1085.0, y: -1968.0, z: 13.2, h: 42.0 };

// ── Job NPC & blip position ───────────────────────────────────────────────────
// Stands near the freight depot dispatch office building.
const DEPOT_POS = { x: -1070.78, y: -2003.37, z: 15.79, h: -125.61 };

// ── Station route ─────────────────────────────────────────────────────────────
// Each entry = one stop on the route.  Index 0 is the spawn/start station;
// the player drives to indices 1, 2, 3 in order.
// Coordinates are on (or very close to) the GTA V freight rail track.
// Adjust Z values if colshapes trigger too early/late on your server build.
const TRAIN_STATIONS = [
    { name: 'LS Freight Depot',    x: -1085.0, y: -1968.0, z: 13.2  }, // 0 — spawn
    { name: 'La Mesa Rail Yard',   x:  1207.8, y: -2050.0, z: 30.2  }, // 1
    { name: 'Sandy Shores Depot',  x:  1697.0, y:  3077.0, z: 41.2  }, // 2
    { name: 'Paleto Bay Terminal', x: -1433.0, y:  6330.0, z: 14.0  }, // 3 — final
];

// ── Rewards ───────────────────────────────────────────────────────────────────
const REWARD = {
    payPerMeter:      0.12,  // base $ per metre of rail covered
    xpPerMeter:       0.02,  // base XP per metre
    levelPayBonus:    0.005, // +0.5% pay multiplier per job level
    levelXpBonus:     0.010, // +1.0% XP multiplier per job level
    routeCompBonus:   0.10,  // 10% completion bonus on top of total route earnings
};

// Radius (metres) of the colshape sphere that triggers station arrival.
// Large enough to catch a moving train reliably.
const STATION_TRIGGER_RADIUS = 30.0;

// How long (ms) the player must wait at each station for loading/unloading.
const STATION_DWELL_MS = 10_000; // 10 seconds

// ---------------------------------------------------------------------------
//  RUNTIME STATE
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} TrainJobData
 * @property {mp.Vehicle}   train                - The spawned freight vehicle
 * @property {number}       currentStationIndex  - Next station index to visit (starts at 1)
 * @property {number}       stationsCompleted    - Stops successfully finished this run
 * @property {number}       totalRouteEarnings   - $ earned this run (reset on /continueshift)
 * @property {number}       totalSessionEarnings - $ earned this entire session
 * @property {number}       routesCompleted      - Full routes finished this session
 * @property {boolean}      isAtStation          - Prevents double-trigger on the colshape
 * @property {NodeJS.Timeout|null} dwellTimer    - setTimeout handle for the dwell period
 * @property {mp.Colshape|null}    stationShape  - Active arrival colshape
 * @property {number}       speedCap             - m/s cap sent to client
 */

/** @type {Map<number, TrainJobData>} playerId → job data */
const activeJobs = new Map();

// ---------------------------------------------------------------------------
//  UTILITY HELPERS
// ---------------------------------------------------------------------------

/**
 * 3-D Euclidean distance between two position objects.
 * @param {{x:number,y:number,z:number}} a
 * @param {{x:number,y:number,z:number}} b
 * @returns {number} distance in metres
 */
function dist3(a, b) {
    return Math.sqrt(
        (a.x - b.x) ** 2 +
        (a.y - b.y) ** 2 +
        (a.z - b.z) ** 2
    );
}

/**
 * Push a job UI update to the player overlay.
 * Mirrors the signature used by garbage / towtruck jobs.
 *
 * @param {mp.Player} player
 * @param {string}    statusText   - Short text shown in the job HUD
 * @param {object|null} targetPos  - {x,y,z} or null to clear waypoint
 */
function updateUI(player, statusText, targetPos = null) {
    if (!mp.players.exists(player)) return;

    const job     = activeJobs.get(player.id);
    const earned  = job ? (job.totalSessionEarnings || 0) : 0;
    const current = job ? job.stationsCompleted          : 0;
    const total   = TRAIN_STATIONS.length - 1; // exclude spawn station
    const x = targetPos ? targetPos.x : null;
    const y = targetPos ? targetPos.y : null;
    const z = targetPos ? targetPos.z : null;

    player.call('updateJobUI', [true, statusText, current, total, earned, x, y, z]);
}

/**
 * Destroy a colshape if it still exists, then null it out on the job object.
 * @param {TrainJobData} job
 */
function destroyStationShape(job) {
    if (job.stationShape && mp.colshapes.exists(job.stationShape)) {
        job.stationShape.destroy();
    }
    job.stationShape = null;
}

// ---------------------------------------------------------------------------
//  CORE JOB FLOW
// ---------------------------------------------------------------------------

/**
 * Called by jobManager when player presses "Start Shift" in the preview UI.
 * Spawns the train, warps the player in, and sends the first station.
 *
 * @param {mp.Player} player
 */
function startJob(player) {
    jobManager.startJobSession(player, JOB_KEY);

    const level    = jobManager.getJobLevel(player, JOB_KEY);
    const rankName = jobManager.getRankName(level);

    // ── Spawn the freight train on the track ──────────────────────────────
    // mp.vehicles.new creates a server-side entity that RageMP replicates
    // to every connected client automatically — no manual sync required.
    const train = mp.vehicles.new(
        mp.joaat('freight'),
        new mp.Vector3(TRAIN_SPAWN.x, TRAIN_SPAWN.y, TRAIN_SPAWN.z),
        {
            heading:     TRAIN_SPAWN.h,
            numberPlate: 'LSRR',
            locked:      false,
            engine:      true,
            dimension:   player.dimension,
        }
    );

    // Initialise shared netVars so clients can read them on stream-in
    train.setVariable('fuel',    100.0);
    train.setVariable('engine',  true);
    train.jobOwner = player.id; // plain server-side property (not synced, only for serverside logic)

    // ── Warp player into the driver's seat (seat -1 = driver) ────────────
    // Short delay lets the entity replicate to the player's client first
    setTimeout(() => {
        if (!mp.players.exists(player) || !mp.vehicles.exists(train)) return;
        player.call('client:warpIntoVehicle', [train.id, -1]);
    }, 350);

    // ── Store job state ───────────────────────────────────────────────────
    activeJobs.set(player.id, {
        train,
        currentStationIndex:  1,    // index 0 is the spawn; first stop is index 1
        stationsCompleted:    0,
        totalRouteEarnings:   0,
        totalSessionEarnings: 0,
        routesCompleted:      0,
        isAtStation:          false,
        dwellTimer:           null,
        stationShape:         null,
        speedCap:             DEFAULT_SPEED_CAP,
    });

    // ── Send speed cap to client ──────────────────────────────────────────
    // The client render loop uses this value to apply SET_TRAIN_CRUISE_SPEED.
    player.call('client:train:setSpeedCap', [DEFAULT_SPEED_CAP]);

    // ── Notify the player ─────────────────────────────────────────────────
    player.call('showNotification', ['LSRR Dispatch', `Signed in — Rank: ${rankName} (Lvl ${level})`]);
    player.call('showNotification', ['LSRR Dispatch', 'Board the locomotive and proceed to La Mesa Rail Yard.']);

    // ── Give first station objective (slight delay so UI is ready) ────────
    setTimeout(() => {
        if (!mp.players.exists(player) || !activeJobs.has(player.id)) return;
        dispatchNextStation(player);
    }, 600);
}

// ---------------------------------------------------------------------------

/**
 * Set up the next station objective:
 *   • Creates a server-side sphere colshape for arrival detection
 *   • Sends `client:train:setStation` so the client draws the blip & marker
 *   • Updates the job HUD
 *
 * @param {mp.Player} player
 */
function dispatchNextStation(player) {
    const job = activeJobs.get(player.id);
    if (!job) return;

    const idx     = job.currentStationIndex;
    const station = TRAIN_STATIONS[idx];

    if (!station) {
        // Shouldn't happen, but guard against out-of-bounds
        console.error(`[Train] dispatchNextStation: station index ${idx} is out of range.`);
        return;
    }

    // ── Create arrival colshape ───────────────────────────────────────────
    // We use newSphere (not newCircle) because train tracks vary in Z value.
    destroyStationShape(job); // clean up any leftover from a previous call

    const shape = mp.colshapes.newSphere(
        station.x, station.y, station.z,
        STATION_TRIGGER_RADIUS
    );
    shape.dimension      = player.dimension;
    shape.isTrainStation = true;   // identifies this shape in playerEnterColshape
    shape.ownerId        = player.id;
    job.stationShape     = shape;

    // ── Tell client to draw blip + marker ─────────────────────────────────
    player.call('client:train:setStation', [
        station.name,
        station.x,
        station.y,
        station.z,
    ]);

    // ── HUD ───────────────────────────────────────────────────────────────
    updateUI(player, `Drive to ${station.name}`, station);
}

// ---------------------------------------------------------------------------

/**
 * Triggered when the train enters the station colshape.
 * Validates the player is in the job train, then starts the dwell timer.
 *
 * @param {mp.Player} player
 */
function arriveAtStation(player) {
    const job = activeJobs.get(player.id);
    if (!job)             return;
    if (job.isAtStation)  return; // already processing this station

    // ── Guard: player must be inside the job train ────────────────────────
    if (!player.vehicle || player.vehicle !== job.train) {
        player.call('showNotification', ['LSRR Dispatch', 'You must be driving the train to dock!']);
        return;
    }

    job.isAtStation = true;
    destroyStationShape(job); // colshape no longer needed

    const idx          = job.currentStationIndex;
    const prevStation  = TRAIN_STATIONS[idx - 1];
    const currStation  = TRAIN_STATIONS[idx];

    // ── Distance-based pay calculation ────────────────────────────────────
    // Reward scales with rail distance covered this segment and job level.
    const segmentDist  = dist3(prevStation, currStation);
    const level        = jobManager.getJobLevel(player, JOB_KEY);
    const payMult      = 1 + (level * REWARD.levelPayBonus);
    const xpMult       = 1 + (level * REWARD.levelXpBonus);
    const segmentPay   = Math.floor(segmentDist * REWARD.payPerMeter * payMult);
    const segmentXp    = Math.floor(segmentDist * REWARD.xpPerMeter  * xpMult);

    // ── Tell client the dwell period has started ──────────────────────────
    // Client will show a countdown subtitle and suppress exit-vehicle control.
    player.call('client:train:arrived', [currStation.name, STATION_DWELL_MS]);

    // Update HUD to "loading" state
    updateUI(player, `Loading/Unloading — ${currStation.name}`, null);
    player.call('showNotification', ['LSRR Dispatch', `Arrived at ${currStation.name}. Cargo loading…`]);

    // ── Dwell timer ───────────────────────────────────────────────────────
    // Simulates loading/unloading time before paying out and advancing.
    job.dwellTimer = setTimeout(async () => {
        // Player may have disconnected or quit during the dwell — check both
        if (!mp.players.exists(player) || !activeJobs.has(player.id)) return;

        // ── Pay & XP ──────────────────────────────────────────────────────
        await playerManager.addMoneyAndSave(player, segmentPay, `Train: ${currStation.name}`);
        await jobManager.addJobXp(player, JOB_KEY, segmentXp);

        // Emit quest event so the quest system can track train deliveries
        QuestEvents.emit(player, 'train_station', { count: 1, station: currStation.name });

        // Update accounting
        job.stationsCompleted++;
        job.totalRouteEarnings   += segmentPay;
        job.totalSessionEarnings += segmentPay;
        job.isAtStation           = false;
        job.currentStationIndex++;

        // Show floating pay notification
        player.call('client:showJobSubtitle', [`+$${segmentPay} | +${segmentXp} XP  —  ${currStation.name}`]);

        // ── Advance or finish ─────────────────────────────────────────────
        if (job.currentStationIndex >= TRAIN_STATIONS.length) {
            // All stations visited → route complete
            finishRoute(player);
        } else {
            // More stations remain → send next objective
            dispatchNextStation(player);
        }

    }, STATION_DWELL_MS);
}

// ---------------------------------------------------------------------------

/**
 * Called after the player reaches the final station (Paleto Bay Terminal).
 * Pays the route completion bonus and prompts the player to continue or quit.
 *
 * @param {mp.Player} player
 */
async function finishRoute(player) {
    const job = activeJobs.get(player.id);
    if (!job) return;

    job.routesCompleted++;

    // ── Route completion bonus ────────────────────────────────────────────
    const routeEarnings = job.totalRouteEarnings;
    job.totalRouteEarnings = 0; // reset for next run

    const bonus = Math.floor(routeEarnings * REWARD.routeCompBonus);
    if (bonus > 0) {
        await playerManager.addMoneyAndSave(player, bonus, 'Train Route Completion Bonus');
        job.totalSessionEarnings += bonus;
        player.call('showNotification', ['LSRR Dispatch', `Route completion bonus: +$${bonus}!`]);
    }

    // ── Tell client to clear station visuals ─────────────────────────────
    player.call('client:train:routeComplete');

    // ── Prompt player to choose next action ──────────────────────────────
    player.call('showNotification', [
        'LSRR Dispatch',
        `Full route done! Session earnings: ~g~$${job.totalSessionEarnings}~w~`,
    ]);
    player.call('showNotification', [
        'LSRR Dispatch',
        'Type ~b~/continueshift~w~ for another run, or ~r~/stopwork~w~ to clock out.',
    ]);

    updateUI(player, 'Route complete — /continueshift or /stopwork', null);
}

// ---------------------------------------------------------------------------

/**
 * Tears down everything belonging to the player's active train job.
 * Called by jobManager.stopJob (via logic.onStop) and also directly on errors.
 *
 * @param {mp.Player} player
 */
function cleanupJob(player) {
    const job = activeJobs.get(player.id);
    if (!job) return;

    // ── Cancel any pending dwell timer ────────────────────────────────────
    if (job.dwellTimer) {
        clearTimeout(job.dwellTimer);
        job.dwellTimer = null;
    }

    // ── Destroy the station colshape ──────────────────────────────────────
    destroyStationShape(job);

    // ── Destroy the train vehicle ─────────────────────────────────────────
    if (job.train && mp.vehicles.exists(job.train)) {
        job.train.destroy();
    }

    // ── Reset client UI & visuals ─────────────────────────────────────────
    if (mp.players.exists(player)) {
        player.call('client:train:routeComplete'); // clears station blip/marker
        player.call('client:train:setSpeedCap',  [0]);  // disables speed cap & render loop
        player.call('updateJobUI', [false, '', 0, 0, 0, null, null, null]);
    }

    activeJobs.delete(player.id);
    console.log(`[Train] Job cleaned up for player ${player.name}.`);
}

// ---------------------------------------------------------------------------
//  JOB REGISTRATION
// ---------------------------------------------------------------------------

const JOB_CONFIG = {
    name:        'Train Driver',
    description: 'Operate the LSRR freight locomotive from the LS Freight Depot up to Paleto Bay. ' +
                 'Stop at each station to load and unload cargo. Longer hauls pay more. ' +
                 'Gain experience to earn higher per-metre pay rates.',
    previewButtons: [{ label: 'Start Shift', action: 'default' }],
    pedModel:    'S_M_M_GenTransport',  // Railroad worker ped
    blipSprite:  326,              // Train icon on the minimap
    blipColor:   4,                // Blue
    pos:         { ...DEPOT_POS },
};

/** Logic hooks called by jobManager */
const logic = {
    onStart: (player) => { startJob(player);   },
    onStop:  (player) => { cleanupJob(player); },
};

jobManager.register(JOB_KEY, JOB_CONFIG, logic);

// ---------------------------------------------------------------------------
//  COMMANDS
// ---------------------------------------------------------------------------

/**
 * /continueshift — Restart the route after finishing at Paleto Bay Terminal.
 * Destroys the old train and spawns a fresh one at the LS Freight Depot.
 */
mp.events.addCommand('continueshift', (player) => {
    // ── Guards ────────────────────────────────────────────────────────────
    if (!player.activeJobId || player.activeJobId !== JOB_KEY) {
        return player.call('showNotification', ['LSRR', 'You are not on the Train Driver job.']);
    }

    const job = activeJobs.get(player.id);
    if (!job) return;

    // Only allow restart after the route is actually complete
    if (job.currentStationIndex < TRAIN_STATIONS.length || job.isAtStation) {
        return player.call('showNotification', ['LSRR', 'Complete your current route first!']);
    }

    // ── Destroy old train ─────────────────────────────────────────────────
    if (job.train && mp.vehicles.exists(job.train)) {
        job.train.destroy();
    }

    // ── Spawn fresh locomotive at the depot ───────────────────────────────
    const newTrain = mp.vehicles.new(
        mp.joaat('freight'),
        new mp.Vector3(TRAIN_SPAWN.x, TRAIN_SPAWN.y, TRAIN_SPAWN.z),
        {
            heading:     TRAIN_SPAWN.h,
            numberPlate: 'LSRR',
            locked:      false,
            engine:      true,
            dimension:   player.dimension,
        }
    );
    newTrain.setVariable('fuel',    100.0);
    newTrain.setVariable('engine',  true);
    newTrain.jobOwner = player.id;

    // ── Reset job state ───────────────────────────────────────────────────
    job.train               = newTrain;
    job.currentStationIndex = 1;
    job.stationsCompleted   = 0;
    job.totalRouteEarnings  = 0;
    job.isAtStation         = false;

    // ── Warp player into driver's seat ────────────────────────────────────
    setTimeout(() => {
        if (!mp.players.exists(player) || !mp.vehicles.exists(newTrain)) return;
        player.call('client:warpIntoVehicle', [newTrain.id, -1]);
    }, 350);

    player.call('showNotification', ['LSRR Dispatch', 'New run started — drive to La Mesa Rail Yard.']);

    // Dispatch first station after warp animation settles
    setTimeout(() => {
        if (!mp.players.exists(player) || !activeJobs.has(player.id)) return;
        dispatchNextStation(player);
    }, 700);
});

// ---------------------------------------------------------------------------
//  EVENTS
// ---------------------------------------------------------------------------

/**
 * Station arrival detection.
 * Only fires for shapes tagged with isTrainStation and owned by this player.
 */
mp.events.add('playerEnterColshape', (player, shape) => {
    if (!shape || !shape.isTrainStation)       return; // not our shape type
    if (!activeJobs.has(player.id))            return; // player not on this job
    if (shape.ownerId !== player.id)           return; // belongs to a different player

    arriveAtStation(player);
});

/**
 * Vehicle destroyed — end the job immediately.
 * Iterates activeJobs because vehicleDeath only gives the vehicle, not the player.
 */
mp.events.add('vehicleDeath', (vehicle) => {
    activeJobs.forEach((job, playerId) => {
        if (job.train !== vehicle) return;

        const player = mp.players.at(playerId);
        if (player && mp.players.exists(player)) {
            player.call('showNotification', ['Job Failed', '~r~The freight locomotive was destroyed!']);
            jobManager.stopJob(player, 'Train Destroyed');
        }
    });
});

/**
 * Player exits the cab while the job is active.
 * Warn them if they leave the train mid-run; allow it at stations.
 */
mp.events.add('playerExitVehicle', (player, vehicle) => {
    if (!activeJobs.has(player.id)) return;

    const job = activeJobs.get(player.id);
    if (job.train !== vehicle) return;

    // At-station exits are fine (dwell period)
    if (job.isAtStation) return;

    // In transit — warn the player
    player.call('showNotification', ['LSRR Dispatch', 'Return to the cab! Stopping en-route is not permitted.']);
});