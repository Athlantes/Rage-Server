// packages/factions/lspd/wantedManager.js
const db = require('../../core/database');
const dispatchManager = require('../dispatch/dispatchManager');
const webServer = require('../../webserver');

const OFFENSES = {
    speeding:              { label: 'Speeding',               type: 'RoS', duration: 5  * 60, fine: 400  },
    reckless_driving:      { label: 'Reckless Driving',       type: 'RoS', duration: 8  * 60, fine: 850  },
    trespassing:           { label: 'Trespassing',            type: 'RoS', duration: 6  * 60, fine: 600  },
    petty_theft:           { label: 'Petty Theft',            type: 'RoS', duration: 8  * 60, fine: 1200 },
    drug_possession:       { label: 'Drug Possession',        type: 'RoS', duration: 10 * 60, fine: 1800 },
    public_disturbance:    { label: 'Public Disturbance',     type: 'RoS', duration: 5  * 60, fine: 500  },
    robbery:               { label: 'Robbery',                type: 'RoS', duration: 12 * 60, fine: 2500 },
    vehicle_theft:         { label: 'Vehicle Theft',          type: 'RoS', duration: 10 * 60, fine: 2200 },
    shooting_near_pd:      { label: 'Shooting',               type: 'RoS', duration: 10 * 60, fine: 2000 },
    assaulting_officer:    { label: 'Assaulting an Officer',  type: 'NoS', duration: 20 * 60, fine: 0    },
    murder:                { label: 'Murder',                 type: 'NoS', duration: 20 * 60, fine: 0    },
    armed_robbery:         { label: 'Armed Robbery',          type: 'NoS', duration: 15 * 60, fine: 0    },
};

const RECENT_SO_WINDOW_SEC = 15 * 60;
const RECENT_FRISK_WINDOW_SEC = 15 * 60;

const MDT_OFFENSES = Object.entries(OFFENSES)
    .filter(([key, v]) => v.type === 'RoS' && key !== 'shooting_near_pd')
    .map(([key, v]) => ({ key, label: v.label, duration: Math.floor(v.duration / 60) }));

const wantedPlayers = new Map();
const stopOrderCooldowns = new Map();
const STOP_ORDER_COOLDOWN = 30 * 1000;
const WANTED_PERSIST_KEY = '__wanted_entries';
const wantedReconnectCache = new Map();

function getWanted(player) {
    return wantedPlayers.get(player.id) || new Map();
}

function getKnownOffenseKey(rawKey) {
    const key = String(rawKey || '').trim();
    if (!key) return null;
    if (OFFENSES[key]) return key;

    let probe = key;
    while (probe.includes('_')) {
        probe = probe.slice(0, probe.lastIndexOf('_'));
        if (OFFENSES[probe]) return probe;
    }

    return null;
}

function parseWantedEntries(rawWanted, nowTs) {
    const now = Number.isFinite(nowTs) ? nowTs : Date.now();
    const parsed = new Map();

    if (!rawWanted || typeof rawWanted !== 'object') return parsed;

    Object.keys(rawWanted).forEach(function(instanceKey) {
        const saved = rawWanted[instanceKey];

        let offenseKeyRaw = instanceKey;
        let expiresAt = 0;
        let explicitType = null;
        let explicitLabel = null;

        if (saved && typeof saved === 'object') {
            offenseKeyRaw = String(saved.offenseKey || saved.key || instanceKey);

            if (saved.expiresAt !== undefined) {
                expiresAt = Number(saved.expiresAt);
            } else if (saved.expiry !== undefined) {
                expiresAt = Number(saved.expiry);
            } else if (saved.until !== undefined) {
                expiresAt = Number(saved.until);
            } else if (saved.endsAt !== undefined) {
                expiresAt = Number(saved.endsAt);
            }

            if (saved.type === 'NoS' || saved.type === 'RoS') {
                explicitType = saved.type;
            }

            if (saved.label !== undefined && saved.label !== null) {
                explicitLabel = String(saved.label);
            }
        } else {
            expiresAt = Number(saved);
        }

        if (!Number.isFinite(expiresAt) || expiresAt <= now) return;

        const knownOffenseKey = getKnownOffenseKey(offenseKeyRaw);
        const offense = knownOffenseKey ? OFFENSES[knownOffenseKey] : null;
        const type = explicitType || (offense ? offense.type : null);

        if (type !== 'NoS' && type !== 'RoS') return;

        parsed.set(instanceKey, {
            offenseKey: knownOffenseKey || offenseKeyRaw,
            expiresAt: expiresAt,
            type: type,
            label: explicitLabel || (offense ? offense.label : (type === 'NoS' ? 'NoS Warrant' : 'RoS Warrant')),
        });
    });

    return parsed;
}

function buildWantedEntriesFromTimers(cooldowns, nowTs) {
    const now = Number.isFinite(nowTs) ? nowTs : Date.now();
    const parsed = new Map();

    if (!cooldowns || typeof cooldowns !== 'object') return parsed;

    const noS = Number(cooldowns.wanted_nos);
    if (Number.isFinite(noS) && noS > now) {
        parsed.set('wanted_nos_timer', {
            offenseKey: 'legacy_wanted_nos',
            expiresAt: noS,
            type: 'NoS',
            label: 'NoS Warrant',
        });
    }

    const roS = Number(cooldowns.wanted_ros);
    if (Number.isFinite(roS) && roS > now) {
        parsed.set('wanted_ros_timer', {
            offenseKey: 'legacy_wanted_ros',
            expiresAt: roS,
            type: 'RoS',
            label: 'RoS Warrant',
        });
    }

    return parsed;
}

function setReconnectCache(player, rawWantedEntries) {
    if (!player || !player.data || !player.data.dbId) return;

    const cacheKey = String(player.data.dbId);
    if (!rawWantedEntries || typeof rawWantedEntries !== 'object') {
        wantedReconnectCache.delete(cacheKey);
        return;
    }

    const keys = Object.keys(rawWantedEntries);
    if (!keys.length) {
        wantedReconnectCache.delete(cacheKey);
        return;
    }

    let maxExpiresAt = 0;
    keys.forEach(function(instanceKey) {
        const entry = rawWantedEntries[instanceKey];
        const exp = Number(entry && entry.expiresAt);
        if (Number.isFinite(exp) && exp > maxExpiresAt) {
            maxExpiresAt = exp;
        }
    });

    const snapshot = JSON.parse(JSON.stringify(rawWantedEntries));
    wantedReconnectCache.set(cacheKey, {
        raw: snapshot,
        maxExpiresAt: maxExpiresAt,
    });
}

function getReconnectCache(player) {
    if (!player || !player.data || !player.data.dbId) return null;

    const cacheKey = String(player.data.dbId);
    const cached = wantedReconnectCache.get(cacheKey);
    if (!cached) return null;

    if (!cached.maxExpiresAt || cached.maxExpiresAt <= Date.now()) {
        wantedReconnectCache.delete(cacheKey);
        return null;
    }

    return cached.raw;
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

function getCooldownStore(player) {
    if (!player || !player.data) return {};
    if (!player.data.cooldowns || typeof player.data.cooldowns !== 'object') {
        player.data.cooldowns = {};
    }
    return player.data.cooldowns;
}

function saveCooldownStore(player) {
    if (!player || !player.data || !player.data.dbId) return;
    db.query('UPDATE users SET cooldowns = ? WHERE id = ?', [JSON.stringify(getCooldownStore(player)), player.data.dbId])
        .catch(function(err) {
            console.error('[Wanted] Failed to persist cooldown store:', err);
        });
}

function parseCooldownJson(rawCooldowns) {
    if (!rawCooldowns) return {};
    if (typeof rawCooldowns === 'string') {
        try {
            const parsed = JSON.parse(rawCooldowns);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
            return {};
        }
    }
    if (typeof rawCooldowns === 'object') return rawCooldowns;
    return {};
}

async function loadCooldownStoreFromDb(player) {
    if (!player || !player.data || !player.data.dbId) return null;
    try {
        const result = await db.query('SELECT cooldowns FROM users WHERE id = ? LIMIT 1', [player.data.dbId]);
        const rows = result && result[0] ? result[0] : [];
        if (!rows[0]) return null;
        return parseCooldownJson(rows[0].cooldowns);
    } catch (err) {
        console.error('[Wanted] Failed to load cooldown store from DB:', err);
        return null;
    }
}

function buildClientCooldownPayload(player) {
    const payload = {};
    const now = Date.now();
    const cooldowns = getCooldownStore(player);

    Object.keys(cooldowns).forEach(function(key) {
        if (key === WANTED_PERSIST_KEY) return;
        const expiry = Number(cooldowns[key]);
        if (Number.isFinite(expiry) && expiry > now) {
            payload[key] = expiry;
        }
    });

    const wantedPayload = buildCooldownPayload(player);
    if (wantedPayload.wanted_nos) payload.wanted_nos = wantedPayload.wanted_nos;
    if (wantedPayload.wanted_ros) payload.wanted_ros = wantedPayload.wanted_ros;

    return payload;
}

function persistWantedState(player) {
    if (!player || !player.data || !player.data.dbId) return;

    const now = Date.now();
    const entries = getWanted(player);
    const cooldowns = getCooldownStore(player);
    let storedSnapshot = null;

    if (entries.size > 0) {
        const stored = {};
        entries.forEach(function(entry, instanceKey) {
            if (!entry || entry.expiresAt <= now) return;
            stored[instanceKey] = {
                offenseKey: entry.offenseKey,
                expiresAt: entry.expiresAt,
                type: entry.type,
            };
        });

        if (Object.keys(stored).length > 0) {
            cooldowns[WANTED_PERSIST_KEY] = stored;
            storedSnapshot = stored;
        } else {
            delete cooldowns[WANTED_PERSIST_KEY];
        }
    } else {
        delete cooldowns[WANTED_PERSIST_KEY];
    }

    delete cooldowns.wanted_ros;
    delete cooldowns.wanted_nos;
    const wantedPayload = buildCooldownPayload(player);
    if (wantedPayload.wanted_nos) cooldowns.wanted_nos = wantedPayload.wanted_nos;
    if (wantedPayload.wanted_ros) cooldowns.wanted_ros = wantedPayload.wanted_ros;

    setReconnectCache(player, storedSnapshot);

    saveCooldownStore(player);
}

async function restoreWantedState(player) {
    if (!player || !mp.players.exists(player) || !player.logged) return;

    const previousEntries = getWanted(player);
    const hadWantedBefore = previousEntries.size > 0;

    let cooldowns = getCooldownStore(player);
    const now = Date.now();

    const localRaw = cooldowns[WANTED_PERSIST_KEY];
    let restoredEntries = parseWantedEntries(localRaw, now);

    // Re-read cooldowns from DB when auth loaded stale data during a quick reconnect.
    if (restoredEntries.size === 0) {
        const freshCooldowns = await loadCooldownStoreFromDb(player);
        if (freshCooldowns && typeof freshCooldowns === 'object') {
            player.data.cooldowns = freshCooldowns;
            cooldowns = getCooldownStore(player);
            restoredEntries = parseWantedEntries(cooldowns[WANTED_PERSIST_KEY], now);
        }
    }

    // In-memory handoff for very fast reconnects where DB write is delayed.
    if (restoredEntries.size === 0) {
        restoredEntries = parseWantedEntries(getReconnectCache(player), now);
    }

    // Last fallback for legacy states that only have wanted_nos/wanted_ros timestamps.
    if (restoredEntries.size === 0) {
        restoredEntries = buildWantedEntriesFromTimers(cooldowns, now);
    }

    if (restoredEntries.size > 0) {
        wantedPlayers.set(player.id, restoredEntries);
    } else {
        wantedPlayers.delete(player.id);
    }

    // Avoid writing an empty wanted snapshot when we do not have a persisted source.
    if (restoredEntries.size > 0 || hadWantedBefore || (localRaw && typeof localRaw === 'object')) {
        persistWantedState(player);
    }

    syncHUD(player);
}

function buildCooldownPayload(player) {
    const entries = getWanted(player);
    const now = Date.now();
    const payload = {};
    let maxRoS = 0;
    let maxNoS = 0;

    for (const entry of entries.values()) {
        if (entry.expiresAt > now) {
            if (entry.type === 'NoS') {
                if (entry.expiresAt > maxNoS) maxNoS = entry.expiresAt;
            } else {
                if (entry.expiresAt > maxRoS) maxRoS = entry.expiresAt;
            }
        }
    }

    if (maxNoS > now) {
        payload['wanted_nos'] = maxNoS;
    } else if (maxRoS > now) {
        payload['wanted_ros'] = maxRoS;
    }

    return payload;
}

function syncHUD(player) {
    if (!mp.players.exists(player)) return;
    const wantedType = getWantedType(player);
    player.call('updateCooldowns', [JSON.stringify(buildClientCooldownPayload(player))]);
    player.setVariable('wantedType', wantedType);
}

function dist3(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function isOfficerOnDuty(player) {
    return player.logged && player.factionId === 2 && player.getVariable('factionDuty');
}

function formatSeconds(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    if (mins <= 0) return secs + 's';
    return mins + 'm ' + secs + 's';
}

function getActiveOffenseDetails(player) {
    const entries = getWanted(player);
    const now = Date.now();
    const active = [];

    entries.forEach(function(entry) {
        if (entry.expiresAt <= now) return;
        const remainingSec = Math.ceil((entry.expiresAt - now) / 1000);
        active.push({
            key: entry.offenseKey,
            label: entry.label,
            type: entry.type,
            remainingSec: remainingSec,
            timeText: formatSeconds(remainingSec)
        });
    });

    active.sort(function(a, b) { return b.remainingSec - a.remainingSec; });
    return active;
}

function getWantedTimeText(activeOffenses) {
    if (!activeOffenses || !activeOffenses.length) return 'None';
    const longest = activeOffenses.reduce(function(max, e) {
        return Math.max(max, Number(e.remainingSec) || 0);
    }, 0);
    return formatSeconds(longest);
}

function getPlayerMugshotUrl(player) {
    const shot = player && player.data ? player.data.mugshot : null;
    if (!shot) return null;
    return (webServer && webServer.mugshotsUrl ? webServer.mugshotsUrl : '') + shot;
}

async function getActiveFeeSummary(userId) {
    if (!userId) return { count: 0, total: 0 };
    try {
        const result = await db.query(
            'SELECT COUNT(*) AS feeCount, COALESCE(SUM(amount), 0) AS feeTotal FROM lspd_active_fees WHERE user_id = ? AND settled = 0',
            [userId]
        );
        const rows = result && result[0] ? result[0] : [];
        const row = rows[0] || null;
        return {
            count: row ? Number(row.feeCount) || 0 : 0,
            total: row ? Number(row.feeTotal) || 0 : 0
        };
    } catch (e) {
        if (String(e && e.code || '').toUpperCase() !== 'ER_NO_SUCH_TABLE') {
            console.error('[MDT] Failed loading active fee summary:', e);
        }
        return { count: 0, total: 0 };
    }
}

async function getRecentStopOrder(userId) {
    if (!userId) return null;
    try {
        const result = await db.query(
            'SELECT officer_name, TIMESTAMPDIFF(SECOND, issued_at, NOW()) AS ageSec FROM lspd_stop_orders WHERE target_user_id = ? ORDER BY issued_at DESC LIMIT 1',
            [userId]
        );
        const rows = result && result[0] ? result[0] : [];
        return rows[0] || null;
    } catch (e) {
        if (String(e && e.code || '').toUpperCase() !== 'ER_NO_SUCH_TABLE') {
            console.error('[MDT] Failed loading stop order info:', e);
        }
        return null;
    }
}

async function getRecentFrisk(userId) {
    if (!userId) return null;
    try {
        const result = await db.query(
            'SELECT officer_name, TIMESTAMPDIFF(SECOND, created_at, NOW()) AS ageSec FROM lspd_frisk_logs WHERE target_user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId]
        );
        const rows = result && result[0] ? result[0] : [];
        return rows[0] || null;
    } catch (e) {
        if (String(e && e.code || '').toUpperCase() !== 'ER_NO_SUCH_TABLE') {
            console.error('[MDT] Failed loading frisk info:', e);
        }
        return null;
    }
}

async function buildMdtProfileData(target) {
    const activeOffenses = getActiveOffenseDetails(target);
    const wantedType = getWantedType(target);
    const isWanted = !!wantedType;

    const userId = target && target.data ? target.data.dbId : null;
    const feeSummary = await getActiveFeeSummary(userId);
    const recentStopOrder = await getRecentStopOrder(userId);
    const recentFrisk = await getRecentFrisk(userId);

    const soAge = recentStopOrder ? Number(recentStopOrder.ageSec) || 0 : null;
    const friskAge = recentFrisk ? Number(recentFrisk.ageSec) || 0 : null;
    const soRecent = soAge !== null && soAge <= RECENT_SO_WINDOW_SEC;
    const friskRecent = friskAge !== null && friskAge <= RECENT_FRISK_WINDOW_SEC;

    return {
        id: target.id,
        name: target.name.replace(/_/g, ' '),
        mugshotUrl: getPlayerMugshotUrl(target),

        isWanted: isWanted,
        wantedType: wantedType,
        wantedTimeText: isWanted ? getWantedTimeText(activeOffenses) : 'None',
        offenses: activeOffenses,

        activeFeesCount: feeSummary.count,
        activeFeesTotal: feeSummary.total,

        recentStopOrder: soRecent,
        recentStopOrderText: soRecent
            ? ('Yes - ' + formatSeconds(soAge) + ' ago by ' + (recentStopOrder.officer_name || 'Unknown'))
            : (recentStopOrder ? ('No - last ' + formatSeconds(soAge) + ' ago') : 'No'),

        recentFrisk: friskRecent,
        recentFriskText: friskRecent
            ? ('Yes - ' + formatSeconds(friskAge) + ' ago by ' + (recentFrisk.officer_name || 'Unknown'))
            : (recentFrisk ? ('No - last ' + formatSeconds(friskAge) + ' ago') : 'No'),

        mdtOffenses: MDT_OFFENSES,
    };
}

function clearWantedDispatch(suspectId) {
    if (dispatchManager.calls.has(2)) {
        const calls = dispatchManager.calls.get(2);
        for (const [callId, call] of calls.entries()) {
            if (call.isWanted && call.callerServerId === suspectId) {
                calls.delete(callId);
            }
        }
        dispatchManager._broadcastToFaction(2);
    }
    dispatchManager.activeAssignments.forEach((assignment, driverId) => {
        if (assignment.factionId === 2 && assignment.callerServerId === suspectId && assignment.isWanted) {
            dispatchManager.cancelAssignment(driverId, 'Suspect wanted status cleared.');
        }
    });
}

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
    persistWantedState(suspect);
    syncHUD(suspect);

    const typeTag = offense.type === 'NoS' ? '!{#ff4757}[WANTED - NO SURRENDER]' : '!{#ffc300}[WANTED - SURRENDER]';
    suspect.outputChatBox(typeTag + ' !{#ffffff}You are wanted for: ' + offense.label + '.');

    if (offense.type === 'RoS') {
        suspect.outputChatBox('!{#ffc300}Stop at a police station. An officer will approach to arrest you.');
    }

    mp.players.forEach(p => {
        if (!isOfficerOnDuty(p)) return;
        const typeColor = offense.type === 'NoS' ? '!{#ff4757}' : '!{#ffc300}';
        p.outputChatBox('!{#00a8ff}[DISPATCH] !{#ffffff}' + suspect.name.replace(/_/g, ' ') + ' is wanted for: ' + typeColor + offense.label + ' !{#888888}(' + offense.type + ')');
    });

    console.log('[Wanted] ' + suspect.name + ' charged with ' + offenseKey + ' (' + offense.type + ') by officer ID ' + officerId);

    let hasCall = false;
    if (dispatchManager.calls.has(2)) {
        for (const call of dispatchManager.calls.get(2).values()) {
            if (call.isWanted && call.callerServerId === suspect.id) {
                hasCall = true; break;
            }
        }
    }
    
    if (!hasCall) {
        dispatchManager.addCall(2, {
            callerName: 'Warrant: ' + suspect.name.replace(/_/g, ' '),
            callerServerId: suspect.id,
            coords: suspect.position,
            location: offense.label,
            callType: 'Wanted',
            isWanted: true
        });
    }

    return true;
}

function clearOffense(suspect, offenseKey) {
    const entries = getWanted(suspect);
    for (const [instanceKey] of entries.entries()) {
        if (instanceKey === offenseKey || instanceKey.startsWith(offenseKey + '_')) {
            entries.delete(instanceKey);
        }
    }
    if (entries.size === 0) {
        wantedPlayers.delete(suspect.id);
        clearWantedDispatch(suspect.id);
    }
    persistWantedState(suspect);
    syncHUD(suspect);
}

function clearAllWanted(suspect, reason) {
    reason = reason || 'cleared';
    wantedPlayers.delete(suspect.id);
    if (mp.players.exists(suspect)) {
        persistWantedState(suspect);
        syncHUD(suspect);
        suspect.outputChatBox('!{#2ecc71}[WANTED] Your wanted status has been cleared (' + reason + ').');
    }
    clearWantedDispatch(suspect.id);
}

function clearNoSOnDeath(suspect) {
    const entries = getWanted(suspect);
    if (!entries.size) return;
    let cleared = 0;
    for (const [instanceKey, entry] of entries.entries()) {
        if (entry.type === 'NoS') { entries.delete(instanceKey); cleared++; }
    }
    if (cleared > 0) {
        if (entries.size === 0) {
            wantedPlayers.delete(suspect.id);
            clearWantedDispatch(suspect.id);
        }
        persistWantedState(suspect);
        syncHUD(suspect);
        suspect.outputChatBox('!{#888888}[WANTED] Your NoS offenses were cleared by death.');
    }
}

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
            if (entries.size === 0) {
                wantedPlayers.delete(playerId);
                clearWantedDispatch(playerId);
            }
            var player = mp.players.at(playerId);
            if (player && mp.players.exists(player)) {
                persistWantedState(player);
                syncHUD(player);
            }
        }
    });
}, 30 * 1000);

setInterval(function() {
    const now = Date.now();
    wantedReconnectCache.forEach(function(cached, cacheKey) {
        if (!cached || !cached.maxExpiresAt || cached.maxExpiresAt <= now) {
            wantedReconnectCache.delete(cacheKey);
        }
    });
}, 60 * 1000);

mp.events.add('server:dispatch:searchPlayer', function(player, nameQuery) {
    if (player.factionId !== 2) return;

    var query = String(nameQuery || '').trim().toLowerCase();
    if (!query || query.length < 2) {
        return player.call('client:dispatch:searchResult', [JSON.stringify({ query: query, players: [] })]);
    }

    var matches = [];
    mp.players.forEach(function(p) {
        if (!p.logged || !p.name) return;
        if (!p.name.toLowerCase().includes(query)) return;
        matches.push({
            id: p.id,
            name: p.name.replace(/_/g, ' '),
            wantedType: getWantedType(p)
        });
    });

    matches.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });

    player.call('client:dispatch:searchResult', [JSON.stringify({
        query: query,
        players: matches.slice(0, 40)
    })]);
});

mp.events.add('server:dispatch:getPlayerProfile', async function(player, targetIdRaw) {
    if (player.factionId !== 2) return;

    var targetId = parseInt(targetIdRaw, 10);
    if (isNaN(targetId)) {
        return player.call('client:dispatch:profileResult', [null]);
    }

    var target = mp.players.at(targetId);
    if (!target || !mp.players.exists(target) || !target.logged) {
        return player.call('client:dispatch:profileResult', [null]);
    }

    var profileData = await buildMdtProfileData(target);
    player.call('client:dispatch:profileResult', [JSON.stringify(profileData)]);
});

mp.events.add('server:dispatch:applyWanted', function(player, targetId, offenseKey) {
    if (player.factionId !== 2) return;

    var target = mp.players.at(parseInt(targetId, 10));
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

mp.events.addCommand('so', async function(officer, idStr) {
    if (!isOfficerOnDuty(officer)) return officer.outputChatBox('!{#ff4757}You must be on duty to use this.');

    var targetId = parseInt(idStr, 10);
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

    db.query(
        'INSERT INTO lspd_stop_orders (officer_id, officer_name, target_user_id, target_name, issued_at) VALUES (?, ?, ?, ?, NOW())',
        [officer.data && officer.data.dbId ? officer.data.dbId : null, officerName, target.data && target.data.dbId ? target.data.dbId : null, targetName]
    ).catch(function(err) {
        if (String(err && err.code || '').toUpperCase() !== 'ER_NO_SUCH_TABLE') {
            console.error('[LSPD] Failed to log /so command:', err);
        }
    });
});

mp.events.addCommand('frisk', function(officer, idStr) {
    if (!isOfficerOnDuty(officer)) return officer.outputChatBox('!{#ff4757}You must be on duty to use this.');

    var targetId = parseInt(idStr, 10);
    if (isNaN(targetId)) return officer.outputChatBox('!{#ff4757}Usage: /frisk [player ID]');

    var target = mp.players.at(targetId);
    if (!target || !mp.players.exists(target) || !target.logged) {
        return officer.outputChatBox('!{#ff4757}Player not found.');
    }
    if (target.id === officer.id) return officer.outputChatBox('!{#ff4757}You cannot frisk yourself.');

    if (dist3(officer.position, target.position) > 3.0) {
        return officer.outputChatBox('!{#ff4757}Get closer to frisk this player (3.0m).');
    }

    var officerName = officer.name.replace(/_/g, ' ');
    var targetName = target.name.replace(/_/g, ' ');

    officer.outputChatBox('!{#2ecc71}[LSPD] You frisked ' + targetName + '.');
    target.outputChatBox('!{#ffc300}[LSPD] You were frisked by ' + officerName + '.');

    db.query(
        'INSERT INTO lspd_frisk_logs (officer_id, officer_name, target_user_id, target_name, notes, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [officer.data && officer.data.dbId ? officer.data.dbId : null, officerName, target.data && target.data.dbId ? target.data.dbId : null, targetName, 'manual frisk']
    ).catch(function(err) {
        if (String(err && err.code || '').toUpperCase() !== 'ER_NO_SUCH_TABLE') {
            console.error('[LSPD] Failed to log /frisk command:', err);
        }
    });
});

var PD_SHOT_NEAR_RANGE = 100;

mp.events.add('server:wanted:weaponShot', function(player, targetPlayerId) {
    if (!player.logged) return;
    if (player.factionId === 2) return; 

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

mp.events.add('playerQuit', function(player) {
    persistWantedState(player);
    wantedPlayers.delete(player.id);
    stopOrderCooldowns.delete(player.id);
    clearWantedDispatch(player.id);
});

mp.events.add('wanted:restoreState', function(player) {
    if (!player || !mp.players.exists(player) || !player.logged) return;
    restoreWantedState(player).catch(function(err) {
        console.error('[Wanted] Restore state failed:', err);
    });
});

mp.events.add('server:spawn:player', function(player) {
    if (!player || !mp.players.exists(player) || !player.logged) return;
    restoreWantedState(player).catch(function(err) {
        console.error('[Wanted] Spawn restore failed:', err);
    });
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