// packages/core/phone/banking.js
const Banking = require('../banking');

// 1. Load Bank Data for App
mp.events.add('server:phone:bank:open', async (player) => {
    if (!player.logged) return;

    let history = [];
    let balance = 0;

    // A. Try to get Balance
    try {
        balance = Banking.getBalance(player);
    } catch (e) {
        console.error("[Phone] Error getting balance:", e);
    }

    // B. Try to get History (Fail safe)
    try {
        history = await Banking.getHistory(player);
    } catch (e) {
        console.error("[Phone] Error getting bank history (Check DB table 'bank_transactions'):", e.message);
        // We set history to empty array so the app still opens
        history = []; 
    }

    // C. Send Data to Phone
    const data = {
        balance: balance,
        history: history
    };
    
    player.call('client:phone:bank:data', [JSON.stringify(data)]);
});

// 2. Handle Transfer
mp.events.add('server:phone:bank:transfer', async (player, targetName, amount) => {
    // FIX: Ensure amount is valid before processing
    const safeAmount = parseInt(amount);
    if (isNaN(safeAmount) || safeAmount <= 0) {
        return player.call('showNotification', ['Bank Error', 'Invalid Amount']);
    }

    const result = await Banking.transfer(player, targetName, safeAmount);
    
    if (result.success) {
        player.call('showNotification', ['Bank', 'Transfer Sent!']);
        // Refresh data
        mp.events.call('server:phone:bank:open', player);
    } else {
        player.call('showNotification', ['Bank Error', result.message]);
    }
});