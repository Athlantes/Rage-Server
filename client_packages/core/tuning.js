// client_packages/core/tuning.js
let tuningBrowser = null;
let tuningOpen = false;
let tuningCam = null;
let tuningShopId = null; // which shop we're at
let localMarkers = [];   // client-side marker objects

// ─── Preview/Revert tracking ───
let originalMods = {};       // { modType: modIndex } — state when menu opened
let originalColor = null;    // { primRGB, secRGB, paintType } — state when menu opened
let previewedModTypes = {};  // { modType: true } — mods previewed but not yet purchased
let colorPreviewed = false;  // whether color was previewed but not yet purchased

// ─── Special mod preview/revert tracking ───
let originalSpecial = null;  // saved special mod state when menu opened
let specialPreviewed = {};   // { wheels: true, xenon: true, etc. } — previewed but not purchased
let forcedLightsOn = false;  // whether headlights were forced on for xenon preview
let burnoutActive = false;   // whether burnout animation is running
let burnoutTimer = null;     // burnout auto-stop timer

// ─── Pearl & Stance tracking ───
let currentPearlIndex = 0;        // current pearlescent GTA color index
let stanceBaseWheelTW = [null, null, null, null];  // per-wheel base track width [FL, FR, RL, RR]

// ─── Persistent stance/suspension state (re-applied every frame) ───
let activeStance = null;          // { camber, trackWidth } for current vehicle, or null
let activeSuspHeight = null;      // suspension height float for current vehicle, or null

// ─── Variant Handling Override System ───
let tuningData = null;          // full initData from server (categories, handlingConfig, etc.)
let baseHandling = {};          // cached base handling values { 'fInitialDriveForce': 1.23, ... }
let handlingApplied = false;    // whether we've applied handling overrides to current vehicle

// ─── Orbit Camera State ───
let orbitAngle = 0;             // camera orbit angle in degrees
let orbitPitch = 15;            // camera pitch angle in degrees (clamped 5-60)
let orbitDistance = 6;          // camera orbit distance (clamped 3-12)
let orbitCenter = null;         // { x, y, z } orbit focal point
let orbitRenderHandler = null;  // render loop for smooth orbit updates

/**
 * Read base (unmodified) handling values from the vehicle for every property
 * referenced in the handling config (variant curves + slider properties).
 * Called once when tuning opens or when handling is applied for the first time.
 */
function cacheBaseHandling(veh, handlingConfig) {
    baseHandling = {};
    const seen = {};

    for (const catKey of Object.keys(handlingConfig)) {
        const cat = handlingConfig[catKey];
        // Collect from variant handling curves
        for (const vk of Object.keys(cat.variants || {})) {
            for (const prop of Object.keys(cat.variants[vk].handling || {})) {
                if (seen[prop]) continue;
                seen[prop] = true;
                try {
                    const val = veh.getHandling(prop);
                    baseHandling[prop] = (typeof val === 'number' && !isNaN(val)) ? val : 1.0;
                } catch(e) {
                    baseHandling[prop] = 1.0;
                }
            }
        }
        // Collect from slider properties
        for (const slider of (cat.sliders || [])) {
            for (const prop of Object.keys(slider.properties || {})) {
                if (seen[prop]) continue;
                seen[prop] = true;
                try {
                    const val = veh.getHandling(prop);
                    baseHandling[prop] = (typeof val === 'number' && !isNaN(val)) ? val : 1.0;
                } catch(e) {
                    baseHandling[prop] = 1.0;
                }
            }
        }
    }
}

/**
 * Apply pre-computed handling multipliers to the vehicle.
 * Final = base × multiplier for each property.
 */
function applyHandlingMultipliers(veh, multipliers) {
    if (!veh || !multipliers) return;
    for (const [prop, mult] of Object.entries(multipliers)) {
        const base = baseHandling[prop];
        if (base === undefined) continue;
        // For properties with zero base (e.g. fSuspensionRaise), use additive: mult-1.0
        const value = (base === 0) ? (mult - 1.0) : (base * mult);
        try { veh.setHandling(prop, value); } catch(e) {}
        // Use RageMP API for immediate visual suspension height update
        if (prop === 'fSuspensionRaise') {
            try { veh.setSuspensionHeight(value); } catch(e) {}
            activeSuspHeight = (value !== 0) ? value : null; // keep render loop in sync
        }
    }
    handlingApplied = true;
}

/**
 * Client-side replica of calcAllHandling from tuningConfig.js.
 * Computes combined handling multipliers from stages + variants + sliders.
 * Used for live preview during tuning (slider/variant changes).
 */
function calcAllHandlingClient(stages, variants, sliderData, handlingConfig) {
    const combined = {};
    for (const [catKey, cat] of Object.entries(handlingConfig)) {
        const stage = stages[catKey] || 0;
        if (stage === 0) continue;
        const vk = variants[catKey] || 'standard';
        const variant = cat.variants[vk];
        if (!variant || !variant.handling) continue;
        // Apply variant handling curve at current stage
        for (const [prop, curve] of Object.entries(variant.handling)) {
            const keys = Object.keys(curve).map(Number).sort((a, b) => a - b);
            let mult = 1.0;
            for (const k of keys) { if (stage >= k) mult = curve[k]; }
            combined[prop] = (combined[prop] || 1.0) * mult;
        }
        // Apply slider offsets
        for (const slider of (cat.sliders || [])) {
            if (stage < slider.minStage) continue;
            const val = (sliderData[catKey] && sliderData[catKey][slider.key] !== undefined)
                ? sliderData[catKey][slider.key] : slider.default;
            for (const [prop, range] of Object.entries(slider.properties || {})) {
                const offset = range.min + (range.max - range.min) * val;
                combined[prop] = (combined[prop] || 1.0) * (1.0 + offset);
            }
        }
    }
    return combined;
}

/**
 * Reset handling back to base values (used on close).
 */
function resetHandling(veh) {
    if (!handlingApplied || !veh) return;
    for (const [prop, base] of Object.entries(baseHandling)) {
        try {
            veh.setHandling(prop, base);
        } catch(e) {}
    }
    handlingApplied = false;
}



// ─── Helper: apply custom vehicle color (try British spelling first) ───
function applyCustomPrimaryColor(veh, r, g, b) {
    try { veh.setCustomPrimaryColour(r, g, b); return; } catch(e) {}
    try { mp.game.invoke('0x7141766F91D15BEA', veh.handle, r, g, b); return; } catch(e) {}
    try { veh.setCustomPrimaryColor(r, g, b); return; } catch(e) {}
}
function applyCustomSecondaryColor(veh, r, g, b) {
    try { veh.setCustomSecondaryColour(r, g, b); return; } catch(e) {}
    try { mp.game.invoke('0x36CED73BFED89754', veh.handle, r, g, b); return; } catch(e) {}
    try { veh.setCustomSecondaryColor(r, g, b); return; } catch(e) {}
}

// ─── Helper: apply xenon headlight color (try multiple API methods) ───
function applyHeadlightColor(veh, colorId) {
    try { veh.setHeadlightsColour(colorId); return; } catch(e) {}
    try { mp.game.invoke('0xE41033B25D003A07', veh.handle, colorId); return; } catch(e) {}
    try { veh.setXenonLightsColor(colorId); return; } catch(e) {}
    try { veh.setHeadlightColor(colorId); return; } catch(e) {}
}

// ─── Helper: force vehicle headlights on/off ───
let headlightRenderHandler = null;

function forceHeadlights(veh, on) {
    try { veh.setLights(on ? 2 : 0); } catch(e) {
        try { mp.game.invoke('0x34E710FF01247C5A', veh.handle, on ? 2 : 0); } catch(e2) {}
    }
}

// Persistent render loop to keep headlights forced on (GTA resets them each frame)
function startHeadlightLoop(veh) {
    if (headlightRenderHandler) return;
    headlightRenderHandler = () => {
        if (!veh || !mp.vehicles.exists(veh)) { stopHeadlightLoop(); return; }
        try { mp.game.invoke('0x34E710FF01247C5A', veh.handle, 2); } catch(e) {}
    };
    mp.events.add('render', headlightRenderHandler);
    forcedLightsOn = true;
}

function stopHeadlightLoop() {
    if (headlightRenderHandler) {
        mp.events.remove('render', headlightRenderHandler);
        headlightRenderHandler = null;
    }
}

// ─── Helper: trigger burnout animation ───
let burnoutRenderHandler = null;

function triggerBurnout(veh) {
    // If already running, just extend the timer
    if (burnoutTimer) clearTimeout(burnoutTimer);

    // Ensure engine is on
    try { veh.setEngineOn(true, true, false); } catch(e) {
        try { mp.game.invoke('0x2497C4717C8B881E', veh.handle, true, true, false); } catch(e2) {}
    }

    // Enable burnout mode
    try { veh.setBurnout(true); } catch(e) {
        try { mp.game.invoke('0xFB8794444A7D60FB', veh.handle, true); } catch(e2) {}
    }

    burnoutActive = true;

    // Primary: Use TASK_VEHICLE_TEMP_ACTION (action 23 = burnout)
    // This works regardless of cursor mode because it's a ped task, not player input
    try {
        mp.game.invoke('0xC429DCEEB339E129', mp.players.local.handle, veh.handle, 23, 5000);
    } catch(e) {}

    // Secondary: Render handler as fallback for control-based burnout
    if (!burnoutRenderHandler) {
        burnoutRenderHandler = () => {
            if (!burnoutActive || !veh || !mp.vehicles.exists(veh)) return;
            try {
                mp.game.invoke('0x351220255D64C155', 0, 71, true); // ENABLE_CONTROL_ACTION: VEH_ACCELERATE
                mp.game.invoke('0x351220255D64C155', 0, 72, true); // ENABLE_CONTROL_ACTION: VEH_BRAKE
                mp.game.invoke('0xE8A25867FBA3B05E', 0, 71, 1.0);  // SET_CONTROL_NORMAL throttle
                mp.game.invoke('0xE8A25867FBA3B05E', 0, 72, 1.0);  // SET_CONTROL_NORMAL brake
            } catch(e) {}
        };
        mp.events.add('render', burnoutRenderHandler);
    }

    burnoutTimer = setTimeout(() => {
        stopBurnout(veh);
    }, 5000);
}

function stopBurnout(veh) {
    burnoutActive = false;
    if (burnoutTimer) { clearTimeout(burnoutTimer); burnoutTimer = null; }

    if (burnoutRenderHandler) {
        mp.events.remove('render', burnoutRenderHandler);
        burnoutRenderHandler = null;
    }

    if (!veh || !mp.vehicles.exists(veh)) return;
    try { veh.setBurnout(false); } catch(e) {
        try { mp.game.invoke('0xFB8794444A7D60FB', veh.handle, false); } catch(e2) {}
    }
    // Issue a normal drive task briefly to cancel the burnout task cleanly
    try {
        mp.game.invoke('0xC429DCEEB339E129', mp.players.local.handle, veh.handle, 1, 100);
    } catch(e) {}
}

// ─── Create client-side markers at tuning shops ───
// We use a render event to draw markers manually so we can hide them per player
const TUNING_SHOP_POSITIONS = [
    { id: 'burton',  x: -337.13,  y: -136.96,  z: 39.01 },
    { id: 'lsia',    x: -1155.46, y: -2007.16, z: 13.18 },
    { id: 'harmony', x: 731.58, y: -1088.77, z: 22.17 }
];

// ─── Hide marker when tuning opens ───
mp.events.add('client:tuning:hideMarker', (shopId) => {
    tuningShopId = shopId;
});

// ─── Show markers when tuning closes ───
mp.events.add('client:tuning:showMarkers', () => {
    tuningShopId = null;
});

// ─── Open Tuning UI ───
mp.events.add('client:tuning:open', (initDataJson) => {
    const veh = mp.players.local.vehicle;
    if (!veh) return;

    // Parse single init payload from server
    try { tuningData = JSON.parse(initDataJson); } catch(e) { tuningData = {}; }

    // Cache base handling values on first open (before any overrides)
    if (!handlingApplied && tuningData.handlingConfig) {
        cacheBaseHandling(veh, tuningData.handlingConfig);
    }

    // Apply current handling from stages+variants+sliders
    if (tuningData.handlingConfig && tuningData.currentStages) {
        const multipliers = calcAllHandlingClient(
            tuningData.currentStages, tuningData.currentVariants || {},
            tuningData.currentSliders || {}, tuningData.handlingConfig
        );
        applyHandlingMultipliers(veh, multipliers);
    }

    // Activate mod kit on client side (MUST happen before getNumMods)
    try { veh.setModKit(0); } catch(e) {}

    if (!tuningOpen) {
        tuningOpen = true;

        mp.gui.cursor.show(true, true);
        mp.game.ui.displayRadar(false);

        // Hide overlay
        mp.browsers.forEach(b => {
            if (b && b.url && b.url.includes('overlay')) {
                b.active = false;
            }
        });

        // Create orbit camera behind the car
        const pos = veh.position;
        const heading = veh.getHeading();
        orbitAngle = heading + 180;
        orbitPitch = 15;
        orbitDistance = 6;
        orbitCenter = { x: pos.x, y: pos.y, z: pos.z + 0.5 };

        const rad = (orbitAngle * Math.PI) / 180;
        const pitchRad = (orbitPitch * Math.PI) / 180;
        const camX = orbitCenter.x + Math.sin(rad) * Math.cos(pitchRad) * orbitDistance;
        const camY = orbitCenter.y + Math.cos(rad) * Math.cos(pitchRad) * orbitDistance;
        const camZ = orbitCenter.z + Math.sin(pitchRad) * orbitDistance;

        tuningCam = mp.cameras.new('default',
            new mp.Vector3(camX, camY, camZ),
            new mp.Vector3(0, 0, 0), 55
        );
        tuningCam.pointAtCoord(orbitCenter.x, orbitCenter.y, orbitCenter.z);
        tuningCam.setActive(true);
        mp.game.cam.renderScriptCams(true, true, 600, true, false);

        // Create browser
        tuningBrowser = mp.browsers.new('package://ui/tuning/index.html');
    }

    // Save original state for revert on close
    const currentMods = {};
    if (tuningData.visualData) {
        for (const [vk, vd] of Object.entries(tuningData.visualData)) {
            if (vd.current !== undefined && vd.current !== -1) {
                currentMods[vd.modType] = vd.current;
            }
        }
    }
    originalMods = { ...currentMods };
    previewedModTypes = {};
    colorPreviewed = false;
    specialPreviewed = {};

    try {
        originalColor = tuningData.paintData && tuningData.paintData.current
            ? tuningData.paintData.current
            : { primRGB: {r:0,g:0,b:0}, secRGB: {r:0,g:0,b:0}, paintType: 0 };
    } catch(e) {
        originalColor = { primRGB: {r:0,g:0,b:0}, secRGB: {r:0,g:0,b:0}, paintType: 0 };
    }

    // Save original special mod state
    try {
        originalSpecial = {};
        const sd = tuningData.specialData || {};
        if (sd.wheels && sd.wheels.current) Object.assign(originalSpecial, sd.wheels.current);
        if (sd.xenon && sd.xenon.current) Object.assign(originalSpecial, { xenonEnabled: sd.xenon.current.enabled, xenonColor: sd.xenon.current.colorId });
        if (sd.plate) originalSpecial.plateStyle = sd.plate.current;
        if (sd.neon && sd.neon.current) Object.assign(originalSpecial, { neonEnabled: sd.neon.current.bitmask, neonColor: sd.neon.current.color });
        if (sd.smoke && sd.smoke.current) Object.assign(originalSpecial, { smokeEnabled: sd.smoke.current.enabled, smokeColor: sd.smoke.current.color });
        if (sd.stance && sd.stance.current) Object.assign(originalSpecial, { camber: sd.stance.current.camber || 0, trackWidth: sd.stance.current.trackWidth || 0 });
    } catch(e) {
        originalSpecial = null;
    }

    // Init UI with data — delay so mod kit has taken effect and browser is ready
    setTimeout(() => {
        if (!tuningBrowser || !mp.browsers.exists(tuningBrowser)) return;

        const curVeh = mp.players.local.vehicle;
        if (!curVeh) return;

        // Re-apply mod kit just in case
        try { curVeh.setModKit(0); } catch(e) {}

        // Scan available visual mods now (after mod kit is active on client)
        if (tuningData.visualData) {
            for (const [vk, vd] of Object.entries(tuningData.visualData)) {
                const count = curVeh.getNumMods(vd.modType);
                if (count > 0) tuningData.visualData[vk].options = count;
            }
        }

        tuningBrowser.execute(`initTuning(${JSON.stringify(tuningData)})`);
    }, 500);
});

// ─── Update cash after purchase ───
mp.events.add('client:tuning:updateCash', (cash) => {
    if (tuningBrowser && mp.browsers.exists(tuningBrowser)) {
        tuningBrowser.execute(`updateCash(${cash})`);
    }
});

// ─── Close Tuning ───
mp.events.add('client:tuning:close', () => {
    closeTuning();
});

mp.events.add('cef:tuning:close', () => {
    closeTuning();
});

function closeTuning() {
    if (!tuningOpen) return;
    tuningOpen = false;

    // ─── Revert any un-purchased previews ───
    const veh = mp.players.local.vehicle;
    if (veh) {
        // Revert visual mod previews
        for (const modTypeStr of Object.keys(previewedModTypes)) {
            const mt = parseInt(modTypeStr);
            const origIndex = originalMods[mt] !== undefined ? originalMods[mt] : -1;
            try { veh.setMod(mt, origIndex); } catch(e) {}
        }
        // Revert color preview
        if (colorPreviewed && originalColor) {
            try {
                const pt = originalColor.paintType || 0;
                veh.setModColor1(pt, 0, 0);
                veh.setModColor2(pt, 0);
                applyCustomPrimaryColor(veh, originalColor.primRGB.r, originalColor.primRGB.g, originalColor.primRGB.b);
                applyCustomSecondaryColor(veh, originalColor.secRGB.r, originalColor.secRGB.g, originalColor.secRGB.b);
            } catch(e) {}
        }
        // Revert special mod previews
        if (originalSpecial) {
            if (specialPreviewed.wheels) {
                try { veh.setWheelType(originalSpecial.wheelType || 0); } catch(e) {}
                try { veh.setMod(23, originalSpecial.wheelIndex !== undefined ? originalSpecial.wheelIndex : -1); } catch(e) {}
            }
            if (specialPreviewed.xenon) {
                try { veh.setMod(22, originalSpecial.xenonEnabled ? 0 : -1); } catch(e) {}
                if (originalSpecial.xenonEnabled) {
                    applyHeadlightColor(veh, originalSpecial.xenonColor || -1);
                }
            }
            if (specialPreviewed.plate) {
                try { veh.numberPlateType = originalSpecial.plateStyle || 0; } catch(e) {}
            }
            if (specialPreviewed.neon) {
                const mask = originalSpecial.neonEnabled || 0;
                for (let i = 0; i < 4; i++) {
                    try { veh.setNeonLightEnabled(i, (mask & (1 << i)) !== 0); } catch(e) {}
                }
                if (mask > 0 && originalSpecial.neonColor) {
                    try { veh.setNeonLightsColour(originalSpecial.neonColor.r, originalSpecial.neonColor.g, originalSpecial.neonColor.b); } catch(e) {}
                }
            }
            if (specialPreviewed.smoke) {
                try { veh.setMod(20, originalSpecial.smokeEnabled ? 1 : -1); } catch(e) {}
                if (originalSpecial.smokeEnabled && originalSpecial.smokeColor) {
                    try { veh.setTyreSmokeColor(originalSpecial.smokeColor.r, originalSpecial.smokeColor.g, originalSpecial.smokeColor.b); } catch(e) {}
                }
            }
            if (specialPreviewed.stance) {
                // Revert stance to original values
                const origCamber = originalSpecial.camber || 0;
                const origTrackWidth = originalSpecial.trackWidth || 0;
                applyStanceToVehicle(veh, origCamber, origTrackWidth);
                // Re-sync render loop to original values
                activeStance = (origCamber !== 0 || origTrackWidth !== 0) ? { camber: origCamber, trackWidth: origTrackWidth } : null;
            }
        }
    }
    previewedModTypes = {};
    colorPreviewed = false;
    specialPreviewed = {};

    // Stop burnout and revert headlights if forced
    if (veh) {
        if (burnoutActive) stopBurnout(veh);
        stopHeadlightLoop();
        if (forcedLightsOn) {
            forceHeadlights(veh, false);
            forcedLightsOn = false;
        }
    }

    tuningData = null;
    stanceBaseWheelTW = [null, null, null, null];

    try { mp.gui.cursor.show(false, false); } catch(e) {}
    try { mp.game.ui.displayRadar(true); } catch(e) {}

    // Show overlay
    mp.browsers.forEach(b => {
        if (b && b.url && b.url.includes('overlay')) {
            b.active = true;
        }
    });

    // Destroy browser
    try {
        if (tuningBrowser && mp.browsers.exists(tuningBrowser)) {
            tuningBrowser.destroy();
        }
    } catch(e) {}
    tuningBrowser = null;

    // Destroy camera
    try {
        if (tuningCam) {
            mp.game.cam.renderScriptCams(false, false, 0, true, false);
            tuningCam.destroy();
        }
    } catch(e) {}
    tuningCam = null;

    try { mp.events.callRemote('server:tuning:close'); } catch(e) {}
}

// ─── CEF -> Server bridges ───
mp.events.add('cef:tuning:perfUpgrade', (catKey, variantKey) => {
    mp.events.callRemote('server:tuning:perfUpgrade', catKey, variantKey);
});

// ─── Server confirmed perf upgrade — re-apply handling with pre-computed multipliers ───
mp.events.add('client:tuning:perfConfirmed', (multipliersJson, piValue, piClassJson) => {
    try {
        const multipliers = JSON.parse(multipliersJson);
        const veh = mp.players.local.vehicle;
        if (veh) {
            applyHandlingMultipliers(veh, multipliers);
        }

        // Update UI with new PI
        if (tuningBrowser && mp.browsers.exists(tuningBrowser)) {
            tuningBrowser.execute(`if(typeof updatePI==='function')updatePI(${piValue},${piClassJson})`);
        }
    } catch(e) {}
});

// ─── CEF: Save slider values (per-part) ───
mp.events.add('cef:tuning:saveSliders', (catKey, slidersJson) => {
    mp.events.callRemote('server:tuning:saveSliders', catKey, slidersJson);
});

// ─── CEF: Reset part to stock (remove brand lock) ───
mp.events.add('cef:tuning:resetPart', (catKey) => {
    mp.events.callRemote('server:tuning:resetPart', catKey);
});

// ─── CEF: Live slider preview (compute handling locally without saving) ───
mp.events.add('cef:tuning:previewSliders', (catKey, slidersJson) => {
    const veh = mp.players.local.vehicle;
    if (!veh || !tuningData || !tuningData.handlingConfig || !tuningData.currentStages) return;

    try {
        const previewSliders = JSON.parse(slidersJson);
        // Build modified slider data with the preview values for this category
        const modifiedSliders = { ...(tuningData.currentSliders || {}) };
        modifiedSliders[catKey] = previewSliders;

        const multipliers = calcAllHandlingClient(
            tuningData.currentStages, tuningData.currentVariants || {},
            modifiedSliders, tuningData.handlingConfig
        );
        applyHandlingMultipliers(veh, multipliers);
    } catch(e) {}
});

// ─── CEF: Live variant preview (compute handling with a different variant for this category) ───
mp.events.add('cef:tuning:previewVariant', (catKey, variantKey) => {
    const veh = mp.players.local.vehicle;
    if (!veh || !tuningData || !tuningData.handlingConfig || !tuningData.currentStages) return;

    try {
        // Build modified variants with the preview variant for this category
        const modifiedVariants = { ...(tuningData.currentVariants || {}) };
        modifiedVariants[catKey] = variantKey;

        const multipliers = calcAllHandlingClient(
            tuningData.currentStages, modifiedVariants,
            tuningData.currentSliders || {}, tuningData.handlingConfig
        );
        applyHandlingMultipliers(veh, multipliers);
    } catch(e) {}
});

mp.events.add('cef:tuning:visualMod', (modType, modIndex) => {
    mp.events.callRemote('server:tuning:visualMod', modType.toString(), modIndex.toString());
});

// ─── CEF: Preview visual mod (apply temporarily on client — no charge) ───
mp.events.add('cef:tuning:previewVisual', (modType, modIndex) => {
    const veh = mp.players.local.vehicle;
    if (!veh) return;
    const mt = parseInt(modType);
    previewedModTypes[mt] = true;
    try {
        veh.setMod(mt, parseInt(modIndex));
    } catch(e) {}

    // Horn preview — play the horn sound for 5s in HELDDOWN mode after mod applies
    if (mt === 14) {
        setTimeout(() => {
            try {
                const v = mp.players.local.vehicle;
                if (v) mp.game.invoke('0x9C8C6504B5B63D2C', v.handle, 5000, mp.game.joaat('HELDDOWN'), false);
            } catch(e) {}
        }, 150);
    }
});

// ─── Server confirmed visual mod purchase — update original and tell CEF ───
mp.events.add('client:tuning:modConfirmed', (modType, modIndex) => {
    const mt = parseInt(modType);
    const mi = parseInt(modIndex);
    if (mi === -1) {
        delete originalMods[mt];
    } else {
        originalMods[mt] = mi;
    }
    delete previewedModTypes[mt];
});

// ─── Server confirmed visual mod — update CEF feedback (installed badges, etc.) ───
mp.events.add('client:tuning:visualModConfirmed', (modType, modIndex) => {
    if (tuningBrowser && mp.browsers.exists(tuningBrowser)) {
        tuningBrowser.execute(`visualModConfirmed(${parseInt(modType)}, ${parseInt(modIndex)})`);
    }
});

// ─── CEF: Preview color (client-side only, no save) ───
mp.events.add('cef:tuning:previewColor', (primR, primG, primB, secR, secG, secB, paintType) => {
    const veh = mp.players.local.vehicle;
    if (!veh) return;
    colorPreviewed = true;
    try {
        const pt = parseInt(paintType) || 0;
        const pr = parseInt(primR), pg = parseInt(primG), pb = parseInt(primB);
        const sr = parseInt(secR), sg = parseInt(secG), sb = parseInt(secB);

        // Set paint type first
        veh.setModColor1(pt, 0, 0);
        veh.setModColor2(pt, 0);

        // Apply custom RGB AFTER paint type (fixes color reset on type change)
        applyCustomPrimaryColor(veh, pr, pg, pb);
        applyCustomSecondaryColor(veh, sr, sg, sb);

        // Extra delay re-apply to fight GTA resetting colors on type change
        setTimeout(() => {
            if (!veh || !mp.vehicles.exists(veh)) return;
            applyCustomPrimaryColor(veh, pr, pg, pb);
            applyCustomSecondaryColor(veh, sr, sg, sb);
        }, 50);
    } catch(e) {}
});

// ─── Server confirmed color purchase — update original so it won't revert ───
mp.events.add('client:tuning:colorConfirmed', (colorJson) => {
    try {
        originalColor = JSON.parse(colorJson);
        colorPreviewed = false;
    } catch(e) {}
});

// ─── Server tells us to apply paint type after purchase ───
mp.events.add('client:tuning:applyPaintType', (paintType) => {
    const veh = mp.players.local.vehicle;
    if (!veh) return;
    try {
        const pt = parseInt(paintType) || 0;
        veh.setModColor1(pt, 0, currentPearlIndex || 0);
        veh.setModColor2(pt, 0);
    } catch(e) {}
});

// ─── CEF: Apply color (send to server for saving) ───
mp.events.add('cef:tuning:applyColor', (colorDataJson) => {
    mp.events.callRemote('server:tuning:applyColor', colorDataJson);
});

// ═══ SPECIAL MOD PREVIEW / PURCHASE BRIDGES ═══

// ─── CEF: Change wheel type → rescan available wheels → send count back ───
mp.events.add('cef:tuning:changeWheelType', (typeId) => {
    const veh = mp.players.local.vehicle;
    if (!veh) return;
    const type = parseInt(typeId);
    specialPreviewed.wheels = true;
    try { veh.setWheelType(type); } catch(e) {}
    // Need a tiny delay for the wheel type change to take effect
    setTimeout(() => {
        const count = veh.getNumMods(23);
        if (tuningBrowser && mp.browsers.exists(tuningBrowser)) {
            tuningBrowser.execute(`updateWheelOptions(${type}, ${count})`);
        }
    }, 100);
});

// ─── CEF: Preview specific wheel ───
mp.events.add('cef:tuning:previewWheel', (modIndex) => {
    const veh = mp.players.local.vehicle;
    if (!veh) return;
    specialPreviewed.wheels = true;
    try { veh.setMod(23, parseInt(modIndex)); } catch(e) {}
});

// ─── CEF: Apply wheels (send to server) with wheel color ───
mp.events.add('cef:tuning:applyWheels', (wheelType, wheelIndex, wheelColorIdx) => {
    mp.events.callRemote('server:tuning:applyWheels', wheelType.toString(), wheelIndex.toString(), (wheelColorIdx || -1).toString());
});

// ─── CEF: Preview xenon headlights ───
mp.events.add('cef:tuning:previewXenon', (enabled, colorId) => {
    const veh = mp.players.local.vehicle;
    if (!veh) return;
    specialPreviewed.xenon = true;
    try {
        if (enabled === 'true') {
            veh.setMod(22, 0);
            applyHeadlightColor(veh, parseInt(colorId));
            // Use persistent render loop to keep headlights forced on
            startHeadlightLoop(veh);
        } else {
            veh.setMod(22, -1);
            stopHeadlightLoop();
            forceHeadlights(veh, false);
            forcedLightsOn = false;
        }
    } catch(e) {}
});

// ─── CEF: Apply xenon (send to server) ───
mp.events.add('cef:tuning:applyXenon', (enabled, colorId) => {
    mp.events.callRemote('server:tuning:applyXenon', enabled, colorId.toString());
});

// ─── CEF: Preview plate style ───
mp.events.add('cef:tuning:previewPlate', (plateId) => {
    const veh = mp.players.local.vehicle;
    if (!veh) return;
    specialPreviewed.plate = true;
    try { mp.game.invoke('0x9088EB5A43FFB0A1', veh.handle, parseInt(plateId)); } catch(e) {} // SET_VEHICLE_NUMBER_PLATE_TEXT_INDEX
});

// ─── CEF: Apply plate (send to server) ───
mp.events.add('cef:tuning:applyPlate', (plateId) => {
    mp.events.callRemote('server:tuning:applyPlate', plateId.toString());
});

// ─── CEF: Preview neon lights ───
mp.events.add('cef:tuning:previewNeon', (bitmask, r, g, b) => {
    const veh = mp.players.local.vehicle;
    if (!veh) return;
    specialPreviewed.neon = true;
    const mask = parseInt(bitmask);
    try {
        for (let i = 0; i < 4; i++) {
            veh.setNeonLightEnabled(i, (mask & (1 << i)) !== 0);
        }
        if (mask > 0) {
            veh.setNeonLightsColour(parseInt(r), parseInt(g), parseInt(b));
        }
    } catch(e) {}
});

// ─── CEF: Apply neon (send to server) ───
mp.events.add('cef:tuning:applyNeon', (bitmask, r, g, b) => {
    mp.events.callRemote('server:tuning:applyNeon', bitmask.toString(), r.toString(), g.toString(), b.toString());
});

// ─── CEF: Preview tyre smoke ───
mp.events.add('cef:tuning:previewSmoke', (enabled, r, g, b) => {
    const veh = mp.players.local.vehicle;
    if (!veh) return;
    specialPreviewed.smoke = true;
    try {
        veh.setMod(20, enabled === 'true' ? 1 : -1);
        if (enabled === 'true') {
            try { veh.setTyreSmokeColor(parseInt(r), parseInt(g), parseInt(b)); } catch(e) {}
            // Trigger burnout so the player can see the smoke
            triggerBurnout(veh);
        }
    } catch(e) {}
});

// ─── CEF: Apply tyre smoke (send to server) ───
mp.events.add('cef:tuning:applySmoke', (enabled, r, g, b) => {
    mp.events.callRemote('server:tuning:applySmoke', enabled, r.toString(), g.toString(), b.toString());
});

// ─── CEF: Preview pearlescent color ───
mp.events.add('cef:tuning:previewPearl', (gtaIndex) => {
    const veh = mp.players.local.vehicle;
    if (!veh) return;
    colorPreviewed = true;
    try {
        const idx = parseInt(gtaIndex) || 0;
        currentPearlIndex = idx;
        // Set paint type to Pearl (2) with pearlescent overlay color
        veh.setModColor1(2, 0, idx);
    } catch(e) {}
});

// ─── CEF: Preview wheel color ───
mp.events.add('cef:tuning:previewWheelColor', (gtaIndex) => {
    const veh = mp.players.local.vehicle;
    if (!veh) return;
    specialPreviewed.wheels = true;
    try {
        const idx = parseInt(gtaIndex);
        // SET_VEHICLE_EXTRA_COLOURS(vehicle, pearlescent, wheelColor)
        mp.game.invoke('0x2036F561ADD12E33', veh.handle, currentPearlIndex || 0, idx >= 0 ? idx : 0);
    } catch(e) {}
});

// ─── CEF: Preview stance (camber + track width) ───
mp.events.add('cef:tuning:previewStance', (camber, trackWidth) => {
    const veh = mp.players.local.vehicle;
    if (!veh) return;
    specialPreviewed.stance = true;
    try {
        const cam = parseFloat(camber) || 0;
        const tw = parseFloat(trackWidth) || 0;
        applyStanceToVehicle(veh, cam, tw);
        // Update persistent render state so render loop keeps applying
        activeStance = (cam !== 0 || tw !== 0) ? { camber: cam, trackWidth: tw } : null;
    } catch(e) {}
});

// ─── CEF: Apply stance (send to server) ───
mp.events.add('cef:tuning:applyStance', (camber, trackWidth) => {
    mp.events.callRemote('server:tuning:applyStance', camber.toString(), trackWidth.toString());
});

// ─── Helper: Apply stance (camber + track width) to vehicle using RageMP API ───
function applyStanceToVehicle(veh, camber, trackWidth) {
    if (!veh || !mp.vehicles.exists(veh)) return;
    try {
        // Cache per-wheel base track widths on first call (left wheels are negative, right positive)
        if (stanceBaseWheelTW[0] === null) {
            for (let i = 0; i < 4; i++) {
                try {
                    const w = veh.getWheelTrackWidth(i);
                    stanceBaseWheelTW[i] = (typeof w === 'number' && !isNaN(w)) ? w : (i % 2 === 0 ? -1.5 : 1.5);
                } catch(e) {
                    stanceBaseWheelTW[i] = (i % 2 === 0 ? -1.5 : 1.5);
                }
            }
        }
        // Apply camber to all 4 wheels — left and right need opposite signs for symmetry
        // Negative camber (top inward): left wheels need positive value, right wheels negative
        const camberVal = camber * 0.10;  // scale -1..1 → -0.10..0.10
        for (let i = 0; i < 4; i++) {
            // Even index = left wheel (0, 2), odd = right wheel (1, 3)
            const sign = (i % 2 === 0) ? -1 : 1;
            veh.setWheelCamber(i, camberVal * sign);
        }
        // Apply track width: scale proportionally so left/right move in opposite directions
        // e.g. base -1.5 * 1.04 = -1.56 (left moves further left), +1.5 * 1.04 = +1.56 (right further right)
        const twScale = 1.0 + (trackWidth * 0.04);  // scale -1..1 → 0.96..1.04
        for (let i = 0; i < 4; i++) {
            veh.setWheelTrackWidth(i, stanceBaseWheelTW[i] * twScale);
        }
    } catch(e) {}
}

// ─── Fast helper: Re-apply camber + track width without caching (for render loop) ───
function reapplyStanceFast(veh, camber, trackWidth) {
    try {
        const camberVal = camber * 0.10;
        for (let i = 0; i < 4; i++) {
            const sign = (i % 2 === 0) ? -1 : 1;
            veh.setWheelCamber(i, camberVal * sign);
        }
        if (stanceBaseWheelTW[0] !== null) {
            const twScale = 1.0 + (trackWidth * 0.04);
            for (let i = 0; i < 4; i++) {
                veh.setWheelTrackWidth(i, stanceBaseWheelTW[i] * twScale);
            }
        }
    } catch(e) {}
}

// ─── CEF: Cart batch purchase (send to server) ───
mp.events.add('cef:tuning:cartPurchase', (cartJson) => {
    mp.events.callRemote('server:tuning:cartPurchase', cartJson);
});

// ─── Server confirmed cart purchase — update originals for all items ───
mp.events.add('client:tuning:cartConfirmed', (cartResultJson) => {
    try {
        const results = JSON.parse(cartResultJson);
        for (const item of results) {
            if (item.type === 'visual') {
                const mt = parseInt(item.params.modType);
                const mi = parseInt(item.params.modIndex);
                if (mi === -1) delete originalMods[mt]; else originalMods[mt] = mi;
                delete previewedModTypes[mt];
            } else if (item.type === 'color' || item.type === 'finish') {
                colorPreviewed = false;
                if (item.resultColor) {
                    try { originalColor = item.resultColor; } catch(e) {}
                }
            } else if (item.type === 'wheels') {
                if (!originalSpecial) originalSpecial = {};
                originalSpecial.wheelType = item.params.wheelType;
                originalSpecial.wheelIndex = item.params.wheelIndex;
                delete specialPreviewed.wheels;
            } else if (item.type === 'xenon') {
                if (!originalSpecial) originalSpecial = {};
                originalSpecial.xenonEnabled = item.params.enabled;
                originalSpecial.xenonColor = item.params.colorId;
                delete specialPreviewed.xenon;
            } else if (item.type === 'plate') {
                if (!originalSpecial) originalSpecial = {};
                originalSpecial.plateStyle = item.params.plateStyle;
                delete specialPreviewed.plate;
            } else if (item.type === 'neon') {
                if (!originalSpecial) originalSpecial = {};
                originalSpecial.neonEnabled = item.params.bitmask;
                originalSpecial.neonColor = { r: item.params.r, g: item.params.g, b: item.params.b };
                delete specialPreviewed.neon;
            } else if (item.type === 'smoke') {
                if (!originalSpecial) originalSpecial = {};
                originalSpecial.smokeEnabled = item.params.enabled;
                originalSpecial.smokeColor = { r: item.params.r, g: item.params.g, b: item.params.b };
                delete specialPreviewed.smoke;
            }
        }
    } catch(e) {}
});

// ─── Server confirmed special mod purchase — update original so it won't revert ───
mp.events.add('client:tuning:specialConfirmed', (type, dataJson) => {
    try {
        const data = JSON.parse(dataJson);
        if (!originalSpecial) originalSpecial = {};
        if (type === 'wheels') {
            originalSpecial.wheelType = data.wheelType;
            originalSpecial.wheelIndex = data.wheelIndex;
        } else if (type === 'xenon') {
            originalSpecial.xenonEnabled = data.enabled;
            originalSpecial.xenonColor = data.colorId;
        } else if (type === 'plate') {
            originalSpecial.plateStyle = data.plateStyle;
        } else if (type === 'neon') {
            originalSpecial.neonEnabled = data.bitmask;
            originalSpecial.neonColor = data.color;
        } else if (type === 'smoke') {
            originalSpecial.smokeEnabled = data.enabled;
            originalSpecial.smokeColor = data.color;
        } else if (type === 'stance') {
            originalSpecial.camber = data.camber;
            originalSpecial.trackWidth = data.trackWidth;
        }
        delete specialPreviewed[type];
    } catch(e) {}
});

// ─── Orbit camera controls from UI ───
mp.events.add('cef:tuning:orbitCamera', (dx, dy) => {
    if (!tuningCam || !tuningOpen || !orbitCenter) return;
    orbitAngle += parseFloat(dx) * 0.3;
    orbitPitch = Math.max(5, Math.min(60, orbitPitch + parseFloat(dy) * 0.3));
    updateOrbitCamera();
});

mp.events.add('cef:tuning:zoomCamera', (delta) => {
    if (!tuningCam || !tuningOpen || !orbitCenter) return;
    orbitDistance = Math.max(3, Math.min(12, orbitDistance + parseFloat(delta) * 0.003));
    updateOrbitCamera();
});

function updateOrbitCamera() {
    if (!tuningCam || !orbitCenter) return;
    const rad = (orbitAngle * Math.PI) / 180;
    const pitchRad = (orbitPitch * Math.PI) / 180;
    const camX = orbitCenter.x + Math.sin(rad) * Math.cos(pitchRad) * orbitDistance;
    const camY = orbitCenter.y + Math.cos(rad) * Math.cos(pitchRad) * orbitDistance;
    const camZ = orbitCenter.z + Math.sin(pitchRad) * orbitDistance;
    tuningCam.setCoord(camX, camY, camZ);
    tuningCam.pointAtCoord(orbitCenter.x, orbitCenter.y, orbitCenter.z);
}

// ─── ESC to close ───
mp.keys.bind(0x1B, false, () => {
    if (tuningOpen) closeTuning();
});

// ─── Server sends pre-computed handling multipliers when entering owned vehicle ───
mp.events.add('client:tuning:applyHandling', (multipliersJson) => {
    const veh = mp.players.local.vehicle;
    if (!veh) return;

    try {
        const multipliers = JSON.parse(multipliersJson);

        // Cache base handling on first apply
        if (!handlingApplied) {
            // Collect all property names from multipliers
            baseHandling = {};
            for (const prop of Object.keys(multipliers)) {
                try {
                    const val = veh.getHandling(prop);
                    baseHandling[prop] = (typeof val === 'number' && !isNaN(val)) ? val : 1.0;
                } catch(e) {
                    baseHandling[prop] = 1.0;
                }
            }
        }
        applyHandlingMultipliers(veh, multipliers);
    } catch(e) {}
});

// ─── Apply cosmetic mods to any vehicle (shared between enter + stream-in) ───
function applyVehicleCosmetics(vehicle) {
    if (!vehicle || !mp.vehicles.exists(vehicle)) return;

    try {
        // Paint type + pearlescent
        const pt = vehicle.getVariable('paintType');
        const pearl = vehicle.getVariable('pearlColor');
        const pearlIdx = (pearl !== undefined && pearl !== null && pearl >= 0) ? pearl : 0;
        if (pt !== undefined && pt !== null && pt > 0) {
            vehicle.setModColor1(pt, 0, pearlIdx);
            vehicle.setModColor2(pt, 0);
        }
    } catch(e) {}

    // Wheel type
    try {
        const wt = vehicle.getVariable('wheelType');
        if (wt !== undefined && wt !== null) {
            vehicle.setWheelType(wt);
        }
    } catch(e) {}

    // Xenon color
    try {
        const xc = vehicle.getVariable('xenonColor');
        if (xc !== undefined && xc !== null && xc >= 0) {
            applyHeadlightColor(vehicle, xc);
        }
    } catch(e) {}

    // Neon lights
    try {
        const neonStr = vehicle.getVariable('neonData');
        if (neonStr) {
            const neon = JSON.parse(neonStr);
            const mask = neon.enabled || 0;
            for (let i = 0; i < 4; i++) {
                vehicle.setNeonLightEnabled(i, (mask & (1 << i)) !== 0);
            }
            if (mask > 0 && neon.color) {
                vehicle.setNeonLightsColour(neon.color.r, neon.color.g, neon.color.b);
            }
        }
    } catch(e) {}

    // Tyre smoke color
    try {
        const smokeStr = vehicle.getVariable('smokeColor');
        if (smokeStr) {
            const smoke = JSON.parse(smokeStr);
            vehicle.setTyreSmokeColor(smoke.r, smoke.g, smoke.b);
        }
    } catch(e) {}

    // Wheel color via SET_VEHICLE_EXTRA_COLOURS(veh, pearlescent, wheelColor)
    try {
        const wc = vehicle.getVariable('wheelColor');
        if (wc !== undefined && wc !== null && wc >= 0) {
            const pearl = vehicle.getVariable('pearlColor');
            const pearlIdx = (pearl !== undefined && pearl !== null && pearl >= 0) ? pearl : 0;
            mp.game.invoke('0x2036F561ADD12E33', vehicle.handle, pearlIdx, wc);
        }
    } catch(e) {}

    // Suspension height via RageMP API
    try {
        const sh = vehicle.getVariable('suspensionHeight');
        if (sh !== undefined && sh !== null) {
            vehicle.setSuspensionHeight(parseFloat(sh));
        }
    } catch(e) {}

    // Stance (camber + track width) via RageMP API
    try {
        const stanceStr = vehicle.getVariable('stanceData');
        if (stanceStr) {
            const stance = JSON.parse(stanceStr);
            applyStanceToVehicle(vehicle, stance.camber || 0, stance.trackWidth || 0);
        }
    } catch(e) {}
}

// ─── Apply cosmetics when entering a vehicle (driver) ───
mp.events.add('playerEnterVehicle', (vehicle, seat) => {
    if (seat !== -1) return; // only driver
    applyVehicleCosmetics(vehicle);

    // Load persistent stance/suspension for render loop
    try {
        const stanceStr = vehicle.getVariable('stanceData');
        if (stanceStr) {
            const s = JSON.parse(stanceStr);
            if ((s.camber && s.camber !== 0) || (s.trackWidth && s.trackWidth !== 0)) {
                activeStance = { camber: s.camber || 0, trackWidth: s.trackWidth || 0 };
            } else {
                activeStance = null;
            }
        } else {
            activeStance = null;
        }
    } catch(e) { activeStance = null; }
    try {
        const sh = vehicle.getVariable('suspensionHeight');
        activeSuspHeight = (sh !== undefined && sh !== null) ? parseFloat(sh) : null;
        if (activeSuspHeight === 0) activeSuspHeight = null;
    } catch(e) { activeSuspHeight = null; }
    stanceBaseWheelTW = [null, null, null, null]; // re-cache on new vehicle
});

// ─── Clear persistent state when leaving vehicle ───
mp.events.add('playerLeaveVehicle', () => {
    activeStance = null;
    activeSuspHeight = null;
    stanceBaseWheelTW = [null, null, null, null];
});

// ─── Apply cosmetics when ANY vehicle streams in (fixes neon/smoke visibility for all players) ───
mp.events.add('entityStreamIn', (entity) => {
    // Only process vehicles
    if (entity.type !== 'vehicle') return;
    // Small delay to ensure variables are synced
    setTimeout(() => {
        if (entity && mp.vehicles.exists(entity)) {
            applyVehicleCosmetics(entity);
        }
    }, 200);
});

// ─── Render loop: re-apply stance/suspension every frame to prevent physics reset ───
mp.events.add('render', () => {
    const veh = mp.players.local.vehicle;
    if (!veh || !mp.vehicles.exists(veh)) return;

    if (activeStance) {
        reapplyStanceFast(veh, activeStance.camber, activeStance.trackWidth);
    }
    if (activeSuspHeight !== null) {
        try { veh.setSuspensionHeight(activeSuspHeight); } catch(e) {}
    }
});
