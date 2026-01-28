const jobManager = require('../jobManager');
const playerManager = require('../../core/playerManager');
const fs = require('fs');
const path = require('path');

// --- CONSTANTS & CONFIG ---
const ROUTES_FILE = path.join(__dirname, '../../data/garbageRoutes.json');
const TRUCK_MODEL = 'trash';
const DEPOT_LOCATION = { x: -321.41, y: -1545.74, z: 31.02, h: -2.09 }; 
const DUMP_ZONE = { x: -347.63, y: -1561.57, z: 24.95 }; 

const TRUCK_SPAWNS = [
    { x: -324.43, y: -1529.01, z: 27.26, h: -0.86 },
    { x: -327.43, y: -1528.77, z: 27.25, h: -1.48 },
    { x: -330.59, y: -1529.15, z: 27.25, h: 0.46 },
    { x: -333.79, y: -1528.63, z: 27.27, h: -0.53 }
];

// --- STATE MANAGEMENT ---
let AVAILABLE_ROUTES = [];
const activeJobs = new Map();
const routeCreators = new Map();

// --- LOAD ROUTES ---
function loadRoutes() {
    try {
        if (fs.existsSync(ROUTES_FILE)) {
            const data = fs.readFileSync(ROUTES_FILE, 'utf8');
            AVAILABLE_ROUTES = JSON.parse(data);
            console.log(`[Garbage] Loaded ${AVAILABLE_ROUTES.length} routes.`);
        } else {
            fs.writeFileSync(ROUTES_FILE, '[]');
        }
    } catch (e) {
        console.error('[Garbage] Error loading routes:', e);
    }
}
loadRoutes();

function saveRoutes() {
    fs.writeFileSync(ROUTES_FILE, JSON.stringify(AVAILABLE_ROUTES, null, 4));
}

// --- LOGIC ---
const logic = {
    onInteract: (player) => {
        const safeRoutes = AVAILABLE_ROUTES.map(r => {
            // 1. Calculate Total Distance
            let totalDist = 0;
            let lastPos = DEPOT_LOCATION; // Start measuring from Depot

            r.dumpsters.forEach(bin => {
                // Euclidean distance formula (3D)
                const d = Math.sqrt(
                    Math.pow(bin.x - lastPos.x, 2) + 
                    Math.pow(bin.y - lastPos.y, 2) + 
                    Math.pow(bin.z - lastPos.z, 2)
                );
                totalDist += d;
                lastPos = bin; // Update last position to current bin
            });

            // 2. Return data including formatted distance
            return {
                name: r.name,
                difficulty: r.difficulty,
                basePay: r.basePay,
                dumpsters: r.dumpsters,
                distance: (totalDist / 1000) // Convert Meters to KM
            };
        });

        player.call('client:garbage:openMenu', [JSON.stringify(safeRoutes)]);
    },

    onStop: (player) => {
        cleanupJob(player);
    }
};

// --- JOB FUNCTIONS ---

function startRoute(player, routeIndex) {
    const route = AVAILABLE_ROUTES[routeIndex - 1];
    if (!route) return player.outputChatBox("!{FF0000}Invalid route ID.");

    jobManager.startJobSession(player, 'garbage');

    // 1. Spawn Truck
    const spawnPoint = TRUCK_SPAWNS[Math.floor(Math.random() * TRUCK_SPAWNS.length)];
    const truck = mp.vehicles.new(mp.joaat(TRUCK_MODEL), new mp.Vector3(spawnPoint.x, spawnPoint.y, spawnPoint.z), {
        heading: spawnPoint.h,
        numberPlate: "TRASH",
        locked: false,
        engine: false,
        dimension: player.dimension
    });
    truck.setVariable('fuel', 100.0);
    truck.jobOwner = player.id;
    
    setTimeout(() => {
        if (mp.players.exists(player) && mp.vehicles.exists(truck)) {
            player.call('client:warpIntoVehicle', [truck.id, -1]);
        }
    }, 250); 

    // 2. Setup Job State
    const jobData = {
        route: route,
        collectedCount: 0,
        total: route.dumpsters.length,
        truck: truck,
        blips: [],
        cols: [],
        markers: [],
        isCarrying: false,
        throwCol: null,   // The marker behind the truck
        throwMarker: null // The visual marker behind the truck
    };

    // 3. Create Blips & Markers for bins
    route.dumpsters.forEach((pos, idx) => {
        const blip = mp.blips.new(952, new mp.Vector3(pos.x, pos.y, pos.z), {
            name: "Dumpster",
            color: 2, 
            scale: 0.7,
            shortRange: false,
            dimension: player.dimension
        });

        const marker = mp.markers.new(1, new mp.Vector3(pos.x, pos.y, pos.z - 1.0), 0.5, {
            color: [248, 182, 50, 100], // Orange
            visible: true,
            dimension: player.dimension
        });

        const col = mp.colshapes.newSphere(pos.x, pos.y, pos.z, 0.4);
        col.dimension = player.dimension;
        col.isGarbageBin = true;
        col.garbageIndex = idx;
        col.ownerId = player.id;

        jobData.blips.push(blip);
        jobData.markers.push(marker);
        jobData.cols.push(col);
    });

    activeJobs.set(player.id, jobData);

    player.call('showNotification', ['Sanitation', `Route started: ${route.name}`]);
    updateUI(player, `Bins: 0 / ${jobData.total}`);
}

function cleanupJob(player) {
    const job = activeJobs.get(player.id);
    if (!job) return;

    if (job.truck && mp.vehicles.exists(job.truck)) job.truck.destroy();

    // Destroy Bins
    job.blips.forEach(b => { if(mp.blips.exists(b)) b.destroy(); });
    job.cols.forEach(c => { if(mp.colshapes.exists(c)) c.destroy(); });
    job.markers.forEach(m => { if(mp.markers.exists(m)) m.destroy(); });

    // Destroy Throw Marker/Shape
    if(job.throwCol && mp.colshapes.exists(job.throwCol)) job.throwCol.destroy();
    if(job.throwMarker && mp.markers.exists(job.throwMarker)) job.throwMarker.destroy();

    // Destroy Bag Prop
    if (player.garbageBag && mp.objects.exists(player.garbageBag)) {
        player.garbageBag.destroy();
        player.garbageBag = null;
    }
    
    player.stopAnimation();
    player.setVariable('isJobCarrying', null);

    if (mp.players.exists(player)) {
        jobManager.clearObjective(player);
        player.call('updateJobUI', [false, "", 0, 0]);
    }

    activeJobs.delete(player.id);
}

function updateUI(player, text) {
    const job = activeJobs.get(player.id);
    if(job) {
        player.call('updateJobUI', [true, "Sanitation", job.collectedCount, job.total]);
    }
}

// --- EVENTS ---

mp.events.add('server:garbage:startRoute', (player, routeIndex) => {
    if (player.activeJobId && player.activeJobId !== 'garbage') {
        return player.call('showNotification', ["Error", "Finish your current job first."]);
    }
    startRoute(player, routeIndex);
});

// --- CORE INTERACTION LOGIC ---
mp.events.add('playerEnterColshape', (player, shape) => {
    if (!activeJobs.has(player.id)) return;
    if (shape.ownerId !== player.id) return;

    // 1. Pickup Trash (Bin)
    if (shape.isGarbageBin) {
        if (player.vehicle) return player.call('showNotification', ["Sanitation", "Exit vehicle to collect trash."]);
        startPickupSequence(player, shape.garbageIndex);
    }

    // 2. Throw Trash (Truck)
    if (shape.isTruckRear) {
        finishThrowSequence(player);
    }
});

function startPickupSequence(player, index) {
    const job = activeJobs.get(player.id);
    if (!job || job.isCarrying) return; 

    const truck = job.truck;
    if (!truck || !mp.vehicles.exists(truck)) {
        return player.call('showNotification', ["Error", "Your truck is missing!"]);
    }

    const distToTruck = player.dist(truck.position);
    if (distToTruck > 30) {
        return player.call('showNotification', ["Error", "Bring the truck closer first!"]);
    }

    // 1. Lock state immediately
    job.isCarrying = true;

    // 2. Destroy the bin visuals immediately so they don't stick around
    if (job.blips[index] && mp.blips.exists(job.blips[index])) job.blips[index].destroy();
    if (job.markers[index] && mp.markers.exists(job.markers[index])) job.markers[index].destroy();
    if (job.cols[index] && mp.colshapes.exists(job.cols[index])) job.cols[index].destroy();

    // 3. Freeze player to prevent "sliding" while bending over
    player.call('client:freezePlayer', [true]); // Requires a simple client event (see below) or engine freeze
    
    player.playAnimation('missfbi4prepp1', '_bag_pickup_garbage_man', 2.0, 0); 

    // 4. Create/Attach Bag MID-ANIMATION (approx 350ms in, when hand is low)
    setTimeout(() => {
        if (!mp.players.exists(player)) return;

        const bag = mp.objects.new(mp.joaat('prop_cs_rub_binbag_01'), player.position, { dimension: player.dimension });
        player.garbageBag = bag;

        // Attach immediately after creation
        setTimeout(() => {
            if (mp.players.exists(player) && mp.objects.exists(bag)) {
                // Sending Bone ID 57005 (Right Hand)
                player.call('client:attachProp', [bag.id, 57005, 0.12, 0.0, -0.05, 0,    -70,   -60]);
            }
        }, 50);
    }, 500); // 500ms delay: "Grabs" bag when hand is down

    // 5. Finish Sequence (Unfreeze & Switch to Idle)
    setTimeout(() => {
        if(!mp.players.exists(player)) return;
        
        player.call('client:freezePlayer', [false]); // Unfreeze
        player.setVariable('isJobCarrying', true);
        
        // Switch to Carrying Idle (Flag 49 = Loop + Upper Body + Allow movement)
        player.playAnimation('missfbi4prepp1', '_idle_garbage_man', 2.0, 49);

        player.call('showNotification', ["Sanitation", "Put the bag in the truck."]);
        createTruckRearMarker(player, truck);

    }, 1500); // Wait for pickup anim to fully finish
}

function createTruckRearMarker(player, truck) {
    const job = activeJobs.get(player.id);
    
    // Calculate Rear Position based on rotation
    const dist = -4.5; // Distance behind truck
    const rot = (truck.rotation.z * Math.PI) / 180;
    const rearPos = new mp.Vector3(
        truck.position.x + (dist * Math.sin(-rot)),
        truck.position.y + (dist * Math.cos(-rot)),
        truck.position.z - 0.5
    );

    // Create Logic Shape
    job.throwCol = mp.colshapes.newSphere(rearPos.x, rearPos.y, rearPos.z, 2.0);
    job.throwCol.dimension = player.dimension;
    job.throwCol.isTruckRear = true;
    job.throwCol.ownerId = player.id;

    // Create Visual Marker (Red Arrow or Cylinder)
    job.throwMarker = mp.markers.new(0, new mp.Vector3(rearPos.x, rearPos.y, rearPos.z + 1.5), 1.0, {
        color: [255, 0, 0, 150], // Red
        visible: true,
        dimension: player.dimension,
        bobUpAndDown: true
    });
}

function finishThrowSequence(player) {
    const job = activeJobs.get(player.id);
    if (!job || !job.isCarrying) return;

    job.isCarrying = false;
    player.setVariable('isJobCarrying', null);

    // 1. Cleanup Throw Marker
    if(job.throwCol && mp.colshapes.exists(job.throwCol)) job.throwCol.destroy();
    if(job.throwMarker && mp.markers.exists(job.throwMarker)) job.throwMarker.destroy();
    job.throwCol = null;
    job.throwMarker = null;

    // 2. Animation (Throw)
    player.stopAnimation();
    player.playAnimation('mp_common', 'givetake2_a', 1, 0);

    // 3. Destroy Bag
    if (player.garbageBag && mp.objects.exists(player.garbageBag)) {
        player.garbageBag.destroy();
        player.garbageBag = null;
    }

    // 4. Stop Animation shortly after
    setTimeout(() => {
        if(mp.players.exists(player)) player.stopAnimation();
    }, 1500);

    // 5. Update Progress
    job.collectedCount++;
    player.call('showNotification', ["Sanitation", "Trash collected."]);
    updateUI(player);

    if (job.collectedCount >= job.total) {
        startDepotReturn(player);
    }
}

function startDepotReturn(player) {
    const job = activeJobs.get(player.id);
    player.call('showNotification', ["Sanitation", "Route complete! Return to depot."]);
    
    jobManager.createObjective(player, DUMP_ZONE, "Return to Depot", 5.0, (p) => {
        finishJob(p);
    }, { blipColor: 1, markerColor: [255, 0, 0, 100] });
}

async function finishJob(player) {
    const job = activeJobs.get(player.id);
    if (!job) return;

    const basePay = job.route.basePay;
    const bonus = job.collectedCount * 50; 
    const total = basePay + bonus;

    player.call('showNotification', ["Sanitation", `Job Done! Received $${total}`]);
    await playerManager.addMoneyAndSave(player, total, "Garbage Job: " + job.route.name);

    jobManager.stopJob(player, "Shift complete.");
}

// --- ADMIN COMMANDS ---
mp.events.addCommand('createroute', (player, fullText, name) => {
    if (!name) return player.outputChatBox("Usage: /createroute [Route Name]");
    
    // Initialize with an empty array for temporary blips
    routeCreators.set(player.id, { 
        name: name, 
        dumpsters: [], 
        tempBlips: [] // <--- Added this to track visuals
    });
    
    player.outputChatBox(`!{00FF00}Started recording route '${name}'. Go to bins and type /addbin`);
});

mp.events.addCommand('addbin', (player) => {
    if (!routeCreators.has(player.id)) return;
    const data = routeCreators.get(player.id);
    
    const pos = {
        x: parseFloat(player.position.x.toFixed(2)),
        y: parseFloat(player.position.y.toFixed(2)),
        z: parseFloat(player.position.z.toFixed(2))
    };

    data.dumpsters.push(pos);

    // Create a temporary green blip
    const tempBlip = mp.blips.new(1, new mp.Vector3(pos.x, pos.y, pos.z), {
        name: `Bin #${data.dumpsters.length}`,
        color: 2, // 2 = Green
        scale: 0.7,
        shortRange: false, // Visible from far away so you can see your route
        dimension: player.dimension
    });

    // Store the blip so we can delete it later
    data.tempBlips.push(tempBlip);

    player.outputChatBox(`!{00FF00}Bin added. Total: ${data.dumpsters.length}`);
});

mp.events.addCommand('finishroute', (player, fullText, basePay, difficulty) => {
    if (!routeCreators.has(player.id)) return;
    const data = routeCreators.get(player.id);
    
    if (!basePay) basePay = 1000;
    
    const newRoute = {
        id: data.name.toLowerCase().replace(/\s/g, '_'),
        name: data.name,
        basePay: parseInt(basePay),
        difficulty: difficulty || "Medium",
        dumpsters: data.dumpsters
    };

    AVAILABLE_ROUTES.push(newRoute);
    saveRoutes();

    // CLEANUP: Remove the green blips now that we are done
    if (data.tempBlips) {
        data.tempBlips.forEach(blip => {
            if (mp.blips.exists(blip)) blip.destroy();
        });
    }

    routeCreators.delete(player.id);
    player.outputChatBox(`!{00FF00}Route '${data.name}' saved with ${data.dumpsters.length} bins! Visuals cleared.`);
});

mp.events.add('playerExitVehicle', (player, vehicle) => {
    if (!activeJobs.has(player.id)) return;
    const job = activeJobs.get(player.id);
    if (job.truck === vehicle) {
        job.abandonTimer = setTimeout(() => {
            if (mp.players.exists(player)) {
                player.call('showNotification', ["Job Failed", "You abandoned the company vehicle."]);
                jobManager.stopJob(player, "Vehicle Abandoned"); 
            } else {
                cleanupJob({ id: player.id }); 
            }
        }, 600000); 
    }
});

mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
    if (!activeJobs.has(player.id)) return;
    const job = activeJobs.get(player.id);
    if (job.truck === vehicle && job.abandonTimer) {
        clearTimeout(job.abandonTimer);
        job.abandonTimer = null;
    }
});

mp.events.add('vehicleDeath', (vehicle) => {
    activeJobs.forEach((job, playerId) => {
        if (job.truck === vehicle) {
            const player = mp.players.at(playerId);
            if (player) {
                player.call('showNotification', ["!{FF0000}Job Failed", "You destroyed the company truck!"]);
                jobManager.stopJob(player, "Vehicle Destroyed");
            } else {
                cleanupJob({ id: playerId });
            }
        }
    });
});

const JOB_CONFIG = {
    name: "Sanitation Worker",
    pedModel: "s_m_y_garbage", 
    blipSprite: 318, 
    blipColor: 26,   
    pos: DEPOT_LOCATION 
};

jobManager.register('garbage', JOB_CONFIG, logic);