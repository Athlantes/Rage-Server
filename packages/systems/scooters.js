// packages/systems/scooters.js
const fs = require('fs');
const path = require('path');

const SAVE_FILE = path.join(__dirname, '../data/scooter_locations.json');
const SCOOTER_MODEL = 'serv_electricscooter';
const RENT_COST_PER_MINUTE = 2; // $2 per minute

// In-memory storage
let scooters = [];
let spawnPoints = [];

// Load Spawn Points
const loadScooters = () => {
    if (fs.existsSync(SAVE_FILE)) {
        spawnPoints = JSON.parse(fs.readFileSync(SAVE_FILE));
        spawnPoints.forEach((point, index) => createScooterEntity(point, index));
        console.log(`[eScootr] Loaded ${spawnPoints.length} scooters.`);
    } else {
        console.log(`[eScootr] No config found. Use /addscooter to create spawn points.`);
    }
};

const createScooterEntity = (point, index) => {
    const veh = mp.vehicles.new(mp.joaat(SCOOTER_MODEL), new mp.Vector3(point.x, point.y, point.z), {
        heading: point.h,
        dimension: 0,
        locked: true,
        engine: false
    });

    veh.setVariable('isScooter', true);
    veh.setVariable('scooterId', index);
    veh.scooterIndex = index;
    veh.spawnPoint = point;
    veh.lastRenter = null; // Store ID of last person
    veh.rentEndTime = 0;
    veh.lastInteraction = Date.now(); // For idle reset
    
    // Default stats
    veh.setVariable('fuel', 100);
    
    scooters[index] = veh;
};

// --- EVENTS ---

mp.events.add('server:phone:requestScooters', (player) => {
    // Get closest 10 scooters
    const pPos = player.position;
    
    const nearby = scooters
        .filter(v => mp.vehicles.exists(v))
        .map(v => {
            const dist = v.dist(pPos);
            return {
                id: v.scooterIndex,
                dist: dist,
                fuel: v.getVariable('fuel'),
                rented: (v.rentEndTime > Date.now()),
                pos: {x: v.position.x, y: v.position.y}
            };
        })
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 10);

    player.call('client:phone:receiveScooters', [nearby]);
});

mp.events.add('server:phone:rentScooter', (player, scooterId, minutes) => {
    const veh = scooters[scooterId];
    if (!veh || !mp.vehicles.exists(veh)) return player.call('showNotification', ['eScootr', 'Error: Scooter not found.']);
    
    const cost = minutes * RENT_COST_PER_MINUTE;
    
    // Check Distance
    if (player.dist(veh.position) > 5) return player.call('showNotification', ['eScootr', 'You are too far away!']);

    // Check Money (Assuming player.data.money or adjust to your economy)
    if (player.data.money < cost) {
        return player.call('showNotification', ['eScootr', `You need $${cost} to rent this.`]);
    }

    // Process Payment
    player.data.money -= cost; // Adjust this line to your specific economy handler
    player.call('showNotification', ['eScootr', `Rented for ${minutes} min ($${cost}).`]);

    // Handle Logic
    const isSameRenter = (veh.lastRenter === player.data.dbId);
    
    veh.lastRenter = player.data.dbId;
    veh.rentEndTime = Date.now() + (minutes * 60000);
    veh.locked = false;
    veh.lastInteraction = Date.now(); // Reset idle timer

    // Fuel Logic: Reset if new renter, keep if same
    if (!isSameRenter) {
        veh.setVariable('fuel', 100);
    }

    // Refresh UI if player is looking at it
    player.call('client:phone:rentSuccess', [veh.rentEndTime]);
});

// Engine Toggle Interceptor
mp.events.add('vehicle:toggleEngine', (player) => {
    const veh = player.vehicle;
    if (!veh || !veh.getVariable('isScooter')) return; // Continue to normal handler if not scooter

    // It is a scooter, check rental
    if (veh.rentEndTime && veh.rentEndTime > Date.now()) {
        // Active Rental - Toggle Engine
        veh.engine = !veh.engine;
        player.call('showNotification', ['eScootr', veh.engine ? 'Engine Started' : 'Engine Stopped']);
    } else {
        // Not Rented or Expired
        veh.engine = false;
        player.call('showNotification', ['eScootr', 'Rental expired. Use the app to rent.']);
    }
});

// --- COMMANDS ---

mp.events.addCommand('addscooter', (player) => {
    if (!player.vehicle) return player.outputChatBox("Get in a vehicle/scooter to position it.");
    
    const pos = player.vehicle.position;
    const rot = player.vehicle.rotation;
    
    const newPoint = { x: pos.x, y: pos.y, z: pos.z, h: rot.z };
    spawnPoints.push(newPoint);
    
    createScooterEntity(newPoint, spawnPoints.length - 1);
    saveConfig();
    
    player.outputChatBox(`[eScootr] Added scooter #${spawnPoints.length - 1}`);
});

function saveConfig() {
    // Ensure dir exists
    const dir = path.dirname(SAVE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    fs.writeFileSync(SAVE_FILE, JSON.stringify(spawnPoints, null, 2));
}

// --- TIMERS ---

// 1. Check Rentals & Idle Reset (Every 10 seconds)
setInterval(() => {
    const now = Date.now();

    scooters.forEach((veh, index) => {
        if (!mp.vehicles.exists(veh)) return;

        // A. Rental Expiration
        if (veh.rentEndTime > 0 && now > veh.rentEndTime) {
            if (veh.engine) {
                veh.engine = false; // Kill engine
                // Optionally notify driver if they are on it
            }
            veh.rentEndTime = 0; // Mark as available
            veh.locked = true;
        }

        // B. Idle Reset (5 mins = 300,000ms)
        // If not rented AND nobody is on it AND (now - lastInteraction > 5min)
        const isOccupied = (veh.getOccupants().length > 0);
        
        if (veh.rentEndTime === 0 && !isOccupied) {
            if (now - veh.lastInteraction > 300000) {
                // Check if far from spawn
                const spawn = veh.spawnPoint;
                const dist = veh.dist(new mp.Vector3(spawn.x, spawn.y, spawn.z));
                
                if (dist > 2.0) {
                    console.log(`[eScootr] Resetting scooter ${index} to spawn.`);
                    veh.repair();
                    veh.position = new mp.Vector3(spawn.x, spawn.y, spawn.z);
                    veh.rotation = new mp.Vector3(0, 0, spawn.h);
                    veh.setVariable('fuel', 100);
                    veh.lastInteraction = now; // Reset timer
                }
            }
        } else {
            // Update interaction time if rented or occupied
            veh.lastInteraction = now;
        }
    });
}, 10000);

// Initialize
loadScooters();