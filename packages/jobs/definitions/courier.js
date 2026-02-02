const jobManager = require('../jobManager');
const playerManager = require('../../core/playerManager');
const HOUSES = require('../../data/houses');

const JOB_KEY = 'courier';

const DEPOT_CONFIG = {
    spawn: { x: 62.63, y: 124.34, z: 79.39, h: 162.76 },
    loadingBay: { x: 115.13, y: 99.98, z: 80.87, h: 170.20 }
};

const JOB_CONFIG = {
    name: "GoPostal Courier",
    pedModel: "s_m_m_postal_01", 
    blipSprite: 616, 
    blipColor: 26,
    pos: { x: 83.51, y: 133.92, z: 80.53, h: 69.79 },
    staticPeds: [
        {
            model: "s_m_m_postal_02", 
            x: 115.72, y: 102.57, z: 81.11, h: 162.94,
            anim: { dict: "missheistdockssetup1clipboard@idle_a", name: "idle_a", flag: 1 }
        }
    ]
};

// --- CONFIG: REWARD MULTIPLIERS ---
const REWARD_CONFIG = {
    basePayMin: 20,
    basePayMax: 30,

    baseXpMin: 3,
    baseXpMax: 5,

    perLevel: 2,         
    bonusPercentage: 0.05, 
    tipChanceBase: 5,      
    tipChanceCap: 30       
};

// --- HELPER: CALCULATE CAPACITY ---
function getMaxPackages(level) {
    let limit = 8; // Base Capacity
    if (level >= 10) limit++; // 9
    if (level >= 20) limit++; // 10
    if (level >= 40) limit++; // 11
    if (level >= 60) limit++; // 12
    if (level >= 80) limit++; // 13
    if (level >= 100) limit++; // 14
    return limit;
}

// --- HELPER: UPDATE HUD ---
function updateUI(player, text, targetPos = null) {
    if(mp.players.exists(player)) {
        const current = player.courierData ? player.courierData.packages : 0;
        const max = player.courierData ? player.courierData.totalPackages : 8;
        const earned = player.courierData ? player.courierData.totalSessionEarnings : 0;
        
        // Prepare Coordinates
        let x = null, y = null, z = null;
        if (targetPos) {
            x = targetPos.x;
            y = targetPos.y;
            z = targetPos.z;
        }

        // Send: visible, text, current, max, earned, X, Y, Z
        player.call('updateJobUI', [true, text, current, max, earned, x, y, z]);
    }
}

function hideUI(player) {
    if(mp.players.exists(player)) {
        player.call('updateJobUI', [false, "", 0, 0]);
    }
}

// --- LOGIC ---
const logic = {
    onStart: (player) => {
        // 1. Get Level
        const level = jobManager.getJobLevel(player, JOB_KEY);
        const rankName = jobManager.getRankName(level);
        
        // 2. Calculate Max Packages based on Level
        const maxCapacity = getMaxPackages(level);

        player.courierData = { 
            packages: 0, 
            totalPackages: maxCapacity, // Store session limit
            currentStop: null, 
            visitedHouses: [],
            totalSessionEarnings: 0
        };

        // Vehicle Progression
        // Lv 1: Rumpo (Basic) | Lv 20: Speedo (Faster) | Lv 50: Boxville (The Big One)
        let vehicleModel = 'boxville2'; 
        if (level >= 50) vehicleModel = 'boxville2';
        else if (level >= 20) vehicleModel = 'boxville2';

        const veh = mp.vehicles.new(mp.joaat(vehicleModel), new mp.Vector3(DEPOT_CONFIG.spawn.x, DEPOT_CONFIG.spawn.y, DEPOT_CONFIG.spawn.z), {
            heading: DEPOT_CONFIG.spawn.h,
            numberPlate: "POST " + player.id,
            locked: false,
            engine: false
        });

        veh.setVariable('engine', false);
        veh.setVariable('fuel', 100.0);
        veh.jobOwner = player.id;
        player.jobVehicle = veh;

        setTimeout(() => {
            if (mp.players.exists(player) && mp.vehicles.exists(veh)) {
                player.call('client:warpIntoVehicle', [veh.id, -1]);
            }
        }, 250); 

        player.outputChatBox(`!{F0C400}[Courier] !{FFFFFF}Signed in as !{F0C400}${rankName} (Lvl ${level})!{FFFFFF}.`);
        player.outputChatBox(`!{F0C400}[Courier] !{FFFFFF}Capacity: !{00FF00}${maxCapacity} Packages`);
        updateUI(player, "Drive to Loading Bay", DEPOT_CONFIG.loadingBay);
        startLoadingPhase(player);
    },

    onStop: (player) => {
        // 1. Clear any active physical objectives (Checkpoints/Markers)
        jobManager.clearObjective(player);

        // 2. Destroy job vehicles and props
        if (player.jobVehicle && mp.vehicles.exists(player.jobVehicle)) player.jobVehicle.destroy();
        if (player.courierBox && mp.objects.exists(player.courierBox)) player.courierBox.destroy();
        
        // 3. Clear timers
        if (player.abandonTimer) { 
            clearTimeout(player.abandonTimer); 
            player.abandonTimer = null; 
        }
        if (player.jobExitCheck) { 
            clearInterval(player.jobExitCheck); 
            player.jobExitCheck = null; 
        }
        
        // 4. Reset player variables
        player.setVariable('isJobCarrying', null);
        player.stopAnimation();
        
        player.jobVehicle = null;
        player.courierBox = null;
        player.courierData = null;
        hideUI(player);
    }
};

function startLoadingPhase(player) {
    if (!player.courierData.visitedHouses) player.courierData.visitedHouses = [];

    jobManager.createObjective(player, DEPOT_CONFIG.loadingBay, "Loading Bay", 4.0, (p) => {
        const veh = p.vehicle;
        if (!veh || veh.id !== p.jobVehicle.id) {
            return p.call('showNotification', ['Courier', 'Please bring your Job Van here.']);
        }

        veh.velocity = new mp.Vector3(0, 0, 0);
        veh.engine = false; 
        veh.frozen = true; 
        
        updateUI(p, "Loading packages...", p.position);
        p.call('showNotification', ['Courier', 'Loading packages... (Engine Off)']);
        jobManager.clearObjective(p); 

        setTimeout(() => {
            if (!mp.players.exists(p)) return;
            if (p.vehicle) p.vehicle.frozen = false; 

            // Set packages to the Calculated Limit
            p.courierData.packages = p.courierData.totalPackages; 
            p.courierData.visitedHouses = []; 
            
            p.outputChatBox(`!{00FF00}[Courier] !{FFFFFF}Loaded ${p.courierData.packages} packages! Route sent to GPS.`);
            startDeliveryPhase(p);
        }, 4000);
    }, { 
        blipColor: 26, 
        markerColor: [0, 188, 255, 100]
    });
}

function startDeliveryPhase(player) {
    let availableHouses = HOUSES.filter(h => !player.courierData.visitedHouses.includes(h.id));

    if (availableHouses.length === 0) {
        player.courierData.visitedHouses = [];
        return startDeliveryPhase(player);
    }

    const MAX_DISTANCE = 750.0;
    const pPos = player.position;
    
    let nearbyHouses = availableHouses.filter(h => {
        const dist = Math.sqrt(Math.pow(h.street.x - pPos.x, 2) + Math.pow(h.street.y - pPos.y, 2));
        return dist <= MAX_DISTANCE;
    });

    const pool = nearbyHouses.length > 0 ? nearbyHouses : availableHouses;
    const randomIdx = Math.floor(Math.random() * pool.length);
    const stop = pool[randomIdx];
    
    player.courierData.currentStop = stop;
    player.courierData.visitedHouses.push(stop.id);

    updateUI(player, "Drive to Street", stop.street);

    jobManager.createObjective(player, stop.street, "Delivery Area", 8.0, (p) => {
        p.call('showNotification', ['Courier', 'You arrived! Park and exit the van.']);
        updateUI(p, "Exit Vehicle", p.position);
        jobManager.clearObjective(p);

        if (p.jobExitCheck) clearInterval(p.jobExitCheck);
        p.jobExitCheck = setInterval(() => {
            if (!mp.players.exists(p)) return;
            if (!p.vehicle) {
                clearInterval(p.jobExitCheck);
                p.jobExitCheck = null;
                startTrunkPhase(p);
            }
        }, 500);
    }, { 
        blipColor: 26, 
        markerColor: [0, 188, 255, 100]
    });
}

function startTrunkPhase(player) {
    const veh = player.jobVehicle;
    if (!veh || !mp.vehicles.exists(veh)) return player.call('showNotification', ['Courier', 'Where is your van?']);

    const dist = -4.0;
    const rot = (veh.rotation.z * Math.PI) / 180;
    const trunkPos = new mp.Vector3(
        veh.position.x + (dist * Math.sin(-rot)),
        veh.position.y + (dist * Math.cos(-rot)),
        veh.position.z
    );

    updateUI(player, "Grab Package from Trunk", trunkPos);

    jobManager.createObjective(player, trunkPos, "Grab Package", 1.5, (p) => {
        if (p.vehicle) return p.call('showNotification', ['Courier', 'Get out of the vehicle!']);

        p.playAnimation('anim@heists@box_carry@', 'idle', 1.0, 49);
        p.setVariable('isJobCarrying', true);

        const box = mp.objects.new(mp.joaat('hei_prop_heist_box'), p.position, { dimension: p.dimension });
        p.courierBox = box; 
        
        setTimeout(() => {
            if (mp.players.exists(p) && mp.objects.exists(box)) {
                mp.players.call('client:attachProp', [box.id, p.id, 60309, 0.025, 0.08, 0.255, -145.0, 290.0, 0.0]);
            }
        }, 100);

        p.call('showNotification', ['Courier', 'Package retrieved. Deliver to the door.']);
        startDoorPhase(p);
    }, { 
        blipSprite: 478, 
        blipColor: 26,
        markerColor: [0, 188, 255, 100]
    });
}

function startDoorPhase(player) {
    const doorPos = player.courierData.currentStop.door;
    updateUI(player, "Deliver to Door", doorPos);

    // --- NEW: SPAWN CUSTOMER NPC ---
    jobManager.createJobPed(player, "a_f_y_hipster_01", doorPos, 0, {
        dict: "amb@world_human_stand_impatient@male@no_sign@idle_a",
        name: "idle_a"
    });

    jobManager.createObjective(player, doorPos, "Drop Off", 1.2, async (p) => {
        if (p.isProcessingPayout) return; 
        
        const dist = p.dist(new mp.Vector3(doorPos.x, doorPos.y, doorPos.z));
        if (dist > 3.0) return;

        if (p.vehicle || !p.getVariable('isJobCarrying')) return;

        p.isProcessingPayout = true; 
        jobManager.clearObjective(p);
        
        // --- NEW: REMOVE NPC AFTER DELIVERY ---
        jobManager.clearJobPeds(p);
        
        // 1. Clear State
        p.setVariable('isJobCarrying', null);
        p.stopAnimation();

        if (p.courierBox && mp.objects.exists(p.courierBox)) {
            p.courierBox.destroy();
            p.courierBox = null;
        }

        p.courierData.packages--;

        // === 2. ECONOMY & XP CALCULATION (RANDOMIZED) ===
        const level = jobManager.getJobLevel(p, JOB_KEY);
        
        // Random Base Pay ($25 - $35)
        const randomBasePay = Math.floor(Math.random() * (REWARD_CONFIG.basePayMax - REWARD_CONFIG.basePayMin + 1)) + REWARD_CONFIG.basePayMin;
        let pay = randomBasePay + (level * REWARD_CONFIG.perLevel);
        
        // Random Base XP (5 - 10)
        const randomBaseXp = Math.floor(Math.random() * (REWARD_CONFIG.baseXpMax - REWARD_CONFIG.baseXpMin + 1)) + REWARD_CONFIG.baseXpMin;
        const xp = randomBaseXp + Math.floor(level * 0.2);

        // TIP SYSTEM
        const tipChance = Math.min(REWARD_CONFIG.tipChanceCap, REWARD_CONFIG.tipChanceBase + (level * 2)); 
        if (Math.random() * 100 < tipChance) {
            const tip = Math.floor(Math.random() * 50) + 10;
            pay += tip;
            p.call('showNotification', ['Courier', `Customer tipped you +$${tip}!`]);
        }

        // Apply Rewards
        p.courierData.totalSessionEarnings += pay; // Track for bonus
        await playerManager.addMoneyAndSave(p, pay, "Courier Delivery");
        await jobManager.addJobXp(p, JOB_KEY, xp);
        
        p.call('client:showJobSubtitle', [`+$${pay} | +${xp} XP`]);

        p.isProcessingPayout = false; 

        if (p.courierData.packages > 0) {
            startDeliveryPhase(p);
        } else {
            updateUI(p, "Return to Depot", 0); 
            p.outputChatBox("!{F0C400}[Courier] !{FFFFFF}Run complete! Return to Loading Bay.");
            
            jobManager.createObjective(p, DEPOT_CONFIG.loadingBay, "Loading Bay", 4.0, (pReturn) => {
                finishJobRun(pReturn);
            }, { 
                blipColor: 26,
                markerColor: [0, 188, 255, 100] 
            });
        }
    }, { 
        blipSprite: 40, 
        blipColor: 26,
        markerColor: [0, 188, 255, 100]
    });
}

function finishJobRun(player) {
    // 15% Bonus of total session
    const bonus = Math.floor(player.courierData.totalSessionEarnings * REWARD_CONFIG.bonusPercentage);
    
    player.call('showNotification', ['Courier', `Shift Complete! Depot Bonus: $${bonus}`]);
    
    if (bonus > 0) {
        playerManager.addMoneyAndSave(player, bonus, "Courier Depot Bonus");
    }

    updateUI(player, "Return to Depot", DEPOT_CONFIG.loadingBay);
    // Loop directly back to loading
    startLoadingPhase(player);
}

mp.events.add('playerExitVehicle', (player, vehicle) => {
    // Check if the player is currently working as a courier
    if (!player.courierData || !player.jobVehicle) return;

    // If the vehicle they left is their job van
    if (player.jobVehicle === vehicle) {
        // Clear any existing timer to be safe
        if (player.abandonTimer) clearTimeout(player.abandonTimer);

        // Start 10-minute (600,000ms) abandonment timer
        player.abandonTimer = setTimeout(() => {
            if (mp.players.exists(player) && player.courierData) {
                player.call('showNotification', ["Job Failed", "You abandoned the GoPostal van."]);
                jobManager.stopJob(player, "Vehicle Abandoned"); 
            }
        }, 600000); 
    }
});

mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
    // Stop the abandonment timer if they get back in their van
    if (player.jobVehicle && player.jobVehicle === vehicle && player.abandonTimer) {
        clearTimeout(player.abandonTimer);
        player.abandonTimer = null;
        player.call('showNotification', ['Courier', 'Vehicle recovered.']);
    }

    // Existing check for carrying boxes
    if (player.getVariable('isJobCarrying')) {
        player.stopAnimation();
        player.call('showNotification', ['Courier', 'You cannot drive while holding a box!']);
    }
});

jobManager.register('courier', JOB_CONFIG, logic);