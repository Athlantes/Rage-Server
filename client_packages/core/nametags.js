// client_packages/core/nametags.js

// 1. Disable default RageMP tags
mp.nametags.enabled = false;

// --- CONFIGURATION ---
const SHOW_DISTANCE = 20.0; // Increased distance slightly (from 15 to 20)
const FONT_ID = 4;          // Font 4 (Chalet London) is clean. 
const FONT_SCALE = 0.6;     // INCREASED from 0.4 to 1.0

// --- SETTINGS STATE ---
let showSelf = false; 

mp.events.add('client:nametags:toggleSelf', (enabled) => {
    showSelf = enabled;
});

mp.events.add('render', () => {
    const localPlayer = mp.players.local;
    if (!localPlayer) return;

    const camPos = mp.cameras.new('gameplay').getCoord();

    mp.players.streamed.forEach((player) => {
        // Self Check
        if (player === localPlayer && !showSelf) return;

        // Skip invalid/dead
        if (!player.handle || player.getAlpha() === 0) return;

        // Distance Check
        const pPos = player.getBoneCoords(12844, 0, 0, 0); // Head
        const distSq = (camPos.x - pPos.x) ** 2 + (camPos.y - pPos.y) ** 2 + (camPos.z - pPos.z) ** 2;

        if (distSq < (SHOW_DISTANCE * SHOW_DISTANCE)) {
            const hasLos = mp.game.system.vdist(localPlayer.position.x, localPlayer.position.y, localPlayer.position.z, pPos.x, pPos.y, pPos.z) < SHOW_DISTANCE;

            if (hasLos) {
                let displayId = player.getVariable('onlineId');
                if (displayId === undefined) displayId = player.remoteId;

                const isTyping = player.getVariable('isTyping');

                let nameText = `(${displayId}) ${player.name}`;
                if (isTyping) nameText += "\n~c~...";

                // --- SCALING LOGIC ---
                const dist = Math.sqrt(distSq);
                
                let scale = Math.max(0.4, 1.0 - (dist / SHOW_DISTANCE));
                
                // Apply our Base Scale
                scale = scale * FONT_SCALE;

                // Draw
                mp.game.graphics.drawText(nameText, [pPos.x, pPos.y, pPos.z + 0.6], {
                    font: FONT_ID,
                    color: [255, 255, 255, 255],
                    scale: [scale, scale],
                    outline: true,
                    centre: true
                });
            }
        }
    });
});