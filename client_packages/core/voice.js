// client_packages/core/voice.js

const MAX_VOICE_RANGE = 20.0;
let isVoiceEnabled = false;

// 1. Configuration
mp.voiceChat.muted = true;
mp.gui.chat.show(true);

// 2. Push-To-Talk (Key: N)
mp.keys.bind(0x4E, true, () => { // N key down
    if (mp.gui.cursor.visible) return; 
    
    if (!isVoiceEnabled) {
        isVoiceEnabled = true;
        mp.voiceChat.muted = false;
        
        // Update UI
        mp.events.call('client:ui:toggleMic', true);
        
        mp.game.audio.playSoundFrontend(-1, "NAV_UP_DOWN", "HUD_FRONTEND_DEFAULT_SOUNDSET", true);
    }
});

mp.keys.bind(0x4E, false, () => { // N key up
    if (isVoiceEnabled) {
        isVoiceEnabled = false;
        mp.voiceChat.muted = true;
        
        // Update UI
        mp.events.call('client:ui:toggleMic', false);

        mp.game.audio.playSoundFrontend(-1, "CANCEL", "HUD_FRONTEND_DEFAULT_SOUNDSET", true);
    }
});

// 3. 3D Audio Processor (Volume Control)
mp.events.add('render', () => {
    const localPlayer = mp.players.local;
    const localPos = localPlayer.position;

    mp.players.forEachInStreamRange(player => {
        if (player === localPlayer) return;

        if (!player.voice3d) player.voice3d = true; 

        const dist = mp.game.system.vdist(localPos.x, localPos.y, localPos.z, player.position.x, player.position.y, player.position.z);
        
        let volume = 1 - (dist / MAX_VOICE_RANGE);
        if (volume < 0) volume = 0;

        if (dist > MAX_VOICE_RANGE) { 
            player.voiceVolume = 1.0; 
            player.voice3d = false; 
        } else {
            player.voiceVolume = volume;
            player.voice3d = true;
        }
    });
});