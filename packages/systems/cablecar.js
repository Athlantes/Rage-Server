// packages/cablecar/index.js
const playerManager = require('../core/playerManager');

// --- CONFIGURATION ---
const TRAVEL_TIME = 45000; // 45 Seconds
const WAIT_TIME = 15000;   // 15 Seconds
const RIDE_COST = 100;
const MAX_PASSENGERS = 4;

// Coordinates (Exact cable line for Chiliad)
const POS_BOTTOM = new mp.Vector3(-740.92, 5593.18, 41.65);
const POS_TOP = new mp.Vector3(446.12, 5576.77, 781.18);

// Offsets for dropping players off safely
const EXIT_OFFSET_BOTTOM = new mp.Vector3(-743.0, 5595.0, 41.65);
const EXIT_OFFSET_TOP = new mp.Vector3(448.0, 5574.0, 781.18);

// State
let currentState = "WAITING"; // WAITING or MOVING
let nextStateTime = Date.now() + WAIT_TIME;

// Cabins
const cabins = [
    { id: 0, obj: null, start: POS_BOTTOM, end: POS_TOP, name: "Cabin A" },
    { id: 1, obj: null, start: POS_TOP, end: POS_BOTTOM, name: "Cabin B" }
];

// --- INITIALIZATION ---
function init() {
    // Create Cabin Objects
    cabins.forEach(c => {
        c.obj = mp.objects.new(mp.joaat("prop_cable_car_body"), c.start, {
            dimension: 0,
            alpha: 255
        });
        c.obj.setVariable('cableCarId', c.id); // Tag for client finder
    });

    console.log("[CableCar] System started. Fare: $" + RIDE_COST);
    
    // Start Loop
    setInterval(gameLoop, 1000);
}

// --- GAME LOOP ---
function gameLoop() {
    const now = Date.now();
    if (now >= nextStateTime) {
        if (currentState === "WAITING") {
            // START MOVING
            currentState = "MOVING";
            nextStateTime = now + TRAVEL_TIME;
            
            // Sync to clients
            mp.players.call("CableCar:Sync", [currentState, now, TRAVEL_TIME]);
            console.log("[CableCar] Departed.");
        } else {
            // ARRIVED (WAITING)
            currentState = "WAITING";
            nextStateTime = now + WAIT_TIME;

            // Force Ejection of all passengers
            ejectPassengers();

            // Swap positions logically for the next run
            cabins.forEach(c => {
                // Swap start and end vectors
                let temp = c.start;
                c.start = c.end;
                c.end = temp;
                
                // Snap object to new start (which is the destination)
                c.obj.position = c.start;
            });

            mp.players.call("CableCar:Sync", [currentState, now, WAIT_TIME]);
            console.log("[CableCar] Arrived. Waiting.");
        }
    }
}

// --- PASSENGER LOGIC ---

// Helper: Get passengers for a specific cabin
function getPassengers(cabinId) {
    return mp.players.toArray().filter(p => p.getVariable('attachedCableCar') === cabinId);
}

function ejectPassengers() {
    mp.players.forEach(p => {
        const cabinId = p.getVariable('attachedCableCar');
        if (cabinId !== undefined && cabinId !== null) {
            exitCableCar(p);
        }
    });
}

function exitCableCar(player) {
    const cabinId = player.getVariable('attachedCableCar');
    if (cabinId === null || cabinId === undefined) return;

    // Determine exit location based on where the cabin ended up
    // If we just finished moving, the cabin is at its 'end' point
    const cabin = cabins.find(c => c.id === cabinId);
    
    // Simple logic: teleport to the platform closest to the cabin
    const distToTop = player.dist(POS_TOP);
    const exitPos = (distToTop < 500) ? EXIT_OFFSET_TOP : EXIT_OFFSET_BOTTOM;

    player.setVariable('attachedCableCar', null); // Client will detach
    player.position = exitPos;
    player.notify("~g~Arrival!~w~ Please step off.");
}

// --- EVENTS ---

mp.events.add('CableCar:RequestEntry', async (player, cabinId) => {
    // 1. Validation
    if (currentState !== "WAITING") return player.notify("~r~The cable car is moving!");
    if (player.vehicle) return player.notify("~r~You cannot enter with a vehicle.");
    
    const cabin = cabins.find(c => c.id === cabinId);
    if (!cabin) return;

    // 2. Capacity Check
    const currentPassengers = getPassengers(cabinId);
    if (currentPassengers.length >= MAX_PASSENGERS) {
        return player.notify("~r~This cabin is full (Max 4).");
    }

    // 3. Money Check & Transaction
    // using user's database wrapper
    if (player.data.money < RIDE_COST) {
        return player.notify(`~r~You need $${RIDE_COST} to ride.`);
    }

    const success = await playerManager.removeMoneyAndSave(player, RIDE_COST, "Cable Car Ride");
    
    if (success) {
        // 4. Attach Player
        player.setVariable('attachedCableCar', cabinId);
        player.notify(`~g~Ticket purchased ($${RIDE_COST}).~w~ Enjoy the ride!`);
        console.log(`[CableCar] ${player.name} entered cabin ${cabinId}.`);
    } else {
        player.notify("~r~Transaction failed.");
    }
});

// Handle player quit to cleanup variables (optional, RAGE handles this mostly)
mp.events.add('playerQuit', (player) => {
    // Variable cleans up automatically
});

// Sync for new players
mp.events.add("playerReady", (player) => {
    player.call("CableCar:Sync", [currentState, Date.now() - (nextStateTime - (currentState === "MOVING" ? TRAVEL_TIME : WAIT_TIME)), (currentState === "MOVING" ? TRAVEL_TIME : WAIT_TIME)]);
});

init();