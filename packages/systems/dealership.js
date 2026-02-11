// packages/systems/dealership.js
const db = require('../core/database');
const playerManager = require('../core/playerManager');
const vehicleManager = require('../core/vehicles/vehicleManager');
const banking = require('../core/banking');
const { catalog, DEALERSHIPS } = require('../data/dealershipCatalog');

// Active test drives: playerId -> { timeout, vehicleEntity }
const testDrives = new Map();

// ─── Blips, NPCs & Interaction ColShapes ───
mp.events.add('packagesLoaded', () => {
    for (const [tier, ds] of Object.entries(DEALERSHIPS)) {
        // Blip
        mp.blips.new(225, new mp.Vector3(ds.pos.x, ds.pos.y, ds.pos.z), {
            name: ds.name,
            color: ds.blipColor,
            shortRange: true,
            scale: 0.85
        });

        // NPC Ped
        const npc = ds.npc;
        const ped = mp.peds.new(mp.joaat(npc.model), new mp.Vector3(npc.x, npc.y, npc.z), {
            heading: npc.heading,
            dynamic: false,
            frozen: true,
            invincible: true
        });

        // Interaction colshape (uses the standard interaction system)
        const colshape = mp.colshapes.newSphere(npc.x, npc.y, npc.z, 2.5);
        colshape.setVariable('interaction', {
            title: ds.name,
            text: 'Press E to browse vehicles',
            event: 'server:dealership:open',
            data: tier,
            requireOnFoot: true
        });
    }
});

// ─── Open Dealership ───
mp.events.add('server:dealership:open', (player, tier) => {
    if (!player.logged) return;
    
    const ds = DEALERSHIPS[tier];
    if (!ds) return;

    // Distance check
    const dist = player.dist(new mp.Vector3(ds.pos.x, ds.pos.y, ds.pos.z));
    if (dist > 10) return;

    // Filter catalog for this tier
    const vehicles = catalog
        .filter(v => v.tier === tier)
        .sort((a, b) => a.price - b.price);

    // Get types available
    const types = [...new Set(vehicles.map(v => v.type))].sort();

    // Player info 
    const playerInfo = {
        cash: player.data.money || 0,
        bank: player.data.bank_money || 0,
        vehicleCount: 0,
        vehicleSlots: player.data.vehicle_slots || 3
    };

    // Count owned vehicles
    db.query("SELECT COUNT(*) as cnt FROM server_vehicles WHERE owner_id = ?", [player.data.dbId])
        .then(([rows]) => {
            playerInfo.vehicleCount = rows[0].cnt;

            player.call('client:dealership:open', [
                tier,
                ds.name,
                JSON.stringify(vehicles),
                JSON.stringify(types),
                JSON.stringify(playerInfo),
                JSON.stringify(ds.spawnPos),
                JSON.stringify(ds.camPos),
                JSON.stringify(ds.camLookAt)
            ]);
        });
});

// ─── Preview Vehicle ───
mp.events.add('server:dealership:preview', (player, model, tier) => {
    if (!player.logged) return;
    
    const ds = DEALERSHIPS[tier];
    if (!ds) return;

    // Destroy old preview if exists
    if (player.dealershipPreview && mp.vehicles.exists(player.dealershipPreview)) {
        player.dealershipPreview.destroy();
    }

    const sp = ds.spawnPos;
    const veh = mp.vehicles.new(mp.joaat(model), new mp.Vector3(sp.x, sp.y, sp.z), {
        heading: sp.heading,
        dimension: player.dimension,
        locked: true,
        engine: false
    });

    veh.isDealershipPreview = true;
    player.dealershipPreview = veh;

    // Auto destroy after 60 seconds (safety)
    setTimeout(() => {
        if (mp.vehicles.exists(veh) && veh.isDealershipPreview) {
            veh.destroy();
        }
    }, 60000);
});

// ─── Buy Vehicle ───
mp.events.add('server:dealership:buy', async (player, model, payMethod) => {
    if (!player.logged) return;

    const car = catalog.find(v => v.model === model);
    if (!car) return player.call('showNotification', ['Dealership', 'Vehicle not found.']);

    const ds = DEALERSHIPS[car.tier];
    if (!ds) return;

    // Distance check
    const dist = player.dist(new mp.Vector3(ds.pos.x, ds.pos.y, ds.pos.z));
    if (dist > 15) return player.call('showNotification', ['Dealership', 'You are too far from the dealership.']);

    // Slot check
    const [countRows] = await db.query("SELECT COUNT(*) as cnt FROM server_vehicles WHERE owner_id = ?", [player.data.dbId]);
    const owned = countRows[0].cnt;
    const maxSlots = player.data.vehicle_slots || 3;

    if (owned >= maxSlots) {
        return player.call('showNotification', ['Dealership', `Garage full! (${owned}/${maxSlots}). Sell a vehicle first.`]);
    }

    // Payment
    let success = false;
    if (payMethod === 'bank') {
        const result = await banking.withdraw(player, car.price, `Vehicle Purchase: ${car.name}`);
        if (result.success) {
            success = true;
            // Re-deposit to bank then pay from bank (we already withdrew)
            // Actually, let's just deduct from bank directly
        } else {
            return player.call('showNotification', ['Dealership', `Insufficient bank funds. Need $${car.price.toLocaleString()}.`]);
        }
    } else {
        // Cash payment
        if (player.data.money < car.price) {
            return player.call('showNotification', ['Dealership', `Insufficient cash. Need $${car.price.toLocaleString()}.`]);
        }
        success = await playerManager.removeMoneyAndSave(player, car.price, `Vehicle: ${car.name}`);
    }

    if (!success) {
        return player.call('showNotification', ['Dealership', 'Payment failed.']);
    }

    // Destroy preview
    if (player.dealershipPreview && mp.vehicles.exists(player.dealershipPreview)) {
        player.dealershipPreview.destroy();
        player.dealershipPreview = null;
    }

    // Create vehicle via vehicle manager 
    await vehicleManager.create(player, car.model);

    // Log transaction
    await db.query(
        "INSERT INTO bank_transactions (sender_id, target_id, amount, type, description, created_at) VALUES (?, NULL, ?, 'purchase', ?, NOW())",
        [player.data.dbId, car.price, `Vehicle Purchase: ${car.name} ($${car.price.toLocaleString()})`]
    );

    player.call('client:dealership:close');
    player.call('showNotification', ['Dealership', `You purchased a ${car.name} for $${car.price.toLocaleString()}!`]);
    console.log(`[Dealership] ${player.name} bought ${car.name} ($${car.price}) via ${payMethod}`);
});

// ─── Test Drive ───
mp.events.add('server:dealership:testDrive', async (player, model, tier) => {
    if (!player.logged) return;

    // Check if already on test drive
    if (testDrives.has(player.id)) {
        return player.call('showNotification', ['Dealership', 'You already have a test drive active!']);
    }

    const car = catalog.find(v => v.model === model);
    if (!car) return;

    const ds = DEALERSHIPS[tier];
    if (!ds) return;

    // Distance check
    const dist = player.dist(new mp.Vector3(ds.pos.x, ds.pos.y, ds.pos.z));
    if (dist > 15) return;

    // Destroy preview
    if (player.dealershipPreview && mp.vehicles.exists(player.dealershipPreview)) {
        player.dealershipPreview.destroy();
        player.dealershipPreview = null;
    }

    // Spawn test drive vehicle
    const sp = ds.spawnPos;
    const veh = mp.vehicles.new(mp.joaat(model), new mp.Vector3(sp.x, sp.y, sp.z), {
        heading: sp.heading,
        dimension: 0,
        locked: false,
        engine: false
    });

    veh.isTestDrive = true;
    veh.setVariable('fuel', 100);

    // Put player into car
    setTimeout(() => {
        if (mp.players.exists(player) && mp.vehicles.exists(veh)) {
            player.putIntoVehicle(veh, -1);
        }
    }, 200);

    player.call('client:dealership:close');
    player.call('showNotification', ['Test Drive', `Enjoy your ${car.name}! You have 60 seconds.`]);
    player.call('client:dealership:startTestTimer', [60]);

    // Timer
    const timeout = setTimeout(() => {
        endTestDrive(player);
    }, 60000);

    testDrives.set(player.id, { timeout, vehicle: veh, tier, returnPos: ds.pos });
});

// End Test Drive
function endTestDrive(player) {
    const td = testDrives.get(player.id);
    if (!td) return;

    clearTimeout(td.timeout);
    testDrives.delete(player.id);

    // Destroy vehicle
    if (mp.vehicles.exists(td.vehicle)) {
        // Eject player first
        if (mp.players.exists(player) && player.vehicle === td.vehicle) {
            player.removeFromVehicle();
        }
        td.vehicle.destroy();
    }

    // Teleport back to dealership
    if (mp.players.exists(player)) {
        player.position = new mp.Vector3(td.returnPos.x, td.returnPos.y, td.returnPos.z);
        player.call('showNotification', ['Dealership', 'Test drive over! You have been returned to the dealership.']);
    }
}

// ─── End test drive early ───
mp.events.add('server:dealership:endTestDrive', (player) => {
    endTestDrive(player);
});

// ─── Close / Cleanup ───
mp.events.add('server:dealership:close', (player) => {
    if (player.dealershipPreview && mp.vehicles.exists(player.dealershipPreview)) {
        player.dealershipPreview.destroy();
        player.dealershipPreview = null;
    }
});

// ─── Cleanup on disconnect ───
mp.events.add('playerQuit', (player) => {
    // Cleanup preview
    if (player.dealershipPreview && mp.vehicles.exists(player.dealershipPreview)) {
        player.dealershipPreview.destroy();
    }
    // Cleanup test drive
    endTestDrive(player);
});

// ─── Sell Vehicle ───
mp.events.add('server:dealership:sell', async (player, vehicleDbId) => {
    if (!player.logged) return;

    const [rows] = await db.query("SELECT * FROM server_vehicles WHERE id = ? AND owner_id = ?", [vehicleDbId, player.data.dbId]);
    if (rows.length === 0) return player.call('showNotification', ['Dealership', 'Vehicle not found.']);

    const vehData = rows[0];
    const catalogEntry = catalog.find(v => v.model === vehData.model);
    const sellPrice = catalogEntry ? Math.floor(catalogEntry.price * 0.4) : 1000; // 40% of catalog price

    // Despawn if active
    const activeVeh = vehicleManager.findActiveVehicle(vehicleDbId);
    if (activeVeh) {
        // Check no one is inside
        const occupants = activeVeh.getOccupants();
        if (occupants.length > 0) {
            return player.call('showNotification', ['Dealership', 'Someone is in the vehicle! Remove them first.']);
        }
        if (mp.vehicles.exists(activeVeh)) activeVeh.destroy();
    }

    // Delete from DB
    await db.query("DELETE FROM server_vehicles WHERE id = ?", [vehicleDbId]);

    // Pay player
    await playerManager.addMoneyAndSave(player, sellPrice, `Vehicle Sale: ${vehData.model}`);

    // Log
    await db.query(
        "INSERT INTO bank_transactions (sender_id, target_id, amount, type, description, created_at) VALUES (NULL, ?, ?, 'sale', ?, NOW())",
        [player.data.dbId, sellPrice, `Vehicle Sale: ${vehData.model} (+$${sellPrice.toLocaleString()})`]
    );

    player.call('showNotification', ['Dealership', `Sold your ${vehData.model} for $${sellPrice.toLocaleString()} (cash).`]);
    console.log(`[Dealership] ${player.name} sold ${vehData.model} for $${sellPrice}`);
});

console.log("[Dealership] System loaded.");
