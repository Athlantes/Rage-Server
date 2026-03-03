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
    PERF_GROUP_LABELS,
    PERF_GROUP_ORDER,
    PI_CONFIG,
    VARIANT_BRANDS,
    TENDENCY_LABELS,
    calcAllHandling,
    calcBuildTendency,
    calcUpgradeReq,
    calcPI,
    getPIClass,
    VISUAL_MODS,
    VISUAL_PRICES,
    TUNING_SHOPS,
    PAINT_TYPES,
    PRESET_COLORS,
    PEARLESCENT_COLORS,
    COLOR_PRICES,
    WHEEL_TYPES,
    WHEEL_COLORS,
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
        const [mods] = await db.query("SELECT mod_type, mod_index, variant, slider_data FROM vehicle_mods WHERE vehicle_id = ?", [vehicleDbId]);
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

        // Compute suspension height from performance slider data and sync as variable
        try {
            const modTypeToKey = {};
            for (const [key, m] of Object.entries(PERFORMANCE_MODS)) modTypeToKey[m.modType] = key;
            const stages = {}, variants = {}, sliderData = {};
            for (const catKey of Object.keys(PERFORMANCE_MODS)) { stages[catKey] = 0; }
            for (const mod of mods) {
                const catKey = modTypeToKey[mod.mod_type];
                if (catKey) {
                    stages[catKey] = mod.mod_index + 1;
                    if (mod.variant) variants[catKey] = mod.variant;
                    if (mod.slider_data) { try { sliderData[catKey] = JSON.parse(mod.slider_data); } catch(e) {} }
                }
            }
            const spawnMults = calcAllHandling(stages, variants, sliderData);
            const suspH = (spawnMults.fSuspensionRaise || 1.0) - 1.0;
            if (Math.abs(suspH) > 0.001) {
                veh.setVariable('suspensionHeight', suspH);
            }
        } catch(e) {}

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

        // Stance data (virtual 206 = camber, 207 = trackWidth as packed int)
        if (specialMods[206] !== undefined || specialMods[207] !== undefined) {
            const camber = specialMods[206] !== undefined ? (specialMods[206] - 10000) / 10000 : 0;
            const trackWidth = specialMods[207] !== undefined ? (specialMods[207] - 10000) / 10000 : 0;
            veh.setVariable('stanceData', JSON.stringify({ camber, trackWidth }));
        }

        // Wheel color (virtual 208) — convert array index to GTA color index
        if (specialMods[208] !== undefined) {
            const wcIdx = specialMods[208];
            const wcGta = WHEEL_COLORS[wcIdx] ? WHEEL_COLORS[wcIdx].gtaIndex : -1;
            veh.setVariable('wheelColor', wcGta);
        }

        // Pearlescent color (virtual 209)
        if (specialMods[209] !== undefined) {
            veh.setVariable('pearlColor', specialMods[209]);
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

    // Get installed mods with variant + slider data
    const [installedMods] = await db.query(
        "SELECT mod_type, mod_index, variant, slider_data FROM vehicle_mods WHERE vehicle_id = ?",
        [veh.dbId]
    );
    const modsMap = {};      // modType -> modIndex
    const variantsMap = {};  // modType -> variantKey
    const slidersMap = {};   // modType -> parsed slider object
    for (const m of installedMods) {
        modsMap[m.mod_type] = m.mod_index;
        if (m.variant) variantsMap[m.mod_type] = m.variant;
        if (m.slider_data) { try { slidersMap[m.mod_type] = JSON.parse(m.slider_data); } catch(e) {} }
    }

    // Build lookup: modType -> catKey
    const modTypeToKey = {};
    for (const [key, m] of Object.entries(PERFORMANCE_MODS)) modTypeToKey[m.modType] = key;

    // Build per-category data for the UI
    const categories = {};
    const upgradeStages = {};
    const currentVariants = {};
    const currentSliderData = {};

    for (const [key, modInfo] of Object.entries(PERFORMANCE_MODS)) {
        const currentModIndex = modsMap[modInfo.modType] !== undefined ? modsMap[modInfo.modType] : -1;
        const currentStage = currentModIndex + 1;
        upgradeStages[key] = currentStage;

        const variantKey = variantsMap[modInfo.modType] || null;
        if (variantKey) currentVariants[key] = variantKey;

        const sliderVals = slidersMap[modInfo.modType] || {};
        if (Object.keys(sliderVals).length) currentSliderData[key] = sliderVals;

        // Next upgrade cost (use first variant as default for base price display)
        const vKeys = Object.keys(modInfo.variants || {});
        const nextReq = calcUpgradeReq(key, grade, currentStage + 1, vKeys[0]);

        let playerParts = 0;
        if (nextReq) {
            const partItemId = PART_ITEMS[nextReq.partType];
            playerParts = countPlayerItem(player, partItemId);
        }

        // Build variant info for UI (strip handling curves — UI doesn't need them)
        const uiVariants = {};
        for (const [vk, v] of Object.entries(modInfo.variants || {})) {
            uiVariants[vk] = {
                name: v.name, tag: v.tag, tagColor: v.tagColor,
                surcharge: v.surcharge, tendency: v.tendency, desc: v.desc
            };
        }

        // Build slider definitions for UI (strip handling properties)
        const uiSliders = (modInfo.sliders || []).map(s => ({
            key: s.key, name: s.name, icon: s.icon, minStage: s.minStage,
            description: s.description, leftLabel: s.leftLabel, rightLabel: s.rightLabel, default: s.default
        }));

        categories[key] = {
            name: modInfo.name, icon: modInfo.icon, maxStage: modInfo.maxStage,
            currentStage, group: modInfo.group, isVirtual: !!modInfo.isVirtual,
            descriptions: modInfo.description,
            currentVariant: variantKey,
            variants: uiVariants,
            sliders: uiSliders,
            sliderValues: sliderVals,
            nextReq: nextReq ? {
                stage: nextReq.stage, money: nextReq.money,
                partType: nextReq.partType, partAmount: nextReq.partAmount,
                partName: ItemRegistry[PART_ITEMS[nextReq.partType]].name,
                playerHas: playerParts
            } : null
        };
    }

    // PI & tendency
    const currentPI = calcPI(grade, upgradeStages);
    const piClassInfo = getPIClass(currentPI);
    const tendency = calcBuildTendency(currentVariants, upgradeStages);

    // Visual data for UI
    const vPricing = VISUAL_PRICES[grade] || VISUAL_PRICES['E'];
    const visualData = {};
    for (const [vk, vm] of Object.entries(VISUAL_MODS)) {
        let optionCount = 0;
        try { optionCount = veh.getNumMods(vm.modType); } catch(e) {}
        visualData[vk] = {
            name: vm.name, group: vm.group, modType: vm.modType,
            options: optionCount,
            current: modsMap[vm.modType] !== undefined ? modsMap[vm.modType] : -1,
            price: vPricing.base + vPricing.perMod
        };
    }

    // Paint data
    const cPricing = COLOR_PRICES[grade] || COLOR_PRICES['E'];
    const [vehRows] = await db.query("SELECT color FROM server_vehicles WHERE id = ?", [veh.dbId]);
    let colorData = { primRGB: {r:0,g:0,b:0}, secRGB: {r:0,g:0,b:0}, paintType: 0 };
    if (vehRows.length > 0 && vehRows[0].color) {
        try { const p = JSON.parse(vehRows[0].color); if (p.primRGB) colorData = p; } catch(e) {}
    }

    const paintData = {
        types: PAINT_TYPES, presets: PRESET_COLORS,
        pearls: PEARLESCENT_COLORS,
        presetPrice: cPricing.preset, customPrice: cPricing.custom,
        typePrice: cPricing.paintType, current: colorData,
        currentPearl: modsMap[209] !== undefined ? modsMap[209] : -1
    };

    // Special data
    const sPrices = SPECIAL_PRICES[grade] || SPECIAL_PRICES['E'];
    // Load stance data (virtual mod 206 = camber packed, 207 = trackWidth packed)
    let stanceCamber = 0, stanceTrackWidth = 0;
    if (modsMap[206] !== undefined) stanceCamber = (modsMap[206] - 10000) / 10000; // stored as int: (val+1)*10000
    if (modsMap[207] !== undefined) stanceTrackWidth = (modsMap[207] - 10000) / 10000;

    const specialData = {
        wheels: {
            name: 'Wheels', price: sPrices.wheels,
            options: WHEEL_TYPES.map(w => ({ id: w.id, name: w.name })),
            wheelColors: WHEEL_COLORS,
            current: { wheelType: modsMap[200] || 0, wheelIndex: modsMap[23] !== undefined ? modsMap[23] : -1, wheelColor: modsMap[208] !== undefined ? modsMap[208] : -1 }
        },
        stance: {
            name: 'Stance', price: sPrices.camber || 500,
            current: { camber: stanceCamber, trackWidth: stanceTrackWidth }
        },
        xenon: {
            name: 'Xenon Headlights', price: sPrices.xenon,
            options: XENON_COLORS.map(x => ({ id: x.id, name: x.name, hex: x.hex, current: x.id === (modsMap[201] || -1) })),
            current: { enabled: modsMap[22] !== undefined && modsMap[22] >= 0, colorId: modsMap[201] || -1 }
        },
        plate: {
            name: 'License Plate', price: sPrices.plate,
            options: PLATE_STYLES.map(p => ({ id: p.id, name: p.name, current: p.id === (modsMap[202] || 0) })),
            current: modsMap[202] || 0
        },
        neon: {
            name: 'Neon Lights', price: sPrices.neon,
            options: NEON_PRESETS.map(n => ({ name: n.name, hex: `rgb(${n.r},${n.g},${n.b})` })),
            current: { bitmask: modsMap[203] || 0, color: modsMap[204] ? { r:(modsMap[204]>>16)&0xFF, g:(modsMap[204]>>8)&0xFF, b:modsMap[204]&0xFF } : {r:255,g:255,b:255} }
        },
        smoke: {
            name: 'Tyre Smoke', price: sPrices.smoke,
            options: NEON_PRESETS.map(n => ({ name: n.name, hex: `rgb(${n.r},${n.g},${n.b})` })),
            current: { enabled: modsMap[20] !== undefined && modsMap[20] >= 0, color: modsMap[205] ? { r:(modsMap[205]>>16)&0xFF, g:(modsMap[205]>>8)&0xFF, b:modsMap[205]&0xFF } : {r:255,g:255,b:255} }
        }
    };

    // Handling config for client-side live preview (variant curves + slider properties)
    const handlingConfig = {};
    for (const [key, modInfo] of Object.entries(PERFORMANCE_MODS)) {
        const vc = {};
        for (const [vk, v] of Object.entries(modInfo.variants || {})) {
            vc[vk] = { handling: v.handling };
        }
        const sc = (modInfo.sliders || []).map(s => ({
            key: s.key, minStage: s.minStage, default: s.default, properties: s.properties
        }));
        handlingConfig[key] = { variants: vc, sliders: sc };
    }

    // Single init payload for the new UI
    const initData = {
        playerCash: player.data.money || 0,
        grade, pi: currentPI, piClass: piClassInfo,
        tendency,
        perfGroups: { labels: PERF_GROUP_LABELS, order: PERF_GROUP_ORDER },
        variantBrands: VARIANT_BRANDS,
        tendencyLabels: TENDENCY_LABELS,
        categories,
        visualData, paintData, specialData,
        vehicleDbId: veh.dbId,
        handlingConfig,
        currentStages: upgradeStages,
        currentVariants,
        currentSliders: currentSliderData
    };

    player.call('client:tuning:open', [JSON.stringify(initData)]);
}

// ─── Get model name from vehicle hash ───
function getModelName(veh) {
    // Find in catalog by matching hash
    for (const entry of catalog) {
        if (mp.joaat(entry.model) === veh.model) return entry.model;
    }
    return 'unknown';
}

// ─── Performance Upgrade (variant system) ───
mp.events.add('server:tuning:perfUpgrade', async (player, modKey, variantKey) => {
    if (!player.logged || !player.vehicle) return;

    const veh = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) {
        return player.call('showNotification', ['Tuning', 'You can only tune your own vehicle!']);
    }

    const modInfo = PERFORMANCE_MODS[modKey];
    if (!modInfo) return;

    // Validate variant exists for this category
    if (!variantKey || !modInfo.variants || !modInfo.variants[variantKey]) {
        return player.call('showNotification', ['Tuning', 'Invalid variant selection.']);
    }

    const modelName = getModelName(veh);
    const grade = getVehicleGrade(modelName);

    // Get current stage + locked variant from DB
    const [rows] = await db.query("SELECT mod_index, variant FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = ?", [veh.dbId, modInfo.modType]);
    const currentModIndex = rows.length > 0 ? rows[0].mod_index : -1;
    const currentStage = currentModIndex + 1;

    // Brand lock — once a brand is chosen, all upgrades must use the same brand
    if (currentStage > 0 && rows.length > 0 && rows[0].variant && rows[0].variant !== variantKey) {
        const lockedBrand = modInfo.variants[rows[0].variant];
        return player.call('showNotification', ['Tuning', `Locked to ${lockedBrand ? lockedBrand.name : rows[0].variant}. Reset the part to switch brands.`]);
    }

    // Check if maxed
    if (currentStage >= modInfo.maxStage) {
        return player.call('showNotification', ['Tuning', `${modInfo.name} is fully upgraded!`]);
    }

    // Calculate requirements with variant surcharge
    const nextReq = calcUpgradeReq(modKey, grade, currentStage + 1, variantKey);
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
    const moneyOk = await playerManager.removeMoneyAndSave(player, nextReq.money, `Tuning: ${modInfo.name} Stage ${nextReq.stage} [${variantKey}]`);
    if (!moneyOk) return player.call('showNotification', ['Tuning', 'Payment failed.']);

    // Deduct parts
    await removePlayerItems(player, partItemId, nextReq.partAmount);

    // Apply mod: real GTA mods use setMod, virtual mods are DB-only
    const newModIndex = currentStage; // stage 1 = modIndex 0
    if (!modInfo.isVirtual) {
        try { veh.setMod(modInfo.modType, newModIndex); } catch(e) {}
    }

    // Save to DB with variant (works for both real and virtual modTypes)
    await db.query(
        "INSERT INTO vehicle_mods (vehicle_id, mod_type, mod_index, variant) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE mod_index = ?, variant = ?",
        [veh.dbId, modInfo.modType, newModIndex, variantKey, newModIndex, variantKey]
    );

    player.call('showNotification', ['Tuning', `${modInfo.name} upgraded to Stage ${nextReq.stage} — ${modInfo.variants[variantKey].name}!`]);

    // Calculate updated stages, variants, PI for handling re-apply on client
    const [allMods] = await db.query("SELECT mod_type, mod_index, variant, slider_data FROM vehicle_mods WHERE vehicle_id = ?", [veh.dbId]);
    const modTypeToKey = {};
    for (const [key, m] of Object.entries(PERFORMANCE_MODS)) {
        modTypeToKey[m.modType] = key;
    }
    const updatedStages = {};
    const updatedVariants = {};
    const updatedSliders = {};
    for (const catKey of Object.keys(PERFORMANCE_MODS)) { updatedStages[catKey] = 0; }
    for (const row of allMods) {
        const catKey = modTypeToKey[row.mod_type];
        if (catKey) {
            updatedStages[catKey] = row.mod_index + 1;
            if (row.variant) updatedVariants[catKey] = row.variant;
            if (row.slider_data) { try { updatedSliders[catKey] = JSON.parse(row.slider_data); } catch(e) {} }
        }
    }

    const modelName2 = getModelName(veh);
    const grade2 = getVehicleGrade(modelName2);
    const newPI = calcPI(grade2, updatedStages);
    const newPIClass = getPIClass(newPI);

    // Notify client to re-apply handling with pre-computed multipliers
    const updatedMultipliers = calcAllHandling(updatedStages, updatedVariants, updatedSliders);
    // Sync suspension height for other players via variable
    const suspH1 = (updatedMultipliers.fSuspensionRaise || 1.0) - 1.0;
    veh.setVariable('suspensionHeight', suspH1);
    player.call('client:tuning:perfConfirmed', [
        JSON.stringify(updatedMultipliers),
        newPI,
        JSON.stringify(newPIClass)
    ]);

    // Refresh UI with updated data (includes recalculated PI + handling)
    await sendTuningData(player);
    console.log(`[Tuning] ${player.name} upgraded ${modInfo.name} to Stage ${nextReq.stage} on vehicle #${veh.dbId}`);
});

// ─── Reset Part (remove upgrade + brand lock) ───
mp.events.add('server:tuning:resetPart', async (player, catKey) => {
    if (!player.logged || !player.vehicle) return;

    const veh = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) {
        return player.call('showNotification', ['Tuning', 'You can only tune your own vehicle!']);
    }

    const modInfo = PERFORMANCE_MODS[catKey];
    if (!modInfo) return;

    // Check if part is actually upgraded
    const [rows] = await db.query("SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = ?", [veh.dbId, modInfo.modType]);
    if (rows.length === 0 || rows[0].mod_index < 0) {
        return player.call('showNotification', ['Tuning', 'This part is already stock.']);
    }

    // Reset GTA mod to stock
    if (!modInfo.isVirtual) {
        try { veh.setMod(modInfo.modType, -1); } catch(e) {}
    }

    // Delete from DB (removes variant + slider_data too)
    await db.query("DELETE FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = ?", [veh.dbId, modInfo.modType]);

    player.call('showNotification', ['Tuning', `${modInfo.name} reset to stock.`]);

    // Recalculate and re-apply handling
    const [allMods] = await db.query("SELECT mod_type, mod_index, variant, slider_data FROM vehicle_mods WHERE vehicle_id = ?", [veh.dbId]);
    const modTypeToKey = {};
    for (const [key, m] of Object.entries(PERFORMANCE_MODS)) modTypeToKey[m.modType] = key;

    const stages = {};
    const variants = {};
    const sliderData = {};
    for (const ck of Object.keys(PERFORMANCE_MODS)) { stages[ck] = 0; }
    for (const row of allMods) {
        const ck = modTypeToKey[row.mod_type];
        if (ck) {
            stages[ck] = row.mod_index + 1;
            if (row.variant) variants[ck] = row.variant;
            if (row.slider_data) { try { sliderData[ck] = JSON.parse(row.slider_data); } catch(e) {} }
        }
    }

    const handlingMults = calcAllHandling(stages, variants, sliderData);
    // Sync suspension height for other players via variable
    const suspH2 = (handlingMults.fSuspensionRaise || 1.0) - 1.0;
    veh.setVariable('suspensionHeight', suspH2);
    player.call('client:tuning:applyHandling', [JSON.stringify(handlingMults)]);

    // Refresh UI
    await sendTuningData(player);
    console.log(`[Tuning] ${player.name} reset ${modInfo.name} to stock on vehicle #${veh.dbId}`);
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

    // Duplicate check — prevent buying the same mod index twice
    const [existingMod] = await db.query("SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = ?", [veh.dbId, modType]);
    if (existingMod.length > 0 && existingMod[0].mod_index === modIndex) {
        return player.call('showNotification', ['Tuning', 'You already have this mod installed!']);
    }

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
    // Tell CEF to update visual feedback
    player.call('client:tuning:visualModConfirmed', [modType, modIndex]);
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

    // Build color JSON (include pearlRGB if present for UI state)
    const colorJson = JSON.stringify({
        primRGB: colorReq.primRGB,
        secRGB: colorReq.secRGB,
        paintType: colorReq.paintType,
        pearlRGB: colorReq.pearlRGB || null
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

    // Save pearlescent index if provided
    if (colorReq.pearlIndex !== undefined && colorReq.pearlIndex >= 0) {
        await saveVirtualMod(veh.dbId, 209, colorReq.pearlIndex);
        veh.setVariable('pearlColor', colorReq.pearlIndex);
    }

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

// ─── Apply Wheels (wheel type + wheel index + color) ───
mp.events.add('server:tuning:applyWheels', async (player, wheelTypeStr, wheelIndexStr, wheelColorStr) => {
    if (!player.logged || !player.vehicle) return;
    const veh = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) return;

    const wheelType = parseInt(wheelTypeStr);
    const wheelIndex = parseInt(wheelIndexStr);
    const wheelColorIdx = parseInt(wheelColorStr) || -1;

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

    // Save wheel color (virtual 208)
    if (wheelColorIdx >= 0) {
        await saveVirtualMod(veh.dbId, 208, wheelColorIdx);
        const wcGta = WHEEL_COLORS[wheelColorIdx] ? WHEEL_COLORS[wheelColorIdx].gtaIndex : -1;
        veh.setVariable('wheelColor', wcGta);
    }

    player.call('showNotification', ['Tuning', price > 0 ? `Wheels applied for $${price.toLocaleString()}!` : 'Wheels reverted to stock.']);
    player.call('client:tuning:updateCash', [player.data.money || 0]);
    player.call('client:tuning:specialConfirmed', ['wheels', JSON.stringify({ wheelType, wheelIndex, wheelColor: wheelColorIdx })]);
    console.log(`[Tuning] ${player.name} applied wheels type:${wheelType} index:${wheelIndex} color:${wheelColorIdx} on vehicle #${veh.dbId}`);
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

// ─── Apply Stance (camber + track width) ───
mp.events.add('server:tuning:applyStance', async (player, camberStr, trackWidthStr) => {
    if (!player.logged || !player.vehicle) return;
    const veh = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) return;

    const camber = parseFloat(camberStr) || 0;
    const trackWidth = parseFloat(trackWidthStr) || 0;

    const modelName = getModelName(veh);
    const grade = getVehicleGrade(modelName);
    const prices = SPECIAL_PRICES[grade] || SPECIAL_PRICES['E'];
    const price = prices.camber || 500;

    if (price > 0) {
        if (player.data.money < price) return player.call('showNotification', ['Tuning', `Insufficient cash! Need $${price.toLocaleString()}.`]);
        const ok = await playerManager.removeMoneyAndSave(player, price, `Tuning: Stance`);
        if (!ok) return player.call('showNotification', ['Tuning', 'Payment failed.']);
    }

    // Store as integers: (val+1)*10000 to avoid float precision issues in DB
    const camberInt = Math.round((camber + 1) * 10000);
    const trackWidthInt = Math.round((trackWidth + 1) * 10000);

    await saveVirtualMod(veh.dbId, 206, camberInt);
    await saveVirtualMod(veh.dbId, 207, trackWidthInt);

    // Set shared variables for client-side application on other players
    veh.setVariable('stanceData', JSON.stringify({ camber, trackWidth }));

    player.call('showNotification', ['Tuning', `Stance applied for $${price.toLocaleString()}!`]);
    player.call('client:tuning:updateCash', [player.data.money || 0]);
    player.call('client:tuning:specialConfirmed', ['stance', JSON.stringify({ camber, trackWidth })]);
    console.log(`[Tuning] ${player.name} set stance camber:${camber} trackWidth:${trackWidth} on vehicle #${veh.dbId}`);
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

// ─── Apply handling overrides when entering owned vehicle ───
mp.events.add('playerEnterVehicle', async (player, vehicle, seat) => {
    if (seat !== 0) return; // driver only (seat 0 on server)
    if (!vehicle.dbId || vehicle.ownerId !== player.data.dbId) return;

    try {
        // Gather upgrade stages + variants + sliders from DB
        const [rows] = await db.query(
            "SELECT mod_type, mod_index, variant, slider_data FROM vehicle_mods WHERE vehicle_id = ?",
            [vehicle.dbId]
        );
        const modTypeToKey = {};
        for (const [key, m] of Object.entries(PERFORMANCE_MODS)) modTypeToKey[m.modType] = key;

        const stages = {};
        const variants = {};
        const sliderData = {};
        let hasUpgrades = false;
        for (const catKey of Object.keys(PERFORMANCE_MODS)) { stages[catKey] = 0; }
        for (const row of rows) {
            const catKey = modTypeToKey[row.mod_type];
            if (catKey) {
                stages[catKey] = row.mod_index + 1;
                hasUpgrades = true;
                if (row.variant) variants[catKey] = row.variant;
                if (row.slider_data) { try { sliderData[catKey] = JSON.parse(row.slider_data); } catch(e) {} }
            }
        }

        if (hasUpgrades) {
            const multipliers = calcAllHandling(stages, variants, sliderData);
            // Sync suspension height for other players via variable
            const suspH3 = (multipliers.fSuspensionRaise || 1.0) - 1.0;
            vehicle.setVariable('suspensionHeight', suspH3);
            player.call('client:tuning:applyHandling', [JSON.stringify(multipliers)]);
        }
    } catch(e) {
        console.log('[Tuning] Handling apply error:', e);
    }
});

// ═══════════════════════════════════════════════════════════════════════
// PER-PART SLIDER SAVE
// ═══════════════════════════════════════════════════════════════════════
mp.events.add('server:tuning:saveSliders', async (player, catKey, slidersJson) => {
    if (!player.logged || !player.vehicle) return;

    const veh = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) return;

    const modInfo = PERFORMANCE_MODS[catKey];
    if (!modInfo) return;

    let sliderValues;
    try { sliderValues = JSON.parse(slidersJson); } catch(e) { return; }

    // Get current stage for this part
    const [stageRows] = await db.query(
        "SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = ?",
        [veh.dbId, modInfo.modType]
    );
    const currentStage = stageRows.length > 0 ? stageRows[0].mod_index + 1 : 0;
    if (currentStage === 0) return; // can't tune stock parts

    // Validate & clamp slider values
    const validSliders = {};
    for (const slider of (modInfo.sliders || [])) {
        if (currentStage < slider.minStage) continue;
        const val = sliderValues[slider.key];
        if (val !== undefined && typeof val === 'number') {
            validSliders[slider.key] = Math.max(0, Math.min(1, val));
        } else {
            validSliders[slider.key] = slider.default;
        }
    }

    // Save slider_data to vehicle_mods for this part
    await db.query(
        "UPDATE vehicle_mods SET slider_data = ? WHERE vehicle_id = ? AND mod_type = ?",
        [JSON.stringify(validSliders), veh.dbId, modInfo.modType]
    );

    // Re-apply handling with updated sliders
    const [allMods] = await db.query(
        "SELECT mod_type, mod_index, variant, slider_data FROM vehicle_mods WHERE vehicle_id = ?",
        [veh.dbId]
    );
    const modTypeToKey = {};
    for (const [key, m] of Object.entries(PERFORMANCE_MODS)) modTypeToKey[m.modType] = key;

    const stages = {};
    const variants = {};
    const sliderData = {};
    for (const ck of Object.keys(PERFORMANCE_MODS)) { stages[ck] = 0; }
    for (const row of allMods) {
        const ck = modTypeToKey[row.mod_type];
        if (ck) {
            stages[ck] = row.mod_index + 1;
            if (row.variant) variants[ck] = row.variant;
            if (row.slider_data) { try { sliderData[ck] = JSON.parse(row.slider_data); } catch(e) {} }
        }
    }

    const handlingMults = calcAllHandling(stages, variants, sliderData);
    // Sync suspension height for other players via variable
    const suspH4 = (handlingMults.fSuspensionRaise || 1.0) - 1.0;
    veh.setVariable('suspensionHeight', suspH4);
    player.call('client:tuning:applyHandling', [JSON.stringify(handlingMults)]);

    player.call('showNotification', ['Tuning', `${modInfo.name} tuning saved!`]);
});
