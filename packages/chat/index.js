// packages/chat/index.js
const CHAT_RANGE = 20.0;

// 1. Automatic Command Collection
const serverCommands = [];
const originalAddCommand = mp.events.addCommand;

// Overwrite the RAGE function to "steal" command names
mp.events.addCommand = (command, handler) => {
    if (!serverCommands.includes(command)) {
        serverCommands.push(command);
    }
    if (originalAddCommand) originalAddCommand(command, handler);
};

// 2. Send Commands when player joins
mp.events.add('playerReady', (player) => {
    // Send the list to the client
    player.call('client:chat:init', [serverCommands]);
    
    // Override outputChatBox to use our custom system
    player.outputChatBox = (message) => {
        player.call('chat:push', ['Server', message, 'server']);
    };
});

// 3. Chat Routing
mp.events.add('chat:say', (player, message) => {
    if (!message) return;

    // Default Proximity Chat
    mp.players.forEachInRange(player.position, CHAT_RANGE, (target) => {
        target.call('chat:push', [player.name, message, 'local']);
    });
});