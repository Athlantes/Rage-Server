// packages/jobs/definitions/garbage.js
const jobManager = require('../jobManager');
const playerManager = require('../../core/playerManager');
const fs = require('fs');
const path = require('path');

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

let AVAILABLE_ROUTES = [];
const activeJobs = new Map();
const routeCreators = new Map();

function loadRoutes() {
    try {
        if (fs.existsSync(ROUTES_FILE)) {
            AVAILABLE_ROUTES = JSON.parse(fs.readFileSync(ROUTES_FILE, 'utf8'));
            console.log(`[Garbage] Loaded ${AVAILABLE_ROUTES.length} routes.`);
        } else {
            fs.writeFileSync(ROUTES_FILE, '[]');
        }
    } catch (e) { console.error('[Garbage] Error loading routes:', e); }
}
loadRoutes();
function saveRoutes() { fs.writeFileSync(ROUTES_FILE, JSON.stringify(AVAILABLE_ROUTES, null, 4)); }

const logic = {
    onInteract: (player) => {
        const safeRoutes = AVAILABLE_ROUTES.map(r => {
            let totalDist = 0, lastPos = DEPOT_LOCATION;
            r.dumpsters.forEach(bin => {
                totalDist += Math.sqrt(Math.pow(bin.x - lastPos.x, 2) + Math.pow(bin.y - lastPos.y, 2) + Math.pow(bin.z - lastPos.z, 2));
                lastPos = bin;
            });
            return { name: r.name, difficulty: r.difficulty, basePay: r.basePay, dumpsters: r.dumpsters, distance: (totalDist / 1000) };
        });
        player.call('client:garbage:openMenu', [JSON.stringify(safeRoutes)]);
    },
    onStop: (player) => { cleanupJob(player); }
};

function startRoute(player, routeIndex) {
    const route = AVAILABLE_ROUTES[routeIndex - 1];
    if (!route) return player.outputChatBox("!{FF0000}Invalid route ID.");

    jobManager.startJobSession(player, 'garbage');

    const spawnPoint = TRUCK_SPAWNS[Math.floor(Math.random() * TRUCK_SPAWNS.length)];
    const truck = mp.vehicles.new(mp.joaat(TRUCK_MODEL), new mp.Vector3(spawnPoint.x, spawnPoint.y, spawnPoint.z), {
        heading: spawnPoint.h, numberPlate: "TRASH", locked: false, engine: false, dimension: player.dimension
    });
    truck.setVariable('engine', false);
    truck.setVariable('fuel', 100.0);
    truck.jobOwner = player.id;
    
    setTimeout(() => {
        if (mp.players.exists(player) && mp.vehicles.exists(truck)) player.call('client:warpIntoVehicle', [truck.id, -1]);
    }, 250); 

    const jobData = {
        route: route,
        collectedCount: 0,
        total: route.dumpsters.length,
        truck: truck,
        cols: [],
        isCarrying: false,
        throwCol: null
    };

    // --- VISUALS REFAC: Send list to client for local rendering ---
    const visualData = [];
    route.dumpsters.forEach((pos, idx) => {
        // Create Server Logic Shape (invisible)
        const col = mp.colshapes.newSphere(pos.x, pos.y, pos.z, 0.4);
        col.dimension = player.dimension;
        col.isGarbageBin = true;
        col.garbageIndex = idx;
        col.ownerId = player.id;
        jobData.cols.push(col);

        // Prepare Client Visual Data
        visualData.push({
            id: `bin_${idx}`,
            x: pos.x, y: pos.y, z: pos.z,
            markerColor: [248, 182, 50, 100],
            blipSprite: 952,
            blipColor: 2,
            name: "Dumpster"
        });
    });

    // Send all visual data at once
    player.call('client:setupJobObjectives', [visualData]);

    activeJobs.set(player.id, jobData);
    player.call('showNotification', ['Sanitation', `Route started: ${route.name}`]);
    updateUI(player, `Bins: 0 / ${jobData.total}`);
}

function cleanupJob(player) {
    const job = activeJobs.get(player.id);
    if (!job) return;

    if (job.truck && mp.vehicles.exists(job.truck)) job.truck.destroy();
    
    // Destroy Logic Shapes
    job.cols.forEach(c => { if(mp.colshapes.exists(c)) c.destroy(); });
    if(job.throwCol && mp.colshapes.exists(job.throwCol)) job.throwCol.destroy();

    // Destroy Prop
    if (player.garbageBag && mp.objects.exists(player.garbageBag)) {
        player.garbageBag.destroy();
        player.garbageBag = null;
    }
    
    player.stopAnimation();
    player.setVariable('isJobCarrying', null);

    if (mp.players.exists(player)) {
        player.call('client:clearAllJobObjectives'); // Clears all client markers
        player.call('updateJobUI', [false, "", 0, 0]);
    }

    activeJobs.delete(player.id);
}

function updateUI(player, text) {
    const job = activeJobs.get(player.id);
    if(job) player.call('updateJobUI', [true, "Sanitation", job.collectedCount, job.total]);
}

mp.events.add('server:garbage:startRoute', (player, routeIndex) => {
    if (player.activeJobId && player.activeJobId !== 'garbage') return player.call('showNotification', ["Error", "Finish your current job first."]);
    startRoute(player, routeIndex);
});

mp.events.add('playerEnterColshape', (player, shape) => {
    if (!activeJobs.has(player.id)) return;
    if (shape.ownerId !== player.id) return;
    if (shape.isGarbageBin) {
        if (player.vehicle) return player.call('showNotification', ["Sanitation", "Exit vehicle to collect trash."]);
        startPickupSequence(player, shape.garbageIndex);
    }
    if (shape.isTruckRear) finishThrowSequence(player);
});

function startPickupSequence(player, index) {
    const job = activeJobs.get(player.id);
    if (!job || job.isCarrying) return; 

    const truck = job.truck;
    if (!truck || !mp.vehicles.exists(truck)) return player.call('showNotification', ["Error", "Your truck is missing!"]);
    if (player.dist(truck.position) > 30) return player.call('showNotification', ["Error", "Bring the truck closer first!"]);

    job.isCarrying = true;

    // Remove Visuals for this specific bin
    player.call('client:removeJobObjective', [`bin_${index}`]);
    if (job.cols[index] && mp.colshapes.exists(job.cols[index])) job.cols[index].destroy();

    player.call('client:freezePlayer', [true]);
    player.playAnimation('missfbi4prepp1', '_bag_pickup_garbage_man', 2.0, 0); 

    setTimeout(() => {
        if (!mp.players.exists(player)) return;
        const bag = mp.objects.new(mp.joaat('prop_cs_rub_binbag_01'), player.position, { dimension: player.dimension });
        player.garbageBag = bag;

        setTimeout(() => {
            if (mp.players.exists(player) && mp.objects.exists(bag)) {
                // --- ATTACH FIX: Server Side Attachment (Syncs to all) ---
                // attachTo(entity, bone, x, y, z, rx, ry, rz, p8, p9, p10, p11, p12, p13)
                bag.attachTo(player, 57005, 0.12, 0.0, -0.05, 0, -70, -60, false, false, false, false, 2, true);
            }
        }, 50);
    }, 500); 

    setTimeout(() => {
        if(!mp.players.exists(player)) return;
        player.call('client:freezePlayer', [false]);
        player.setVariable('isJobCarrying', true);
        player.playAnimation('missfbi4prepp1', '_idle_garbage_man', 2.0, 49);
        player.call('showNotification', ["Sanitation", "Put the bag in the truck."]);
        createTruckRearMarker(player, truck);
    }, 1500);
}

function createTruckRearMarker(player, truck) {
    const job = activeJobs.get(player.id);
    const dist = -4.5; 
    const rot = (truck.rotation.z * Math.PI) / 180;
    const rearPos = new mp.Vector3(
        truck.position.x + (dist * Math.sin(-rot)),
        truck.position.y + (dist * Math.cos(-rot)),
        truck.position.z - 0.5
    );

    job.throwCol = mp.colshapes.newSphere(rearPos.x, rearPos.y, rearPos.z, 2.0);
    job.throwCol.dimension = player.dimension;
    job.throwCol.isTruckRear = true;
    job.throwCol.ownerId = player.id;

    // Use Client Visual
    player.call('client:setJobObjective', ['throw_marker', { x: rearPos.x, y: rearPos.y, z: rearPos.z + 1.5 }, {
        markerColor: [255, 0, 0, 150]
    }]);
}

function finishThrowSequence(player) {
    const job = activeJobs.get(player.id);
    if (!job || !job.isCarrying) return;

    job.isCarrying = false;
    player.setVariable('isJobCarrying', null);

    // Clear Throw Marker
    if(job.throwCol && mp.colshapes.exists(job.throwCol)) job.throwCol.destroy();
    job.throwCol = null;
    player.call('client:removeJobObjective', ['throw_marker']);

    player.stopAnimation();
    player.playAnimation('mp_common', 'givetake2_a', 1, 0);

    if (player.garbageBag && mp.objects.exists(player.garbageBag)) {
        player.garbageBag.destroy();
        player.garbageBag = null;
    }

    setTimeout(() => { if(mp.players.exists(player)) player.stopAnimation(); }, 1500);

    job.collectedCount++;
    player.call('showNotification', ["Sanitation", "Trash collected."]);
    updateUI(player);

    if (job.collectedCount >= job.total) startDepotReturn(player);
}

function startDepotReturn(player) {
    const job = activeJobs.get(player.id);
    player.call('showNotification', ["Sanitation", "Route complete! Return to depot."]);
    jobManager.createObjective(player, DUMP_ZONE, "Return to Depot", 5.0, (p) => { finishJob(p); }, { blipColor: 1, markerColor: [255, 0, 0, 100] });
}

async function finishJob(player) {
    const job = activeJobs.get(player.id);
    if (!job) return;
    const total = job.route.basePay + (job.collectedCount * 50);
    player.call('showNotification', ["Sanitation", `Job Done! Received $${total}`]);
    await playerManager.addMoneyAndSave(player, total, "Garbage Job: " + job.route.name);
    jobManager.stopJob(player, "Shift complete.");
}

// ... Keep Admin Commands and Events (createroute, vehicleDeath) same as before ...
// Just ensure you add this Job Config at bottom
const JOB_CONFIG = {
    name: "Sanitation Worker",
    pedModel: "s_m_y_garbage", 
    blipSprite: 318, 
    blipColor: 26,   
    pos: DEPOT_LOCATION 
};
jobManager.register('garbage', JOB_CONFIG, logic);