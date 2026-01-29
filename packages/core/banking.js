// packages/core/banking.js
const db = require('./database');
const playerManager = require('./playerManager');

class BankingService {

    /**
     * Initializes bank data on player login.
     * Call this inside auth.js loadAccount()
     */
    async initAccount(player) {
        if (!player.data.dbId) return;
        // Ensure data is loaded (usually loaded via SELECT * FROM users in auth)
        // If bank_money isn't in player.data yet, you might need to fetch it, 
        // but assuming the auth query does "SELECT *" it will be there.
        player.data.bank = player.data.bank_money || 0; 
        player.setVariable('bank', player.data.bank);
    }

    /**
     * Get current balance
     */
    getBalance(player) {
        return player.data.bank || 0;
    }

    /**
     * Deposit Cash -> Bank
     */
    async deposit(player, amount, reason = "ATM Deposit") {
        if (amount <= 0) return { success: false, message: "Invalid amount." };
        if (player.data.money < amount) return { success: false, message: "Not enough cash." };

        // 1. Remove Cash (Memory + Sync)
        if (!playerManager.removeMoney(player, amount, reason)) {
            return { success: false, message: "Transaction failed." };
        }

        // 2. Add Bank (Memory)
        player.data.bank += amount;
        player.setVariable('bank', player.data.bank);

        // 3. Persist & Log
        await this.saveBankAction(player, amount, 'deposit', null, reason);
        return { success: true, newBalance: player.data.bank };
    }

    /**
     * Withdraw Bank -> Cash
     */
    async withdraw(player, amount, reason = "ATM Withdraw") {
        if (amount <= 0) return { success: false, message: "Invalid amount." };
        if (player.data.bank < amount) return { success: false, message: "Insufficient funds." };

        // 1. Remove Bank (Memory)
        player.data.bank -= amount;
        player.setVariable('bank', player.data.bank);

        // 2. Add Cash
        await playerManager.addMoneyAndSave(player, amount, reason);

        // 3. Persist & Log
        await this.saveBankAction(player, amount, 'withdraw', null, reason);
        return { success: true, newBalance: player.data.bank };
    }

    /**
     * Transfer Bank -> Bank (Player to Player)
     */
    async transfer(sender, targetNameOrId, amount, note = "Transfer") {
        if (amount <= 0) return { success: false, message: "Invalid amount." };
        if (sender.data.bank < amount) return { success: false, message: "Insufficient funds." };

        // 1. Find Target
        let targetDbId = null;
        let targetPlayer = mp.players.toArray().find(p => p.name === targetNameOrId || p.data.dbId === parseInt(targetNameOrId));

        if (targetPlayer) {
            targetDbId = targetPlayer.data.dbId;
        } else {
            // Check DB if offline
            const [rows] = await db.query("SELECT id FROM users WHERE username = ?", [targetNameOrId]);
            if (rows.length === 0) return { success: false, message: "Person not found." };
            targetDbId = rows[0].id;
        }

        if (targetDbId === sender.data.dbId) return { success: false, message: "Cannot transfer to yourself." };

        // 2. Process Sender
        sender.data.bank -= amount;
        sender.setVariable('bank', sender.data.bank);

        // 3. Update DB (Atomic Transaction ideally, but separate updates for now)
        await this.saveBankAction(sender, amount, 'transfer_out', targetDbId, `To: ${targetNameOrId} (${note})`);
        
        // 4. Process Target
        if (targetPlayer) {
            targetPlayer.data.bank += amount;
            targetPlayer.setVariable('bank', targetPlayer.data.bank);
            targetPlayer.call('showNotification', ['Bank', `Received $${amount} from ${sender.name}`]);
            // Log for target
            await this.saveBankAction(targetPlayer, amount, 'transfer_in', sender.data.dbId, `From: ${sender.name} (${note})`);
        } else {
            // Offline update
            await db.query("UPDATE users SET bank_money = bank_money + ? WHERE id = ?", [amount, targetDbId]);
            // Manually log offline transaction
            await db.query("INSERT INTO bank_transactions (sender_id, target_id, amount, type, description) VALUES (?, ?, ?, 'transfer_in', ?)", 
                [targetDbId, sender.data.dbId, amount, `From: ${sender.name} (${note})`]);
        }

        return { success: true, message: "Transfer successful." };
    }

    /**
     * Helper: Updates User Balance in DB and inserts Transaction Record
     */
    async saveBankAction(player, amount, type, targetId, description) {
        try {
            // Update Balance
            await db.query("UPDATE users SET bank_money = ? WHERE id = ?", [player.data.bank, player.data.dbId]);
            
            // Insert Transaction
            await db.query(
                "INSERT INTO bank_transactions (sender_id, target_id, amount, type, description) VALUES (?, ?, ?, ?, ?)",
                [player.data.dbId, targetId, amount, type, description]
            );
        } catch (err) {
            console.error(`[Banking] Critical Error saving for ${player.name}:`, err);
        }
    }

    /**
     * Get Transaction History for Phone
     */
    async getHistory(player) {
        const [rows] = await db.query(
            "SELECT type, amount, description, created_at FROM bank_transactions WHERE sender_id = ? ORDER BY created_at DESC LIMIT 20",
            [player.data.dbId]
        );
        return rows;
    }
}

module.exports = new BankingService();