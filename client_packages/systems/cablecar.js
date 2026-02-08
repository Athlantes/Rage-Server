// client_packages/systems/cablecar.js

const MODEL_CABIN = "p_cablecar_s";
const MODEL_DOOR_L = "p_cablecar_s_door_l";
const MODEL_DOOR_R = "p_cablecar_s_door_r";

// --- CONFIGURATION ---
// Only spawn the car if it's within this distance of the player.
// This prevents "Ghost Objects" created 2km away that never appear.
const DRAW_DISTANCE = 600.0; 
const INTERACTION_DIST = 6.0; 

const STATIONS = {
    BOTTOM: new mp.Vector3(-740.911, 5599.341, 47.25),
    TOP: new mp.Vector3(446.291, 5566.377, 786.75)
};

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

// Pre-calculate track lengths
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
let startTimestamp = Date.now();
let stateDuration = 10000;
let showingPrompt = false;

// Entities
const cabins = [
    { id: 0, obj: null, doors: [] },
    { id: 1, obj: null, doors: [] }
];

async function ensureModelsLoaded() {
    const models = [MODEL_CABIN, MODEL_DOOR_L, MODEL_DOOR_R];
    for (const m of models) {
        if (!mp.game.streaming.hasModelLoaded(mp.game.joaat(m))) {
            mp.game.streaming.requestModel(mp.game.joaat(m));
            await mp.game.waitAsync(10);
        }
    }
}

// ---------------------------------------------------------
// LOGIC: Calculate where the cabin *should* be right now
// ---------------------------------------------------------
function getCalculatedPosition(index) {
    const now = Date.now();
    let progress = (now - startTimestamp) / stateDuration;
    progress = Math.max(0, Math.min(1, progress));
    const eased = -(Math.cos(Math.PI * progress) - 1) / 2;

    let trackProgress = 0.0;

    if (currentState === 0) trackProgress = 0.0; // Waiting Start
    else if (currentState === 2) trackProgress = 1.0; // Waiting End
    else if (currentState === 1) trackProgress = eased; // Moving Fwd
    else if (currentState === 3) trackProgress = 1.0 - eased; // Moving Back

    const track = TRACKS[index];
    const totalLen = TRACK_LENGTHS[index];
    const targetDist = totalLen * trackProgress;

    let currentDist = 0;
    for (let i = 0; i < track.length - 1; i++) {
        const p1 = track[i];
        const p2 = track[i+1];
        const segLen = mp.game.system.vdist(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);

        if (currentDist + segLen >= targetDist) {
            const segProg = (targetDist - currentDist) / segLen;
            return lerpVector(p1, p2, segProg);
        }
        currentDist += segLen;
    }
    return track[track.length - 1];
}

// ---------------------------------------------------------
// STREAMING: Create/Destroy based on player distance
// ---------------------------------------------------------
async function processStreaming(index) {
    const targetPos = getCalculatedPosition(index);
    const playerPos = mp.players.local.position;
    const dist = mp.game.system.vdist(playerPos.x, playerPos.y, playerPos.z, targetPos.x, targetPos.y, targetPos.z);

    const exists = (cabins[index].obj && mp.objects.exists(cabins[index].obj));

    // CASE 1: Close enough -> Spawn if missing
    if (dist <= DRAW_DISTANCE) {
        if (!exists) {
            await ensureModelsLoaded();
            
            // Re-check existence after await to avoid duplicates
            if (cabins[index].obj && mp.objects.exists(cabins[index].obj)) return;

            // Spawn
            cabins[index].obj = mp.objects.new(mp.game.joaat(MODEL_CABIN), targetPos, { 
                dimension: 0,
                alpha: 255
            });
            cabins[index].obj.setLodDist(DRAW_DISTANCE + 200); // Set LOD slightly higher than spawn dist

            // Spawn Doors
            cabins[index].doors = [];
            for(let i=0; i<4; i++) {
                let model = (i % 2 === 0) ? MODEL_DOOR_L : MODEL_DOOR_R;
                let door = mp.objects.new(mp.game.joaat(model), targetPos, { dimension: 0 });
                door.setLodDist(DRAW_DISTANCE + 200);
                cabins[index].doors.push(door);
            }
        }
    } 
    // CASE 2: Too far -> Destroy if exists
    else {
        if (exists) {
            cabins[index].obj.destroy();
            cabins[index].obj = null;
            cabins[index].doors.forEach(d => { if(mp.objects.exists(d)) d.destroy(); });
            cabins[index].doors = [];
        }
    }
}

// ---------------------------------------------------------
// UPDATE: Move the objects if they exist
// ---------------------------------------------------------
function updateCabinVisuals(index) {
    const c = cabins[index];
    if (!c.obj || !mp.objects.exists(c.obj)) return; // Not streamed in, skip

    // We recalculate position here to be frame-perfect
    const pos = getCalculatedPosition(index); 
    
    // Find heading
    const track = TRACKS[index];
    let heading = 0.0;
    
    // Simple look-ahead for heading
    // Find which segment we are on to determine rotation
    // (This is an approximation, but efficient)
    let bestDist = 99999;
    let bestSeg = 0;
    
    for(let i=0; i < track.length-1; i++) {
        const d = mp.game.system.vdist(pos.x, pos.y, pos.z, track[i].x, track[i].y, track[i].z);
        if(d < bestDist) { bestDist = d; bestSeg = i; }
    }
    
    // Look at next point
    if (track[bestSeg+1]) {
         const p1 = track[bestSeg];
         const p2 = track[bestSeg+1];
         const dx = p2.x - p1.x;
         const dy = p2.y - p1.y;
         heading = (Math.atan2(dy, dx) * 180 / Math.PI) - 90;
    }

    c.obj.setCoords(pos.x, pos.y, pos.z, false, false, false, false);
    c.obj.setRotation(0.0, 0.0, heading, 2, true);

    // Update Doors
    const doorsOpen = (currentState === 0 || currentState === 2);
    if (c.doors.length === 4) {
        const offset = doorsOpen ? 0.95 : 0.0;
        c.doors[0].attachTo(c.obj.handle, 0, 0.0, -offset, 0.0, 0.0, 0.0, 0.0, false, false, true, false, 2, true);
        c.doors[1].attachTo(c.obj.handle, 0, 0.0, offset, 0.0, 0.0, 0.0, 0.0, false, false, true, false, 2, true);
        c.doors[2].attachTo(c.obj.handle, 0, 0.0, -offset, 0.0, 0.0, 0.0, 180.0, false, false, true, false, 2, true);
        c.doors[3].attachTo(c.obj.handle, 0, 0.0, offset, 0.0, 0.0, 0.0, 180.0, false, false, true, false, 2, true);
    }
}

mp.events.add("CableCar:Sync", (state, timePassed, duration) => {
    currentState = state;
    startTimestamp = Date.now() - timePassed;
    stateDuration = duration;
});

mp.events.add("render", () => {
    // 1. Manage Streaming (Create/Destroy based on distance)
    processStreaming(0);
    processStreaming(1);

    // 2. Update Visuals (Move if they exist)
    updateCabinVisuals(0);
    updateCabinVisuals(1);

    // 3. Attachments & Interactions
    syncAttachments();
    handleInteraction();
});

function syncAttachments() {
    mp.players.forEachInStreamRange(p => {
        const cabinId = p.getVariable('attachedCableCar');
        if (cabinId !== undefined && cabinId !== null) {
            const c = cabins[cabinId];
            // Only attach if the car is streamed in for US (the client)
            if (c && c.obj && mp.objects.exists(c.obj)) {
                if (!p.isAttached() || p.getAttachedTo() !== c.obj.handle) {
                    p.attachTo(c.obj.handle, 0, 0, 0, -5.35, 0, 0, 0, false, false, false, false, 2, true);
                }
            }
        } else {
             if (p.isAttached()) {
                const attachedHandle = p.getAttachedTo();
                // If attached to a cable car that might be destroying or invalid, detach
                if ((cabins[0].obj && attachedHandle === cabins[0].obj.handle) || 
                    (cabins[1].obj && attachedHandle === cabins[1].obj.handle)) {
                    p.detach(true, false);
                }
            }
        }
    });
}

function handleInteraction() {
    if (mp.players.local.getVariable('attachedCableCar') != null) {
        if (showingPrompt) { mp.events.call('hideInteraction'); showingPrompt = false; }
        return;
    }

    const myPos = mp.players.local.position;
    const distBot = mp.game.system.vdist(myPos.x, myPos.y, myPos.z, STATIONS.BOTTOM.x, STATIONS.BOTTOM.y, STATIONS.BOTTOM.z);
    const distTop = mp.game.system.vdist(myPos.x, myPos.y, myPos.z, STATIONS.TOP.x, STATIONS.TOP.y, STATIONS.TOP.z);

    if ((distBot < INTERACTION_DIST || distTop < INTERACTION_DIST) && (currentState === 0 || currentState === 2)) {
        if (!showingPrompt) {
            mp.events.call('showInteraction', 'Cable Car', "Press E to ride ($100)");
            showingPrompt = true;
        }

        if (mp.keys.isDown(69)) { 
             if (global.lastCableInteract && Date.now() - global.lastCableInteract < 1000) return;
             global.lastCableInteract = Date.now();
             mp.events.callRemote("CableCar:RequestEntry");
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