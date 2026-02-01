// packages/core/escootr/manager.js
const db = require('../core/database');

// Configuration
const RENTAL_RESET_TIME_MS = 5 * 60 * 1000; // 5 minutes
const MAX_SEARCH_DIST = 500; // Max distance for app list

// State management
const scooters = new Map(); // dbId -> { entity, dbData, renter, lastRenter, resetTimer, rentalTimer }

// --- Helper Functions for Coordinate Parsing ---
const parseVec3 = (str) => {
    if (!str) return new mp.Vector3(0, 0, 0);
    const parts = str.split(',');
    return new mp.Vector3(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]));
};

const stringifyVec3 = (vec) => {
    return `${vec.x.toFixed(2)},${vec.y.toFixed(2)},${vec.z.toFixed(2)}`;
};

const ScooterManager = {
    // 1. Initialization
    init: async () => {
        console.log('[eScootr] Loading spawns...');
        const [rows] = await db.query("SELECT * FROM escootr_spawns");
        
        rows.forEach(row => {
            ScooterManager.spawn(row);
        });
        console.log(`[eScootr] Spawned ${rows.length} scooters.`);
    },

    // 2. Spawning Logic
    spawn: (dbData) => {
        // Remove existing if respawning
        if (scooters.has(dbData.id)) {
            const existing = scooters.get(dbData.id);
            if (mp.vehicles.exists(existing.entity)) existing.entity.destroy();
            clearTimeout(existing.resetTimer);
            clearTimeout(existing.rentalTimer);
        }

        const pos = parseVec3(dbData.position);
        const rot = parseVec3(dbData.rotation);

        const vehicle = mp.vehicles.new(mp.joaat(dbData.model), pos, {
            heading: rot.z, // Use Z rotation for heading
            numberPlate: "SCOOTER",
            locked: false,
            engine: false,
            dimension: 0
        });

        // Setup entity data
        vehicle.setVariable('isScooter', true);
        vehicle.setVariable('rentedBy', null); // null or character ID
        vehicle.setVariable('fuel', 100.0);
        
        // RAGE rotation handling (Vector3)
        vehicle.rotation = rot;

        // Store internal state
        scooters.set(dbData.id, {
            entity: vehicle,
            dbData: dbData,
            renter: null,      // Current Renter DB ID
            lastRenter: null,  // For fuel persistence logic
            resetTimer: null,  // Auto-reset timer
            rentalTimer: null  // Active rental timer
        });

        return vehicle;
    },

    // 3. Rental Logic
    startRental: (player, vehicleId, durationMinutes) => {
        const scooter = [...scooters.values()].find(s => s.entity.id === vehicleId);
        if (!scooter) return { success: false, msg: "Scooter not found." };
        if (scooter.renter) return { success: false, msg: "Already rented." };

        // Stop auto-reset timer if running
        if (scooter.resetTimer) {
            clearTimeout(scooter.resetTimer);
            scooter.resetTimer = null;
        }

        // Fuel Logic: Reset if new renter, keep if same
        if (scooter.lastRenter !== player.data.dbId) {
            scooter.entity.setVariable('fuel', 100.0);
            scooter.entity.repair();
        }

        // Update State
        scooter.renter = player.data.dbId;
        scooter.entity.setVariable('rentedBy', player.data.dbId);
        scooter.entity.engine = true; // Unlock engine

        // Set Rental Timer
        scooter.rentalTimer = setTimeout(() => {
            ScooterManager.endRental(scooter.dbData.id);
            if (mp.players.exists(player)) {
                player.notify("Your eScootr rental has expired.");
            }
        }, durationMinutes * 60 * 1000);

        return { success: true, msg: `Rented for ${durationMinutes} minutes.` };
    },

    endRental: (dbId) => {
        if (!scooters.has(dbId)) return;
        const scooter = scooters.get(dbId);

        // Clear active rental state
        if (scooter.rentalTimer) clearTimeout(scooter.rentalTimer);
        scooter.lastRenter = scooter.renter;
        scooter.renter = null;
        
        // Update Entity
        if (mp.vehicles.exists(scooter.entity)) {
            scooter.entity.setVariable('rentedBy', null);
            scooter.entity.engine = false; // Force engine off
        }

        // Start Auto-Reset Logic
        ScooterManager.startResetTimer(dbId);
    },

    // 4. Auto Reset Logic
    startResetTimer: (dbId) => {
        const scooter = scooters.get(dbId);
        
        scooter.resetTimer = setTimeout(() => {
            if (!mp.vehicles.exists(scooter.entity)) return;

            const currentPos = scooter.entity.position;
            const spawnPos = parseVec3(scooter.dbData.position);

            // Check if moved significantly (> 2.0 units)
            const dist = currentPos.subtract(spawnPos).length();

            if (dist > 2.0) {
                // Reset to original state
                ScooterManager.spawn(scooter.dbData); // Respawn handles fresh fuel/pos
            } else {
                // If it hasn't moved, just reset fuel/state without respawning entity overhead
                scooter.entity.setVariable('fuel', 100.0);
                scooter.entity.repair();
                scooter.lastRenter = null; // Reset history
            }
        }, RENTAL_RESET_TIME_MS);
    },

    // 5. Database Operations
    createSpawn: async (player) => {
        const posStr = stringifyVec3(player.position);
        const rotStr = stringifyVec3(player.rotation); // Assuming player rotation matches desired veh rotation
        const model = 'serv_electricscooter';

        const [result] = await db.query(
            "INSERT INTO escootr_spawns (model, position, rotation) VALUES (?, ?, ?)",
            [model, posStr, rotStr]
        );

        // Immediate spawn
        ScooterManager.spawn({
            id: result.insertId,
            model: model,
            position: posStr,
            rotation: rotStr
        });

        return result.insertId;
    },

    removeSpawn: async (id) => {
        if (scooters.has(id)) {
            const s = scooters.get(id);
            if (mp.vehicles.exists(s.entity)) s.entity.destroy();
            scooters.delete(id);
        }
        await db.query("DELETE FROM escootr_spawns WHERE id = ?", [id]);
    },
    
    // Getters for Events
    getNearbyScooters: (playerPos) => {
        const list = [];
        scooters.forEach((s) => {
            if (!mp.vehicles.exists(s.entity)) return;
            const dist = s.entity.position.subtract(playerPos).length();
            if (dist <= MAX_SEARCH_DIST) {
                list.push({
                    id: s.entity.id, // Entity ID for client interaction
                    dist: Math.floor(dist),
                    isRented: !!s.renter,
                    pos: { x: s.entity.position.x, y: s.entity.position.y }
                });
            }
        });
        return list.sort((a, b) => a.dist - b.dist).slice(0, 10);
    },

    getScooterDetails: (vehicle) => {
        const distDriven = (vehicle.getVariable('odometer') || 0) / 1000; // Assuming odometer var exists
        return {
            fuel: Math.floor(vehicle.getVariable('fuel') || 0),
            health: Math.floor(vehicle.engineHealth / 10),
            km: distDriven.toFixed(1)
        };
    },
    
    getScooterByEntityId: (entityId) => {
        return [...scooters.values()].find(s => s.entity.id === entityId);
    }
};

mp.events.add('server:escootr:getData', (player) => {
    if (player.vehicle && player.vehicle.getVariable('isScooter')) {
        // Player is seated on a scooter -> Show Menu
        const details = ScooterManager.getScooterDetails(player.vehicle);
        const isRentedByMe = player.vehicle.getVariable('rentedBy') === player.data.dbId;
        
        player.call('client:phone:updateScootrApp', ['menu', {
            ...details,
            canRent: !isRentedByMe, // Logic: if already rented by me, maybe show "Extend"? Simplified: only rent if not.
            isRentedByMe: isRentedByMe
        }]);
    } else {
        // Player is on foot -> Show List
        const list = ScooterManager.getNearbyScooters(player.position);
        player.call('client:phone:updateScootrApp', ['list', list]);
    }
});

mp.events.add('server:escootr:rent', (player, duration) => {
    if (!player.vehicle || !player.vehicle.getVariable('isScooter')) return;
    
    const scooterObj = ScooterManager.getScooterByEntityId(player.vehicle.id);
    if (!scooterObj) return;

    // Billing logic here (e.g., check player money)
    // if (player.money < cost) ...

    const result = ScooterManager.startRental(player, player.vehicle.id, parseInt(duration));
    
    if (result.success) {
        player.call('client:phone:notification', ['eScootr', 'Rental started! Drive safely.']);
        // Refresh UI
        mp.events.call('server:escootr:getData', player);
    } else {
        player.call('client:phone:notification', ['eScootr', `Error: ${result.msg}`]);
    }
});

// Clean up rentals if player disconnects
mp.events.add('playerQuit', (player) => {
    // Ideally map player ID to active rental and cancel/end it
    // Implementation omitted for brevity, but recommended
});

// Initialize on server start
ScooterManager.init();

module.exports = ScooterManager;