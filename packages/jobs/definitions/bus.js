const jobManager = require('../jobManager');
const playerManager = require('../../core/playerManager');
const fs = require('fs');
const path = require('path');

const JOB_KEY = 'bus';
const ROUTES_FILE = path.join(__dirname, '../../data/busRoutes.json');

// --- CONFIGURATION ---
const DEPOT_LOCATION = { x: 435.54, y: -645.85, z: 28.74, h: 86.50 }; // Textile City Bus Terminal
const DEPOT_RETURN = { x: 448.40, y: -584.70, z: 28.50 }; // Where to park to finish

const BUS_SPAWNS = [
    { x: 462.60, y: -605.51, z: 28.50, h: -147.80 },
    { x: 460.47, y: -618.76, z: 28.49, h: -145.12 },
    { x: 460.59, y: -626.17, z: 28.50, h: -146.14 },
    { x: 461.24, y: -611.73, z: 28.49, h: -149.31 },
    { x: 459.06, y: -632.90, z: 28.50, h: -145.95 },
    { x: 458.62, y: -640.10, z: 28.46, h: -146.79 },
    { x: 458.05, y: -647.53, z: 28.22, h: -147.15 },
    { x: 457.38, y: -654.66, z: 27.83, h: -146.47 },
];

const REWARD_CONFIG = {
    basePayPerStop: 35, // Base money per stop
    perLevelBonus: 3,   // Extra money per stop per level
    xpPerStop: 5,
    finishBonus: 250    // Bonus for completing the full loop
};

// State storage
let AVAILABLE_ROUTES = [];
const activeJobs = new Map();
const routeCreators = new Map();

// --- DATA LOADING ---
function loadRoutes() {
    try {
        if (fs.existsSync(ROUTES_FILE)) {
            AVAILABLE_ROUTES = JSON.parse(fs.readFileSync(ROUTES_FILE, 'utf8'));
            console.log(`[Bus] Loaded ${AVAILABLE_ROUTES.length} routes.`);
        } else {
            fs.writeFileSync(ROUTES_FILE, '[]');
        }
    } catch (e) { console.error('[Bus] Error loading routes:', e); }
}
loadRoutes();

function saveRoutes() { fs.writeFileSync(ROUTES_FILE, JSON.stringify(AVAILABLE_ROUTES, null, 4)); }

// --- LOGIC ---
const logic = {
    onInteract: (player) => {
        const level = jobManager.getJobLevel(player, JOB_KEY);
        const payPerStop = REWARD_CONFIG.basePayPerStop + Math.floor(level * REWARD_CONFIG.perLevelBonus);

        // We map the routes to send the Name, Pay, AND the actual Stops coordinates
        const previewData = AVAILABLE_ROUTES.map(r => ({
            id: r.id || Math.random().toString(36), // Ensure ID exists
            name: r.name,
            stopsCount: r.stops.length,
            // CRITICAL: Send the stop coordinates for the map!
            path: r.stops.map(s => ({ x: s.x, y: s.y })), 
            pay: (r.stops.length * payPerStop) + REWARD_CONFIG.finishBonus
        }));

        player.call('client:bus:openMenu', [JSON.stringify(previewData)]);
    },
    onStop: (player) => { cleanupJob(player); }
};

function startRoute(player, routeIndex) {
    const route = AVAILABLE_ROUTES[routeIndex];
    if (!route) return player.outputChatBox("!{FF0000}Invalid route.");

    jobManager.startJobSession(player, JOB_KEY);

    // 1. Vehicle Progression
    const level = jobManager.getJobLevel(player, JOB_KEY);
    let vehicleModel = 'bus'; // Default
    if (level >= 50) vehicleModel = 'coach';
    else if (level >= 20) vehicleModel = 'airbus';

    // 2. Spawn Bus
    const spawn = BUS_SPAWNS[Math.floor(Math.random() * BUS_SPAWNS.length)];
    const bus = mp.vehicles.new(mp.joaat(vehicleModel), new mp.Vector3(spawn.x, spawn.y, spawn.z), {
        heading: spawn.h,
        numberPlate: "METRO",
        locked: false,
        engine: false,
        dimension: player.dimension
    });
    bus.jobOwner = player.id;
    bus.setVariable('fuel', 100.0);

    setTimeout(() => {
        if (mp.players.exists(player) && mp.vehicles.exists(bus)) player.call('client:warpIntoVehicle', [bus.id, -1]);
    }, 250);

    // 3. Init Job Data
    activeJobs.set(player.id, {
        route: route,
        currentStop: 0,
        bus: bus,
        totalStops: route.stops.length,
        isBoarding: false,
        colshape: null
    });

    player.call('showNotification', ['Bus Driver', `Route: ${route.name} started.`]);
    setNextStop(player);
}

function setNextStop(player) {
    const job = activeJobs.get(player.id);
    if (!job) return;

    // Check if route finished
    if (job.currentStop >= job.totalStops) {
        // Route Finished - Go back to depot
        jobManager.createObjective(player, DEPOT_RETURN, "Return Bus to Terminal", 5.0, (p) => {
            finishJob(p);
        }, { blipSprite: 513, blipColor: 1, name: "Depot Return" });
        player.call('showNotification', ['Bus Driver', "Route complete. Return to the terminal."]);
        return;
    }

    const stopData = job.route.stops[job.currentStop];

    // Create Marker and Blip via JobManager
    jobManager.createObjective(player, stopData, `Stop ${job.currentStop + 1}`, 3.5, (p) => {
        handleStopArrival(p);
    }, {
        blipSprite: 513, // Bus Blip
        blipColor: 46,   // Yellow
        markerColor: [255, 255, 0, 100],
        name: "Bus Stop"
    });

    player.call('client:showJobSubtitle', [`Next Stop: ${job.currentStop + 1} / ${job.totalStops}`]);
}

async function handleStopArrival(player) {
    const job = activeJobs.get(player.id);
    if (!job || job.isBoarding) return;

    if (!player.vehicle || player.vehicle !== job.bus) {
        return player.call('showNotification', ["Error", "You must be in your assigned bus!"]);
    }

    // ENFORCE FULL STOP
    const velocity = player.vehicle.velocity;
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
    
    // If moving faster than ~1 km/h
    if (speed > 0.5) {
        return player.call('showNotification', ["~o~Stop the bus completely to board passengers."]);
    }

    // --- BOARDING SEQUENCE ---
    job.isBoarding = true;
    const bus = job.bus;

    // 1. Freeze and Open Doors
    bus.freezePosition(true);
    // 0 = Front Left, 1 = Front Right, 2 = Back Left, 3 = Back Right
    bus.setDoorState(0, false); // Open
    bus.setDoorState(1, false); 
    bus.setDoorState(2, false); 
    bus.setDoorState(3, false); 

    player.call('client:showJobSubtitle', ["~y~Boarding Passengers... Please Wait.", 4000]);
    player.call('playSound', ['Bus_Schedule_Pickup', 'DLC_PRISON_BREAK_HEIST_SOUNDS']); // Simulation sound

    // 2. Wait 4 Seconds
    setTimeout(async () => {
        if (!mp.players.exists(player) || !activeJobs.has(player.id)) return;

        // 3. Close Doors and Unfreeze
        if (mp.vehicles.exists(bus)) {
            bus.setDoorState(0, true); // Shut
            bus.setDoorState(1, true);
            bus.setDoorState(2, true);
            bus.setDoorState(3, true);
            bus.freezePosition(false);
        }

        // 4. Rewards
        const level = jobManager.getJobLevel(player, JOB_KEY);
        const pay = REWARD_CONFIG.basePayPerStop + Math.floor(level * REWARD_CONFIG.perLevelBonus);
        
        await playerManager.addMoneyAndSave(player, pay, "Bus Stop Pay");
        await jobManager.addJobXp(player, JOB_KEY, REWARD_CONFIG.xpPerStop);

        player.call('showNotification', ["Bus Driver", `Passengers Boarded. Earned $${pay}`]);

        // 5. Next
        job.isBoarding = false;
        job.currentStop++;
        setNextStop(player);

    }, 4000);
}

async function finishJob(player) {
    const job = activeJobs.get(player.id);
    if (!job) return;

    const bonus = REWARD_CONFIG.finishBonus;
    player.call('showNotification', ["Bus Driver", `Shift Complete! Bonus: $${bonus}`]);
    player.call('playSound', ['SUCCEEDED', 'HUD_AWARDS']);

    await playerManager.addMoneyAndSave(player, bonus, "Bus Route Completion");
    jobManager.stopJob(player, "Route Completed.");
}

function cleanupJob(player) {
    const job = activeJobs.get(player.id);
    if (!job) return;

    if (job.bus && mp.vehicles.exists(job.bus)) job.bus.destroy();
    jobManager.clearObjective(player);
    activeJobs.delete(player.id);
}

// --- CREATOR COMMANDS (Identical workflow to Garbage) ---
mp.events.addCommand('createbusroute', (player, fullText, name) => {
    if (!player.data.isAdmin) return;
    if (!name) return player.outputChatBox("Usage: /createbusroute [Name]");
    routeCreators.set(player.id, { name: name, stops: [], tempBlips: [] });
    player.outputChatBox(`!{00FF00}Recording Bus Route '${name}'. Drive to stop and /addbusstop`);
});

mp.events.addCommand('addbusstop', (player) => {
    if (!routeCreators.has(player.id)) return;
    const data = routeCreators.get(player.id);
    
    // Save position + heading (for future NPC spawns if you want them)
    const pos = { 
        x: parseFloat(player.position.x.toFixed(2)), 
        y: parseFloat(player.position.y.toFixed(2)), 
        z: parseFloat(player.position.z.toFixed(2)),
        h: parseFloat(player.heading.toFixed(2))
    };
    
    data.stops.push(pos);
    
    const tempBlip = mp.blips.new(1, new mp.Vector3(pos.x, pos.y, pos.z), { 
        name: `Stop #${data.stops.length}`, color: 4, scale: 0.7, dimension: player.dimension 
    });
    data.tempBlips.push(tempBlip);
    player.outputChatBox(`!{00FF00}Stop added. Total: ${data.stops.length}`);
});

mp.events.addCommand('finishbusroute', (player) => {
    if (!routeCreators.has(player.id)) return;
    const data = routeCreators.get(player.id);

    if (data.stops.length < 2) return player.outputChatBox("!{FF0000}Route must have at least 2 stops.");

    AVAILABLE_ROUTES.push({
        name: data.name,
        stops: data.stops
    });
    saveRoutes();

    // Cleanup visuals
    data.tempBlips.forEach(blip => { if (mp.blips.exists(blip)) blip.destroy(); });
    routeCreators.delete(player.id);
    
    player.outputChatBox(`!{00FF00}Bus Route '${data.name}' saved successfully!`);
});

// --- REGISTRATION ---
mp.events.add('server:bus:selectRoute', (player, index) => {
    player.call('client:bus:closeMenu');
    startRoute(player, index);
});

const JOB_CONFIG = {
    name: "Bus Driver",
    description: "Transport citizens across the city. Regular stops required.",
    previewButtons: [
        { label: "View Routes", action: "default" }
    ],
    pedModel: "s_m_m_busdev_01",
    blipSprite: 513,
    blipColor: 46,
    pos: DEPOT_LOCATION
};

jobManager.register(JOB_KEY, JOB_CONFIG, logic);