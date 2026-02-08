// packages/core/voiceManager.js

const VOICE_RANGE = 20.0; // 20 meters for local talking

// Store radio frequencies: player.id -> frequency (0 = off)
mp.players.forEach(player => { player.voiceFreq = 0; });

mp.events.add('playerJoin', (player) => {
    player.voiceFreq = 0;
});

// Event to set radio frequency (Call this from your item/job scripts)
mp.events.add('server:voice:setRadioFreq', (player, freq) => {
    player.voiceFreq = freq;
    player.notify(`Radio set to channel: ${freq}`);
});

// The Heartbeat: Updates listeners based on distance and channels
setInterval(() => {
    mp.players.forEach(player => {
        mp.players.forEach(target => {
            if (player === target) return;

            const dist = player.dist(target.position);
            
            // 1. Proximity Check (Local 3D Voice)
            if (dist < VOICE_RANGE) {
                player.enableVoiceTo(target);
            } 
            // 2. Radio Channel Check (Walkie-Talkie)
            else if (player.voiceFreq !== 0 && player.voiceFreq === target.voiceFreq) {
                player.enableVoiceTo(target);
            }
            // 3. Phone Call Logic (Example hook)
            else if (player.getVariable('callPartnerId') === target.id) {
                player.enableVoiceTo(target);
            }
            // 4. Otherwise, disable voice
            else {
                player.disableVoiceTo(target);
            }
        });
    });
}, 500); // Check every 500ms