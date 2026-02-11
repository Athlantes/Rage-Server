// packages/systems/tuning.js
const db = require('../core/database');
const playerManager = require('../core/playerManager');
const vehicleManager = require('../core/vehicles/vehicleManager');
const inventory = require('./inventory');
const ItemRegistry = require('../data/items');
const { catalog } = require('../data/dealershipCatalog');
const {
    PART_ITEMS,
    PERFORMANCE_MODS,
    PERF_REQUIREMENTS,
    VISUAL_MODS,
    VISUAL_PRICES,
    TUNING_SHOPS,
    PAINT_TYPES,
    PRESET_COLORS,
    COLOR_PRICES,
    WHEEL_TYPES,
    XENON_COLORS,
    PLATE_STYLES,
    NEON_PRESETS,
    SPECIAL_PRICES
} = require('../data/tuningConfig');

// ─── Init: blips, markers, colshapes ───
mp.events.add('packagesLoaded', async () => {

    for (const shop of TUNING_SHOPS) {
        // Blip (wrench icon)
        mp.blips.new(446, new mp.Vector3(shop.pos.x, shop.pos.y, shop.pos.z), {
            name: shop.name,
            color: 47,  // orange
            shortRange: true,
            scale: 0.8
        });

        // Marker (server-side — visible to all until client hides it)
        const m = shop.marker;
        const marker = mp.markers.new(m.type, new mp.Vector3(shop.pos.x, shop.pos.y, shop.pos.z - 0.5), m.scale, {
            color: m.color,
            visible: true,
            dimension: 0
        });
        // Store marker id on the shop config so client can reference it
        shop._markerId = marker.id;

        // Interaction colshape
        const colshape = mp.colshapes.newSphere(shop.pos.x, shop.pos.y, shop.pos.z, 3.0);
        colshape.setVariable('interaction', {
            title: shop.name,
            text: 'Press E to tune your vehicle',
            event: 'server:tuning:open',
            data: shop.id,
            requireVehicle: true,
            requireDriver: true
        });
    }

    console.log(`[Tuning] ${TUNING_SHOPS.length} shops initialized (markers).`);
});

// ─── Apply saved mods when vehicle spawns ───
const originalSpawn = vehicleManager.spawn;
vehicleManager.spawn = function(data) {
    const veh = originalSpawn.call(this, data);
    // Apply mod kit first so setMod works
    try { veh.setModKit(0); } catch(e) {}
    // Load and apply mods async
    applyVehicleMods(veh, data.id);
    return veh;
};

async function applyVehicleMods(veh, vehicleDbId) {
    try {
        const [mods] = await db.query("SELECT mod_type, mod_index FROM vehicle_mods WHERE vehicle_id = ?", [vehicleDbId]);
        if (!mp.vehicles.exists(veh)) return;

        // Separate standard mods from virtual/special mods
        const specialMods = {};
        for (const mod of mods) {
            if (mod.mod_type >= 200) {
                specialMods[mod.mod_type] = mod.mod_index;
            } else {
                try { veh.setMod(mod.mod_type, mod.mod_index); } catch(e) {}
            }
        }

        // Apply wheel type (virtual 200) — must be set before wheel mod takes visual effect
        if (specialMods[200] !== undefined) {
            try { veh.setVariable('wheelType', specialMods[200]); } catch(e) {}
        }

        // Apply plate style (virtual 202)
        if (specialMods[202] !== undefined) {
            try { veh.numberPlateType = specialMods[202]; } catch(e) {}
        }

        // Set shared variables for client-side-only effects
        // Xenon color (virtual 201)
        if (specialMods[201] !== undefined) {
            veh.setVariable('xenonColor', specialMods[201]);
        }

        // Neon enabled bitmask (virtual 203) and neon color packed (virtual 204)
        if (specialMods[203] !== undefined) {
            const bitmask = specialMods[203];
            const packedColor = specialMods[204] || 0;
            const nr = (packedColor >> 16) & 0xFF;
            const ng = (packedColor >> 8) & 0xFF;
            const nb = packedColor & 0xFF;
            veh.setVariable('neonData', JSON.stringify({
                enabled: bitmask,
                color: { r: nr, g: ng, b: nb }
            }));
        }

        // Tyre smoke color packed (virtual 205)
        if (specialMods[205] !== undefined) {
            const packed = specialMods[205];
            const sr = (packed >> 16) & 0xFF;
            const sg = (packed >> 8) & 0xFF;
            const sb = packed & 0xFF;
            veh.setVariable('smokeColor', JSON.stringify({ r: sr, g: sg, b: sb }));
        }
    } catch(e) {
        console.error(`[Tuning] Failed to apply mods for vehicle ${vehicleDbId}:`, e);
    }
}

// ─── Helper: Get vehicle grade from catalog ───
function getVehicleGrade(model) {
    const entry = catalog.find(v => v.model === model);
    return entry ? entry.grade : 'E'; // Default E if unknown
}

// ─── Helper: Count item in player's inventory ───
function countPlayerItem(player, itemId) {
    if (!player.inventory) return 0;
    return player.inventory
        .filter(i => i.itemId === itemId)
        .reduce((sum, i) => sum + i.count, 0);
}

// ─── Helper: Remove X amount of item from inventory ───
async function removePlayerItems(player, itemId, amount) {
    if (!player.inventory) return false;
    let remaining = amount;
    const stacks = player.inventory.filter(i => i.itemId === itemId).sort((a, b) => a.count - b.count);

    for (const stack of stacks) {
        if (remaining <= 0) break;
        if (stack.count <= remaining) {
            remaining -= stack.count;
            await db.query('DELETE FROM character_inventory WHERE id = ?', [stack.id]);
            player.inventory = player.inventory.filter(i => i !== stack);
        } else {
            stack.count -= remaining;
            remaining = 0;
            await db.query('UPDATE character_inventory SET count = ? WHERE id = ?', [stack.count, stack.id]);
        }
    }
    // Sync client inventory
    inventory.syncClient(player);
    return remaining <= 0;
}

// ─── Open Tuning Menu ───
mp.events.add('server:tuning:open', async (player, shopId) => {
    if (!player.logged) return;
    if (!player.vehicle) return player.call('showNotification', ['Tuning', 'You need to be in a vehicle!']);

    const veh = player.vehicle;
    if (!veh.dbId) return player.call('showNotification', ['Tuning', 'This vehicle cannot be tuned.']);
    if (veh.ownerId !== player.data.dbId) return player.call('showNotification', ['Tuning', 'You can only tune your own vehicle!']);

    // Ensure mod kit is activated
    try { veh.setModKit(0); } catch(e) {}

    // Move to private dimension so other players don't interfere
    player._tuningOrigDimension = player.dimension;
    const privateDim = player.id + 10000;
    player.dimension = privateDim;
    veh.dimension = privateDim;

    // Tell client which shop marker to hide
    player.call('client:tuning:hideMarker', [shopId]);

    await sendTuningData(player);
});

// ─── Send/Refresh tuning data to client ───
async function sendTuningData(player) {
    const veh = player.vehicle;
    if (!veh || !veh.dbId) return;

    const modelName = getModelName(veh);
    const grade = getVehicleGrade(modelName);

    // Get currently installed mods from DB
    const [installedMods] = await db.query("SELECT mod_type, mod_index FROM vehicle_mods WHERE vehicle_id = ?", [veh.dbId]);
    const modsMap = {};
    for (const m of installedMods) {
        modsMap[m.mod_type] = m.mod_index;
    }

    // Build performance data with current stages + next upgrade requirements
    const perfData = {};
    for (const [key, modInfo] of Object.entries(PERFORMANCE_MODS)) {
        const currentModIndex = modsMap[modInfo.modType] !== undefined ? modsMap[modInfo.modType] : -1;
        const currentStage = currentModIndex + 1;
        const reqs = PERF_REQUIREMENTS[grade] ? PERF_REQUIREMENTS[grade][key] : null;
        const nextReq = reqs ? reqs.find(r => r.stage === currentStage + 1) : null;

        let playerParts = 0;
        if (nextReq) {
            const partItemId = PART_ITEMS[nextReq.partType];
            playerParts = countPlayerItem(player, partItemId);
        }

        perfData[key] = {
            name: modInfo.name,
            icon: modInfo.icon,
            maxStage: modInfo.maxStage,
            currentStage,
            descriptions: modInfo.description,
            nextReq: nextReq ? {
                stage: nextReq.stage,
                money: nextReq.money,
                partType: nextReq.partType,
                partAmount: nextReq.partAmount,
                partName: ItemRegistry[PART_ITEMS[nextReq.partType]].name,
                playerHas: playerParts
            } : null
        };
    }

    const vPricing = VISUAL_PRICES[grade] || VISUAL_PRICES['E'];
    const cPricing = COLOR_PRICES[grade] || COLOR_PRICES['E'];

    // Get current vehicle color data
    const [vehRows] = await db.query("SELECT color FROM server_vehicles WHERE id = ?", [veh.dbId]);
    let colorData = { primRGB: {r:0,g:0,b:0}, secRGB: {r:0,g:0,b:0}, paintType: 0 };
    if (vehRows.length > 0 && vehRows[0].color) {
        try {
            const parsed = JSON.parse(vehRows[0].color);
            if (parsed.primRGB) colorData = parsed;
        } catch(e) {}
    }

    const playerInfo = {
        cash: player.data.money || 0,
        grade
    };

    // Build special mods data (wheels, xenon, plate, neon, smoke)
    const specialCurrent = {
        wheelType: modsMap[200] !== undefined ? modsMap[200] : 0,
        wheelIndex: modsMap[23] !== undefined ? modsMap[23] : -1,
        xenonEnabled: modsMap[22] !== undefined && modsMap[22] >= 0,
        xenonColor: modsMap[201] !== undefined ? modsMap[201] : -1,
        plateStyle: modsMap[202] !== undefined ? modsMap[202] : 0,
        neonEnabled: modsMap[203] !== undefined ? modsMap[203] : 0,
        neonColor: modsMap[204] !== undefined ? {
            r: (modsMap[204] >> 16) & 0xFF,
            g: (modsMap[204] >> 8) & 0xFF,
            b: modsMap[204] & 0xFF
        } : { r: 255, g: 255, b: 255 },
        smokeEnabled: modsMap[20] !== undefined && modsMap[20] >= 0,
        smokeColor: modsMap[205] !== undefined ? {
            r: (modsMap[205] >> 16) & 0xFF,
            g: (modsMap[205] >> 8) & 0xFF,
            b: modsMap[205] & 0xFF
        } : { r: 255, g: 255, b: 255 }
    };

    const specialData = {
        config: {
            wheelTypes: WHEEL_TYPES,
            xenonColors: XENON_COLORS,
            plateStyles: PLATE_STYLES,
            neonPresets: NEON_PRESETS,
            prices: SPECIAL_PRICES[grade] || SPECIAL_PRICES['E']
        },
        current: specialCurrent
    };

    player.call('client:tuning:open', [
        JSON.stringify(perfData),
        JSON.stringify(VISUAL_MODS),
        JSON.stringify(vPricing),
        JSON.stringify(playerInfo),
        JSON.stringify(modsMap),
        veh.dbId,
        JSON.stringify(PAINT_TYPES),
        JSON.stringify(PRESET_COLORS),
        JSON.stringify(cPricing),
        JSON.stringify(colorData),
        JSON.stringify(specialData)
    ]);
}

// ─── Get model name from vehicle hash ───
function getModelName(veh) {
    // Find in catalog by matching hash
    for (const entry of catalog) {
        if (mp.joaat(entry.model) === veh.model) return entry.model;
    }
    return 'unknown';
}

// ─── Performance Upgrade ───
mp.events.add('server:tuning:perfUpgrade', async (player, modKey) => {
    if (!player.logged || !player.vehicle) return;

    const veh = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) {
        return player.call('showNotification', ['Tuning', 'You can only tune your own vehicle!']);
    }

    const modInfo = PERFORMANCE_MODS[modKey];
    if (!modInfo) return;

    const modelName = getModelName(veh);
    const grade = getVehicleGrade(modelName);

    // Get current stage
    const [rows] = await db.query("SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = ?", [veh.dbId, modInfo.modType]);
    const currentModIndex = rows.length > 0 ? rows[0].mod_index : -1;
    const currentStage = currentModIndex + 1;

    // Check if maxed
    if (currentStage >= modInfo.maxStage) {
        return player.call('showNotification', ['Tuning', `${modInfo.name} is fully upgraded!`]);
    }

    // Get requirements for next stage
    const reqs = PERF_REQUIREMENTS[grade] ? PERF_REQUIREMENTS[grade][modKey] : null;
    if (!reqs) return player.call('showNotification', ['Tuning', 'No upgrades available for this class.']);

    const nextReq = reqs.find(r => r.stage === currentStage + 1);
    if (!nextReq) return player.call('showNotification', ['Tuning', 'Upgrade not available.']);

    // Check money
    if (player.data.money < nextReq.money) {
        return player.call('showNotification', ['Tuning', `Insufficient cash! Need $${nextReq.money.toLocaleString()}.`]);
    }

    // Check parts
    const partItemId = PART_ITEMS[nextReq.partType];
    const playerPartCount = countPlayerItem(player, partItemId);
    if (playerPartCount < nextReq.partAmount) {
        const partName = ItemRegistry[partItemId].name;
        return player.call('showNotification', ['Tuning', `Need ${nextReq.partAmount}x ${partName} (have ${playerPartCount}).`]);
    }

    // Deduct money
    const moneyOk = await playerManager.removeMoneyAndSave(player, nextReq.money, `Tuning: ${modInfo.name} Stage ${nextReq.stage}`);
    if (!moneyOk) return player.call('showNotification', ['Tuning', 'Payment failed.']);

    // Deduct parts
    await removePlayerItems(player, partItemId, nextReq.partAmount);

    // Apply mod
    const newModIndex = currentStage; // stage 1 = modIndex 0
    try { veh.setMod(modInfo.modType, newModIndex); } catch(e) {}

    // Save to DB
    await db.query(
        "INSERT INTO vehicle_mods (vehicle_id, mod_type, mod_index) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE mod_index = ?",
        [veh.dbId, modInfo.modType, newModIndex, newModIndex]
    );

    player.call('showNotification', ['Tuning', `${modInfo.name} upgraded to Stage ${nextReq.stage}!`]);

    // Refresh UI with updated data
    await sendTuningData(player);
    console.log(`[Tuning] ${player.name} upgraded ${modInfo.name} to Stage ${nextReq.stage} on vehicle #${veh.dbId}`);
});

// ─── Visual Mod Upgrade ───
mp.events.add('server:tuning:visualMod', async (player, modTypeStr, modIndexStr) => {
    if (!player.logged || !player.vehicle) return;

    const veh = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) {
        return player.call('showNotification', ['Tuning', 'You can only tune your own vehicle!']);
    }

    const modType = parseInt(modTypeStr);
    const modIndex = parseInt(modIndexStr);

    // Validate mod type is a visual mod
    const isVisual = Object.values(VISUAL_MODS).some(v => v.modType === modType);
    if (!isVisual) return;

    const modelName = getModelName(veh);
    const grade = getVehicleGrade(modelName);

    // Calculate price
    const pricing = VISUAL_PRICES[grade] || VISUAL_PRICES['E'];
    const price = modIndex === -1 ? 0 : pricing.base + (modIndex * pricing.perMod); // -1 = stock (free to revert)

    if (price > 0) {
        if (player.data.money < price) {
            return player.call('showNotification', ['Tuning', `Insufficient cash! Need $${price.toLocaleString()}.`]);
        }

        const moneyOk = await playerManager.removeMoneyAndSave(player, price, `Tuning: Visual mod type ${modType}`);
        if (!moneyOk) return player.call('showNotification', ['Tuning', 'Payment failed.']);
    }

    // Apply mod
    try { veh.setMod(modType, modIndex); } catch(e) {}

    // Save to DB
    if (modIndex === -1) {
        await db.query("DELETE FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = ?", [veh.dbId, modType]);
    } else {
        await db.query(
            "INSERT INTO vehicle_mods (vehicle_id, mod_type, mod_index) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE mod_index = ?",
            [veh.dbId, modType, modIndex, modIndex]
        );
    }

    const priceText = price > 0 ? ` for $${price.toLocaleString()}` : '';
    player.call('showNotification', ['Tuning', `Visual mod applied${priceText}!`]);

    // Update player cash in UI
    player.call('client:tuning:updateCash', [player.data.money || 0]);

    // Confirm to client so it updates its original state (no revert needed for this mod)
    player.call('client:tuning:modConfirmed', [modType, modIndex]);
    console.log(`[Tuning] ${player.name} applied visual mod type:${modType} index:${modIndex} on vehicle #${veh.dbId}`);
});

// ─── Close Tuning ───
mp.events.add('server:tuning:close', (player) => {
    // Restore original dimension
    const origDim = player._tuningOrigDimension !== undefined ? player._tuningOrigDimension : 0;
    player.dimension = origDim;
    if (player.vehicle) player.vehicle.dimension = origDim;
    delete player._tuningOrigDimension;

    // Tell client to show markers again
    player.call('client:tuning:showMarkers');
});

// ─── Apply Color ───
mp.events.add('server:tuning:applyColor', async (player, colorDataJson) => {
    if (!player.logged || !player.vehicle) return;

    const veh = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) {
        return player.call('showNotification', ['Tuning', 'You can only tune your own vehicle!']);
    }

    let colorReq;
    try { colorReq = JSON.parse(colorDataJson); } catch(e) { return; }

    // colorReq = { primRGB: {r,g,b}, secRGB: {r,g,b}, paintType: 0, cost: 500, type: 'preset'|'custom'|'paintType' }

    const modelName = getModelName(veh);
    const grade = getVehicleGrade(modelName);
    const pricing = COLOR_PRICES[grade] || COLOR_PRICES['E'];

    // Determine cost based on what changed
    let cost = 0;
    if (colorReq.type === 'preset') cost = pricing.preset;
    else if (colorReq.type === 'custom') cost = pricing.custom;
    else if (colorReq.type === 'paintType') cost = pricing.paintType;

    if (cost > 0) {
        if (player.data.money < cost) {
            return player.call('showNotification', ['Tuning', `Insufficient cash! Need $${cost.toLocaleString()}.`]);
        }
        const moneyOk = await playerManager.removeMoneyAndSave(player, cost, `Tuning: Color change (${colorReq.type})`);
        if (!moneyOk) return player.call('showNotification', ['Tuning', 'Payment failed.']);
    }

    // Build color JSON
    const colorJson = JSON.stringify({
        primRGB: colorReq.primRGB,
        secRGB: colorReq.secRGB,
        paintType: colorReq.paintType
    });

    // Save to DB
    await db.query("UPDATE server_vehicles SET color = ? WHERE id = ?", [colorJson, veh.dbId]);

    // Apply to vehicle via RGB
    try {
        veh.setColorRGB(
            colorReq.primRGB.r, colorReq.primRGB.g, colorReq.primRGB.b,
            colorReq.secRGB.r, colorReq.secRGB.g, colorReq.secRGB.b
        );
        // Store paint type as shared variable for client-side application
        veh.setVariable('paintType', colorReq.paintType || 0);
    } catch(e) {}

    const costText = cost > 0 ? ` for $${cost.toLocaleString()}` : '';
    player.call('showNotification', ['Tuning', `Color applied${costText}!`]);

    // Update cash in UI
    player.call('client:tuning:updateCash', [player.data.money || 0]);

    // Tell client to apply paint type + confirm color saved
    player.call('client:tuning:applyPaintType', [colorReq.paintType]);
    player.call('client:tuning:colorConfirmed', [
        JSON.stringify({ primRGB: colorReq.primRGB, secRGB: colorReq.secRGB, paintType: colorReq.paintType })
    ]);

    console.log(`[Tuning] ${player.name} changed color on vehicle #${veh.dbId} (type: ${colorReq.type})`);
});

// ═══ SPECIAL MODS ═══

// Helper: save a virtual mod to DB
async function saveVirtualMod(vehicleDbId, modType, modIndex) {
    await db.query(
        "INSERT INTO vehicle_mods (vehicle_id, mod_type, mod_index) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE mod_index = ?",
        [vehicleDbId, modType, modIndex, modIndex]
    );
}

// ─── Apply Wheels (wheel type + wheel index) ───
mp.events.add('server:tuning:applyWheels', async (player, wheelTypeStr, wheelIndexStr) => {
    if (!player.logged || !player.vehicle) return;
    const veh = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) return;

    const wheelType = parseInt(wheelTypeStr);
    const wheelIndex = parseInt(wheelIndexStr);

    const modelName = getModelName(veh);
    const grade = getVehicleGrade(modelName);
    const prices = SPECIAL_PRICES[grade] || SPECIAL_PRICES['E'];
    const price = wheelIndex === -1 ? 0 : prices.wheels;

    if (price > 0) {
        if (player.data.money < price) return player.call('showNotification', ['Tuning', `Insufficient cash! Need $${price.toLocaleString()}.`]);
        const ok = await playerManager.removeMoneyAndSave(player, price, `Tuning: Wheels`);
        if (!ok) return player.call('showNotification', ['Tuning', 'Payment failed.']);
    }

    // Save wheel type (virtual 200) and wheel mod (23)
    await saveVirtualMod(veh.dbId, 200, wheelType);
    if (wheelIndex === -1) {
        await db.query("DELETE FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = 23", [veh.dbId]);
    } else {
        await saveVirtualMod(veh.dbId, 23, wheelIndex);
    }

    try { veh.setMod(23, wheelIndex); } catch(e) {}
    veh.setVariable('wheelType', wheelType);

    player.call('showNotification', ['Tuning', price > 0 ? `Wheels applied for $${price.toLocaleString()}!` : 'Wheels reverted to stock.']);
    player.call('client:tuning:updateCash', [player.data.money || 0]);
    player.call('client:tuning:specialConfirmed', ['wheels', JSON.stringify({ wheelType, wheelIndex })]);
    console.log(`[Tuning] ${player.name} applied wheels type:${wheelType} index:${wheelIndex} on vehicle #${veh.dbId}`);
});

// ─── Apply Xenon Headlights (toggle + color) ───
mp.events.add('server:tuning:applyXenon', async (player, enabledStr, colorIdStr) => {
    if (!player.logged || !player.vehicle) return;
    const veh = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) return;

    const enabled = enabledStr === 'true';
    const colorId = parseInt(colorIdStr);

    const modelName = getModelName(veh);
    const grade = getVehicleGrade(modelName);
    const prices = SPECIAL_PRICES[grade] || SPECIAL_PRICES['E'];

    // Check current state to determine price
    const [rows] = await db.query("SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = 22", [veh.dbId]);
    const wasEnabled = rows.length > 0 && rows[0].mod_index >= 0;
    const [colorRows] = await db.query("SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = 201", [veh.dbId]);
    const oldColor = colorRows.length > 0 ? colorRows[0].mod_index : -1;

    let price = 0;
    if (enabled && !wasEnabled) price += prices.xenon;
    if (enabled && colorId !== oldColor) price += prices.xenonColor;

    if (price > 0) {
        if (player.data.money < price) return player.call('showNotification', ['Tuning', `Insufficient cash! Need $${price.toLocaleString()}.`]);
        const ok = await playerManager.removeMoneyAndSave(player, price, `Tuning: Xenon headlights`);
        if (!ok) return player.call('showNotification', ['Tuning', 'Payment failed.']);
    }

    // Save xenon toggle (mod 22) and color (virtual 201)
    if (enabled) {
        await saveVirtualMod(veh.dbId, 22, 0);
        await saveVirtualMod(veh.dbId, 201, colorId);
        try { veh.setMod(22, 0); } catch(e) {}
        veh.setVariable('xenonColor', colorId);
    } else {
        await db.query("DELETE FROM vehicle_mods WHERE vehicle_id = ? AND mod_type IN (22, 201)", [veh.dbId]);
        try { veh.setMod(22, -1); } catch(e) {}
        veh.setVariable('xenonColor', -1);
    }

    player.call('showNotification', ['Tuning', enabled ? `Xenon headlights applied${price > 0 ? ' for $' + price.toLocaleString() : ''}!` : 'Xenon headlights removed.']);
    player.call('client:tuning:updateCash', [player.data.money || 0]);
    player.call('client:tuning:specialConfirmed', ['xenon', JSON.stringify({ enabled, colorId })]);
    console.log(`[Tuning] ${player.name} set xenon enabled:${enabled} color:${colorId} on vehicle #${veh.dbId}`);
});

// ─── Apply Plate Style ───
mp.events.add('server:tuning:applyPlate', async (player, plateIdStr) => {
    if (!player.logged || !player.vehicle) return;
    const veh = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) return;

    const plateId = parseInt(plateIdStr);

    const modelName = getModelName(veh);
    const grade = getVehicleGrade(modelName);
    const prices = SPECIAL_PRICES[grade] || SPECIAL_PRICES['E'];

    // Check current
    const [rows] = await db.query("SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = 202", [veh.dbId]);
    const currentPlate = rows.length > 0 ? rows[0].mod_index : 0;

    if (plateId === currentPlate) return player.call('showNotification', ['Tuning', 'Already using this plate style.']);

    const price = prices.plate;
    if (player.data.money < price) return player.call('showNotification', ['Tuning', `Insufficient cash! Need $${price.toLocaleString()}.`]);

    const ok = await playerManager.removeMoneyAndSave(player, price, `Tuning: Plate style`);
    if (!ok) return player.call('showNotification', ['Tuning', 'Payment failed.']);

    await saveVirtualMod(veh.dbId, 202, plateId);
    try { veh.numberPlateType = plateId; } catch(e) {}

    player.call('showNotification', ['Tuning', `Plate style changed for $${price.toLocaleString()}!`]);
    player.call('client:tuning:updateCash', [player.data.money || 0]);
    player.call('client:tuning:specialConfirmed', ['plate', JSON.stringify({ plateStyle: plateId })]);
    console.log(`[Tuning] ${player.name} set plate style ${plateId} on vehicle #${veh.dbId}`);
});

// ─── Apply Neon Lights (bitmask + color) ───
mp.events.add('server:tuning:applyNeon', async (player, bitmaskStr, rStr, gStr, bStr) => {
    if (!player.logged || !player.vehicle) return;
    const veh = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) return;

    const bitmask = parseInt(bitmaskStr);
    const r = parseInt(rStr), g = parseInt(gStr), b = parseInt(bStr);

    const modelName = getModelName(veh);
    const grade = getVehicleGrade(modelName);
    const prices = SPECIAL_PRICES[grade] || SPECIAL_PRICES['E'];

    // Check current state
    const [rows] = await db.query("SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = 203", [veh.dbId]);
    const oldMask = rows.length > 0 ? rows[0].mod_index : 0;
    const [colorRows] = await db.query("SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = 204", [veh.dbId]);
    const oldPacked = colorRows.length > 0 ? colorRows[0].mod_index : 0;
    const newPacked = (r << 16) | (g << 8) | b;

    let price = 0;
    if (bitmask !== oldMask) price += prices.neon;
    if (bitmask > 0 && newPacked !== oldPacked) price += prices.neonColor;

    if (price > 0) {
        if (player.data.money < price) return player.call('showNotification', ['Tuning', `Insufficient cash! Need $${price.toLocaleString()}.`]);
        const ok = await playerManager.removeMoneyAndSave(player, price, `Tuning: Neon lights`);
        if (!ok) return player.call('showNotification', ['Tuning', 'Payment failed.']);
    }

    // Save
    await saveVirtualMod(veh.dbId, 203, bitmask);
    if (bitmask > 0) {
        await saveVirtualMod(veh.dbId, 204, newPacked);
    }

    // Set shared variable for client
    veh.setVariable('neonData', JSON.stringify({
        enabled: bitmask,
        color: { r, g, b }
    }));

    player.call('showNotification', ['Tuning', bitmask > 0 ? `Neon lights applied${price > 0 ? ' for $' + price.toLocaleString() : ''}!` : 'Neon lights removed.']);
    player.call('client:tuning:updateCash', [player.data.money || 0]);
    player.call('client:tuning:specialConfirmed', ['neon', JSON.stringify({ bitmask, color: { r, g, b } })]);
    console.log(`[Tuning] ${player.name} set neon mask:${bitmask} color:${r},${g},${b} on vehicle #${veh.dbId}`);
});

// ─── Apply Tyre Smoke (toggle + color) ───
mp.events.add('server:tuning:applySmoke', async (player, enabledStr, rStr, gStr, bStr) => {
    if (!player.logged || !player.vehicle) return;
    const veh = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) return;

    const enabled = enabledStr === 'true';
    const r = parseInt(rStr), g = parseInt(gStr), b = parseInt(bStr);

    const modelName = getModelName(veh);
    const grade = getVehicleGrade(modelName);
    const prices = SPECIAL_PRICES[grade] || SPECIAL_PRICES['E'];

    // Check current state
    const [rows] = await db.query("SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = 20", [veh.dbId]);
    const wasEnabled = rows.length > 0 && rows[0].mod_index >= 0;
    const [colorRows] = await db.query("SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = 205", [veh.dbId]);
    const oldPacked = colorRows.length > 0 ? colorRows[0].mod_index : 0;
    const newPacked = (r << 16) | (g << 8) | b;

    let price = 0;
    if (enabled && !wasEnabled) price += prices.smoke;
    if (enabled && newPacked !== oldPacked) price += prices.smokeColor;

    if (price > 0) {
        if (player.data.money < price) return player.call('showNotification', ['Tuning', `Insufficient cash! Need $${price.toLocaleString()}.`]);
        const ok = await playerManager.removeMoneyAndSave(player, price, `Tuning: Tyre smoke`);
        if (!ok) return player.call('showNotification', ['Tuning', 'Payment failed.']);
    }

    if (enabled) {
        await saveVirtualMod(veh.dbId, 20, 1);
        await saveVirtualMod(veh.dbId, 205, newPacked);
        try { veh.setMod(20, 1); } catch(e) {}
        veh.setVariable('smokeColor', JSON.stringify({ r, g, b }));
    } else {
        await db.query("DELETE FROM vehicle_mods WHERE vehicle_id = ? AND mod_type IN (20, 205)", [veh.dbId]);
        try { veh.setMod(20, -1); } catch(e) {}
        veh.setVariable('smokeColor', null);
    }

    player.call('showNotification', ['Tuning', enabled ? `Tyre smoke applied${price > 0 ? ' for $' + price.toLocaleString() : ''}!` : 'Tyre smoke removed.']);
    player.call('client:tuning:updateCash', [player.data.money || 0]);
    player.call('client:tuning:specialConfirmed', ['smoke', JSON.stringify({ enabled, color: { r, g, b } })]);
    console.log(`[Tuning] ${player.name} set smoke enabled:${enabled} color:${r},${g},${b} on vehicle #${veh.dbId}`);
});

console.log("[Tuning] System loaded.");

// ═══ BATCH CART PURCHASE ═══
mp.events.add('server:tuning:cartPurchase', async (player, cartJson) => {
    try {
        if (!player.logged || !player.vehicle) return;

        const veh = player.vehicle;
        if (!veh.dbId || veh.ownerId !== player.data.dbId) {
            return player.call('showNotification', ['Tuning', 'You can only tune your own vehicle!']);
        }

        let cart;
        try { cart = JSON.parse(cartJson); } catch(e) { return; }
        if (!Array.isArray(cart) || cart.length === 0) return;

        // Calculate total price
        let total = 0;
        for (const item of cart) total += (item.price || 0);

        // Validate funds
        if (total > 0) {
            if (player.data.money < total) {
                return player.call('showNotification', ['Tuning', `Insufficient cash! Need $${total.toLocaleString()}.`]);
            }
            const ok = await playerManager.removeMoneyAndSave(player, total, `Tuning: Cart purchase (${cart.length} items)`);
            if (!ok) return player.call('showNotification', ['Tuning', 'Payment failed.']);
        }

        // Process each item
        const results = [];
        for (const item of cart) {
            try {
                if (item.type === 'visual') {
                    const mt = parseInt(item.params.modType);
                    const mi = parseInt(item.params.modIndex);
                    try { veh.setMod(mt, mi); } catch(e) {}
                    if (mi === -1) {
                        await db.query("DELETE FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = ?", [veh.dbId, mt]);
                    } else {
                        await saveVirtualMod(veh.dbId, mt, mi);
                    }
                    results.push(item);

                } else if (item.type === 'wheels') {
                    const wt = parseInt(item.params.wheelType);
                    const wi = parseInt(item.params.wheelIndex);
                    try { veh.setMod(23, wi); } catch(e) {}
                    await saveVirtualMod(veh.dbId, 200, wt);
                    if (wi === -1) {
                        await db.query("DELETE FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = 23", [veh.dbId]);
                    } else {
                        await saveVirtualMod(veh.dbId, 23, wi);
                    }
                    veh.setVariable('wheelType', wt);
                    results.push(item);

                } else if (item.type === 'xenon') {
                    const enabled = !!item.params.enabled;
                    const colorId = parseInt(item.params.colorId || -1);
                    if (enabled) {
                        try { veh.setMod(22, 0); } catch(e) {}
                        await saveVirtualMod(veh.dbId, 22, 0);
                        await saveVirtualMod(veh.dbId, 201, colorId);
                        veh.setVariable('xenonColor', colorId);
                    } else {
                        try { veh.setMod(22, -1); } catch(e) {}
                        await db.query("DELETE FROM vehicle_mods WHERE vehicle_id = ? AND mod_type IN (22, 201)", [veh.dbId]);
                        veh.setVariable('xenonColor', -1);
                    }
                    results.push(item);

                } else if (item.type === 'plate') {
                    const plateId = parseInt(item.params.plateStyle);
                    try { veh.numberPlateType = plateId; } catch(e) {}
                    await saveVirtualMod(veh.dbId, 202, plateId);
                    results.push(item);

                } else if (item.type === 'neon') {
                    const bitmask = parseInt(item.params.bitmask || 0);
                    const r = parseInt(item.params.r || 255);
                    const g = parseInt(item.params.g || 255);
                    const b = parseInt(item.params.b || 255);
                    await saveVirtualMod(veh.dbId, 203, bitmask);
                    if (bitmask > 0) {
                        const packed = (r << 16) | (g << 8) | b;
                        await saveVirtualMod(veh.dbId, 204, packed);
                    }
                    veh.setVariable('neonData', JSON.stringify({ enabled: bitmask, color: { r, g, b } }));
                    results.push(item);

                } else if (item.type === 'smoke') {
                    const enabled = !!item.params.enabled;
                    const r = parseInt(item.params.r || 255);
                    const g = parseInt(item.params.g || 255);
                    const b = parseInt(item.params.b || 255);
                    if (enabled) {
                        try { veh.setMod(20, 1); } catch(e) {}
                        await saveVirtualMod(veh.dbId, 20, 1);
                        const packed = (r << 16) | (g << 8) | b;
                        await saveVirtualMod(veh.dbId, 205, packed);
                        veh.setVariable('smokeColor', JSON.stringify({ r, g, b }));
                    } else {
                        try { veh.setMod(20, -1); } catch(e) {}
                        await db.query("DELETE FROM vehicle_mods WHERE vehicle_id = ? AND mod_type IN (20, 205)", [veh.dbId]);
                        veh.setVariable('smokeColor', null);
                    }
                    results.push(item);

                } else if (item.type === 'color' || item.type === 'finish') {
                    const p = item.params;
                    const primRGB = p.primRGB || { r: 0, g: 0, b: 0 };
                    const secRGB = p.secRGB || { r: 0, g: 0, b: 0 };
                    const paintType = p.paintType !== undefined ? p.paintType : 0;

                    try {
                        veh.setColorRGB(
                            primRGB.r, primRGB.g, primRGB.b,
                            secRGB.r, secRGB.g, secRGB.b
                        );
                        veh.setVariable('paintType', paintType);
                    } catch(e) {}

                    // Save color to DB
                    const colorJson = JSON.stringify({ primRGB, secRGB, paintType });
                    await db.query("UPDATE server_vehicles SET color = ? WHERE id = ?", [colorJson, veh.dbId]);

                    // Tell client to apply paint type
                    player.call('client:tuning:applyPaintType', [paintType]);

                    item.resultColor = { primRGB, secRGB, paintType };
                    results.push(item);
                }
            } catch(e) {
                console.log(`[Tuning] Cart item error (${item.type}):`, e);
            }
        }

        // Confirm to client
        player.call('client:tuning:cartConfirmed', [JSON.stringify(results)]);

        // Update cash display
        player.call('client:tuning:updateCash', [player.data.money || 0]);

        const totalText = total > 0 ? ` for $${total.toLocaleString()}` : '';
        player.call('showNotification', ['Tuning', `Cart purchased (${results.length} items)${totalText}!`]);
        console.log(`[Tuning] ${player.name} cart purchase: ${results.length} items, $${total} on vehicle #${veh.dbId}`);

    } catch(e) {
        console.log('[Tuning] Cart purchase error:', e);
    }
});
