// jobs/jobManager.js
const db = require('../core/database'); 

// Registry
const availableJobs = new Map();

const jobManager = {
    // --- 1. REGISTRATION ---
    register: (id, config, logic) => {
        if (availableJobs.has(id)) return console.log(`[Jobs] Error: ID ${id} exists.`);

        availableJobs.set(id, { config, logic });

        // Create Static Start NPC
        mp.peds.new(mp.joaat(config.pedModel), new mp.Vector3(config.pos.x, config.pos.y, config.pos.z), {
            heading: config.pos.h || 0,
            dynamic: false,
            invincible: true,
            frozen: true,
            lockController: true
        });

        // Create Start Blip
        mp.blips.new(config.blipSprite, new mp.Vector3(config.pos.x, config.pos.y, config.pos.z), {
            name: config.name,
            color: config.blipColor || 1,
            shortRange: true,
            scale: 1.0
        });

        // Create Start Interaction
        const shape = mp.colshapes.newSphere(config.pos.x, config.pos.y, config.pos.z, 1.5);
        shape.setVariable('interaction', {
            title: config.name,
            text: "Press E to Start Job",
            event: "server:job:requestStart",
            data: id
        });

        console.log(`[Jobs] Registered: ${config.name}`);
    },

    // --- 2. STANDARD OBJECTIVE (Visual Marker + Blip) ---
    createObjective: (player, pos, label, radius = 2.0, onEnterCallback, options = {}) => {
        jobManager.clearObjective(player);

        const blipSprite = options.blipSprite || 1;
        const blipColor = options.blipColor || 5;

        // A. Visual Marker
        player.jobVisual = mp.markers.new(1, new mp.Vector3(pos.x, pos.y, pos.z - 1.0), 1.5, {
            color: options.markerColor || [248, 182, 50, 100], 
            visible: true,
            dimension: player.dimension
        });

        // B. Blip
        player.jobBlip = mp.blips.new(blipSprite, new mp.Vector3(pos.x, pos.y, pos.z), {
            name: label,
            color: blipColor, 
            scale: 0.8,
            shortRange: false,
            dimension: player.dimension
        });

        // Explicitly enable the GPS route client-side (server route flag is unreliable)
        player.call('client:setRoute', [player.jobBlip.id, true, options.routeColor ?? blipColor]);

        // C. The Trigger
        const shape = mp.colshapes.newCircle(pos.x, pos.y, radius);
        shape.dimension = player.dimension;
        shape.isJobObjective = true;
        shape.ownerId = player.id;
        
        player.jobShape = shape;
        player.jobCallback = onEnterCallback; 
    },

    // --- 3. ARRIVAL OBJECTIVE (Blip Only - No Red Marker) ---
    createArrivalObjective: (player, pos, label, radius = 15.0, onEnterCallback, options = {}) => {
        jobManager.clearObjective(player);

        const blipSprite = options.blipSprite || 1;
        const blipColor = options.blipColor || 5;

        // A. Blip ONLY
        player.jobBlip = mp.blips.new(blipSprite, new mp.Vector3(pos.x, pos.y, pos.z), {
            name: label,
            color: blipColor, 
            scale: 0.8,
            shortRange: false,
            dimension: player.dimension
        });

        // Explicit GPS route
        player.call('client:setRoute', [player.jobBlip.id, true, options.routeColor ?? blipColor]);

        // B. Large Trigger Zone
        const shape = mp.colshapes.newCircle(pos.x, pos.y, radius);
        shape.dimension = player.dimension;
        shape.isJobObjective = true;
        shape.ownerId = player.id;
        
        player.jobShape = shape;
        player.jobCallback = onEnterCallback; 
    },

    clearObjective: (player) => {
        if (player.jobVisual) { player.jobVisual.destroy(); player.jobVisual = null; }
        if (player.jobBlip) {
            // Turn off the GPS route before removing the blip
            player.call('client:setRoute', [player.jobBlip.id, false]);
            player.jobBlip.destroy();
            player.jobBlip = null;
        }
        if (player.jobShape) { player.jobShape.destroy(); player.jobShape = null; }
        player.jobCallback = null;
        
        // Clear any vehicle exit check interval if it exists
        if (player.jobExitCheck) { clearInterval(player.jobExitCheck); player.jobExitCheck = null; }
    },

    stopJob: (player, reason = "Job Ended") => {
        jobManager.clearObjective(player);

        if (player.activeJobId) {
            const job = availableJobs.get(player.activeJobId);
            if (job && job.logic.onStop) job.logic.onStop(player);
        }

        player.activeJobId = null;
        if(reason) player.call('showNotification', ['Job Center', reason]);
    }
};

// --- EVENTS ---

mp.events.add('server:job:requestStart', (player) => {
    let closestId = null, minDist = 5.0;
    availableJobs.forEach((job, id) => {
        const dist = player.dist(new mp.Vector3(job.config.pos.x, job.config.pos.y, job.config.pos.z));
        if (dist < minDist) { minDist = dist; closestId = id; }
    });

    if (!closestId) return;

    if (player.activeJobId) return player.outputChatBox("!{FF0000}Stop your current job first (/stopwork).");

    const job = availableJobs.get(closestId);
    player.activeJobId = closestId;
    if (job.logic.onStart) job.logic.onStart(player);
    player.call('showNotification', ['Job Center', `Started: ${job.config.name}`]);
});

mp.events.addCommand('stopwork', (player) => {
    if (!player.activeJobId) return player.call('showNotification', ['Job Center', 'You are not working.']);
    jobManager.stopJob(player, "You quit your job.");
});

mp.events.add('playerQuit', (player) => {
    if (player.activeJobId) jobManager.stopJob(player, null);
});

mp.events.add('playerEnterColshape', (player, shape) => {
    if (!shape || !shape.isJobObjective) return;
    if (shape.ownerId !== player.id) return;
    if (player.jobCallback) {
        player.jobCallback(player);
    }
});

module.exports = jobManager;