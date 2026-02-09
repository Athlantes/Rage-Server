// packages/systems/cablecar.js
const playerManager = require('../core/playerManager');

// --- CONFIGURATION ---
const RIDE_COST = 100;
const WAIT_TIME = 30000;    
const TRAVEL_TIME = 55000;
const MODEL_CABIN = "p_cablecar_s";

// Initial positions (Temp, client will override immediately)
const STATIONS = [
    { name: "Bottom", x: -740.911, y: 5599.341, z: 47.25 },
    { name: "Top", x: 446.291, y: 5566.377, z: 786.75 }
];

let systemState = {
    status: 0,
    startTime: Date.now(), 
    duration: WAIT_TIME
};

function init() {
    console.log(`[CableCar] Server Conductor Started.`);

    // 1. Create Blips & Interactions
    STATIONS.forEach((station, index) => {
        // Blip
        mp.blips.new(36, new mp.Vector3(station.x, station.y, station.z), {
            name: "Cable Car",
            color: 4,
            shortRange: true,
            scale: 0.8
        });

        // Interaction Sphere (Integrates with your existing interaction.js)
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
    // We spawn them with a HUGE stream distance so they never disappear
    const cabin0 = mp.objects.new(mp.joaat(MODEL_CABIN), new mp.Vector3(STATIONS[0].x, STATIONS[0].y, STATIONS[0].z), {
        dimension: 0,
        alpha: 255
    });
    cabin0.streamDistance = 5000.0; // Visible from 5km away
    cabin0.setVariable('cableCarId', 0); // Mark as Cabin 0

    const cabin1 = mp.objects.new(mp.joaat(MODEL_CABIN), new mp.Vector3(STATIONS[1].x, STATIONS[1].y, STATIONS[1].z), {
        dimension: 0,
        alpha: 255
    });
    cabin1.streamDistance = 5000.0; // Visible from 5km away
    cabin1.setVariable('cableCarId', 1); // Mark as Cabin 1

    // 3. Start Loop
    setInterval(gameLoop, 1000);
}

function gameLoop() {
    const now = Date.now();
    const timeElapsed = now - systemState.startTime;

    if (timeElapsed >= systemState.duration) {
        systemState.status++;
        if (systemState.status > 3) systemState.status = 0;

        systemState.startTime = now;
        const isMoving = (systemState.status === 1 || systemState.status === 3);
        systemState.duration = isMoving ? TRAVEL_TIME : WAIT_TIME;

        // Arrival logic: Detach players
        if (!isMoving) {
            mp.players.forEach(p => {
                if (p.getVariable('cableCarSeat') !== undefined) {
                    p.setVariable('cableCarSeat', null);
                    p.notify("~g~You have arrived.");
                }
            });
        }

        // Sync state to all
        mp.players.call("CableCar:Sync", [JSON.stringify(systemState)]);
    }
}

mp.events.add('CableCar:Interact', async (player, data) => {
    if (player.vehicle) return player.notify("~r~Leave vehicle first.");
    if (player.getVariable('cableCarSeat') != null) return player.notify("~r~Already boarded.");

    const reqStation = data.stationIndex;
    let assignedCabin = -1;

    // Logic: Which cabin is at my station?
    if (systemState.status === 0) { // Waiting Start
        if (reqStation === 0) assignedCabin = 0;
        if (reqStation === 1) assignedCabin = 1;
    } 
    else if (systemState.status === 2) { // Waiting End
        if (reqStation === 0) assignedCabin = 1;
        if (reqStation === 1) assignedCabin = 0;
    }
    else {
        return player.notify("~o~Cable car is moving.");
    }

    if (assignedCabin === -1) return player.notify("~r~No cabin here.");

    if (player.data.money < RIDE_COST) return player.notify("~r~Cannot afford.");

    // Transaction
    const success = await playerManager.removeMoneyAndSave(player, RIDE_COST, "Cable Car");
    if (success) {
        player.setVariable('cableCarSeat', assignedCabin);
        player.notify("~g~Boarded.");
    }
});

mp.events.add("playerReady", (player) => {
    player.call("CableCar:Sync", [JSON.stringify(systemState)]);
});

init();