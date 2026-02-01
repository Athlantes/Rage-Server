// client_packages/systems/scooters.js

let scooterBlip = null;
let scooterCheckInterval = null;

// 1. Receive Coordinates from Server -> Set Waypoint
mp.events.add('client:scooter:setLocate', (x, y, z) => {
    // Clear existing
    if (scooterBlip && mp.blips.exists(scooterBlip)) {
        scooterBlip.destroy();
    }
    if (scooterCheckInterval) {
        clearInterval(scooterCheckInterval);
    }

    // Create Blip (Sprite 522 is a scooter/moped icon)
    scooterBlip = mp.blips.new(522, new mp.Vector3(x, y, z), {
        name: 'Requested eScootr',
        color: 2, // Green
        shortRange: false,
        scale: 1.0
    });

    // Set GPS Route
    mp.game.ui.setNewWaypoint(x, y);
    mp.game.graphics.notify("~g~[eScootr]~w~ Location set on GPS.");

    // Auto-delete blip if we get close
    scooterCheckInterval = setInterval(() => {
        const playerPos = mp.players.local.position;
        const dist = mp.game.system.vdist(playerPos.x, playerPos.y, playerPos.z, x, y, z);

        if (dist < 10.0) {
            if (scooterBlip && mp.blips.exists(scooterBlip)) {
                scooterBlip.destroy();
                scooterBlip = null;
            }
            clearInterval(scooterCheckInterval);
            mp.game.graphics.notify("~g~[eScootr]~w~ You have arrived.");
        }
    }, 2000);
});

// 2. Clear Blip (Called if someone else rents it)
mp.events.add('client:scooter:lostTrack', () => {
    if (scooterBlip && mp.blips.exists(scooterBlip)) {
        scooterBlip.destroy();
        scooterBlip = null;
    }
    if (scooterCheckInterval) {
        clearInterval(scooterCheckInterval);
    }
    mp.game.graphics.notify("~r~[eScootr]~w~ Signal lost (Vehicle Rented).");
});

// 3. Rent Success Feedback
mp.events.add('client:phone:rentSuccess', (endTime) => {
    mp.game.graphics.notify("~g~[eScootr]~w~ Rental started! Engine unlocked.");
    // You could also add a countdown timer HUD here if you wanted
});