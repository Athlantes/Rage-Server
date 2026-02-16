// packages/chat/index.js
require('./command-collector'); // Load the collector FIRST

const CHAT_RANGE = 20.0;

mp.events.add('playerReady', (player) => {
    // ⚠️ THE MAGIC: Redirect standard RAGE output to our Custom UI
    player.outputChatBox = (message) => {
        player.call('chat:push', ['', message, 'server']);
    };
    
    player.notify = (message) => {
         player.call('chat:push', ['Quests', message, 'admin']);
    };

    console.log(`[Chat] Hooked outputChatBox for ${player.name}`);
});

// Handle players typing in chat (Prox Chat)
mp.events.add('chat:say', (player, message) => {
    if (!message || message.length === 0) return;

    // Security: Prevent HTML injection
    message = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Build family tag prefix if player is in a family
    const familyTag   = player.getVariable('familyTag');
    const familyColor = player.getVariable('familyChatColor');
    const tagPrefix   = (familyTag && familyColor) ? `!{${familyColor}}[${familyTag}] ` : '';

    // Send to everyone nearby
    mp.players.forEachInRange(player.position, CHAT_RANGE, (target) => {
        const distance = target.dist(player.position);
        let color = 'white';
        
        // Darken color slightly with distance (optional visual effect)
        if (distance > 10) color = '#cccccc';
        if (distance > 15) color = '#999999';

        target.call('chat:push', [`${tagPrefix}${player.name}`, message, 'local']);
    });
});