// packages/chat/command-collector.js
const serverCommands = [];
const originalAddCommand = mp.events.addCommand;

// Override the default addCommand to "steal" the name
mp.events.addCommand = (command, handler) => {
    if (!serverCommands.includes(command)) {
        serverCommands.push(command);
    }
    // Actually register it so it works
    if (originalAddCommand) originalAddCommand(command, handler);
};

// Send the list to players when they join
mp.events.add('playerReady', (player) => {
    player.call('client:chat:init', [serverCommands]);
});

console.log('[Chat] Command Collector initialized.');