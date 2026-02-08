// packages/systems/cablecar.js
const playerManager = require('../core/playerManager');

// --- CONFIGURATION ---
const RIDE_COST = 100;
const WAIT_TIME = 30000;    // 30 seconds wait
const TRAVEL_TIME = 55000;  // 55 seconds travel
const INTERACTION_RADIUS = 6.0; // Increased radius to ensure prompt works

const STATIONS = {
    BOTTOM: new mp.Vector3(-740.911, 5599.341, 47.25),
    TOP: new mp.Vector3(446.291, 5566.377, 786.75)
};

// 0: WAITING_START (Cab 0 Bottom, Cab 1 Top)
// 1: MOVING_FWD   (Cab 0 -> Top, Cab 1 -> Bottom)
// 2: WAITING_END   (Cab 0 Top, Cab 1 Bottom)
// 3: MOVING_BACK  (Cab 0 -> Bottom, Cab 1 -> Top)
let currentState = 0; 
let nextStateTime = Date.now() + WAIT_TIME;

function init() {
    console.log(`[CableCar] V3 Service started.`);

    createStationBlip(STATIONS.BOTTOM, "Cable Car Station");
    createStationBlip(STATIONS.TOP, "Cable Car Station");

    setInterval(gameLoop, 1000);
}

function createStationBlip(pos, name) {
    mp.blips.new(36, pos, {
        name: name,
        color: 4, 
        shortRange: true,
        scale: 1.0
    });
}

function gameLoop() {
    const now = Date.now();
    if (now >= nextStateTime) {
        
        switch (currentState) {
            case 0: // WAITING -> MOVE
                currentState = 1;
                nextStateTime = now + TRAVEL_TIME;
                break;
            case 1: // MOVE -> WAITING
                currentState = 2;
                nextStateTime = now + WAIT_TIME;
                ejectPassengers(); 
                break;
            case 2: // WAITING -> MOVE
                currentState = 3;
                nextStateTime = now + TRAVEL_TIME;
                break;
            case 3: // MOVE -> WAITING
                currentState = 0;
                nextStateTime = now + WAIT_TIME;
                ejectPassengers(); 
                break;
        }

        syncToAll();
    }
}

function syncToAll() {
    const duration = (currentState % 2 !== 0) ? TRAVEL_TIME : WAIT_TIME;
    mp.players.call("CableCar:Sync", [currentState, 0, duration]);
}

function ejectPassengers() {
    mp.players.forEach(p => {
        if (p.getVariable('attachedCableCar') != null) {
            p.setVariable('attachedCableCar', null);
            p.notify("~g~Arrived. Please exit.");
        }
    });
}

mp.events.add('CableCar:RequestEntry', async (player) => {
    if (player.vehicle) return player.notify("~r~No vehicles allowed.");
    if (player.getVariable('attachedCableCar') != null) return player.notify("~r~You are already in the cable car.");

    const distToBottom = player.dist(STATIONS.BOTTOM);
    const distToTop = player.dist(STATIONS.TOP);

    let selectedCabin = -1;

    // Logic: Map State + Location to specific Cabin ID
    if (currentState === 0) { // WAITING_START (0=Bottom, 1=Top)
        if (distToBottom < INTERACTION_RADIUS) selectedCabin = 0;
        else if (distToTop < INTERACTION_RADIUS) selectedCabin = 1;
    } 
    else if (currentState === 2) { // WAITING_END (0=Top, 1=Bottom)
        if (distToBottom < INTERACTION_RADIUS) selectedCabin = 1;
        else if (distToTop < INTERACTION_RADIUS) selectedCabin = 0;
    }
    else {
        return player.notify("~r~Cable car is moving.");
    }

    if (selectedCabin === -1) {
        return player.notify("~r~Too far from the platform.");
    }

    if (player.data.money < RIDE_COST) return player.notify(`~r~Need $${RIDE_COST}.`);

    const success = await playerManager.removeMoneyAndSave(player, RIDE_COST, "Cable Car Ticket");
    if (success) {
        player.setVariable('attachedCableCar', selectedCabin);
        player.notify(`~g~Boarded Cabin ${selectedCabin + 1}.`);
    } else {
        player.notify("~r~Can't afford it.");
    }
});

mp.events.add("playerReady", (player) => {
    let timeRemaining = nextStateTime - Date.now();
    if (timeRemaining < 0) timeRemaining = 0;
    
    const duration = (currentState % 2 !== 0) ? TRAVEL_TIME : WAIT_TIME;
    const timePassed = duration - timeRemaining;
    
    player.call("CableCar:Sync", [currentState, timePassed, duration]);
});

init();