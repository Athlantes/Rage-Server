const jobManager = require('../jobManager');
const playerManager = require('../../core/playerManager');
const HOUSES = require('../../data/houses');

const MAX_PACKAGES = 2; 

const DEPOT_CONFIG = {
    spawn: { x: 72.30, y: 119.94, z: 79.18, h: 156.31 },
    loadingBay: { x: 115.13, y: 99.98, z: 80.87, h: 170.20 }
};

const JOB_CONFIG = {
    name: "GoPostal Courier",
    pedModel: "s_m_m_postal_01", 
    blipSprite: 616, 
    blipColor: 26,
    pos: { x: 78.58, y: 111.71, z: 81.17, h: -114.18 }
};

// --- HELPER: UPDATE HUD ---
function updateUI(player, text, packages = 0) {
    if(mp.players.exists(player)) {
        player.call('updateJobUI', [true, text, packages, MAX_PACKAGES]);
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
        player.courierData = { 
        packages: 0, 
        currentStop: null, 
        visitedHouses: []
    };

        const veh = mp.vehicles.new(mp.joaat('boxville2'), new mp.Vector3(DEPOT_CONFIG.spawn.x, DEPOT_CONFIG.spawn.y, DEPOT_CONFIG.spawn.z), {
            heading: DEPOT_CONFIG.spawn.h,
            numberPlate: "POST " + player.id,
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

        player.outputChatBox("!{F0C400}[Courier] !{FFFFFF}Vehicle spawned. Drive to the Loading Bay.");
        updateUI(player, "Drive to Loading Bay", 0);
        startLoadingPhase(player);
    },

    onStop: (player) => {
        if (player.jobVehicle && mp.vehicles.exists(player.jobVehicle)) player.jobVehicle.destroy();
        if (player.courierBox && mp.objects.exists(player.courierBox)) player.courierBox.destroy();
        if (player.jobExitCheck) { clearInterval(player.jobExitCheck); player.jobExitCheck = null; }
        
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
        
        updateUI(p, "Loading packages...", 0);
        p.call('showNotification', ['Courier', 'Loading packages... (Engine Off)']);
        jobManager.clearObjective(p); 

        setTimeout(() => {
            if (!mp.players.exists(p)) return;
            if (p.vehicle) p.vehicle.frozen = false; 

            p.courierData.packages = MAX_PACKAGES; 
            p.courierData.visitedHouses = []; // Reset history for fresh route selection
            
            p.outputChatBox("!{00FF00}[Courier] !{FFFFFF}Van Loaded! Route sent to GPS.");
            startDeliveryPhase(p);
        }, 4000);
    }, { 
        blipColor: 26, 
        markerColor: [0, 188, 255, 100]
    });
}

function startDeliveryPhase(player) {
    // 1. Get all houses not yet visited in this run
    let availableHouses = HOUSES.filter(h => !player.courierData.visitedHouses.includes(h.id));

    if (availableHouses.length === 0) {
        player.courierData.visitedHouses = [];
        return startDeliveryPhase(player);
    }

    // 2. RADIUS CHECK LOGIC
    const MAX_DISTANCE = 600.0; 
    const pPos = player.position;
    
    let nearbyHouses = availableHouses.filter(h => {
        const dist = Math.sqrt(
            Math.pow(h.street.x - pPos.x, 2) + 
            Math.pow(h.street.y - pPos.y, 2)
        );
        return dist <= MAX_DISTANCE;
    });

    const pool = nearbyHouses.length > 0 ? nearbyHouses : availableHouses;
    const randomIdx = Math.floor(Math.random() * pool.length);
    const stop = pool[randomIdx];
    
    player.courierData.currentStop = stop;
    player.courierData.visitedHouses.push(stop.id);

    updateUI(player, "Drive to Street", player.courierData.packages);

    jobManager.createObjective(player, stop.street, "Delivery Area", 8.0, (p) => {
        p.call('showNotification', ['Courier', 'You arrived! Park and exit the van to get the package.']);
        updateUI(p, "Exit Vehicle", p.courierData.packages);
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

    updateUI(player, "Grab Package from Trunk", player.courierData.packages);

    const dist = -4.0;
    const rot = (veh.rotation.z * Math.PI) / 180;
    const trunkPos = new mp.Vector3(
        veh.position.x + (dist * Math.sin(-rot)),
        veh.position.y + (dist * Math.cos(-rot)),
        veh.position.z
    );

    jobManager.createObjective(player, trunkPos, "Grab Package", 1.5, (p) => {
        if (p.vehicle) return p.call('showNotification', ['Courier', 'Get out of the vehicle!']);

        p.playAnimation('anim@heists@box_carry@', 'idle', 1, 49);
        p.setVariable('isJobCarrying', true); // Added this so other players see the anim/box logic

        const box = mp.objects.new(mp.joaat('hei_prop_heist_box'), p.position, { dimension: p.dimension });
        p.courierBox = box; 
        
        // This triggers the dataHandler on all clients
        p.setVariable('attachedObject', box.id); 

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
    updateUI(player, "Deliver to Door", player.courierData.packages);

    jobManager.createObjective(player, doorPos, "Drop Off", 1.2, async (p) => {
        // --- SECURITY: Server-Side Validations ---
        if (p.isProcessingPayout) return; // Prevent spam
        
        const dist = p.dist(new mp.Vector3(doorPos.x, doorPos.y, doorPos.z));
        if (dist > 3.0) return console.log(`[Security] ${p.name} triggered payout from too far away.`);

        if (p.vehicle || !p.getVariable('isJobCarrying')) return;

        p.isProcessingPayout = true; // Lock the transaction
        jobManager.clearObjective(p);
        
        p.setVariable('isJobCarrying', null);
        p.setVariable('attachedObject', null);
        p.stopAnimation();
        if (p.courierBox && mp.objects.exists(p.courierBox)) {
            p.courierBox.destroy();
            p.courierBox = null;
        }

        p.courierData.packages--;

        // --- ATOMIC PAYOUT ---
        await playerManager.addMoneyAndSave(p, 200, "Courier Delivery");
        p.call('showNotification', ['Courier', 'Delivered! +$200 (Saved)']);
        
        p.isProcessingPayout = false; 

        if (p.courierData.packages > 0) {
            startDeliveryPhase(p);
        } else {
            // FIX: Show 0/6 on the UI before transitioning
            updateUI(p, "Return to Depot", 0); 
            p.outputChatBox("!{F0C400}[Courier] !{FFFFFF}Run complete! Return to Loading Bay.");
            
            // Give the player a new objective to actually drive back
            jobManager.createObjective(p, DEPOT_CONFIG.loadingBay, "Loading Bay", 4.0, (pReturn) => {
                startLoadingPhase(pReturn);
            }, { 
                blipColor: 26,
                markerColor: [0, 188, 255, 100] // Added blue color
            });
        }
    }, { 
        blipSprite: 40, 
        blipColor: 26,
        markerColor: [0, 188, 255, 100]
    });
}

// Server-side safety
mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
    if (player.getVariable('isJobCarrying')) {
        player.stopAnimation();
        player.call('showNotification', ['Courier', 'You cannot drive while holding a box!']);
    }
});

jobManager.register('courier', JOB_CONFIG, logic);