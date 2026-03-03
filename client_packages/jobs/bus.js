let busBrowser = null;

// ============================================================
//  V7 PED SYSTEM — NATIVE ENGINE & SMART MONITORING
// ============================================================

let waitingPeds  = [];
let processingPeds = [];

const wait = (ms) => new Promise(res => setTimeout(res, ms));

const PED_MODELS = [
    'a_f_y_tourist_01', 'a_f_y_business_01', 'a_f_y_bevhills_01',
    'a_m_y_business_03', 'a_m_y_hipster_01', 'a_m_y_downtown_01'
];

const PASSENGER_DOORS = [1, 3]; 
const SEATS = [1, 2, 4, 5, 6];

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
    PASSENGER_DOORS.forEach(doorId => {
        try {
            if (open) veh.setDoorOpen(doorId, false, false);
            else      veh.setDoorShut(doorId, false);
        } catch (e) {}
    });
});

// ============================================================
// UTILITIES
// ============================================================
function posOffset(pos, heading, forward, right) {
    const h = heading * Math.PI / 180;
    return new mp.Vector3(
        pos.x + (-Math.sin(h)) * forward + Math.cos(h) * right,
        pos.y +   Math.cos(h)  * forward + Math.sin(h) * right,
        pos.z
    );
}

function removeAllPeds() {
    [...waitingPeds, ...processingPeds].forEach(ped => {
        try { if (ped && mp.peds.exists(ped)) ped.destroy(); } catch (e) {}
    });
    waitingPeds = [];
    processingPeds = [];
}

async function createBusPed(pos, heading) {
    const hash = mp.game.joaat(PED_MODELS[Math.floor(Math.random() * PED_MODELS.length)]);
    mp.game.streaming.requestModel(hash);
    while (!mp.game.streaming.hasModelLoaded(hash)) await wait(50);

    const spawnPos = new mp.Vector3(pos.x, pos.y, pos.z + 1.0); // +1.0 prevents ground clipping
    const ped = mp.peds.new(hash, spawnPos, heading, mp.players.local.dimension);
    
    await wait(250);
    if (!mp.peds.exists(ped)) return null;

    ped.freezePosition(false);
    ped.setInvincible(true);
    ped.setBlockingOfNonTemporaryEvents(true);

    return ped;
}

// ============================================================
// PRE-SPAWN WAITING PEDS
// ============================================================
mp.events.add('client:bus:spawnWaitingPeds', async (stopX, stopY, stopZ, heading) => {
    removeAllPeds();
    const stopPos = new mp.Vector3(stopX, stopY, stopZ);
    const count = 2 + Math.floor(Math.random() * 3); 

    for (let i = 0; i < count; i++) {
        const fwd = -2.0 + i * 1.5;
        const right = 2.5 + Math.random() * 1.5; 
        const pos = posOffset(stopPos, heading, fwd, right);
        const facing = (heading + 180) % 360;

        const ped = await createBusPed(pos, facing);
        if (ped) waitingPeds.push(ped);
    }
});

// ============================================================
// NATIVE EXITING (Using Flag 256)
// ============================================================
mp.events.add('client:bus:handleExiting', async (vehId) => {
    const veh = mp.vehicles.atRemoteId(vehId);
    if (!veh || !mp.vehicles.exists(veh)) return;

    const count = 1 + Math.floor(Math.random() * 2);

    for (let i = 0; i < count; i++) {
        const ped = await createBusPed(veh.position, 0);
        if (!ped) continue;

        processingPeds.push(ped);
        const seat = i === 0 ? 1 : 2; 
        ped.setAlpha(0, false);
        ped.setIntoVehicle(veh.handle, seat);
        
        await wait(200);
        if (!mp.peds.exists(ped) || !mp.vehicles.exists(veh)) continue;

        ped.setAlpha(255, false);
        
        // FLAG 256: Normal exit but does not close the door. Perfect for bus.
        ped.taskLeaveVehicle(veh.handle, 256);

        // Monitor until they are out of the vehicle
        let checks = 0;
        while (checks < 30) { 
            await wait(300);
            if (!mp.peds.exists(ped)) break;
            
            // 0 means they are completely on foot
            if (ped.getVehicleIsIn(false) === 0) break; 
            checks++;
        }

        // Walk to the sidewalk
        if (mp.peds.exists(ped) && mp.vehicles.exists(veh)) {
            const walkTarget = posOffset(ped.position, veh.getHeading(), -5 - (Math.random() * 4), 5 + Math.random() * 2);
            ped.taskFollowNavMeshToCoord(walkTarget.x, walkTarget.y, walkTarget.z, 1.0, 10000, 0.5, false, 0);
            
            setTimeout(() => { if (mp.peds.exists(ped)) ped.destroy(); }, 7000);
        }
        
        await wait(1500); // Give them time to step down before the next person tries
    }
});

// ============================================================
// NATIVE BOARDING (With Smart Fallback Monitoring)
// ============================================================
mp.events.add('client:bus:handleBoarding', async (vehId) => {
    const veh = mp.vehicles.atRemoteId(vehId);
    if (!veh || !mp.vehicles.exists(veh)) return;

    const pedsToBoard = [...waitingPeds];
    waitingPeds = [];

    for (let i = 0; i < pedsToBoard.length; i++) {
        const ped = pedsToBoard[i];
        if (!mp.peds.exists(ped)) continue;
        
        processingPeds.push(ped);
        ped.setBlockingOfNonTemporaryEvents(false);
        ped.clearTasksImmediately();

        const seat = SEATS[i % SEATS.length];
        
        // Mode 1: Walk normally to the vehicle and enter
        ped.taskEnterVehicle(veh.handle, 15000, seat, 1.0, 1, 0);

        let checks = 0;
        let successfullyEntered = false;

        // Smart Monitor Loop
        while (checks < 40) { 
            await wait(300);
            if (!mp.peds.exists(ped) || !mp.vehicles.exists(veh)) break;
            
            // 1. Are they officially inside?
            if (ped.getVehicleIsIn(false) === veh.handle) {
                successfullyEntered = true;
                break;
            }

            // 2. Are they stuck/giving up?
            const tryingVeh = ped.getVehicleIsTryingToEnter();
            if (tryingVeh === 0 && checks > 10) {
                // If 3 seconds have passed and they aren't even trying to enter a vehicle anymore, they are stuck.
                break; 
            }

            checks++;
        }

        if (mp.peds.exists(ped) && mp.vehicles.exists(veh)) {
            if (!successfullyEntered) {
                // FALLBACK: Mode 16 (Teleports directly into vehicle)
                // If they got stuck on the stairs or stopped trying, this forces them safely into the seat so the job doesn't break
                ped.taskEnterVehicle(veh.handle, 2000, seat, 1.0, 16, 0);
                await wait(500); 
            }

            // They are inside! Make invisible and delete
            ped.setAlpha(0, false);
            setTimeout(() => { if (mp.peds.exists(ped)) ped.destroy(); }, 500);
        }

        // Wait for Ped 1 to clear the door before telling Ped 2 to walk
        await wait(1200); 
    }
});

mp.events.add('client:bus:cleanupPeds', () => removeAllPeds());
mp.events.add('playerDeath', () => removeAllPeds());