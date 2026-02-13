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
let isSearching = false; // Prevents UI flickering during search
let localCooldownEnd = 0; // Fixes time sync issues

// 1. Detection Loop (Runs every 250ms)
setInterval(() => {
    const player = mp.players.local;
    let found = null;

    if (player.vehicle) {
            nearbyDumpster = null;
            if (lastInteractionState) {
                mp.events.call('hideInteraction');
                lastInteractionState = false;
            }
            return;
        }

    // --- 1. Immediate Search/Animation Check ---
    if (isSearching) {
        if (lastInteractionState) {
            mp.events.call('hideInteraction');
            lastInteractionState = false;
        }
        return;
    }

    // --- 2. Job Check (Unified) ---
    // Checks both variable names to match Key Handler logic
    const activeJob = player.getVariable('job') || player.getVariable('activeJobId');

    if (activeJob === 'garbage') {
        nearbyDumpster = null;
        if (lastInteractionState) {
            mp.events.call('hideInteraction');
            lastInteractionState = false;
        }
        return; 
    }

    // --- 3. Cooldown Check (Server & Local Fallback) ---
    const serverCooldown = player.getVariable('cooldown_dumpster');
    const now = Date.now();
    
    // Check Server Variable OR Local Timer (fixes PC time diff)
    const isOnCooldown = (serverCooldown && now < serverCooldown) || (localCooldownEnd && now < localCooldownEnd);

    if (isOnCooldown) {
        nearbyDumpster = null;
        if (lastInteractionState) {
            mp.events.call('hideInteraction');
            lastInteractionState = false;
        }
        return; 
    }

    // --- 4. Object Detection (Improved) ---
    let closestHandle = null;
    let closestDist = 3.0; // Max detection radius (increased from 0.75)

    for (const hash of DUMPSTER_HASHES) {
        const handle = mp.game.object.getClosestObjectOfType(
            player.position.x, player.position.y, player.position.z,
            3.0, // Radius
            hash, 
            false, false, false
        );

        if (handle && handle !== 0) {
            const dumpPos = mp.game.entity.getCoords(handle, true);
            const dist = mp.game.system.vdist(player.position.x, player.position.y, player.position.z, dumpPos.x, dumpPos.y, dumpPos.z);

            // If this bin is closer than the last one found, mark it as the candidate
            if (dist < closestDist) {
                closestHandle = handle;
                closestDist = dist;
            }
        }
    }

    // --- 5. Wall Check (Line of Sight) ---
    if (closestHandle) {
        // Trace flags: 17 (1 = Map, 16 = Objects) to hit walls and props
        const hasLineOfSight = mp.game.entity.hasClearLosToEntity(player.handle, closestHandle, 17);
        
        if (hasLineOfSight) {
            found = closestHandle;
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
    if (isSearching) return; // Prevent spam

    const player = mp.players.local;

    if (player.vehicle) return;

    // Double check constraints
    const serverCooldown = player.getVariable('cooldown_dumpster');
    if ((serverCooldown && Date.now() < serverCooldown) || (localCooldownEnd && Date.now() < localCooldownEnd)) return;

    const activeJob = player.getVariable('job') || player.getVariable('activeJobId');
    if (activeJob === 'garbage') return;

    if (nearbyDumpster) {
        // Immediately hide UI for better feedback
        isSearching = true; 
        mp.events.call('hideInteraction');
        lastInteractionState = false;

        const propPos = mp.game.entity.getCoords(nearbyDumpster, true);
        mp.events.callRemote('server:searchDumpster', JSON.stringify(propPos));
    }
});

// 3. Animation Handler
mp.events.add('client:startDumpsterAnim', (duration) => {
    const player = mp.players.local;
    player.freezePosition(true);
    isSearching = true; // Ensure flag is true

    localCooldownEnd = Date.now() + duration + 60000; 

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
        isSearching = false; // Allow loop to check logic again
    }, duration);
});