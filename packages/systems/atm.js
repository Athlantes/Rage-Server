// packages/systems/atm.js
const Banking = require('../core/banking');

mp.events.add('server:atm:open', (player) => {
    if (!player.logged) return;
    
    // Open UI with current data
    const data = {
        bank: Banking.getBalance(player),
        cash: player.data.money || 0
    };
    
    player.call('client:atm:openUI', [JSON.stringify(data)]);
});

mp.events.add('server:atm:process', async (player, type, amount) => {
    amount = parseInt(amount);
    if (isNaN(amount) || amount <= 0) return;

    let result;
    if (type === 'deposit') {
        result = await Banking.deposit(player, amount, 'ATM Deposit');
    } else if (type === 'withdraw') {
        result = await Banking.withdraw(player, amount, 'ATM Withdraw');
    }

    if (result.success) {
        player.call('showNotification', ['ATM', 'Transaction Successful']);
        // Refresh ATM UI
        const data = {
            bank: Banking.getBalance(player),
            cash: player.data.money || 0
        };
        player.call('client:atm:updateUI', [JSON.stringify(data)]);
    } else {
        player.call('showNotification', ['ATM Error', result.message]);
    }
});