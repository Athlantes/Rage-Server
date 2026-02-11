let busBrowser = null;
let jobPeds = [];     // Waiting passengers (Entering)
let leavingPeds = []; // Passengers getting off (Exiting)

// --- MENU EVENTS (Unchanged) ---
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

// --- STABLE NPC LOGIC ---

// 1. Spawn Waiting Peds (Entering)
mp.events.add('client:bus:spawnPeds', (stopData) => {
    cleanupPeds(); 

    const stopPos = new mp.Vector3(stopData.x, stopData.y, stopData.z);
    const skins = ['a_f_y_hipster_01', 'a_m_y_business_01', 'a_m_m_tourist_01', 'a_f_m_bevhills_01', 'a_m_m_skater_01', 'a_m_m_farmer_01', 'a_f_y_genhot_01'];
    
    // Spawn 1-2 waiting passengers
    const count = Math.floor(Math.random() * 2) + 1; 

    for (let i = 0; i < count; i++) {
        // Random placement: 2m to 4m away
        const angle = Math.random() * Math.PI * 2;
        const dist = 2.0 + Math.random() * 2.0;
        const offsetX = stopPos.x + Math.cos(angle) * dist;
        const offsetY = stopPos.y + Math.sin(angle) * dist;
        
        // Safety: Find ground Z to prevent floating/falling
        let groundZ = stopPos.z;
        const groundCheck = mp.game.gameplay.getGroundZFor3dCoord(offsetX, offsetY, stopPos.z + 2.0, false, false);
        if (groundCheck > 0) groundZ = groundCheck;

        const ped = mp.peds.new(
            mp.game.joaat(skins[Math.floor(Math.random() * skins.length)]), 
            new mp.Vector3(offsetX, offsetY, groundZ),
            Math.random() * 360, 
            0 
        );

        if (ped) {
            // Setup Ped Attributes
            ped.setBlockingOfNonTemporaryEvents(true); // Ignore guns/horns
            ped.setInvincible(true);                   // Godmode
            ped.freezePosition(false);                 // Ensure they can move
            ped.taskTurnToFaceCoord(stopPos.x, stopPos.y, stopPos.z, 0); // Face the street
            
            jobPeds.push(ped);
        }
    }
});

// 2. Handle Boarding & Exiting
mp.events.add('client:bus:handlePedActions', (vehRemoteId) => {
    const bus = mp.vehicles.atRemoteId(vehRemoteId);
    if (!bus || !bus.handle) return;

    // --- A. BOARDING (Entering) ---
    jobPeds.forEach((ped, index) => {
        if (mp.peds.exists(ped)) {
            // SAFETY: Disable collision immediately so they don't push the bus
            ped.setNoCollision(bus.handle, false);

            // 1. Enter Vehicle Task
            // Seat: Random passenger seat (0-6).
            // Speed: 2.0 (Jog)
            // Flag 1: Normal entry
            const targetSeat = index + Math.floor(Math.random() * 3); 
            ped.taskEnterVehicle(bus.handle, 10000, targetSeat, 2.0, 1, 0);
        }
    });

    // --- B. ALIGHTING (Exiting) - THE FIX ---
    // Instead of spawning them INSIDE (which bugs physics), we spawn them OUTSIDE at the door.
    if (Math.random() > 0.3) { 
        const leaverCount = Math.floor(Math.random() * 2) + 1;
        const skins = ['a_f_y_business_02', 'a_m_m_business_01', 'a_f_m_tourist_01'];

        for(let i = 0; i < leaverCount; i++) {
            const skin = skins[Math.floor(Math.random() * skins.length)];
            
            // 1. Calculate "Fake" Exit Position (The Back Door)
            // X: 1.5 (Right side), Y: -2.5 (Back door approx), Z: -1.0 (Ground)
            const exitPos = bus.getOffsetFromInWorldCoords(1.5, -2.5, -1.0);

            // 2. Spawn Ped directly at the exit point
            const pLeaving = mp.peds.new(mp.game.joaat(skin), exitPos, bus.getHeading() + 90, 0);
            
            // Add to tracking
            leavingPeds.push(pLeaving);

            // 3. Logic (Short delay to ensure handle exists)
            setTimeout(() => {
                if(mp.peds.exists(pLeaving) && mp.vehicles.exists(bus)) {
                    
                    // CRITICAL: Ghost Mode. Disable collision with bus.
                    pLeaving.setNoCollision(bus.handle, false);
                    
                    // 4. Play a "Close Door" animation or just Walk Away
                    // We simply task them to walk away. It looks like they just stepped off.
                    // Destination: 5 meters to the right, random Y scatter
                    const wanderDest = bus.getOffsetFromInWorldCoords(6.0, (Math.random() * 6) - 3, 0.0);
                    
                    // Task: Go to coord (Speed 1.1 = Walk)
                    pLeaving.taskGoToCoordAnyMeans(wanderDest.x, wanderDest.y, bus.position.z, 1.1, 0, false, 786603, 0.5);

                    // 5. Cleanup Timer (Destroy them after they walk away)
                    setTimeout(() => { 
                        if (mp.peds.exists(pLeaving)) {
                            // Fade out nicely if you want, or just destroy
                            pLeaving.destroy(); 
                        }
                    }, 6000);
                }
            }, 50);
        }
    }
});

// 3. Cleanup & Safety Loop
mp.events.add('client:bus:cleanupPeds', () => {
    cleanupPeds();
});

// SAFETY LOOP: Keeps disabling collision just in case it resets
setInterval(() => {
    const allPeds = [...jobPeds, ...leavingPeds];
    // Find the player's bus
    const player = mp.players.local;
    const bus = player.vehicle;
    
    if (bus && allPeds.length > 0) {
        allPeds.forEach(ped => {
            if (mp.peds.exists(ped)) {
                // Constantly ensure they don't touch the bus physics
                ped.setNoCollision(bus.handle, false);
            }
        });
    }
}, 500);

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