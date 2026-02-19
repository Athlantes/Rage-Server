// packages/jobs/definitions/garbage.js
const jobManager = require('../jobManager');
const playerManager = require('../../core/playerManager');
const fs = require('fs');
const path = require('path');
const QuestEvents = require('../../core/questEvents');

const JOB_KEY = 'garbage'; // Defined Job Key
const ROUTES_FILE = path.join(__dirname, '../../data/garbageRoutes.json');
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

// --- CONFIG: REWARD MULTIPLIERS ---
const REWARD_CONFIG = {
    basePayMin: 35,
    basePayMax: 35,
    
    baseXpMin: 2,
    baseXpMax: 4,    
    
    perLevel: 3,
    bonusPercentage: 0.15 
};

const logic = {
    onInteract: (player) => {
        // 1. Get Player Stats
        const level = jobManager.getJobLevel(player, JOB_KEY);
        
        const payPerBag = REWARD_CONFIG.basePayMin + Math.floor(level * REWARD_CONFIG.perLevel);

        const safeRoutes = AVAILABLE_ROUTES.map(r => {
            // Distance Calc
            let totalDist = 0, lastPos = DEPOT_LOCATION;
            r.dumpsters.forEach(bin => {
                totalDist += Math.sqrt(Math.pow(bin.x - lastPos.x, 2) + Math.pow(bin.y - lastPos.y, 2) + Math.pow(bin.z - lastPos.z, 2));
                lastPos = bin;
            });

            // 3. Dynamic Estimate Calculation
            const bagMoney = r.dumpsters.length * payPerBag;
            const finishBonus = Math.floor(bagMoney * REWARD_CONFIG.bonusPercentage);
            const totalEst = bagMoney + finishBonus;

            return { 
                name: r.name, 
                difficulty: r.difficulty, 
                dumpsters: r.dumpsters, 
                distance: (totalDist / 1000),
                estimatedPay: totalEst 
            };
        });
        
        player.call('client:garbage:openMenu', [JSON.stringify(safeRoutes)]);
    },
    onStop: (player) => { cleanupJob(player); }
};

function startRoute(player, routeIndex) {
    const route = AVAILABLE_ROUTES[routeIndex - 1];
    if (!route) return player.outputChatBox("!{FF0000}Invalid route ID.");

    jobManager.startJobSession(player, 'garbage');

    // === 1. VEHICLE PROGRESSION ===
    const level = jobManager.getJobLevel(player, JOB_KEY);
    const rankName = jobManager.getRankName(level);
    
    let vehicleModel = 'trash';
    if (level >= 60) vehicleModel = 'phantom3'; 
    else if (level >= 20) vehicleModel = 'benson';

    const spawnPoint = TRUCK_SPAWNS[Math.floor(Math.random() * TRUCK_SPAWNS.length)];
    const truck = mp.vehicles.new(mp.joaat(vehicleModel), new mp.Vector3(spawnPoint.x, spawnPoint.y, spawnPoint.z), {
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
        throwCol: null,
        totalSessionEarnings: 0,
        updateInterval: null,
        lastTargetPos: null,
        lastState: null
    };

    const visualData = [];
    route.dumpsters.forEach((pos, idx) => {
        const col = mp.colshapes.newSphere(pos.x, pos.y, pos.z, 2.5);
        col.dimension = player.dimension;
        col.isGarbageBin = true;
        col.garbageIndex = idx;
        col.ownerId = player.id;
        jobData.cols.push(col);

        visualData.push({
            id: `bin_${idx}`,
            x: pos.x, y: pos.y, z: pos.z,
            markerColor: [248, 182, 50, 100],
            blipSprite: 952,
            blipColor: 2,
            name: "Dumpster"
        });
    });

    player.call('client:setupJobObjectives', [visualData]);

    activeJobs.set(player.id, jobData);
    player.call('showNotification', ['Sanitation', `Signed in as ${rankName} (Lvl ${level})`]);
    
    updateUI(player, "Go to Closest Bin", route.dumpsters[0]);

    startJobTicker(player);
}

function startJobTicker(player) {
    const job = activeJobs.get(player.id);
    if (!job) return;

    job.updateInterval = setInterval(() => {
        if (!mp.players.exists(player) || !activeJobs.has(player.id)) {
            return clearInterval(job.updateInterval);
        }

        const jobNow = activeJobs.get(player.id);

        if (jobNow.isCarrying) {
            if (jobNow.truck && mp.vehicles.exists(jobNow.truck)) {
                if (jobNow.lastState !== "carrying") {
                    jobNow.lastState = "carrying";
                    updateUI(player, "Throw in Truck", jobNow.truck.position);
                }
            }
            return;
        }

        let closestBinPos = null;
        let minDist = 99999;

        jobNow.cols.forEach((col) => {
            if (col && mp.colshapes.exists(col)) {
                const binPos = jobNow.route.dumpsters[col.garbageIndex];
                
                const dist = Math.sqrt(
                    Math.pow(binPos.x - player.position.x, 2) + 
                    Math.pow(binPos.y - player.position.y, 2) + 
                    Math.pow(binPos.z - player.position.z, 2)
                );

                if (dist < minDist) {
                    minDist = dist;
                    closestBinPos = binPos;
                }
            }
        });

        if (closestBinPos) {
            // Check if player has arrived (within 15 meters)
            if (minDist <= 15.0) {
                if (jobNow.lastState !== "arrived") {
                    jobNow.lastState = "arrived";
                    updateUI(player, "Collect Trash from Dumpster", closestBinPos);
                    player.call('client:removeJobObjective', ['closest_bin']);
                }
            } else {
                if (!jobNow.lastTargetPos || jobNow.lastTargetPos.x !== closestBinPos.x || jobNow.lastTargetPos.y !== closestBinPos.y || jobNow.lastState !== "seeking") {
                    jobNow.lastTargetPos = closestBinPos;
                    jobNow.lastState = "seeking";
                    
                    updateUI(player, "Go to Closest Bin", closestBinPos);
                    
                    player.call('client:removeJobObjective', ['closest_bin']);
                    player.call('client:setJobObjective', ['closest_bin', {
                        x: closestBinPos.x, 
                        y: closestBinPos.y, 
                        z: closestBinPos.z
                    }, {
                        route: true, // Creates map route only
                        name: "Closest Bin"
                    }]);
                }
            }
        } else if (jobNow.collectedCount >= jobNow.total) {
            if (jobNow.lastState !== "returning") {
                jobNow.lastState = "returning";
                updateUI(player, "Return to Depot", DUMP_ZONE);
            }
        }

    }, 1000);
}

function cleanupJob(player) {
    const job = activeJobs.get(player.id);
    if (!job) return;

    if (job.abandonTimer) {
        clearTimeout(job.abandonTimer);
        job.abandonTimer = null;
    }

    if (job.updateInterval) {
        clearInterval(job.updateInterval);
        job.updateInterval = null;
    }

    if (job.truck && mp.vehicles.exists(job.truck)) job.truck.destroy();
    
    job.cols.forEach(c => { if(c && mp.colshapes.exists(c)) c.destroy(); });
    if(job.throwCol && mp.colshapes.exists(job.throwCol)) job.throwCol.destroy();

    if (player.garbageBag && mp.objects.exists(player.garbageBag)) {
        player.garbageBag.destroy();
        player.garbageBag = null;
    }
    
    player.stopAnimation();
    player.setVariable('isJobCarrying', null);

    if (mp.players.exists(player)) {
        player.call('client:removeJobObjective', ['closest_bin']);
        player.call('client:clearAllJobObjectives');
        player.call('updateJobUI', [false, "", 0, 0, 0, null, null, null]);
    }

    activeJobs.delete(player.id);
}

function updateUI(player, text, targetPos = null) {
    if(mp.players.exists(player) && activeJobs.has(player.id)) {
        const job = activeJobs.get(player.id);
        
        let x = null, y = null, z = null;
        if (targetPos) {
            x = targetPos.x;
            y = targetPos.y;
            z = targetPos.z;
        }

        player.call('updateJobUI', [
            true, 
            text, 
            job.collectedCount, 
            job.total, 
            job.totalSessionEarnings || 0, 
            x, y, z
        ]);
    }
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
    if (player.dist(truck.position) > 60) return player.call('showNotification', ["Error", "Bring the truck closer first!"]);

    job.isCarrying = true;

    player.call('client:removeJobObjective', [`bin_${index}`]);
    player.call('client:removeJobObjective', ['closest_bin']); 
    if (job.cols[index] && mp.colshapes.exists(job.cols[index])) job.cols[index].destroy();

    const bag = mp.objects.new(mp.joaat('prop_cs_rub_binbag_01'), player.position, { dimension: player.dimension });
    player.garbageBag = bag;

    setTimeout(() => {
    if (mp.players.exists(player) && mp.objects.exists(bag)) {
        mp.players.call('client:attachProp', [bag.id, player.id, 57005, 0.12, 0.0, -0.05, 0, -70, -60]);
        player.playAnimation('missfbi4prepp1', '_idle_garbage_man', 1.0, 49); 

        player.setVariable('isJobCarrying', true);
        player.call('showNotification', ["Sanitation", "Put the bag in the truck."]);
        updateUI(player, "Throw bag in Truck", truck.position);
        createTruckRearMarker(player, truck);
    }
}, 50);
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

    player.call('client:setJobObjective', ['throw_marker', { x: rearPos.x, y: rearPos.y, z: rearPos.z + 1.5 }, {
        markerColor: [255, 0, 0, 150]
    }]);
}

async function finishThrowSequence(player) {
    const job = activeJobs.get(player.id);
    if (!job || !job.isCarrying) return;

    job.isCarrying = false;
    player.setVariable('isJobCarrying', null);

    if(job.throwCol && mp.colshapes.exists(job.throwCol)) job.throwCol.destroy();
    job.throwCol = null;
    player.call('client:removeJobObjective', ['throw_marker']);

    player.stopAnimation();
    if (player.garbageBag && mp.objects.exists(player.garbageBag)) {
        player.garbageBag.destroy();
        player.garbageBag = null;
    }

    job.collectedCount++;

    QuestEvents.emit(player, 'garbage_collect', { 
        count: 1,
        route: job.route.name 
    });

    const level = jobManager.getJobLevel(player, JOB_KEY);
    const randomBasePay = Math.floor(Math.random() * (REWARD_CONFIG.basePayMax - REWARD_CONFIG.basePayMin + 1)) + REWARD_CONFIG.basePayMin;
    let pay = randomBasePay + Math.floor(level * REWARD_CONFIG.perLevel);

    const randomBaseXp = Math.floor(Math.random() * (REWARD_CONFIG.baseXpMax - REWARD_CONFIG.baseXpMin + 1)) + REWARD_CONFIG.baseXpMin;
    const xp = randomBaseXp + Math.floor(level * 0.2);

    job.totalSessionEarnings = (job.totalSessionEarnings || 0) + pay;

    const dropChance = (level * 0.1);
    if (Math.random() * 100 < dropChance) {
        const loot = ['plastic_bottle', 'broken_glass', 'scrap_metal', 'gold_ring'];
        const item = loot[Math.floor(Math.random() * loot.length)];
        player.call('showNotification', ['Lucky Find', `You found a ${item}!`]);
    }

    await playerManager.addMoneyAndSave(player, pay, "Garbage Pay");
    await jobManager.addJobXp(player, JOB_KEY, xp);
    
    player.call('client:showJobSubtitle', [`+$${pay} | +${xp} XP`]);

    if (job.collectedCount >= job.total) {
        startDepotReturn(player);
    }
}

function startDepotReturn(player) {
    const job = activeJobs.get(player.id);
    updateUI(player, "Return to Depot", DUMP_ZONE);
    player.call('showNotification', ["Sanitation", "Route complete! Return to depot."]);
    
    jobManager.createObjective(player, DUMP_ZONE, "Return to Depot", 5.0, (p) => { 
        finishJob(p); 
    }, { 
        blipSprite: 449,
        blipColor: 1, 
        markerColor: [255, 0, 0, 150],
        route: true
    });
}

async function finishJob(player) {
    const job = activeJobs.get(player.id);
    if (!job) return;

    const level = jobManager.getJobLevel(player, JOB_KEY);
    const payPerBag = REWARD_CONFIG.basePayMin + Math.floor(level * REWARD_CONFIG.perLevel);
    
    const totalBagPay = payPerBag * job.total;
    const bonus = Math.floor(totalBagPay * REWARD_CONFIG.bonusPercentage);
    
    player.call('showNotification', ["Sanitation", `Job Done! Bonus: $${bonus}`]);
    if(bonus > 0) {
        await playerManager.addMoneyAndSave(player, bonus, "Garbage Bonus: " + job.route.name);
    }
    
    jobManager.stopJob(player, "Shift complete.");
}

// Admin Commands
mp.events.addCommand('createroute', (player, fullText, name) => {
    if (!name) return player.outputChatBox("Usage: /createroute [Route Name]");
    routeCreators.set(player.id, { name: name, dumpsters: [], tempBlips: [] });
    player.outputChatBox(`!{00FF00}Started recording route '${name}'. Go to bins and type /addbin`);
});

mp.events.addCommand('addbin', (player) => {
    if (!routeCreators.has(player.id)) return;
    const data = routeCreators.get(player.id);
    const pos = { x: parseFloat(player.position.x.toFixed(2)), y: parseFloat(player.position.y.toFixed(2)), z: parseFloat(player.position.z.toFixed(2)) };
    data.dumpsters.push(pos);
    const tempBlip = mp.blips.new(1, new mp.Vector3(pos.x, pos.y, pos.z), { name: `Bin #${data.dumpsters.length}`, color: 2, scale: 0.7, shortRange: false, dimension: player.dimension });
    data.tempBlips.push(tempBlip);
    player.outputChatBox(`!{00FF00}Bin added. Total: ${data.dumpsters.length}`);
});

mp.events.addCommand('removebin', (player) => {
    if (!routeCreators.has(player.id)) return;
    const data = routeCreators.get(player.id);
    if (data.dumpsters.length === 0) return player.outputChatBox("!{FF0000}No bins to remove.");
    data.dumpsters.pop();
    const blip = data.tempBlips.pop();
    if (mp.blips.exists(blip)) blip.destroy();
    player.outputChatBox(`!{FFFF00}Last bin removed. Total: ${data.dumpsters.length}`);
});

mp.events.addCommand('finishroute', (player, fullText, difficulty) => {
    if (!routeCreators.has(player.id)) return;
    const data = routeCreators.get(player.id);

    const newRoute = { 
        id: data.name.toLowerCase().replace(/\s/g, '_'), 
        name: data.name, 
        basePay: 0,
        difficulty: difficulty || "Medium", 
        dumpsters: data.dumpsters 
    };
    
    AVAILABLE_ROUTES.push(newRoute);
    saveRoutes();
    if (data.tempBlips) data.tempBlips.forEach(blip => { if (mp.blips.exists(blip)) blip.destroy(); });
    routeCreators.delete(player.id);
    player.outputChatBox(`!{00FF00}Route '${data.name}' saved with ${data.dumpsters.length} bins! Visuals cleared.`);
});

mp.events.add('playerExitVehicle', (player, vehicle) => {
    if (!activeJobs.has(player.id)) return;
    const job = activeJobs.get(player.id);
    
    if (job.truck === vehicle) {
        if (job.abandonTimer) clearTimeout(job.abandonTimer);

        job.abandonTimer = setTimeout(() => {
            if (mp.players.exists(player) && activeJobs.has(player.id)) {
                player.call('showNotification', ["Job Failed", "You abandoned the company vehicle."]);
                jobManager.stopJob(player, "Vehicle Abandoned"); 
            }
        }, 600000); // 10 Minutes
    }
});

mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
    if (!activeJobs.has(player.id)) return;
    const job = activeJobs.get(player.id);
    
    if (job.truck === vehicle && job.abandonTimer) {
        clearTimeout(job.abandonTimer);
        job.abandonTimer = null;
        player.call('showNotification', ["Sanitation", "Vehicle recovered."]);
    }
});

mp.events.add('vehicleDeath', (vehicle) => {
    activeJobs.forEach((job, playerId) => {
        if (job.truck === vehicle) {
            const player = mp.players.at(playerId);
            if (player) {
                player.call('showNotification', ["!{FF0000}Job Failed", "You destroyed the company truck!"]);
                jobManager.stopJob(player, "Vehicle Destroyed");
            }
        }
    });
});

const JOB_CONFIG = {
    name: "Sanitation Worker",
    description: "Help keep the city clean. Select a route and collect trash bags from dumpsters.",
    previewButtons: [
        { label: "Select Route", action: "default" }
    ],
    pedModel: "s_m_y_garbage", 
    blipSprite: 318, 
    blipColor: 26,   
    pos: DEPOT_LOCATION 
};
jobManager.register('garbage', JOB_CONFIG, logic);