/**
 * ============================================================================
 * CONTINUOUS LOGISTICS TRUCKER JOB
 * Server-side job definition for RAGE:MP
 * ============================================================================
 * 
 * Features:
 * - Level-based vehicle progression (Pounder → Packer → Hauler → Phantom)
 * - Continuous contract loop (auto-reopen UI after each delivery)
 * - Physical trailer hookup detection for Lvl 20+
 * - Loading dock simulation for Lvl 1-19
 * - Admin route/spawn management via JSON
 * - Graceful cleanup on disconnect/quit
 */

const fs = require('fs');
const path = require('path');

const jobManager = require('../jobManager');
const playerManager = require('../../core/playerManager');

const JOB_KEY = 'trucker';
const DATA_PATH = path.join(__dirname, '../../data/truckerData.json');

// ============================================================================
// DATA STRUCTURE & PERSISTENCE
// ============================================================================

let truckerData = {
    depot: null, // { pos: {x, y, z}, heading: float }
    truckSpawns: [], // [{ pos: {x, y, z}, heading: float }, ...]
    routes: [] // [{ id, name, minLevel, basePay, pickup: {x,y,z}, dropoff: {x,y,z} }, ...]
};

// Active job sessions: playerId → { cabVehicle, trailerVehicle, currentRoute, stage, tier }
const activeSessions = new Map();

// Admin setup tracking: playerId → { routeId, basePay, minLevel, name, hasPickup }
const adminSetupMode = new Map();

/**
 * Load trucker data from JSON file
 */
function loadData() {
    try {
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf8');
            truckerData = JSON.parse(raw);
            console.log(`[Trucker] Loaded ${truckerData.routes.length} routes from data file.`);
        } else {
            console.log('[Trucker] No data file found, starting fresh.');
        }
    } catch (err) {
        console.error('[Trucker] Failed to load data:', err);
    }
}

/**
 * Save trucker data to JSON file
 */
function saveData() {
    try {
        const dir = path.dirname(DATA_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(DATA_PATH, JSON.stringify(truckerData, null, 2));
        console.log('[Trucker] Data saved successfully.');
    } catch (err) {
        console.error('[Trucker] Failed to save data:', err);
    }
}

// ============================================================================
// VEHICLE TIER SYSTEM
// ============================================================================

/**
 * Get the appropriate vehicle setup based on job level
 * @param {number} level - Player's trucker job level
 * @returns {object} Vehicle configuration
 */
function getVehicleTier(level) {
    if (level < 20) {
        return {
            tier: 1,
            name: 'Local Courier',
            cabModel: 'pounder',
            trailerModel: null,
            requiresTrailer: false,
            description: 'Small deliveries around the city'
        };
    } else if (level < 40) {
        return {
            tier: 2,
            name: 'Mid-Weight Hauler',
            cabModel: 'packer',
            trailerModel: 'tvtrailer',
            requiresTrailer: true,
            description: 'Regional freight hauling'
        };
    } else if (level < 60) {
        return {
            tier: 3,
            name: 'Heavy-Duty Trucker',
            cabModel: 'hauler',
            trailerModel: 'trailers',
            requiresTrailer: true,
            description: 'Interstate cargo transport'
        };
    } else {
        return {
            tier: 4,
            name: 'Long-Haul Master',
            cabModel: 'phantom',
            trailerModel: 'trailers2',
            requiresTrailer: true,
            description: 'Cross-country logistics'
        };
    }
}

/**
 * Get a random spawn point from configured spawns
 */
function getRandomSpawn() {
    if (!truckerData.truckSpawns || truckerData.truckSpawns.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * truckerData.truckSpawns.length);
    return truckerData.truckSpawns[randomIndex];
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Clean up a player's active trucking session
 * Destroys vehicles, clears objectives, and removes session data
 */
function cleanupSession(player) {
    if (!activeSessions.has(player.id)) return;

    const session = activeSessions.get(player.id);

    // Destroy cab vehicle
    if (session.cabVehicle && mp.vehicles.exists(session.cabVehicle)) {
        session.cabVehicle.destroy();
    }

    // Destroy trailer vehicle (if exists)
    if (session.trailerVehicle && mp.vehicles.exists(session.trailerVehicle)) {
        session.trailerVehicle.destroy();
    }

    // Clear any active objectives
    jobManager.clearObjective(player);

    // Clear hookup check interval
    if (player.hookupCheckInterval) {
        clearInterval(player.hookupCheckInterval);
        player.hookupCheckInterval = null;
    }

    // Clear loading timer
    if (player.loadingTimeout) {
        clearTimeout(player.loadingTimeout);
        player.loadingTimeout = null;
    }

    activeSessions.delete(player.id);
}

/**
 * Calculate payout based on route and player level
 */
function calculatePayout(route, level) {
    const basePay = route.basePay;
    const levelBonus = Math.floor(level * 1.5); // $1.5 per level
    const totalPay = basePay + levelBonus;
    const xp = Math.floor(basePay / 5); // 1 XP per $5 of base pay
    
    return { money: totalPay, xp };
}

// ============================================================================
// JOB REGISTRATION
// ============================================================================

module.exports = () => {
    loadData();

    // Only register the job if depot is configured
    if (!truckerData.depot) {
        console.log('[Trucker] No depot configured. Use /setdepot to set up the job.');
        registerAdminEvents(); // Still register commands for setup
        return;
    }

    const JOB_CONFIG = {
        name: "Trucker",
        description: "Haul cargo across San Andreas and climb through vehicle tiers from local courier to long-haul master.",
        previewButtons: [
            { label: "Start Hauling", action: "default" }
        ],
        pedModel: "s_m_m_trucker_01",
        blipSprite: 477, // Truck icon
        blipColor: 46, // Orange
        pos: {
            x: truckerData.depot.pos.x,
            y: truckerData.depot.pos.y,
            z: truckerData.depot.pos.z,
            h: truckerData.depot.heading
        }
    };

    const logic = {
        onStart: (player) => {
            const level = jobManager.getJobLevel(player, JOB_KEY);
            const tier = getVehicleTier(level);
            const rankName = jobManager.getRankName(level);

            player.call('showNotification', ['Trucking Depot', `Signed in as ${rankName} (Lvl ${level}) - ${tier.name}`]);
            player.outputChatBox(`!{FFA500}[Trucker] !{FFFFFF}Loading contract board...`);

            setTimeout(() => {
                if (mp.players.exists(player) && player.activeJobId === JOB_KEY) {
                    mp.events.call('server:trucker:openBoard', player);
                }
            }, 1000);
        },

        onStop: (player) => {
            cleanupSession(player);
            player.call('client:trucker:closeBoard');
        }
    };

    jobManager.register(JOB_KEY, JOB_CONFIG, logic);
    console.log('[Trucker] Job registered successfully with depot at', truckerData.depot.pos);

    // Register all events and commands
    registerEvents();
    registerAdminEvents();;
};

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function registerEvents() {
    /**
     * Player opens the contract board at the depot
     */
    mp.events.add('server:trucker:openBoard', (player) => {
        // Verify player is clocked into this job
        if (player.activeJobId !== JOB_KEY) {
            return player.call('showNotification', ['Trucking Depot', 'You must clock in as a Trucker first!']);
        }

        const level = jobManager.getJobLevel(player, JOB_KEY);
        const tier = getVehicleTier(level);

        // Filter routes by level requirement
        const availableRoutes = truckerData.routes
            .filter(r => r.minLevel <= level)
            .map(r => ({
                id: r.id,
                name: r.name,
                minLevel: r.minLevel,
                basePay: r.basePay,
                pickup: r.pickup,
                dropoff: r.dropoff,
                distance: calculateDistance(r.pickup, r.dropoff)
            }));

        if (availableRoutes.length === 0) {
            return player.call('showNotification', ['Trucking Depot', 'No routes available. Contact an administrator.']);
        }

        // Check if player already has an active session
        const hasActiveSession = activeSessions.has(player.id);

        // Send data to CEF
        player.call('client:trucker:openBoard', [
            JSON.stringify({
                level,
                tierName: tier.name,
                tierDescription: tier.description,
                routes: availableRoutes,
                continueMode: hasActiveSession
            })
        ]);
    });

    /**
     * Player selects a contract from the board
     */
    mp.events.add('server:trucker:selectContract', (player, routeId) => {
        if (player.activeJobId !== JOB_KEY) {
            return player.call('showNotification', ['Error', 'Invalid job state.']);
        }

        // Find the route
        const route = truckerData.routes.find(r => r.id === routeId);
        if (!route) {
            return player.call('showNotification', ['Error', 'Route not found.']);
        }

        const level = jobManager.getJobLevel(player, JOB_KEY);
        if (level < route.minLevel) {
            return player.call('showNotification', ['Route Locked', `You need level ${route.minLevel} for this route.`]);
        }

        // Clean up any existing session
        cleanupSession(player);

        // Get spawn point
        const spawnPoint = getRandomSpawn();
        if (!spawnPoint) {
            return player.call('showNotification', ['Error', 'No truck spawn points configured. Contact an admin.']);
        }

        const tier = getVehicleTier(level);

        // Spawn the cab vehicle
        const cab = mp.vehicles.new(mp.joaat(tier.cabModel), 
            new mp.Vector3(spawnPoint.pos.x, spawnPoint.pos.y, spawnPoint.pos.z), 
            {
                heading: spawnPoint.heading,
                numberPlate: `TRUCK${player.id}`,
                color: [[255, 255, 255], [255, 255, 255]],
                dimension: player.dimension
            }
        );

        cab.setVariable('engine', false);
        cab.setVariable('fuel', 100.0);
        cab.setVariable('locked', false);
        cab.setVariable('ownerType', 'job');
        cab.setVariable('jobOwner', player.id);

        // Create session
        const session = {
            cabVehicle: cab,
            trailerVehicle: null,
            currentRoute: route,
            stage: 'spawn', // spawn → pickup → hooked/loaded → dropoff → complete
            tier,
            startTime: Date.now()
        };

        activeSessions.set(player.id, session);

        // Handle trailer spawn for Lvl 20+
        if (tier.requiresTrailer) {
            // Spawn trailer at pickup zone
            const trailer = mp.vehicles.new(
                mp.joaat(tier.trailerModel),
                new mp.Vector3(route.pickup.x, route.pickup.y, route.pickup.z),
                {
                    heading: route.pickup.h || 0,
                    dimension: player.dimension
                }
            );
            trailer.setVariable('ownerType', 'job');
            trailer.setVariable('jobOwner', player.id);
            session.trailerVehicle = trailer;

            player.call('showNotification', ['Contract Started', `Your ${tier.cabModel.toUpperCase()} is ready. Drive to the pickup zone and hook up the trailer.`]);
            player.outputChatBox(`!{FFA500}[Route] !{FFFFFF}${route.name} - Pickup and deliver for !{00FF00}$${route.basePay + Math.floor(level * 1.5)}`);

            // Set objective to pickup zone
            startPickupPhase(player, session);
        } else {
            // Lvl 1-19: No trailer, just drive to loading dock
            player.call('showNotification', ['Contract Started', `Your ${tier.cabModel.toUpperCase()} is ready. Drive to the loading dock.`]);
            player.outputChatBox(`!{FFA500}[Route] !{FFFFFF}${route.name} - Load and deliver for !{00FF00}$${route.basePay + Math.floor(level * 1.5)}`);

            startPickupPhase(player, session);
        }
    });

    /**
     * Client confirms trailer is hooked
     */
    mp.events.add('server:trucker:trailerHooked', (player) => {
        if (!activeSessions.has(player.id)) return;

        const session = activeSessions.get(player.id);
        if (session.stage !== 'pickup') return;

        if (session.trailerVehicle && mp.vehicles.exists(session.trailerVehicle)) {
            const dist = player.dist(session.trailerVehicle.position);
            if (dist > 15.0) { // Adjust distance threshold as needed
                return player.call('showNotification', ['Error', 'Trailer is too far away to be hooked!']);
            }
        }

        // Clear hookup check
        if (player.hookupCheckInterval) {
            clearInterval(player.hookupCheckInterval);
            player.hookupCheckInterval = null;
        }

        // Update stage
        session.stage = 'dropoff';

        // Clear pickup objective
        jobManager.clearObjective(player);

        // Set dropoff objective
        player.call('showNotification', ['Trailer Hooked', 'Drive to the drop-off zone!']);
        startDropoffPhase(player, session);
    });

    /**
     * Player completes loading (Lvl 1-19 only)
     */
    mp.events.add('server:trucker:loadComplete', (player) => {
        if (!activeSessions.has(player.id)) return;

        const session = activeSessions.get(player.id);
        if (session.stage !== 'pickup') return;

        session.stage = 'dropoff';
        jobManager.clearObjective(player);

        player.call('showNotification', ['Loaded', 'Cargo loaded! Drive to the drop-off zone.']);
        startDropoffPhase(player, session);
    });

    /**
     * Player completes unloading at dropoff
     */
    mp.events.add('server:trucker:unloadComplete', async (player) => {
        if (!activeSessions.has(player.id)) return;

        const session = activeSessions.get(player.id);
        if (session.stage !== 'unloading') return;

        const route = session.currentRoute;
        const level = jobManager.getJobLevel(player, JOB_KEY);
        const payout = calculatePayout(route, level);

        // Award money and XP
        await playerManager.addMoneyAndSave(player, payout.money, `Trucker: ${route.name}`);
        await jobManager.addJobXp(player, JOB_KEY, payout.xp);

        player.call('showNotification', ['Delivery Complete', `+$${payout.money} | +${payout.xp} XP`]);
        player.call('playSound', ['DLC_AW/JOB_COMPLETE_STINGER', 'HUD_AWARDS']);

        // Destroy trailer if exists
        if (session.trailerVehicle && mp.vehicles.exists(session.trailerVehicle)) {
            session.trailerVehicle.destroy();
            session.trailerVehicle = null;
        }

        // Clear objective
        jobManager.clearObjective(player);

        // Mark complete
        session.stage = 'complete';

        // CRITICAL: Auto-reopen contract board for continuous loop
        setTimeout(() => {
            if (mp.players.exists(player) && player.activeJobId === JOB_KEY) {
                mp.events.call('server:trucker:openBoard', player);
            }
        }, 500);
    });

    /**
     * Cleanup on player quit
     */
    mp.events.add('playerQuit', (player) => {
        cleanupSession(player);
        
        // Clear admin setup mode
        if (adminSetupMode.has(player.id)) {
            adminSetupMode.delete(player.id);
        }
    });
}

// ============================================================================
// PHASE HANDLERS
// ============================================================================

/**
 * Start the pickup phase (drive to pickup zone)
 */
function startPickupPhase(player, session) {
    session.stage = 'pickup';
    const route = session.currentRoute;

    jobManager.createObjective(
        player,
        route.pickup,
        'Pickup Zone',
        5.0,
        (p) => onReachPickup(p),
        {
            markerColor: [255, 165, 0, 150], // Orange
            blipSprite: 1,
            blipColor: 46
        }
    );
}

/**
 * Player reaches the pickup zone
 */
function onReachPickup(player) {
    if (!activeSessions.has(player.id)) return;
    const session = activeSessions.get(player.id);

    // Check if player is in their cab
    if (!player.vehicle || player.vehicle.id !== session.cabVehicle.id) {
        return player.call('showNotification', ['Pickup Zone', 'You must be in your truck to proceed.']);
    }

    if (session.tier.requiresTrailer) {
        // Lvl 20+: Check for trailer hookup
        player.call('showNotification', ['Pickup Zone', 'Reverse into the trailer to hook it up.']);
        
        // Start checking for trailer attachment
        player.hookupCheckInterval = setInterval(() => {
            if (!mp.players.exists(player) || !activeSessions.has(player.id)) {
                clearInterval(player.hookupCheckInterval);
                return;
            }

            // Tell client to check if trailer is attached
            player.call('client:trucker:checkTrailerHookup');
        }, 1000);
    } else {
        // Lvl 1-19: Start loading timer
        player.call('showNotification', ['Loading Dock', 'Loading cargo... (5 seconds)']);
        
        let countdown = 5;
        const loadingInterval = setInterval(() => {
            if (!mp.players.exists(player) || !activeSessions.has(player.id)) {
                clearInterval(loadingInterval);
                return;
            }

            // Check if player moved away from marker
            const dist = player.dist(new mp.Vector3(session.currentRoute.pickup.x, session.currentRoute.pickup.y, session.currentRoute.pickup.z));
            if (dist > 5.0 || !player.vehicle || player.vehicle.id !== session.cabVehicle.id) {
                clearInterval(loadingInterval);
                player.call('showNotification', ['Loading Cancelled', 'You moved away from the loading dock.']);
                return;
            }

            countdown--;
            if (countdown <= 0) {
                clearInterval(loadingInterval);
                mp.events.call('server:trucker:loadComplete', player);
            } else {
                player.call('client:trucker:updateLoadingTimer', [countdown]);
            }
        }, 1000);

        player.loadingTimeout = loadingInterval;
    }
}

/**
 * Start the dropoff phase (drive to dropoff zone)
 */
function startDropoffPhase(player, session) {
    const route = session.currentRoute;

    jobManager.createObjective(
        player,
        route.dropoff,
        'Drop-off Zone',
        5.0,
        (p) => onReachDropoff(p),
        {
            markerColor: [0, 255, 0, 150], // Green
            blipSprite: 1,
            blipColor: 2
        }
    );
}

/**
 * Player reaches the dropoff zone
 */
function onReachDropoff(player) {
    if (!activeSessions.has(player.id)) return;
    const session = activeSessions.get(player.id);

    // Check if player is in their cab
    if (!player.vehicle || player.vehicle.id !== session.cabVehicle.id) {
        return player.call('showNotification', ['Drop-off Zone', 'You must be in your truck to proceed.']);
    }

    session.stage = 'unloading';

    // Start unloading timer
    player.call('showNotification', ['Drop-off Zone', 'Unloading cargo... (5 seconds)']);

    let countdown = 5;
    const unloadingInterval = setInterval(() => {
        if (!mp.players.exists(player) || !activeSessions.has(player.id)) {
            clearInterval(unloadingInterval);
            return;
        }

        // Check if player moved away
        const dist = player.dist(new mp.Vector3(session.currentRoute.dropoff.x, session.currentRoute.dropoff.y, session.currentRoute.dropoff.z));
        if (dist > 5.0 || !player.vehicle || player.vehicle.id !== session.cabVehicle.id) {
            clearInterval(unloadingInterval);
            session.stage = 'dropoff'; // Reset to dropoff
            player.call('showNotification', ['Unloading Cancelled', 'You moved away from the drop-off zone.']);
            return;
        }

        countdown--;
        if (countdown <= 0) {
            clearInterval(unloadingInterval);
            mp.events.call('server:trucker:unloadComplete', player);
        } else {
            player.call('client:trucker:updateUnloadingTimer', [countdown]);
        }
    }, 1000);
}

// ============================================================================
// ADMIN COMMANDS
// ============================================================================

function registerAdminEvents() {
    // Local copy of colors to match commands.js styling
    const COLORS = {
        ERROR: '!{FF0000}',
        SUCCESS: '!{00FF00}',
        INFO: '!{FFFF00}'
    };

    /**
     * Set the main depot location
     */
    mp.events.add('server:trucker:admin:setdepot', (player) => {
        const pos = player.position;
        const heading = player.heading;

        truckerData.depot = {
            pos: { x: pos.x, y: pos.y, z: pos.z },
            heading
        };

        saveData();
        player.outputChatBox(`${COLORS.SUCCESS}[Trucker] Depot set at your location.`);
        player.outputChatBox(`${COLORS.INFO}Restart the server or reload the job script to spawn the depot NPC.`);
    });

    /**
     * Add a truck spawn point
     */
    mp.events.add('server:trucker:admin:addtruckspawn', (player) => {
        const pos = player.position;
        const heading = player.heading;

        if (!truckerData.truckSpawns) {
            truckerData.truckSpawns = [];
        }

        truckerData.truckSpawns.push({
            pos: { x: pos.x, y: pos.y, z: pos.z },
            heading
        });

        saveData();
        player.outputChatBox(`${COLORS.SUCCESS}[Trucker] Truck spawn #${truckerData.truckSpawns.length} added.`);
    });

    /**
     * Start adding a new route (step 1)
     */
    mp.events.add('server:trucker:admin:addroute', (player, basePay, minLevel, name) => {
        const routeId = `route_${Date.now()}`;

        // Store in admin setup mode
        adminSetupMode.set(player.id, {
            routeId,
            basePay,
            minLevel,
            name,
            hasPickup: false
        });

        player.outputChatBox(`${COLORS.SUCCESS}[Trucker] Starting route creation: "${name}"`);
        player.outputChatBox(`${COLORS.INFO}Step 1: Walk to the PICKUP location and type /setpickup`);
    });

    /**
     * Set pickup location for new route (step 2)
     */
    mp.events.add('server:trucker:admin:setpickup', (player) => {
        if (!adminSetupMode.has(player.id)) {
            return player.outputChatBox(`${COLORS.ERROR}You must first start a route with /addroute`);
        }

        const setup = adminSetupMode.get(player.id);
        const pos = player.position;
        const heading = player.heading;

        setup.pickup = { x: pos.x, y: pos.y, z: pos.z, h: heading };
        setup.hasPickup = true;

        player.outputChatBox(`${COLORS.SUCCESS}[Trucker] Pickup location set.`);
        player.outputChatBox(`${COLORS.INFO}Step 2: Walk to the DROP-OFF location and type /setdropoff`);
    });

    /**
     * Set dropoff location and finalize route (step 3)
     */
    mp.events.add('server:trucker:admin:setdropoff', (player) => {
        if (!adminSetupMode.has(player.id)) {
            return player.outputChatBox(`${COLORS.ERROR}You must first start a route with /addroute`);
        }

        const setup = adminSetupMode.get(player.id);

        if (!setup.hasPickup) {
            return player.outputChatBox(`${COLORS.ERROR}You must set the pickup location first with /setpickup`);
        }

        const pos = player.position;
        const heading = player.heading;

        setup.dropoff = { x: pos.x, y: pos.y, z: pos.z, h: heading };

        // Create the route
        const route = {
            id: setup.routeId,
            name: setup.name,
            minLevel: setup.minLevel,
            basePay: setup.basePay,
            pickup: setup.pickup,
            dropoff: setup.dropoff
        };

        truckerData.routes.push(route);
        saveData();

        player.outputChatBox(`${COLORS.SUCCESS}[Trucker] Route "${route.name}" created successfully!`);
        player.outputChatBox(`!{FFFFFF}Min Level: ${route.minLevel} | Base Pay: $${route.basePay}`);
        
        // Clear setup mode
        adminSetupMode.delete(player.id);
    });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate distance between two 3D points
 */
function calculateDistance(pos1, pos2) {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}