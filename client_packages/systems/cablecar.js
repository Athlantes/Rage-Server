// client_packages/systems/cablecar.js

const MODEL_CABIN = "p_cablecar_s";
const MODEL_DOOR_L = "p_cablecar_s_door_l";
const MODEL_DOOR_R = "p_cablecar_s_door_r";

// --- CONFIGURATION ---
const INTERACTION_DIST = 20.0; // Increased to 20.0 to account for roof-to-platform height diff
const TRACKS = [
    // TRACK 0: Bottom -> Top
    [
        new mp.Vector3(-740.911, 5599.341, 47.25),
        new mp.Vector3(-739.557, 5599.346, 46.997),
        new mp.Vector3(-581.009, 5596.517, 77.379),
        new mp.Vector3(-575.717, 5596.388, 79.22),
        new mp.Vector3(-273.805, 5590.844, 240.795),
        new mp.Vector3(-268.707, 5590.744, 243.395),
        new mp.Vector3(6.896, 5585.668, 423.614),
        new mp.Vector3(11.774, 5585.591, 426.711),
        new mp.Vector3(236.82, 5581.445, 599.642),
        new mp.Vector3(241.365, 5581.369, 603.183),
        new mp.Vector3(412.855, 5578.216, 774.401),
        new mp.Vector3(417.541, 5578.124, 777.688),
        new mp.Vector3(444.93, 5577.589, 786.535),
        new mp.Vector3(446.288, 5577.59, 786.75)
    ],
    // TRACK 1: Top -> Bottom
    [
        new mp.Vector3(446.291, 5566.377, 786.75),
        new mp.Vector3(444.937, 5566.383, 786.551),
        new mp.Vector3(417.371, 5567.001, 777.708),
        new mp.Vector3(412.661, 5567.085, 774.439),
        new mp.Vector3(241.31, 5570.594, 603.137),
        new mp.Vector3(236.821, 5570.663, 599.561),
        new mp.Vector3(11.35, 5575.298, 426.629),
        new mp.Vector3(6.575, 5575.391, 423.57),
        new mp.Vector3(-268.965, 5580.996, 243.386),
        new mp.Vector3(-273.993, 5581.124, 240.808),
        new mp.Vector3(-575.898, 5587.286, 79.251),
        new mp.Vector3(-581.321, 5587.4, 77.348),
        new mp.Vector3(-739.646, 5590.614, 47.006),
        new mp.Vector3(-740.97, 5590.617, 47.306)
    ]
];

const TRACK_LENGTHS = [0, 0];
TRACKS.forEach((track, idx) => {
    let dist = 0;
    for (let i = 0; i < track.length - 1; i++) {
        dist += mp.game.system.vdist(track[i].x, track[i].y, track[i].z, track[i+1].x, track[i+1].y, track[i+1].z);
    }
    TRACK_LENGTHS[idx] = dist;
});

// State
let currentState = -1; 
let lastProcessedState = -2; // Used to detect state changes
let startTimestamp = Date.now();
let stateDuration = 10000;
let showingPrompt = false;

// Local Entities
const cabins = [
    { id: 0, obj: null, doors: [] },
    { id: 1, obj: null, doors: [] }
];

function init() {
    cabins[0].obj = mp.objects.new(mp.game.joaat(MODEL_CABIN), TRACKS[0][0], {
        dimension: 0,
        rotation: new mp.Vector3(0, 0, 270)
    });
    
    cabins[1].obj = mp.objects.new(mp.game.joaat(MODEL_CABIN), TRACKS[1][0], {
        dimension: 0,
        rotation: new mp.Vector3(0, 0, 90)
    });

    cabins.forEach((c, idx) => createDoorsFor(idx));
    
    mp.console.logInfo("[CableCar] Client Init Complete");
}

function createDoorsFor(index) {
    const c = cabins[index];
    
    // Front pair
    const dL = mp.objects.new(mp.game.joaat(MODEL_DOOR_L), c.obj.position, { dimension: 0 });
    const dR = mp.objects.new(mp.game.joaat(MODEL_DOOR_R), c.obj.position, { dimension: 0 });

    // Back pair (duplicate models)
    const dL_back = mp.objects.new(mp.game.joaat(MODEL_DOOR_L), c.obj.position, { dimension: 0 });
    const dR_back = mp.objects.new(mp.game.joaat(MODEL_DOOR_R), c.obj.position, { dimension: 0 });
    
    // Store in specific order: 0=FL, 1=FR, 2=BL, 3=BR
    c.doors = [dL, dR, dL_back, dR_back];

    // Initial Attach (Closed)
    // We attach immediately so they don't float at 0,0,0
    // The Render loop will update them correctly on the first frame via processStateChange
}

// --- SYNC EVENT ---
mp.events.add("CableCar:Sync", (state, timePassed, duration) => {
    currentState = state;
    startTimestamp = Date.now() - timePassed;
    stateDuration = duration;
});

// --- RENDER LOOP ---
mp.events.add("render", () => {
    // 1. Process Movement
    const now = Date.now();
    let progress = (now - startTimestamp) / stateDuration;
    if (progress > 1) progress = 1;
    if (progress < 0) progress = 0;

    const easedProgress = -(Math.cos(Math.PI * progress) - 1) / 2;

    if (currentState === 0) { // Waiting Start
        updateCabinPos(0, 0.0);
        updateCabinPos(1, 0.0);
    } 
    else if (currentState === 1) { // Moving Forward
        updateCabinPos(0, easedProgress);
        updateCabinPos(1, easedProgress);
    } 
    else if (currentState === 2) { // Waiting End
        updateCabinPos(0, 1.0);
        updateCabinPos(1, 1.0);
    } 
    else if (currentState === 3) { // Moving Backward
        updateCabinPos(0, 1.0 - easedProgress);
        updateCabinPos(1, 1.0 - easedProgress);
    }

    // 2. Process Door State Changes (Only when state actually changes)
    // This prevents "spamming" attachTo which breaks physics/animation
    if (currentState !== lastProcessedState) {
        processStateChange(currentState);
        lastProcessedState = currentState;
    }

    // 3. Attachments & Interaction
    syncAttachments();
    handleInteraction();
});

function processStateChange(newState) {
    // State 0 (Wait Start) & State 2 (Wait End) = DOORS OPEN
    // State 1 (Move Fwd) & State 3 (Move Back) = DOORS CLOSED
    const shouldOpen = (newState === 0 || newState === 2);
    setDoorState(shouldOpen);
}

function setDoorState(isOpen) {
    const offset = isOpen ? 0.95 : 0.0;
    
    cabins.forEach(c => {
        if (c.doors.length === 4) {
            // NOTE: collision (11th arg) is set to TRUE.
            // Front Left: slides -Y
            c.doors[0].attachTo(c.obj.handle, 0, 0.0, -offset, 0.0, 0.0, 0.0, 0.0, false, false, true, false, 2, true);
            // Front Right: slides +Y
            c.doors[1].attachTo(c.obj.handle, 0, 0.0, offset, 0.0, 0.0, 0.0, 0.0, false, false, true, false, 2, true);
            
            // Back Doors (Rotated 180).
            // Since they are rotated 180, Local -Y is Global +Y.
            // We want them to slide "Outwards". Relative to themselves, that is still Left (-offset) and Right (+offset).
            // Back Left: slides Left relative to itself
            c.doors[2].attachTo(c.obj.handle, 0, 0.0, -offset, 0.0, 0.0, 0.0, 180.0, false, false, true, false, 2, true);
            // Back Right: slides Right relative to itself
            c.doors[3].attachTo(c.obj.handle, 0, 0.0, offset, 0.0, 0.0, 0.0, 180.0, false, false, true, false, 2, true);
        }
    });
}

function updateCabinPos(index, progress) {
    const c = cabins[index];
    if (!c.obj) return;

    const track = TRACKS[index];
    const totalLen = TRACK_LENGTHS[index];
    const targetDist = totalLen * progress;

    let currentDist = 0;
    for (let i = 0; i < track.length - 1; i++) {
        const p1 = track[i];
        const p2 = track[i+1];
        const segLen = mp.game.system.vdist(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);

        if (currentDist + segLen >= targetDist) {
            const segProg = (targetDist - currentDist) / segLen;
            const newPos = lerpVector(p1, p2, segProg);
            
            c.obj.setCoords(newPos.x, newPos.y, newPos.z, false, false, false, false);
            
            // Calculate Heading
            const heading = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI) - 90;
            c.obj.setRotation(0, 0, heading, 2, true);
            break;
        }
        currentDist += segLen;
    }
}

function syncAttachments() {
    mp.players.forEachInStreamRange(p => {
        const cabinId = p.getVariable('attachedCableCar');
        if (cabinId !== undefined && cabinId !== null) {
            const c = cabins[cabinId];
            if (c && c.obj) {
                if (!p.isAttached() || p.getAttachedTo() !== c.obj.handle) {
                    const randomX = (Math.random() - 0.5) * 0.5;
                    const randomY = (Math.random() - 0.5) * 0.5;
                    
                    p.attachTo(
                        c.obj.handle, 0, randomX, randomY, -5.35, 0, 0, 0, 
                        false, false, false, false, 2, true
                    );
                }
            }
        } else {
             if (p.isAttached()) {
                const attachedHandle = p.getAttachedTo();
                if (attachedHandle === cabins[0].obj.handle || attachedHandle === cabins[1].obj.handle) {
                    p.detach(true, false);
                }
            }
        }
    });
}

function handleInteraction() {
    const localPlayer = mp.players.local;
    let nearCabin = null;

    if (localPlayer.getVariable('attachedCableCar') != null) {
        if (showingPrompt) { mp.events.call('hideInteraction'); showingPrompt = false; }
        return;
    }

    cabins.forEach(c => {
        if (c.obj) {
            // Using a simple 3D distance check with a large radius to catch the top station platform
            const dist = mp.game.system.vdist(localPlayer.position.x, localPlayer.position.y, localPlayer.position.z, c.obj.position.x, c.obj.position.y, c.obj.position.z);
            if (dist < INTERACTION_DIST) nearCabin = c;
        }
    });

    const isDocked = (currentState === 0 || currentState === 2);

    if (nearCabin && isDocked) {
        if (!showingPrompt) {
            mp.events.call('showInteraction', 'Cable Car', "Press E to ride ($100)");
            showingPrompt = true;
        }

        if (mp.keys.isDown(69)) { 
             if (global.lastCableInteract && Date.now() - global.lastCableInteract < 1000) return;
             global.lastCableInteract = Date.now();
             mp.events.callRemote("CableCar:RequestEntry", nearCabin.id);
        }
    } else {
        if (showingPrompt) {
            mp.events.call('hideInteraction');
            showingPrompt = false;
        }
    }
}

function lerpVector(v1, v2, t) {
    return new mp.Vector3(
        v1.x + (v2.x - v1.x) * t,
        v1.y + (v2.y - v1.y) * t,
        v1.z + (v2.z - v1.z) * t
    );
}

init();