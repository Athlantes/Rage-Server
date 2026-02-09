// client_packages/systems/cablecar.js

const MODEL_DOOR_L = "p_cablecar_s_door_l";
const MODEL_DOOR_R = "p_cablecar_s_door_r";

// --- TRACK CONFIGURATION ---
const TRACKS = [
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

// Pre-calculate lengths
let TRACK_LENGTHS = [0, 0];
let SEGMENT_LENGTHS = [[], []];

function setupTracks() {
    TRACKS.forEach((track, tIdx) => {
        let total = 0;
        SEGMENT_LENGTHS[tIdx] = [];
        for (let i = 0; i < track.length - 1; i++) {
            let dist = mp.game.system.vdist(track[i].x, track[i].y, track[i].z, track[i+1].x, track[i+1].y, track[i+1].z);
            SEGMENT_LENGTHS[tIdx].push(dist);
            total += dist;
        }
        TRACK_LENGTHS[tIdx] = total;
    });
}
setupTracks();

// --- STATE MANAGEMENT ---
let serverState = { status: 0, startTime: Date.now(), duration: 10000 };
let remoteIds = { 0: null, 1: null }; // IDs from server
let cachedCabins = { 0: null, 1: null }; 
let localDoors = { 0: [], 1: [] };       

mp.game.streaming.requestModel(mp.game.joaat(MODEL_DOOR_L));
mp.game.streaming.requestModel(mp.game.joaat(MODEL_DOOR_R));

mp.events.add("CableCar:Sync", (dataStr) => {
    const data = JSON.parse(dataStr);
    
    // Time Sync
    const elapsedOnServer = data.serverNow - data.startTime;
    serverState = data;
    serverState.startTime = Date.now() - elapsedOnServer;

    // ID Sync
    if (data.cabinIds) {
        remoteIds = data.cabinIds;
    }
});

mp.events.add("render", () => {
    if (!serverState) return;

    const now = Date.now();
    let timeProgress = (now - serverState.startTime) / serverState.duration;
    timeProgress = Math.max(0, Math.min(1, timeProgress));
    
    const eased = -(Math.cos(Math.PI * timeProgress) - 1) / 2;

    let trackProgress = 0.0;
    if (serverState.status === 0) trackProgress = 0.0;
    else if (serverState.status === 1) trackProgress = eased; 
    else if (serverState.status === 2) trackProgress = 1.0;
    else if (serverState.status === 3) trackProgress = 1.0 - eased; 

    updateCabin(0, trackProgress);
    updateCabin(1, trackProgress);

    manageAttachment();
});

function updateCabin(id, progress) {
    // 1. Find Object
    if (!cachedCabins[id] || !mp.objects.exists(cachedCabins[id])) {
        cachedCabins[id] = null; 
        if (remoteIds[id] !== null) {
            const obj = mp.objects.atRemoteId(remoteIds[id]);
            if (obj && mp.objects.exists(obj)) {
                cachedCabins[id] = obj;
            }
        }
    }

    const cabinObj = cachedCabins[id];
    // Ensure the object has a valid handle (is actually streamed in)
    if (!cabinObj || cabinObj.handle === 0) return; 

    // 2. Position
    const trackId = (id === 0) ? 0 : 1; 
    const pos = getPosOnTrack(trackId, progress);
    
    cabinObj.setCoords(pos.x, pos.y, pos.z, false, false, false, false);
    
    // 3. Rotation
    const lookAtPos = getPosOnTrack(trackId, progress + 0.01 <= 1.0 ? progress + 0.01 : progress - 0.01);
    const dx = lookAtPos.x - pos.x;
    const dy = lookAtPos.y - pos.y;
    let heading = (Math.atan2(dy, dx) * 180 / Math.PI) - 90;
    if (progress + 0.01 > 1.0) heading += 180; 

    cabinObj.setRotation(0.0, 0.0, heading, 2, true);

    // 4. Manage Doors
    manageLocalDoors(cabinObj, id);
}

function manageLocalDoors(cabinObj, id) {
    // --- FIX: VALIDATION CHECK ---
    // If we have doors in the list, check if they are still valid in the game engine.
    // If the cabin streamed out, the game might have deleted the doors automatically.
    if (localDoors[id].length > 0) {
        let allValid = true;
        for (let d of localDoors[id]) {
            if (!d || !mp.objects.exists(d) || d.handle === 0) {
                allValid = false;
                break;
            }
        }
        
        // If any door is broken/missing, destroy them all and reset
        if (!allValid) {
            localDoors[id].forEach(d => {
                if (d && mp.objects.exists(d)) d.destroy();
            });
            localDoors[id] = [];
        }
    }

    // Create doors if missing
    if (localDoors[id].length === 0) {
        if (!mp.game.streaming.hasModelLoaded(mp.game.joaat(MODEL_DOOR_L))) return;
        
        for(let i=0; i<4; i++) {
            let m = (i % 2 === 0) ? MODEL_DOOR_L : MODEL_DOOR_R;
            // Create at cabin position, dimension 0
            let d = mp.objects.new(mp.game.joaat(m), cabinObj.position, { dimension: 0 });
            localDoors[id].push(d);
        }
    }

    // Update Attachments
    const isMoving = (serverState.status === 1 || serverState.status === 3);
    const offset = isMoving ? 0.0 : 0.95; 

    const doors = localDoors[id];
    
    // Only attach if we have 4 valid doors AND the cabin is valid
    if (doors.length === 4 && cabinObj.handle !== 0) {
        // We re-attach every frame to ensure they don't drift
        // Door 0 (Left Front)
        doors[0].attachTo(cabinObj.handle, 0, 0.0, -offset, 0.0, 0.0, 0.0, 0.0, false, false, true, false, 2, true);
        // Door 1 (Right Front)
        doors[1].attachTo(cabinObj.handle, 0, 0.0, offset, 0.0, 0.0, 0.0, 0.0, false, false, true, false, 2, true);
        // Door 2 (Left Back - Rotated 180)
        doors[2].attachTo(cabinObj.handle, 0, 0.0, -offset, 0.0, 0.0, 0.0, 180.0, false, false, true, false, 2, true);
        // Door 3 (Right Back - Rotated 180)
        doors[3].attachTo(cabinObj.handle, 0, 0.0, offset, 0.0, 0.0, 0.0, 180.0, false, false, true, false, 2, true);
    }
}

function manageAttachment() {
    const seatId = mp.players.local.getVariable('cableCarSeat');
    
    if (seatId !== undefined && seatId !== null) {
        const cabinObj = cachedCabins[seatId];
        if (cabinObj && mp.objects.exists(cabinObj) && cabinObj.handle !== 0) {
            mp.players.local.freezePosition(true);
            if (mp.players.local.getAttachedTo() !== cabinObj.handle) {
                mp.players.local.attachTo(cabinObj.handle, 0, 0, 0, -5.35, 0, 0, 0, false, false, false, false, 2, true);
            }
        }
    } 
    else {
        if (mp.players.local.isAttached()) {
             const handle = mp.players.local.getAttachedTo();
             const isAttachedToCabin = (cachedCabins[0] && cachedCabins[0].handle === handle) || 
                                       (cachedCabins[1] && cachedCabins[1].handle === handle);
             if (isAttachedToCabin) {
                mp.players.local.detach(true, false);
                mp.players.local.freezePosition(false);
            }
        }
    }
}

function getPosOnTrack(trackIdx, progress) {
    progress = Math.max(0, Math.min(1, progress));
    const targetDist = TRACK_LENGTHS[trackIdx] * progress;
    const track = TRACKS[trackIdx];
    const segs = SEGMENT_LENGTHS[trackIdx];
    
    let currentDist = 0;
    
    for(let i=0; i<segs.length; i++) {
        if (currentDist + segs[i] >= targetDist) {
            const segProg = (targetDist - currentDist) / segs[i];
            const p1 = track[i];
            const p2 = track[i+1];
            return new mp.Vector3(
                p1.x + (p2.x - p1.x) * segProg,
                p1.y + (p2.y - p1.y) * segProg,
                p1.z + (p2.z - p1.z) * segProg
            );
        }
        currentDist += segs[i];
    }
    return track[track.length-1];
}