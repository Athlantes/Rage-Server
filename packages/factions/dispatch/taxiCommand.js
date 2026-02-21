// packages/factions/dispatch/taxiCommand.js
// ─────────────────────────────────────────────────────────────────────────────
// Registers the /calltaxi command.
// The caller's zone name is resolved on the client side (RAGEMP only exposes
// getZoneName from CEF/client), then sent up to the server to create the call.
// ─────────────────────────────────────────────────────────────────────────────

const dispatchManager = require('./dispatchManager');

const TAXI_FACTION_ID = 1;
const CALL_COOLDOWN_MS = 60 * 1000; // 1 minute between calls per player

// Track cooldowns: Map<playerId, timestamp>
const callerCooldowns = new Map();

// ── /calltaxi command ─────────────────────────────────────────────────────────
mp.events.addCommand('calltaxi', (player) => {
    // Check cooldown
    const lastCall = callerCooldowns.get(player.id) || 0;
    const remaining = Math.ceil((lastCall + CALL_COOLDOWN_MS - Date.now()) / 1000);
    if (remaining > 0) {
        player.outputChatBox(`!{#ff4757}You must wait ${remaining}s before calling a taxi again.`);
        return;
    }

    // Check if player is already in a vehicle (doesn't need a taxi)
    if (player.vehicle) {
        player.outputChatBox('!{#ff4757}You are already in a vehicle.');
        return;
    }

    // Ask client to resolve zone name, then return it to server
    // The client-side handler fires 'server:dispatch:submitCall'
    player.call('client:dispatch:resolveZone', []);
});

// Client responds with zone name + their current coords
mp.events.add('server:dispatch:submitCall', (player, locationName, x, y, z) => {
    // Re-check cooldown (race condition guard)
    const lastCall = callerCooldowns.get(player.id) || 0;
    if (Date.now() - lastCall < CALL_COOLDOWN_MS) return;

    // Check there are any on-duty taxi drivers (just needs to be on duty —
    // they don't have to be in their car at the exact moment the call comes in)
    let driversOnDuty = 0;
    mp.players.forEach(p => {
        if (
            p.getVariable('loggedIn') &&
            p.factionId === TAXI_FACTION_ID &&
            p.getVariable('factionDuty')
        ) {
            driversOnDuty++;
        }
    });

    if (driversOnDuty === 0) {
        player.outputChatBox('!{#ff4757}No taxi drivers are available right now. Try again later.');
        return;
    }

    // Set cooldown
    callerCooldowns.set(player.id, Date.now());

    // Build caller display name
    const callerName = player.name.replace(/_/g, ' ');

    // Create the dispatch call
    dispatchManager.addCall(TAXI_FACTION_ID, {
        callerName,
        callerServerId: player.id,
        coords: { x: parseFloat(x), y: parseFloat(y), z: parseFloat(z) },
        location: locationName || 'Unknown Area',
    });

    player.outputChatBox(`!{#ffc300}[TAXI] Your ride request has been sent! A driver will contact you shortly.`);
    player.outputChatBox(`!{#888888}Tip: Stay in the area. A taxi driver is on the way.`);
});

// Clean up cooldown when player disconnects
mp.events.add('playerQuit', (player) => {
    callerCooldowns.delete(player.id);
});