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

    // --- NEW: Job Check (Hide if Garbage Collector) ---
    // If the player is on the garbage job, they shouldn't see loot interactions
    // Note: Ensure your server sets 'job' variable via player.setVariable('job', 'garbage')
    const activeJob = player.getVariable('activeJobId');

    if (activeJob === 'garbage') {
        nearbyDumpster = null;
        if (lastInteractionState) {
            mp.events.call('hideInteraction');
            lastInteractionState = false;
        }
        return; 
    }
    // --------------------------------------------------

    // --- Cooldown Check ---
    const cooldownExpiry = player.getVariable('cooldown_dumpster');
    const isOnCooldown = cooldownExpiry && Date.now() < cooldownExpiry;

    if (isOnCooldown) {
        nearbyDumpster = null;
        if (lastInteractionState) {
            mp.events.call('hideInteraction');
            lastInteractionState = false;
        }
        return; 
    }
    // ----------------------

    // Check all hashes
    for (const hash of DUMPSTER_HASHES) {
        const handle = mp.game.object.getClosestObjectOfType(
            player.position.x, player.position.y, player.position.z,
            1.5, // Increased slightly to 1.5 to make detection smoother
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
    
    const player = mp.players.local;

    // Double check constraints
    const cooldownExpiry = player.getVariable('cooldown_dumpster');
    if (cooldownExpiry && Date.now() < cooldownExpiry) return;

    const activeJob = player.getVariable('job') || player.getVariable('activeJobId');
    if (activeJob === 'garbage') return;

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