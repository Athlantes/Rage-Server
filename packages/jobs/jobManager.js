// packages/jobs/jobManager.js
const db = require('../core/database'); 
const playerManager = require('../core/playerManager');

const availableJobs = new Map();

const jobManager = {

    // [NEW] Allow other scripts to get the list of jobs
    getDefinitions: () => {
        return availableJobs;
    },

    // A. Load Skills when player joins
    loadJobSkills: async (player) => {
        if (!player.data.dbId) {
            console.log(`[Jobs] Error: Player ${player.name} has no DB ID during loadJobSkills.`);
            player.data.jobSkills = {};
            return;
        }

        // console.log(`[Jobs] Loading skills for ${player.name}...`);

        const loadedSkills = {}; 
        try {
            const [rows] = await db.query('SELECT job_key, xp, level FROM character_job_skills WHERE character_id = ?', [player.data.dbId]);
            rows.forEach(row => {
                loadedSkills[row.job_key] = { xp: row.xp, level: row.level };
            });
            player.data.jobSkills = loadedSkills; 
        } catch (err) { 
            console.error("[Jobs] Failed to load skills:", err); 
            player.data.jobSkills = {}; 
        }
    },

    getJobLevel: (player, jobKey) => {
        if (!player.data.jobSkills || !player.data.jobSkills[jobKey]) return 1;
        return player.data.jobSkills[jobKey].level;
    },

    getRankName: (level) => {
        if (level >= 100) return "Grandmaster";
        if (level >= 80) return "Master";
        if (level >= 60) return "Expert";
        if (level >= 40) return "Professional";
        if (level >= 20) return "Skilled";
        if (level >= 10) return "Apprentice";
        return "Trainee";
    },

    addJobXp: async (player, jobKey, amount) => {
        let currentSkills = player.data.jobSkills ? { ...player.data.jobSkills } : {};
        if (!currentSkills[jobKey]) currentSkills[jobKey] = { xp: 0, level: 1 };

        let skill = currentSkills[jobKey];
        skill.xp += amount;

        const newLevel = Math.floor(Math.sqrt(skill.xp / 100)) + 1;
        if (newLevel > skill.level) {
            skill.level = newLevel;
            const rankName = jobManager.getRankName(newLevel);
            player.call('showNotification', ['Job Promotion', `You are now a ${rankName} (Lvl ${newLevel})!`]);
            player.call('playSound', ['HUD_AWARDS', 'CHALLENGE_UNLOCKED']); 
        }

        player.data.jobSkills = currentSkills; 

        try {
            await db.query(`
                INSERT INTO character_job_skills (character_id, job_key, xp, level) VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE xp = VALUES(xp), level = VALUES(level)
            `, [player.data.dbId, jobKey, skill.xp, skill.level]);
        } catch (e) {
            console.error(`[JobManager] DB Save Error for ${player.name}:`, e);
        }
    },
    
    // --- JOB REGISTRATION & MANAGEMENT ---
    register: (id, config, logic) => {
        if (availableJobs.has(id)) return console.log(`[Jobs] Error: ID ${id} exists.`);
        
        // Ensure default description/buttons if missing
        if (!config.description) config.description = "Perform tasks to earn money and experience.";
        if (!config.previewButtons) config.previewButtons = [{ label: "Start Job", action: "default" }];

        availableJobs.set(id, { config, logic });

        // 1. Create Main Job Interaction Ped
        if (config.pos) {
            mp.peds.new(mp.joaat(config.pedModel), new mp.Vector3(config.pos.x, config.pos.y, config.pos.z), {
                heading: config.pos.h || 0,
                dynamic: false, invincible: true, frozen: true
            });

            mp.blips.new(config.blipSprite, new mp.Vector3(config.pos.x, config.pos.y, config.pos.z), {
                name: config.name, color: config.blipColor || 1, shortRange: true, scale: 1.0
            });

            const shape = mp.colshapes.newTube(config.pos.x, config.pos.y, config.pos.z - 1.0, 3.0, 2.5);
            shape.setVariable('interaction', {
                title: config.name, text: "Press E to Start Job", event: "server:job:requestStart", data: id
            });
        }

        // 2. Create Extra Static Peds
        if (config.staticPeds && Array.isArray(config.staticPeds)) {
            config.staticPeds.forEach(pedData => {
                const ped = mp.peds.new(mp.joaat(pedData.model), new mp.Vector3(pedData.x, pedData.y, pedData.z), {
                    heading: pedData.h || 0,
                    dynamic: false, invincible: true, frozen: true
                });
                if (pedData.anim) {
                    ped.setVariable('staticAnim', pedData.anim);
                }
            });
        }
    },

    startJobSession: (player, jobId) => {
        if (!availableJobs.has(jobId)) return;
        const job = availableJobs.get(jobId);

        player.activeJobId = jobId;
        player.setVariable('activeJobId', jobId);
        player.jobPeds = []; 
        player.call('showNotification', ['Job Center', `You started working as a ${job.config.name}.`]);
    },

    stopJob: (player, reason = "") => {
        if (!player.activeJobId) return;
        const job = availableJobs.get(player.activeJobId);

        jobManager.clearJobPeds(player);

        if (job && job.logic.onStop) job.logic.onStop(player);

        player.setVariable('activeJobId', null);
        player.activeJobId = null;
        if(reason) player.call('showNotification', ['Job Center', reason]);
    },

    // --- OBJECTIVE HELPERS ---
    createObjective: (player, pos, label, radius = 2.0, onEnterCallback, options = {}) => {
        jobManager.clearObjective(player);

        player.call('client:setJobObjective', ['main_objective', pos, {
            markerColor: options.markerColor || [248, 182, 50, 100],
            blipSprite: options.blipSprite || 1,
            blipColor: options.blipColor || 5,
            name: label,
            route: true
        }]);

        const shape = mp.colshapes.newCircle(pos.x, pos.y, radius);
        shape.dimension = player.dimension;
        shape.isJobObjective = true;
        shape.ownerId = player.id;
        
        player.jobShape = shape;
        player.jobCallback = onEnterCallback; 
    },

    clearObjective: (player) => {
        player.call('client:clearAllJobObjectives');
        if (player.jobShape) { 
            player.jobShape.destroy(); 
            player.jobShape = null; 
        }
        player.jobCallback = null;
        if (player.jobExitCheck) { 
            clearInterval(player.jobExitCheck); 
            player.jobExitCheck = null; 
        }
    },

    // --- DYNAMIC PED HELPERS ---
    createJobPed: (player, model, pos, heading, anim = null) => {
        if (!player.jobPeds) player.jobPeds = [];

        const ped = mp.peds.new(mp.joaat(model), new mp.Vector3(pos.x, pos.y, pos.z), {
            heading: heading,
            dimension: player.dimension,
            dynamic: false, 
            invincible: true, 
            frozen: true
        });

        if (anim) {
            ped.setVariable('staticAnim', anim);
        }

        player.jobPeds.push(ped);
        return ped;
    },

    clearJobPeds: (player) => {
        if (player.jobPeds && player.jobPeds.length > 0) {
            player.jobPeds.forEach(ped => {
                if (mp.peds.exists(ped)) ped.destroy();
            });
        }
        player.jobPeds = [];
    }
};

// --- EVENTS ---
mp.events.add('server:loadAccount', async (player) => {
    await jobManager.loadJobSkills(player);
});

mp.events.add('server:job:requestStart', (player) => {
    let closestId = null, minDist = 5.0;
    
    availableJobs.forEach((job, id) => {
        if (job.config.pos) {
            const dist = player.dist(new mp.Vector3(job.config.pos.x, job.config.pos.y, job.config.pos.z));
            if (dist < minDist) { minDist = dist; closestId = id; }
        }
    });

    if (!closestId) return;
    if (player.activeJobId) return player.outputChatBox("!{FF0000}Stop your current job first (/stopwork).");

    const job = availableJobs.get(closestId);

    // Send data to client for the UI
    player.call('client:job:openPreview', [{
        id: closestId,
        name: job.config.name,
        description: job.config.description,
        pos: job.config.pos, // Needed for camera
        buttons: job.config.previewButtons
    }]);
});

mp.events.add('server:job:continue', (player, jobId, action) => {
    // Basic validation
    const job = availableJobs.get(jobId);
    if (!job) return;
    if (player.activeJobId) return; // Anti-cheat/double click check

    if (job.logic.onInteract) {
        // Pass the 'action' (e.g., 'apple', 'crop') to the job logic
        job.logic.onInteract(player, action);
    } else {
        // Fallback for simple jobs (Courier) that rely on onStart
        jobManager.startJobSession(player, jobId);
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