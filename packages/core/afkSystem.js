// packages/core/afkSystem.js

mp.events.add('server:setAfkState', (player, isAfk) => {
    if (!player || !mp.players.exists(player)) return;

    // 1. Set Shared Variable (so other players see the tag)
    player.setVariable('isAfk', isAfk);

    // 2. Set Server-Side Data (for logic)
    player.data.isAfk = isAfk;

    if (isAfk) {
        console.log(`${player.name} is now AFK.`);
    } else {
        console.log(`${player.name} returned.`);
    }
});