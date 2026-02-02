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

const logic = {
    onStop: (player) => {
        player.quickEatsState = null;
        player.quickEatsOrder = null;
        player.setVariable('quickEatsActive', false);

        if (player.pedStreamer) { clearInterval(player.pedStreamer); player.pedStreamer = null; }
        jobManager.clearJobPeds(player);
        
        jobManager.clearObjective(player); 
        player.call('client:phone:quickEats:update', [false, "Offline", null]);
    }
};

jobManager.register(JOB_KEY, {
    name: "QuickEats Driver"
}, logic);


// --- CHECKS ---

function getFacingAngle(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    let theta = Math.atan2(dx, dy); 
    return -(theta * 180.0 / Math.PI);
}

function canReceiveOrder(player) {
    if (!ZoneManager.isPlayerInZone(player, REQUIRED_ZONE)) {
        player.call('showNotification', ['QuickEats', 'You left the service area. Return to the city.']);
        player.call('client:phone:quickEats:update', [false, "Area Unavailable", "Return to City"]);
        return false;
    }

    const veh = player.vehicle;
    if (!veh) {
        player.call('client:phone:quickEats:update', [true, "Waiting for Vehicle", "Get in your car"]);
        return false; 
    }

    if (!veh.ownerId || veh.ownerId !== player.data.dbId) {
        player.call('showNotification', ['QuickEats', 'Vehicle not registered to you!']);
        player.call('client:phone:quickEats:update', [true, "Vehicle Error", "Use Personal Vehicle"]);
        return false;
    }

    return true;
}

// --- CORE FUNCTIONS ---

function assignOrder(player) {
    if (!player.activeJobId || player.activeJobId !== JOB_KEY) return;

    if (!canReceiveOrder(player)) {
        setTimeout(() => {
            if (mp.players.exists(player)) assignOrder(player);
        }, 5000);
        return;
    }

    const restaurant = RESTAURANTS[Math.floor(Math.random() * RESTAURANTS.length)];
    const house = HOUSES[Math.floor(Math.random() * HOUSES.length)];

    player.quickEatsOrder = {
        restaurant: restaurant,
        house: house,
        pay: 0
    };

    player.quickEatsState = 'pickup';

    player.call('client:phone:quickEats:update', [true, "Pickup", restaurant.name]);
    player.call('showNotification', ['QuickEats', `New order from ${restaurant.name}!`]);

    const chefPos = { x: restaurant.x, y: restaurant.y, z: restaurant.z }; 
    
    // CHANGED: Switched to a "Checking List" animation (Standing).
    // This fixes the "leaning in air" issue and looks okay regardless of rotation.
    jobManager.createJobPed(player, "S_M_Y_Chef_01", chefPos, 0, {
        dict: "amb@world_human_clipboard@male@idle_a",
        name: "idle_a"
    });

    jobManager.createObjective(player, restaurant, `Pickup: ${restaurant.name}`, 3.0, (p) => {
        handlePickup(p);
    }, {
        blipSprite: 501, 
        blipColor: 2, 
        markerColor: [0, 255, 100, 150]
    });
}

function handlePickup(player) {
    if (!player.quickEatsOrder) return;

    // Remove the Chef
    jobManager.clearJobPeds(player);

    player.quickEatsState = 'delivery';
    const order = player.quickEatsOrder;
    const dest = order.house.door;
    const street = order.house.street; 

    player.call('showNotification', ['QuickEats', 'Order picked up. Delivering...']);
    player.call('client:phone:quickEats:update', [true, "Delivering", "Residential Area"]);

    const dist = player.dist(new mp.Vector3(dest.x, dest.y, dest.z));
    const distanceBonus = Math.floor((dist / 1000) * REWARDS.perKm);
    order.pay = REWARDS.basePay + distanceBonus;

    const properHeading = getFacingAngle(dest, street);
    
    if (player.pedStreamer) clearInterval(player.pedStreamer);

    // CHANGED: Increased spawn range from 35.0 to 150.0 so they appear while driving up
    player.pedStreamer = setInterval(() => {
        if (!mp.players.exists(player)) return;

        const currentDist = player.dist(new mp.Vector3(dest.x, dest.y, dest.z));

        if (currentDist < 150.0 && !player.hasJobPed) {
            player.hasJobPed = true;
            jobManager.createJobPed(player, "a_f_y_hipster_01", dest, properHeading, {
                dict: "amb@world_human_stand_impatient@male@no_sign@idle_a",
                name: "idle_a"
            });
        }
        else if (currentDist > 160.0 && player.hasJobPed) {
            player.hasJobPed = false;
            jobManager.clearJobPeds(player);
        }
    }, 1000);

    jobManager.createObjective(player, dest, "Customer Drop-off", 1.5, (p) => {
        handleFinish(p);
    }, {
        blipSprite: 280, 
        blipColor: 2,
        markerColor: [0, 255, 100, 150]
    });
}

async function handleFinish(player) {
    if (!player.quickEatsOrder) return;
    
    // CHANGED: Logic to make Ped wander away instead of deleting instantly
    if (player.pedStreamer) { clearInterval(player.pedStreamer); player.pedStreamer = null; }
    player.hasJobPed = false;

    // Get the current ped(s) before clearing the array reference
    const pedsToDismiss = player.jobPeds ? [...player.jobPeds] : [];
    player.jobPeds = []; // Clear reference for the next job logic

    pedsToDismiss.forEach(ped => {
        if(mp.peds.exists(ped)) {
            ped.frozen = false; // Unfreeze
            ped.taskWanderStandard(10.0, 10); // Wander
            // Delete after 10 seconds
            setTimeout(() => { if(mp.peds.exists(ped)) ped.destroy(); }, 10000);
        }
    });

    const pay = player.quickEatsOrder.pay;
    const orderName = player.quickEatsOrder.restaurant.name;

    await playerManager.addMoneyAndSave(player, pay, `QuickEats: ${orderName}`);
    await jobManager.addJobXp(player, JOB_KEY, REWARDS.xp);

    player.call('showNotification', ['QuickEats', `Delivery complete! Earned $${pay}.`]);
    player.call('playSound', ['HUD_AWARDS', 'CHALLENGE_UNLOCKED']);

    player.quickEatsOrder = null;
    player.quickEatsState = 'idle';
    player.call('client:phone:quickEats:update', [true, "Searching...", null]);
    jobManager.clearObjective(player);

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
            return player.call('client:phone:quickEats:update', [false, "Offline", null]);
        }

        jobManager.startJobSession(player, JOB_KEY);
        player.setVariable('quickEatsActive', true);
        player.call('client:phone:quickEats:update', [true, "Searching...", null]);
        
        setTimeout(() => assignOrder(player), 2000);
    }
});