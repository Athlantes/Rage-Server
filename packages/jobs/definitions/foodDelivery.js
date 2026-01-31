const jobManager = require('../jobManager');
const playerManager = require('../../core/playerManager');
const HOUSES = require('../../data/houses');
const ZoneManager = require('../../zones/index.js');

const JOB_KEY = 'quickeats';
const REQUIRED_ZONE = 'los_santos_city';

const RESTAURANTS = [
    { name: "Burger Shot", x: -1192.93, y: -892.44, z: 13.99 },
    { name: "Up-n-Atom", x: 86.63, y: 279.79, z: 110.20 },
    { name: "Taco Bomb", x: 13.98, y: -1601.78, z: 29.37 },
    { name: "Lucky Plucker", x: -902.94, y: -155.19, z: 41.87 }
];

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
        jobManager.clearObjective(player);
        player.call('client:phone:quickEats:update', [false, "Offline", null]);
    }
};

jobManager.register(JOB_KEY, {
    name: "QuickEats Driver"
}, logic);


// --- CHECKS ---

function canReceiveOrder(player) {
    const inZone = ZoneManager.isPlayerInZone(player, REQUIRED_ZONE);
    
    if (!inZone) {
        console.log(`[QuickEats] ${player.name} failed zone check. ActiveZones:`, player.activeZones ? Array.from(player.activeZones) : "None");
        
        player.call('showNotification', ['QuickEats', 'No service area here. Go to Los Santos.']);
        player.call('client:phone:quickEats:update', [false, "Area Unavailable", "Move to City"]);
        return false;
    }

    // 2. Personal Vehicle Check
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

    // --- NEW VALIDATION CHECK ---
    if (!canReceiveOrder(player)) {
        // If checks fail, try again in 5 seconds (Pooling)
        setTimeout(() => {
            if (mp.players.exists(player)) assignOrder(player);
        }, 5000);
        return;
    }

    // Checks Passed: Proceed with Assignment
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

    player.quickEatsState = 'delivery';
    const order = player.quickEatsOrder;
    const dest = order.house.door;

    player.call('showNotification', ['QuickEats', 'Order picked up. Delivering...']);
    player.call('client:phone:quickEats:update', [true, "Delivering", "Residential Area"]);

    const dist = player.dist(new mp.Vector3(dest.x, dest.y, dest.z));
    const distanceBonus = Math.floor((dist / 1000) * REWARDS.perKm);
    order.pay = REWARDS.basePay + distanceBonus;

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
        // Initial Check for Toggle
        if (!player.activeZones || !player.activeZones.has(REQUIRED_ZONE)) {
            player.call('showNotification', ['QuickEats', 'Service not available in this area.']);
            
            // --- FIX START ---
            // Force the UI back to "Offline" state so the button unlocks
            return player.call('client:phone:quickEats:update', [false, "Offline", null]);
            // --- FIX END ---
        }

        jobManager.startJobSession(player, JOB_KEY);
        player.setVariable('quickEatsActive', true);
        player.call('client:phone:quickEats:update', [true, "Searching...", null]);
        
        setTimeout(() => assignOrder(player), 2000);
    }
});