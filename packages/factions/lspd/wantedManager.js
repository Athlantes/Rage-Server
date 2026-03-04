// packages/factions/lspd/wantedManager.js
// ─────────────────────────────────────────────────────────────────────────────
// Wanted system with TWO states only:
//
//   RoS (Right of Surrender) — suspect can /surrender, then be /cuff'd
//   NoS (No Surrender)       — no surrender; dying clears NoS
//
// Officers give wanted via MDT dropdown (RoS only from MDT).
// Auto-applied:
//   • shooting_near_pd  (RoS) — shooting within 100m of on-duty officer
//   • assaulting_officer (NoS) — directly shooting an on-duty officer
// ─────────────────────────────────────────────────────────────────────────────

const db = require('../../core/database');
const dispatchManager = require('../dispatch/dispatchManager');

// ── Offense Registry ──────────────────────────────────────────────────────────
const OFFENSES = {
    // RoS — officers can assign via MDT
    speeding:              { label: 'Speeding',               type: 'RoS', duration: 5  * 60 },
    reckless_driving:      { label: 'Reckless Driving',       type: 'RoS', duration: 8  * 60 },
    trespassing:           { label: 'Trespassing',            type: 'RoS', duration: 6  * 60 },
    petty_theft:           { label: 'Petty Theft',            type: 'RoS', duration: 8  * 60 },
    drug_possession:       { label: 'Drug Possession',        type: 'RoS', duration: 10 * 60 },
    public_disturbance:    { label: 'Public Disturbance',     type: 'RoS', duration: 5  * 60 },
    robbery:               { label: 'Robbery',                type: 'RoS', duration: 12 * 60 },
    vehicle_theft:         { label: 'Vehicle Theft',          type: 'RoS', duration: 10 * 60 },
    // RoS — system-applied only
    shooting_near_pd:      { label: 'Shooting',               type: 'RoS', duration: 10 * 60 },
    // NoS — system-applied only
    assaulting_officer:    { label: 'Assaulting an Officer',  type: 'NoS', duration: 20 * 60 },
    murder:                { label: 'Murder',                 type: 'NoS', duration: 20 * 60 },
    armed_robbery:         { label: 'Armed Robbery',          type: 'NoS', duration: 15 * 60 },
};

// MDT dropdown list — RoS only, no system-only entries
const MDT_OFFENSES = Object.entries(OFFENSES)
    .filter(([key, v]) => v.type === 'RoS' && key !== 'shooting_near_pd')
    .map(([key, v]) => ({ key, label: v.label, duration: Math.floor(v.duration / 60) }));

// ── In-memory wanted state ────────────────────────────────────────────────────
const wantedPlayers = new Map();

// ── /so cooldown ──────────────────────────────────────────────────────────────
const stopOrderCooldowns = new Map();
const STOP_ORDER_COOLDOWN = 30 * 1000;

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
    let hasNoS = false, hasRoS = false;
    for (const entry of entries.values()) {
        if (entry.expiresAt <= now) continue;
        if (entry.type === 'NoS') hasNoS = true;
        else hasRoS = true;
    }
    if (hasNoS) return 'NoS';
    if (hasRoS) return 'RoS';
    return null;
}

function buildCooldownPayload(player) {
    const entries = getWanted(player);
    const now = Date.now();
    const payload = {};
    for (const [instanceKey, entry] of entries.entries()) {
        if (entry.expiresAt > now) payload[instanceKey] = entry.expiresAt;
    }
    return payload;
}

function syncHUD(player) {
    if (!mp.players.exists(player)) return;
    const wantedType = getWantedType(player);
    player.call('updateCooldowns', [JSON.stringify(buildCooldownPayload(player))]);
    player.call('client:lspd:updateWantedHUD', [wantedType]);
    player.setVariable('wantedType', wantedType);
}

function dist3(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function isOfficerOnDuty(player) {
    return player.logged && player.factionId === 2 && player.getVariable('factionDuty');
}

// ── Apply an offense ──────────────────────────────────────────────────────────

function applyOffense(suspect, offenseKey, officerId) {
    const offense = OFFENSES[offenseKey];
    if (!offense) {
        console.warn('[Wanted] Unknown offense key: ' + offenseKey);
        return false;
    }

    if (!wantedPlayers.has(suspect.id)) wantedPlayers.set(suspect.id, new Map());

    const entries = wantedPlayers.get(suspect.id);
    const now = Date.now();
    const expiresAt = now + offense.duration * 1000;

    entries.set(offenseKey, { offenseKey, expiresAt, type: offense.type, label: offense.label });
    syncHUD(suspect);

    const typeTag = offense.type === 'NoS'
        ? '!{#ff4757}[WANTED - NO SURRENDER]'
        : '!{#ffc300}[WANTED - SURRENDER]';

    suspect.outputChatBox(typeTag + ' !{#ffffff}You are wanted for: ' + offense.label + '.');
    if (offense.type === 'RoS') {
        suspect.outputChatBox('!{#ffc300}Use /surrender near a police officer to give yourself up.');
    }

    mp.players.forEach(p => {
        if (!isOfficerOnDuty(p)) return;
        const typeColor = offense.type === 'NoS' ? '!{#ff4757}' : '!{#ffc300}';
        p.outputChatBox('!{#00a8ff}[DISPATCH] !{#ffffff}' + suspect.name.replace(/_/g, ' ') + ' is wanted for: ' + typeColor + offense.label + ' !{#888888}(' + offense.type + ')');
    });

    console.log('[Wanted] ' + suspect.name + ' charged with ' + offenseKey + ' (' + offense.type + ') by officer ID ' + officerId);

    // --- NEW: Add a dispatch call so LSPD can track the suspect ---
    dispatchManager.addCall(2, {
        callerName: 'Warrant: ' + suspect.name.replace(/_/g, ' '),
        callerServerId: suspect.id,
        coords: suspect.position,
        location: offense.label, // Label replaces normal zone
        callType: 'Wanted',
        isWanted: true // Custom flag for dispatch manager
    });

    return true;
}

function clearOffense(suspect, offenseKey) {
    const entries = getWanted(suspect);
    for (const [instanceKey] of entries.entries()) {
        if (instanceKey === offenseKey || instanceKey.startsWith(offenseKey + '_')) {
            entries.delete(instanceKey);
        }
    }
    syncHUD(suspect);
}

function clearAllWanted(suspect, reason) {
    reason = reason || 'cleared';
    wantedPlayers.delete(suspect.id);
    if (mp.players.exists(suspect)) {
        syncHUD(suspect);
        suspect.outputChatBox('!{#2ecc71}[WANTED] Your wanted status has been cleared (' + reason + ').');
    }
}

function clearNoSOnDeath(suspect) {
    const entries = getWanted(suspect);
    if (!entries.size) return;
    let cleared = 0;
    for (const [instanceKey, entry] of entries.entries()) {
        if (entry.type === 'NoS') { entries.delete(instanceKey); cleared++; }
    }
    if (cleared > 0) {
        syncHUD(suspect);
        suspect.outputChatBox('!{#888888}[WANTED] Your NoS offenses were cleared by death.');
    }
}

// ── Expire timers ─────────────────────────────────────────────────────────────

setInterval(function() {
    var now = Date.now();
    wantedPlayers.forEach(function(entries, playerId) {
        var anyExpired = false;
        for (var _a = entries.entries(), _b = _a.next(); !_b.done; _b = _a.next()) {
            var pair = _b.value;
            var instanceKey = pair[0]; var entry = pair[1];
            if (entry.expiresAt <= now) {
                entries.delete(instanceKey);
                anyExpired = true;
                var player = mp.players.at(playerId);
                var playerDbId = (player && mp.players.exists(player)) ? (player.data && player.data.dbId) : null;
                (function(dbId, e) {
                    db.query(
                        'INSERT INTO wanted_history (user_id, offense_key, offense_label, type, outcome, created_at) VALUES (?, ?, ?, ?, \'escaped\', NOW())',
                        [dbId, e.offenseKey, e.label, e.type]
                    ).catch(function(err) { console.error('[Wanted] Failed to log escape:', err); });
                })(playerDbId, entry);
            }
        }
        if (anyExpired) {
            if (entries.size === 0) wantedPlayers.delete(playerId);
            var player = mp.players.at(playerId);
            if (player && mp.players.exists(player)) syncHUD(player);
        }
    });
}, 30 * 1000);

// ── MDT: Search Player ────────────────────────────────────────────────────────

mp.events.add('server:dispatch:searchPlayer', function(player, nameQuery) {
    if (player.factionId !== 2) return;
    if (!nameQuery) return player.call('client:dispatch:searchResult', [null]); // Add this safety check
    
    var target = null;
    var queryLower = nameQuery.toLowerCase();
    
    mp.players.forEach(function(p) {
        if (p.logged && p.name && p.name.toLowerCase().includes(queryLower)) target = p;
    });
    if (!target) return player.call('client:dispatch:searchResult', [null]);

    var entries = getWanted(target);
    var now = Date.now();
    var activeOffenses = [];
    entries.forEach(function(e) {
        if (e.expiresAt > now) activeOffenses.push({ key: e.offenseKey, label: e.label, type: e.type });
    });

    var profileData = {
        id: target.id,
        name: target.name.replace(/_/g, ' '),
        wantedType: getWantedType(target),
        offenses: activeOffenses,
        mdtOffenses: MDT_OFFENSES,
    };
    player.call('client:dispatch:searchResult', [JSON.stringify(profileData)]);
});

// ── MDT: Apply Wanted ────────────────────────────────────────────────────────

mp.events.add('server:dispatch:applyWanted', function(player, targetId, offenseKey) {
    if (player.factionId !== 2) return;

    var target = mp.players.at(parseInt(targetId));
    if (!target || !mp.players.exists(target)) {
        return player.outputChatBox('!{#ff4757}That player is no longer online.');
    }

    var offense = OFFENSES[offenseKey];
    if (!offense) return player.outputChatBox('!{#ff4757}Unknown offense: ' + offenseKey);
    if (offense.type === 'NoS') return player.outputChatBox('!{#ff4757}NoS offenses cannot be assigned via MDT.');

    var applied = applyOffense(target, offenseKey, player.id);
    if (applied) {
        player.outputChatBox('!{#2ecc71}[MDT] Wanted applied to ' + target.name.replace(/_/g, ' ') + ': ' + offense.label);
    }
});

// ── /so [id] — Stop Order ─────────────────────────────────────────────────────

mp.events.addCommand('so', function(officer, idStr) {
    if (!isOfficerOnDuty(officer)) return officer.outputChatBox('!{#ff4757}You must be on duty to use this.');

    var targetId = parseInt(idStr);
    if (isNaN(targetId)) return officer.outputChatBox('!{#ff4757}Usage: /so [player ID]');

    var target = mp.players.at(targetId);
    if (!target || !mp.players.exists(target) || !target.logged) {
        return officer.outputChatBox('!{#ff4757}Player not found.');
    }
    if (target.id === officer.id) return officer.outputChatBox('!{#ff4757}You cannot issue a stop order to yourself.');

    var lastUsed = stopOrderCooldowns.get(officer.id) || 0;
    var now = Date.now();
    var remaining = STOP_ORDER_COOLDOWN - (now - lastUsed);
    if (remaining > 0) {
        var secs = Math.ceil(remaining / 1000);
        return officer.outputChatBox('!{#ff4757}Stop order on cooldown. Wait ' + secs + 's.');
    }

    stopOrderCooldowns.set(officer.id, now);

    var officerName = officer.name.replace(/_/g, ' ');
    var targetName  = target.name.replace(/_/g, ' ');

    target.call('client:lspd:showStopOrder', [officerName]);
    officer.call('client:lspd:showStopOrderSent', [targetName]);
});

// ── Weapon shot near PD / shot at PD officer ───────────────────────────────────

var PD_SHOT_NEAR_RANGE = 100;

// Client relays playerWeaponShot via 'server:wanted:weaponShot'
// (RAGE MP only fires playerWeaponShot client-side, not server-side)
mp.events.add('server:wanted:weaponShot', function(player, targetPlayerId) {
    if (!player.logged) return;
    if (player.factionId === 2) return; // cops shooting is fine

    var shotAtOfficer = false;

    if (targetPlayerId !== -1) {
        var targetEntity = mp.players.at(parseInt(targetPlayerId));
        if (targetEntity && mp.players.exists(targetEntity) && isOfficerOnDuty(targetEntity)) {
            applyOffense(player, 'assaulting_officer', null);
            shotAtOfficer = true;
        }
    }

    if (!shotAtOfficer) {
        var nearOfficer = false;
        mp.players.forEach(function(p) {
            if (!isOfficerOnDuty(p)) return;
            if (dist3(p.position, player.position) <= PD_SHOT_NEAR_RANGE) nearOfficer = true;
        });
        if (nearOfficer) {
            applyOffense(player, 'shooting_near_pd', null);
        }
    }
});

// ── Cleanup ───────────────────────────────────────────────────────────────────

mp.events.add('playerQuit', function(player) {
    wantedPlayers.delete(player.id);
    stopOrderCooldowns.delete(player.id);
});

mp.events.add('playerDeath', function(player) {
    if (!player.logged) return;
    clearNoSOnDeath(player);
});

module.exports = {
    OFFENSES,
    MDT_OFFENSES,
    applyOffense,
    clearOffense,
    clearAllWanted,
    clearNoSOnDeath,
    hasWanted,
    getWantedType,
    getWanted,
    syncHUD,
};