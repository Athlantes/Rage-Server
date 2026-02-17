// client_packages/core/nametags.js
// ─────────────────────────────────────────────────────────────────────────────
//  Custom Nametag Renderer
//  • Faction members ON DUTY → name rendered in faction color (no floating tag)
//  • Family tag still shown above the name (separate feature)
//  • Off-duty / no faction → white name
// ─────────────────────────────────────────────────────────────────────────────

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
    return [
        parseInt(hex.slice(0, 2), 16) || 255,
        parseInt(hex.slice(2, 4), 16) || 255,
        parseInt(hex.slice(4, 6), 16) || 255,
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
        if (isAfk)         nameText += '\n~r~⏳ AFK';
        else if (isTyping) nameText += '\n~c~...';

        // Dynamic scale based on distance
        const dist  = Math.sqrt(distSq);
        const scale = Math.max(0.4, 1.0 - (dist / SHOW_DISTANCE)) * FONT_SCALE;

        // ── Family tag (unchanged feature) ───────────────────────────────────
        const familyTag          = player.getVariable('familyTag');
        const familyNametagColor = player.getVariable('familyNametagColor');

        if (familyTag && familyNametagColor) {
            const [r, g, b] = familyNametagColor;
            mp.game.graphics.drawText(`[${familyTag}]`, [pPos.x, pPos.y, pPos.z + 0.88], {
                font:    FONT_ID,
                color:   [r, g, b, 210],
                scale:   [scale * 0.85, scale * 0.85],
                outline: true,
                centre:  true,
            });
        }

        // ── Name color: faction color when ON DUTY, white otherwise ──────────
        const isOnDuty      = player.getVariable('isOnDuty');
        const factionColor  = player.getVariable('factionColor'); // 6-char hex, no #

        let nameColor = [255, 255, 255, 255]; // default: white

        if (isOnDuty && factionColor) {
            const [r, g, b] = hexStrToRgb(factionColor);
            nameColor = [r, g, b, 255];
        }

        // ── Draw nametag ──────────────────────────────────────────────────────
        mp.game.graphics.drawText(nameText, [pPos.x, pPos.y, pPos.z + 0.6], {
            font:    FONT_ID,
            color:   nameColor,
            scale:   [scale, scale],
            outline: true,
            centre:  true,
        });
    });
});
