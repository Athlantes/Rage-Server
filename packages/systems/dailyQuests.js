// packages/systems/dailyQuests.js
const db = require('../core/database');
const PlayerManager = require('../core/playerManager');

// --- 1. CONFIGURATION ---
const RESET_HOUR = 7; // 7:00 AM Server Time

// A modular pool of quests. 
// "type": matches the logic hook (e.g., 'job', 'crafting', 'action')
const QUEST_POOL = [
    { key: 'job_xp', type: 'job_xp', description: 'Earn 500 Job XP', target: 500, reward: 800 },
    { key: 'dumpster_dive', type: 'action', description: 'Search 5 Dumpsters', target: 5, reward: 300 },
    { key: 'recycle_bottles', type: 'action', description: 'Recycle 10 Bottles', target: 10, reward: 250 },
    { key: 'lucky_find', type: 'action', description: 'Find 1 Rare Item', target: 1, reward: 1000 },
    { key: 'courier_runs', type: 'job_complete', description: 'Complete 3 Deliveries', target: 3, reward: 400 },
    { key: 'fuel_up', type: 'action', description: 'Refuel a Vehicle', target: 1, reward: 150 },
];

// --- 2. HELPER: STRICT DATE STRING ---
// Returns "YYYY-MM-DD" strictly based on server local time
function getBusinessDate() {
    const now = new Date();
    if (now.getHours() < RESET_HOUR) {
        now.setDate(now.getDate() - 1);
    }
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

const DailyQuests = {
    
    // --- INIT ---
    init: async (player) => {
        if (!player.data.dbId) return;
        const today = getBusinessDate();

        // 1. Fetch from DB
        const [rows] = await db.query(
            'SELECT * FROM character_daily_quests WHERE character_id = ? AND date_generated = ?', 
            [player.data.dbId, today]
        );

        if (rows.length === 0) {
            await DailyQuests.generateQuests(player, today);
        } else {
            // LOAD existing. IMPORTANT: Convert DB date to String for consistency
            player.data.dailyQuests = rows.map(r => ({ ...r, date_generated: today }));
        }
    },

    // --- GENERATOR ---
    generateQuests: async (player, dateString) => {
        // Shuffle and pick 3
        const shuffled = [...QUEST_POOL].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 3);
        
        const values = [];
        const memoryQuests = [];

        for (const q of selected) {
            values.push([player.data.dbId, q.key, q.description, 0, q.target, q.reward, 0, dateString]);
            
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
            console.error("[DailyQuests] Critical Generation Error:", err);
        }
    },

    // --- CORE PROGRESS LOGIC ---
    // We use "generic" progress to handle ALL types
    progress: async (player, questKey, amount = 1) => {
        if (!player.data.dailyQuests) return;

        // Find quest by KEY (e.g., 'dumpster_dive')
        const quest = player.data.dailyQuests.find(q => q.quest_key === questKey && !q.is_completed);
        
        if (quest) {
            quest.progress += amount;
            let justFinished = false;

            if (quest.progress >= quest.target) {
                quest.progress = quest.target;
                quest.is_completed = 1; 
                justFinished = true;

                // REWARD
                await PlayerManager.addMoneyAndSave(player, quest.reward_money, `Quest: ${questKey}`);
                player.call('showNotification', ['Quest Complete', `Completed: ${quest.description}`]);
                player.call('playSound', ['HUD_AWARDS', 'CHALLENGE_UNLOCKED']);
            }

            // SAVE TO DB (Fire and forget, but log errors)
            db.query(
                'UPDATE character_daily_quests SET progress = ?, is_completed = ? WHERE character_id = ? AND quest_key = ? AND date_generated = ?',
                [quest.progress, quest.is_completed, player.data.dbId, questKey, quest.date_generated]
            ).catch(err => {
                console.error(`[DailyQuests] Save Failed for ${player.name} [${questKey}]:`, err.message);
            });

            // --- REAL TIME UI UPDATE ---
            // We blindly send this event. The client ignores it if the menu isn't open.
            player.call('client:updateQuestMenu', [player.data.dailyQuests]);
        }
    }
};

// Events
mp.events.add('server:loadAccount', (player) => DailyQuests.init(player));
mp.events.add('server:getQuestData', (player) => {
    if(player.data.dailyQuests) player.call('client:updateQuestMenu', [player.data.dailyQuests]);
});

module.exports = DailyQuests;