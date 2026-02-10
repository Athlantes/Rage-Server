// client_packages/core/nametags.js

// 1. Disable the default RageMP nametags (health bars, huge text)
mp.nametags.enabled = false;

// --- CONFIGURATION ---
const SHOW_DISTANCE = 15.0; // Distance to see names (same as voice range usually)
const FONT_ID = 4;          // Font 4 is "Chalet London" (clean and compact)
const FONT_SCALE = 0.4;     // Base text size

mp.events.add('render', () => {
    const localPlayer = mp.players.local;
    if (!localPlayer) return;

    // Get camera position for distance calculations
    const camPos = mp.cameras.new('gameplay').getCoord();

    // 2. Optimization: Only loop through 'streamed' players (those actually loaded by the game)
    mp.players.streamed.forEach((player) => {
        // Skip ourselves
        if (player === localPlayer) return;

        // Skip invalid, dead, or invisible players
        if (!player.handle || player.getAlpha() === 0) return;

        // 3. Fast Distance Check
        const pPos = player.getBoneCoords(12844, 0, 0, 0); // Head Bone
        const distSq = (camPos.x - pPos.x) ** 2 + (camPos.y - pPos.y) ** 2 + (camPos.z - pPos.z) ** 2;

        if (distSq < (SHOW_DISTANCE * SHOW_DISTANCE)) {
            // Optional: Line of Sight check (remove if you want to see names through walls)
            const hasLos = mp.game.system.vdist(localPlayer.position.x, localPlayer.position.y, localPlayer.position.z, pPos.x, pPos.y, pPos.z) < SHOW_DISTANCE;
            
            if (hasLos) {
                // 4. Determine Display ID
                // Tries to get your custom 'onlineId', falls back to RageMP remoteId
                let displayId = player.getVariable('onlineId');
                if (displayId === undefined || displayId === null) displayId = player.remoteId;

                // 5. Check for Typing Status (Synced Variable)
                const isTyping = player.getVariable('isTyping');

                // 6. Format the Text
                // Result: "(12) Admin" or "(12) Admin \n ..."
                let nameText = `(${displayId}) ${player.name}`;
                
                if (isTyping) {
                    // \n = New Line, ~c~ = Grey Color
                    nameText += "\n~c~..."; 
                }

                // 7. Dynamic Scaling
                // Text gets smaller as you walk away
                const dist = Math.sqrt(distSq);
                const scale = Math.max(0.2, 1.0 - (dist / SHOW_DISTANCE)) * FONT_SCALE;

                // 8. Draw
                mp.game.graphics.drawText(nameText, [pPos.x, pPos.y, pPos.z + 0.6], {
                    font: FONT_ID,
                    color: [255, 255, 255, 255], // White
                    scale: [scale, scale],
                    outline: true,
                    centre: true
                });
            }
        }
    });
});