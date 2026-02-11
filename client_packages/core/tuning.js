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
function forceHeadlights(veh, on) {
    try { veh.setLights(on ? 2 : 0); } catch(e) {
        try { mp.game.invoke('0x34E710FF01247C5A', veh.handle, on ? 2 : 0); } catch(e2) {}
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

    // Reduce grip so rear wheels spin easier
    try { veh.setBurnout(true); } catch(e) {
        try { mp.game.invoke('0xFB8794444A7D60FB', veh.handle, true); } catch(e2) {}
    }

    if (!burnoutActive) {
        burnoutActive = true;
        // Force accelerate + brake every frame to produce visible burnout smoke
        burnoutRenderHandler = () => {
            if (!burnoutActive || !veh || !mp.vehicles.exists(veh)) return;
            try {
                // Enable these controls even while cursor is active
                mp.game.invoke('0x351220255D64C155', 0, 71, true); // ENABLE_CONTROL_ACTION: VEH_ACCELERATE
                mp.game.invoke('0x351220255D64C155', 0, 72, true); // ENABLE_CONTROL_ACTION: VEH_BRAKE
            } catch(e) {}
            try {
                mp.game.pad.setControlNormal(0, 71, 1.0); // Full throttle
                mp.game.pad.setControlNormal(0, 72, 1.0); // Full brake
            } catch(e) {
                try {
                    mp.game.invoke('0xE8A25867FBA3B05E', 0, 71, 1.0);
                    mp.game.invoke('0xE8A25867FBA3B05E', 0, 72, 1.0);
                } catch(e2) {}
            }
        };
        mp.events.add('render', burnoutRenderHandler);
    }

    burnoutTimer = setTimeout(() => {
        stopBurnout(veh);
    }, 4000);
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
mp.events.add('client:tuning:open', (perfDataJson, visualModsJson, visualPricingJson, playerInfoJson, currentModsJson, vehicleDbId, paintTypesJson, presetColorsJson, colorPricingJson, colorDataJson, specialDataJson) => {
    const veh = mp.players.local.vehicle;
    if (!veh) return;

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
        const rad = (heading * Math.PI) / 180;

        const camX = pos.x - Math.sin(rad) * 6;
        const camY = pos.y + Math.cos(rad) * 6;
        const camZ = pos.z + 1.8;

        tuningCam = mp.cameras.new('default',
            new mp.Vector3(camX, camY, camZ),
            new mp.Vector3(0, 0, 0), 55
        );
        tuningCam.pointAtCoord(pos.x, pos.y, pos.z + 0.5);
        tuningCam.setActive(true);
        mp.game.cam.renderScriptCams(true, true, 600, true, false);

        // Create browser
        tuningBrowser = mp.browsers.new('package://ui/tuning/index.html');
    }

    // Save original state for revert on close
    const currentModsParsed = JSON.parse(currentModsJson);
    originalMods = { ...currentModsParsed };
    previewedModTypes = {};
    colorPreviewed = false;
    specialPreviewed = {};
    try {
        originalColor = JSON.parse(colorDataJson || '{}');
        if (!originalColor.primRGB) originalColor = { primRGB: {r:0,g:0,b:0}, secRGB: {r:0,g:0,b:0}, paintType: 0 };
    } catch(e) {
        originalColor = { primRGB: {r:0,g:0,b:0}, secRGB: {r:0,g:0,b:0}, paintType: 0 };
    }

    // Save original special mod state
    try {
        const sd = JSON.parse(specialDataJson || '{}');
        originalSpecial = sd.current ? { ...sd.current } : null;
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

        // Scan available visual mods now (after mod kit is active)
        const visualMods = JSON.parse(visualModsJson);
        const availableVisuals = {};
        for (const [key, mod] of Object.entries(visualMods)) {
            const count = curVeh.getNumMods(mod.modType);
            if (count > 0) {
                availableVisuals[key] = {
                    ...mod,
                    options: count
                };
            }
        }

        tuningBrowser.execute(`initTuning(
            ${perfDataJson},
            ${JSON.stringify(availableVisuals)},
            ${visualPricingJson},
            ${playerInfoJson},
            ${currentModsJson},
            ${vehicleDbId},
            ${paintTypesJson || '[]'},
            ${presetColorsJson || '[]'},
            ${colorPricingJson || '{}'},
            ${colorDataJson || '{}'},
            ${specialDataJson || '{}'}
        )`);
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
        }
    }
    previewedModTypes = {};
    colorPreviewed = false;
    specialPreviewed = {};

    // Stop burnout and revert headlights if forced
    if (veh) {
        if (burnoutActive) stopBurnout(veh);
        if (forcedLightsOn) {
            forceHeadlights(veh, false);
            forcedLightsOn = false;
        }
    }

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
mp.events.add('cef:tuning:perfUpgrade', (modKey) => {
    mp.events.callRemote('server:tuning:perfUpgrade', modKey);
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
});

// ─── Server confirmed visual mod purchase — update original so it won't revert ───
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

// ─── CEF: Preview color (client-side only, no save) ───
mp.events.add('cef:tuning:previewColor', (primR, primG, primB, secR, secG, secB, paintType) => {
    const veh = mp.players.local.vehicle;
    if (!veh) return;
    colorPreviewed = true;
    try {
        // Paint type/finish MUST be set before custom RGB, otherwise it resets the colors
        const pt = parseInt(paintType) || 0;
        veh.setModColor1(pt, 0, 0);
        veh.setModColor2(pt, 0);

        applyCustomPrimaryColor(veh, parseInt(primR), parseInt(primG), parseInt(primB));
        applyCustomSecondaryColor(veh, parseInt(secR), parseInt(secG), parseInt(secB));
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
        veh.setModColor1(pt, 0, 0);
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

// ─── CEF: Apply wheels (send to server) ───
mp.events.add('cef:tuning:applyWheels', (wheelType, wheelIndex) => {
    mp.events.callRemote('server:tuning:applyWheels', wheelType.toString(), wheelIndex.toString());
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
            // Force headlights on so player can see the xenon color
            forceHeadlights(veh, true);
            forcedLightsOn = true;
        } else {
            veh.setMod(22, -1);
            if (forcedLightsOn) {
                forceHeadlights(veh, false);
                forcedLightsOn = false;
            }
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
    try { veh.numberPlateType = parseInt(plateId); } catch(e) {}
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
        }
        delete specialPreviewed[type];
    } catch(e) {}
});

// ─── Camera rotation from UI ───
mp.events.add('cef:tuning:rotateCamera', (angle) => {
    if (!tuningCam || !tuningOpen) return;
    const veh = mp.players.local.vehicle;
    if (!veh) return;

    const pos = veh.position;
    const rad = (parseFloat(angle) * Math.PI) / 180;
    const camX = pos.x + Math.sin(rad) * 6;
    const camY = pos.y + Math.cos(rad) * 6;
    const camZ = pos.z + 1.8;

    tuningCam.setCoord(camX, camY, camZ);
    tuningCam.pointAtCoord(pos.x, pos.y, pos.z + 0.5);
});

// ─── ESC to close ───
mp.keys.bind(0x1B, false, () => {
    if (tuningOpen) closeTuning();
});

// ─── Apply special mods when entering a vehicle ───
mp.events.add('playerEnterVehicle', (vehicle, seat) => {
    if (seat !== -1) return; // only driver
    try {
        // Paint type
        const pt = vehicle.getVariable('paintType');
        if (pt !== undefined && pt !== null && pt > 0) {
            vehicle.setModColor1(pt, 0, 0);
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
});
