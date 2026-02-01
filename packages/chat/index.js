// packages/chat/index.js
const CHAT_RANGE = 20.0; 
const commandsMap = new Map();
const commandNames = [];

// 1. Command Handling
const originalAddCommand = mp.events.addCommand;
mp.events.addCommand = (command, handler) => {
    commandsMap.set(command.toLowerCase(), handler);
    if (!commandNames.includes(command)) commandNames.push(command);
    if (originalAddCommand) originalAddCommand(command, handler);
};

// 2. Setup Player
mp.events.add('playerReady', (player) => {
    // Override default outputChatBox to use our system
    player.outputChatBox = (message) => {
        player.call('chat:push', ['Server', message, 'info']);
    };
});

// 3. Client Init
mp.events.add('chat:fetchCommands', (player) => {
    player.call('chat:updateCommands', [commandNames]);
});

// 4. Main Chat Routing
mp.events.add('chat:say', (player, message) => {
    if (!message) return;

    // Command handling
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

    // Default Local Chat
    mp.players.forEachInRange(player.position, CHAT_RANGE, (target) => {
        const dist = target.dist(player.position);
        // Add distance color fading or just standard local chat
        target.call('chat:push', [player.name, message, 'local']);
    });
});

// 5. Public API for other systems
module.exports = {
    // Basic Broadcast
    broadcast: (player, message, type = 'info') => {
        if (player) player.call('chat:push', [null, message, type]);
    },
    broadcastAll: (message, type = 'info') => {
        mp.players.broadcast('chat:push', [null, message, type]);
    },
    // Specific Channel Helpers
    sendLocal: (player, message, name = null) => {
        mp.players.forEachInRange(player.position, CHAT_RANGE, (target) => {
            target.call('chat:push', [name || player.name, message, 'local']);
        });
    },
    sendFaction: (playersArray, message, factionName) => {
        // Pass array of players to receive message
        playersArray.forEach(p => {
            p.call('chat:push', [factionName, message, 'faction']);
        });
    },
    sendAdmin: (message) => {
        mp.players.forEach(p => {
            if (p.data && p.data.isAdmin) { // Check your admin logic
                p.call('chat:push', ['AdminChat', message, 'admin']);
            }
        });
    }
};