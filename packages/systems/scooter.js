// packages/systems/scooter.js
const PlayerManager = require('../core/playerManager');

const CONFIG = {
    model: 'serv_electricscooter',
    unlockCost: 5,
    costPerMin: 1,
    maxDistance: 100.0,
    autoEndTimeout: 90000,      // 90s idle before auto-end
    graceTime: 30000,           // 30s grace after spawn (don't check idle)
    checkInterval: 10000,       // 10s check interval
    maxSpawnDistance: 30.0       // Max spawn distance from player
};

// Track active rentals: Map<playerDbId, vehicleServerId>
const activeRentals = new Map();

// --- END RIDE ---
async function endRental(scooter, reason = "Ride ended") {
    if (!scooter || !mp.vehicles.exists(scooter)) return;

    const renter = scooter.data.renter;
    const startTime = scooter.data.rentStartTime || Date.now();
    const minutes = Math.max(1, Math.ceil((Date.now() - startTime) / 60000));
    const cost = minutes * CONFIG.costPerMin;

    // Clean up tracking
    if (renter && renter.data && renter.data.dbId) {
        activeRentals.delete(renter.data.dbId);
    }

    scooter.destroy();

    if (renter && mp.players.exists(renter)) {
        await PlayerManager.removeMoneyAndSave(renter, cost, "eScootr Ride");
        renter.call('showNotification', ['eScootr', `${reason}. Charged: $${cost}`]);
        renter.call('client:phone:appCallback', ['scooter', 'endRide']);
    }
}

// ─── SCAN & RENT HANDLER ─────────────────────────────────
mp.events.add('server:phone:scooterAction', async (player, dataJson) => {
    if (!player.logged) return;
    let data;
    try { data = JSON.parse(dataJson); } catch (e) { return; }

    if (data.type === 'scan') {
        // Block inside interiors or vehicles
        if (player.dimension !== 0 || player.vehicle) {
            return player.call('client:phone:proxyResponse', ['scooterAction', { status: 'failed', msg: 'Move outside first' }]);
        }
        // Block if already renting
        if (activeRentals.has(player.data.dbId)) {
            return player.call('client:phone:proxyResponse', ['scooterAction', { status: 'failed', msg: 'You already have a rental' }]);
        }

        const searchDelay = Math.floor(Math.random() * 4000 + 3000); // 3-7s
        setTimeout(() => {
            if (!mp.players.exists(player)) return;
            const batt = Math.floor(Math.random() * 41 + 60);  // 60-100%
            const estDist = Math.floor(Math.random() * 16 + 10); // 10-25m
            player.call('client:phone:proxyResponse', ['scooterAction', { status: 'found', battery: batt, dist: estDist }]);
        }, searchDelay);
    }

    else if (data.type === 'rent') {
        if (activeRentals.has(player.data.dbId)) {
            return player.call('showNotification', ['eScootr', 'You already have an active rental.']);
        }
        if (!player.data.money || player.data.money < CONFIG.unlockCost) {
            return player.call('showNotification', ['eScootr', 'Insufficient funds.']);
        }
        // Ask client to find a safe outdoor spawn position
        player.call('client:phone:findScooterSpawn');
    }

    else if (data.type === 'end') {
        const rentalVehId = activeRentals.get(player.data.dbId);
        let targetScooter = null;

        // 1. Find by tracked ID
        if (rentalVehId !== undefined) {
            mp.vehicles.forEach(v => {
                if (v.id === rentalVehId) targetScooter = v;
            });
        }

        // 2. Fallback: current vehicle or proximity
        if (!targetScooter) {
            if (player.vehicle && player.vehicle.model === mp.joaat(CONFIG.model)
                && player.vehicle.getVariable('owner_id') === player.data.dbId) {
                targetScooter = player.vehicle;
            } else {
                mp.vehicles.forEach(v => {
                    if (!targetScooter && v.model === mp.joaat(CONFIG.model)
                        && v.getVariable('owner_id') === player.data.dbId
                        && v.dist(player.position) < 15) {
                        targetScooter = v;
                    }
                });
            }
        }

        if (targetScooter) endRental(targetScooter, "Ride ended manually");
        else player.call('showNotification', ['eScootr', 'No active rental found nearby.']);
    }
});

// ─── SPAWN HANDLER (called by client after finding position) ──────
mp.events.add('server:scooter:performRent', async (player, spawnDataJson) => {
    if (!player || !mp.players.exists(player)) return;
    if (activeRentals.has(player.data.dbId)) return;

    if (!player.data.money || player.data.money < CONFIG.unlockCost) {
        return player.call('showNotification', ['eScootr', 'Insufficient funds.']);
    }

    const paid = await PlayerManager.removeMoneyAndSave(player, CONFIG.unlockCost, "eScootr Unlock");
    if (!paid) return;

    // Parse spawn position from client
    let pos;
    try {
        pos = (typeof spawnDataJson === 'string') ? JSON.parse(spawnDataJson) : spawnDataJson;
    } catch (e) { /* fallback below */ }

    if (!pos || pos.x === undefined) pos = player.position;

    // Safety: cap distance from player so it doesn't spawn in another postal code
    const dx = pos.x - player.position.x;
    const dy = pos.y - player.position.y;
    if (Math.sqrt(dx * dx + dy * dy) > CONFIG.maxSpawnDistance) {
        const rad = player.heading * (Math.PI / 180);
        pos = {
            x: player.position.x + Math.sin(rad) * 4,
            y: player.position.y - Math.cos(rad) * 4,
            z: player.position.z + 0.3
        };
    }

    const scooter = mp.vehicles.new(mp.joaat(CONFIG.model), new mp.Vector3(pos.x, pos.y, pos.z), {
        heading: player.heading,
        dimension: player.dimension
    });

    const initialBatt = Math.floor(Math.random() * 31 + 70); // 70-100%
    scooter.setVariable('fuel', initialBatt);
    scooter.setVariable('owner_id', player.data.dbId);
    scooter.data.renter = player;
    scooter.data.rentStartTime = Date.now();
    scooter.data.lastActiveTime = Date.now();
    scooter.data.graceUntil = Date.now() + CONFIG.graceTime;

    // Track the rental
    activeRentals.set(player.data.dbId, scooter.id);

    // DO NOT lock — let the player hop on immediately
    scooter.locked = false;

    // Send coordinates to client for blip / marker
    player.call('client:phone:proxyResponse', ['scooterAction', {
        status: 'started',
        x: pos.x, y: pos.y, z: pos.z
    }]);

    player.call('showNotification', ['eScootr', 'Unlocked! Walk to the green marker.']);
    player.call('client:phone:appCallback', ['scooter', 'startRide']);
});

// ─── ANTI-THEFT ───────────────────────────────────────────
mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
    if (vehicle.model !== mp.joaat(CONFIG.model)) return;
    const ownerId = vehicle.getVariable('owner_id');
    if (!ownerId) return;

    if (ownerId !== player.data.dbId) {
        player.call('showNotification', ['eScootr', 'This scooter is rented by someone else.']);
        setTimeout(() => {
            if (mp.players.exists(player) && player.vehicle === vehicle) {
                player.removeFromVehicle();
            }
        }, 100);
    }
});

// ─── PERIODIC HEALTH CHECK ────────────────────────────────
setInterval(() => {
    mp.vehicles.forEach((veh) => {
        if (veh.model !== mp.joaat(CONFIG.model)) return;
        if (!veh.getVariable('owner_id')) return;

        const renter = veh.data.renter;

        // Renter disconnected
        if (!renter || !mp.players.exists(renter)) {
            endRental(veh, "Player disconnected");
            return;
        }

        // Keep it unlocked always
        if (veh.locked) veh.locked = false;

        // Grace period — skip idle/distance checks
        if (veh.data.graceUntil && Date.now() < veh.data.graceUntil) return;

        const driver = veh.getOccupant(0);
        if (driver === renter) {
            // Player is driving — keep activity alive
            veh.data.lastActiveTime = Date.now();
        } else {
            // Player not in the vehicle
            if (veh.dist(renter.position) > CONFIG.maxDistance) {
                endRental(veh, "Scooter too far away");
                return;
            }
            if ((Date.now() - (veh.data.lastActiveTime || 0)) > CONFIG.autoEndTimeout) {
                endRental(veh, "Ride auto-ended (idle)");
                return;
            }
        }
    });
}, CONFIG.checkInterval);

// ─── CLEANUP ON DISCONNECT ────────────────────────────────
mp.events.add('playerQuit', (player) => {
    if (!player.data || !player.data.dbId) return;
    const vehicleId = activeRentals.get(player.data.dbId);
    if (vehicleId !== undefined) {
        let scooter = null;
        mp.vehicles.forEach(v => { if (v.id === vehicleId) scooter = v; });
        if (scooter) endRental(scooter, "Player disconnected");
        else activeRentals.delete(player.data.dbId);
    }
});