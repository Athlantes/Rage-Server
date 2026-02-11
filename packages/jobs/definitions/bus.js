const jobManager = require('../jobManager');
const playerManager = require('../../core/playerManager');
const fs = require('fs');
const path = require('path');

const JOB_KEY = 'bus';
const ROUTES_FILE = path.join(__dirname, '../../data/busRoutes.json');

// --- CONFIGURATION ---
const DEPOT_LOCATION = { x: 435.54, y: -645.85, z: 28.74, h: 86.50 };
const DEPOT_RETURN = { x: 448.40, y: -584.70, z: 28.50 };

const BUS_SPAWNS = [
    { x: 462.60, y: -605.51, z: 28.50, h: -147.80 },
    { x: 460.47, y: -618.76, z: 28.49, h: -145.12 },
    { x: 460.59, y: -626.17, z: 28.50, h: -146.14 },
    { x: 458.62, y: -640.10, z: 28.46, h: -146.79 }
];

const REWARD_CONFIG = {
    basePayPerStop: 35,
    perLevelBonus: 3,
    xpPerStop: 5,
    finishBonus: 250
};

// State storage
let AVAILABLE_ROUTES = [];
const activeJobs = new Map();
const routeCreators = new Map();
let jobPed = null;

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

// --- HELPER: CUSTOM CHAT ---
function sendChat(player, message) {
    if (!mp.players.exists(player)) return;
    player.outputChatBox(message);
}

// --- LOGIC ---
const logic = {
    onInteract: (player) => {
        const level = jobManager.getJobLevel(player, JOB_KEY);
        const payPerStop = REWARD_CONFIG.basePayPerStop + Math.floor(level * REWARD_CONFIG.perLevelBonus);

        const previewData = AVAILABLE_ROUTES.map(r => {
            // Calculate total distance for UI (like garbage job)
            let totalDist = 0;
            let lastPos = DEPOT_LOCATION;
            
            r.stops.forEach(stop => {
                totalDist += Math.sqrt(
                    Math.pow(stop.x - lastPos.x, 2) + 
                    Math.pow(stop.y - lastPos.y, 2) + 
                    Math.pow(stop.z - lastPos.z, 2)
                );
                lastPos = stop;
            });

            return {
                id: r.id || Math.random().toString(36),
                name: r.name,
                difficulty: "Medium", // Placeholder to match UI style
                stopsCount: r.stops.length,
                stops: r.stops, // Array of {x,y,z}
                distance: (totalDist / 1000), // KM
                pay: (r.stops.length * payPerStop) + REWARD_CONFIG.finishBonus
            };
        });

        player.call('client:bus:openMenu', [JSON.stringify(previewData)]);
    },
    onStop: (player) => { cleanupJob(player); }
};

function startRoute(player, routeIndex) {
    // Note: routeIndex comes from client as 1-based index usually, or direct array index. 
    // Adapting to match how garbage sends it (usually direct index or ID). 
    // If you pass the Array Index directly:
    const route = AVAILABLE_ROUTES[routeIndex]; 
    
    if (!route) return sendChat(player, "!{FF0000}Invalid route.");

    jobManager.startJobSession(player, JOB_KEY);

    const level = jobManager.getJobLevel(player, JOB_KEY);
    let vehicleModel = 'bus';
    if (level >= 50) vehicleModel = 'coach';
    else if (level >= 20) vehicleModel = 'airbus';

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

    activeJobs.set(player.id, {
        route: route,
        currentStop: 0,
        bus: bus,
        totalStops: route.stops.length,
        isBoarding: false
    });

    player.call('showNotification', ['Bus Driver', `Route: ${route.name} started.`]);
    setNextStop(player);
}

function setNextStop(player) {
    const job = activeJobs.get(player.id);
    if (!job) return;

    if (job.currentStop >= job.totalStops) {
        jobManager.createObjective(player, DEPOT_RETURN, "Return Bus to Terminal", 5.0, (p) => {
            finishJob(p);
        }, { blipSprite: 513, blipColor: 1, name: "Depot Return" });
        player.call('showNotification', ['Bus Driver', "Route complete. Return to the terminal."]);
        return;
    }

    const stopData = job.route.stops[job.currentStop];

    jobManager.createObjective(player, stopData, `Stop ${job.currentStop + 1}`, 3.5, (p) => {
        handleStopArrival(p);
    }, {
        blipSprite: 513, 
        blipColor: 46,   
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

    const velocity = player.vehicle.velocity;
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
    
    if (speed > 0.5) {
        return player.call('showNotification', ["~o~Stop completely to board passengers."]);
    }

    job.isBoarding = true;
    const bus = job.bus;

    if (mp.vehicles.exists(bus)) {
        bus.freezePosition(true);
        for(let i=0; i<4; i++) bus.setDoorState(i, false);
    }

    player.call('client:showJobSubtitle', ["~y~Boarding Passengers... Please Wait.", 4000]);
    player.call('playSound', ['Bus_Schedule_Pickup', 'DLC_PRISON_BREAK_HEIST_SOUNDS']);

    setTimeout(async () => {
        if (!mp.players.exists(player) || !activeJobs.has(player.id)) return;

        if (mp.vehicles.exists(bus)) {
            for(let i=0; i<4; i++) bus.setDoorState(i, true);
            bus.freezePosition(false);
        }

        const level = jobManager.getJobLevel(player, JOB_KEY);
        const pay = REWARD_CONFIG.basePayPerStop + Math.floor(level * REWARD_CONFIG.perLevelBonus);
        
        await playerManager.addMoneyAndSave(player, pay, "Bus Stop Pay");
        await jobManager.addJobXp(player, JOB_KEY, REWARD_CONFIG.xpPerStop);

        player.call('showNotification', ["Bus Driver", `Passengers Boarded. Earned $${pay}`]);

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
    sendChat(player, `!{00FF00}[BUS] Route Finished. You earned a $${bonus} bonus!`);

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

// --- CREATOR COMMANDS ---
mp.events.addCommand('createbusroute', (player, fullText, name) => {
    if (!player.data.isAdmin) return sendChat(player, "!{FF0000}Error: You do not have permission.");
    if (!name) return sendChat(player, "!{FFFF00}Usage: /createbusroute [Name]");
    routeCreators.set(player.id, { name: name, stops: [], tempBlips: [] });
    sendChat(player, `!{00FF00}Recording Bus Route '${name}'. Drive to stop and /addbusstop`);
});

mp.events.addCommand('addbusstop', (player) => {
    if (!routeCreators.has(player.id)) return sendChat(player, "!{FF0000}Use /createbusroute first.");
    const data = routeCreators.get(player.id);
    const pos = { 
        x: parseFloat(player.position.x.toFixed(2)), 
        y: parseFloat(player.position.y.toFixed(2)), 
        z: parseFloat(player.position.z.toFixed(2))
    };
    data.stops.push(pos);
    const tempBlip = mp.blips.new(1, new mp.Vector3(pos.x, pos.y, pos.z), { name: `Stop #${data.stops.length}`, color: 4, scale: 0.7, dimension: player.dimension });
    data.tempBlips.push(tempBlip);
    sendChat(player, `!{00FF00}Stop #${data.stops.length} added.`);
});

mp.events.addCommand('finishbusroute', (player) => {
    if (!routeCreators.has(player.id)) return sendChat(player, "!{FF0000}You are not creating a route.");
    const data = routeCreators.get(player.id);
    if (data.stops.length < 2) return sendChat(player, "!{FF0000}Route must have at least 2 stops.");

    AVAILABLE_ROUTES.push({
        id: data.name.toLowerCase().replace(/\s/g, '_'),
        name: data.name,
        stops: data.stops
    });
    saveRoutes();
    
    data.tempBlips.forEach(blip => { if (mp.blips.exists(blip)) blip.destroy(); });
    routeCreators.delete(player.id);
    sendChat(player, `!{00FF00}Bus Route '${data.name}' saved successfully!`);
});

mp.events.add('server:bus:selectRoute', (player, index) => {
    player.call('client:bus:closeMenu');
    startRoute(player, index);
});

// --- DEPOT NPC ---
function createJobPed() {
    if(jobPed && mp.peds.exists(jobPed)) jobPed.destroy();
    jobPed = mp.peds.new(
        mp.joaat(JOB_CONFIG.pedModel), 
        new mp.Vector3(DEPOT_LOCATION.x, DEPOT_LOCATION.y, DEPOT_LOCATION.z),
        { heading: DEPOT_LOCATION.h, dimension: 0 }
    );
}

const JOB_CONFIG = {
    name: "Bus Driver",
    description: "Transport citizens across the city. Regular stops required.",
    previewButtons: [{ label: "View Routes", action: "default" }],
    pedModel: "s_m_m_busdev_01",
    blipSprite: 513,
    blipColor: 46,
    pos: DEPOT_LOCATION
};

createJobPed();
jobManager.register(JOB_KEY, JOB_CONFIG, logic);