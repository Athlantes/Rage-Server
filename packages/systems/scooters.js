// packages/systems/scooters.js
const fs = require('fs');
const path = require('path');

const SAVE_FILE = path.join(__dirname, '../data/scooter_locations.json');
const SCOOTER_MODEL = 'serv_electricscooter';
const RENT_COST_PER_MINUTE = 2; 

let scooters = [];
let spawnPoints = [];

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
        locked: false,
        engine: false
    });

    veh.setVariable('isScooter', true);
    veh.setVariable('scooterId', index);
    veh.scooterIndex = index;
    veh.spawnPoint = point;
    veh.lastRenter = null; 
    veh.rentEndTime = 0;
    veh.lastInteraction = Date.now(); 
    
    veh.setVariable('rentEndTime', 0);
    veh.setVariable('fuel', 100);
    
    scooters[index] = veh;
};

// --- EVENTS ---

mp.events.add('server:phone:requestScooters', (player) => {
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

// NEW: Server-side validation for "Find"
mp.events.add('server:scooter:locate', (player, id) => {
    const veh = scooters[id];
    
    if (!veh || !mp.vehicles.exists(veh)) {
        return player.call('client:phone:receiveMail', ['eScootr', 'Error', 'This scooter signal is lost.']);
    }

    if (veh.rentEndTime > Date.now()) {
        return player.call('client:phone:receiveMail', ['eScootr', 'Unavailable', 'This scooter is currently rented.']);
    }

    // Register tracking for "Lost Track" feature
    player.trackingScooter = id;

    // Send exact Coords to client
    player.call('client:scooter:setLocate', [veh.position.x, veh.position.y, veh.position.z]);
});

mp.events.add('server:phone:rentScooter', (player, scooterId, minutes) => {
    const veh = scooters[scooterId];
    if (!veh || !mp.vehicles.exists(veh)) return player.call('showNotification', ['eScootr', 'Error: Scooter not found.']);
    
    const cost = minutes * RENT_COST_PER_MINUTE;
    
    if (player.dist(veh.position) > 5) return player.call('showNotification', ['eScootr', 'You are too far away!']);
    if (player.data.money < cost) return player.call('showNotification', ['eScootr', `You need $${cost} to rent this.`]);

    player.data.money -= cost;
    player.call('showNotification', ['eScootr', `Rented for ${minutes} min ($${cost}).`]);

    const isSameRenter = (veh.lastRenter === player.data.dbId);
    
    veh.lastRenter = player.data.dbId;
    veh.rentEndTime = Date.now() + (minutes * 60000);
    veh.setVariable('rentEndTime', veh.rentEndTime);
    veh.locked = false;
    veh.lastInteraction = Date.now();

    if (!isSameRenter) {
        veh.setVariable('fuel', 100);
    }

    mp.players.forEach(p => {
        if (p.trackingScooter === scooterId && p.id !== player.id) {
            p.call('client:scooter:lostTrack'); 
            p.call('client:phone:receiveMail', ['eScootr', 'Scooter Unavailable', 'The scooter you were tracking has been rented by someone else.']);
            p.trackingScooter = null;
        }
    });

    player.call('client:phone:rentSuccess', [veh.rentEndTime]);
});

mp.events.add('vehicle:toggleEngine', (player) => {
    const veh = player.vehicle;
    if (!veh || !veh.getVariable('isScooter')) return; 

    if (veh.rentEndTime && veh.rentEndTime > Date.now()) {
        veh.engine = !veh.engine;
        player.call('showNotification', ['eScootr', veh.engine ? 'Engine Started' : 'Engine Stopped']);
    } else {
        veh.engine = false;
        player.call('showNotification', ['eScootr', 'Rental expired. Use the app to rent.']);
    }
});

mp.events.add('server:scooter:enableTracking', (player, scooterId) => {
    player.trackingScooter = scooterId;
});

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
    const dir = path.dirname(SAVE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SAVE_FILE, JSON.stringify(spawnPoints, null, 2));
}

setInterval(() => {
    const now = Date.now();
    scooters.forEach((veh, index) => {
        if (!mp.vehicles.exists(veh)) return;
        if (veh.rentEndTime > 0 && now > veh.rentEndTime) {
            if (veh.engine) veh.engine = false; 
            veh.rentEndTime = 0; 
            veh.setVariable('rentEndTime', 0);
            veh.locked = true;
        }
        const isOccupied = (veh.getOccupants().length > 0);
        if (veh.rentEndTime === 0 && !isOccupied) {
            if (now - veh.lastInteraction > 300000) {
                const spawn = veh.spawnPoint;
                const dist = veh.dist(new mp.Vector3(spawn.x, spawn.y, spawn.z));
                if (dist > 2.0) {
                    console.log(`[eScootr] Resetting scooter ${index} to spawn.`);
                    veh.repair();
                    veh.position = new mp.Vector3(spawn.x, spawn.y, spawn.z);
                    veh.rotation = new mp.Vector3(0, 0, spawn.h);
                    veh.setVariable('fuel', 100);
                    veh.lastInteraction = now; 
                }
            }
        } else {
            veh.lastInteraction = now;
        }
    });
}, 10000);

loadScooters();