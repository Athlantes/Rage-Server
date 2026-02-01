// packages/chat/index.js
const CHAT_RANGE = 20.0; 

// 1. Storage for Commands
const commandsMap = new Map();
const commandNames = [];

const originalAddCommand = mp.events.addCommand;

// 2. Override addCommand to capture command names
mp.events.addCommand = (command, handler) => {
    commandsMap.set(command.toLowerCase(), handler);
    if (!commandNames.includes(command)) commandNames.push(command);
    
    // Keep original RAGE functionality
    if (originalAddCommand) originalAddCommand(command, handler);
};

mp.events.add('playerReady', (player) => {
    player.outputChatBox = (message) => {
        player.call('chat:push', ['Server', message, 'info']);
    };
});

// 3. LISTEN FOR CLIENT REQUEST
mp.events.add('chat:fetchCommands', (player) => {
    // Send the array of command names ['buycar', 'me', 'help', etc]
    player.call('chat:updateCommands', [commandNames]);
});

mp.events.add('chat:say', (player, message) => {
    if (!message) return;

    if (message.startsWith('/')) {
        const fullText = message.slice(1);
        const args = fullText.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        const cmdName = args.shift().toLowerCase();
        
        const handler = commandsMap.get(cmdName);
        
        if (handler) {
            const cmdArgs = fullText.substring(cmdName.length).trim();
            handler(player, cmdArgs, ...args);
        } else {
            player.outputChatBox("!{FF0000}Unknown command.");
        }
        return;
    }

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