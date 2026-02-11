// packages/systems/repoJob.js
// Daily Vehicle Repo Job — "Luxury Motorsport Collections"
// Every day at 7 AM, eligible players get a mail to steal & deliver a specific car model.
// Max 2 repo jobs per day (2nd unlocks after 2h playtime that day).

const db = require('../core/database');
const playerManager = require('../core/playerManager');
const Inventory = require('./inventory');
const { catalog, DEALERSHIPS } = require('../data/dealershipCatalog');
const vehicleManager = require('../core/vehicles/vehicleManager');

// ── CONFIG ──
const NPC_NAME = "Salvatore";
const NPC_MODEL = 'g_m_importexport_01';
const NPC_POS     = { x: -179.86, y: -1178.80, z: 23.13, h: -140.99 };  // NPC stand position
const DELIVER_POS = { x: -176.85, y: -1180.85, z: 23.15 };               // car delivery spot
const DELIVER_RADIUS = 8.0;
const DAILY_RESET_HOUR = 7;     // 7 AM server time
const MAX_JOBS_PER_DAY = 2;
const SECOND_JOB_PLAYTIME = 120; // minutes played today to unlock 2nd job
const ACTIVE_DAYS = 7;          // players active in last N days get the mail

// Reward tiers based on vehicle tier
const REWARDS = {
    low:  { cashMin: 800,  cashMax: 1500,  xp: 150, partChance: 0.15, partPool: ['car_part_common'] },
    mid:  { cashMin: 2000, cashMax: 4000,  xp: 300, partChance: 0.35, partPool: ['car_part_common', 'car_part_uncommon'] },
    high: { cashMin: 5000, cashMax: 10000, xp: 500, partChance: 0.55, partPool: ['car_part_uncommon', 'car_part_rare', 'car_part_epic'] }
};

let deliveryColshape = null;
let repoNpc = null;

// ── INIT ──
const RepoJob = {
    async init() {
        // Spawn NPC (static: invincible + frozen)
        repoNpc = mp.peds.new(mp.joaat(NPC_MODEL), new mp.Vector3(NPC_POS.x, NPC_POS.y, NPC_POS.z), NPC_POS.h, 0);
        repoNpc.setVariable('npcType', 'repo_collector');
        repoNpc.setVariable('static', true);

        // Delivery colshape with interaction 
        deliveryColshape = mp.colshapes.newSphere(DELIVER_POS.x, DELIVER_POS.y, DELIVER_POS.z, DELIVER_RADIUS, 0);
        deliveryColshape.setVariable('interaction', {
            title: 'Repo Delivery',
            text: 'Press ~b~E~w~ to deliver the vehicle',
            event: 'server:repo:deliver',
            requireVehicle: true,
            requireDriver: true
        });

        // Checkpoint marker at delivery spot
        mp.markers.new(1, new mp.Vector3(DELIVER_POS.x, DELIVER_POS.y, DELIVER_POS.z - 0.5), 3.0, {
            color: [255, 50, 50, 180],
            dimension: 0
        });

        // Blip
        const blip = mp.blips.new(479, new mp.Vector3(DELIVER_POS.x, DELIVER_POS.y, DELIVER_POS.z), {
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
            // Then repeat every 24h
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
            // No jobs generated yet today — generate them
            await this.assignJobsToEligiblePlayers();
        }
    },

    // ── ASSIGN JOBS TO ELIGIBLE PLAYERS ──
    async assignJobsToEligiblePlayers() {
        const today = new Date().toISOString().split('T')[0];
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - ACTIVE_DAYS);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        // Get all players active in the last 7 days
        const [eligiblePlayers] = await db.query(
            "SELECT id FROM users WHERE last_active >= ?",
            [cutoffStr]
        );

        if (eligiblePlayers.length === 0) {
            console.log("[RepoJob] No eligible players found.");
            return;
        }

        // For each player, pick a target model that at least 2 other players own
        for (const pRow of eligiblePlayers) {
            const userId = pRow.id;

            // Check if already has jobs today
            const [existing] = await db.query(
                "SELECT COUNT(*) as cnt FROM repo_jobs WHERE user_id = ? AND job_date = ?",
                [userId, today]
            );
            if (existing[0].cnt >= 1) continue; // Already assigned job #1

            const targetModel = await this.pickTargetModel(userId);
            if (!targetModel) continue; // No valid target

            const catEntry = catalog.find(c => c.model === targetModel);
            if (!catEntry) continue;

            // Insert job #1
            await db.query(
                "INSERT INTO repo_jobs (user_id, job_date, job_number, target_model, status) VALUES (?, ?, 1, ?, 'pending')",
                [userId, today, targetModel]
            );

            // Send mail
            const mailMsg = `A prick thought he can get off with my payments. Let's show him who is the boss. Bring my car back!\n\nFind a ${catEntry.name} and bring it back to ${NPC_NAME}.`;
            mp.events.call('server:phone:sendMail', userId, NPC_NAME, 'Repo Work', mailMsg);

            // If the player is online, sync their repo data
            const onlinePlayer = mp.players.toArray().find(p => p.logged && p.data.dbId === userId);
            if (onlinePlayer) {
                await this.syncPlayerRepoData(onlinePlayer);
            }
        }

        console.log(`[RepoJob] Daily jobs assigned for ${today}.`);
    },

    // Pick a car model that at least 2 OTHER players own (not this player)
    async pickTargetModel(userId) {
        // Pick a random model owned by at least 2 players (can include the player themselves)
        const [rows] = await db.query(
            `SELECT model, COUNT(DISTINCT owner_id) as ownerCount 
             FROM server_vehicles 
             GROUP BY model 
             HAVING ownerCount >= 2 
             ORDER BY RAND() 
             LIMIT 1`
        );
        if (rows.length === 0) {
            // Fallback: any model that exists on the server
            const [fallback] = await db.query(
                `SELECT model FROM server_vehicles ORDER BY RAND() LIMIT 1`
            );
            return fallback.length > 0 ? fallback[0].model : null;
        }
        return rows[0].model;
    },

    // ── UNLOCK 2ND JOB ──
    async checkSecondJob(player) {
        if (!player.logged || !player.data.dbId) return;

        const today = new Date().toISOString().split('T')[0];
        const userId = player.data.dbId;

        // Check how many jobs they have today
        const [jobs] = await db.query(
            "SELECT * FROM repo_jobs WHERE user_id = ? AND job_date = ?",
            [userId, today]
        );

        if (jobs.length >= MAX_JOBS_PER_DAY) return; // Already has 2
        if (jobs.length === 0) return; // No first job yet

        // First job must be completed
        const firstJob = jobs.find(j => j.job_number === 1);
        if (!firstJob || firstJob.status !== 'completed') return;

        // Check playtime today (activeMinutes tracks this session)
        const sessionMinutes = player.data.activeMinutes || 0;
        if (sessionMinutes < SECOND_JOB_PLAYTIME) return;

        // Pick a new target model
        const targetModel = await this.pickTargetModel(userId);
        if (!targetModel) return;

        const catEntry = catalog.find(c => c.model === targetModel);
        if (!catEntry) return;

        await db.query(
            "INSERT INTO repo_jobs (user_id, job_date, job_number, target_model, status) VALUES (?, ?, 2, ?, 'pending')",
            [userId, today, targetModel]
        );

        const mailMsg = `Good work earlier! Got another deadbeat for you.\n\nFind a ${catEntry.name} and bring it back to ${NPC_NAME}. Double the hustle, double the pay.`;
        mp.events.call('server:phone:sendMail', userId, NPC_NAME, 'Repo Work #2', mailMsg);

        await this.syncPlayerRepoData(player);
        player.call('showNotification', ['Repo Work', `New repo job available! Check your mail.`]);
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
                status: j.status
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

        // Match against active repo jobs
        const today = new Date().toISOString().split('T')[0];
        const [jobs] = await db.query(
            "SELECT * FROM repo_jobs WHERE user_id = ? AND job_date = ? AND status = 'pending' ORDER BY job_number ASC",
            [player.data.dbId, today]
        );

        // Find a matching job by model hash
        const matchingJob = jobs.find(j => {
            const modelHash = mp.joaat(j.target_model);
            return modelHash === vehModel;
        });

        if (!matchingJob) {
            player.call('showNotification', ['Repo Work', 'This isn\'t the car model we need. Check your mail.']);
            return;
        }

        // === SUCCESS — Deliver the car ===
        const catEntry = catalog.find(c => c.model === matchingJob.target_model);
        const tier = catEntry ? catEntry.tier : 'low';
        const rewardConfig = REWARDS[tier] || REWARDS.low;

        // 1. Remove player from vehicle
        player.removeFromVehicle();

        // 2. Mark job complete
        await db.query(
            "UPDATE repo_jobs SET status = 'completed' WHERE id = ?",
            [matchingJob.id]
        );

        // 3. Despawn the stolen vehicle (owner can re-use it — it goes to parked state)
        setTimeout(async () => {
            if (mp.vehicles.exists(veh)) {
                await vehicleManager.despawnVehicle(veh);
            }
        }, 1500);

        // 4. Cash reward
        const cashReward = Math.floor(Math.random() * (rewardConfig.cashMax - rewardConfig.cashMin + 1)) + rewardConfig.cashMin;
        await playerManager.addMoneyAndSave(player, cashReward, `Repo Job: ${matchingJob.target_model}`);

        // 5. XP reward
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

        // 6. Car parts (chance-based)
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

        // 7. Show popup
        const carName = catEntry ? catEntry.name : matchingJob.target_model;
        player.call('showCenterPopup', [
            'REPO COMPLETE',
            `${carName} delivered to ${NPC_NAME}`,
            JSON.stringify(rewards),
            7000
        ]);

        // 8. Sync updated repo status
        await this.syncPlayerRepoData(player);

        // 9. Check if 2nd job should unlock
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

        // Check if player already has a job for today
        const [existing] = await db.query(
            "SELECT COUNT(*) as cnt FROM repo_jobs WHERE user_id = ? AND job_date = ?",
            [userId, today]
        );

        // If no job yet, assign one now
        if (existing[0].cnt === 0) {
            const targetModel = await this.pickTargetModel(userId);
            if (targetModel) {
                const catEntry = catalog.find(c => c.model === targetModel);
                if (catEntry) {
                    await db.query(
                        "INSERT INTO repo_jobs (user_id, job_date, job_number, target_model, status) VALUES (?, ?, 1, ?, 'pending')",
                        [userId, today, targetModel]
                    );

                    const mailMsg = `A prick thought he can get off with my payments. Let's show him who is the boss. Bring my car back!\n\nFind a ${catEntry.name} and bring it back to ${NPC_NAME}.`;
                    mp.events.call('server:phone:sendMail', userId, NPC_NAME, 'Repo Work', mailMsg);

                    player.call('showNotification', ['Repo Work', 'New repo job! Check your mail.']);
                    console.log(`[RepoJob] Assigned job on login for ${player.name}: ${targetModel}`);
                }
            }
        }

        await this.syncPlayerRepoData(player);
    }
};

// ── EVENTS ──

// Player presses E in delivery zone (triggered by interaction system)
mp.events.add('server:repo:deliver', (player) => {
    RepoJob.tryDeliver(player);
});

// On player spawn/login — sync repo data
mp.events.add('server:repo:init', (player) => {
    RepoJob.onPlayerReady(player);
});

// Periodic check for 2nd job (every 5 minutes for online players)
setInterval(() => {
    mp.players.forEach(player => {
        if (!player.logged) return;
        RepoJob.checkSecondJob(player);
    });
}, 5 * 60 * 1000);

// Initialize on load
RepoJob.init();

module.exports = RepoJob;
