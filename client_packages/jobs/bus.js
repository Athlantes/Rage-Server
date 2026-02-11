let busBrowser = null;
let jobPeds = [];     // Waiting passengers
let leavingPeds = []; // Passengers getting off

// --- MENU EVENTS ---
mp.events.add('client:bus:openMenu', (routesJson) => {
    if (busBrowser) return;
    busBrowser = mp.browsers.new("package://ui/bus/index.html");
    mp.gui.cursor.show(true, true);
    setTimeout(() => {
        if(busBrowser) busBrowser.execute(`loadBusRoutes('${routesJson}');`);
    }, 250);
});

mp.events.add('client:bus:closeMenu', () => {
    if (busBrowser) {
        busBrowser.destroy();
        busBrowser = null;
    }
    mp.gui.cursor.show(false, false);
});

mp.events.add('client:bus:select', (index) => {
    mp.events.call('client:bus:closeMenu');
    mp.events.callRemote('server:bus:selectRoute', index);
});

// --- NPC LOGIC ---

// 1. Spawn Waiting Peds
mp.events.add('client:bus:spawnPeds', (stopData) => {
    cleanupPeds(); 

    const stopPos = new mp.Vector3(stopData.x, stopData.y, stopData.z);
    const skins = ['a_f_y_hipster_01', 'a_m_y_business_01', 'a_m_m_tourist_01', 'a_f_m_bevhills_01', 'a_m_m_skater_01', 'a_m_m_farmer_01'];
    const count = Math.floor(Math.random() * 2) + 1; 

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * 6.28;
        const dist = 2.5 + Math.random() * 1.5;
        const offsetX = stopPos.x + Math.cos(angle) * dist;
        const offsetY = stopPos.y + Math.sin(angle) * dist;

        const ped = mp.peds.new(
            mp.game.joaat(skins[Math.floor(Math.random() * skins.length)]), 
            new mp.Vector3(offsetX, offsetY, stopPos.z),
            Math.random() * 360, 
            0 
        );

        if (ped) {
            ped.setBlockingOfNonTemporaryEvents(true);
            ped.setInvincible(true);
            ped.freezePosition(false);
            ped.taskTurnToFaceCoord(stopPos.x, stopPos.y, stopPos.z, 0);
            jobPeds.push(ped);
        }
    }
});

// 2. Handle Boarding & Exiting
mp.events.add('client:bus:handlePedActions', (vehRemoteId) => {
    const bus = mp.vehicles.atRemoteId(vehRemoteId);
    if (!bus || !bus.handle) return;

    // --- A. BOARDING LOGIC ---
    jobPeds.forEach((ped, index) => {
        if (mp.peds.exists(ped)) {
            // FIX: Disable collision so they don't push the bus
            ped.setNoCollision(bus.handle, false);

            const doorPos = bus.getOffsetFromInWorldCoords(1.5, 3.0, 0.0); // Front-Right door area
            
            // Walk to door
            ped.taskGoToCoordAnyMeans(doorPos.x, doorPos.y, doorPos.z, 1.2, 0, false, 786603, 1.0);

            // Enter vehicle
            setTimeout(() => {
                if (mp.peds.exists(ped) && mp.vehicles.exists(bus)) {
                    // Force passenger seat (0-6), NEVER driver (-1)
                    const safeSeat = Math.floor(Math.random() * 6); 
                    ped.taskEnterVehicle(bus.handle, 10000, safeSeat, 1.5, 1, 0);
                }
            }, 1500 + (index * 800)); 
        }
    });

    // --- B. ALIGHTING LOGIC ---
    if (Math.random() > 0.3) { 
        const leaverCount = Math.floor(Math.random() * 2) + 1;
        const skins = ['a_f_y_genhot_01', 'a_m_m_business_01'];

        for(let i = 0; i < leaverCount; i++) {
            const skin = skins[Math.floor(Math.random() * skins.length)];
            
            // Spawn directly at bus position (invisible at first)
            const pLeaving = mp.peds.new(mp.game.joaat(skin), bus.position, 0, 0);

            setTimeout(() => {
                if(mp.peds.exists(pLeaving) && mp.vehicles.exists(bus)) {
                    
                    // CRITICAL FIX: Disable collision with bus so they don't launch it
                    pLeaving.setNoCollision(bus.handle, false);

                    // Put in seat
                    const safeSeat = Math.floor(Math.random() * 6);
                    pLeaving.setIntoVehicle(bus.handle, safeSeat); 
                    
                    // Task to leave (Flag 256 = Leave door open)
                    pLeaving.taskLeaveVehicle(bus.handle, 256);

                    // Walk away after stepping out
                    setTimeout(() => {
                        if (mp.peds.exists(pLeaving)) {
                            const wanderDest = bus.getOffsetFromInWorldCoords(5.0, 0.0, 0.0);
                            const wanderX = wanderDest.x + (Math.random() * 4 - 2);
                            const wanderY = wanderDest.y + (Math.random() * 4 - 2);
                            
                            pLeaving.taskGoToCoordAnyMeans(wanderX, wanderY, bus.position.z, 1.0, 0, false, 786603, 0);
                        }
                    }, 3500); 
                    
                    leavingPeds.push(pLeaving);
                }
            }, 100);
        }
    }
});

// 3. Cleanup
mp.events.add('client:bus:cleanupPeds', () => {
    cleanupPeds();
});

mp.events.add('client:bus:controlDoors', (vehId, open) => {
    const veh = mp.vehicles.atRemoteId(vehId);
    if (veh && mp.vehicles.exists(veh)) {
        const doors = [0, 1, 2, 3];
        doors.forEach(doorIdx => {
            if (open) veh.setDoorOpen(doorIdx, false, false);
            else veh.setDoorShut(doorIdx, false);
        });
    }
});

function cleanupPeds() {
    jobPeds.forEach(ped => { if (mp.peds.exists(ped)) ped.destroy(); });
    jobPeds = [];

    leavingPeds.forEach(ped => { if (mp.peds.exists(ped)) ped.destroy(); });
    leavingPeds = [];
}