// packages/jobs/jobManager.js
const db = require('../core/database'); 
const playerManager = require('../core/playerManager');

const availableJobs = new Map();

const jobManager = {

    // A. Load Skills when player joins
    loadJobSkills: async (player) => {
        // Debug: Check if DB ID exists
        if (!player.data.dbId) {
            console.log(`[Jobs] Error: Player ${player.name} has no DB ID during loadJobSkills.`);
            player.data.jobSkills = {};
            return;
        }

        console.log(`[Jobs] Loading skills for ${player.name} (DB ID: ${player.data.dbId})...`);

        // 1. Create a LOCAL object first (Critical for player.data sync)
        const loadedSkills = {}; 

        try {
            const [rows] = await db.query('SELECT job_key, xp, level FROM character_job_skills WHERE character_id = ?', [player.data.dbId]);
            
            console.log(`[Jobs] Found ${rows.length} skill entries for ${player.name}.`);
            
            rows.forEach(row => {
                loadedSkills[row.job_key] = { xp: row.xp, level: row.level };
                console.log(`[Jobs] -> Loaded ${row.job_key}: Lvl ${row.level} (${row.xp} XP)`);
            });

            // 2. Assign the FULL object to player.data at once
            player.data.jobSkills = loadedSkills; 
            
        } catch (err) { 
            console.error("[Jobs] Failed to load skills:", err); 
            player.data.jobSkills = {}; // Fallback
        }
    },

    // B. Get Level (Default 1)
    getJobLevel: (player, jobKey) => {
        // Safe check for undefined
        if (!player.data.jobSkills || !player.data.jobSkills[jobKey]) return 1;
        return player.data.jobSkills[jobKey].level;
    },

    // C. Get Rank Name based on Level
    getRankName: (level) => {
        if (level >= 100) return "Grandmaster";
        if (level >= 80) return "Master";
        if (level >= 60) return "Expert";
        if (level >= 40) return "Professional";
        if (level >= 20) return "Skilled";
        if (level >= 10) return "Apprentice";
        return "Trainee";
    },

    // D. Add XP & Handle Level Up (Secure Update Pattern)
    addJobXp: async (player, jobKey, amount) => {
        let currentSkills = player.data.jobSkills ? { ...player.data.jobSkills } : {};

        // 2. Initialize specific job if missing
        if (!currentSkills[jobKey]) {
            currentSkills[jobKey] = { xp: 0, level: 1 };
        }

        // 3. Modify local copy
        let skill = currentSkills[jobKey];
        skill.xp += amount;

        // Formula: Level = Floor(Sqrt(XP / 100)) + 1
        // 5 XP (Base) -> Level 1. 100 XP -> Level 2.
        const newLevel = Math.floor(Math.sqrt(skill.xp / 100)) + 1;

        if (newLevel > skill.level) {
            skill.level = newLevel;
            const rankName = jobManager.getRankName(newLevel);
            
            player.call('showNotification', ['Job Promotion', `You are now a ${rankName} (Lvl ${newLevel})!`]);
            player.call('playSound', ['HUD_AWARDS', 'CHALLENGE_UNLOCKED']); 
        }

        // 4. Re-assign the WHOLE object to trigger update
        player.data.jobSkills = currentSkills; 

        // 5. Save to Database
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
        availableJobs.set(id, { config, logic });

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
    },

    startJobSession: (player, jobId) => {
        if (!availableJobs.has(jobId)) return;
        const job = availableJobs.get(jobId);

        player.activeJobId = jobId;
        player.setVariable('activeJobId', jobId);
        player.call('showNotification', ['Job Center', `You started working as a ${job.config.name}.`]);
    },

    stopJob: (player, reason = "") => {
        if (!player.activeJobId) return;
        const job = availableJobs.get(player.activeJobId);

        if (job && job.logic.onStop) job.logic.onStop(player);

        player.setVariable('activeJobId', null);
        player.activeJobId = null;
        if(reason) player.call('showNotification', ['Job Center', reason]);
    },

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
        // This tells the client to wipe all blips/markers/routes
        player.call('client:clearAllJobObjectives');
        
        // Destroy the server-side collision shape
        if (player.jobShape) { 
            player.jobShape.destroy(); 
            player.jobShape = null; 
        }
        
        player.jobCallback = null;
        
        // Safety check for exit timers
        if (player.jobExitCheck) { 
            clearInterval(player.jobExitCheck); 
            player.jobExitCheck = null; 
        }
    },
};

// --- EVENTS ---
mp.events.add('server:loadAccount', async (player) => {
    // This event is triggered from auth.js after login
    await jobManager.loadJobSkills(player);
});

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