const CHAT_RANGE = 20.0; 

// 1. Manual Storage for Commands (Guarantees they will work)
const commandsMap = new Map();
const commandNames = [];

const originalAddCommand = mp.events.addCommand;

// 2. Override addCommand to store them for us
mp.events.addCommand = (command, handler) => {
    commandsMap.set(command.toLowerCase(), handler);
    if (!commandNames.includes(command)) commandNames.push(command);
    
    // Keep original just in case
    if (originalAddCommand) originalAddCommand(command, handler);
};

mp.events.add('playerReady', (player) => {
    player.outputChatBox = (message) => {
        player.call('chat:push', ['Server', message, 'info']);
    };
});

// 3. SECURE LOADING: Only send commands when client asks (Fixes Race Condition)
mp.events.add('chat:fetchCommands', (player) => {
    player.call('chat:updateCommands', [commandNames]);
});

mp.events.add('chat:say', (player, message) => {
    if (!message) return;

    // 4. Handle Commands Manually
    if (message.startsWith('/')) {
        const fullText = message.slice(1);
        const args = fullText.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        const cmdName = args.shift().toLowerCase();
        
        const handler = commandsMap.get(cmdName);
        
        if (handler) {
            // Reconstruct the argument string (e.g. "Adder" from "/buycar Adder")
            const cmdArgs = fullText.substring(cmdName.length).trim();
            handler(player, cmdArgs, ...args);
        } else {
            player.outputChatBox("!{FF0000}Unknown command.");
        }
        return;
    }

    // 5. Handle Normal Chat
    mp.players.forEachInRange(player.position, CHAT_RANGE, (target) => {
        target.call('chat:push', [player.name, message, 'local']);
    });
});

module.exports = {
    broadcast: (player, message, type = 'info') => {
        if (player) player.call('chat:push', [null, message, type]);
    },
    broadcastAll: (message, type = 'info') => {
        mp.players.broadcast('chat:push', [null, message, type]);
    }
};