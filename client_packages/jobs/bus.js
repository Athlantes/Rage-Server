let busBrowser = null;

// ============================================================
//  V7 PED SYSTEM — GHOST CROWDS, UNDERGROUND SPAWNS & UNBREAKABLE DOORS
// ============================================================

let waitingPeds  = [];
let processingPeds = [];

const wait = (ms) => new Promise(res => setTimeout(res, ms));

const PED_MODELS = [
    'a_f_y_tourist_01', 'a_f_y_business_01', 'a_f_y_bevhills_01',
    'a_m_y_business_03', 'a_m_y_hipster_01', 'a_m_y_downtown_01'
];

const PASSENGER_DOORS = [1, 3]; 

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
// DOOR CONTROL & BREAK PREVENTION
// ============================================================
mp.events.add('client:bus:controlDoors', (vehId, open) => {
    const veh = mp.vehicles.atRemoteId(vehId);
    if (!veh || !mp.vehicles.exists(veh)) return;
    
    PASSENGER_DOORS.forEach(doorId => {
        try {
            // NATIVE: Prevent doors from being physically broken off
            mp.game.invoke('0x17DBAB6CBCEAE0EE', veh.handle, doorId, false);

            if (open) veh.setDoorOpen(doorId, false, false);
            else      veh.setDoorShut(doorId, false);
        } catch (e) {}
    });
});

// ============================================================
// UTILITIES
// ============================================================
function getSafeDoorOffset(veh, rightOffset, forwardOffset) {
    try {
        const pos = veh.getOffsetFromInWorldCoords(rightOffset, forwardOffset, 0.0);
        return new mp.Vector3(pos.x, pos.y, veh.position.z);
    } catch (e) {
        const h = veh.getHeading() * Math.PI / 180;
        return new mp.Vector3(
            veh.position.x + (-Math.sin(h)) * forwardOffset + Math.cos(h) * (-rightOffset),
            veh.position.y +   Math.cos(h)  * forwardOffset + Math.sin(h) * (-rightOffset),
            veh.position.z
        );
    }
}

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

// Added spawnUnderground parameter!
async function createBusPed(pos, heading, spawnUnderground = false) {
    const hash = mp.game.joaat(PED_MODELS[Math.floor(Math.random() * PED_MODELS.length)]);
    mp.game.streaming.requestModel(hash);
    while (!mp.game.streaming.hasModelLoaded(hash)) await wait(50);

    // If underground is true, spawn them at Z - 50. Otherwise, +1.0 for sidewalk.
    const zPos = spawnUnderground ? pos.z - 50.0 : pos.z + 1.0;
    const spawnPos = new mp.Vector3(pos.x, pos.y, zPos);
    
    const ped = mp.peds.new(hash, spawnPos, heading, mp.players.local.dimension);
    
    await wait(250);
    if (!mp.peds.exists(ped)) return null;

    ped.freezePosition(false);
    ped.setInvincible(true);
    ped.setBlockingOfNonTemporaryEvents(true);

    return ped;
}

// ============================================================
// PRE-SPAWN WAITING PEDS (SIDEWALK)
// ============================================================
mp.events.add('client:bus:spawnWaitingPeds', async (stopX, stopY, stopZ, heading) => {
    removeAllPeds();
    const stopPos = new mp.Vector3(stopX, stopY, stopZ);
    const count = 2 + Math.floor(Math.random() * 3); 

    for (let i = 0; i < count; i++) {
        const fwd = -2.0 + i * 1.5;
        const right = 3.5 + Math.random() * 1.5; 
        const pos = posOffset(stopPos, heading, fwd, right);
        const facing = (heading + 180) % 360;

        const ped = await createBusPed(pos, facing, false);
        if (ped) waitingPeds.push(ped);
    }
});

// ============================================================
// EXITS (UNDERGROUND SPAWN -> SEAT -> SIMULTANEOUS WALK)
// ============================================================
mp.events.add('client:bus:handleExiting', async (vehId) => {
    const veh = mp.vehicles.atRemoteId(vehId);
    if (!veh || !mp.vehicles.exists(veh)) return;

    const count = 2 + Math.floor(Math.random() * 2);
    const newPeds = [];

    // 1. Spawn everyone underground first
    for (let i = 0; i < count; i++) {
        const ped = await createBusPed(veh.position, veh.getHeading(), true); // true = UNDERGROUND
        if (!ped) continue;

        processingPeds.push(ped);
        newPeds.push(ped);

        // Turn off collision between the ped and the bus so they don't break doors
        mp.game.entity.setEntityNoCollisionEntity(ped.handle, veh.handle, false);
        
        ped.setAlpha(0, false);
        
        // Warp them from underground directly into the seat
        const seat = (i % 2 === 0) ? 1 : 2; 
        ped.setIntoVehicle(veh.handle, seat);
    }

    await wait(200);

    // 2. Command them all to exit the vehicle at the exact same time
    newPeds.forEach(ped => {
        if (mp.peds.exists(ped)) {
            ped.setAlpha(255, false);
            ped.taskLeaveVehicle(veh.handle, 0);
        }
    });

    // 3. Wait for the exit animation to finish, then walk away simultaneously
    setTimeout(() => {
        newPeds.forEach((ped, i) => {
            if (mp.peds.exists(ped)) {
                const fwdOffset = i % 2 === 0 ? 3.0 : -1.5;
                // Scatter their walk targets so they don't group up
                const walkTarget = getSafeDoorOffset(veh, 6.0 + Math.random() * 2, fwdOffset + (Math.random() * 2 - 1));
                
                // taskGoStraightToCoord ignores queuing completely
                ped.taskGoStraightToCoord(walkTarget.x, walkTarget.y, walkTarget.z, 1.0, 10000, veh.getHeading(), 0.0);
            }
        });
    }, 2200); // Wait ~2.2 seconds for them to stand up from the seat

    // 4. Cleanup
    setTimeout(() => {
        newPeds.forEach(ped => { if (mp.peds.exists(ped)) ped.destroy(); });
    }, 9000);
});

// ============================================================
// BOARDING (SIMULTANEOUS GHOST WALK)
// ============================================================
mp.events.add('client:bus:handleBoarding', async (vehId) => {
    const veh = mp.vehicles.atRemoteId(vehId);
    if (!veh || !mp.vehicles.exists(veh)) return;

    const pedsToBoard = [...waitingPeds];
    waitingPeds = [];

    pedsToBoard.forEach((ped, i) => {
        if (!mp.peds.exists(ped)) return;
        processingPeds.push(ped);
        ped.setBlockingOfNonTemporaryEvents(true);
        ped.clearTasksImmediately();

        // Turn off collision between the ped and the bus
        mp.game.entity.setEntityNoCollisionEntity(ped.handle, veh.handle, false);

        const fwdOffset = i % 2 === 0 ? 3.0 : -1.5;
        
        // Give each ped a slightly different target point near the door
        const targetPos = getSafeDoorOffset(veh, 1.5 + (Math.random() * 0.5), fwdOffset + (Math.random() * 1.5 - 0.75));
        ped.boardTarget = targetPos;

        // taskGoStraightToCoord ignores queuing completely
        ped.taskGoStraightToCoord(targetPos.x, targetPos.y, targetPos.z, 1.0, 15000, veh.getHeading(), 0.0);
    });

    let ticks = 0;
    const monitor = setInterval(() => {
        ticks++;
        if (ticks > 40 || !mp.vehicles.exists(veh)) { 
            clearInterval(monitor);
            pedsToBoard.forEach(p => { if (mp.peds.exists(p)) p.destroy(); });
            return;
        }

        pedsToBoard.forEach(ped => {
            if (mp.peds.exists(ped) && ped.getAlpha() === 255) {
                const dist = mp.game.system.vdist(ped.position.x, ped.position.y, ped.position.z, ped.boardTarget.x, ped.boardTarget.y, ped.boardTarget.z);
                
                if (dist < 1.2) {
                    ped.setAlpha(0, false);
                    setTimeout(() => { if (mp.peds.exists(ped)) ped.destroy(); }, 300);
                }
            }
        });
    }, 250);
});

mp.events.add('client:bus:cleanupPeds', () => removeAllPeds());
mp.events.add('playerDeath', () => removeAllPeds());