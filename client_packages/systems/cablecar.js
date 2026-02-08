// client_packages/cablecar/index.js

// --- CONFIGURATION ---
const TRACKS = [
    // TRACK 0: Bottom -> Top (Left Cable)
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
    // TRACK 1: Top -> Bottom (Right Cable)
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

// Pre-calculate track lengths for smooth speed
const TRACK_LENGTHS = [0, 0];
TRACKS.forEach((track, idx) => {
    let dist = 0;
    for (let i = 0; i < track.length - 1; i++) {
        dist += mp.game.system.vdist(track[i].x, track[i].y, track[i].z, track[i+1].x, track[i+1].y, track[i+1].z);
    }
    TRACK_LENGTHS[idx] = dist;
});

// State
let currentState = 0; 
// 0: Idle Start, 1: Move Fwd, 2: Idle End, 3: Move Back
let startTimestamp = 0;
let stateDuration = 10000;
let cabins = [
    { id: 0, obj: null, doors: [], lastPos: null },
    { id: 1, obj: null, doors: [], lastPos: null }
];
let doorsCreated = false;
let showingPrompt = false;

// --- SYNC ---
mp.events.add("CableCar:Sync", (state, startTime, duration) => {
    currentState = state;
    startTimestamp = startTime;
    stateDuration = duration;
    
    // Reset door state logic if needed, but render loop handles it continuous
});

// --- RENDER ---
mp.events.add("render", () => {
    const localPlayer = mp.players.local;
    
    // 1. Ensure Objects & Doors Exist
    ensureAssets();

    // 2. Calculate Progress (0.0 to 1.0)
    const now = Date.now();
    let progress = (now - startTimestamp) / stateDuration;
    if (progress > 1) progress = 1;
    if (progress < 0) progress = 0;

    // Apply Easing for smoother start/stop
    const easedProgress = -(Math.cos(Math.PI * progress) - 1) / 2;

    // 3. Movement Logic
    // State 0: WAITING START (Cabin 0 at 0%, Cabin 1 at 0%)
    // State 1: MOVING FWD   (Cabin 0 0%->100%, Cabin 1 0%->100%)
    // State 2: WAITING END  (Cabin 0 at 100%, Cabin 1 at 100%)
    // State 3: MOVING BACK  (Cabin 0 100%->0%, Cabin 1 100%->0%)
    
    if (currentState === 0) {
        setPositionByProgress(0, 0.0);
        setPositionByProgress(1, 0.0);
        manageDoors(true);
    } 
    else if (currentState === 1) {
        setPositionByProgress(0, easedProgress);
        setPositionByProgress(1, easedProgress);
        manageDoors(false);
    } 
    else if (currentState === 2) {
        setPositionByProgress(0, 1.0);
        setPositionByProgress(1, 1.0);
        manageDoors(true);
    } 
    else if (currentState === 3) {
        // Reverse direction: 1.0 -> 0.0
        setPositionByProgress(0, 1.0 - easedProgress);
        setPositionByProgress(1, 1.0 - easedProgress);
        manageDoors(false);
    }

    // 4. Attachments & UI
    syncAttachments();
    handleInteraction();
});

// --- HELPERS ---

function ensureAssets() {
    // Find Cabins
    cabins.forEach(c => {
        if (!c.obj || !mp.objects.exists(c.obj)) {
            mp.objects.forEachInStreamRange(obj => {
                if (obj.getVariable('cableCarId') === c.id) {
                    c.obj = obj;
                    c.obj.freezePosition(true);
                    c.obj.setAlpha(255);
                }
            });
        }
    });

    // Create Doors (Client Side Only)
    if (cabins[0].obj && cabins[1].obj && !doorsCreated) {
        createDoorsFor(0);
        createDoorsFor(1);
        doorsCreated = true;
    }
}

function createDoorsFor(index) {
    const c = cabins[index];
    // Create doors at dummy pos, they get attached immediately
    const dL = mp.objects.new(mp.game.joaat("p_cablecar_s_door_l"), c.obj.position, { dimension: 0 });
    const dR = mp.objects.new(mp.game.joaat("p_cablecar_s_door_r"), c.obj.position, { dimension: 0 });
    c.doors = [dL, dR];
}

function setPositionByProgress(index, progress) {
    const c = cabins[index];
    if (!c.obj || !mp.objects.exists(c.obj)) return;

    const track = TRACKS[index];
    const totalLen = TRACK_LENGTHS[index];
    const targetDist = totalLen * progress;

    let currentDist = 0;
    for (let i = 0; i < track.length - 1; i++) {
        const p1 = track[i];
        const p2 = track[i+1];
        const segLen = mp.game.system.vdist(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);

        if (currentDist + segLen >= targetDist) {
            // We are inside this segment
            const segProg = (targetDist - currentDist) / segLen;
            const newPos = lerpVector(p1, p2, segProg);
            
            c.obj.setCoords(newPos.x, newPos.y, newPos.z, false, false, false, false);
            
            // Calculate Heading to face next point
            // Only update heading if moving, otherwise keep last valid heading
            if (segLen > 0.1) {
               const heading = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI) - 90;
               c.obj.setRotation(0, 0, heading, 2, true);
            }
            break;
        }
        currentDist += segLen;
    }
}

function manageDoors(shouldOpen) {
    cabins.forEach(c => {
        if (!c.obj || !mp.objects.exists(c.obj) || c.doors.length < 2) return;
        
        const dL = c.doors[0];
        const dR = c.doors[1];
        
        // 0.95 is open offset, 0.0 is closed
        const offset = shouldOpen ? 0.95 : 0.0;
        
        // Attach doors securely
        if (!dL.isAttached() || dL.getAttachedTo() !== c.obj.handle) {
             dL.attachTo(c.obj.handle, 0, 0.0, -offset, 0.0, 0.0, 0.0, 0.0, false, false, false, false, 2, true);
        } else {
             // If already attached, we might need to detach and re-attach to animate? 
             // RAGE attach synchronization can be sticky. 
             // Better approach: Check if offset changed significantly.
             // For simplicity, we re-attach every few seconds or just trust it.
             // Let's just force attach with new offset every frame? No, that flickers.
             // We only re-attach if the "state" changed.
             // (We'll skip complex sliding animation for stability, just snap open/closed based on state).
             dL.attachTo(c.obj.handle, 0, 0.0, -offset, 0.0, 0.0, 0.0, 0.0, false, false, false, false, 2, true);
        }

        if (!dR.isAttached() || dR.getAttachedTo() !== c.obj.handle) {
             dR.attachTo(c.obj.handle, 0, 0.0, offset, 0.0, 0.0, 0.0, 0.0, false, false, false, false, 2, true);
        } else {
             dR.attachTo(c.obj.handle, 0, 0.0, offset, 0.0, 0.0, 0.0, 0.0, false, false, false, false, 2, true);
        }
    });
}

function syncAttachments() {
    mp.players.forEachInStreamRange(p => {
        const cabinId = p.getVariable('attachedCableCar');
        if (cabinId !== undefined && cabinId !== null) {
            const c = cabins[cabinId];
            if (c && c.obj && mp.objects.exists(c.obj)) {
                if (!p.isAttached() || p.getAttachedTo() !== c.obj.handle) {
                    // Attach to center
                    p.attachTo(c.obj.handle, 0, 0, 0, 0, 0, 0, 0, false, false, false, false, 2, true);
                }
            }
        } else {
            // Detach safety check
            if (p.isAttached() && cabins.some(c => c.obj && c.obj.handle === p.getAttachedTo())) {
                p.detach(true, false);
            }
        }
    });
}

function handleInteraction() {
    let nearCabin = null;
    const localPlayer = mp.players.local;
    const myCabinId = localPlayer.getVariable('attachedCableCar');

    if (myCabinId !== undefined && myCabinId !== null) {
        if (showingPrompt) { mp.events.call('hideInteraction'); showingPrompt = false; }
        return;
    }

    // Check distance to cabins
    cabins.forEach(c => {
        if (c.obj && mp.objects.exists(c.obj)) {
            const dist = mp.game.system.vdist(localPlayer.position.x, localPlayer.position.y, localPlayer.position.z, c.obj.position.x, c.obj.position.y, c.obj.position.z);
            if (dist < 6.0) nearCabin = c;
        }
    });

    if (nearCabin) {
        if (!showingPrompt) {
            if (currentState === 0 || currentState === 2) {
                mp.events.call('showInteraction', 'Cable Car', 'Press E to ride ($100)');
            } else {
                mp.events.call('showInteraction', 'Cable Car', 'Moving... Please wait.');
            }
            showingPrompt = true;
        }

        if (mp.keys.isDown(69)) { // E
             if (global.lastInter && Date.now() - global.lastInter < 1000) return;
             global.lastInter = Date.now();
             mp.events.callRemote("CableCar:RequestEntry", nearCabin.id);
        }
    } else {
        if (showingPrompt) { mp.events.call('hideInteraction'); showingPrompt = false; }
    }
}

function lerpVector(v1, v2, t) {
    return new mp.Vector3(
        v1.x + (v2.x - v1.x) * t,
        v1.y + (v2.y - v1.y) * t,
        v1.z + (v2.z - v1.z) * t
    );
}