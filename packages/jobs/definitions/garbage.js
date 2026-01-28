const jobManager = require('../jobManager');
const playerManager = require('../../core/playerManager');

// --- CONFIGURATION ---

const BINS = [
    { x: -317.98, y: -1511.58, z: 27.74 },
    { x: -319.19, y: -1511.62, z: 27.74 },
    { x: -320.23, y: -1511.67, z: 27.74 },
    { x: -321.41, y: -1511.68, z: 27.73 }
];

const MAX_TRASH_CAPACITY = 4; // Truck must be emptied after 4 bags

const DEPOT_CONFIG = {
    spawns: [
        { x: -324.43, y: -1529.01, z: 27.26, h: -0.86 },
        { x: -327.43, y: -1528.77, z: 27.25, h: -1.48 },
        { x: -330.59, y: -1529.15, z: 27.25, h: 0.46 },
        { x: -333.79, y: -1528.63, z: 27.27, h: -0.53 }
    ],
    dumpZone: { x: -347.63, y: -1561.57, z: 24.95, h: -88.40 }
};

const JOB_CONFIG = {
    name: "Sanitation Worker",
    pedModel: "s_m_y_garbage", 
    blipSprite: 318, 
    blipColor: 2,   
    pos: { x: -321.41, y: -1545.74, z: 31.02, h: -2.09 } 
};

// --- HELPER: UPDATE HUD (Added this to match Courier) ---
function updateUI(player, text, count = 0) {
    if(mp.players.exists(player)) {
        // [true/false, Label Text, CurrentCount, MaxCount]
        player.call('updateJobUI', [true, text, count, MAX_TRASH_CAPACITY]);
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
        player.garbageData = { 
            collected: 0,
            currentBin: null
        };

        const spawn = DEPOT_CONFIG.spawns[Math.floor(Math.random() * DEPOT_CONFIG.spawns.length)];
        const veh = mp.vehicles.new(mp.joaat('trash'), new mp.Vector3(spawn.x, spawn.y, spawn.z), {
            heading: spawn.h,
            numberPlate: "TRASH " + player.id,
            locked: false,
            engine: false
        });
        veh.setVariable('fuel', 100.0);
        veh.jobOwner = player.id;
        player.jobVehicle = veh;

        setTimeout(() => {
            if (mp.players.exists(player) && mp.vehicles.exists(veh)) {
                player.call('client:warpIntoVehicle', [veh.id, -1]);
            }
        }, 250);

        player.call('showNotification', ['Sanitation', 'Route loaded. Drive to the first pickup.']);
        
        // UI UPDATE
        updateUI(player, "Drive to Pickup", 0);
        
        nextPickup(player);
    },

    onStop: (player) => {
        if (player.jobVehicle && mp.vehicles.exists(player.jobVehicle)) player.jobVehicle.destroy();
        if (player.garbageBag && mp.objects.exists(player.garbageBag)) player.garbageBag.destroy();
        
        player.setVariable('isJobCarrying', null);
        player.stopAnimation();
        
        player.jobVehicle = null;
        player.garbageBag = null;
        player.garbageData = null;
        
        // UI HIDE
        hideUI(player);
    }
};

function nextPickup(player) {
    const randomBin = BINS[Math.floor(Math.random() * BINS.length)];
    player.garbageData.currentBin = randomBin;

    updateUI(player, "Drive to Pickup", player.garbageData.collected);

    jobManager.createObjective(player, randomBin, "Trash Pickup", 10.0, (p) => {
        p.call('showNotification', ['Sanitation', 'You arrived! Hop out and grab the trash.']);
        updateUI(p, "Grab Trash Bag", p.garbageData.collected);
        
        jobManager.createObjective(p, randomBin, "Grab Bag", 1.5, (pGrab) => {
            startCarryingBag(pGrab);
        }, { blipSprite: 1, markerColor: [0, 255, 0, 100] });

    }, { blipSprite: 318, blipColor: 2 });
}

function startCarryingBag(player) {
    if (player.vehicle) return player.call('showNotification', ['Sanitation', 'Get out of the truck!']);

    // 1. Play Pickup Animation (Flag 0 = Play Once)
    player.playAnimation('missfbi4prepp1', '_bag_pickup_garbage_man', 1, 0);
    
    setTimeout(() => {
        if(!mp.players.exists(player)) return;

        // 2. Switch to Carrying Animation (Flag 49 = Loop + Allow Movement)
        player.playAnimation('missfbi4prepp1', '_bag_walk_garbage_man', 1, 49);
        
        player.setVariable('isJobCarrying', true);
        
        // 3. Create Bag
        const bag = mp.objects.new(mp.joaat('prop_cs_rub_binbag_01'), player.position, { dimension: player.dimension });
        player.garbageBag = bag;

        setTimeout(() => {
            if(mp.players.exists(player) && mp.objects.exists(bag)) {
                player.call('client:attachProp', [bag.id, 57005, 0.4, 0.0, -0.05, 0, 0, 60]);
            }
        }, 50);

        player.call('showNotification', ['Sanitation', 'Throw it in the back of the truck!']);
        updateUI(player, "Throw in Truck", player.garbageData.collected);
        
        startThrowPhase(player);
    }, 1200); 
}
function startThrowPhase(player) {
    const veh = player.jobVehicle;
    if (!veh || !mp.vehicles.exists(veh)) return player.call('showNotification', ['Sanitation', 'Your truck is gone!']);

    const dist = -4.5;
    const rot = (veh.rotation.z * Math.PI) / 180;
    const rearPos = new mp.Vector3(
        veh.position.x + (dist * Math.sin(-rot)),
        veh.position.y + (dist * Math.cos(-rot)),
        veh.position.z
    );

    jobManager.createObjective(player, rearPos, "Throw Bag", 2.0, async (p) => {
        if (!p.getVariable('isJobCarrying')) return;

        p.setVariable('isJobCarrying', null);
        
        // 1. Stop Carrying Animation
        p.stopAnimation();
        // 2. Play Throw Animation
        p.playAnimation('mp_common', 'givetake2_a', 1, 0); 
        
        if (p.garbageBag && mp.objects.exists(p.garbageBag)) {
            p.garbageBag.destroy();
            p.garbageBag = null;
        }

        // 3. FIX: Force Stop Animation after 1.5 seconds so you don't freeze
        setTimeout(() => {
            if (mp.players.exists(p)) {
                p.stopAnimation(); 
            }
        }, 1500);

        p.garbageData.collected++;
        jobManager.clearObjective(p);

        await playerManager.addMoneyAndSave(p, 50, "Trash Collected");
        p.call('showNotification', ['Sanitation', `Trash collected! (${p.garbageData.collected}/${MAX_TRASH_CAPACITY})`]);

        if (p.garbageData.collected >= MAX_TRASH_CAPACITY) {
            startDumpPhase(p);
        } else {
            nextPickup(p);
        }

    }, { blipSprite: 318, markerColor: [255, 0, 0, 100] });
}

function startDumpPhase(player) {
    player.call('showNotification', ['Sanitation', 'Truck full! Return to depot to empty it.']);
    updateUI(player, "Return to Depot", MAX_TRASH_CAPACITY);
    
    jobManager.createObjective(player, DEPOT_CONFIG.dumpZone, "Disposal Zone", 5.0, (p) => {
        p.call('showNotification', ['Sanitation', 'Truck emptied! +$500 Bonus']);
        playerManager.addMoneyAndSave(p, 500, "Trash Bonus");
        
        p.garbageData.collected = 0;
        nextPickup(p); 
    }, { blipColor: 1, markerColor: [255, 0, 0, 100] });
}

jobManager.register('garbage', JOB_CONFIG, logic);