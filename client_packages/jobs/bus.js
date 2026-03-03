let busBrowser = null;

// ============================================================
//  V2 PED SYSTEM — MINIMAL FLAGS, MAXIMUM RELIABILITY
//
//  Root cause of ALL previous failures:
//  - setSeeingRange(0), setHearingRange(0), setAlertness(0),
//    setConfigFlag(32), setCombatAttributes(46), freezePosition(true),
//    setBlockingOfNonTemporaryEvents(true), setKeepTask(true)
//    ALL put the ped AI into a dormant state where navigation
//    tasks (taskEnterVehicle, taskLeaveVehicle, navmesh walk)
//    are silently ignored. Only taskPlayAnim worked because it
//    animates the skeleton without needing AI pathfinding.
//
//  V2 FIX: Only 3 safety flags (invincible, no target, no ragdoll).
//  The ped AI is completely free to process any task.
//  clearTasks() and new tasks are on SEPARATE game frames.
//  taskLeaveVehicle uses flag 0 (normal exit) not 256 (warp).
// ============================================================

// --- Tracking ---
let waitingPeds  = [];
let exitingPeds  = [];
let boardingPeds = [];
let allTimers    = [];

// --- Ped models (diverse civilian mix) ---
const PED_MODELS = [
    'a_f_y_tourist_01',   'a_f_y_fitness_01',    'a_f_y_bevhills_01',
    'a_f_y_scdressy_01',  'a_f_y_business_01',   'a_f_y_hipster_02',
    'a_f_y_bevhills_02',  'a_f_y_tourist_02',    'a_f_y_vinewood_02',
    'a_f_m_beach_01',     'a_f_m_ktown_01',      'a_f_y_clubcust_01',
    'a_m_y_business_03',  'a_m_y_hipster_01',    'a_m_y_stwhi_02',
    'a_m_y_downtown_01',  'a_m_y_genstreet_02',  'a_m_y_vinewood_01',
    'a_m_y_beach_03',     'a_m_y_bevhills_01',   'a_m_y_musclbeac_02',
    'a_m_m_business_01',  'a_m_m_soucent_03',    'a_m_m_afriamer_01',
    'a_m_m_tourist_01',   'a_m_m_eastsa_02'
];

// --- Idle animations (null = default standing pose) ---
const IDLE_ANIMS = [
    { dict: 'amb@world_human_stand_mobile@male@standing@call@idle_a', name: 'idle_a' },
    { dict: 'amb@world_human_stand_mobile@female@standing@call@idle_a', name: 'idle_a' },
    { dict: 'anim@heists@heist_corona@single_team', name: 'single_team_loop_boss' },
    { dict: 'amb@world_human_hang_out_street@female_hold_arm@idle_a', name: 'idle_a' },
    { dict: 'amb@world_human_stand_impatient@male@no_sign@idle_a', name: 'idle_a' },
    null
];

// --- Seat indices ---
const EXIT_SEATS  = [0, 3];       // seat 0 = front door, seat 3 = middle/rear door
const BOARD_SEATS = [0, 1, 2, 3];

// ============================================================
// MENU
// ============================================================
mp.events.add('client:bus:openMenu', (routesJson) => {
    if (busBrowser) return;
    busBrowser = mp.browsers.new("package://ui/bus/index.html");
    mp.gui.cursor.show(true, true);
    setTimeout(() => {
        if (busBrowser) busBrowser.execute(`loadBusRoutes('${routesJson}');`);
    }, 250);
});

mp.events.add('client:bus:closeMenu', () => {
    if (busBrowser) { busBrowser.destroy(); busBrowser = null; }
    mp.gui.cursor.show(false, false);
});

mp.events.add('client:bus:select', (index) => {
    mp.events.call('client:bus:closeMenu');
    mp.events.callRemote('server:bus:selectRoute', index);
});

// ============================================================
// DOOR CONTROL
// ============================================================
mp.events.add('client:bus:controlDoors', (vehId, open) => {
    const veh = mp.vehicles.atRemoteId(vehId);
    if (!veh || !mp.vehicles.exists(veh)) return;
    for (let d = 0; d <= 5; d++) {
        try {
            if (open) veh.setDoorOpen(d, false, false);
            else      veh.setDoorShut(d, false);
        } catch (e) {}
    }
});

// ============================================================
// UTILITIES
// ============================================================
function randomModel() {
    return PED_MODELS[Math.floor(Math.random() * PED_MODELS.length)];
}

function loadModel(name) {
    return new Promise(resolve => {
        const hash = mp.game.joaat(name);
        if (mp.game.streaming.hasModelLoaded(hash)) return resolve(hash);
        mp.game.streaming.requestModel(hash);
        let n = 0;
        const iv = setInterval(() => {
            if (mp.game.streaming.hasModelLoaded(hash)) { clearInterval(iv); resolve(hash); }
            else if (++n > 100) { clearInterval(iv); resolve(null); }
        }, 50);
    });
}

function loadAnimDict(dict) {
    return new Promise(resolve => {
        if (mp.game.streaming.hasAnimDictLoaded(dict)) return resolve(true);
        mp.game.streaming.requestAnimDict(dict);
        let n = 0;
        const iv = setInterval(() => {
            if (mp.game.streaming.hasAnimDictLoaded(dict)) { clearInterval(iv); resolve(true); }
            else if (++n > 60) { clearInterval(iv); resolve(false); }
        }, 50);
    });
}

function posOffset(pos, heading, forward, right) {
    const h = heading * Math.PI / 180;
    return new mp.Vector3(
        pos.x + (-Math.sin(h)) * forward + Math.cos(h) * right,
        pos.y +   Math.cos(h)  * forward + Math.sin(h) * right,
        pos.z
    );
}

function addTimer(fn, delay) {
    const t = setTimeout(() => { fn(); allTimers = allTimers.filter(x => x !== t); }, delay);
    allTimers.push(t);
    return t;
}

function destroyPed(ped) {
    try { if (ped && mp.peds.exists(ped)) ped.destroy(); } catch (e) {}
}

function destroyPedList(list) {
    list.forEach(p => destroyPed(p));
    list.length = 0;
}

function removeAllPeds() {
    destroyPedList(waitingPeds);
    destroyPedList(exitingPeds);
    destroyPedList(boardingPeds);
    allTimers.forEach(t => clearTimeout(t));
    allTimers = [];
}

// ============================================================
// V2 PED CREATION
//
// ONLY 3 safety flags. Nothing else. The ped's full AI and
// pathfinding system remains active and unblocked.
// ============================================================
async function spawnPed(position, heading) {
    const hash = await loadModel(randomModel());
    if (!hash) return null;
    try {
        const ped = mp.peds.new(hash, position, heading, mp.players.local.dimension);
        if (!ped) return null;

        // Wait for entity to FULLY register in the game engine
        await new Promise(r => setTimeout(r, 500));
        if (!mp.peds.exists(ped)) return null;

        // Safety flags ONLY — does NOT touch AI, tasks, or movement
        ped.setInvincible(true);
        ped.setCanBeTargetted(false);
        ped.setCanRagdoll(false);
        ped.freezePosition(false);  // CRITICAL: RAGE:MP defaults new peds to frozen

        mp.game.streaming.setModelAsNoLongerNeeded(hash);
        return ped;
    } catch (e) { return null; }
}

async function playIdleAnim(ped) {
    const anim = IDLE_ANIMS[Math.floor(Math.random() * IDLE_ANIMS.length)];
    if (!anim || !ped || !mp.peds.exists(ped)) return;
    const ok = await loadAnimDict(anim.dict);
    if (ok && mp.peds.exists(ped)) {
        ped.taskPlayAnim(anim.dict, anim.name, 8.0, 1.0, -1, 1, 0.0, false, false, false);
    }
}

// ============================================================
// PRE-SPAWN WAITING PEDS
// Called when a new checkpoint is created. Player sees NPCs
// standing at the stop while driving toward it.
// ============================================================
mp.events.add('client:bus:spawnWaitingPeds', async (stopX, stopY, stopZ, heading) => {
    destroyPedList(exitingPeds);
    destroyPedList(waitingPeds);

    const stopPos = new mp.Vector3(stopX, stopY, stopZ);
    const count = 2 + Math.floor(Math.random() * 3); // 2-4

    for (let i = 0; i < count; i++) {
        const fwd   = -2.0 + i * 1.8 + (Math.random() * 0.6 - 0.3);
        const right = 2.5 + Math.random() * 1.5;
        const spawnPos = posOffset(stopPos, heading, fwd, right);
        const facing = (heading + 180 + (Math.random() * 40 - 20)) % 360;

        const ped = await spawnPed(spawnPos, facing);
        if (!ped) continue;
        waitingPeds.push(ped);

        // Idle animation after a brief tick
        addTimer(() => playIdleAnim(ped), 150 + i * 100);
    }
});

// ============================================================
// EXITING PASSENGERS
//
// Flow: spawn underground (invisible) → setIntoVehicle (warp to
// seat) → make visible → taskLeaveVehicle flag 0 (REAL exit
// animation) → after exit completes, walk to sidewalk.
//
// The ped has NO flags blocking AI, so taskLeaveVehicle will
// play the full stepping-out animation.
// ============================================================
mp.events.add('client:bus:handleExiting', async (vehId) => {
    const veh = mp.vehicles.atRemoteId(vehId);
    if (!veh || !mp.vehicles.exists(veh)) return;

    const count = 1 + Math.floor(Math.random() * 2); // 1-2

    for (let i = 0; i < count; i++) {
        const vNow = mp.vehicles.atRemoteId(vehId);
        if (!vNow || !mp.vehicles.exists(vNow)) return;

        // Spawn underground — ped is below the world, safe from collisions
        const safePos = new mp.Vector3(
            vNow.position.x,
            vNow.position.y,
            vNow.position.z - 50
        );
        const ped = await spawnPed(safePos, vNow.getHeading());
        if (!ped) continue;
        exitingPeds.push(ped);

        const seat = EXIT_SEATS[i % EXIT_SEATS.length];

        // Hide while positioning
        ped.setAlpha(0, false);

        // Warp into bus seat (works instantly regardless of ped position)
        ped.setIntoVehicle(vNow.handle, seat);

        // FRAME B (400ms later): make visible + real exit animation
        // Flag 0 = normal exit with full animation (NOT 256 which warps)
        addTimer(() => {
            if (!mp.peds.exists(ped)) return;
            const v = mp.vehicles.atRemoteId(vehId);
            if (!v || !mp.vehicles.exists(v)) return;

            ped.setAlpha(255, false);
            ped.resetAlpha();
            ped.taskLeaveVehicle(v.handle, 0);
        }, 400);

        // After exit animation (~4s): lock AI so ambient behavior can't override,
        // clear tasks, then give walk on a separate frame
        addTimer(() => {
            if (!mp.peds.exists(ped)) return;
            ped.setBlockingOfNonTemporaryEvents(true);
            ped.clearTasks();
        }, 4500 + i * 300);

        // SEPARATE FRAME (350ms later): walk to sidewalk
        addTimer(() => {
            if (!mp.peds.exists(ped)) return;
            const v = mp.vehicles.atRemoteId(vehId);
            const heading = v && mp.vehicles.exists(v) ? v.getHeading() : 0;
            const pedPos = ped.position;
            const dir = Math.random() > 0.5 ? 1 : -1;
            const walkTarget = posOffset(
                pedPos, heading,
                dir * (10 + Math.random() * 6),
                3 + Math.random() * 2
            );
            try {
                ped.taskFollowNavMeshToCoord(
                    walkTarget.x, walkTarget.y, walkTarget.z,
                    1.0, 14000, 0.5, true, 0
                );
            } catch (e) {}
        }, 4850 + i * 300);

        // Safety-net despawn
        addTimer(() => {
            destroyPed(ped);
            exitingPeds = exitingPeds.filter(p => p !== ped);
        }, 16000);
    }
});

// ============================================================
// BOARDING PASSENGERS
//
// Flow: clearTasks (stop idle anim) on frame A → 350ms later
// on frame B, taskEnterVehicle (walks to nearest door + enters).
//
// CRITICAL: clearTasks and taskEnterVehicle MUST be on different
// game frames. Previous versions did both in one frame which
// caused the engine to clear the new task too.
//
// The ped has NO freezePosition, NO setBlockingOfNonTemporary-
// Events — the AI is free to pathfind and execute vehicle tasks.
// ============================================================
mp.events.add('client:bus:handleBoarding', (vehId) => {
    const veh = mp.vehicles.atRemoteId(vehId);
    if (!veh || !mp.vehicles.exists(veh)) return;

    const pedsToBoard = [...waitingPeds];
    waitingPeds = [];
    if (pedsToBoard.length === 0) return;

    pedsToBoard.forEach((ped, i) => {
        if (!mp.peds.exists(ped)) return;
        boardingPeds.push(ped);

        const seat = BOARD_SEATS[i % BOARD_SEATS.length];

        // FRAME A: stop the idle animation (staggered per ped)
        addTimer(() => {
            if (!mp.peds.exists(ped)) return;
            ped.clearTasks();
        }, i * 500);

        // FRAME B (350ms after clearTasks): walk to bus + enter
        // mode 1 = walk to vehicle door and get in, speed 1.0 = walk
        addTimer(() => {
            if (!mp.peds.exists(ped)) return;
            const v = mp.vehicles.atRemoteId(vehId);
            if (!v || !mp.vehicles.exists(v)) return;
            ped.taskEnterVehicle(v.handle, 12000, seat, 1.0, 1, 0);
        }, 350 + i * 500);

        // Despawn after walk + enter animation
        addTimer(() => {
            destroyPed(ped);
            boardingPeds = boardingPeds.filter(p => p !== ped);
        }, 8500 + i * 500);
    });
});

// ============================================================
// CLEANUP
// ============================================================
mp.events.add('client:bus:cleanupPeds', () => removeAllPeds());
mp.events.add('playerDeath', () => removeAllPeds());