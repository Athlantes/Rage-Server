// core/playerManager.js
const db = require('./database');

const playerManager = {
    // Standard memory update (use for temporary items or HUD sync)
    addMoney: (player, amount, reason = "Unknown") => {
        if (!player || !mp.players.exists(player)) return false;
        player.data.money += amount;
        player.setVariable('money', player.data.money);
        console.log(`[Economy] ${player.name} gained $${amount} (${reason}). Total: ${player.data.money}`);
        return true;
    },

    /**
     * SECURE PAYOUT: Updates memory AND immediately persists to DB.
     * Essential for Job Rewards to prevent loss on server crash.
     */
    addMoneyAndSave: async (player, amount, reason = "Job Reward") => {
        if (!player || !mp.players.exists(player)) return false;

        // 1. Update Memory immediately so UI stays snappy
        player.data.money += amount;
        player.setVariable('money', player.data.money);

        // 2. Immediate Database Write
        try {
            const dbId = player.data.dbId;
            if (!dbId) return false;

            // Use additive SQL logic to prevent race conditions
            await db.query("UPDATE users SET money = money + ? WHERE id = ?", [amount, dbId]);
            
            console.log(`[Economy-Secure] ${player.name} +$${amount} (${reason}). DB Synced.`);
            return true;
        } catch (err) {
            console.error(`[CRITICAL] Failed to save money for ${player.name}:`, err);
            // Even if DB fails, memory is updated, but we log the error for admins
            return false;
        }
    },

    removeMoney: (player, amount, reason = "Unknown") => {
        if (!player || !mp.players.exists(player)) return false;
        if (player.data.money < amount) return false;

        player.data.money -= amount;
        player.setVariable('money', player.data.money);
        console.log(`[Economy] ${player.name} spent $${amount} (${reason}). Total: ${player.data.money}`);
        return true;
    },

    saveAccount: async (player) => {
        if (!mp.players.exists(player) || !player.logged || !player.data.dbId) return;

        const name = player.name; 
        const dbId = player.data.dbId;
        const money = player.data.money;
        const level = player.data.level;
        let currentPos;

        try {
            currentPos = JSON.stringify(player.position);
        } catch (err) {
            currentPos = JSON.stringify(new mp.Vector3(-1037, -2738, 13));
        }

        try {
            await db.query(
                "UPDATE users SET money=?, level=?, position=? WHERE id=?", 
                [money, level, currentPos, dbId]
            );
            console.log(`[Data] Saved account: ${name}`);
        } catch (e) {
            console.error(`[Data] Failed to save ${name}:`, e);
        }
    }
};

module.exports = playerManager;

mp.events.add('server:kickPlayer', (player) => {
    if (!player || !mp.players.exists(player)) return;
    
    console.log(`[Disconnect] ${player.name} requested disconnect.`);
    player.kick('Disconnected by user request.');
});