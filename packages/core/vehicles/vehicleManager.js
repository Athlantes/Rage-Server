const db = require('../database');

const vehicles = {
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
        
        veh.lastActive = Date.now(); 

        // Apply colors: support new RGB format and legacy index format
        if (colors.primRGB) {
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
        } else {
            // Legacy format: { prim: 0, sec: 0 }
            veh.setColor(colors.prim || 0, colors.sec || 0);
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
        } else {
            console.log(`[Vehicles] Temporary/Admin vehicle deleted.`);
        }
        
        // Destroy the actual entity (Works for both DB cars and Admin cars now)
        if (mp.vehicles.exists(veh)) veh.destroy();
    },

    // 5. Create (Buy)
    // spawnPosition: optional { x, y, z, heading } to place the car at a specific spot
    create: async (player, model, spawnPosition) => {
        const spawnPos = spawnPosition || {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z,
            heading: player.heading 
        };

        let pos = JSON.stringify(spawnPos);
        let defaultColor = JSON.stringify({prim: 0, sec: 0});
        
        // 1. Insert into Database
        const [result] = await db.query("INSERT INTO server_vehicles (owner_id, model, position, color) VALUES (?, ?, ?, ?)", 
            [player.data.dbId, model, pos, defaultColor]);

        const [rows] = await db.query("SELECT * FROM server_vehicles WHERE id = ?", [result.insertId]);
        
        // 2. Spawn the car
        let newVeh = vehicles.spawn(rows[0]);
        
        setTimeout(() => {
            if (mp.players.exists(player) && mp.vehicles.exists(newVeh)) {
                player.putIntoVehicle(newVeh, -1);
            }
        }, 150);

        const receiptHtml = `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #ffffff; color: #333; border-radius: 8px; border: 1px solid #e1e4e8; max-width: 340px; overflow: hidden;">
            <div style="background: #0f1923; padding: 18px; text-align: center;">
                <div style="color: #c9a84c; font-size: 11px; letter-spacing: 3px; text-transform: uppercase;">Mosley Auto</div>
                <div style="color: #ffffff; font-size: 20px; font-weight: 800; margin-top: 4px; letter-spacing: 1px;">VEHICLE REGISTRATION</div>
            </div>
            <div style="padding: 18px;">
                <p style="font-size: 13px; color: #666; margin-top: 0; line-height: 1.5;">Congratulations, <strong>${player.name}</strong>. Your new vehicle has been officially registered to your name and is waiting for you.</p>
                
                <div style="background: #f8f9fa; border-radius: 8px; padding: 14px; margin: 15px 0;">
                    <div style="font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Vehicle Model</div>
                    <div style="font-size: 18px; font-weight: 800; color: #111; text-transform: capitalize;">${model}</div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px dashed #eee; padding-top: 14px;">
                    <div>
                        <div style="font-size: 11px; color: #888; text-transform: uppercase;">Digital Keys</div>
                    </div>
                    <div style="font-size: 13px; font-weight: 800; color: #2d7a2d;">
                        ✓ ADDED TO KEYCHAIN
                    </div>
                </div>
            </div>
        </div>`;

        mp.events.call(
            'server:phone:sendMail', 
            player.data.dbId,           
            'Mosley Auto',              
            `Registration: ${model.toUpperCase()}`,         
            receiptHtml
        );
    },

    // 6. Get List
    getPlayerVehicles: async (playerId) => {
        const [rows] = await db.query("SELECT id, model, plate, parked, fuel FROM server_vehicles WHERE owner_id = ?", [playerId]);
        return rows;
    },

    // 7. Unpark
    unparkVehicle: async (player, dbId) => {
        let existingCar = vehicles.findActiveVehicle(dbId);
        if (existingCar) {
            player.call('showNotification', ['Vehicle System', 'That vehicle is already out!']);
            player.call('client:setWaypoint', [existingCar.position.x, existingCar.position.y]);
            player.call('showNotification', ['Vehicle System', 'GPS set to your vehicle.']);
            existingCar.lastActive = Date.now();
            return null; 
        }

        const [rows] = await db.query("SELECT * FROM server_vehicles WHERE id = ? AND owner_id = ?", [dbId, player.data.dbId]);
        if (rows.length === 0) return false; 
        
        const carData = rows[0];
        const veh = vehicles.spawn(carData); // Will now use the saved heading
        
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