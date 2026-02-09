// packages/systems/cablecar.js
const playerManager = require('../core/playerManager');

// --- CONFIGURATION ---
const RIDE_COST = 100;
const WAIT_TIME = 30000;    
const TRAVEL_TIME = 55000;
const MODEL_CABIN = "p_cablecar_s";

// --- TRACK DATA (Copied from Client for Server-Side Physics) ---
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

// Pre-calculate lengths for server math
let TRACK_LENGTHS = [0, 0];
let SEGMENT_LENGTHS = [[], []];

function setupTracks() {
    TRACKS.forEach((track, tIdx) => {
        let total = 0;
        SEGMENT_LENGTHS[tIdx] = [];
        for (let i = 0; i < track.length - 1; i++) {
            // Simple Euclidean distance for server side is enough
            let dist = Math.sqrt(
                Math.pow(track[i].x - track[i+1].x, 2) +
                Math.pow(track[i].y - track[i+1].y, 2) +
                Math.pow(track[i].z - track[i+1].z, 2)
            );
            SEGMENT_LENGTHS[tIdx].push(dist);
            total += dist;
        }
        TRACK_LENGTHS[tIdx] = total;
    });
}
setupTracks();


// Initial positions
const STATIONS = [
    { name: "Bottom", x: -740.911, y: 5599.341, z: 47.25 },
    { name: "Top", x: 446.291, y: 5566.377, z: 786.75 }
];

let systemState = {
    status: 0,
    startTime: Date.now(), 
    duration: WAIT_TIME
};

let cabin0 = null;
let cabin1 = null;

function init() {
    console.log(`[CableCar] Server Conductor Started.`);

    // 1. Create Blips & Interactions
    STATIONS.forEach((station, index) => {
        mp.blips.new(36, new mp.Vector3(station.x, station.y, station.z), {
            name: "Cable Car",
            color: 4,
            shortRange: true,
            scale: 0.8
        });

        const shape = mp.colshapes.newSphere(station.x, station.y, station.z, 5.0);
        shape.setVariable('interaction', {
            title: "Cable Car",
            text: `Press E to ride ($${RIDE_COST})`,
            event: "CableCar:Interact",
            requireOnFoot: true,
            data: { stationIndex: index }
        });
    });

    // 2. SPAWN CABINS ON SERVER
    cabin0 = mp.objects.new(mp.joaat(MODEL_CABIN), new mp.Vector3(STATIONS[0].x, STATIONS[0].y, STATIONS[0].z), {
        dimension: 0,
        alpha: 255
    });
    cabin0.streamDistance = 10000.0;
    cabin0.setVariable('cableCarId', 0);

    cabin1 = mp.objects.new(mp.joaat(MODEL_CABIN), new mp.Vector3(STATIONS[1].x, STATIONS[1].y, STATIONS[1].z), {
        dimension: 0,
        alpha: 255
    });
    cabin1.streamDistance = 10000.0;
    cabin1.setVariable('cableCarId', 1);

    // 3. Start Loop
    setInterval(gameLoop, 1000);
}

function gameLoop() {
    const now = Date.now();
    const timeElapsed = now - systemState.startTime;

    // A. Handle Status Switching
    if (timeElapsed >= systemState.duration) {
        systemState.status++;
        if (systemState.status > 3) systemState.status = 0;

        systemState.startTime = now;
        const isMoving = (systemState.status === 1 || systemState.status === 3);
        systemState.duration = isMoving ? TRAVEL_TIME : WAIT_TIME;

        if (!isMoving) {
            mp.players.forEach(p => {
                if (p.getVariable('cableCarSeat') !== undefined) {
                    p.setVariable('cableCarSeat', null);
                    p.notify("~g~You have arrived.");
                }
            });
        }
    }

    // B. MOVE SERVER OBJECTS (THE FIX)
    // We update the server-side position so it "travels" into player stream range
    let timeProgress = (now - systemState.startTime) / systemState.duration;
    timeProgress = Math.max(0, Math.min(1, timeProgress));
    
    // Smooth Sine Easing (Match Client)
    const eased = -(Math.cos(Math.PI * timeProgress) - 1) / 2;

    let trackProgress = 0.0;
    if (systemState.status === 0) trackProgress = 0.0;
    else if (systemState.status === 1) trackProgress = eased; 
    else if (systemState.status === 2) trackProgress = 1.0;
    else if (systemState.status === 3) trackProgress = 1.0 - eased; 

    if (cabin0 && mp.objects.exists(cabin0)) {
        const pos0 = getPosOnTrack(0, trackProgress);
        cabin0.position = pos0;
    }
    if (cabin1 && mp.objects.exists(cabin1)) {
        const pos1 = getPosOnTrack(1, trackProgress);
        cabin1.position = pos1;
    }

    // C. Sync to clients
    const stateToSend = { 
        ...systemState, 
        serverNow: Date.now(),
        cabinIds: { 0: cabin0.id, 1: cabin1.id }
    };
    mp.players.call("CableCar:Sync", [JSON.stringify(stateToSend)]);
}

// Math Helper (Server Version)
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

mp.events.add('CableCar:Interact', async (player, data) => {
    if (player.vehicle) return player.notify("~r~Leave vehicle first.");
    if (player.getVariable('cableCarSeat') != null) return player.notify("~r~Already boarded.");

    const reqStation = data.stationIndex;
    let assignedCabin = -1;

    if (systemState.status === 0) { 
        if (reqStation === 0) assignedCabin = 0;
        if (reqStation === 1) assignedCabin = 1;
    } 
    else if (systemState.status === 2) { 
        if (reqStation === 0) assignedCabin = 1;
        if (reqStation === 1) assignedCabin = 0;
    }
    else {
        return player.notify("~o~Cable car is moving.");
    }

    if (assignedCabin === -1) return player.notify("~r~No cabin here.");

    if (player.data.money < RIDE_COST) return player.notify("~r~Cannot afford.");

    const success = await playerManager.removeMoneyAndSave(player, RIDE_COST, "Cable Car");
    if (success) {
        player.setVariable('cableCarSeat', assignedCabin);
        player.notify("~g~Boarded.");
    }
});

mp.events.add("playerReady", (player) => {
    if (cabin0 && cabin1) {
        const stateToSend = { 
            ...systemState, 
            serverNow: Date.now(),
            cabinIds: { 0: cabin0.id, 1: cabin1.id }
        };
        player.call("CableCar:Sync", [JSON.stringify(stateToSend)]);
    }
});

init();