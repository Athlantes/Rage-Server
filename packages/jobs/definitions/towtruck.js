// packages/jobs/definitions/towtruck.js
// =============================================================================
//  TOW TRUCK JOB — netVar Broadcast Sync
//
//  HOW THE ATTACHMENT SYNC WORKS:
//    1. When player hooks a car, the server sets a netVar on the tow truck:
//         truck.setVariable('towedVehicleId', towed.id)
//    2. Every connected client has an addDataHandler watching 'towedVehicleId'
//       on vehicle entities. When the variable is set or the vehicle streams in,
//       the handler fires and the client calls the native:
//         towedVehicle.attachToTowTruck(towTruck, rear, 0, 0, 0)
//    3. Because netVars are replicated by RageMP to ALL clients automatically,
//       every player — including those who join mid-job or stream in later —
//       will see the attachment. No teleporting. No manual broadcasting.
//    4. To detach, server sets:
//         truck.setVariable('towedVehicleId', null)
//       Every client's dataHandler fires again, sees null, and calls detach.
//
//  This is the same pattern your cable car uses for staticAnim on peds.
// =============================================================================

const jobManager    = require('../jobManager');
const playerManager = require('../../core/playerManager');
const QuestEvents   = require('../../core/questEvents');

const JOB_KEY = 'towtruck';

// ---------------------------------------------------------------------------
//  CONFIG
// ---------------------------------------------------------------------------
const DEPOT_POS   = { x: 407.99,  y: -1631.57, z: 29.29, h: 89.89 };
const IMPOUND_DROP = { x: 397.31, y: -1634.77, z: 29.29 };
const TRUCK_SPAWN  = { x: 421.32, y: -1631.12, z: 29.29, h: 270.0 };

const HOOK_RADIUS     = 6.0;
const IMPOUND_RADIUS  = 12.0;
const TRUCK_PROXIMITY = 20.0; // Truck must be within this distance to hook

// Abandoned car spawn pool — flat road locations across the map
const ABANDONED_CARS = [
    { x: -704.77,  y: -930.54,  z: 19.22, h: 358.0, area: 'Little Seoul'    },
    { x:  124.59,  y: -1711.92, z: 29.21, h: 180.0, area: 'Davis'           },
    { x:  817.68,  y: -1284.05, z: 26.96, h: 2.0,   area: 'Strawberry'      },
    { x: -258.91,  y: -710.88,  z: 33.40, h: 270.0, area: 'Rockford Hills'  },
    { x:  1145.24, y: -980.68,  z: 46.42, h: 180.0, area: 'Vinewood'        },
];

const ABANDONED_MODELS = [
    'premier', 'surge', 'asea', 'ingot', 'stanier',
    'stratum', 'emperor', 'fugitive', 'intruder'
];

function getTowTruckModel(level) {
    if (level >= 60) return 'towtruck';   // Big rig flatbed
    if (level >= 20) return 'towtruck2';  // Medium
    return 'towtruck3';                    // Small starter
}

// ---------------------------------------------------------------------------
//  REWARD CONFIG
// ---------------------------------------------------------------------------
const REWARD_CONFIG = {
    basePayMin:      120,
    basePayMax:      180,
    baseXpMin:       8,
    baseXpMax:       14,
    perLevel:        4,
    distanceBonus:   0.05,   // +5% per km from pickup to impound
    bonusPercentage: 0.12
};

// ---------------------------------------------------------------------------
//  ACTIVE JOBS
// ---------------------------------------------------------------------------
const activeJobs = new Map(); // Map<playerId, jobData>

// ---------------------------------------------------------------------------
//  HELPERS
// ---------------------------------------------------------------------------
function dist3(a, b) {
    return Math.sqrt(
        Math.pow(a.x - b.x, 2) +
        Math.pow(a.y - b.y, 2) +
        Math.pow(a.z - b.z, 2)
    );
}

function randFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function updateUI(player, text, targetPos = null) {
    if (!mp.players.exists(player)) return;
    const job    = activeJobs.get(player.id);
    const earned = job ? (job.totalSessionEarnings || 0) : 0;
    const dels   = job ? job.deliveries : 0;
    const x = targetPos ? targetPos.x : null;
    const y = targetPos ? targetPos.y : null;
    const z = targetPos ? targetPos.z : null;
    player.call('updateJobUI', [true, text, dels, 0, earned, x, y, z]);
}

// ---------------------------------------------------------------------------
//  HOOK ATTACH / DETACH  — via netVar on the tow truck vehicle
//
//  Setting towedVehicleId on the truck triggers every client's dataHandler.
//  The client then calls vehicle.attachToTowTruck(towTruck, rear, 0, 0, 0).
//  Setting it to null makes every client detach.
// ---------------------------------------------------------------------------
function attachTow(truck, towedVehicle) {
    // Store towed vehicle's remote id on the truck as a netVar.
    // RageMP replicates this to all connected clients immediately.
    truck.setVariable('towedVehicleId', towedVehicle.id);
}

function detachTow(truck) {
    truck.setVariable('towedVehicleId', null);
}

// ---------------------------------------------------------------------------
//  JOB FLOW
// ---------------------------------------------------------------------------
function startJob(player) {
    jobManager.startJobSession(player, JOB_KEY);

    const level    = jobManager.getJobLevel(player, JOB_KEY);
    const rankName = jobManager.getRankName(level);
    const model    = getTowTruckModel(level);

    const truck = mp.vehicles.new(mp.joaat(model),
        new mp.Vector3(TRUCK_SPAWN.x, TRUCK_SPAWN.y, TRUCK_SPAWN.z), {
            heading:   TRUCK_SPAWN.h,
            numberPlate: 'LSDOT',
            locked:    false,
            engine:    false,
            dimension: player.dimension
        }
    );
    truck.setVariable('fuel', 100.0);
    truck.setVariable('engine', false);
    truck.setVariable('towedVehicleId', null); // initialise the netVar
    truck.jobOwner = player.id;

    setTimeout(() => {
        if (mp.players.exists(player) && mp.vehicles.exists(truck)) {
            player.call('client:warpIntoVehicle', [truck.id, -1]);
        }
    }, 250);

    activeJobs.set(player.id, {
        truck,
        towedVehicle:         null,
        isTowing:             false,
        hookColshape:         null,
        abandonTimer:         null,
        pickupPos:            null,
        deliveries:           0,
        totalSessionEarnings: 0,
    });

    player.call('showNotification', ['Tow Truck', `Signed in as ${rankName} (Lvl ${level})`]);
    player.call('showNotification', ['Tow Truck', `Truck: ${model.toUpperCase()}`]);

    dispatchNextCall(player);
}

function dispatchNextCall(player) {
    const job = activeJobs.get(player.id);
    if (!job) return;

    // Destroy previous towed vehicle if still around
    if (job.towedVehicle && mp.vehicles.exists(job.towedVehicle)) {
        detachTow(job.truck);
        job.towedVehicle.destroy();
        job.towedVehicle = null;
    }
    job.isTowing = false;

    const call     = randFrom(ABANDONED_CARS);
    const vehModel = randFrom(ABANDONED_MODELS);

    const abandoned = mp.vehicles.new(mp.joaat(vehModel),
        new mp.Vector3(call.x, call.y, call.z), {
            heading:   call.h,
            locked:    true,
            engine:    false,
            dimension: player.dimension
        }
    );
    abandoned.setVariable('fuel', 0);
    abandoned.isTowTarget = true;

    job.towedVehicle = abandoned;
    job.pickupPos    = { x: call.x, y: call.y, z: call.z };

    // Hook colshape — player exits truck, walks up, presses E
    if (job.hookColshape && mp.colshapes.exists(job.hookColshape)) {
        job.hookColshape.destroy();
    }
    const hookShape = mp.colshapes.newSphere(call.x, call.y, call.z, HOOK_RADIUS);
    hookShape.dimension = player.dimension;
    hookShape.isTowHook = true;
    hookShape.ownerId   = player.id;
    hookShape.setVariable('interaction', {
        title:         'Abandoned Vehicle',
        text:          'Press ~b~E~w~ to hook vehicle',
        event:         'server:towtruck:hook',
        requireOnFoot: true
    });
    job.hookColshape = hookShape;

    updateUI(player, `Drive to ${call.area}`, call);
    jobManager.createObjective(player, call, 'Abandoned Vehicle', HOOK_RADIUS + 2, () => {
        updateUI(player, 'Exit truck & hook vehicle', call);
        jobManager.clearObjective(player);
    }, {
        blipSprite:  68,
        blipColor:   1,
        markerColor: [255, 140, 0, 140]
    });

    player.call('showNotification', ['Dispatch', `Abandoned ${vehModel} in ${call.area}`]);
}

function hookVehicle(player) {
    const job = activeJobs.get(player.id);
    if (!job || !job.towedVehicle) return;
    if (job.isTowing) return player.call('showNotification', ['Tow Truck', 'Already towing a vehicle.']);
    if (player.vehicle)  return player.call('showNotification', ['Tow Truck', 'Exit the truck first.']);

    const d = dist3(player.position, job.pickupPos);
    if (d > HOOK_RADIUS + 2) return player.call('showNotification', ['Tow Truck', 'Get closer to the vehicle.']);

    if (!job.truck || !mp.vehicles.exists(job.truck)) {
        return player.call('showNotification', ['Tow Truck', 'Your truck is missing!']);
    }
    if (dist3(job.truck.position, job.pickupPos) > TRUCK_PROXIMITY) {
        return player.call('showNotification', ['Tow Truck', 'Bring the tow truck closer first.']);
    }

    // Destroy hook colshape
    if (job.hookColshape && mp.colshapes.exists(job.hookColshape)) {
        job.hookColshape.destroy();
        job.hookColshape = null;
    }

    job.isTowing = true;

    // Unlock towed car so physics work properly when attached
    job.towedVehicle.locked = false;

    // === THE KEY CALL ===
    // Set the netVar on the truck. Every client's addDataHandler will fire
    // and call vehicle.attachToTowTruck(truck, rear=true, 0, 0, 0) locally.
    attachTow(job.truck, job.towedVehicle);

    player.call('showNotification', ['Tow Truck', 'Hooked! Drive to the impound lot.']);

    // Warp back into truck
    setTimeout(() => {
        if (mp.players.exists(player) && mp.vehicles.exists(job.truck)) {
            player.call('client:warpIntoVehicle', [job.truck.id, -1]);
        }
    }, 300);

    jobManager.clearObjective(player);
    jobManager.createObjective(player, IMPOUND_DROP, 'Impound Lot', IMPOUND_RADIUS, (p) => {
        if (!p.vehicle || p.vehicle.id !== job.truck.id) {
            return p.call('showNotification', ['Tow Truck', 'Drive your tow truck here.']);
        }
        deliverVehicle(p);
    }, {
        blipSprite:  68,
        blipColor:   3,
        markerColor: [0, 200, 80, 150]
    });

    updateUI(player, 'Deliver to Impound Lot', IMPOUND_DROP);
}

async function deliverVehicle(player) {
    const job = activeJobs.get(player.id);
    if (!job || !job.isTowing) return;

    job.isTowing = false;

    // Detach — sets towedVehicleId to null, all clients detach
    detachTow(job.truck);

    // Park towed car at impound then destroy after a delay
    if (job.towedVehicle && mp.vehicles.exists(job.towedVehicle)) {
        job.towedVehicle.position = new mp.Vector3(IMPOUND_DROP.x + 3, IMPOUND_DROP.y, IMPOUND_DROP.z);
        job.towedVehicle.locked   = true;
        const toDestroy = job.towedVehicle;
        setTimeout(() => {
            if (toDestroy && mp.vehicles.exists(toDestroy)) toDestroy.destroy();
        }, 8000);
        job.towedVehicle = null;
    }

    // Pay
    const level = jobManager.getJobLevel(player, JOB_KEY);
    const distKm = dist3(
        job.pickupPos,
        { x: IMPOUND_DROP.x, y: IMPOUND_DROP.y, z: IMPOUND_DROP.z }
    ) / 1000;

    const basePay   = Math.floor(Math.random() * (REWARD_CONFIG.basePayMax - REWARD_CONFIG.basePayMin + 1)) + REWARD_CONFIG.basePayMin;
    const levelBonus = level * REWARD_CONFIG.perLevel;
    const distBonus  = Math.floor(distKm * basePay * REWARD_CONFIG.distanceBonus * 100);
    const totalPay   = basePay + levelBonus + distBonus;

    const baseXp = Math.floor(Math.random() * (REWARD_CONFIG.baseXpMax - REWARD_CONFIG.baseXpMin + 1)) + REWARD_CONFIG.baseXpMin;
    const xp     = baseXp + Math.floor(level * 0.3);

    job.deliveries++;
    job.totalSessionEarnings += totalPay;

    await playerManager.addMoneyAndSave(player, totalPay, 'Tow Truck Delivery');
    await jobManager.addJobXp(player, JOB_KEY, xp);

    QuestEvents.emit(player, 'towtruck_deliver', { count: 1 });

    player.call('client:showJobSubtitle', [`+$${totalPay} | +${xp} XP`]);
    if (distBonus > 0) {
        player.call('showNotification', ['Tow Truck', `Distance bonus: +$${distBonus} (${distKm.toFixed(1)} km)`]);
    }

    setTimeout(() => {
        if (mp.players.exists(player) && activeJobs.has(player.id)) {
            dispatchNextCall(player);
        }
    }, 2500);
}

// ---------------------------------------------------------------------------
//  CLEANUP
// ---------------------------------------------------------------------------
function cleanupJob(player) {
    const job = activeJobs.get(player.id);
    if (!job) return;

    if (job.abandonTimer) { clearTimeout(job.abandonTimer); job.abandonTimer = null; }
    if (job.hookColshape && mp.colshapes.exists(job.hookColshape)) job.hookColshape.destroy();

    if (job.truck && mp.vehicles.exists(job.truck)) {
        detachTow(job.truck); // clears netVar so clients detach cleanly
        job.truck.destroy();
    }
    if (job.towedVehicle && mp.vehicles.exists(job.towedVehicle)) {
        job.towedVehicle.destroy();
    }

    jobManager.clearObjective(player);

    if (mp.players.exists(player)) {
        player.call('updateJobUI', [false, '', 0, 0, 0, null, null, null]);
    }

    activeJobs.delete(player.id);
}

// ---------------------------------------------------------------------------
//  JOB REGISTRATION
// ---------------------------------------------------------------------------
const JOB_CONFIG = {
    name:        'Tow Truck Driver',
    description: 'Respond to dispatch calls and tow abandoned vehicles to the impound lot. Longer hauls pay more.',
    previewButtons: [{ label: 'Start Shift', action: 'default' }],
    pedModel:    's_m_y_construct_01',
    blipSprite:  523,
    blipColor:   4,
    pos:         { ...DEPOT_POS }
};

const logic = {
    onStart: (player) => { startJob(player); },
    onStop:  (player) => { cleanupJob(player); }
};

jobManager.register('towtruck', JOB_CONFIG, logic);

// ---------------------------------------------------------------------------
//  EVENTS
// ---------------------------------------------------------------------------
mp.events.add('server:towtruck:hook', (player) => {
    if (!player.activeJobId || player.activeJobId !== JOB_KEY) return;
    hookVehicle(player);
});

mp.events.add('playerExitVehicle', (player, vehicle) => {
    if (!activeJobs.has(player.id)) return;
    const job = activeJobs.get(player.id);
    if (job.truck !== vehicle) return;
    if (job.abandonTimer) clearTimeout(job.abandonTimer);

    job.abandonTimer = setTimeout(() => {
        if (mp.players.exists(player) && activeJobs.has(player.id)) {
            const j = activeJobs.get(player.id);
            if (j.isTowing) {
                player.call('showNotification', ['Job Failed', 'You abandoned the tow truck.']);
                jobManager.stopJob(player, 'Vehicle Abandoned');
            } else {
                j.abandonTimer = null;
            }
        }
    }, 10 * 60 * 1000);
});

mp.events.add('playerEnterVehicle', (player, vehicle) => {
    if (!activeJobs.has(player.id)) return;
    const job = activeJobs.get(player.id);
    if (job.truck === vehicle && job.abandonTimer) {
        clearTimeout(job.abandonTimer);
        job.abandonTimer = null;
    }
});

mp.events.add('vehicleDeath', (vehicle) => {
    activeJobs.forEach((job, playerId) => {
        if (job.truck === vehicle) {
            const player = mp.players.at(playerId);
            if (player && mp.players.exists(player)) {
                player.call('showNotification', ['Job Failed', 'The tow truck was destroyed!']);
                jobManager.stopJob(player, 'Vehicle Destroyed');
            }
        }
    });
});