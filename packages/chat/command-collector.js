// packages/chat/command-collector.js

// 1. Store both names (for autocomplete) and handlers (for execution)
const serverCommands = [];
const commandHandlers = {};

// 2. Override mp.events.addCommand to capture the logic
const originalAddCommand = mp.events.addCommand;

mp.events.addCommand = (command, handler) => {
    // Save name for Client Autocomplete
    if (!serverCommands.includes(command)) {
        serverCommands.push(command);
    }

    // Save handler for Custom Execution
    commandHandlers[command] = handler;

    // Register normally just in case (optional, but good for backup)
    if (originalAddCommand) originalAddCommand(command, handler);
};

// 3. Listen for the 'command' event from your Custom Client Chat
mp.events.add('command', (player, commandInput) => {
    if (!commandInput) return;

    // Split input: "me dances all night" -> cmd="me", args=["dances", "all", "night"]
    const args = commandInput.split(' ');
    const commandName = args[0].toLowerCase();
    
    const handler = commandHandlers[commandName];

    if (handler) {
        // Remove the command name from the array to get arguments
        args.shift();
        const fullText = args.join(' ');

        // Execute the function!
        // Standard RageMP signature: (player, fullText, arg1, arg2, ...)
        handler(player, fullText, ...args);
    } else {
        player.outputChatBox(`!{FF0000}Command /${commandName} does not exist.`);
    }
});

// 4. Send command list to player on join (for Autocomplete)
mp.events.add('playerReady', (player) => {
    player.call('client:chat:init', [serverCommands]);
});

console.log('[Chat] Command Collector & Executor initialized.');