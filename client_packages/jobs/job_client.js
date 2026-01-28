// client_packages/jobs/job_client.js
let currentJobMarker = null; // { x, y, z, color }

mp.events.add('client:setJobObjective', (x, y, z, color) => {
    currentJobMarker = { x, y, z, color };
});

mp.events.add('client:clearJobObjective', () => {
    currentJobMarker = null;
});

mp.events.add('render', () => {
    if (currentJobMarker) {
        mp.game.graphics.drawMarker(
            1, // Cylinder
            currentJobMarker.x, currentJobMarker.y, currentJobMarker.z - 1.0, 
            0, 0, 0, 
            0, 0, 0, 
            1.5, 1.5, 1.5, // Scale
            currentJobMarker.color[0], currentJobMarker.color[1], currentJobMarker.color[2], currentJobMarker.color[3],
            false, false, 2, 
            false,
            null, null, false
        );
    }
});