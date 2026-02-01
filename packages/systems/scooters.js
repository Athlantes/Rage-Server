// packages/systems/scooters.js
const db = require('../core/database');
const playerManager = require('../core/playerManager');

const SCOOTER_MODEL = 'serv_electricscooter';
const RENT_COST_PER_MINUTE = 2; 

class ScooterSystem {
    constructor() {
        this.scooters = new Map(); // Map<dbId, vehicleEntity>
        this.init();
    }

    async init() {
        await this.loadScooters();
        this.startTickHandler();
        console.log(`[eScootr 2.0] System initialized.`);
    }

    async loadScooters() {
        try {
            // Make sure the table exists or this will fail
            const [rows] = await db.query("SELECT * FROM server_scooters");
            
            // Clear existing if this is a reload
            this.scooters.forEach(veh => {
                if (mp.vehicles.exists(veh)) veh.destroy();
            });
            this.scooters.clear();

            rows.forEach(row => this.createScooterEntity(row));
            console.log(`[eScootr] Loaded ${rows.length} scooters from database.`);
        } catch (err) {
            console.error('[eScootr] Failed to load scooters (Check DB Table):', err);
        }
    }

    createScooterEntity(data) {
        const veh = mp.vehicles.new(mp.joaat(SCOOTER_MODEL), new mp.Vector3(data.x, data.y, data.z), {
            heading: data.h,
            dimension: 0,
            locked: false,
            engine: false
        });

        // Setup Logic variables
        veh.setVariable('isScooter', true);
        veh.setVariable('scooterId', data.id); // Public ID for UI
        veh.setVariable('rentEndTime', 0);
        veh.setVariable('fuel', 100);

        // Internal State
        veh.scooterDbId = data.id;
        veh.spawnPoint = { x: data.x, y: data.y, z: data.z, h: data.h };
        veh.lastRenter = null;
        veh.rentEndTime = 0;
        veh.lastInteraction = Date.now();

        this.scooters.set(data.id, veh);
        return veh;
    }

    // --- SYSTEM ACTIONS (Called by Commands) ---

    async addScooterSpawn(player) {
        if (!player.vehicle) return player.outputChatBox("[eScootr] You must be in a vehicle to save its position.");
        
        const pos = player.vehicle.position;
        const heading = player.vehicle.rotation.z;

        try {
            const [result] = await db.query(
                "INSERT INTO server_scooters (x, y, z, h) VALUES (?, ?, ?, ?)", 
                [pos.x, pos.y, pos.z, heading]
            );
            
            const newScooterData = { id: result.insertId, x: pos.x, y: pos.y, z: pos.z, h: heading };
            this.createScooterEntity(newScooterData);
            
            player.outputChatBox(`[eScootr] Scooter added (ID: ${result.insertId}).`);
        } catch (err) {
            player.outputChatBox("[eScootr] Database error while saving.");
            console.error(err);
        }
    }

    async removeScooterSpawn(player, id) {
        id = parseInt(id);
        if (!this.scooters.has(id)) return player.outputChatBox("[eScootr] Scooter ID not found active.");

        try {
            await db.query("DELETE FROM server_scooters WHERE id = ?", [id]);
            
            const veh = this.scooters.get(id);
            if (veh && mp.vehicles.exists(veh)) veh.destroy();
            this.scooters.delete(id);

            player.outputChatBox(`[eScootr] Scooter ${id} removed permanently.`);
        } catch (err) {
            player.outputChatBox("[eScootr] Database error while deleting.");
            console.error(err);
        }
    }

    startTickHandler() {
        // Run every 10 seconds
        setInterval(() => {
            const now = Date.now();
            
            this.scooters.forEach((veh, id) => {
                if (!mp.vehicles.exists(veh)) return;

                // 1. Check Rental Expiration
                if (veh.rentEndTime > 0 && now > veh.rentEndTime) {
                    if (veh.engine) veh.engine = false;
                    veh.rentEndTime = 0;
                    veh.setVariable('rentEndTime', 0);
                    veh.locked = true; // Lock it so others can't just drive off
                }

                // 2. Check Abandonment / Respawn Logic
                const isOccupied = (veh.getOccupants().length > 0);
                
                if (veh.rentEndTime === 0 && !isOccupied) {
                    // If untouched for 5 minutes (300000ms)
                    if (now - veh.lastInteraction > 300000) {
                        const spawn = veh.spawnPoint;
                        const dist = veh.dist(new mp.Vector3(spawn.x, spawn.y, spawn.z));
                        
                        // Only respawn if it's far from home (> 5 meters)
                        if (dist > 5.0) {
                            // console.log(`[eScootr] Respawning scooter ${id} to base.`);
                            veh.repair();
                            veh.position = new mp.Vector3(spawn.x, spawn.y, spawn.z);
                            veh.rotation = new mp.Vector3(0, 0, spawn.h);
                            veh.setVariable('fuel', 100);
                            veh.lastInteraction = now;
                        }
                    }
                } else {
                    // Update interaction time if being used
                    veh.lastInteraction = now;
                }
            });
        }, 10000);
    }

    getNearby(player) {
        const pPos = player.position;
        return Array.from(this.scooters.values())
            .filter(v => mp.vehicles.exists(v))
            .map(v => {
                const dist = v.dist(pPos);
                return {
                    id: v.scooterDbId,
                    dist: dist,
                    fuel: v.getVariable('fuel'),
                    rented: (v.rentEndTime > Date.now()),
                    pos: { x: v.position.x, y: v.position.y }
                };
            })
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 10);
    }
}

// Instantiate the system
const scooterSystem = new ScooterSystem();

// --- EVENTS ---

mp.events.add('server:phone:requestScooters', (player) => {
    const nearby = scooterSystem.getNearby(player);
    player.call('client:phone:receiveScooters', [nearby]);
});

mp.events.add('server:scooter:locate', (player, id) => {
    const veh = scooterSystem.scooters.get(id);
    
    if (!veh || !mp.vehicles.exists(veh)) {
        return player.call('client:phone:receiveMail', ['eScootr', 'Error', 'Signal lost.']);
    }

    if (veh.rentEndTime > Date.now()) {
        return player.call('client:phone:receiveMail', ['eScootr', 'Unavailable', 'Currently rented by someone else.']);
    }

    player.trackingScooter = id;
    player.call('client:scooter:setLocate', [veh.position.x, veh.position.y, veh.position.z]);
});

mp.events.add('server:phone:rentScooter', (player, scooterId, minutes) => {
    const veh = scooterSystem.scooters.get(scooterId);
    
    if (!veh || !mp.vehicles.exists(veh)) {
        return player.call('showNotification', ['eScootr', 'Error: Scooter not found.']);
    }
    
    if (player.dist(veh.position) > 10) {
        return player.call('showNotification', ['eScootr', 'You are too far away!']);
    }

    // Check Money using PlayerManager
    const cost = minutes * RENT_COST_PER_MINUTE;
    if (player.data.money < cost) {
        return player.call('showNotification', ['eScootr', `You need $${cost} to rent this.`]);
    }

    // Process Payment
    // We use "Scooter Rent" as the reason for logs
    if (playerManager.removeMoney(player, cost, `eScootr Rent (${minutes}m)`)) {
        
        player.call('showNotification', ['eScootr', `Rented for ${minutes} min ($${cost}).`]);

        const isSameRenter = (veh.lastRenter === player.data.dbId);
        
        veh.lastRenter = player.data.dbId;
        veh.rentEndTime = Date.now() + (minutes * 60000);
        veh.setVariable('rentEndTime', veh.rentEndTime);
        veh.locked = false;
        veh.lastInteraction = Date.now();

        if (!isSameRenter) {
            veh.setVariable('fuel', 100); // Refuel for new customers
        }

        // Notify others tracking this scooter
        mp.players.forEach(p => {
            if (p.trackingScooter === scooterId && p.id !== player.id) {
                p.call('client:scooter:lostTrack'); 
                p.call('client:phone:receiveMail', ['eScootr', 'Update', 'The scooter you were tracking has been rented.']);
                p.trackingScooter = null;
            }
        });

        player.call('client:phone:rentSuccess', [veh.rentEndTime]);
    } else {
        player.call('showNotification', ['eScootr', 'Transaction Failed.']);
    }
});

mp.events.add('vehicle:toggleEngine', (player) => {
    const veh = player.vehicle;
    if (!veh || !veh.getVariable('isScooter')) return; 

    // Allow owner or admins to toggle
    if ((veh.rentEndTime && veh.rentEndTime > Date.now()) || player.isAdmin) {
        veh.engine = !veh.engine;
        player.call('showNotification', ['eScootr', veh.engine ? 'Engine Started' : 'Engine Stopped']);
    } else {
        veh.engine = false;
        player.call('showNotification', ['eScootr', 'Rental expired. Use the app.']);
    }
});

mp.events.add('server:scooter:enableTracking', (player, scooterId) => {
    player.trackingScooter = scooterId;
});

module.exports = scooterSystem;