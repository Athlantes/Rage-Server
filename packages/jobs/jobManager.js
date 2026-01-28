// packages/jobs/jobManager.js
const db = require('../core/database'); 

const availableJobs = new Map();

const jobManager = {
    register: (id, config, logic) => {
        if (availableJobs.has(id)) return console.log(`[Jobs] Error: ID ${id} exists.`);

        availableJobs.set(id, { config, logic });

        // NPC
        mp.peds.new(mp.joaat(config.pedModel), new mp.Vector3(config.pos.x, config.pos.y, config.pos.z), {
            heading: config.pos.h || 0,
            dynamic: false,
            invincible: true,
            frozen: true,
            lockController: true
        });

        // Global Blip (Job Center locations are public, so server-side blip is fine here)
        mp.blips.new(config.blipSprite, new mp.Vector3(config.pos.x, config.pos.y, config.pos.z), {
            name: config.name,
            color: config.blipColor || 1,
            shortRange: true,
            scale: 1.0
        });

        // Interaction Shape
        const shape = mp.colshapes.newTube(config.pos.x, config.pos.y, config.pos.z - 1.0, 3.0, 2.5);
        shape.setVariable('interaction', {
            title: config.name,
            text: "Press E to Start Job",
            event: "server:job:requestStart",
            data: id
        });

        console.log(`[Jobs] Registered: ${config.name}`);
    },

    startJobSession: (player, jobId) => {
        const job = availableJobs.get(jobId);
        if (!job) return;

        player.setVariable('activeJobId', jobId); 
        player.activeJobId = jobId; 
        player.call('showNotification', ['Job Center', `Started: ${job.config.name}`]);
    },

    // Refactored to use Client-Side Visuals
    createObjective: (player, pos, label, radius = 2.0, onEnterCallback, options = {}) => {
        jobManager.clearObjective(player);

        // 1. Send Visuals to Client (Private)
        player.call('client:setJobObjective', ['main_objective', pos, {
            markerColor: options.markerColor || [248, 182, 50, 100],
            blipSprite: options.blipSprite || 1,
            blipColor: options.blipColor || 5,
            name: label,
            route: true
        }]);

        // 2. Server Side Logic (Invisible Colshape)
        const shape = mp.colshapes.newCircle(pos.x, pos.y, radius);
        shape.dimension = player.dimension;
        shape.isJobObjective = true;
        shape.ownerId = player.id;
        
        player.jobShape = shape;
        player.jobCallback = onEnterCallback; 
    },

    clearObjective: (player) => {
        // Clear Client Visuals
        player.call('client:clearAllJobObjectives');

        // Clear Server Logic
        if (player.jobShape) { player.jobShape.destroy(); player.jobShape = null; }
        player.jobCallback = null;
        if (player.jobExitCheck) { clearInterval(player.jobExitCheck); player.jobExitCheck = null; }
    },

    stopJob: (player, reason = "Job Ended") => {
        jobManager.clearObjective(player);
        if (player.activeJobId) {
            const job = availableJobs.get(player.activeJobId);
            if (job && job.logic.onStop) job.logic.onStop(player);
        }

        player.setVariable('activeJobId', null);
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

    if (job.logic.onInteract) {
        job.logic.onInteract(player);
    } else {
        jobManager.startJobSession(player, closestId);
        if (job.logic.onStart) job.logic.onStart(player);
    }
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
    if (player.jobCallback) player.jobCallback(player);
});

module.exports = jobManager;