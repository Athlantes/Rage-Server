// client_packages/jobs/job_client.js

// Store local entities so we can delete them later
let jobMarkers = new Map();
let jobBlips = new Map();

// --- SINGLE OBJECTIVE (Used by Courier/JobManager) ---
mp.events.add('client:setJobObjective', (id, pos, options) => {
    // options: { markerColor, blipSprite, blipColor, name, route }
    
    // Clear existing with this ID if any
    cleanObjective(id);

    // 1. Create Marker
    if (options.markerColor) {
        const marker = mp.markers.new(1, new mp.Vector3(pos.x, pos.y, pos.z - 1.0), 1.5, {
            color: options.markerColor,
            visible: true,
            dimension: mp.players.local.dimension
        });
        jobMarkers.set(id, marker);
    }

    // 2. Create Blip
    if (options.blipSprite) {
        const blip = mp.blips.new(options.blipSprite, new mp.Vector3(pos.x, pos.y, pos.z), {
            name: options.name || "Job Objective",
            color: options.blipColor || 1,
            scale: 0.8,
            shortRange: false,
            dimension: mp.players.local.dimension
        });

        if (options.route) {
            blip.setRoute(true);
            blip.setRouteColour(options.blipColor || 1);
        }

        jobBlips.set(id, blip);
    }
});

// --- BULK OBJECTIVES (Used by Garbage Job) ---
mp.events.add('client:setupJobObjectives', (dataArray) => {
    // dataArray = [ { id, x, y, z, markerColor, blipSprite, ... }, ... ]
    
    dataArray.forEach(item => {
        cleanObjective(item.id);

        // Marker (Smaller for garbage bins)
        if (item.markerColor) {
            const marker = mp.markers.new(1, new mp.Vector3(item.x, item.y, item.z - 1.0), 0.7, {
                color: item.markerColor,
                visible: true,
                dimension: mp.players.local.dimension
            });
            jobMarkers.set(item.id, marker);
        }

        // Blip
        if (item.blipSprite) {
            const blip = mp.blips.new(item.blipSprite, new mp.Vector3(item.x, item.y, item.z), {
                name: item.name,
                color: item.blipColor,
                scale: 0.7,
                shortRange: true, // Garbage blips should be short range
                dimension: mp.players.local.dimension
            });
            jobBlips.set(item.id, blip);
        }
    });
});

mp.events.add('client:removeJobObjective', (id) => {
    cleanObjective(id);
});

mp.events.add('client:clearAllJobObjectives', () => {
    jobMarkers.forEach(m => { if(mp.markers.exists(m)) m.destroy(); });
    jobBlips.forEach(b => { if(mp.blips.exists(b)) b.destroy(); });
    jobMarkers.clear();
    jobBlips.clear();
});

function cleanObjective(id) {
    if (jobMarkers.has(id)) {
        const m = jobMarkers.get(id);
        if (m && mp.markers.exists(m)) m.destroy();
        jobMarkers.delete(id);
    }
    if (jobBlips.has(id)) {
        const b = jobBlips.get(id);
        if (b && mp.blips.exists(b)) b.destroy();
        jobBlips.delete(id);
    }
}