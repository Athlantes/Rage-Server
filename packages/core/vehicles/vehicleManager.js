const db = require('../database');

const vehicles = {
    _locatorLoopStarted: false,

    // 1. Load all cars on server start
    loadAll: async () => {
        console.log("[Vehicles] Loading...");
        const [rows] = await db.query("SELECT * FROM server_vehicles WHERE parked = 0");
        
        rows.forEach(data => {
            if (!vehicles.findActiveVehicle(data.id)) {
                vehicles.spawn(data);
            }
        });
        console.log(`[Vehicles] Loaded ${rows.length} cars.`);
        
        // Start the inactivity check loop
        vehicles.startAutoDespawnLoop(); 
        vehicles.startLocatorLoop();
    },

    // 2. Spawn Logic 
    spawn: (data) => {
        let pos = JSON.parse(data.position);
        let colors = data.color ? JSON.parse(data.color) : {prim: 0, sec: 0};

        // We use pos.heading which we now save correctly
        let veh = mp.vehicles.new(mp.joaat(data.model), new mp.Vector3(pos.x, pos.y, pos.z), {
            heading: pos.heading || 0, // <--- This now works because we save it below
            numberPlate: data.plate,
            dimension: data.dimension,
            locked: true,
            engine: false
        });

        veh.dbId = data.id; 
        veh.ownerId = data.owner_id;
        veh.familyId = data.family_id || null;
        
        veh.lastActive = Date.now(); 

        // Apply colors: support RGB format, chameleon format, and legacy index format.
        if (typeof colors.chameleonIndex === 'number' && colors.chameleonIndex >= 161) {
            try {
                veh.setColor(colors.chameleonIndex, colors.chameleonIndex);
            } catch(e) {
                veh.setColor(0, 0);
            }
            veh.setVariable('paintType', 6);
            veh.setVariable('chameleonColor', colors.chameleonIndex);
        } else if (colors.primRGB) {
            // New RGB format: { primRGB: {r,g,b}, secRGB: {r,g,b}, paintType: 0 }
            try {
                veh.setColorRGB(
                    colors.primRGB.r, colors.primRGB.g, colors.primRGB.b,
                    colors.secRGB.r, colors.secRGB.g, colors.secRGB.b
                );
            } catch(e) {
                veh.setColor(0, 0);
            }
            // Store paint type for client-side application
            veh.setVariable('paintType', colors.paintType || 0);
            veh.setVariable('chameleonColor', -1);
        } else {
            // Legacy format: { prim: 0, sec: 0 }
            veh.setColor(colors.prim || 0, colors.sec || 0);
            veh.setVariable('chameleonColor', -1);
        }

        veh.engineHealth = data.engine_health;
        veh.dirtLevel = data.dirt_level;
        veh.setVariable('fuel', data.fuel);
        
        return veh;
    },

    save: async (veh) => {
        if (!veh || !veh.dbId) return;

        let fuel = veh.getVariable('fuel');
        
        // We only save stats. We do NOT update 'position' because 
        // we want the car to respawn at its assigned parking spot, 
        // not where it was left in the middle of the road.
        await db.query(
            "UPDATE server_vehicles SET fuel=?, engine_health=?, dirt_level=? WHERE id=?", 
            [fuel, veh.engineHealth, veh.dirtLevel, veh.dbId]
        );
        
    },

    // 3. Save Position (Called by /parkcar)
    // FIX: We now manually build the object to include 'heading'
    savePosition: async (veh) => {
        if(!veh.dbId) return; 

        // RAGE Vector3 doesn't have rotation, so we must add it manually
        const saveLocation = {
            x: veh.position.x,
            y: veh.position.y,
            z: veh.position.z,
            heading: veh.rotation.z // <--- CRITICAL FIX: Save the rotation!
        };

        let posJson = JSON.stringify(saveLocation); 
        
        await db.query("UPDATE server_vehicles SET position=? WHERE id=?", 
            [posJson, veh.dbId]);
        
        console.log(`[Vehicles] Park Position & Heading Updated for ID ${veh.dbId}`);
    },

    // 4. Despawn / Tow 
    despawnVehicle: async (veh) => {
        if (!veh) return;

        // If it has a DB ID, save its data before deleting
        if (veh.dbId) {
            let fuel = veh.getVariable('fuel');
            
            // Save state but NOT position (keeps the /parkcar spot)
            await db.query("UPDATE server_vehicles SET parked=1, fuel=?, engine_health=?, dirt_level=? WHERE id=?", 
                [fuel, veh.engineHealth, veh.dirtLevel, veh.dbId]);
                
            console.log(`[Vehicles] Vehicle ID ${veh.dbId} despawned (Saved & Towed).`);

            // Stop active trackers that are targeting this vehicle.
            mp.players.forEach((player) => {
                if (!player || !mp.players.exists(player)) return;
                if (parseInt(player.vehicleLocatorDbId) === veh.dbId) {
                    vehicles.stopVehicleLocator(player, 'Tracked vehicle was despawned.');
                }
            });
        } else {
            console.log(`[Vehicles] Temporary/Admin vehicle deleted.`);
        }
        
        // Destroy the actual entity (Works for both DB cars and Admin cars now)
        if (mp.vehicles.exists(veh)) veh.destroy();
    },

    startVehicleLocator: (player, vehOrDbId, label = 'Tracked Vehicle') => {
        if (!player || !mp.players.exists(player)) return false;

        const veh = typeof vehOrDbId === 'number'
            ? vehicles.findActiveVehicle(vehOrDbId)
            : vehOrDbId;

        if (!veh || !mp.vehicles.exists(veh) || !veh.dbId) return false;

        vehicles.startLocatorLoop();

        player.vehicleLocatorDbId = veh.dbId;
        player.vehicleLocatorLabel = String(label || 'Tracked Vehicle');

        player.call('client:vehicleLocator:start', [
            veh.dbId,
            veh.position.x,
            veh.position.y,
            veh.position.z,
            player.vehicleLocatorLabel
        ]);

        return true;
    },

    stopVehicleLocator: (player, reason = null) => {
        if (!player || !mp.players.exists(player)) return;

        if (player.vehicleLocatorDbId) {
            player.call('client:vehicleLocator:stop', [reason || '']);
        }

        player.vehicleLocatorDbId = null;
        player.vehicleLocatorLabel = null;
    },

    startLocatorLoop: () => {
        if (vehicles._locatorLoopStarted) return;
        vehicles._locatorLoopStarted = true;
        const REACHED_DISTANCE = 12.0;

        setInterval(() => {
            mp.players.forEach((player) => {
                if (!player || !mp.players.exists(player) || !player.logged) return;

                const trackedDbId = parseInt(player.vehicleLocatorDbId);
                if (isNaN(trackedDbId) || trackedDbId <= 0) return;

                const veh = vehicles.findActiveVehicle(trackedDbId);
                if (!veh || !mp.vehicles.exists(veh)) {
                    vehicles.stopVehicleLocator(player, 'Tracked vehicle was despawned.');
                    return;
                }

                const playerVeh = player.vehicle;
                if (playerVeh && mp.vehicles.exists(playerVeh) && parseInt(playerVeh.dbId) === trackedDbId) {
                    vehicles.stopVehicleLocator(player);
                    return;
                }

                if (player.dist(veh.position) <= REACHED_DISTANCE) {
                    vehicles.stopVehicleLocator(player);
                    return;
                }

                player.call('client:vehicleLocator:update', [
                    trackedDbId,
                    veh.position.x,
                    veh.position.y,
                    veh.position.z,
                    player.vehicleLocatorLabel || 'Tracked Vehicle'
                ]);
            });
        }, 1000);
    },

    // 5. Create (Buy)
    // spawnPosition: optional { x, y, z, heading } to place the car at a specific spot
    // options: { ownerId, familyId, plate, putIntoVehicle, sendMail }
    create: async (player, model, spawnPosition, options = {}) => {
        const ownerId = options.ownerId || player.data.dbId;
        const familyId = Number.isInteger(options.familyId) ? options.familyId : null;
        const plate = typeof options.plate === 'string' && options.plate.trim().length
            ? options.plate.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10)
            : 'NEWCAR';
        const shouldWarpIntoVehicle = options.putIntoVehicle !== false;
        const shouldSendMail = options.sendMail !== false;

        const spawnPos = spawnPosition || {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z,
            heading: player.heading 
        };

        let pos = JSON.stringify(spawnPos);
        let defaultColor = JSON.stringify({prim: 0, sec: 0});
        
        // 1. Insert into Database
        const [result] = await db.query("INSERT INTO server_vehicles (owner_id, family_id, model, position, color, plate) VALUES (?, ?, ?, ?, ?, ?)", 
            [ownerId, familyId, model, pos, defaultColor, plate]);

        const [rows] = await db.query("SELECT * FROM server_vehicles WHERE id = ?", [result.insertId]);
        
        // 2. Spawn the car
        let newVeh = vehicles.spawn(rows[0]);
        
        if (shouldWarpIntoVehicle) {
            setTimeout(() => {
                if (mp.players.exists(player) && mp.vehicles.exists(newVeh)) {
                    player.putIntoVehicle(newVeh, -1);
                }
            }, 150);
        }

        if (shouldSendMail) {
            const mailTitle = familyId ? 'Family Purchase Receipt' : 'Purchase Receipt';
            const mailBody = familyId
                ? `Your family purchased a ${model}. Family members can now manage it from Family Garage.`
                : `Congratulations! You have successfully purchased a ${model}. The keys have been added to your keychain.`;
            mp.events.call(
                'server:phone:sendMail', 
                player.data.dbId,
                'Mosley Auto',
                mailTitle,
                mailBody
            );
        }

        return newVeh;
    },

    // 6. Get List
    getPlayerVehicles: async (playerId) => {
        const [rows] = await db.query("SELECT id, model, plate, parked, fuel FROM server_vehicles WHERE owner_id = ? AND family_id IS NULL", [playerId]);
        return rows;
    },

    getFamilyVehicles: async (familyId) => {
        const [rows] = await db.query("SELECT id, owner_id, model, plate, parked, fuel FROM server_vehicles WHERE family_id = ? ORDER BY id DESC", [familyId]);
        return rows;
    },

    // 7. Unpark
    unparkVehicle: async (player, dbId) => {
        let existingCar = vehicles.findActiveVehicle(dbId);
        if (existingCar) {
            player.call('showNotification', ['Vehicle System', 'That vehicle is already out!']);
            existingCar.lastActive = Date.now();
            return null; 
        }

        const [rows] = await db.query("SELECT * FROM server_vehicles WHERE id = ? AND owner_id = ? AND family_id IS NULL", [dbId, player.data.dbId]);
        if (rows.length === 0) return false; 
        
        const carData = rows[0];
        const veh = vehicles.spawn(carData); // Will now use the saved heading
        
        await db.query("UPDATE server_vehicles SET parked = 0 WHERE id = ?", [dbId]);
        
        return veh;
    },

    unparkFamilyVehicle: async (player, familyId, dbId) => {
        let existingCar = vehicles.findActiveVehicle(dbId);
        if (existingCar) {
            player.call('showNotification', ['Family Garage', 'That vehicle is already out!']);
            existingCar.lastActive = Date.now();
            return null;
        }

        const [rows] = await db.query("SELECT * FROM server_vehicles WHERE id = ? AND family_id = ?", [dbId, familyId]);
        if (rows.length === 0) return false;

        const veh = vehicles.spawn(rows[0]);
        await db.query("UPDATE server_vehicles SET parked = 0 WHERE id = ?", [dbId]);
        return veh;
    },

    findActiveVehicle: (dbId) => {
        return mp.vehicles.toArray().find(v => v.dbId === parseInt(dbId));
    },

    // 8. Auto-Despawn Loop
    // packages/core/vehicles/vehicleManager.js

    startAutoDespawnLoop: () => {
        setInterval(() => {
            const now = Date.now();
            const TIMEOUT = 2 * 60 * 1000; 

            mp.vehicles.forEach(veh => {
                // FIX: If it's a job vehicle (has jobOwner but no dbId), skip auto-despawn
                if (veh.jobOwner && !veh.dbId) return; 
                
                if (!veh.dbId) return; 

                const occupants = veh.getOccupants();
                if (occupants.length > 0) {
                    veh.lastActive = now;
                } else {
                    if (!veh.lastActive) veh.lastActive = now;
                    const diff = now - veh.lastActive;

                    if (diff > TIMEOUT) {
                        vehicles.despawnVehicle(veh);
                    }
                }
            });
        }, 10000); 
    }
};

module.exports = vehicles;