// packages/core/phone/banking.js
const Banking = require('../banking');

// 1. Load Bank Data for App
mp.events.add('server:phone:bank:open', async (player) => {
    if (!player.logged) return;

    try {
        const history = await Banking.getHistory(player);
        const data = {
            balance: Banking.getBalance(player),
            history: history
        };
        player.call('client:phone:bank:data', [JSON.stringify(data)]);
    } catch (e) {
        console.error("Bank Phone Error", e);
    }
});

// 2. Handle Transfer
mp.events.add('server:phone:bank:transfer', async (player, targetName, amount) => {
    const result = await Banking.transfer(player, targetName, parseInt(amount));
    
    if (result.success) {
        player.call('showNotification', ['Bank', 'Transfer Sent!']);
        // Refresh data
        mp.events.call('server:phone:bank:open', player);
    } else {
        player.call('showNotification', ['Bank Error', result.message]);
    }
});