// packages/systems/tuning.js  v2.0
// PI-class stage caps | brand PI unlocks | 5-style build detection
// style-exclusive category gating | drift mode override | per-class slider ranges

const db             = require('../core/database');
const playerManager  = require('../core/playerManager');
const vehicleManager = require('../core/vehicles/vehicleManager');
const inventory      = require('./inventory');
const ItemRegistry   = require('../data/items');
const { catalog }    = require('../data/dealershipCatalog');
const {
    PART_ITEMS,
    PERFORMANCE_MODS,
    PERF_GROUP_LABELS,
    PERF_GROUP_ORDER,
    PI_CONFIG,
    VARIANT_BRANDS,
    TENDENCY_LABELS,
    BUILD_STYLES,
    PI_CLASS_ORDER,
    PI_CLASS_STAGE_CAPS,
    OFFROAD_VEHICLE_TYPES,
    calcAllHandling,
    calcBuildTendency,
    calcDriftModeActive,
    calcUpgradeReq,
    calcPI,
    getPIClass,
    isPIClassAtLeast,
    getEffectiveMaxStage,
    getAvailableVariants,
    getCategoryLockState,
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

// ─── Catalog helpers ─────────────────────────────────────────────────────────

/** Returns vehicle grade (F-S) from catalog. Default E if unknown. */
function getVehicleGrade(model) {
    const entry = catalog.find(v => v.model === model);
    return entry ? (entry.grade || 'E') : 'E';
}

/**
 * Returns vehicle type string normalised to what OFFROAD_VEHICLE_TYPES expects.
 * Catalog uses e.g. "SUVs", "Trucks", "Off-Road" — we lowercase and strip plurals.
 */
function getVehicleType(model) {
    const entry = catalog.find(v => v.model === model);
    if (!entry || !entry.type) return 'unknown';
    const t = entry.type.toLowerCase().replace(/s$/, ''); // "SUVs" -> "suv"
    // Normalise catalog variants
    if (t === 'off-road' || t === 'offroad' || t === 'off road') return 'offroad';
    if (t === 'truck')    return 'truck';
    if (t === 'suv')      return 'suv';
    if (t === 'militar')  return 'military';
    if (t === 'utilit')   return 'utility';
    return t;
}

function getModelName(veh) {
    for (const entry of catalog) {
        if (mp.joaat(entry.model) === veh.model) return entry.model;
    }
    return 'unknown';
}

// ─── Inventory helpers ───────────────────────────────────────────────────────

function countPlayerItem(player, itemId) {
    if (!player.inventory) return 0;
    return player.inventory
        .filter(i => i.itemId === itemId)
        .reduce((sum, i) => sum + i.count, 0);
}

async function removePlayerItems(player, itemId, amount) {
    if (!player.inventory) return false;
    let remaining = amount;
    const stacks = player.inventory
        .filter(i => i.itemId === itemId)
        .sort((a, b) => a.count - b.count);

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
    inventory.syncClient(player);
    return remaining <= 0;
}

// ─── Virtual mod save helper ─────────────────────────────────────────────────

async function saveVirtualMod(vehicleDbId, modType, modIndex) {
    await db.query(
        'INSERT INTO vehicle_mods (vehicle_id, mod_type, mod_index) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE mod_index = ?',
        [vehicleDbId, modType, modIndex, modIndex]
    );
}

// ─── Build a full stages/variants/sliders snapshot from DB rows ──────────────

function buildSnapshot(dbRows) {
    const modTypeToKey = {};
    for (const [key, m] of Object.entries(PERFORMANCE_MODS)) modTypeToKey[m.modType] = key;

    const stages     = {};
    const variants   = {};
    const sliderData = {};
    for (const ck of Object.keys(PERFORMANCE_MODS)) stages[ck] = 0;

    for (const row of dbRows) {
        const ck = modTypeToKey[row.mod_type];
        if (!ck) continue;
        stages[ck] = row.mod_index + 1;
        if (row.variant)     variants[ck]   = row.variant;
        if (row.slider_data) { try { sliderData[ck] = JSON.parse(row.slider_data); } catch(e) {} }
    }
    return { stages, variants, sliderData };
}

// ─── Re-compute and broadcast handling after any change ─────────────────────

async function reapplyHandling(player, veh) {
    const [rows] = await db.query(
        'SELECT mod_type, mod_index, variant, slider_data FROM vehicle_mods WHERE vehicle_id = ?',
        [veh.dbId]
    );
    const { stages, variants, sliderData } = buildSnapshot(rows);
    const modelName = getModelName(veh);
    const grade     = getVehicleGrade(modelName);
    const mults     = calcAllHandling(stages, variants, sliderData, grade);
    const suspH     = (mults.fSuspensionRaise || 1.0) - 1.0;
    if (Math.abs(suspH) > 0.001) veh.setVariable('suspensionHeight', suspH);
    else veh.setVariable('suspensionHeight', 0);
    player.call('client:tuning:applyHandling', [JSON.stringify(mults)]);
    return { stages, variants, sliderData, mults };
}

// ═════════════════════════════════════════════════════════════════════════════
// INIT — blips, markers, colshapes
// ═════════════════════════════════════════════════════════════════════════════
mp.events.add('packagesLoaded', async () => {
    for (const shop of TUNING_SHOPS) {
        mp.blips.new(446, new mp.Vector3(shop.pos.x, shop.pos.y, shop.pos.z), {
            name: shop.name, color: 47, shortRange: true, scale: 0.8
        });
        const m      = shop.marker;
        const marker = mp.markers.new(m.type,
            new mp.Vector3(shop.pos.x, shop.pos.y, shop.pos.z - 0.5), m.scale,
            { color: m.color, visible: true, dimension: 0 }
        );
        shop._markerId = marker.id;

        const colshape = mp.colshapes.newSphere(shop.pos.x, shop.pos.y, shop.pos.z, 3.0);
        colshape.setVariable('interaction', {
            title:          shop.name,
            text:           'Press E to tune your vehicle',
            event:          'server:tuning:open',
            data:           shop.id,
            requireVehicle: true,
            requireDriver:  true
        });
    }
    console.log(`[Tuning v2] ${TUNING_SHOPS.length} shops initialized.`);
});

// ─── Apply saved mods when vehicle spawns ────────────────────────────────────
const originalSpawn = vehicleManager.spawn;
vehicleManager.spawn = function(data) {
    const veh = originalSpawn.call(this, data);
    try { veh.setModKit(0); } catch(e) {}
    applyVehicleMods(veh, data.id);
    return veh;
};

async function applyVehicleMods(veh, vehicleDbId) {
    try {
        const [mods] = await db.query(
            'SELECT mod_type, mod_index, variant, slider_data FROM vehicle_mods WHERE vehicle_id = ?',
            [vehicleDbId]
        );
        if (!mp.vehicles.exists(veh)) return;

        const specialMods = {};
        for (const mod of mods) {
            if (mod.mod_type >= 200) {
                specialMods[mod.mod_type] = mod.mod_index;
            } else {
                try { veh.setMod(mod.mod_type, mod.mod_index); } catch(e) {}
            }
        }

        // Compute & sync suspension height
        try {
            const { stages, variants, sliderData } = buildSnapshot(mods);
            // Get grade from DB vehicle record for accurate range scaling
            const [vehRow] = await db.query('SELECT model FROM server_vehicles WHERE id = ?', [vehicleDbId]);
            const grade = vehRow.length > 0 ? getVehicleGrade(vehRow[0].model) : 'E';
            const spawnMults = calcAllHandling(stages, variants, sliderData, grade);
            const suspH = (spawnMults.fSuspensionRaise || 1.0) - 1.0;
            if (Math.abs(suspH) > 0.001) veh.setVariable('suspensionHeight', suspH);
        } catch(e) {}

        // Virtual mods
        if (specialMods[200] !== undefined) { try { veh.setVariable('wheelType',   specialMods[200]); } catch(e) {} }
        if (specialMods[202] !== undefined) { try { veh.numberPlateType = specialMods[202]; } catch(e) {} }
        if (specialMods[201] !== undefined) veh.setVariable('xenonColor', specialMods[201]);
        if (specialMods[203] !== undefined) {
            const bitmask   = specialMods[203];
            const packed    = specialMods[204] || 0;
            veh.setVariable('neonData', JSON.stringify({
                enabled: bitmask,
                color:   { r:(packed>>16)&0xFF, g:(packed>>8)&0xFF, b:packed&0xFF }
            }));
        }
        if (specialMods[205] !== undefined) {
            const p = specialMods[205];
            veh.setVariable('smokeColor', JSON.stringify({ r:(p>>16)&0xFF, g:(p>>8)&0xFF, b:p&0xFF }));
        }
        if (specialMods[206] !== undefined || specialMods[207] !== undefined) {
            const camber     = specialMods[206] !== undefined ? (specialMods[206] - 10000) / 10000 : 0;
            const trackWidth = specialMods[207] !== undefined ? (specialMods[207] - 10000) / 10000 : 0;
            veh.setVariable('stanceData', JSON.stringify({ camber, trackWidth }));
        }
        if (specialMods[208] !== undefined) {
            const wcGta = WHEEL_COLORS[specialMods[208]] ? WHEEL_COLORS[specialMods[208]].gtaIndex : -1;
            veh.setVariable('wheelColor', wcGta);
        }
        if (specialMods[209] !== undefined) veh.setVariable('pearlColor', specialMods[209]);

    } catch(e) {
        console.error(`[Tuning v2] applyVehicleMods error for #${vehicleDbId}:`, e);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// OPEN TUNING MENU
// ═════════════════════════════════════════════════════════════════════════════
mp.events.add('server:tuning:open', async (player, shopId) => {
    if (!player.logged) return;
    if (!player.vehicle) return player.call('showNotification', ['Tuning', 'You need to be in a vehicle!']);

    const veh = player.vehicle;
    if (!veh.dbId) return player.call('showNotification', ['Tuning', 'This vehicle cannot be tuned.']);
    if (veh.ownerId !== player.data.dbId) return player.call('showNotification', ['Tuning', 'You can only tune your own vehicle!']);

    try { veh.setModKit(0); } catch(e) {}

    player._tuningOrigDimension = player.dimension;
    const privateDim = player.id + 10000;
    player.dimension = privateDim;
    veh.dimension    = privateDim;

    player.call('client:tuning:hideMarker', [shopId]);
    await sendTuningData(player);
});

// ═════════════════════════════════════════════════════════════════════════════
// BUILD AND SEND FULL TUNING PAYLOAD
// ═════════════════════════════════════════════════════════════════════════════
async function sendTuningData(player) {
    const veh = player.vehicle;
    if (!veh || !veh.dbId) return;

    const modelName   = getModelName(veh);
    const grade       = getVehicleGrade(modelName);
    const vehicleType = getVehicleType(modelName);

    // Load all installed mods
    const [installedMods] = await db.query(
        'SELECT mod_type, mod_index, variant, slider_data FROM vehicle_mods WHERE vehicle_id = ?',
        [veh.dbId]
    );

    const modsMap    = {};   // modType -> modIndex
    const variantsMap = {};  // modType -> variantKey
    const slidersMap  = {};  // modType -> parsed slider obj

    for (const m of installedMods) {
        modsMap[m.mod_type] = m.mod_index;
        if (m.variant)     variantsMap[m.mod_type] = m.variant;
        if (m.slider_data) { try { slidersMap[m.mod_type] = JSON.parse(m.slider_data); } catch(e) {} }
    }

    const modTypeToKey = {};
    for (const [key, m] of Object.entries(PERFORMANCE_MODS)) modTypeToKey[m.modType] = key;

    // Build stages / variants for tendency calculation
    const upgradeStages   = {};
    const currentVariants = {};
    const currentSliders  = {};
    for (const ck of Object.keys(PERFORMANCE_MODS)) upgradeStages[ck] = 0;

    for (const [key, modInfo] of Object.entries(PERFORMANCE_MODS)) {
        const idx = modsMap[modInfo.modType] !== undefined ? modsMap[modInfo.modType] : -1;
        upgradeStages[key]   = idx + 1;
        const vk = variantsMap[modInfo.modType];
        if (vk) currentVariants[key] = vk;
        const sv = slidersMap[modInfo.modType];
        if (sv && Object.keys(sv).length) currentSliders[key] = sv;
    }

    // Build tendency BEFORE looping categories (needed for lock state)
    const tendency    = calcBuildTendency(currentVariants, upgradeStages);
    const isDriftMode = tendency.isDriftMode;

    // Build per-category data
    const categories = {};

    for (const [key, modInfo] of Object.entries(PERFORMANCE_MODS)) {
        const currentStage    = upgradeStages[key];
        const effectiveMax    = getEffectiveMaxStage(key, grade);
        const variantKey      = currentVariants[key] || null;
        const sliderVals      = currentSliders[key]  || {};

        // Lock state (PI class + vehicle type + style threshold)
        const lockState = getCategoryLockState(key, grade, vehicleType, tendency);

        // Available variants filtered by PI class
        const uiVariants = getAvailableVariants(key, grade);

        // Add tendency + desc to each variant (safe for client)
        for (const [vk, v] of Object.entries(modInfo.variants || {})) {
            if (!uiVariants[vk]) continue;
            // already has name/tag/tagColor/surcharge/tendency/desc from getAvailableVariants
        }

        // Next upgrade cost
        const nextStage = currentStage + 1;
        const vkForCost = variantKey || Object.keys(uiVariants)[0] || Object.keys(modInfo.variants || {})[0];
        const nextReq   = (nextStage <= effectiveMax) ? calcUpgradeReq(key, grade, nextStage, vkForCost) : null;

        let playerParts = 0;
        if (nextReq) {
            const partItemId = PART_ITEMS[nextReq.partType];
            playerParts = countPlayerItem(player, partItemId);
        }

        // Sliders — strip properties from client payload, keep zone data
        const uiSliders = (modInfo.sliders || []).map(s => ({
            key:         s.key,
            name:        s.name,
            icon:        s.icon,
            minStage:    s.minStage,
            description: s.description,
            leftLabel:   s.leftLabel,
            rightLabel:  s.rightLabel,
            default:     s.default,
            zones:       s.zones,
            styleZones:  s.styleZones,
            warnLow:     s.warnLow,
            warnHigh:    s.warnHigh
        }));

        categories[key] = {
            name:           modInfo.name,
            icon:           modInfo.icon,
            maxStage:       modInfo.maxStage,
            effectiveMax,           // PI-class-capped max
            currentStage,
            group:          modInfo.group,
            isVirtual:      !!modInfo.isVirtual,
            styleRequired:  modInfo.styleRequired || null,
            descriptions:   modInfo.description,
            currentVariant: variantKey,
            variants:       uiVariants,
            sliders:        uiSliders,
            sliderValues:   sliderVals,
            lockState,              // { locked, reason, styleRequired?, stylePercent?, styleNeeded? }
            nextReq: nextReq ? {
                stage:      nextReq.stage,
                money:      nextReq.money,
                partType:   nextReq.partType,
                partAmount: nextReq.partAmount,
                partName:   ItemRegistry[PART_ITEMS[nextReq.partType]] ? ItemRegistry[PART_ITEMS[nextReq.partType]].name : nextReq.partType,
                playerHas:  playerParts
            } : null
        };
    }

    // PI
    const currentPI   = calcPI(grade, upgradeStages);
    const piClassInfo = getPIClass(currentPI);

    // Visual mods — option counts are client-only (model data not loaded server-side).
    // We send options:0 for all; client fills in real counts via getNumMods after setModKit.
    const vPricing   = VISUAL_PRICES[grade] || VISUAL_PRICES['E'];
    const visualData = {};
    for (const [vk, vm] of Object.entries(VISUAL_MODS)) {
        visualData[vk] = {
            name:    vm.name,
            group:   vm.group,
            modType: vm.modType,
            options: 0,
            current: modsMap[vm.modType] !== undefined ? modsMap[vm.modType] : -1,
            price:   vPricing.base + vPricing.perMod
        };
    }

    // Paint
    const cPricing = COLOR_PRICES[grade] || COLOR_PRICES['E'];
    const [vehRows] = await db.query('SELECT color FROM server_vehicles WHERE id = ?', [veh.dbId]);
    let colorData = { primRGB:{r:0,g:0,b:0}, secRGB:{r:0,g:0,b:0}, paintType:0 };
    if (vehRows.length > 0 && vehRows[0].color) {
        try { const p = JSON.parse(vehRows[0].color); if (p.primRGB) colorData = p; } catch(e) {}
    }
    const paintData = {
        types:        PAINT_TYPES,
        presets:      PRESET_COLORS,
        pearls:       PEARLESCENT_COLORS,
        presetPrice:  cPricing.preset,
        customPrice:  cPricing.custom,
        typePrice:    cPricing.paintType,
        current:      colorData,
        currentPearl: modsMap[209] !== undefined ? modsMap[209] : -1
    };

    // Special mods
    const sPrices    = SPECIAL_PRICES[grade] || SPECIAL_PRICES['E'];
    let stanceCamber = 0, stanceTrack = 0;
    if (modsMap[206] !== undefined) stanceCamber = (modsMap[206] - 10000) / 10000;
    if (modsMap[207] !== undefined) stanceTrack  = (modsMap[207] - 10000) / 10000;

    const specialData = {
        wheels: {
            name:        'Wheels',
            price:       sPrices.wheels,
            options:     WHEEL_TYPES.map(w => ({ id:w.id, name:w.name })),
            wheelColors: WHEEL_COLORS,
            current:     {
                wheelType:  modsMap[200] || 0,
                wheelIndex: modsMap[23]  !== undefined ? modsMap[23]  : -1,
                wheelColor: modsMap[208] !== undefined ? modsMap[208] : -1
            }
        },
        stance: {
            name:    'Stance',
            price:   sPrices.camber || 500,
            current: { camber: stanceCamber, trackWidth: stanceTrack }
        },
        xenon: {
            name:    'Xenon Headlights',
            price:   sPrices.xenon,
            options: XENON_COLORS.map(x => ({ id:x.id, name:x.name, hex:x.hex, current: x.id === (modsMap[201] || -1) })),
            current: { enabled: modsMap[22] !== undefined && modsMap[22] >= 0, colorId: modsMap[201] || -1 }
        },
        plate: {
            name:    'License Plate',
            price:   sPrices.plate,
            options: PLATE_STYLES.map(p => ({ id:p.id, name:p.name, current: p.id === (modsMap[202] || 0) })),
            current: modsMap[202] || 0
        },
        neon: {
            name:    'Neon Lights',
            price:   sPrices.neon,
            options: NEON_PRESETS.map(n => ({ name:n.name, hex:`rgb(${n.r},${n.g},${n.b})` })),
            current: {
                bitmask: modsMap[203] || 0,
                color:   modsMap[204] ? { r:(modsMap[204]>>16)&0xFF, g:(modsMap[204]>>8)&0xFF, b:modsMap[204]&0xFF } : {r:255,g:255,b:255}
            }
        },
        smoke: {
            name:    'Tyre Smoke',
            price:   sPrices.smoke,
            options: NEON_PRESETS.map(n => ({ name:n.name, hex:`rgb(${n.r},${n.g},${n.b})` })),
            current: {
                enabled: modsMap[20] !== undefined && modsMap[20] >= 0,
                color:   modsMap[205] ? { r:(modsMap[205]>>16)&0xFF, g:(modsMap[205]>>8)&0xFF, b:modsMap[205]&0xFF } : {r:255,g:255,b:255}
            }
        }
    };

    // Handling config for client-side live preview
    const handlingConfig = {};
    for (const [key, modInfo] of Object.entries(PERFORMANCE_MODS)) {
        const vc = {};
        for (const [vk, v] of Object.entries(modInfo.variants || {})) {
            vc[vk] = { handling: v.handling };
        }
        handlingConfig[key] = {
            variants: vc,
            sliders:  (modInfo.sliders || []).map(s => ({
                key:        s.key,
                minStage:   s.minStage,
                default:    s.default,
                properties: s.properties
            }))
        };
    }

    const initData = {
        playerCash:      player.data.money || 0,
        grade,
        vehicleType,
        pi:              currentPI,
        piClass:         piClassInfo,
        tendency,
        isDriftMode,
        buildStyles:     BUILD_STYLES,
        perfGroups:      { labels: PERF_GROUP_LABELS, order: PERF_GROUP_ORDER },
        variantBrands:   VARIANT_BRANDS,
        tendencyLabels:  TENDENCY_LABELS,
        categories,
        visualData,
        paintData,
        specialData,
        vehicleDbId:     veh.dbId,
        handlingConfig,
        currentStages:   upgradeStages,
        currentVariants,
        currentSliders
    };

    player.call('client:tuning:open', [JSON.stringify(initData)]);
}

// ═════════════════════════════════════════════════════════════════════════════
// PERFORMANCE UPGRADE
// ═════════════════════════════════════════════════════════════════════════════
mp.events.add('server:tuning:perfUpgrade', async (player, modKey, variantKey) => {
    if (!player.logged || !player.vehicle) return;

    const veh = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) {
        return player.call('showNotification', ['Tuning', 'You can only tune your own vehicle!']);
    }

    const modInfo = PERFORMANCE_MODS[modKey];
    if (!modInfo) return;

    if (!variantKey || !modInfo.variants || !modInfo.variants[variantKey]) {
        return player.call('showNotification', ['Tuning', 'Invalid variant selection.']);
    }

    const modelName   = getModelName(veh);
    const grade       = getVehicleGrade(modelName);
    const vehicleType = getVehicleType(modelName);

    // ── PI class brand unlock check ──
    const variant = modInfo.variants[variantKey];
    if (variant.minPIClass && !isPIClassAtLeast(grade, variant.minPIClass)) {
        return player.call('showNotification', ['Tuning',
            `${variant.name} requires a ${variant.minPIClass}-class vehicle or higher.`
        ]);
    }

    // ── Load current state ──
    const [rows] = await db.query(
        'SELECT mod_index, variant FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = ?',
        [veh.dbId, modInfo.modType]
    );
    const currentModIndex = rows.length > 0 ? rows[0].mod_index : -1;
    const currentStage    = currentModIndex + 1;

    // ── Brand lock ──
    if (currentStage > 0 && rows[0].variant && rows[0].variant !== variantKey) {
        const lockedBrand = modInfo.variants[rows[0].variant];
        return player.call('showNotification', ['Tuning',
            `Locked to ${lockedBrand ? lockedBrand.name : rows[0].variant}. Reset the part to switch brands.`
        ]);
    }

    // ── PI class stage cap ──
    const effectiveMax = getEffectiveMaxStage(modKey, grade);
    if (currentStage >= effectiveMax) {
        const capMsg = currentStage >= modInfo.maxStage
            ? `${modInfo.name} is fully upgraded!`
            : `${modInfo.name} is capped at Stage ${effectiveMax} for ${grade}-class vehicles.`;
        return player.call('showNotification', ['Tuning', capMsg]);
    }

    // ── Style-exclusive gate ──
    if (modInfo.styleRequired || modInfo.vehicleTypeRequired) {
        const [allRows] = await db.query(
            'SELECT mod_type, mod_index, variant FROM vehicle_mods WHERE vehicle_id = ?',
            [veh.dbId]
        );
        const { stages: allStages, variants: allVariants } = buildSnapshot(allRows);
        const tendency = calcBuildTendency(allVariants, allStages);
        const lockState = getCategoryLockState(modKey, grade, vehicleType, tendency);
        if (lockState.locked) {
            return player.call('showNotification', ['Tuning', lockState.reason]);
        }
    }

    // ── Cost calculation ──
    const nextReq = calcUpgradeReq(modKey, grade, currentStage + 1, variantKey);
    if (!nextReq) return player.call('showNotification', ['Tuning', 'Upgrade not available.']);

    if (player.data.money < nextReq.money) {
        return player.call('showNotification', ['Tuning',
            `Insufficient cash! Need $${nextReq.money.toLocaleString()}.`
        ]);
    }

    const partItemId    = PART_ITEMS[nextReq.partType];
    const playerParts   = countPlayerItem(player, partItemId);
    if (playerParts < nextReq.partAmount) {
        const partName = ItemRegistry[partItemId] ? ItemRegistry[partItemId].name : nextReq.partType;
        return player.call('showNotification', ['Tuning',
            `Need ${nextReq.partAmount}x ${partName} (have ${playerParts}).`
        ]);
    }

    // ── Deduct ──
    const moneyOk = await playerManager.removeMoneyAndSave(player, nextReq.money,
        `Tuning: ${modInfo.name} Stage ${nextReq.stage} [${variantKey}]`);
    if (!moneyOk) return player.call('showNotification', ['Tuning', 'Payment failed.']);

    await removePlayerItems(player, partItemId, nextReq.partAmount);

    // ── Apply mod ──
    const newModIndex = currentStage; // stage N = modIndex N-1
    if (!modInfo.isVirtual) {
        try { veh.setMod(modInfo.modType, newModIndex); } catch(e) {}
    }

    await db.query(
        'INSERT INTO vehicle_mods (vehicle_id, mod_type, mod_index, variant) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE mod_index = ?, variant = ?',
        [veh.dbId, modInfo.modType, newModIndex, variantKey, newModIndex, variantKey]
    );

    // ── Re-compute handling & PI ──
    const [allMods] = await db.query(
        'SELECT mod_type, mod_index, variant, slider_data FROM vehicle_mods WHERE vehicle_id = ?',
        [veh.dbId]
    );
    const { stages, variants, sliderData } = buildSnapshot(allMods);
    const newPI      = calcPI(grade, stages);
    const newPIClass = getPIClass(newPI);
    const mults      = calcAllHandling(stages, variants, sliderData, grade);
    const suspH      = (mults.fSuspensionRaise || 1.0) - 1.0;
    veh.setVariable('suspensionHeight', Math.abs(suspH) > 0.001 ? suspH : 0);

    // Notify client: new handling + updated PI + drift mode flag
    const newTendency = calcBuildTendency(variants, stages);
    player.call('client:tuning:perfConfirmed', [
        JSON.stringify(mults),
        newPI,
        JSON.stringify(newPIClass),
        JSON.stringify(newTendency)
    ]);

    player.call('showNotification', ['Tuning',
        `${modInfo.name} Stage ${nextReq.stage} — ${modInfo.variants[variantKey].name}!`
    ]);

    await sendTuningData(player);
    console.log(`[Tuning v2] ${player.name} upgraded ${modInfo.name} Stage ${nextReq.stage} on #${veh.dbId}`);
});

// ═════════════════════════════════════════════════════════════════════════════
// RESET PART
// ═════════════════════════════════════════════════════════════════════════════
mp.events.add('server:tuning:resetPart', async (player, catKey) => {
    if (!player.logged || !player.vehicle) return;

    const veh = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) {
        return player.call('showNotification', ['Tuning', 'You can only tune your own vehicle!']);
    }

    const modInfo = PERFORMANCE_MODS[catKey];
    if (!modInfo) return;

    const [rows] = await db.query(
        'SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = ?',
        [veh.dbId, modInfo.modType]
    );
    if (rows.length === 0 || rows[0].mod_index < 0) {
        return player.call('showNotification', ['Tuning', 'This part is already stock.']);
    }

    if (!modInfo.isVirtual) {
        try { veh.setMod(modInfo.modType, -1); } catch(e) {}
    }
    await db.query(
        'DELETE FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = ?',
        [veh.dbId, modInfo.modType]
    );

    player.call('showNotification', ['Tuning', `${modInfo.name} reset to stock.`]);
    await reapplyHandling(player, veh);
    await sendTuningData(player);
    console.log(`[Tuning v2] ${player.name} reset ${modInfo.name} on #${veh.dbId}`);
});

// ═════════════════════════════════════════════════════════════════════════════
// SAVE SLIDERS
// ═════════════════════════════════════════════════════════════════════════════
mp.events.add('server:tuning:saveSliders', async (player, catKey, slidersJson) => {
    if (!player.logged || !player.vehicle) return;

    const veh = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) return;

    const modInfo = PERFORMANCE_MODS[catKey];
    if (!modInfo) return;

    let sliderValues;
    try { sliderValues = JSON.parse(slidersJson); } catch(e) { return; }

    const [stageRows] = await db.query(
        'SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = ?',
        [veh.dbId, modInfo.modType]
    );
    const currentStage = stageRows.length > 0 ? stageRows[0].mod_index + 1 : 0;
    if (currentStage === 0) return;

    const validSliders = {};
    for (const slider of (modInfo.sliders || [])) {
        if (currentStage < slider.minStage) continue;
        const val = sliderValues[slider.key];
        validSliders[slider.key] = (val !== undefined && typeof val === 'number')
            ? Math.max(0, Math.min(1, val))
            : slider.default;
    }

    await db.query(
        'UPDATE vehicle_mods SET slider_data = ? WHERE vehicle_id = ? AND mod_type = ?',
        [JSON.stringify(validSliders), veh.dbId, modInfo.modType]
    );

    await reapplyHandling(player, veh);
    player.call('showNotification', ['Tuning', `${modInfo.name} tuning saved!`]);
});

// ═════════════════════════════════════════════════════════════════════════════
// CLOSE TUNING
// ═════════════════════════════════════════════════════════════════════════════
mp.events.add('server:tuning:close', (player) => {
    const origDim = player._tuningOrigDimension !== undefined ? player._tuningOrigDimension : 0;
    player.dimension = origDim;
    if (player.vehicle) player.vehicle.dimension = origDim;
    delete player._tuningOrigDimension;
    player.call('client:tuning:showMarkers');
});

// ═════════════════════════════════════════════════════════════════════════════
// VISUAL MOD
// ═════════════════════════════════════════════════════════════════════════════
mp.events.add('server:tuning:visualMod', async (player, modTypeStr, modIndexStr) => {
    if (!player.logged || !player.vehicle) return;

    const veh = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) {
        return player.call('showNotification', ['Tuning', 'You can only tune your own vehicle!']);
    }

    const modType  = parseInt(modTypeStr);
    const modIndex = parseInt(modIndexStr);

    if (!Object.values(VISUAL_MODS).some(v => v.modType === modType)) return;

    const [existingMod] = await db.query(
        'SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = ?',
        [veh.dbId, modType]
    );
    if (existingMod.length > 0 && existingMod[0].mod_index === modIndex) {
        return player.call('showNotification', ['Tuning', 'You already have this mod installed!']);
    }

    const grade   = getVehicleGrade(getModelName(veh));
    const pricing = VISUAL_PRICES[grade] || VISUAL_PRICES['E'];
    const price   = modIndex === -1 ? 0 : pricing.base + (modIndex * pricing.perMod);

    if (price > 0) {
        if (player.data.money < price) {
            return player.call('showNotification', ['Tuning', `Insufficient cash! Need $${price.toLocaleString()}.`]);
        }
        const ok = await playerManager.removeMoneyAndSave(player, price, `Tuning: Visual mod type ${modType}`);
        if (!ok) return player.call('showNotification', ['Tuning', 'Payment failed.']);
    }

    try { veh.setMod(modType, modIndex); } catch(e) {}

    if (modIndex === -1) {
        await db.query('DELETE FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = ?', [veh.dbId, modType]);
    } else {
        await db.query(
            'INSERT INTO vehicle_mods (vehicle_id, mod_type, mod_index) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE mod_index = ?',
            [veh.dbId, modType, modIndex, modIndex]
        );
    }

    player.call('showNotification', ['Tuning', `Visual mod applied${price > 0 ? ` for $${price.toLocaleString()}` : ''}!`]);
    player.call('client:tuning:updateCash', [player.data.money || 0]);
    player.call('client:tuning:modConfirmed', [modType, modIndex]);
    player.call('client:tuning:visualModConfirmed', [modType, modIndex]);
    console.log(`[Tuning v2] ${player.name} visual mod type:${modType} index:${modIndex} on #${veh.dbId}`);
});

// ═════════════════════════════════════════════════════════════════════════════
// APPLY COLOR
// ═════════════════════════════════════════════════════════════════════════════
mp.events.add('server:tuning:applyColor', async (player, colorDataJson) => {
    if (!player.logged || !player.vehicle) return;

    const veh = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) {
        return player.call('showNotification', ['Tuning', 'You can only tune your own vehicle!']);
    }

    let colorReq;
    try { colorReq = JSON.parse(colorDataJson); } catch(e) { return; }

    const grade   = getVehicleGrade(getModelName(veh));
    const pricing = COLOR_PRICES[grade] || COLOR_PRICES['E'];
    let cost = 0;
    if (colorReq.type === 'preset')    cost = pricing.preset;
    else if (colorReq.type === 'custom')    cost = pricing.custom;
    else if (colorReq.type === 'paintType') cost = pricing.paintType;

    if (cost > 0) {
        if (player.data.money < cost) {
            return player.call('showNotification', ['Tuning', `Insufficient cash! Need $${cost.toLocaleString()}.`]);
        }
        const ok = await playerManager.removeMoneyAndSave(player, cost, `Tuning: Color (${colorReq.type})`);
        if (!ok) return player.call('showNotification', ['Tuning', 'Payment failed.']);
    }

    const colorJson = JSON.stringify({
        primRGB:   colorReq.primRGB,
        secRGB:    colorReq.secRGB,
        paintType: colorReq.paintType,
        pearlRGB:  colorReq.pearlRGB || null
    });
    await db.query('UPDATE server_vehicles SET color = ? WHERE id = ?', [colorJson, veh.dbId]);

    try {
        veh.setColorRGB(
            colorReq.primRGB.r, colorReq.primRGB.g, colorReq.primRGB.b,
            colorReq.secRGB.r,  colorReq.secRGB.g,  colorReq.secRGB.b
        );
        veh.setVariable('paintType', colorReq.paintType || 0);
    } catch(e) {}

    if (colorReq.pearlIndex !== undefined && colorReq.pearlIndex >= 0) {
        await saveVirtualMod(veh.dbId, 209, colorReq.pearlIndex);
        veh.setVariable('pearlColor', colorReq.pearlIndex);
    }

    player.call('showNotification', ['Tuning', `Color applied${cost > 0 ? ` for $${cost.toLocaleString()}` : ''}!`]);
    player.call('client:tuning:updateCash', [player.data.money || 0]);
    player.call('client:tuning:applyPaintType', [colorReq.paintType]);
    player.call('client:tuning:colorConfirmed', [JSON.stringify({
        primRGB: colorReq.primRGB, secRGB: colorReq.secRGB, paintType: colorReq.paintType
    })]);
    console.log(`[Tuning v2] ${player.name} color on #${veh.dbId} (${colorReq.type})`);
});

// ═════════════════════════════════════════════════════════════════════════════
// SPECIAL MODS — Wheels, Xenon, Plate, Neon, Smoke, Stance
// ═════════════════════════════════════════════════════════════════════════════

mp.events.add('server:tuning:applyWheels', async (player, wheelTypeStr, wheelIndexStr, wheelColorStr) => {
    if (!player.logged || !player.vehicle) return;
    const veh = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) return;

    const wheelType     = parseInt(wheelTypeStr);
    const wheelIndex    = parseInt(wheelIndexStr);
    const wheelColorIdx = parseInt(wheelColorStr) || -1;
    const grade         = getVehicleGrade(getModelName(veh));
    const prices        = SPECIAL_PRICES[grade] || SPECIAL_PRICES['E'];
    const price         = wheelIndex === -1 ? 0 : prices.wheels;

    if (price > 0) {
        if (player.data.money < price) return player.call('showNotification', ['Tuning', `Need $${price.toLocaleString()}.`]);
        const ok = await playerManager.removeMoneyAndSave(player, price, 'Tuning: Wheels');
        if (!ok) return player.call('showNotification', ['Tuning', 'Payment failed.']);
    }

    await saveVirtualMod(veh.dbId, 200, wheelType);
    if (wheelIndex === -1) {
        await db.query('DELETE FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = 23', [veh.dbId]);
    } else {
        await saveVirtualMod(veh.dbId, 23, wheelIndex);
    }
    try { veh.setMod(23, wheelIndex); } catch(e) {}
    veh.setVariable('wheelType', wheelType);

    if (wheelColorIdx >= 0) {
        await saveVirtualMod(veh.dbId, 208, wheelColorIdx);
        const wcGta = WHEEL_COLORS[wheelColorIdx] ? WHEEL_COLORS[wheelColorIdx].gtaIndex : -1;
        veh.setVariable('wheelColor', wcGta);
    }

    player.call('showNotification', ['Tuning', price > 0 ? `Wheels applied for $${price.toLocaleString()}!` : 'Wheels reverted.']);
    player.call('client:tuning:updateCash', [player.data.money || 0]);
    player.call('client:tuning:specialConfirmed', ['wheels', JSON.stringify({ wheelType, wheelIndex, wheelColor: wheelColorIdx })]);
});

mp.events.add('server:tuning:applyXenon', async (player, enabledStr, colorIdStr) => {
    if (!player.logged || !player.vehicle) return;
    const veh     = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) return;
    const enabled = enabledStr === 'true';
    const colorId = parseInt(colorIdStr);
    const grade   = getVehicleGrade(getModelName(veh));
    const prices  = SPECIAL_PRICES[grade] || SPECIAL_PRICES['E'];

    const [rows]      = await db.query('SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = 22', [veh.dbId]);
    const [colorRows] = await db.query('SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = 201', [veh.dbId]);
    const wasEnabled  = rows.length > 0 && rows[0].mod_index >= 0;
    const oldColor    = colorRows.length > 0 ? colorRows[0].mod_index : -1;
    let price = 0;
    if (enabled && !wasEnabled) price += prices.xenon;
    if (enabled && colorId !== oldColor) price += prices.xenonColor;

    if (price > 0) {
        if (player.data.money < price) return player.call('showNotification', ['Tuning', `Need $${price.toLocaleString()}.`]);
        const ok = await playerManager.removeMoneyAndSave(player, price, 'Tuning: Xenon');
        if (!ok) return player.call('showNotification', ['Tuning', 'Payment failed.']);
    }

    if (enabled) {
        await saveVirtualMod(veh.dbId, 22, 0);
        await saveVirtualMod(veh.dbId, 201, colorId);
        try { veh.setMod(22, 0); } catch(e) {}
        veh.setVariable('xenonColor', colorId);
    } else {
        await db.query('DELETE FROM vehicle_mods WHERE vehicle_id = ? AND mod_type IN (22, 201)', [veh.dbId]);
        try { veh.setMod(22, -1); } catch(e) {}
        veh.setVariable('xenonColor', -1);
    }
    player.call('showNotification', ['Tuning', enabled ? `Xenon applied${price > 0 ? ` for $${price.toLocaleString()}` : ''}!` : 'Xenon removed.']);
    player.call('client:tuning:updateCash', [player.data.money || 0]);
    player.call('client:tuning:specialConfirmed', ['xenon', JSON.stringify({ enabled, colorId })]);
});

mp.events.add('server:tuning:applyPlate', async (player, plateIdStr) => {
    if (!player.logged || !player.vehicle) return;
    const veh     = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) return;
    const plateId = parseInt(plateIdStr);
    const grade   = getVehicleGrade(getModelName(veh));
    const price   = (SPECIAL_PRICES[grade] || SPECIAL_PRICES['E']).plate;

    if (player.data.money < price) return player.call('showNotification', ['Tuning', `Need $${price.toLocaleString()}.`]);
    const ok = await playerManager.removeMoneyAndSave(player, price, 'Tuning: Plate');
    if (!ok) return player.call('showNotification', ['Tuning', 'Payment failed.']);

    await saveVirtualMod(veh.dbId, 202, plateId);
    try { veh.numberPlateType = plateId; } catch(e) {}
    player.call('showNotification', ['Tuning', `Plate changed for $${price.toLocaleString()}!`]);
    player.call('client:tuning:updateCash', [player.data.money || 0]);
    player.call('client:tuning:specialConfirmed', ['plate', JSON.stringify({ plateStyle: plateId })]);
});

mp.events.add('server:tuning:applyNeon', async (player, bitmaskStr, rStr, gStr, bStr) => {
    if (!player.logged || !player.vehicle) return;
    const veh     = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) return;
    const bitmask = parseInt(bitmaskStr);
    const r = parseInt(rStr), g = parseInt(gStr), b = parseInt(bStr);
    const grade   = getVehicleGrade(getModelName(veh));
    const prices  = SPECIAL_PRICES[grade] || SPECIAL_PRICES['E'];

    const [rows]      = await db.query('SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = 203', [veh.dbId]);
    const [colorRows] = await db.query('SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = 204', [veh.dbId]);
    const oldMask     = rows.length      > 0 ? rows[0].mod_index      : 0;
    const oldPacked   = colorRows.length > 0 ? colorRows[0].mod_index : 0;
    const newPacked   = (r << 16) | (g << 8) | b;
    let price = 0;
    if (bitmask !== oldMask)            price += prices.neon;
    if (bitmask > 0 && newPacked !== oldPacked) price += prices.neonColor;

    if (price > 0) {
        if (player.data.money < price) return player.call('showNotification', ['Tuning', `Need $${price.toLocaleString()}.`]);
        const ok = await playerManager.removeMoneyAndSave(player, price, 'Tuning: Neon');
        if (!ok) return player.call('showNotification', ['Tuning', 'Payment failed.']);
    }

    await saveVirtualMod(veh.dbId, 203, bitmask);
    if (bitmask > 0) await saveVirtualMod(veh.dbId, 204, newPacked);
    veh.setVariable('neonData', JSON.stringify({ enabled: bitmask, color: { r, g, b } }));
    player.call('showNotification', ['Tuning', bitmask > 0 ? `Neon applied${price > 0 ? ` for $${price.toLocaleString()}` : ''}!` : 'Neon removed.']);
    player.call('client:tuning:updateCash', [player.data.money || 0]);
    player.call('client:tuning:specialConfirmed', ['neon', JSON.stringify({ bitmask, color: { r, g, b } })]);
});

mp.events.add('server:tuning:applySmoke', async (player, enabledStr, rStr, gStr, bStr) => {
    if (!player.logged || !player.vehicle) return;
    const veh     = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) return;
    const enabled = enabledStr === 'true';
    const r = parseInt(rStr), g = parseInt(gStr), b = parseInt(bStr);
    const grade   = getVehicleGrade(getModelName(veh));
    const prices  = SPECIAL_PRICES[grade] || SPECIAL_PRICES['E'];

    const [rows]      = await db.query('SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = 20', [veh.dbId]);
    const [colorRows] = await db.query('SELECT mod_index FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = 205', [veh.dbId]);
    const wasEnabled  = rows.length      > 0 && rows[0].mod_index >= 0;
    const oldPacked   = colorRows.length > 0 ? colorRows[0].mod_index : 0;
    const newPacked   = (r << 16) | (g << 8) | b;
    let price = 0;
    if (enabled && !wasEnabled)          price += prices.smoke;
    if (enabled && newPacked !== oldPacked) price += prices.smokeColor;

    if (price > 0) {
        if (player.data.money < price) return player.call('showNotification', ['Tuning', `Need $${price.toLocaleString()}.`]);
        const ok = await playerManager.removeMoneyAndSave(player, price, 'Tuning: Smoke');
        if (!ok) return player.call('showNotification', ['Tuning', 'Payment failed.']);
    }

    if (enabled) {
        await saveVirtualMod(veh.dbId, 20, 1);
        await saveVirtualMod(veh.dbId, 205, newPacked);
        try { veh.setMod(20, 1); } catch(e) {}
        veh.setVariable('smokeColor', JSON.stringify({ r, g, b }));
    } else {
        await db.query('DELETE FROM vehicle_mods WHERE vehicle_id = ? AND mod_type IN (20, 205)', [veh.dbId]);
        try { veh.setMod(20, -1); } catch(e) {}
        veh.setVariable('smokeColor', null);
    }
    player.call('showNotification', ['Tuning', enabled ? `Smoke applied${price > 0 ? ` for $${price.toLocaleString()}` : ''}!` : 'Smoke removed.']);
    player.call('client:tuning:updateCash', [player.data.money || 0]);
    player.call('client:tuning:specialConfirmed', ['smoke', JSON.stringify({ enabled, color: { r, g, b } })]);
});

mp.events.add('server:tuning:applyStance', async (player, camberStr, trackWidthStr) => {
    if (!player.logged || !player.vehicle) return;
    const veh        = player.vehicle;
    if (!veh.dbId || veh.ownerId !== player.data.dbId) return;
    const camber     = parseFloat(camberStr)     || 0;
    const trackWidth = parseFloat(trackWidthStr) || 0;
    const grade      = getVehicleGrade(getModelName(veh));
    const price      = (SPECIAL_PRICES[grade] || SPECIAL_PRICES['E']).camber || 500;

    if (player.data.money < price) return player.call('showNotification', ['Tuning', `Need $${price.toLocaleString()}.`]);
    const ok = await playerManager.removeMoneyAndSave(player, price, 'Tuning: Stance');
    if (!ok) return player.call('showNotification', ['Tuning', 'Payment failed.']);

    await saveVirtualMod(veh.dbId, 206, Math.round((camber     + 1) * 10000));
    await saveVirtualMod(veh.dbId, 207, Math.round((trackWidth + 1) * 10000));
    veh.setVariable('stanceData', JSON.stringify({ camber, trackWidth }));
    player.call('showNotification', ['Tuning', `Stance applied for $${price.toLocaleString()}!`]);
    player.call('client:tuning:updateCash', [player.data.money || 0]);
    player.call('client:tuning:specialConfirmed', ['stance', JSON.stringify({ camber, trackWidth })]);
});

// ═════════════════════════════════════════════════════════════════════════════
// BATCH CART PURCHASE
// ═════════════════════════════════════════════════════════════════════════════
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

        let total = 0;
        for (const item of cart) total += (item.price || 0);

        if (total > 0) {
            if (player.data.money < total) {
                return player.call('showNotification', ['Tuning', `Insufficient cash! Need $${total.toLocaleString()}.`]);
            }
            const ok = await playerManager.removeMoneyAndSave(player, total,
                `Tuning: Cart (${cart.length} items)`);
            if (!ok) return player.call('showNotification', ['Tuning', 'Payment failed.']);
        }

        const results = [];
        for (const item of cart) {
            try {
                if (item.type === 'visual') {
                    const mt = parseInt(item.params.modType);
                    const mi = parseInt(item.params.modIndex);
                    try { veh.setMod(mt, mi); } catch(e) {}
                    if (mi === -1) await db.query('DELETE FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = ?', [veh.dbId, mt]);
                    else           await saveVirtualMod(veh.dbId, mt, mi);
                    results.push(item);
                } else if (item.type === 'wheels') {
                    const wt = parseInt(item.params.wheelType);
                    const wi = parseInt(item.params.wheelIndex);
                    try { veh.setMod(23, wi); } catch(e) {}
                    await saveVirtualMod(veh.dbId, 200, wt);
                    if (wi === -1) await db.query('DELETE FROM vehicle_mods WHERE vehicle_id = ? AND mod_type = 23', [veh.dbId]);
                    else           await saveVirtualMod(veh.dbId, 23, wi);
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
                        await db.query('DELETE FROM vehicle_mods WHERE vehicle_id = ? AND mod_type IN (22, 201)', [veh.dbId]);
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
                    if (bitmask > 0) await saveVirtualMod(veh.dbId, 204, (r<<16)|(g<<8)|b);
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
                        await saveVirtualMod(veh.dbId, 205, (r<<16)|(g<<8)|b);
                        veh.setVariable('smokeColor', JSON.stringify({ r, g, b }));
                    } else {
                        try { veh.setMod(20, -1); } catch(e) {}
                        await db.query('DELETE FROM vehicle_mods WHERE vehicle_id = ? AND mod_type IN (20, 205)', [veh.dbId]);
                        veh.setVariable('smokeColor', null);
                    }
                    results.push(item);
                } else if (item.type === 'color' || item.type === 'finish') {
                    const p         = item.params;
                    const primRGB   = p.primRGB  || { r:0, g:0, b:0 };
                    const secRGB    = p.secRGB   || { r:0, g:0, b:0 };
                    const paintType = p.paintType !== undefined ? p.paintType : 0;
                    try {
                        veh.setColorRGB(primRGB.r, primRGB.g, primRGB.b, secRGB.r, secRGB.g, secRGB.b);
                        veh.setVariable('paintType', paintType);
                    } catch(e) {}
                    await db.query('UPDATE server_vehicles SET color = ? WHERE id = ?',
                        [JSON.stringify({ primRGB, secRGB, paintType }), veh.dbId]);
                    player.call('client:tuning:applyPaintType', [paintType]);
                    item.resultColor = { primRGB, secRGB, paintType };
                    results.push(item);
                }
            } catch(e) {
                console.log(`[Tuning v2] Cart item error (${item.type}):`, e);
            }
        }

        player.call('client:tuning:cartConfirmed', [JSON.stringify(results)]);
        player.call('client:tuning:updateCash', [player.data.money || 0]);
        player.call('showNotification', ['Tuning',
            `Cart purchased (${results.length} items)${total > 0 ? ` for $${total.toLocaleString()}` : ''}!`
        ]);
        console.log(`[Tuning v2] ${player.name} cart: ${results.length} items, $${total} on #${veh.dbId}`);
    } catch(e) {
        console.log('[Tuning v2] Cart purchase error:', e);
    }
});

// ═════════════════════════════════════════════════════════════════════════════
// ENTER VEHICLE — re-apply handling overrides for the driver
// ═════════════════════════════════════════════════════════════════════════════
mp.events.add('playerEnterVehicle', async (player, vehicle, seat) => {
    if (seat !== 0) return;
    if (!vehicle.dbId || vehicle.ownerId !== player.data.dbId) return;

    try {
        const [rows] = await db.query(
            'SELECT mod_type, mod_index, variant, slider_data FROM vehicle_mods WHERE vehicle_id = ?',
            [vehicle.dbId]
        );
        const { stages, variants, sliderData } = buildSnapshot(rows);
        const hasUpgrades = Object.values(stages).some(s => s > 0);
        if (!hasUpgrades) return;

        const modelName = getModelName(vehicle);
        const grade     = getVehicleGrade(modelName);
        const mults     = calcAllHandling(stages, variants, sliderData, grade);
        const suspH     = (mults.fSuspensionRaise || 1.0) - 1.0;
        vehicle.setVariable('suspensionHeight', Math.abs(suspH) > 0.001 ? suspH : 0);
        player.call('client:tuning:applyHandling', [JSON.stringify(mults)]);
    } catch(e) {
        console.log('[Tuning v2] Handling apply on enter error:', e);
    }
});

console.log('[Tuning v2] System loaded.');