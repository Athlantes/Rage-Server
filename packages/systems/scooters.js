// packages/systems/scooters.js
const db = require('../core/database'); // Ensure this path is correct for your server
const playerManager = require('../core/playerManager'); // Ensure this path is correct

const SCOOTER_MODEL = 'serv_electricscooter'; // Ensure this model exists, or use 'faggio'
const RENT_COST_PER_MINUTE = 2;
const MAX_IDLE_TIME_MS = 300000; // 5 Minutes before respawn
const RESPAWN_DISTANCE = 5.0; // Meters

class ScooterSystem {
    constructor() {
        this.scooters = new Map(); // Map<dbId, vehicleEntity>
        this.init();
    }

    async init() {
        await this.loadScooters();
        this.startSystemTicker();
        console.log(`[eScootr] System 3.0 Initialized.`);
    }

    async loadScooters() {
        try {
            const [rows] = await db.query("SELECT * FROM server_scooters");
            
            // Clean up existing scooters (Hot reload support)
            this.scooters.forEach(veh => {
                if (mp.vehicles.exists(veh)) veh.destroy();
            });
            this.scooters.clear();

            rows.forEach(row => this.createScooter(row));
            console.log(`[eScootr] Loaded ${rows.length} scooters.`);
        } catch (err) {
            console.error('[eScootr] DB Error:', err);
        }
    }

    createScooter(data) {
        const veh = mp.vehicles.new(mp.joaat(SCOOTER_MODEL), new mp.Vector3(data.x, data.y, data.z), {
            heading: data.h,
            dimension: 0,
            locked: true, // Locked by default until rented
            engine: false
        });

        // Database ID
        veh.scooterDbId = data.id;
        
        // Logic Data
        veh.homePos = { x: data.x, y: data.y, z: data.z, h: data.h };
        veh.rentData = {
            renterId: null,
            endTime: 0,
            active: false
        };
        
        // Monitoring
        veh.idleSince = Date.now(); // Used for respawn logic

        // Shared Variables (Synced to Client)
        veh.setVariable('isScooter', true);
        veh.setVariable('scooterId', data.id);
        veh.setVariable('battery', 100);
        veh.setVariable('rentEndTime', 0);

        this.scooters.set(data.id, veh);
        return veh;
    }

    // --- SYSTEM ACTIONS ---

    async createSpawnPoint(player) {
        if (!player.vehicle) return player.outputChatBox("Error: Must be in a vehicle.");
        const pos = player.vehicle.position;
        const head = player.vehicle.rotation.z;

        try {
            const [res] = await db.query("INSERT INTO server_scooters (x, y, z, h) VALUES (?, ?, ?, ?)", [pos.x, pos.y, pos.z, head]);
            this.createScooter({ id: res.insertId, x: pos.x, y: pos.y, z: pos.z, h: head });
            player.outputChatBox(`[eScootr] Created Spawn #${res.insertId}`);
        } catch (e) { console.error(e); }
    }

    async deleteSpawnPoint(player, id) {
        id = parseInt(id);
        if(!this.scooters.has(id)) return player.outputChatBox("Error: ID not found.");
        
        try {
            await db.query("DELETE FROM server_scooters WHERE id = ?", [id]);
            const veh = this.scooters.get(id);
            if(mp.vehicles.exists(veh)) veh.destroy();
            this.scooters.delete(id);
            player.outputChatBox(`[eScootr] Deleted Spawn #${id}`);
        } catch (e) { console.error(e); }
    }

    // --- CORE LOGIC LOOP (Run every 5 seconds) ---
    startSystemTicker() {
        setInterval(() => {
            const now = Date.now();

            this.scooters.forEach((veh, id) => {
                if (!mp.vehicles.exists(veh)) return;

                const isOccupied = veh.getOccupants().length > 0;
                const battery = veh.getVariable('battery');

                // 1. RENTAL LOGIC
                if (veh.rentData.active) {
                    // Check Expiration
                    if (now > veh.rentData.endTime) {
                        this.endRental(veh, "Time Expired");
                    }
                    // Drain Battery if moving/engine on
                    else if (isOccupied && battery > 0) {
                        // Drain approx 1% every 20 seconds of riding
                        const newBat = Math.max(0, battery - 0.25); 
                        veh.setVariable('battery', newBat);
                        if(newBat <= 0) {
                            veh.engine = false; // Kill engine
                            this.endRental(veh, "Battery Empty");
                        }
                    }
                    
                    veh.idleSince = now; // It's active, reset idle
                } 
                
                // 2. RESPAWN/IDLE LOGIC
                else {
                    if (isOccupied) {
                        veh.idleSince = now; // Someone is sitting on it, don't respawn
                    } else {
                        // Check distance from home
                        const dist = veh.dist(new mp.Vector3(veh.homePos.x, veh.homePos.y, veh.homePos.z));
                        
                        if (dist > RESPAWN_DISTANCE) {
                            // It's displaced. Check how long it's been ignored.
                            if (now - veh.idleSince > MAX_IDLE_TIME_MS) {
                                this.respawnScooter(veh);
                            }
                        } else {
                            // It's at home, reset idle just in case
                            veh.idleSince = now;
                            if(battery < 100) veh.setVariable('battery', 100); // Charge at home
                        }
                    }
                }
            });
        }, 5000); // Tick every 5s
    }

    respawnScooter(veh) {
        // console.log(`[eScootr] Respawning ID ${veh.scooterDbId}`);
        veh.repair();
        veh.position = new mp.Vector3(veh.homePos.x, veh.homePos.y, veh.homePos.z);
        veh.rotation = new mp.Vector3(0, 0, veh.homePos.h);
        veh.locked = true;
        veh.engine = false;
        veh.setVariable('battery', 100);
        veh.rentData = { renterId: null, endTime: 0, active: false };
        veh.setVariable('rentEndTime', 0);
    }

    endRental(veh, reason) {
        veh.rentData.active = false;
        veh.rentData.endTime = 0;
        veh.setVariable('rentEndTime', 0);
        veh.locked = true;
        veh.engine = false;
        
        // Reset idle timer so it will respawn in 5 mins if left here
        veh.idleSince = Date.now(); 
    }

    getNearbyScooters(player) {
        const pPos = player.position;
        return Array.from(this.scooters.values())
            .filter(v => mp.vehicles.exists(v))
            .map(v => {
                const dist = v.dist(pPos);
                // Return simplified object for UI
                return {
                    id: v.scooterDbId,
                    dist: dist,
                    fuel: v.getVariable('battery'),
                    rented: v.rentData.active,
                    pos: { x: v.position.x, y: v.position.y }
                };
            })
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 15);
    }
}

const scooterSystem = new ScooterSystem();
module.exports = scooterSystem;

// --- EVENTS ---

mp.events.add('server:phone:requestScooters', (player) => {
    const data = scooterSystem.getNearbyScooters(player);
    player.call('client:phone:receiveScooters', [data]);
});

mp.events.add('server:scooter:locate', (player, id) => {
    const veh = scooterSystem.scooters.get(id);
    
    if (!veh || !mp.vehicles.exists(veh)) {
        return player.call('client:phone:receiveMail', ['eScootr', 'Error', 'Signal not found.']);
    }

    if (veh.rentData.active && veh.rentData.renterId !== player.data.dbId) {
        return player.call('client:phone:receiveMail', ['eScootr', 'Busy', 'Scooter is currently in use.']);
    }

    // Crucial: Send the Remote ID (entity ID) if possible, plus coords
    // The client will try to find the entity for dynamic tracking
    player.call('client:scooter:setLocate', [veh.id, veh.position.x, veh.position.y, veh.position.z]);
});

mp.events.add('server:phone:rentScooter', (player, scooterId, minutes) => {
    const veh = scooterSystem.scooters.get(scooterId);
    
    if (!veh || !mp.vehicles.exists(veh)) return player.call('showNotification', ['eScootr', 'Error: Not found.']);
    if (player.dist(veh.position) > 10) return player.call('showNotification', ['eScootr', 'Too far away!']);
    if (veh.rentData.active) return player.call('showNotification', ['eScootr', 'Already rented!']);

    const cost = minutes * RENT_COST_PER_MINUTE;
    if (player.data.money < cost) return player.call('showNotification', ['eScootr', `Insufficient funds ($${cost}).`]);

    if (playerManager.removeMoney(player, cost, `eScootr Rental`)) {
        
        // Setup Rental
        veh.rentData.active = true;
        veh.rentData.renterId = player.data.dbId;
        veh.rentData.endTime = Date.now() + (minutes * 60000);
        
        veh.locked = false;
        veh.setVariable('rentEndTime', veh.rentData.endTime);
        
        // Refuel if low
        if(veh.getVariable('battery') < 20) veh.setVariable('battery', 100);

        player.call('client:phone:rentSuccess', [veh.rentData.endTime]);
        player.call('showNotification', ['eScootr', 'Unlocked! Engine enabled.']);
    }
});
