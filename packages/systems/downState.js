// packages/systems/downState.js
// ─────────────────────────────────────────────────────────────────────────────
// Manages the "isDown" state that is triggered when a player dies instead of
// immediately sending them to the respawn menu.
//
// Flow:
//   playerDeath → enterDownState (spawn in place, health=1, invincible, CEF)
//   Player presses "Call Medic"  → dispatch call to Paramedics (faction 3)
//   Player presses "Respawn"     → teleport to nearest hospital, 50% HP
//   Paramedic performs CPR       → revivePlayer() called from paramedicDispatch
// ─────────────────────────────────────────────────────────────────────────────

const { getNearestHospital } = require('../data/hospitals');
const jailManager = require('../factions/lspd/jailManager');

// Lazy-load dispatch to avoid circular-require at boot
function getDispatchManager() {
    return require('../factions/dispatch/dispatchManager');
}

// ── State ────────────────────────────────────────────────────────────────────

// Map<serverId, { position, callMedicUsed, dimension }>
const downedPlayers = new Map();

// ── Helpers ──────────────────────────────────────────────────────────────────

function isPlayerDown(player) {
    return player.getVariable('isDown') === true;
}

function countDutyParamedics() {
    let count = 0;
    mp.players.forEach(p => {
        if (p.logged && p.factionId === 3 && p.getVariable('factionDuty')) count++;
    });
    return count;
}

function isOfficerOnDuty(player) {
    return !!player && mp.players.exists(player) && player.logged && player.factionId === 2 && player.getVariable('factionDuty');
}

function resolvePlayerKiller(killer) {
    if (!killer) return null;

    if (
        typeof killer.id === 'number' &&
        typeof killer.getVariable === 'function' &&
        typeof killer.factionId !== 'undefined'
    ) {
        return mp.players.exists(killer) ? killer : null;
    }

    if (killer.type === 'player' && mp.players.exists(killer)) {
        return killer;
    }

    if (typeof killer.getOccupant === 'function') {
        const driver = killer.getOccupant(-1);
        if (driver && mp.players.exists(driver)) return driver;
    }

    return null;
}

function getDownedPlayersData() {
    const result = [];
    downedPlayers.forEach((info, playerId) => {
        const player = mp.players.at(playerId);
        if (player && mp.players.exists(player)) {
            result.push({
                id:  playerId,
                pos: { x: info.position.x, y: info.position.y, z: info.position.z },
            });
        }
    });
    return result;
}

function broadcastDownedPlayersToMedics() {
    const data = JSON.stringify(getDownedPlayersData());
    mp.players.forEach(p => {
        if (p.logged && p.factionId === 3 && p.getVariable('factionDuty')) {
            p.call('client:paramedic:syncDownedPlayers', [data]);
        }
    });
}

// ── Enter / Leave Down State ─────────────────────────────────────────────────

function enterDownState(player) {
    if (!player || !mp.players.exists(player)) return;
    if (!player.logged) return;

    const pos  = player.position;
    const dim  = player.dimension;

    downedPlayers.set(player.id, {
        position:       { x: pos.x, y: pos.y, z: pos.z },
        dimension:      dim,
        callMedicUsed:  false,
    });

    player.setVariable('isDown', true);

    // Bring out of the native death screen at the exact death spot
    player.spawn(new mp.Vector3(pos.x, pos.y, pos.z));
    player.dimension = dim;
    player.health    = 1;   // critically low — kept alive by invincibility below

    const medicCount = countDutyParamedics();
    player.call('client:downState:show', [JSON.stringify({ medicCount })]);

    // Notify all on-duty paramedics
    broadcastDownedPlayersToMedics();

    console.log(`[DownState] ${player.name} is down at (${Math.round(pos.x)}, ${Math.round(pos.y)}). Medics on duty: ${medicCount}`);
}

function revivePlayer(player, revivedBy) {
    if (!player || !mp.players.exists(player)) return;
    if (!isPlayerDown(player)) return;

    downedPlayers.delete(player.id);
    player.setVariable('isDown', false);
    player.health = 50;

    player.call('client:downState:hide',          []);
    player.call('client:downState:stopAnimation', []);

    if (revivedBy) {
        const revName = revivedBy.name.replace(/_/g, ' ');
        const tgtName = player.name.replace(/_/g, ' ');
        player.outputChatBox(`!{#ff4757}[EMS] !{#ffffff}You were revived by ${revName}.`);
        revivedBy.outputChatBox(`!{#ff4757}[EMS] !{#ffffff}You successfully revived ${tgtName}.`);
    }

    broadcastDownedPlayersToMedics();
    console.log(`[DownState] ${player.name} revived${revivedBy ? ' by ' + revivedBy.name : ''}.`);
}

// ── Server Events ────────────────────────────────────────────────────────────

// Intercept death → enter down state instead of normal respawn
mp.events.add('playerDeath', (player, reason, killer) => {
    if (!player.logged) return;
    if (isPlayerDown(player)) return; // already down, ignore

    const wantedType = player.getVariable('wantedType');
    const killerPlayer = resolvePlayerKiller(killer);

    if (wantedType === 'NoS' && isOfficerOnDuty(killerPlayer)) {
        jailManager.sendToPrison(player, { forceRespawn: true });
        player.outputChatBox('!{#ff4757}[LSPD] !{#ffffff}No-surrender warrant enforced. You have been booked into Bolingbroke.');
        return;
    }

    enterDownState(player);
});

// ── Call Medic: client resolves zone then fires this with the location name ──
mp.events.add('server:downState:callMedic', (player, locationName) => {
    if (!isPlayerDown(player)) return;

    const info = downedPlayers.get(player.id);
    if (!info) return;

    if (info.callMedicUsed) {
        player.call('client:downState:error', ['You have already called a medic.']);
        return;
    }

    if (countDutyParamedics() === 0) {
        player.call('client:downState:error', ['No paramedics are currently on duty.']);
        return;
    }

    info.callMedicUsed = true;

    getDispatchManager().addCall(3, {
        callerName:     player.name.replace(/_/g, ' '),
        callerServerId: player.id,
        coords:         info.position,
        location:       locationName || 'Unknown Area',
        callType:       'Player Down',
    });

    player.outputChatBox('!{#ff4757}[EMS] !{#ffffff}Help is on the way. Stay alive!');
    player.call('client:downState:medicCalled', []);
});

// ── Respawn at nearest hospital ──────────────────────────────────────────────
mp.events.add('server:downState:respawn', (player) => {
    if (!isPlayerDown(player)) return;

    downedPlayers.delete(player.id);
    player.setVariable('isDown', false);

    if (jailManager.isInPrison(player)) {
        jailManager.sendToPrison(player, {
            forceRespawn: true,
            clearClientRestraints: false,
            setCooldown: false,
        });

        player.call('client:downState:hide',          []);
        player.call('client:downState:stopAnimation', []);
        player.call('client:downState:respawnEffect',  []);

        player.outputChatBox('!{#ff4757}[LSPD] !{#ffffff}You were returned to your prison cell.');

        broadcastDownedPlayersToMedics();
        console.log(`[DownState] ${player.name} respawned back in prison.`);
        return;
    }

    const pos     = player.position;
    const nearest = getNearestHospital({ x: pos.x, y: pos.y, z: pos.z });

    const sp = nearest.spawnPoint;
    player.spawn(new mp.Vector3(sp.x, sp.y, sp.z));
    player.dimension = 0;
    player.health    = 50;

    player.call('client:downState:hide',          []);
    player.call('client:downState:stopAnimation', []);
    player.call('client:downState:respawnEffect',  []);

    player.outputChatBox(`!{#ff4757}[EMS] !{#ffffff}You were transported to ${nearest.name}.`);

    broadcastDownedPlayersToMedics();
    console.log(`[DownState] ${player.name} respawned at ${nearest.name}.`);
});

// ── Sync downed list to a medic who just went on duty ───────────────────────
mp.events.add('paramedic:dutyChanged', (player) => {
    if (player.getVariable('factionDuty')) {
        const data = JSON.stringify(getDownedPlayersData());
        player.call('client:paramedic:syncDownedPlayers', [data]);
    }
    // Also update medicCount in every downed player's CEF
    const medicCount = countDutyParamedics();
    downedPlayers.forEach((_, playerId) => {
        const p = mp.players.at(playerId);
        if (p && mp.players.exists(p)) {
            p.call('client:downState:updateMedicCount', [medicCount]);
        }
    });
});

// ── Cleanup on disconnect ────────────────────────────────────────────────────
mp.events.add('playerQuit', (player) => {
    if (downedPlayers.has(player.id)) {
        downedPlayers.delete(player.id);
        broadcastDownedPlayersToMedics();
    }
});

module.exports = {
    isPlayerDown,
    revivePlayer,
    getDownedPlayersData,
    broadcastDownedPlayersToMedics,
    countDutyParamedics,
};
