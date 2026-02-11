// packages/systems/repoJob.js
// Daily Vehicle Repo Job — "Luxury Motorsport Collections"
// Flow: available → (talk to NPC, preview, accept) → pending → (deliver car) → completed
// Max 2 repo jobs per day (2nd unlocks after 2h playtime that day).

const db = require('../core/database');
const playerManager = require('../core/playerManager');
const Inventory = require('./inventory');
const { catalog, DEALERSHIPS } = require('../data/dealershipCatalog');
const vehicleManager = require('../core/vehicles/vehicleManager');

// ── CONFIG ──
const NPC_NAME = "Salvatore";
const NPC_MODEL = 'g_m_importexport_01';
const NPC_POS     = { x: -179.86, y: -1178.80, z: 23.13, h: 219.01 };
const DELIVER_POS = { x: -176.85, y: -1180.85, z: 23.15 };
const DELIVER_RADIUS = 8.0;
const NPC_TALK_RADIUS = 2.5;
const DAILY_RESET_HOUR = 7;
const MAX_JOBS_PER_DAY = 2;
const SECOND_JOB_PLAYTIME = 120;
const ACTIVE_DAYS = 7;

// Reward tiers based on vehicle tier
const REWARDS = {
    low:  { cashMin: 800,  cashMax: 1500,  xp: 150, partChance: 0.15, partPool: ['car_part_common'] },
    mid:  { cashMin: 2000, cashMax: 4000,  xp: 300, partChance: 0.35, partPool: ['car_part_common', 'car_part_uncommon'] },
    high: { cashMin: 5000, cashMax: 10000, xp: 500, partChance: 0.55, partPool: ['car_part_uncommon', 'car_part_rare', 'car_part_epic'] }
};

// NPC dialogue lines (random pick)
const NPC_LINES = [
    "Some deadbeat thinks he can skip payments on my car. Show him who's boss.",
    "I got a client who ain't paying up. Go collect the merchandise.",
    "This punk thought he could ghost me. Bring my ride back.",
    "Another day, another delinquent. You know the drill.",
    "I need this car back before the boss finds out. Handle it."
];

let npcTalkColshape = null;
let repoNpc = null;

// ── INIT ──
const RepoJob = {
    async init() {
        // Spawn NPC (same pattern as dealership NPCs)
        repoNpc = mp.peds.new(mp.joaat(NPC_MODEL), new mp.Vector3(NPC_POS.x, NPC_POS.y, NPC_POS.z), {
            heading: NPC_POS.h,
            dynamic: false,
            frozen: true,
            invincible: true
        });
        repoNpc.setVariable('npcType', 'repo_collector');

        // NPC talk colshape (on foot, to accept jobs)
        npcTalkColshape = mp.colshapes.newSphere(NPC_POS.x, NPC_POS.y, NPC_POS.z, NPC_TALK_RADIUS, 0);
        npcTalkColshape.setVariable('interaction', {
            title: NPC_NAME,
            text: 'Press ~b~E~w~ to talk',
            event: 'server:repo:talk',
            requireOnFoot: true
        });

        // Blip
        mp.blips.new(479, new mp.Vector3(NPC_POS.x, NPC_POS.y, NPC_POS.z), {
            name: "Repo Work",
            color: 1,
            shortRange: true,
            scale: 0.7,
            dimension: 0
        });

        // Schedule daily reset
        this.scheduleDailyReset();

        // On server start, check if we already ran today
        this.checkAndSendDailyJobs();

        console.log(`[RepoJob] Initialized. NPC: ${NPC_NAME} at Luxury Motorsport.`);
    },

    // ── SCHEDULING ──
    scheduleDailyReset() {
        const now = new Date();
        let next = new Date(now);
        next.setHours(DAILY_RESET_HOUR, 0, 0, 0);
        if (now >= next) next.setDate(next.getDate() + 1);

        const msUntil = next.getTime() - now.getTime();
        setTimeout(() => {
            this.dailyReset();
            setInterval(() => this.dailyReset(), 24 * 60 * 60 * 1000);
        }, msUntil);

        console.log(`[RepoJob] Next daily reset in ${Math.round(msUntil / 60000)} minutes.`);
    },

    async dailyReset() {
        console.log("[RepoJob] Running daily reset...");
        await this.assignJobsToEligiblePlayers();
    },

    async checkAndSendDailyJobs() {
        const today = new Date().toISOString().split('T')[0];
        const [rows] = await db.query("SELECT COUNT(*) as cnt FROM repo_jobs WHERE job_date = ?", [today]);
        if (rows[0].cnt === 0) {
            await this.assignJobsToEligiblePlayers();
        }
    },

    // ── ASSIGN JOBS (status = 'available', player must talk to NPC to accept) ──
    async assignJobsToEligiblePlayers() {
        const today = new Date().toISOString().split('T')[0];
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - ACTIVE_DAYS);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        const [eligiblePlayers] = await db.query(
            "SELECT id FROM users WHERE last_active >= ?",
            [cutoffStr]
        );

        if (eligiblePlayers.length === 0) {
            console.log("[RepoJob] No eligible players found.");
            return;
        }

        for (const pRow of eligiblePlayers) {
            const userId = pRow.id;

            const [existing] = await db.query(
                "SELECT COUNT(*) as cnt FROM repo_jobs WHERE user_id = ? AND job_date = ?",
                [userId, today]
            );
            if (existing[0].cnt >= 1) continue;

            const targetModel = await this.pickTargetModel(userId);
            if (!targetModel) continue;

            const catEntry = catalog.find(c => c.model === targetModel);
            if (!catEntry) continue;

            // Insert as 'available' — not revealed yet
            await db.query(
                "INSERT INTO repo_jobs (user_id, job_date, job_number, target_model, status) VALUES (?, ?, 1, ?, 'available')",
                [userId, today, targetModel]
            );

            // Teaser mail — no car details
            const mailMsg = `Hey, it's ${NPC_NAME}. I got some work for you. Come see me behind Luxury Motorsport when you get a chance.`;
            mp.events.call('server:phone:sendMail', userId, NPC_NAME, 'Got a job for you', mailMsg);

            const onlinePlayer = mp.players.toArray().find(p => p.logged && p.data.dbId === userId);
            if (onlinePlayer) {
                await this.syncPlayerRepoData(onlinePlayer);
            }
        }

        console.log(`[RepoJob] Daily jobs assigned for ${today}.`);
    },

    async pickTargetModel(userId) {
        const [rows] = await db.query(
            `SELECT model, COUNT(DISTINCT owner_id) as ownerCount 
             FROM server_vehicles 
             GROUP BY model 
             HAVING ownerCount >= 2 
             ORDER BY RAND() 
             LIMIT 1`
        );
        if (rows.length === 0) {
            const [fallback] = await db.query(
                `SELECT model FROM server_vehicles ORDER BY RAND() LIMIT 1`
            );
            return fallback.length > 0 ? fallback[0].model : null;
        }
        return rows[0].model;
    },

    // ── TALK TO NPC (opens preview with accept/cancel) ──
    async talkToNpc(player) {
        if (!player.logged || !player.data.dbId) return;

        const today = new Date().toISOString().split('T')[0];
        const userId = player.data.dbId;

        // Find an 'available' job for this player
        const [jobs] = await db.query(
            "SELECT * FROM repo_jobs WHERE user_id = ? AND job_date = ? AND status = 'available' ORDER BY job_number ASC LIMIT 1",
            [userId, today]
        );

        if (jobs.length === 0) {
            player.call('showNotification', [NPC_NAME, 'I got nothing for you right now. Come back later.']);
            return;
        }

        const job = jobs[0];
        const catEntry = catalog.find(c => c.model === job.target_model);
        const carName = catEntry ? catEntry.name : job.target_model;
        const dialogue = NPC_LINES[Math.floor(Math.random() * NPC_LINES.length)];

        // Open job preview (camera on NPC, description, accept/cancel)
        player.call('client:job:openPreview', [{
            id: `repo_${job.id}`,
            name: NPC_NAME,
            description: `${dialogue}\n\nI need you to find a ${carName} and bring it back here to me. You'll be paid well for the trouble.`,
            pos: NPC_POS,
            buttons: [
                { label: 'Accept', action: 'accept' },
                { label: 'Decline', action: 'cancel' }
            ]
        }]);
    },

    // ── ACCEPT JOB (from preview callback) ──
    async acceptJob(player, repoJobId) {
        if (!player.logged || !player.data.dbId) return;

        // Update status from available → pending
        const [result] = await db.query(
            "UPDATE repo_jobs SET status = 'pending' WHERE id = ? AND user_id = ? AND status = 'available'",
            [repoJobId, player.data.dbId]
        );

        if (result.affectedRows === 0) {
            player.call('showNotification', [NPC_NAME, 'Something went wrong. Try again.']);
            return;
        }

        // Get job details for notification
        const [rows] = await db.query("SELECT target_model FROM repo_jobs WHERE id = ?", [repoJobId]);
        if (rows.length > 0) {
            const catEntry = catalog.find(c => c.model === rows[0].target_model);
            const carName = catEntry ? catEntry.name : rows[0].target_model;
            player.call('showNotification', ['Repo Work', `Find a ${carName} and deliver it to ${NPC_NAME}.`]);
        }

        await this.syncPlayerRepoData(player);
        console.log(`[RepoJob] ${player.name} accepted repo job #${repoJobId}`);
    },

    // ── UNLOCK 2ND JOB ──
    async checkSecondJob(player) {
        if (!player.logged || !player.data.dbId) return;

        const today = new Date().toISOString().split('T')[0];
        const userId = player.data.dbId;

        const [jobs] = await db.query(
            "SELECT * FROM repo_jobs WHERE user_id = ? AND job_date = ?",
            [userId, today]
        );

        if (jobs.length >= MAX_JOBS_PER_DAY) return;
        if (jobs.length === 0) return;

        const firstJob = jobs.find(j => j.job_number === 1);
        if (!firstJob || firstJob.status !== 'completed') return;

        // --- NEW LOGIC: Combine Database Time + Current Session Time ---
        const totalMinutesToday = (player.data.dailyPlaytimeBase || 0) + (player.data.activeMinutes || 0);
        
        if (totalMinutesToday < SECOND_JOB_PLAYTIME) return;
        // ---------------------------------------------------------------

        const targetModel = await this.pickTargetModel(userId);
        if (!targetModel) return;

        const catEntry = catalog.find(c => c.model === targetModel);
        if (!catEntry) return;

        // Insert as 'available' — must talk to NPC again
        await db.query(
            "INSERT INTO repo_jobs (user_id, job_date, job_number, target_model, status) VALUES (?, ?, 2, ?, 'available')",
            [userId, today, targetModel]
        );

        const mailMsg = `Good work earlier. I got another one for you. Come see me when you're ready.`;
        mp.events.call('server:phone:sendMail', userId, NPC_NAME, 'More work available', mailMsg);

        await this.syncPlayerRepoData(player);
        player.call('showNotification', ['Repo Work', 'New repo job available! Go speak with Salvatore.']);
    },

    // ── SYNC REPO DATA TO CLIENT ──
    async syncPlayerRepoData(player) {
        if (!player.logged || !player.data.dbId) return;

        const today = new Date().toISOString().split('T')[0];
        const [jobs] = await db.query(
            "SELECT job_number, target_model, status FROM repo_jobs WHERE user_id = ? AND job_date = ?",
            [player.data.dbId, today]
        );

        const repoData = jobs.map(j => {
            const catEntry = catalog.find(c => c.model === j.target_model);
            return {
                jobNumber: j.job_number,
                targetModel: j.target_model,
                targetName: catEntry ? catEntry.name : j.target_model,
                status: j.status   // 'available', 'pending', or 'completed'
            };
        });

        player._repoJobs = repoData;
        player.call('client:repo:sync', [JSON.stringify(repoData)]);
    },

    // ── DELIVERY LOGIC ──
    async tryDeliver(player) {
        if (!player.logged || !player.data.dbId) return;
        if (!player.vehicle) {
            player.call('showNotification', ['Repo Work', 'You need to be in a vehicle to deliver.']);
            return;
        }

        const veh = player.vehicle;
        const vehModel = veh.model;

        const today = new Date().toISOString().split('T')[0];
        const [jobs] = await db.query(
            "SELECT * FROM repo_jobs WHERE user_id = ? AND job_date = ? AND status = 'pending' ORDER BY job_number ASC",
            [player.data.dbId, today]
        );

        const matchingJob = jobs.find(j => {
            const modelHash = mp.joaat(j.target_model);
            return modelHash === vehModel;
        });

        if (!matchingJob) {
            player.call('showNotification', ['Repo Work', 'This isn\'t the car we need. Check your objectives.']);
            return;
        }

        // === SUCCESS ===
        const catEntry = catalog.find(c => c.model === matchingJob.target_model);
        const tier = catEntry ? catEntry.tier : 'low';
        const rewardConfig = REWARDS[tier] || REWARDS.low;

        player.removeFromVehicle();

        await db.query("UPDATE repo_jobs SET status = 'completed' WHERE id = ?", [matchingJob.id]);

        setTimeout(async () => {
            if (mp.vehicles.exists(veh)) {
                await vehicleManager.despawnVehicle(veh);
            }
        }, 1500);

        const cashReward = Math.floor(Math.random() * (rewardConfig.cashMax - rewardConfig.cashMin + 1)) + rewardConfig.cashMin;
        await playerManager.addMoneyAndSave(player, cashReward, `Repo Job: ${matchingJob.target_model}`);

        player.data.xp = (player.data.xp || 0) + rewardConfig.xp;
        let xpNeeded = playerManager.calculateNextLevelXp(player.data.level);
        while (player.data.xp >= xpNeeded) {
            player.data.xp -= xpNeeded;
            player.data.level++;
            player.outputChatBox(`!{#f0c400}LEVEL UP! You are now Level ${player.data.level}!`);
            xpNeeded = playerManager.calculateNextLevelXp(player.data.level);
        }
        player.setVariable('level', player.data.level);
        player.setVariable('xp', player.data.xp);
        player.setVariable('xpMax', xpNeeded);

        const rewards = [
            { type: 'money', value: `$${cashReward.toLocaleString()}` },
            { type: 'xp', value: `${rewardConfig.xp} XP` }
        ];

        if (Math.random() < rewardConfig.partChance) {
            const partId = rewardConfig.partPool[Math.floor(Math.random() * rewardConfig.partPool.length)];
            const added = await Inventory.addItem(player, partId, 1);
            if (added) {
                const ItemRegistry = require('../data/items');
                const partDef = ItemRegistry[partId];
                rewards.push({ type: 'generic', value: partDef ? partDef.name : partId });
            }
        }

        const carName = catEntry ? catEntry.name : matchingJob.target_model;
        player.call('showCenterPopup', [
            'REPO COMPLETE',
            `${carName} delivered to ${NPC_NAME}`,
            JSON.stringify(rewards),
            7000
        ]);

        await this.syncPlayerRepoData(player);

        setTimeout(() => {
            if (mp.players.exists(player)) {
                this.checkSecondJob(player);
            }
        }, 3000);

        console.log(`[RepoJob] ${player.name} completed repo #${matchingJob.job_number}: ${matchingJob.target_model}`);
    },

    // ── PLAYER INIT (on login) ──
    async onPlayerReady(player) {
        if (!player.logged || !player.data.dbId) return;

        const today = new Date().toISOString().split('T')[0];
        const userId = player.data.dbId;

        const [existing] = await db.query(
            "SELECT COUNT(*) as cnt FROM repo_jobs WHERE user_id = ? AND job_date = ?",
            [userId, today]
        );

        // If no job yet, assign one as 'available'
        if (existing[0].cnt === 0) {
            const targetModel = await this.pickTargetModel(userId);
            if (targetModel) {
                const catEntry = catalog.find(c => c.model === targetModel);
                if (catEntry) {
                    await db.query(
                        "INSERT INTO repo_jobs (user_id, job_date, job_number, target_model, status) VALUES (?, ?, 1, ?, 'available')",
                        [userId, today, targetModel]
                    );

                    const mailMsg = `Hey, it's ${NPC_NAME}. I got some work for you. Come see me behind Luxury Motorsport when you get a chance.`;
                    mp.events.call('server:phone:sendMail', userId, NPC_NAME, 'Got a job for you', mailMsg);

                    player.call('showNotification', ['Repo Work', `${NPC_NAME} wants to speak with you.`]);
                    console.log(`[RepoJob] Assigned available job on login for ${player.name}: ${targetModel}`);
                }
            }
        }

        await this.syncPlayerRepoData(player);
    }
};

// ── EVENTS ──

// Player presses E near NPC (talk interaction)
mp.events.add('server:repo:talk', (player) => {
    RepoJob.talkToNpc(player);
});

// Player accepts/declines from preview UI
mp.events.add('server:job:continue', (player, jobId, action) => {
    // Only handle repo preview callbacks (id starts with "repo_")
    if (typeof jobId !== 'string' || !jobId.startsWith('repo_')) return;

    const repoJobId = parseInt(jobId.replace('repo_', ''));
    if (isNaN(repoJobId)) return;

    if (action === 'accept') {
        RepoJob.acceptJob(player, repoJobId);
    }
    // 'cancel' — do nothing, player can come back
});

// Player delivers vehicle
mp.events.add('server:repo:deliver', (player) => {
    RepoJob.tryDeliver(player);
});

// Periodic check for 2nd job (every 5 minutes)
setInterval(() => {
    mp.players.forEach(player => {
        if (!player.logged) return;
        RepoJob.checkSecondJob(player);
    });
}, 5 * 60 * 1000);

// Initialize on load
RepoJob.init();

module.exports = RepoJob;
