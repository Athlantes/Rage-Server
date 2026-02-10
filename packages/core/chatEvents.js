// packages/core/chatEvents.js

mp.events.add('server:setTypingState', (player, state) => {
    if (!player || !mp.players.exists(player)) return;

    // Set a "Shared Variable"
    // This automatically syncs 'isTyping' to all clients near this player.
    player.setVariable('isTyping', state);
});