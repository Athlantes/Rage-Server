/**
 * CLASS SELECTOR - TESTING & DEBUGGING
 * 
 * Use these commands in console to test the class system:
 * 
 * Trigger class selector manually:
 *   mp.events.call('testClassSelector', mp.players.local);
 * 
 * Or in server console:
 *   mp.events.call('testClassSelector', targetPlayer);
 */

// Auto-trigger on player spawn (for testing)
// Uncomment next line to auto-show class selector on every spawn:
// mp.events.add('playerSpawn', (player) => {
//     setTimeout(() => {
//         if (mp.players.exists(player)) {
//             console.log('[Test] Auto-triggering class selector');
//             player.call('client:classSelector:start');
//         }
//     }, 500);
// });

console.log('[ClassSelector] Debug module loaded');
