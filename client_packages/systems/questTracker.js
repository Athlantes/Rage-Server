
let lastPos = null;
let distAccumulator = 0;

setInterval(() => {
    const player = mp.players.local;
    if (!player.handle || player.vehicle) return; // Don't track if in vehicle

    const currentPos = player.position;
    if (lastPos) {
        const dist = mp.game.system.vdist(currentPos.x, currentPos.y, currentPos.z, lastPos.x, lastPos.y, lastPos.z);
        
        // Filter out teleport jumps (e.g. > 20 meters in 1 sec)
        if (dist > 0.1 && dist < 20) {
            distAccumulator += dist;
        }
    }
    lastPos = currentPos;

    // Batch send every 50 meters to save bandwidth
    if (distAccumulator >= 50) {
        mp.events.callRemote('server:processWalking', Math.floor(distAccumulator));
        distAccumulator = 0;
    }
}, 1000);