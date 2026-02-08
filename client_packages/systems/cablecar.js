// client_packages/cablecar/index.js

// Configuration
const POS_BOTTOM = new mp.Vector3(-740.92, 5593.18, 41.65);
const POS_TOP = new mp.Vector3(446.12, 5576.77, 781.18);
const INTERACTION_DIST = 5.0;

// State
let cabins = [
    { id: 0, obj: null, start: POS_BOTTOM, end: POS_TOP },
    { id: 1, obj: null, start: POS_TOP, end: POS_BOTTOM }
];
let currentState = "WAITING";
let startTimestamp = 0;
let stateDuration = 15000;
let localPlayer = mp.players.local;
let showingPrompt = false;

// --- SYNC EVENT ---
mp.events.add("CableCar:Sync", (state, startTime, duration) => {
    currentState = state;
    startTimestamp = startTime;
    stateDuration = duration;

    // If we switched to waiting, reset cabin positions to their new defaults
    if (currentState === "WAITING") {
        cabins.forEach(c => {
            // Logically swap start/end for the local interpolation
            let temp = c.start;
            c.start = c.end;
            c.end = temp;
        });
    }
});

// --- RENDER LOOP (Movement & UI) ---
mp.events.add("render", () => {
    // 1. Ensure Objects Exist
    cabins.forEach(c => {
        if (!c.obj || !mp.objects.exists(c.obj)) {
            // Try to find the server objects by variable
            mp.objects.forEachInStreamRange(obj => {
                if (obj.getVariable('cableCarId') === c.id) {
                    c.obj = obj;
                }
            });
        }
    });

    // 2. Handle Movement
    if (currentState === "MOVING") {
        const now = Date.now();
        const progress = Math.min((now - startTimestamp) / stateDuration, 1.0);

        cabins.forEach(c => {
            if (c.obj && mp.objects.exists(c.obj)) {
                const newPos = lerpVector(c.start, c.end, progress);
                c.obj.setCoords(newPos.x, newPos.y, newPos.z, false, false, false, false);
                
                // Keep rotation flat (or calculate slope if you prefer)
                c.obj.setRotation(0, 0, 0, 2, true);
            }
        });
    }

    // 3. Handle Interactions & Prompt
    handleInteractionUI();
    
    // 4. Handle Passenger Attachments (Visuals)
    syncAttachments();
});

// --- INTERACTION LOGIC ---
function handleInteractionUI() {
    let nearCabin = null;
    
    // Are we already riding?
    const myCabinId = localPlayer.getVariable('attachedCableCar');
    if (myCabinId !== undefined && myCabinId !== null) {
        if (showingPrompt) {
            mp.events.call('hideInteraction');
            showingPrompt = false;
        }
        return; // Don't show prompts while riding
    }

    // Check distance to cabins
    cabins.forEach(c => {
        if (c.obj && mp.objects.exists(c.obj)) {
            const dist = mp.game.system.vdist(localPlayer.position.x, localPlayer.position.y, localPlayer.position.z, c.obj.position.x, c.obj.position.y, c.obj.position.z);
            if (dist < INTERACTION_DIST) {
                nearCabin = c;
            }
        }
    });

    if (nearCabin) {
        if (!showingPrompt) {
            // Using your server's custom interaction event
            if (currentState === "WAITING") {
                mp.events.call('showInteraction', 'Cable Car', 'Press E to ride ($100)');
            } else {
                mp.events.call('showInteraction', 'Cable Car', 'Moving... Please wait.');
            }
            showingPrompt = true;
        }
    } else {
        if (showingPrompt) {
            mp.events.call('hideInteraction');
            showingPrompt = false;
        }
    }

    // Input Handling
    if (nearCabin && mp.keys.isDown(69)) { // 'E' Key
        if (currentState !== "WAITING") return;
        
        // Debounce
        if (global.lastInteraction && Date.now() - global.lastInteraction < 1000) return;
        global.lastInteraction = Date.now();

        mp.events.callRemote("CableCar:RequestEntry", nearCabin.id);
    }
}

// --- ATTACHMENT SYNC ---
// This ensures that WHEN a player is tagged as "riding" on the server, 
// they are visually attached to the moving car on EVERY client.
function syncAttachments() {
    mp.players.forEachInStreamRange(p => {
        const cabinId = p.getVariable('attachedCableCar');
        
        // If player has a cabin ID
        if (cabinId !== undefined && cabinId !== null) {
            const cabin = cabins.find(c => c.id === cabinId);
            if (cabin && cabin.obj && mp.objects.exists(cabin.obj)) {
                // If not already attached to this specific entity, attach them
                if (!p.isAttached() || p.getAttachedTo() !== cabin.obj.handle) {
                    // Attach to center of cabin
                    p.attachTo(cabin.obj.handle, 0, 0, 0, 0.5, 0, 0, 0, false, false, false, false, 2, true);
                }
            }
        } else {
            // If they shouldn't be attached but are, detach (Handled by server position set usually, but safe to check)
            if (p.isAttached() && cabins.some(c => c.obj && c.obj.handle === p.getAttachedTo())) {
                p.detach(true, false);
            }
        }
    });
}

// Helper
function lerpVector(v1, v2, t) {
    return new mp.Vector3(
        v1.x + (v2.x - v1.x) * t,
        v1.y + (v2.y - v1.y) * t,
        v1.z + (v2.z - v1.z) * t
    );
}