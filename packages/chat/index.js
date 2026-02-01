// packages/chat/index.js
const CHAT_RANGE = 20.0; 

// 1. Create a manual storage for commands
const commandsMap = new Map();
const commandNames = [];

// 2. Save the original RAGE function just in case
const originalAddCommand = mp.events.addCommand;

// 3. OVERRIDE 'addCommand' to capture all commands (like /buycar, /parkcar)
mp.events.addCommand = (command, handler) => {
    // Store for execution
    commandsMap.set(command.toLowerCase(), handler);
    // Store for Autocomplete (Client)
    if (!commandNames.includes(command)) {
        commandNames.push(command);
    }
    // Register normally as backup
    if (originalAddCommand) originalAddCommand(command, handler);
};

mp.events.add('playerReady', (player) => {
    // Redirect standard outputChatBox to your custom chat
    player.outputChatBox = (message) => {
        player.call('chat:push', ['Server', message, 'info']);
    };
});

// Event: Client asks for command list (Fixes Autocomplete)
mp.events.add('chat:fetchCommands', (player) => {
    player.call('chat:updateCommands', [commandNames]);
});

// Event: Player sent a message
mp.events.add('chat:say', (player, message) => {
    if (!message) return;

    // 1. Handle Commands (Starts with /)
    if (message.startsWith('/')) {
        const fullText = message.slice(1);
        const args = fullText.split(' ');
        const cmdName = args.shift().toLowerCase(); // get 'buycar'
        const cmdArgs = args.join(' '); // get 'Adder'

        const handler = commandsMap.get(cmdName);
        
        if (handler) {
            // Execute the stored function manually
            // We pass (player, "Adder") matching standard RAGE behavior
            handler(player, cmdArgs);
        } else {
            player.outputChatBox("!{FF0000}Unknown command.");
        }
        return;
    }

    // 2. Handle Normal Chat
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