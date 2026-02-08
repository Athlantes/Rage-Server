// packages/systems/cablecar.js
const playerManager = require('../core/playerManager');

// --- CONFIGURATION ---
const RIDE_COST = 100;
const WAIT_TIME = 30000;    // 30 seconds at station
const TRAVEL_TIME = 55000;  // 55 seconds travel time

let currentState = 0; 
let nextStateTime = Date.now() + WAIT_TIME;

function init() {
    console.log(`[CableCar] Service started. Fare: $${RIDE_COST}`);

    mp.blips.new(36, new mp.Vector3(-740.911, 5599.341, 47.25), {
        name: "Cable Car",
        color: 4, // 4 is standard grey/white. Use 0 for white, 1 for red, etc.
        shortRange: true,
        scale: 1.0
    });

    // Top Station Blip
    mp.blips.new(36, new mp.Vector3(446.291, 5566.377, 786.75), {
        name: "Cable Car",
        color: 4,
        shortRange: true,
        scale: 1.0
    });

    setInterval(gameLoop, 1000);
}

function gameLoop() {
    const now = Date.now();
    if (now >= nextStateTime) {
        
        // State Machine Transition
        switch (currentState) {
            case 0: // WAITING_START -> MOVING_FWD
                currentState = 1;
                nextStateTime = now + TRAVEL_TIME;
                break;
            case 1: // MOVING_FWD -> WAITING_END
                currentState = 2;
                nextStateTime = now + WAIT_TIME;
                ejectPassengers(); 
                break;
            case 2: // WAITING_END -> MOVING_BACK
                currentState = 3;
                nextStateTime = now + TRAVEL_TIME;
                break;
            case 3: // MOVING_BACK -> WAITING_START
                currentState = 0;
                nextStateTime = now + WAIT_TIME;
                ejectPassengers(); 
                break;
        }

        // Sync: Send 0 as "TimePassed" because state just started
        const duration = (currentState % 2 !== 0) ? TRAVEL_TIME : WAIT_TIME;
        mp.players.call("CableCar:Sync", [currentState, 0, duration]);
    }
}

function ejectPassengers() {
    mp.players.forEach(p => {
        const cabinId = p.getVariable('attachedCableCar');
        if (cabinId !== undefined && cabinId !== null) {
            p.setVariable('attachedCableCar', null);
            p.notify("~g~We have arrived. Please exit.");
        }
    });
}

mp.events.add('CableCar:RequestEntry', async (player, cabinId) => {
    const canEnter = (currentState === 0 || currentState === 2);
    
    if (!canEnter) return player.notify("~r~The cable car is moving!");
    if (player.vehicle) return player.notify("~r~You cannot enter with a vehicle.");
    if (player.data.money < RIDE_COST) return player.notify(`~r~You need $${RIDE_COST} to ride.`);

    const success = await playerManager.removeMoneyAndSave(player, RIDE_COST, "Cable Car Ticket");
    
    if (success) {
        player.setVariable('attachedCableCar', cabinId);
        player.notify(`~g~Ticket purchased ($${RIDE_COST}).~w~ Enjoy the ride!`);
    } else {
        player.notify("~r~Transaction failed.");
    }
});

// Sync for players joining late
mp.events.add("playerReady", (player) => {
    let timeRemaining = nextStateTime - Date.now();
    if (timeRemaining < 0) timeRemaining = 0;
    
    const duration = (currentState % 2 !== 0) ? TRAVEL_TIME : WAIT_TIME;
    const timePassed = duration - timeRemaining;
    
    // Send relative timePassed
    player.call("CableCar:Sync", [currentState, timePassed, duration]);
});

init();