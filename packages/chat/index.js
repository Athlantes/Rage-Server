// packages/chat/index.js

const CHAT_RANGE = 20.0; 
const WHISPER_RANGE = 3.0; // Close proximity for /w

// 1. Command Setup
const commandsMap = new Map();
const commandNames = [];

const originalAddCommand = mp.events.addCommand;
mp.events.addCommand = (command, handler) => {
    commandsMap.set(command.toLowerCase(), handler);
    if (!commandNames.includes(command)) commandNames.push(command);
    if (originalAddCommand) originalAddCommand(command, handler);
};

mp.events.add('playerReady', (player) => {
    player.outputChatBox = (message) => {
        player.call('chat:push', ['Server', message, 'info']);
    };
});

mp.events.add('chat:fetchCommands', (player) => {
    player.call('chat:updateCommands', [commandNames]);
});

// 2. Chat Routing
mp.events.add('chat:say', (player, message) => {
    if (!message) return;

    // A. Command Handling
    if (message.startsWith('/')) {
        const fullText = message.slice(1);
        const args = fullText.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        const cmdName = args.shift().toLowerCase();
        
        const handler = commandsMap.get(cmdName);
        if (handler) {
            handler(player, fullText.substring(cmdName.length).trim(), ...args);
        } else {
            player.outputChatBox("!{FF0000}Unknown command.");
        }
        return;
    }

    // B. Default: Proximity Chat (No Prefix, just Name)
    mp.players.forEachInRange(player.position, CHAT_RANGE, (target) => {
        target.call('chat:push', [player.name, message, 'local']);
    });
});

// 4. API Exports
module.exports = {
    broadcast: (player, message, type = 'info') => {
        if (player) player.call('chat:push', ['Server', message, type]);
    },
    // Helper to send formatted messages to specific lists
    sendToPlayers: (players, senderName, message, type, prefix = "") => {
        const finalName = prefix ? `${prefix} ${senderName}` : senderName;
        players.forEach(p => p.call('chat:push', [finalName, message, type]));
    }
};