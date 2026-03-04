// packages/factions/lspd/wantedManager.js
// ─────────────────────────────────────────────────────────────────────────────
// Wanted system with two states: RoS (Right of Surrender) and NoS (No Surrender)
//
// Each offense has a timer (seconds). Timers count down in real time and are
// displayed on the suspect's cooldown HUD (top-right). When all timers expire,
// the player is cleared and the escape is logged to DB.
//
// RoS: Suspect can /surrender — freezes them, officer can then /cuff.
// NoS: No /surrender command. Must be killed to remove the wanted.
//      Dying clears ALL NoS offenses. RoS offenses survive death.
//
// Cuffing (RoS only after /surrender, or forced by officer proximity):
//   - Suspect is attached to officer's movement via a server tick
//   - Officer enters their faction vehicle → suspect is warped to back seat
//   - /uncuff or /release clears the cuff state
// ─────────────────────────────────────────────────────────────────────────────

const db = require('../../core/database');

// ── Offense Registry ──────────────────────────────────────────────────────────
// type: 'RoS' | 'NoS'
// duration: seconds the timer runs
// fine: base fine amount if officer uses /ticket instead of /jail
// canStack: if false, applying the same offense again just resets the timer
const OFFENSES = {
    // ── RoS Offenses ─────────────────────────────────────────────────────────
    speeding:           { label: 'Speeding',            type: 'RoS', duration: 5  * 60, fine: 500,   canStack: false },
    reckless_driving:   { label: 'Reckless Driving',    type: 'RoS', duration: 8  * 60, fine: 1000,  canStack: false },
    trespassing:        { label: 'Trespassing',         type: 'RoS', duration: 6  * 60, fine: 750,   canStack: false },
    petty_theft:        { label: 'Petty Theft',         type: 'RoS', duration: 8  * 60, fine: 1500,  canStack: false },
    minor_possession:   { label: 'Drug Possession',     type: 'RoS', duration: 10 * 60, fine: 2000,  canStack: false },
    public_disturbance: { label: 'Public Disturbance',  type: 'RoS', duration: 5  * 60, fine: 500,   canStack: false },

    // ── NoS Offenses ─────────────────────────────────────────────────────────
    armed_robbery:      { label: 'Armed Robbery',       type: 'NoS', duration: 15 * 60, fine: 10000, canStack: false },
    assault:            { label: 'Assault',             type: 'NoS', duration: 12 * 60, fine: 5000,  canStack: true  },
    murder:             { label: 'Murder',              type: 'NoS', duration: 20 * 60, fine: 25000, canStack: true  },
    fleeing_officer:    { label: 'Fleeing Officer',     type: 'NoS', duration: 10 * 60, fine: 3000,  canStack: false },
    drug_trafficking:   { label: 'Drug Trafficking',    type: 'NoS', duration: 15 * 60, fine: 15000, canStack: false },
    vehicle_theft:      { label: 'Vehicle Theft',       type: 'NoS', duration: 10 * 60, fine: 5000,  canStack: false },
};

// ── In-memory wanted state ────────────────────────────────────────────────────
// Map<playerId, Map<offenseKey_instance, { offenseKey, expiresAt, type }>>
// Using a per-instance key so stackable offenses can have multiple entries.
const wantedPlayers = new Map();

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWanted(player) {
    return wantedPlayers.get(player.id) || new Map();
}

function hasWanted(player) {
    const entries = getWanted(player);
    const now = Date.now();
    for (const entry of entries.values()) {
        if (entry.expiresAt > now) return true;
    }
    return false;
}

function getWantedType(player) {
    const entries = getWanted(player);
    const now = Date.now();
    let hasNoS = false;
    let hasRoS = false;
    for (const entry of entries.values()) {
        if (entry.expiresAt <= now) continue;
        if (entry.type === 'NoS') hasNoS = true;
        else hasRoS = true;
    }
    if (hasNoS) return 'NoS';
    if (hasRoS) return 'RoS';
    return null;
}

// Build the cooldown-compatible payload for the client HUD
// The overlay expects { key: expiryTimestamp (ms) }
function buildCooldownPayload(player) {
    const entries = getWanted(player);
    const now = Date.now();
    const payload = {};
    for (const [instanceKey, entry] of entries.entries()) {
        if (entry.expiresAt > now) {
            payload[instanceKey] = entry.expiresAt;
        }
    }
    return payload;
}

// Push the current wanted state to the suspect's HUD
function syncHUD(player) {
    if (!mp.players.exists(player)) return;
    const payload = buildCooldownPayload(player);
    player.call('updateCooldowns', [JSON.stringify(payload)]);
    // Also sync the wanted type variable so other systems can read it
    player.setVariable('wantedType', getWantedType(player));
}

// ── Apply an offense ──────────────────────────────────────────────────────────

function applyOffense(suspect, offenseKey, officerId = null) {
    const offense = OFFENSES[offenseKey];
    if (!offense) {
        console.warn(`[Wanted] Unknown offense key: ${offenseKey}`);
        return false;
    }

    if (!wantedPlayers.has(suspect.id)) {
        wantedPlayers.set(suspect.id, new Map());
    }

    const entries = wantedPlayers.get(suspect.id);
    const now = Date.now();
    const expiresAt = now + offense.duration * 1000;

    if (!offense.canStack) {
        // Reset the timer if already has this offense
        entries.set(offenseKey, { offenseKey, expiresAt, type: offense.type, label: offense.label });
    } else {
        // Stack — use a unique timestamped key
        const instanceKey = `${offenseKey}_${now}`;
        entries.set(instanceKey, { offenseKey, expiresAt, type: offense.type, label: offense.label });
    }

    syncHUD(suspect);

    // Notify the suspect
    const typeTag = offense.type === 'NoS'
        ? `!{#ff4757}[WANTED - NO SURRENDER]`
        : `!{#ffc300}[WANTED - RIGHT OF SURRENDER]`;
    suspect.outputChatBox(`${typeTag} !{#ffffff}You are wanted for: ${offense.label}. Timer: ${Math.floor(offense.duration / 60)} min.`);

    if (offense.type === 'RoS') {
        suspect.outputChatBox(`!{#ffc300}Tip: Use /surrender to give yourself up to an officer.`);
    }

    // Notify nearby on-duty officers
    mp.players.forEach(p => {
        if (!p.logged || p.factionId !== 2 || !p.getVariable('factionDuty')) return;
        p.outputChatBox(`!{#00a8ff}[DISPATCH] !{#ffffff}${suspect.name.replace(/_/g, ' ')} is now wanted for: !{#ff4757}${offense.label} !{#888888}(${offense.type})`);
    });

    console.log(`[Wanted] ${suspect.name} charged with ${offenseKey} (${offense.type}) by officer ID ${officerId}`);
    return true;
}

// ── Clear a specific offense (e.g. after arrest/ticket) ──────────────────────

function clearOffense(suspect, offenseKey) {
    const entries = getWanted(suspect);
    // Clear all instances of this offense key (handles stackable too)
    for (const [instanceKey] of entries.entries()) {
        if (instanceKey === offenseKey || instanceKey.startsWith(offenseKey + '_')) {
            entries.delete(instanceKey);
        }
    }
    syncHUD(suspect);
}

// ── Clear ALL wanted (arrest processed, or NoS death) ────────────────────────

function clearAllWanted(suspect, reason = 'cleared') {
    wantedPlayers.delete(suspect.id);
    syncHUD(suspect);
    suspect.outputChatBox(`!{#2ecc71}[WANTED] Your wanted status has been cleared (${reason}).`);
}

// ── Clear only NoS offenses (on death) ───────────────────────────────────────

function clearNoSOnDeath(suspect) {
    const entries = getWanted(suspect);
    if (!entries.size) return;

    let cleared = 0;
    for (const [instanceKey, entry] of entries.entries()) {
        if (entry.type === 'NoS') {
            entries.delete(instanceKey);
            cleared++;
        }
    }

    if (cleared > 0) {
        syncHUD(suspect);
        suspect.outputChatBox(`!{#888888}[WANTED] Your NoS offenses were cleared by death.`);
        console.log(`[Wanted] ${suspect.name} died — cleared ${cleared} NoS offense(s).`);
    }
}

// ── Expire timers (server tick every 30s, fine granularity enough for logging) ─

setInterval(() => {
    const now = Date.now();

    wantedPlayers.forEach((entries, playerId) => {
        let anyExpired = false;

        for (const [instanceKey, entry] of entries.entries()) {
            if (entry.expiresAt <= now) {
                entries.delete(instanceKey);
                anyExpired = true;

                // Log the escape to DB
                const player = mp.players.at(playerId);
                const playerDbId = (player && mp.players.exists(player)) ? (player.data && player.data.dbId) : null;

                (async () => {
                    try {
                        await db.query(
                            `INSERT INTO wanted_history (user_id, offense_key, offense_label, type, outcome, created_at)
                             VALUES (?, ?, ?, ?, 'escaped', NOW())`,
                            [playerDbId, entry.offenseKey, entry.label, entry.type]
                        );
                    } catch (e) {
                        console.error('[Wanted] Failed to log escape:', e);
                    }
                })();

                console.log(`[Wanted] Player ID ${playerId} escaped wanted for: ${entry.offenseKey}`);
            }
        }

        if (anyExpired) {
            // Remove from map if all cleared
            if (entries.size === 0) {
                wantedPlayers.delete(playerId);
            }
            // Sync HUD if player is still online
            const player = mp.players.at(playerId);
            if (player && mp.players.exists(player)) {
                syncHUD(player);
            }
        }
    });
}, 30 * 1000);

// ── Cleanup on disconnect ─────────────────────────────────────────────────────

mp.events.add('playerQuit', (player) => {
    wantedPlayers.delete(player.id);
});

// ── Death event: clear NoS offenses ──────────────────────────────────────────

mp.events.add('playerDeath', (player) => {
    if (!player.logged) return;
    clearNoSOnDeath(player);
});

module.exports = {
    OFFENSES,
    applyOffense,
    clearOffense,
    clearAllWanted,
    clearNoSOnDeath,
    hasWanted,
    getWantedType,
    getWanted,
    syncHUD,
};