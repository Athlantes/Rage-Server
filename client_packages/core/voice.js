// client_packages/core/voice.js

const MAX_VOICE_RANGE = 20.0;
let isVoiceEnabled = false;   // Current PTT state (Holding N?)

// Load persisted settings from mp.storage
let masterVolume = 1.0;
let isSystemEnabled = true;
try {
    const savedVol = mp.storage.data.voiceVolume;
    if (savedVol !== undefined && savedVol !== null) masterVolume = savedVol / 100.0;
    const savedEnabled = mp.storage.data.voiceEnabled;
    if (savedEnabled !== undefined && savedEnabled !== null) isSystemEnabled = savedEnabled;
} catch(e) {}

// 1. Configuration
mp.voiceChat.muted = true;
mp.gui.chat.show(false);

// --- EVENT: Volume Slider ---
mp.events.add('client:voice:setVolume', (percentage) => {
    masterVolume = percentage / 100.0;
    try { mp.storage.data.voiceVolume = percentage; mp.storage.flush(); } catch(e) {}
});

// --- EVENT: System Toggle ---
mp.events.add('client:voice:toggleSystem', (enabled) => {
    isSystemEnabled = enabled;
    try { mp.storage.data.voiceEnabled = enabled; mp.storage.flush(); } catch(e) {}
    
    if (!isSystemEnabled) {
        // Immediately silence everyone
        mp.players.forEach(p => { p.voiceVolume = 0.0; });
        
        // Force stop talking if holding N
        if (isVoiceEnabled) {
            isVoiceEnabled = false;
            mp.voiceChat.muted = true;
            mp.events.call('client:ui:toggleMic', false);
        }
    }
});

// 2. Push-To-Talk (Key: N)
mp.keys.bind(0x4E, true, () => { // N key down
    if (mp.gui.cursor.visible) return; 
    if (!isSystemEnabled) return; // Cannot talk if disabled in settings
    
    if (!isVoiceEnabled) {
        isVoiceEnabled = true;
        mp.voiceChat.muted = false;
        mp.events.call('client:ui:toggleMic', true);
        mp.game.audio.playSoundFrontend(-1, "TOGGLE_ON", "HUD_FRONTEND_DEFAULT_SOUNDSET", true);
    }
});

mp.keys.bind(0x4E, false, () => { // N key up
    if (isVoiceEnabled) { // Only stop if we were actually started
        isVoiceEnabled = false;
        mp.voiceChat.muted = true;
        mp.events.call('client:ui:toggleMic', false);
        mp.game.audio.playSoundFrontend(-1, "TOGGLE_OFF", "HUD_FRONTEND_DEFAULT_SOUNDSET", true);
    }
});

// 3. 3D Audio Processor
mp.events.add('render', () => {
    // If system is disabled, do nothing (everyone stays muted from the toggle event)
    if (!isSystemEnabled) return; 

    const localPlayer = mp.players.local;
    const localPos = localPlayer.position;

    mp.players.forEachInStreamRange(player => {
        if (player === localPlayer) return;

        if (!player.voice3d) player.voice3d = true; 

        const dist = mp.game.system.vdist(localPos.x, localPos.y, localPos.z, player.position.x, player.position.y, player.position.z);
        
        let volume = 1 - (dist / MAX_VOICE_RANGE);
        if (volume < 0) volume = 0;

        // Apply Master Volume
        volume = volume * masterVolume;

        if (dist > MAX_VOICE_RANGE) { 
            player.voiceVolume = 0.0; 
            player.voice3d = false; 
        } else {
            player.voiceVolume = volume;
            player.voice3d = true;
        }
    });
});