// packages/jobs/definitions/foodDelivery.js
const jobManager = require('../jobManager');
const playerManager = require('../../core/playerManager');
const HOUSES = require('../../data/houses');
const RESTAURANTS = require('../../data/restaurants');

const ZoneManager = require('../../zones'); 

const JOB_KEY = 'quickeats';
const REQUIRED_ZONE = 'ls_zone'; 

const REWARDS = {
    basePay: 40,
    perKm: 15,
    xp: 10
};

// --- NPC MODEL POOLS ---
const CHEF_MODELS = [
    "S_M_Y_Chef_01"
];

const CUSTOMER_MODELS = [
    "a_f_y_hipster_01", "a_f_y_business_01", "a_m_y_hipster_01",
    "a_f_y_fitness_01", "a_m_y_business_02", "a_f_y_tourist_01",
    "a_m_m_farmer_01", "a_m_y_skater_01"
];

// --- HELPERS ---

function getFacingAngle(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    let theta = Math.atan2(dx, dy); 
    return -(theta * 180.0 / Math.PI);
}

function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/** Dismiss peds with a delayed destroy (server peds don't support task methods) */
function dismissPeds(player) {
    const peds = player.jobPeds ? [...player.jobPeds] : [];
    player.jobPeds = [];

    peds.forEach(ped => {
        if (mp.peds.exists(ped)) {
            // Server-side peds don't have task methods, just delay the destroy
            // so the ped doesn't vanish in the player's face
            setTimeout(() => { if (mp.peds.exists(ped)) ped.destroy(); }, 3000);
        }
    });
}

/** Attach the food bag prop to the player's hand */
function attachFoodBag(player) {
    if (player.foodBagProp && mp.objects.exists(player.foodBagProp)) return; // already holding

    const bag = mp.objects.new(mp.joaat('prop_paper_bag_01'), player.position, {
        dimension: player.dimension
    });
    player.foodBagProp = bag;

    setTimeout(() => {
        if (mp.players.exists(player) && mp.objects.exists(bag)) {
            // Attach to right hand (bone 57005), offset so it sits in the palm
            mp.players.call('client:attachProp', [bag.id, player.id, 57005, 0.12, 0.08, 0.0, -90.0, 0.0, 0.0]);
        }
    }, 100);
}

/** Temporarily hide the food bag (when entering vehicle) */
function hideFoodBag(player) {
    if (player.foodBagProp && mp.objects.exists(player.foodBagProp)) {
        player.foodBagProp.destroy();
    }
    player.foodBagProp = null;
}

/** Re-show the food bag (when exiting vehicle during delivery) */
function reshowFoodBag(player) {
    if (player.quickEatsState !== 'delivery') return;
    if (player.foodBagProp && mp.objects.exists(player.foodBagProp)) return;
    attachFoodBag(player);
}

/** Remove the food bag prop permanently */
function removeFoodBag(player) {
    hideFoodBag(player);
    player.setVariable('isJobCarrying', null);
    player.stopAnimation();
}

/** Update both the phone UI and the overlay job HUD */
function updateUI(player, phoneStatus, phoneLoc, overlayText, targetPos) {
    if (!mp.players.exists(player)) return;

    // Phone app
    player.call('client:phone:quickEats:update', [true, phoneStatus, phoneLoc || null]);

    // Overlay job HUD
    const earned = (player.quickEatsData && player.quickEatsData.sessionEarnings) || 0;
    const completed = (player.quickEatsData && player.quickEatsData.deliveries) || 0;
    let x = null, y = null, z = null;
    if (targetPos) { x = targetPos.x; y = targetPos.y; z = targetPos.z; }
    player.call('updateJobUI', [true, overlayText, completed, completed, earned, x, y, z]);
}

function hideUI(player) {
    if (!mp.players.exists(player)) return;
    player.call('client:phone:quickEats:update', [false, "Offline", null]);
    player.call('updateJobUI', [false, "", 0, 0, 0, null, null, null]);
}

// --- JOB LIFECYCLE ---

const logic = {
    onStop: (player) => {
        // Cleanup everything
        if (player.pedStreamer) { clearInterval(player.pedStreamer); player.pedStreamer = null; }
        player.hasJobPed = false;

        dismissPeds(player);
        removeFoodBag(player);
        jobManager.clearObjective(player);

        player.quickEatsState = null;
        player.quickEatsOrder = null;
        player.quickEatsData = null;
        player.setVariable('quickEatsActive', false);

        hideUI(player);
    }
};

jobManager.register(JOB_KEY, {
    name: "QuickEats Driver"
}, logic);


// --- CHECKS ---

function canReceiveOrder(player) {
    if (!ZoneManager.isPlayerInZone(player, REQUIRED_ZONE)) {
        player.call('showNotification', ['QuickEats', 'You left the service area. Return to the city.']);
        updateUI(player, "Area Unavailable", "Return to City", "Return to service area", null);
        return false;
    }

    const veh = player.vehicle;
    if (!veh) {
        updateUI(player, "Waiting for Vehicle", "Get in your car", "Get in your vehicle", null);
        return false; 
    }

    if (!veh.ownerId || veh.ownerId !== player.data.dbId) {
        player.call('showNotification', ['QuickEats', 'Vehicle not registered to you!']);
        updateUI(player, "Vehicle Error", "Use Personal Vehicle", "Use your personal vehicle", null);
        return false;
    }

    return true;
}

// --- CORE FUNCTIONS ---

function assignOrder(player) {
    if (!player.activeJobId || player.activeJobId !== JOB_KEY) return;

    if (!canReceiveOrder(player)) {
        setTimeout(() => {
            if (mp.players.exists(player) && player.activeJobId === JOB_KEY) assignOrder(player);
        }, 5000);
        return;
    }

    const restaurant = randomFrom(RESTAURANTS);
    const house = randomFrom(HOUSES);

    player.quickEatsOrder = {
        restaurant: restaurant,
        house: house,
        pay: 0
    };

    player.quickEatsState = 'pickup';

    const chefPos = { x: restaurant.x, y: restaurant.y, z: restaurant.z }; 
    
    updateUI(player, "Pickup", restaurant.name, `Pick up order at ${restaurant.name}`, chefPos);
    player.call('showNotification', ['QuickEats', `New order from ${restaurant.name}!`]);

    // Spawn chef NPC at the restaurant
    jobManager.createJobPed(player, randomFrom(CHEF_MODELS), chefPos, 0, {
        dict: "amb@world_human_clipboard@male@idle_a",
        name: "idle_a"
    });

    jobManager.createObjective(player, restaurant, `Pickup: ${restaurant.name}`, 4.0, (p) => {
        handlePickup(p);
    }, {
        blipSprite: 501, 
        blipColor: 2, 
        markerColor: [0, 255, 100, 150]
    });
}

function handlePickup(player) {
    if (!player.quickEatsOrder) return;

    // --- VEHICLE CHECK: Must be on foot to pick up ---
    if (player.vehicle) {
        player.call('showNotification', ['QuickEats', 'Exit your vehicle to pick up the order!']);
        return;
    }

    // Dismiss the chef (walks away instead of vanishing)
    dismissPeds(player);

    // Attach food bag to player's hand
    attachFoodBag(player);

    player.quickEatsState = 'delivery';
    const order = player.quickEatsOrder;
    const dest = order.house.door;
    const street = order.house.street; 

    // Calculate pay based on distance
    const dist = player.dist(new mp.Vector3(dest.x, dest.y, dest.z));
    const distanceBonus = Math.floor((dist / 1000) * REWARDS.perKm);
    order.pay = REWARDS.basePay + distanceBonus;

    player.call('showNotification', ['QuickEats', 'Order picked up! Deliver to the customer.']);
    updateUI(player, "Delivering", "Customer", "Deliver to customer", dest);

    // --- Spawn customer NPC when player gets close ---
    const properHeading = getFacingAngle(dest, street);
    
    if (player.pedStreamer) clearInterval(player.pedStreamer);
    player.hasJobPed = false;

    player.pedStreamer = setInterval(() => {
        if (!mp.players.exists(player)) return;

        const currentDist = player.dist(new mp.Vector3(dest.x, dest.y, dest.z));

        if (currentDist < 150.0 && !player.hasJobPed) {
            player.hasJobPed = true;
            jobManager.createJobPed(player, randomFrom(CUSTOMER_MODELS), dest, properHeading, {
                dict: "amb@world_human_stand_impatient@male@no_sign@idle_a",
                name: "idle_a"
            });
        }
        else if (currentDist > 160.0 && player.hasJobPed) {
            player.hasJobPed = false;
            jobManager.clearJobPeds(player);
        }
    }, 1000);

    jobManager.createObjective(player, dest, "Customer Drop-off", 2.0, (p) => {
        handleFinish(p);
    }, {
        blipSprite: 280, 
        blipColor: 2,
        markerColor: [0, 255, 100, 150]
    });
}

async function handleFinish(player) {
    if (!player.quickEatsOrder) return;

    // --- VEHICLE CHECK: Must be on foot to deliver ---
    if (player.vehicle) {
        player.call('showNotification', ['QuickEats', 'Exit your vehicle to deliver the order!']);
        return;
    }

    // Prevent double-triggering
    if (player.isProcessingQEPayout) return;
    player.isProcessingQEPayout = true;

    // Stop NPC streamer
    if (player.pedStreamer) { clearInterval(player.pedStreamer); player.pedStreamer = null; }
    player.hasJobPed = false;

    // Dismiss customer NPC (walks away naturally)
    dismissPeds(player);

    // Remove food bag from hand
    removeFoodBag(player);

    // Clear objective
    jobManager.clearObjective(player);

    // Calculate and pay
    const pay = player.quickEatsOrder.pay;
    const orderName = player.quickEatsOrder.restaurant.name;

    if (!player.quickEatsData) player.quickEatsData = { deliveries: 0, sessionEarnings: 0 };
    player.quickEatsData.deliveries++;
    player.quickEatsData.sessionEarnings += pay;

    await playerManager.addMoneyAndSave(player, pay, `QuickEats: ${orderName}`);
    await jobManager.addJobXp(player, JOB_KEY, REWARDS.xp);

    player.call('showNotification', ['QuickEats', `Delivery complete! Earned $${pay}.`]);
    player.call('client:showJobSubtitle', [`+$${pay} | +${REWARDS.xp} XP`]);
    player.call('playSound', ['HUD_AWARDS', 'CHALLENGE_UNLOCKED']);

    player.quickEatsOrder = null;
    player.quickEatsState = 'idle';
    player.isProcessingQEPayout = false;

    updateUI(player, "Searching...", null, "Waiting for next order...", null);

    setTimeout(() => {
        if (mp.players.exists(player) && player.activeJobId === JOB_KEY) {
            assignOrder(player);
        }
    }, 5000);
}

// --- EVENTS ---

mp.events.add('server:phone:quickEats:toggle', (player) => {
    if (player.activeJobId && player.activeJobId !== JOB_KEY) {
        return player.call('showNotification', ['QuickEats', 'You are already working another job!']);
    }

    if (player.activeJobId === JOB_KEY) {
        jobManager.stopJob(player, "QuickEats: You went offline.");
    } else {
        if (!ZoneManager.isPlayerInZone(player, REQUIRED_ZONE)) {
            player.call('showNotification', ['QuickEats', 'Service not available in this area.']);
            return hideUI(player);
        }

        jobManager.startJobSession(player, JOB_KEY);
        player.setVariable('quickEatsActive', true);
        player.quickEatsData = { deliveries: 0, sessionEarnings: 0 };

        updateUI(player, "Searching...", null, "Waiting for orders...", null);
        
        setTimeout(() => assignOrder(player), 2000);
    }
});

// --- VEHICLE EVENTS: Hide bag when entering vehicle, re-show when exiting ---
mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
    if (player.activeJobId === JOB_KEY && player.quickEatsState === 'delivery') {
        hideFoodBag(player);
        // Note: don't call stopAnimation() here — it interrupts the enter-vehicle
        // task and ejects the player. The animation clears naturally when seated.
    }
});

mp.events.add('playerExitVehicle', (player, vehicle) => {
    if (player.activeJobId === JOB_KEY && player.quickEatsState === 'delivery') {
        setTimeout(() => {
            if (mp.players.exists(player) && !player.vehicle) {
                reshowFoodBag(player);
            }
        }, 500);
    }
});