// packages/core/banking.js
const db = require('./database');
const playerManager = require('./playerManager');

class BankingService {

    async initAccount(player) {
        if (!player.data.dbId) return;
        player.data.bank = player.data.bank_money || 0; 
        player.setVariable('bank', player.data.bank);
    }

    getBalance(player) {
        return player.data.bank || 0;
    }

    async deposit(player, amount, reason = "ATM Deposit") {
        amount = parseInt(amount); // FIX: Force Integer
        if (isNaN(amount) || amount <= 0) return { success: false, message: "Invalid amount." };
        if (player.data.money < amount) return { success: false, message: "Not enough cash." };

        if (!playerManager.removeMoney(player, amount, reason)) {
            return { success: false, message: "Transaction failed." };
        }

        player.data.bank += amount;
        player.setVariable('bank', player.data.bank);

        await this.saveBankAction(player, amount, 'deposit', null, reason);
        return { success: true, newBalance: player.data.bank };
    }

    async withdraw(player, amount, reason = "ATM Withdraw") {
        amount = parseInt(amount); // FIX: Force Integer
        if (isNaN(amount) || amount <= 0) return { success: false, message: "Invalid amount." };
        if (player.data.bank < amount) return { success: false, message: "Insufficient funds." };

        player.data.bank -= amount;
        player.setVariable('bank', player.data.bank);

        await playerManager.addMoneyAndSave(player, amount, reason);

        await this.saveBankAction(player, amount, 'withdraw', null, reason);
        return { success: true, newBalance: player.data.bank };
    }

    async transfer(sender, targetNameOrId, amount, note = "Transfer") {
        amount = parseInt(amount);
        if (isNaN(amount) || amount <= 0) return { success: false, message: "Invalid amount." };
        if (sender.data.bank < amount) return { success: false, message: "Insufficient funds." };

        let targetDbId = null;
        // Loose equality check for ID (string vs int)
        let targetPlayer = mp.players.toArray().find(p => p.name === targetNameOrId || p.data.dbId == targetNameOrId);

        if (targetPlayer) {
            targetDbId = targetPlayer.data.dbId;
        } else {
            const [rows] = await db.query("SELECT id FROM users WHERE username = ?", [targetNameOrId]);
            if (rows.length === 0) return { success: false, message: "Person not found." };
            targetDbId = rows[0].id;
        }

        if (targetDbId === sender.data.dbId) return { success: false, message: "Cannot transfer to yourself." };

        // Process Sender
        sender.data.bank -= amount;
        sender.setVariable('bank', sender.data.bank);

        await this.saveBankAction(sender, amount, 'transfer_out', targetDbId, `To: ${targetNameOrId} (${note})`);
        
        // Process Target
        if (targetPlayer) {
            targetPlayer.data.bank += amount;
            targetPlayer.setVariable('bank', targetPlayer.data.bank);
            
            // Notification
            targetPlayer.call('showNotification', ['Bank', `Received $${amount} from ${sender.name}`]);
            
            mp.events.call('server:phone:bank:open', targetPlayer);
            
            await this.saveBankAction(targetPlayer, amount, 'transfer_in', sender.data.dbId, `From: ${sender.name} (${note})`);
        } else {
            // Target Offline handling
            await db.query("UPDATE users SET bank_money = bank_money + ? WHERE id = ?", [amount, targetDbId]);
            await db.query("INSERT INTO bank_transactions (sender_id, target_id, amount, type, description, created_at) VALUES (?, ?, ?, 'transfer_in', ?, NOW())", 
                [targetDbId, sender.data.dbId, amount, `From: ${sender.name} (${note})`]);
        }

        return { success: true, message: "Transfer successful." };
    }

    async saveBankAction(player, amount, type, targetId, description) {
        try {
            await db.query("UPDATE users SET bank_money = ? WHERE id = ?", [player.data.bank, player.data.dbId]);
            await db.query(
                "INSERT INTO bank_transactions (sender_id, target_id, amount, type, description, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
                [player.data.dbId, targetId, amount, type, description]
            );
        } catch (err) {
            console.error(`[Banking] Critical Error saving for ${player.name}:`, err);
        }
    }

    async getHistory(player) {
        const [rows] = await db.query(
            "SELECT type, amount, description, created_at FROM bank_transactions WHERE sender_id = ? ORDER BY created_at DESC LIMIT 20",
            [player.data.dbId]
        );
        return rows;
    }
}

module.exports = new BankingService();