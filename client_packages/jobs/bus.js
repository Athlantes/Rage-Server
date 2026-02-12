let busBrowser = null;
let waitingPeds = [];  // Passengers waiting at the stop
let boardingPeds = []; // Passengers currently boarding
let exitingPeds = [];  // Passengers exiting the bus

// --- CONFIGURATION ---
const CONFIG = {
    SIDEWALK_DISTANCE: 3.0,        // Distance from bus to sidewalk (REDUCED for easier boarding)
    SIDEWALK_HEIGHT_OFFSET: 0.5,   // Height above ground for spawning
    PED_SPAWN_SCATTER: 0.8,        // Random scatter radius (REDUCED to keep them closer)
    WALKAWAY_DISTANCE: 20.0,       // How far NPCs walk after exiting
    MAX_WAITING_PEDS: 3,           // Max peds waiting to board
    MAX_EXITING_PEDS: 2,           // Max peds exiting
};

const PED_MODELS = [
    'a_f_y_hipster_01', 'a_m_y_business_01', 'a_m_m_tourist_01',
    'a_f_m_bevhills_01', 'a_m_m_skater_01', 'a_m_m_farmer_01',
    'a_f_y_genhot_01', 'a_f_y_business_02', 'a_m_m_business_01',
    'a_f_m_tourist_01', 'a_m_y_hipster_01', 'a_f_m_downtown_01'
];

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

// --- UTILITY FUNCTIONS ---

/**
 * Get proper ground Z coordinate
 */
function getGroundZ(x, y, z) {
    let groundZ = mp.game.gameplay.getGroundZFor3dCoord(x, y, z + 10.0, 0, false);
    if (groundZ === 0 || groundZ < -1000) {
        groundZ = z; // Fallback to provided Z
    }
    return groundZ;
}

/**
 * Calculate sidewalk position (to the right of bus heading)
 */
function getSidewalkPosition(busPos, busHeading, distance) {
    // Bus doors are on the RIGHT side
    // Right side is -90 degrees from heading
    const angleRad = (busHeading - 90) * (Math.PI / 180);
    
    const x = busPos.x + Math.cos(angleRad) * distance;
    const y = busPos.y + Math.sin(angleRad) * distance;
    const z = getGroundZ(x, y, busPos.z);
    
    return { x, y, z };
}

/**
 * Create and initialize a ped properly
 */
function createPed(modelHash, position, heading) {
    const ped = mp.peds.new(modelHash, position, heading, 0);
    
    if (!ped || !mp.peds.exists(ped)) return null;
    
    // Initialize ped properly
    setTimeout(() => {
        if (mp.peds.exists(ped)) {
            ped.setBlockingOfNonTemporaryEvents(true);
            ped.setInvincible(true);
            ped.freezePosition(false);
            ped.setCanRagdoll(false);
            
            // Make them ignore traffic
            ped.setConfigFlag(281, true); // Disable ped avoidance
        }
    }, 50);
    
    return ped;
}

/**
 * Validate if ped still exists and is usable
 */
function isPedValid(ped) {
    return ped && mp.peds.exists(ped) && ped.handle !== 0;
}

/**
 * Validate if vehicle still exists
 */
function isVehicleValid(veh) {
    return veh && mp.vehicles.exists(veh) && veh.handle !== 0;
}

// --- MAIN NPC LOGIC ---

/**
 * 1. SPAWN WAITING PEDS
 * Called when approaching a stop
 */
mp.events.add('client:bus:spawnPeds', (stopData) => {
    // Clean up any existing peds first
    cleanupAllPeds();
    
    const stopPos = new mp.Vector3(stopData.x, stopData.y, stopData.z);
    const busHeading = stopData.heading || 0;
    
    // Calculate sidewalk position
    const sidewalk = getSidewalkPosition(stopPos, busHeading, CONFIG.SIDEWALK_DISTANCE);
    
    // Spawn 1-3 waiting passengers
    const pedCount = Math.floor(Math.random() * CONFIG.MAX_WAITING_PEDS) + 1;
    
    for (let i = 0; i < pedCount; i++) {
        // Add scatter so they don't stack, but keep them in a line along the sidewalk
        const scatterForward = i * 0.8; // Space them out along the bus length
        const scatterSide = (Math.random() - 0.5) * CONFIG.PED_SPAWN_SCATTER;
        
        // Calculate position along the sidewalk
        const forwardRad = busHeading * (Math.PI / 180);
        const sideRad = (busHeading - 90) * (Math.PI / 180);
        
        const spawnX = sidewalk.x + Math.cos(forwardRad) * scatterForward + Math.cos(sideRad) * scatterSide;
        const spawnY = sidewalk.y + Math.sin(forwardRad) * scatterForward + Math.sin(sideRad) * scatterSide;
        const spawnZ = getGroundZ(spawnX, spawnY, sidewalk.z) + CONFIG.SIDEWALK_HEIGHT_OFFSET;
        
        // Random model
        const modelName = PED_MODELS[Math.floor(Math.random() * PED_MODELS.length)];
        const modelHash = mp.game.joaat(modelName);
        
        // Face TOWARDS the bus (opposite of the sidewalk direction)
        const pedHeading = (busHeading + 90) % 360;
        
        const ped = createPed(
            modelHash,
            new mp.Vector3(spawnX, spawnY, spawnZ),
            pedHeading
        );
        
        if (ped) {
            waitingPeds.push(ped);
            
            // Make them stand still and wait
            setTimeout(() => {
                if (isPedValid(ped)) {
                    ped.taskStandStill(-1); // Stand forever until told otherwise
                }
            }, 100);
        }
    }
});

/**
 * 2. HANDLE EXITING PASSENGERS
 * Spawn peds IN SEATS, then make them exit properly through the door
 */
mp.events.add('client:bus:handleExiting', (vehRemoteId) => {
    const bus = mp.vehicles.atRemoteId(vehRemoteId);
    if (!isVehicleValid(bus)) return;
    
    // Random chance for passengers to exit (not every stop has exiters)
    if (Math.random() > 0.4) return;
    
    const exitCount = Math.floor(Math.random() * CONFIG.MAX_EXITING_PEDS) + 1;
    const busPos = bus.position;
    const busHeading = bus.getHeading();
    
    for (let i = 0; i < exitCount; i++) {
        const modelName = PED_MODELS[Math.floor(Math.random() * PED_MODELS.length)];
        const modelHash = mp.game.joaat(modelName);
        
        // Spawn ped slightly away from bus to avoid collision on spawn
        const spawnOffset = getSidewalkPosition(busPos, busHeading, 1.5);
        
        const ped = mp.peds.new(
            modelHash,
            new mp.Vector3(spawnOffset.x, spawnOffset.y, spawnOffset.z),
            busHeading,
            0
        );
        
        if (!ped || !mp.peds.exists(ped)) continue;
        
        exitingPeds.push(ped);
        
        // Delay to ensure ped is fully spawned
        setTimeout(() => {
            if (!isPedValid(ped) || !isVehicleValid(bus)) return;
            
            // Initialize ped properties
            ped.setBlockingOfNonTemporaryEvents(true);
            ped.setInvincible(true);
            ped.setCanRagdoll(false);
            ped.freezePosition(false);
            
            // CRITICAL: Disable collision BEFORE and DURING entire process
            ped.setNoCollision(bus.handle, false);
            
            // Make ped invisible temporarily to hide the warp
            ped.setVisible(false, false);
            
            // Warp into a rear passenger seat (seats 1-4)
            const seatIndex = 1 + i;
            ped.setIntoVehicle(bus.handle, seatIndex);
            
            // Wait for warp to complete
            setTimeout(() => {
                if (!isPedValid(ped) || !isVehicleValid(bus)) return;
                
                // Make visible again NOW so we can see them in seat
                ped.setVisible(true, false);
                
                // Keep collision disabled
                ped.setNoCollision(bus.handle, false);
                
                // Small delay so player can see them in seat, then exit
                setTimeout(() => {
                    if (!isPedValid(ped) || !isVehicleValid(bus)) return;
                    
                    // CRITICAL: Flag 0 = Normal exit animation through door
                    // NOT flag 16 which causes teleport
                    ped.taskLeaveVehicle(bus.handle, 0);
                    
                    // Keep disabling collision during exit animation
                    const collisionInterval = setInterval(() => {
                        if (!isPedValid(ped)) {
                            clearInterval(collisionInterval);
                            return;
                        }
                        ped.setNoCollision(bus.handle, false);
                    }, 100);
                    
                    // After they exit, make them walk away
                    setTimeout(() => {
                        clearInterval(collisionInterval);
                        
                        if (!isPedValid(ped)) return;
                        
                        // Check if they've exited the vehicle
                        if (!ped.isInAnyVehicle(false)) {
                            // Get current ped position
                            const pedPos = ped.position;
                            
                            // Calculate walk-away destination
                            const walkAngle = (busHeading - 90 + (Math.random() - 0.5) * 60) * (Math.PI / 180);
                            const walkX = pedPos.x + Math.cos(walkAngle) * CONFIG.WALKAWAY_DISTANCE;
                            const walkY = pedPos.y + Math.sin(walkAngle) * CONFIG.WALKAWAY_DISTANCE;
                            const walkZ = getGroundZ(walkX, walkY, pedPos.z);
                            
                            // Task to walk away
                            ped.taskGoToCoordAnyMeans(walkX, walkY, walkZ, 1.0, 0, false, 786603, 0.0);
                            
                            // Delete after they've walked away
                            setTimeout(() => {
                                if (isPedValid(ped)) {
                                    ped.destroy();
                                }
                            }, 12000);
                        } else {
                            // Still in vehicle? Force them out and walk away
                            const currentPos = ped.position;
                            const walkAngle = (busHeading - 90) * (Math.PI / 180);
                            const walkX = currentPos.x + Math.cos(walkAngle) * 3.0;
                            const walkY = currentPos.y + Math.sin(walkAngle) * 3.0;
                            const walkZ = getGroundZ(walkX, walkY, currentPos.z);
                            
                            ped.setCoords(walkX, walkY, walkZ, false, false, false, false);
                            ped.taskWanderStandard(10.0, 10);
                            
                            setTimeout(() => {
                                if (isPedValid(ped)) ped.destroy();
                            }, 8000);
                        }
                    }, 5000); // Wait 5 seconds for exit animation to complete
                    
                }, 500); // Wait 500ms so they're visible in seat before exiting
                
            }, 200); // Wait for warp to complete
            
        }, 100 + (i * 400)); // Stagger each ped
    }
});

/**
 * 3. HANDLE BOARDING PASSENGERS
 * Make waiting peds board the bus - IMPROVED VERSION
 */
mp.events.add('client:bus:handleBoarding', (vehRemoteId) => {
    const bus = mp.vehicles.atRemoteId(vehRemoteId);
    if (!isVehicleValid(bus)) return;
    
    if (waitingPeds.length === 0) return;
    
    const busPos = bus.position;
    const busHeading = bus.getHeading();
    
    // Get the door position (right side of bus, closer than sidewalk)
    const doorPos = getSidewalkPosition(busPos, busHeading, 2.0); // Closer to bus
    
    // Process each waiting ped
    waitingPeds.forEach((ped, index) => {
        if (!isPedValid(ped)) return;
        
        // Delay each ped slightly for natural flow
        setTimeout(() => {
            if (!isPedValid(ped) || !isVehicleValid(bus)) return;
            
            // First, move ped closer to the bus door if they're far
            const pedPos = ped.position;
            const distToBus = Math.sqrt(
                Math.pow(pedPos.x - doorPos.x, 2) + 
                Math.pow(pedPos.y - doorPos.y, 2)
            );
            
            // If ped is far from bus, walk them closer first
            if (distToBus > 3.0) {
                // Walk to door position
                ped.taskGoStraightToCoord(
                    doorPos.x,
                    doorPos.y,
                    doorPos.z,
                    1.5, // speed
                    5000, // timeout
                    busHeading, // face heading
                    0.5 // target radius
                );
                
                // After walking closer, enter vehicle
                setTimeout(() => {
                    if (!isPedValid(ped) || !isVehicleValid(bus)) return;
                    enterVehicleTask(ped, bus, index);
                }, 2000);
            } else {
                // Already close enough, enter directly
                enterVehicleTask(ped, bus, index);
            }
            
        }, 200 + (index * 600)); // Stagger more (600ms between peds)
    });
});

/**
 * Helper function to make ped enter vehicle
 */
function enterVehicleTask(ped, bus, index) {
    if (!isPedValid(ped) || !isVehicleValid(bus)) return;
    
    // Clear any existing tasks
    ped.clearTasksImmediately();
    
    // Disable collision with vehicle
    ped.setNoCollision(bus.handle, false);
    
    // Get seat index (1-4 for passengers)
    const seatIndex = 1 + (index % 4);
    
    // Task to enter vehicle
    // Using flag 8 = warp if stuck (more reliable than flag 1)
    ped.taskEnterVehicle(bus.handle, 20000, seatIndex, 2.0, 8, 0);
    
    boardingPeds.push(ped);
    
    // Check if successfully boarded
    setTimeout(() => {
        if (isPedValid(ped) && isVehicleValid(bus)) {
            // If ped didn't board, try warping them
            if (!ped.isInVehicle(bus.handle, false)) {
                ped.setIntoVehicle(bus.handle, seatIndex);
            }
            
            // Make sure they sit quietly
            if (ped.isInVehicle(bus.handle, false)) {
                ped.setInvincible(true);
                ped.setCanRagdoll(false);
            }
        }
    }, 8000);
}

/**
 * 4. DOOR CONTROL
 */
mp.events.add('client:bus:controlDoors', (vehId, open) => {
    const veh = mp.vehicles.atRemoteId(vehId);
    if (!isVehicleValid(veh)) return;
    
    if (open) {
        // Open front doors (0 = driver, 1 = front passenger)
        // Most buses have passenger doors at index 1 and 2
        veh.setDoorOpen(0, false, false);
        veh.setDoorOpen(1, false, false);
    } else {
        veh.setDoorShut(0, false);
        veh.setDoorShut(1, false);
    }
});

/**
 * 5. CLEANUP
 */
mp.events.add('client:bus:cleanupPeds', () => {
    cleanupAllPeds();
});

function cleanupAllPeds() {
    // Cleanup waiting peds
    waitingPeds.forEach(ped => {
        if (isPedValid(ped)) {
            ped.clearTasksImmediately();
            ped.destroy();
        }
    });
    waitingPeds = [];
    
    // Cleanup boarding peds - but keep ones that successfully boarded
    boardingPeds.forEach(ped => {
        if (isPedValid(ped)) {
            // Only destroy if they're NOT in a vehicle (boarding failed)
            if (!ped.isInAnyVehicle(false)) {
                ped.clearTasksImmediately();
                ped.destroy();
            }
            // If in vehicle, they're passengers now - let them stay until exiting phase
        }
    });
    boardingPeds = [];
    
    // Cleanup exiting peds - these should all be destroyed as they've left
    exitingPeds.forEach(ped => {
        if (isPedValid(ped)) {
            // Only destroy if they're not in the process of walking away
            ped.clearTasksImmediately();
            ped.destroy();
        }
    });
    exitingPeds = [];
}

// --- SAFETY & COLLISION MANAGEMENT ---

/**
 * Continuous collision prevention
 * Ensures peds don't collide with the bus during boarding/exiting
 */
setInterval(() => {
    const player = mp.players.local;
    if (!player || !player.vehicle) return;
    
    const bus = player.vehicle;
    if (!isVehicleValid(bus)) return;
    
    // Disable collision for all active peds
    const allPeds = [...waitingPeds, ...boardingPeds, ...exitingPeds];
    allPeds.forEach(ped => {
        if (isPedValid(ped)) {
            ped.setNoCollision(bus.handle, false);
        }
    });
}, 500);

/**
 * Periodic cleanup of invalid peds
 */
setInterval(() => {
    waitingPeds = waitingPeds.filter(isPedValid);
    boardingPeds = boardingPeds.filter(isPedValid);
    exitingPeds = exitingPeds.filter(isPedValid);
}, 2000);