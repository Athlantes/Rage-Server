// packages/systems/dailyQuests.js
const db = require('../core/database');
const PlayerManager = require('../core/playerManager');

// --- CONFIGURATION ---
const QUEST_POOL = [
    { key: 'job_xp', description: 'Earn 100 Job XP', target: 100, reward: 500 },
    { key: 'dumpster_dive', description: 'Search 5 Dumpsters', target: 5, reward: 300 },
    { key: 'recycle_bottles', description: 'Recycle 10 Bottles', target: 10, reward: 250 },
    { key: 'lucky_find', description: 'Find 1 Rare Item (Dumpster)', target: 1, reward: 1000 },
    { key: 'courier_runs', description: 'Complete 3 Courier Jobs', target: 3, reward: 400 }
];

const RESET_HOUR = 7; // 7:00 AM

// Helper: Get "Business" Date (YYYY-MM-DD)
function getBusinessDate() {
    const now = new Date();
    if (now.getHours() < RESET_HOUR) {
        now.setDate(now.getDate() - 1);
    }
    // FIX: Use 'sv-SE' locale (Sweden uses YYYY-MM-DD) or manual construction to ensure local time format
    // Avoiding toISOString() because it converts to UTC, causing issues near reset time.
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const DailyQuests = {
    
    // 1. Initialize on Login
    init: async (player) => {
        if (!player.data.dbId) return;
        const today = getBusinessDate();

        const [rows] = await db.query(
            'SELECT * FROM character_daily_quests WHERE character_id = ? AND date_generated = ?', 
            [player.data.dbId, today]
        );

        if (rows.length === 0) {
            await DailyQuests.generateQuests(player, today);
        } else {
            // FIX: Normalize the date from DB (Date Object) to String
            // This ensures strict equality checks later work
            player.data.dailyQuests = rows.map(row => ({
                ...row,
                date_generated: today // Force consistent string format
            }));
        }
    },

    // 2. Generate Random Quests
    generateQuests: async (player, dateString) => {
        const shuffled = [...QUEST_POOL].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 3);
        
        const values = [];
        const memoryQuests = [];

        for (const q of selected) {
            // [char_id, key, desc, progress, target, reward, completed, date]
            values.push([player.data.dbId, q.key, q.description, 0, q.target, q.reward, false, dateString]);
            
            memoryQuests.push({
                character_id: player.data.dbId,
                quest_key: q.key, 
                description: q.description, 
                progress: 0, 
                target: q.target, 
                reward_money: q.reward, 
                is_completed: 0, 
                date_generated: dateString
            });
        }

        try {
            await db.query(
                'INSERT INTO character_daily_quests (character_id, quest_key, description, progress, target, reward_money, is_completed, date_generated) VALUES ?', 
                [values]
            );
            player.data.dailyQuests = memoryQuests;
            player.outputChatBox("!{00FF00}[Daily Quests] !{FFFFFF}New tasks available (Reset at 7AM).");
        } catch (err) {
            console.error("[DailyQuests] Generation Error:", err);
        }
    },

    // 3. The Core Update Function
    progress: async (player, questKey, amount = 1) => {
        // Safety checks
        if (!player.data.dailyQuests) return;

        // Find the specific quest in memory
        const quest = player.data.dailyQuests.find(q => q.quest_key === questKey && !q.is_completed);
        
        if (quest) {
            quest.progress += amount;

            // Check Completion
            if (quest.progress >= quest.target) {
                quest.progress = quest.target;
                quest.is_completed = 1; 

                // Reward
                await PlayerManager.addMoneyAndSave(player, quest.reward_money, `Quest: ${questKey}`);
                player.call('showNotification', ['Quest Complete', `Completed: ${quest.description}`]);
                player.call('playSound', ['HUD_AWARDS', 'CHALLENGE_UNLOCKED']);
            } else {
                // Optional: Notify progress
                // player.call('showNotification', ['Quest Update', `${quest.description}: ${quest.progress}/${quest.target}`]);
            }

            //
            // FIX: Added error handling (.catch) to see if DB updates fail
            // We use date_generated string to match the row
            db.query(
                'UPDATE character_daily_quests SET progress = ?, is_completed = ? WHERE character_id = ? AND quest_key = ? AND date_generated = ?',
                [quest.progress, quest.is_completed, player.data.dbId, questKey, quest.date_generated]
            ).catch(err => {
                console.error(`[DailyQuests] Save Error for ${player.name} (${questKey}):`, err);
            });

            // Force UI Update so user sees it immediately
            player.call('client:updateQuestMenu', [player.data.dailyQuests]);
        }
    },

    // 4. Get Data for UI
    getUiData: (player) => {
        return player.data.dailyQuests || [];
    }
};

mp.events.add('server:loadAccount', (player) => {
    DailyQuests.init(player);
});

mp.events.add('server:getQuestData', (player) => {
    const data = DailyQuests.getUiData(player);
    player.call('client:updateQuestMenu', [data]);
});

module.exports = DailyQuests;