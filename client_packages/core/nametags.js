// client_packages/core/nametags.js
// CEF-based nametag system — replaces drawText with a browser overlay

mp.nametags.enabled = false;

// ── CONFIGURATION ─────────────────────────────────────────────────────────────
const SHOW_DISTANCE  = 20.0;
const FADE_START     = 15.0;  // Distance at which tags begin fading out
const UPDATE_RATE    = 1;     // Update every N render frames (1 = every frame)

// ── STATE ─────────────────────────────────────────────────────────────────────
let nametagBrowser = null;
let frameCounter   = 0;

let showSelf = false;
try {
    const saved = mp.storage.data.showSelfTag;
    if (saved !== undefined && saved !== null) showSelf = saved;
} catch (e) {}

// ── BROWSER INIT ──────────────────────────────────────────────────────────────
function createNametagBrowser() {
    if (!nametagBrowser) {
        nametagBrowser = mp.browsers.new('package://ui/nametags.html');
        nametagBrowser.active = true;
    }
}

mp.events.add('playerReady', createNametagBrowser);
if (mp.players.local) createNametagBrowser();

// ── EVENTS ────────────────────────────────────────────────────────────────────
mp.events.add('client:nametags:toggleSelf', (enabled) => {
    showSelf = enabled;
});

// ── HELPERS ───────────────────────────────────────────────────────────────────

/**
 * Project a world-space position to screen-space pixels.
 * Returns null if behind camera or off-screen.
 */
function worldToScreen(pos) {
    // world3dToScreen2d returns normalized 0.0–1.0 coords directly
    const result = mp.game.graphics.world3dToScreen2d({ x: pos.x, y: pos.y, z: pos.z });
    if (!result) return null;
    if (result.x < -0.1 || result.x > 1.1 || result.y < -0.1 || result.y > 1.1) return null;
    return { x: result.x, y: result.y }; // normalized — HTML side uses vw/vh
}

/**
 * Compute alpha 0-255 based on distance.
 * Full opacity near, fade out approaching SHOW_DISTANCE.
 */
function distAlpha(dist) {
    if (dist >= SHOW_DISTANCE) return 0;
    if (dist <= FADE_START)    return 255;
    const t = (dist - FADE_START) / (SHOW_DISTANCE - FADE_START);
    return Math.round((1 - t) * 255);
}

function clamp(v) { return Math.min(255, Math.max(0, v)); }

// ── RENDER LOOP ───────────────────────────────────────────────────────────────
mp.events.add('render', () => {
    if (!nametagBrowser) return;

    frameCounter++;
    if (frameCounter % UPDATE_RATE !== 0) return;

    const localPlayer = mp.players.local;
    if (!localPlayer) return;

    const cam      = mp.cameras.new('gameplay').getCoord();
    const streamed = mp.players.streamed;
    const activeIds = [];

    streamed.forEach((player) => {
        if (player === localPlayer && !showSelf) return;
        if (!player.handle || player.getAlpha() === 0) return;

        const pPos = player.getBoneCoords(12844, 0, 0, 0); // head bone

        const dx   = cam.x - pPos.x;
        const dy   = cam.y - pPos.y;
        const dz   = cam.z - pPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist >= SHOW_DISTANCE) return;

        // Project ~30cm above head bone so anchor sits above the skull
        const screen = worldToScreen({ x: pPos.x, y: pPos.y, z: pPos.z + 0.30 });
        if (!screen) return;

        const alpha = distAlpha(dist);
        if (alpha === 0) return;

        // ── Gather variables ──────────────────────────────────────────────────
        let displayId = player.getVariable('onlineId');
        if (displayId === undefined) displayId = player.remoteId;

        const isTyping   = !!player.getVariable('isTyping');
        const isAfk      = !!player.getVariable('isAfk');
        const wantedType = player.getVariable('wantedType') || null;

        const familyName         = player.getVariable('familyName')         || null;
        const familyNametagColor = player.getVariable('familyNametagColor') || null;
        const factionNametagColor = player.getVariable('factionNametagColor');

        let color = [255, 255, 255, 255];
        if (Array.isArray(factionNametagColor) && factionNametagColor.length >= 3) {
            color = [
                clamp(parseInt(factionNametagColor[0]) || 0),
                clamp(parseInt(factionNametagColor[1]) || 0),
                clamp(parseInt(factionNametagColor[2]) || 0),
                factionNametagColor[3] !== undefined ? clamp(parseInt(factionNametagColor[3]) || 255) : 255,
            ];
        }

        const familyColor = Array.isArray(familyNametagColor) ? [
            clamp(parseInt(familyNametagColor[0]) || 0),
            clamp(parseInt(familyNametagColor[1]) || 0),
            clamp(parseInt(familyNametagColor[2]) || 0),
        ] : null;

        // ── Build and push data ───────────────────────────────────────────────
        const id   = player.remoteId;
        const data = {
            x: screen.x,
            y: screen.y,
            name: player.name,
            displayId,
            color,
            familyName,
            familyColor,
            isTyping,
            isAfk,
            wantedType,
            alpha,
        };

        activeIds.push(id);
        nametagBrowser.execute(`updateNametag(${id}, ${JSON.stringify(data)});`);
    });

    // Prune stale tags every ~2 seconds
    if (frameCounter % 120 === 0) {
        nametagBrowser.execute(
            `(function(active){ var s = new Set(active); tags.forEach(function(_,id){ if(!s.has(id)) removeNametag(id); }); })(${JSON.stringify(activeIds)});`
        );
    }
});