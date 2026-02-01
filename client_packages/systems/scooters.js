// client_packages/systems/scooters.js

let scooterTrace = {
    blip: null,
    remoteId: null, // The RageMP vehicle ID
    interval: null,
    targetPos: null
};

// 1. Start Tracking
mp.events.add('client:scooter:setLocate', (remoteId, x, y, z) => {
    cleanupTrace();

    scooterTrace.remoteId = remoteId;
    scooterTrace.targetPos = new mp.Vector3(x, y, z);

    // Initial Waypoint
    mp.game.ui.setNewWaypoint(x, y);
    mp.game.graphics.notify("~g~[eScootr]~w~ Location set on GPS.");

    // Create Blip at last known location initially
    scooterTrace.blip = mp.blips.new(522, new mp.Vector3(x, y, z), {
        name: 'Requested Scooter',
        color: 83, // Purple
        scale: 1.0,
        shortRange: false
    });
    scooterTrace.blip.setRoute(true);

    // Start a 1-second interval (Much lighter than render)
    scooterTrace.interval = setInterval(updateTracking, 1000);
});

// 2. Stop Tracking
mp.events.add('client:phone:rentSuccess', () => {
    cleanupTrace();
    mp.game.graphics.notify("~g~[eScootr]~w~ Rental started.");
});

function cleanupTrace() {
    if (scooterTrace.blip && mp.blips.exists(scooterTrace.blip)) {
        scooterTrace.blip.destroy();
    }
    if (scooterTrace.interval) {
        clearInterval(scooterTrace.interval);
    }
    scooterTrace = { blip: null, remoteId: null, interval: null, targetPos: null };
}

function updateTracking() {
    const player = mp.players.local;
    
    // Check if we arrived
    if (scooterTrace.targetPos) {
        const dist = mp.game.system.vdist(player.position.x, player.position.y, player.position.z, scooterTrace.targetPos.x, scooterTrace.targetPos.y, scooterTrace.targetPos.z);
        if (dist < 5.0) {
            mp.game.graphics.notify("~g~[eScootr]~w~ You have arrived.");
            cleanupTrace();
            return;
        }
    }

    // Dynamic Entity Tracking
    // If the vehicle streams in, attach the blip to it so it moves on the map!
    if (scooterTrace.remoteId && scooterTrace.blip && mp.blips.exists(scooterTrace.blip)) {
        const veh = mp.vehicles.atRemoteId(scooterTrace.remoteId);
        
        if (veh && veh.handle !== 0) {
            // Vehicle is streamed in
            const currentBlipPos = scooterTrace.blip.getCoords();
            const vehPos = veh.position;

            // Update blip position to follow scooter
            if (mp.game.system.vdist(currentBlipPos.x, currentBlipPos.y, currentBlipPos.z, vehPos.x, vehPos.y, vehPos.z) > 1.0) {
                scooterTrace.blip.setCoords(vehPos);
                scooterTrace.targetPos = vehPos; // Update arrival target
            }
        }
    }
}