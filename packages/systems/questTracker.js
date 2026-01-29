// client_packages/systems/questTracker.js
let lastPos = null;
let distAccumulator = 0;

setInterval(() => {
    const player = mp.players.local;
    
    // 1. Basic Checks: Must be spawned, not in vehicle
    if (!player.handle || player.vehicle) {
        lastPos = null; // Reset if they get in a car
        return;
    }

    const currentPos = player.position;

    if (lastPos) {
        // 2. Calculate Distance
        const dist = mp.game.system.vdist(
            currentPos.x, currentPos.y, currentPos.z, 
            lastPos.x, lastPos.y, lastPos.z
        );
        
        // 3. Filter Teleports vs Walking
        // (Move at least 0.1m but less than 15m in 1 second)
        if (dist > 0.1 && dist < 15) {
            distAccumulator += dist;
        }
    }

    // 4. Update "Last Position" safely (Copy values, don't just reference the object)
    lastPos = new mp.Vector3(currentPos.x, currentPos.y, currentPos.z);

    // 5. Send to Server (Threshold lowered to 10 meters for easier testing)
    if (distAccumulator >= 10) {
        mp.gui.chat.push(`[Debug] Walking Update: Sending ${Math.floor(distAccumulator)}m`); // Debug info in chat
        mp.events.callRemote('server:processWalking', Math.floor(distAccumulator));
        distAccumulator = 0;
    }
}, 1000);