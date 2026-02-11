const db = require('./database');
const Inventory = require('../systems/inventory');
const PhotoHunt = require('../systems/photoHunt/photoHuntManager');
const JobManager = require('../jobs/jobManager');
const playerManager = require('./playerManager');

const MAX_VEHICLE_SLOTS = 5; 

mp.events.add('server:playerMenu:getData', async (player) => {
    if (!player.data.dbId) return;

    try {
        // 1. Basic Stats
        const level = player.data.level || 1;
        const rawWeight = Inventory.getWeight(player);
        const stats = {
            level: level,
            xp: player.data.xp || 0, 
            xpMax: playerManager.calculateNextLevelXp(level),
            money: player.data.money || 0,
            bank: player.data.bank_money || 0,
            weight: typeof rawWeight === 'string' ? parseFloat(rawWeight) : (rawWeight || 0),
            maxWeight: 40.0
        };

        // 2. Vehicle Count
        const [vehRows] = await db.query("SELECT COUNT(*) as count FROM server_vehicles WHERE owner_id = ?", [player.data.dbId]);
        const vehicleCount = vehRows[0].count;

        // 3. Job Skills (Merged)
        const allJobs = JobManager.getDefinitions(); // Get all registered jobs
        const playerSkills = player.data.jobSkills || {};
        const formattedJobs = [];

        // Iterate through ALL defined jobs, not just the ones the player has done
        allJobs.forEach((jobData, jobKey) => {
            const skill = playerSkills[jobKey] || { level: 1, xp: 0 }; // Default to Lvl 1 if no data
            
            const nextLevelXp = Math.pow(skill.level, 2) * 100;
            const prevLevelXp = Math.pow(skill.level - 1, 2) * 100;
            
            formattedJobs.push({
                name: jobData.config.name, // Use the nice name (e.g., "Sanitation Worker")
                key: jobKey,
                level: skill.level,
                xp: skill.xp,
                nextXp: nextLevelXp,
                prevXp: prevLevelXp
            });
        });

        // 4. Quests
        const dailyQuests = player.quests || [];

        // 5. PhotoHunt Progress
        const dateStr = PhotoHunt.getGameDate();
        const [phRows] = await db.query("SELECT completed_landmarks, assigned_landmarks FROM player_photo_hunt WHERE user_id = ? AND activity_date = ?", [player.data.dbId, dateStr]);
        
        let photoHuntData = { progress: 0, total: 6, completed: false };
        if (phRows.length > 0) {
            const completed = JSON.parse(phRows[0].completed_landmarks || '[]');
            const assigned = JSON.parse(phRows[0].assigned_landmarks || '[]');
            photoHuntData = {
                progress: completed.length,
                total: assigned.length,
                completed: completed.length >= assigned.length
            };
        }

        // 6. Extra Info (hours played, registration date, payday timer)
        let hoursPlayed = 0;
        let registeredDate = '-';
        try {
            const [userRows] = await db.query("SELECT created_at, total_playtime FROM users WHERE id = ?", [player.data.dbId]);
            if (userRows.length > 0) {
                if (userRows[0].created_at) {
                    const d = new Date(userRows[0].created_at);
                    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                    registeredDate = months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
                }
                const storedMinutes = userRows[0].total_playtime || 0;
                const sessionMinutes = player.data.activeMinutes || 0;
                hoursPlayed = (storedMinutes + sessionMinutes) / 60;
            }
        } catch (e) {
            // Columns may not exist yet — gracefully fallback
            const sessionMinutes = player.data.activeMinutes || 0;
            hoursPlayed = sessionMinutes / 60;
        }

        // 7. Repo Jobs
        let repoJobs = [];
        try {
            const today = new Date().toISOString().split('T')[0];
            const [repoRows] = await db.query(
                "SELECT job_number, target_model, status FROM repo_jobs WHERE user_id = ? AND job_date = ?",
                [player.data.dbId, today]
            );
            const { catalog } = require('../data/dealershipCatalog');
            repoJobs = repoRows.map(j => {
                const catEntry = catalog.find(c => c.model === j.target_model);
                return {
                    jobNumber: j.job_number,
                    targetModel: j.target_model,
                    targetName: catEntry ? catEntry.name : j.target_model,
                    status: j.status
                };
            });
        } catch(e) { /* table may not exist yet */ }

        // Send payload
        const payload = {
            playerName: player.name || 'Unknown',
            onlineId: player.data.onlineId !== undefined ? player.data.onlineId : player.id,
            hoursPlayed: hoursPlayed,
            registeredDate: registeredDate,
            paydayIn: player.data.paydayIn || 60,
            stats: { ...stats, vehicleCount, maxVehicles: MAX_VEHICLE_SLOTS },
            jobs: formattedJobs,
            quests: dailyQuests,
            photoHunt: photoHuntData,
            repoJobs: repoJobs
        };

        player.call('client:playerMenu:receiveData', [JSON.stringify(payload)]);

    } catch (err) {
        console.error("PlayerMenu Data Error:", err);
    }
});