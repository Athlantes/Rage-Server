// List of dumpster model names to detect
const DUMPSTER_MODELS = [
    'prop_dumpster_01a', 'prop_dumpster_02a', 'prop_dumpster_02b',
    'prop_dumpster_3a', 'prop_dumpster_4a', 'prop_dumpster_4b',
    'prop_bin_05a', 'prop_bin_06a', 'prop_bin_07a', 'prop_bin_07b',
    'prop_bin_07c', 'prop_bin_07d', 'prop_bin_14a'
];

// Convert strings to Hashes for faster checking
const DUMPSTER_HASHES = DUMPSTER_MODELS.map(name => mp.game.joaat(name));

let nearbyDumpster = null;
let lastInteractionState = false; 

// 1. Detection Loop (Runs every 250ms)
setInterval(() => {
    const player = mp.players.local;
    let found = null;

    // --- NEW: Cooldown Check ---
    // We check the variable synced from auth.js
    const cooldownExpiry = player.getVariable('cooldown_dumpster');
    const isOnCooldown = cooldownExpiry && Date.now() < cooldownExpiry;

    // If we are on cooldown, force the UI to hide and skip detection
    if (isOnCooldown) {
        nearbyDumpster = null;
        if (lastInteractionState) {
            mp.events.call('hideInteraction');
            lastInteractionState = false;
        }
        return; // Stop here, don't even look for objects
    }
    // ---------------------------

    // We check all hashes
    for (const hash of DUMPSTER_HASHES) {
        const handle = mp.game.object.getClosestObjectOfType(
            player.position.x, player.position.y, player.position.z,
            1, 
            hash, 
            false, false, false
        );

        if (handle && handle !== 0) {
            found = handle;
            break; 
        }
    }

    if (found) {
        nearbyDumpster = found;
        if (!lastInteractionState) {
            mp.events.call('showInteraction', 'Dumpster', 'Press E to Search');
            lastInteractionState = true;
        }
    } else {
        nearbyDumpster = null;
        if (lastInteractionState) {
            mp.events.call('hideInteraction');
            lastInteractionState = false;
        }
    }
}, 250);

// 2. Key Handler (E)
mp.keys.bind(0x45, true, () => { 
    if (mp.gui.cursor.visible) return; 
    
    // Double check cooldown here just in case
    const player = mp.players.local;
    const cooldownExpiry = player.getVariable('cooldown_dumpster');
    if (cooldownExpiry && Date.now() < cooldownExpiry) return;

    if (nearbyDumpster) {
        const propPos = mp.game.entity.getCoords(nearbyDumpster, true);
        mp.events.callRemote('server:searchDumpster', JSON.stringify(propPos));
    }
});

// 3. Animation Handler
mp.events.add('client:startDumpsterAnim', (duration) => {
    const player = mp.players.local;
    player.freezePosition(true);

    mp.game.streaming.requestAnimDict('amb@prop_human_bum_bin@idle_b');
    
    setTimeout(() => {
        if (mp.game.streaming.hasAnimDictLoaded('amb@prop_human_bum_bin@idle_b')) {
            player.taskPlayAnim(
                'amb@prop_human_bum_bin@idle_b', 
                'idle_d', 
                8.0, 1.0, -1, 1, 0.0, false, false, false
            );
        }
    }, 100);

    setTimeout(() => {
        player.clearTasks();
        player.freezePosition(false);
    }, duration);
});