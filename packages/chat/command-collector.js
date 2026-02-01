// This array will hold all command names automatically
const serverCommands = [];

// We save the original RAGE function
const originalAddCommand = mp.events.addCommand;

// We overwrite it with our "spy" function
mp.events.addCommand = (command, handler) => {
    // 1. Add to our list
    if (!serverCommands.includes(command)) {
        serverCommands.push(command);
    }
    // 2. Actually register the command in RAGE
    if (originalAddCommand) {
        originalAddCommand(command, handler);
    }
};

// When a player joins/is ready, send them the list
mp.events.add('playerReady', (player) => {
    player.call('client:chat:receiveCommands', [serverCommands]);
});

console.log('[Chat] Command Collector initialized.');