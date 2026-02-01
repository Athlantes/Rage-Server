const CHAT_RANGE = 20.0; 

// --- Command Interceptor (For Autocomplete) ---
const commandList = [];
const originalAddCommand = mp.events.addCommand;

mp.events.addCommand = (command, handler) => {
    commandList.push(command);
    originalAddCommand(command, handler);
};

// --- Events ---
mp.events.add('playerReady', (player) => {
    // Send the command list to the client for Autocomplete
    player.call('chat:updateCommands', [commandList]);
});

mp.events.add('chat:say', (player, message) => {
    // 1. Handle Commands
    if (message.startsWith('/')) {
        const args = message.slice(1).trim().split(' ');
        const command = args.shift();
        
        mp.events.call('playerCommand', player, message.slice(1)); 
        return;
    }

    // 2. Handle Normal Chat
    mp.players.forEachInRange(player.position, CHAT_RANGE, (target) => {
        target.call('chat:push', [player.name, message, 'local']);
    });
});

// --- API for other scripts ---
module.exports = {
    broadcast: (player, message, type = 'info') => {
        if (player) player.call('chat:push', [null, message, type]);
    },
    broadcastAll: (message, type = 'info') => {
        mp.players.broadcast('chat:push', [null, message, type]);
    }
};