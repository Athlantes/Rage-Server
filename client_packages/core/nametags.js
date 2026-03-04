// client_packages/core/nametags.js

// Disable default RageMP tags
mp.nametags.enabled = false;

// --- CONFIGURATION ---
const SHOW_DISTANCE = 20.0;
const FONT_ID       = 4;     // Chalet London — clean, readable
const FONT_SCALE    = 0.6;

// --- SETTINGS STATE ---
let showSelf = false;
try {
    const saved = mp.storage.data.showSelfTag;
    if (saved !== undefined && saved !== null) showSelf = saved;
} catch(e) {}

mp.events.add('client:nametags:toggleSelf', (enabled) => {
    showSelf = enabled;
});

// Helper: convert 6-char hex string → [r, g, b]
function hexStrToRgb(hex) {
    if (!hex || hex.length < 6) return [255, 255, 255];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return [
        isNaN(r) ? 255 : r,
        isNaN(g) ? 255 : g,
        isNaN(b) ? 255 : b,
    ];
}

mp.events.add('render', () => {
    const localPlayer = mp.players.local;
    if (!localPlayer) return;

    const camPos = mp.cameras.new('gameplay').getCoord();

    mp.players.streamed.forEach((player) => {
        // Self check
        if (player === localPlayer && !showSelf) return;

        // Skip invisible / dead
        if (!player.handle || player.getAlpha() === 0) return;

        // Distance check
        const pPos   = player.getBoneCoords(12844, 0, 0, 0); // Head bone
        const distSq = (camPos.x - pPos.x) ** 2 +
                       (camPos.y - pPos.y) ** 2 +
                       (camPos.z - pPos.z) ** 2;

        if (distSq >= SHOW_DISTANCE * SHOW_DISTANCE) return;

        const hasLos = mp.game.system.vdist(
            localPlayer.position.x, localPlayer.position.y, localPlayer.position.z,
            pPos.x, pPos.y, pPos.z
        ) < SHOW_DISTANCE;

        if (!hasLos) return;

        // ── Compute display info ──────────────────────────────────────────────
        let displayId = player.getVariable('onlineId');
        if (displayId === undefined) displayId = player.remoteId;

        const isTyping = player.getVariable('isTyping');
        const isAfk    = player.getVariable('isAfk');

        let nameText = `(${displayId}) ${player.name}`;
        if (isAfk)         nameText += '\n~r~AFK';
        else if (isTyping) nameText += '\n~c~...';

        // Dynamic scale based on distance
        const dist  = Math.sqrt(distSq);
        const scale = Math.max(0.4, 1.0 - (dist / SHOW_DISTANCE)) * FONT_SCALE;

        // ── Family tag (unchanged feature) ───────────────────────────────────
        const familyName         = player.getVariable('familyName'); // Changed from familyTag
        const familyNametagColor = player.getVariable('familyNametagColor');

        if (familyName && familyNametagColor) {
            // Coerce to integers and clamp 0-255 (handles variables that arrive as strings)
            const fr = Math.min(255, Math.max(0, parseInt(familyNametagColor[0], 10) || 0));
            const fg = Math.min(255, Math.max(0, parseInt(familyNametagColor[1], 10) || 0));
            const fb = Math.min(255, Math.max(0, parseInt(familyNametagColor[2], 10) || 0));
            mp.game.graphics.drawText(familyName, [pPos.x, pPos.y, pPos.z + 0.75], {
                font:    FONT_ID,
                color:   [fr, fg, fb, 210],
                scale:   [scale * 0.85, scale * 0.85],
                outline: true,
                centre:  true,
            });
        }

        // Name color: prefer faction duty color when available, otherwise default white
        const factionNametagColor = player.getVariable('factionNametagColor');
        let nameColor = [255, 255, 255, 255]; // default: white
        if (factionNametagColor && Array.isArray(factionNametagColor) && factionNametagColor.length >= 3) {
            const fr = Math.min(255, Math.max(0, parseInt(factionNametagColor[0], 10) || 0));
            const fg = Math.min(255, Math.max(0, parseInt(factionNametagColor[1], 10) || 0));
            const fb = Math.min(255, Math.max(0, parseInt(factionNametagColor[2], 10) || 0));
            const fa = factionNametagColor[3] !== undefined ? Math.min(255, Math.max(0, parseInt(factionNametagColor[3], 10) || 0)) : 255;
            nameColor = [fr, fg, fb, fa];
        }

        // ── Draw nametag ──────────────────────────────────────────────────────
        mp.game.graphics.drawText(nameText, [pPos.x, pPos.y, pPos.z + 0.6], {
            font:    FONT_ID,
            color:   nameColor,
            scale:   [scale, scale],
            outline: true,
            centre:  true,
        });

        // ── Wanted indicator (visible to all nearby players) ──────────────────
        const wantedType = player.getVariable('wantedType');
        if (wantedType) {
            const wantedText = wantedType === 'NoS' ? '⚠ NO SURRENDER' : '🚔 WANTED';
            const wantedColor = wantedType === 'NoS' ? [255, 71, 87, 230] : [255, 195, 0, 230];
            mp.game.graphics.drawText(wantedText, [pPos.x, pPos.y, pPos.z + 0.82], {
                font:    FONT_ID,
                color:   wantedColor,
                scale:   [scale * 0.75, scale * 0.75],
                outline: true,
                centre:  true,
            });
        }
});
});