// packages/core/questManager.js
const db = require('./database');
const PlayerManager = require('./playerManager');
const QuestDefinitions = require('../data/dailyQuests');

const QUEST_LIMIT = 3; // Number of daily quests per player

const QuestManager = {
    // Called when player joins/spawns
    initPlayer: async (player) => {
        if (!player.data.dbId) return;

        const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        // 1. Fetch existing quests for today
        const [rows] = await db.query(
            "SELECT * FROM player_daily_quests WHERE user_id = ? AND created_date = ?", 
            [player.data.dbId, dateStr]
        );

        if (rows.length > 0) {
            // Load existing
            player.quests = rows.map(row => {
                const def = QuestDefinitions.find(q => q.id === row.quest_id);
                return { ...row, ...def }; // Merge DB data with Definition
            }).filter(q => q.id); // Filter out invalid/removed quests
        } else {
            // Generate New Quests
            const newQuests = QuestManager.generateRandomQuests(QUEST_LIMIT);
            player.quests = [];

            const values = [];
            for (const q of newQuests) {
                values.push([player.data.dbId, q.id, 0, 0, dateStr]);
                player.quests.push({ ...q, progress: 0, completed: 0 });
            }

            if (values.length > 0) {
                await db.query(
                    "INSERT INTO player_daily_quests (user_id, quest_id, progress, completed, created_date) VALUES ?", 
                    [values]
                );
            }
            console.log(`[Quests] Generated daily quests for ${player.name}`);
        }
        
        // Send to client
        player.call('client:updateQuestUI', [JSON.stringify(player.quests)]);
    },

    generateRandomQuests: (amount) => {
        const shuffled = [...QuestDefinitions].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, amount);
    },

    handleEvent: (player, type, data) => {
        if (!player.quests) return;

        let updated = false;

        player.quests.forEach(async (quest) => {
            if (quest.completed) return;
            if (quest.type !== type) return;

            // Calculate Progress Increase
            let increase = 1;
            if (quest.progressProp && data[quest.progressProp]) {
                increase = Number(data[quest.progressProp]);
            }

            // Update Memory
            quest.progress += increase;
            
            // Check Completion
            let justCompleted = false;
            if (quest.progress >= quest.targetAmount) {
                quest.progress = quest.targetAmount;
                quest.completed = 1;
                justCompleted = true;
            }

            // Update Database
            // Note: We update frequently here. For high-pop servers, consider buffering this.
            db.query(
                "UPDATE player_daily_quests SET progress = ?, completed = ? WHERE user_id = ? AND quest_id = ? AND created_date = CURDATE()",
                [quest.progress, quest.completed, player.data.dbId, quest.id]
            );

            updated = true;

            // Handle Reward
            if (justCompleted) {
                await PlayerManager.addMoneyAndSave(player, quest.reward, `Quest: ${quest.title}`);
                player.call('showNotification', ['Quest Complete', `Completed: ${quest.title}`]);
                player.call('client:questCompleteSound'); // Optional sound
            }
        });

        // Sync UI if changed
        if (updated) {
            player.call('client:updateQuestUI', [JSON.stringify(player.quests)]);
        }
    }
};

module.exports = QuestManager;

mp.events.add('server:processWalking', (player, dist) => {
    const QuestEvents = require('./questEvents');
    QuestEvents.emit(player, 'walk_distance', { dist: dist });
});