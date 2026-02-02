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

const playPedAnim = (ped, animData) => {
    if (!ped || !mp.peds.exists(ped) || !animData) return;
    
    mp.game.streaming.requestAnimDict(animData.dict);
    
    // Wait for animation dictionary to load (non-blocking)
    let attempts = 0;
    const interval = setInterval(() => {
        if (mp.game.streaming.hasAnimDictLoaded(animData.dict)) {
            if (mp.peds.exists(ped)) {
                // playAnim(dict, name, speed, speedMult, duration, flag, playbackRate, lockX, lockY, lockZ)
                ped.taskPlayAnim(animData.dict, animData.name, 8.0, 1.0, -1, animData.flag || 1, 0.0, false, false, false);
            }
            clearInterval(interval);
        }

        attempts++;
        if (attempts > 50) clearInterval(interval); // Stop after 2.5 seconds if it fails
    }, 50);
};

mp.events.add('entityStreamIn', (entity) => {
    if (entity.type === 'ped') {
        const anim = entity.getVariable('staticAnim');
        if (anim) {
            playPedAnim(entity, anim);
        }
    }
});

// 3. Play if Variable Changes (Dynamic Updates)
mp.events.addDataHandler('staticAnim', (entity, value) => {
    if (entity.type === 'ped') {
        playPedAnim(entity, value);
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

mp.events.add('client:showJobSubtitle', (text, time = 5000) => {
    mp.game.ui.setTextEntry("STRING");
    mp.game.ui.addTextComponentSubstringPlayerName(text);
    mp.game.ui.drawSubtitleTimed(time, true);
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