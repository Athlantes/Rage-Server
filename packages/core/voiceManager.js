// packages/core/voiceManager.js
// Optimized: Uses forEachInRange for proximity (O(n) per player),
// targeted checks for radio/phone (only iterates relevant players).

const VOICE_RANGE = 20.0;

// --- State Tracking ---
// Track active voice links to avoid redundant enable/disable calls
const voiceLinks = new Map(); // playerId -> Set<targetId>
const radioChannels = new Map(); // frequency -> Set<playerId>
const activeCalls = new Map(); // playerId -> partnerId

function getLinks(playerId) {
    if (!voiceLinks.has(playerId)) voiceLinks.set(playerId, new Set());
    return voiceLinks.get(playerId);
}

mp.events.add('playerJoin', (player) => {
    player.voiceFreq = 0;
    voiceLinks.set(player.id, new Set());
});

mp.events.add('playerQuit', (player) => {
    // Clean up radio channel
    if (player.voiceFreq !== 0) {
        const ch = radioChannels.get(player.voiceFreq);
        if (ch) { ch.delete(player.id); if (ch.size === 0) radioChannels.delete(player.voiceFreq); }
    }
    // Clean up active call
    if (activeCalls.has(player.id)) {
        const partnerId = activeCalls.get(player.id);
        activeCalls.delete(player.id);
        activeCalls.delete(partnerId);
        const partner = mp.players.at(partnerId);
        if (partner && mp.players.exists(partner)) {
            partner.setVariable('callPartnerId', null);
            partner.setVariable('callState', null);
            partner.call('client:phone:callEnded', ['Partner disconnected.']);
        }
    }
    voiceLinks.delete(player.id);
});

// --- Radio Frequency Management (Optimized with channel index) ---
mp.events.add('server:voice:setRadioFreq', (player, freq) => {
    // Remove from old channel
    if (player.voiceFreq !== 0) {
        const oldCh = radioChannels.get(player.voiceFreq);
        if (oldCh) { oldCh.delete(player.id); if (oldCh.size === 0) radioChannels.delete(player.voiceFreq); }
    }
    // Add to new channel
    player.voiceFreq = freq;
    if (freq !== 0) {
        if (!radioChannels.has(freq)) radioChannels.set(freq, new Set());
        radioChannels.get(freq).add(player.id);
    }
    player.call('showNotification', ['Radio', `Channel set to: ${freq}`]);
});

// --- Phone Call Management (Public API for phoneManager) ---
const CallManager = {
    startCall: (callerId, targetId) => {
        activeCalls.set(callerId, targetId);
        activeCalls.set(targetId, callerId);
    },
    endCall: (playerId) => {
        const partnerId = activeCalls.get(playerId);
        activeCalls.delete(playerId);
        if (partnerId !== undefined) activeCalls.delete(partnerId);
        return partnerId;
    },
    getPartner: (playerId) => activeCalls.get(playerId),
    isInCall: (playerId) => activeCalls.has(playerId)
};

module.exports = CallManager;

// --- Optimized Voice Loop ---
setInterval(() => {
    const allPlayers = mp.players.toArray().filter(p => p && mp.players.exists(p));
    
    allPlayers.forEach(player => {
        const currentLinks = getLinks(player.id);
        const newLinks = new Set();

        // 1. PROXIMITY: O(n) via engine range check
        mp.players.forEachInRange(player.position, VOICE_RANGE, (target) => {
            if (target.id === player.id) return;
            newLinks.add(target.id);
        });

        // 2. RADIO: Only check players on the same frequency (indexed lookup)
        if (player.voiceFreq !== 0) {
            const channelMembers = radioChannels.get(player.voiceFreq);
            if (channelMembers) {
                channelMembers.forEach(targetId => {
                    if (targetId !== player.id) newLinks.add(targetId);
                });
            }
        }

        // 3. PHONE CALL: Direct O(1) lookup
        const callPartnerId = activeCalls.get(player.id);
        if (callPartnerId !== undefined) newLinks.add(callPartnerId);

        // 4. DIFF: Only call enable/disable when state changes
        // Enable new links
        newLinks.forEach(targetId => {
            if (!currentLinks.has(targetId)) {
                const target = mp.players.at(targetId);
                if (target && mp.players.exists(target)) {
                    player.enableVoiceTo(target);
                }
            }
        });

        // Disable removed links
        currentLinks.forEach(targetId => {
            if (!newLinks.has(targetId)) {
                const target = mp.players.at(targetId);
                if (target && mp.players.exists(target)) {
                    player.disableVoiceTo(target);
                }
            }
        });

        // Update stored state
        voiceLinks.set(player.id, newLinks);
    });
}, 500);