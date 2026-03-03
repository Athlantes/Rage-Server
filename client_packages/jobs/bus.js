let busBrowser = null;

// ============================================================
//  V2 PED SYSTEM — FIXED TIMINGS & AI PATHING
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

// --- Seat indices (Spread out to avoid pathing collisions) ---
const EXIT_SEATS  = [1, 2, 3];       
const BOARD_SEATS = [1, 2, 4, 5, 6];

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
// PED CREATION
// ============================================================
async function spawnPed(position, heading) {
    const hash = await loadModel(randomModel());
    if (!hash) return null;
    try {
        const ped = mp.peds.new(hash, position, heading, mp.players.local.dimension);
        if (!ped) return null;

        await new Promise(r => setTimeout(r, 500));
        if (!mp.peds.exists(ped)) return null;

        ped.setInvincible(true);
        ped.setCanBeTargetted(false);
        ped.setCanRagdoll(false);
        ped.freezePosition(false); 

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

        addTimer(() => playIdleAnim(ped), 150 + i * 100);
    }
});

// ============================================================
// EXITING PASSENGERS
// ============================================================
mp.events.add('client:bus:handleExiting', async (vehId) => {
    const veh = mp.vehicles.atRemoteId(vehId);
    if (!veh || !mp.vehicles.exists(veh)) return;

    const count = 1 + Math.floor(Math.random() * 2); // 1-2

    for (let i = 0; i < count; i++) {
        const vNow = mp.vehicles.atRemoteId(vehId);
        if (!vNow || !mp.vehicles.exists(vNow)) return;

        const safePos = new mp.Vector3(vNow.position.x, vNow.position.y, vNow.position.z - 50);
        const ped = await spawnPed(safePos, vNow.getHeading());
        if (!ped) continue;
        exitingPeds.push(ped);

        const seat = EXIT_SEATS[i % EXIT_SEATS.length];
        ped.setAlpha(0, false);
        ped.setIntoVehicle(vNow.handle, seat);

        addTimer(() => {
            if (!mp.peds.exists(ped)) return;
            const v = mp.vehicles.atRemoteId(vehId);
            if (!v || !mp.vehicles.exists(v)) return;

            ped.setAlpha(255, false);
            ped.resetAlpha();
            ped.taskLeaveVehicle(v.handle, 0);
        }, 400);

        // DELAYED WALK: Increased to 5500ms to let the exit animation naturally finish.
        // REMOVED clearTasks() because it breaks the exit flow.
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
        }, 5500 + i * 500);

        addTimer(() => {
            destroyPed(ped);
            exitingPeds = exitingPeds.filter(p => p !== ped);
        }, 16000);
    }
});

// ============================================================
// BOARDING PASSENGERS
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
        
        // STAGGER FIX: Increased to 1500ms so peds don't pile up and block each other at the door
        const staggerDelay = i * 1500;

        addTimer(() => {
            if (!mp.peds.exists(ped)) return;
            ped.clearTasks();
        }, staggerDelay);

        addTimer(() => {
            if (!mp.peds.exists(ped)) return;
            const v = mp.vehicles.atRemoteId(vehId);
            if (!v || !mp.vehicles.exists(v)) return;
            ped.taskEnterVehicle(v.handle, 12000, seat, 1.0, 1, 0);
        }, 250 + staggerDelay);

        addTimer(() => {
            destroyPed(ped);
            boardingPeds = boardingPeds.filter(p => p !== ped);
        }, 9000 + staggerDelay);
    });
});

mp.events.add('client:bus:cleanupPeds', () => removeAllPeds());
mp.events.add('playerDeath', () => removeAllPeds());