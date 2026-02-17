const db = require('./database');
const Inventory = require('../systems/inventory');
const PhotoHunt = require('../systems/photoHunt/photoHuntManager');
const HouseManager = require('../systems/houseManager');
const JobManager = require('../jobs/jobManager');
const playerManager = require('./playerManager');
const FamilyManager = require('../systems/familyManager');

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
        const allJobs = JobManager.getDefinitions();
        const playerSkills = player.data.jobSkills || {};
        const formattedJobs = [];

        allJobs.forEach((jobData, jobKey) => {
            const skill = playerSkills[jobKey] || { level: 1, xp: 0 };
            
            const nextLevelXp = Math.pow(skill.level, 2) * 100;
            const prevLevelXp = Math.pow(skill.level - 1, 2) * 100;
            
            formattedJobs.push({
                name: jobData.config.name,
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
        let playedToday = 0; // Initialize variable for daily playtime

        try {
            // UPDATED QUERY: Fetch daily_playtime and daily_playtime_date
            const [userRows] = await db.query("SELECT created_at, total_playtime, daily_playtime, daily_playtime_date FROM users WHERE id = ?", [player.data.dbId]);
            if (userRows.length > 0) {
                if (userRows[0].created_at) {
                    const d = new Date(userRows[0].created_at);
                    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                    registeredDate = months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
                }
                const storedMinutes = userRows[0].total_playtime || 0;
                const sessionMinutes = player.data.activeMinutes || 0;
                hoursPlayed = (storedMinutes + sessionMinutes) / 60;

                // --- LOGIC FIX FOR PLAYED TODAY ---
                // 1. Get today's date string matching how playerManager saves it (YYYY-MM-DD)
                const now = new Date();
                const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

                // 2. Check if the stored daily stats are from today
                let storedDaily = 0;
                if (userRows[0].daily_playtime_date) {
                    const dbDate = new Date(userRows[0].daily_playtime_date);
                    const dbDateStr = `${dbDate.getFullYear()}-${String(dbDate.getMonth()+1).padStart(2,'0')}-${String(dbDate.getDate()).padStart(2,'0')}`;
                    if (dbDateStr === todayStr) {
                        storedDaily = userRows[0].daily_playtime || 0;
                    }
                }

                // 3. Add stored daily minutes + current unsaved session minutes
                playedToday = storedDaily + sessionMinutes;
                // ----------------------------------
            }
        } catch (e) {
            const sessionMinutes = player.data.activeMinutes || 0;
            hoursPlayed = sessionMinutes / 60;
            playedToday = sessionMinutes;
        }

        // 7. Repo Jobs
        let repoJobs = [];
        
        if (level < 10) {
            repoJobs.push({
                jobNumber: 1,
                targetModel: 'locked',
                targetName: 'Reach Level 10 to Unlock',
                status: 'locked' 
            });
        } else {
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
        }

        // 8. Properties / Houses (NEW)
        // Fetches house based on owner_id matching player DB ID
        const ownedHouse = HouseManager.getHouseByOwner(player.data.dbId);
        let houseInfo = null;
        
        if (ownedHouse) {
            houseInfo = {
                id: ownedHouse.id,
                price: ownedHouse.price,
                locked: ownedHouse.locked,
                position: ownedHouse.position
            };
        }

        // 9. Family Data
        let familyData = { inFamily: false, families: [] };
        try {
            familyData = await FamilyManager.getPlayerMenuData(player);
        } catch (e) { console.error('[PlayerMenu] Family data error:', e); }

        // 10. Faction Data
        let factionData = { inFaction: false, allFactions: [] };
        try {
            const FactionManager = require('../systems/factions/factionManager');
            if (FactionManager.getPlayerMenuData) {
                factionData = await FactionManager.getPlayerMenuData(player);
            }
        } catch (e) { console.error('[PlayerMenu] Faction data error:', e); }

        // Send payload
        const payload = {
            playerName: player.name || 'Unknown',
            onlineId: player.data.onlineId !== undefined ? player.data.onlineId : player.id,
            hoursPlayed: hoursPlayed,
            registeredDate: registeredDate,
            paydayIn: player.data.paydayIn || 60,
            stats: { ...stats, vehicleCount, maxVehicles: player.data.vehicle_slots || 3 },
            jobs: formattedJobs,
            quests: dailyQuests,
            activeMinutes: playedToday, 
            photoHunt: photoHuntData,
            repoJobs: repoJobs,
            house: houseInfo,
            family: familyData,
            faction: factionData
        };

        player.call('client:playerMenu:receiveData', [JSON.stringify(payload)]);

    } catch (err) {
        console.error("PlayerMenu Data Error:", err);
    }
});
