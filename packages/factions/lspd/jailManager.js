// packages/factions/lspd/jailManager.js
// Shared jail placement + sentence timer logic used by LSPD and down-state handlers.

const db = require('../../core/database');

const PRISON_DIMENSION_BASE = 60000;
const JAIL_COOLDOWN_KEY = 'jail';
const JAIL_REMAINING_KEY = '__jail_remaining_ms';
const DEFAULT_SENTENCE_MINUTES = 10;
const MIN_SENTENCE_MINUTES = 1;
const MAX_SENTENCE_MINUTES = 120;
const HUD_SYNC_INTERVAL_MS = 5000;

const RELEASE_POINT = { x: 1852.12, y: 2585.91, z: 45.67, h: 270.0 };

const CELL_SPAWN_POINTS = [
    { x: 1741.90, y: 2489.52, z: 49.24, h: -147.13 },
    { x: 1747.70, y: 2493.19, z: 49.24, h: -147.10 },
    { x: 1752.71, y: 2496.48, z: 49.24, h: -141.51 },
    { x: 1758.34, y: 2499.60, z: 49.24, h: -145.40 },
];

function clampSentenceMinutes(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_SENTENCE_MINUTES;
    return Math.max(MIN_SENTENCE_MINUTES, Math.min(MAX_SENTENCE_MINUTES, Math.ceil(parsed)));
}

function getCooldownStore(player) {
    if (!player || !player.data) return {};
    if (!player.data.cooldowns || typeof player.data.cooldowns !== 'object') {
        player.data.cooldowns = {};
    }
    return player.data.cooldowns;
}

function getStoredRemainingMs(player) {
    const cooldowns = getCooldownStore(player);
    const stored = Number(cooldowns[JAIL_REMAINING_KEY]);
    return Number.isFinite(stored) && stored > 0 ? Math.ceil(stored) : 0;
}

function restoreJailExpiryFromStoredRemaining(player) {
    if (!player || !mp.players.exists(player)) return 0;

    const cooldowns = getCooldownStore(player);
    const storedRemaining = getStoredRemainingMs(player);
    if (storedRemaining <= 0) return 0;

    const nextExpiry = Date.now() + storedRemaining;
    cooldowns[JAIL_COOLDOWN_KEY] = nextExpiry;
    delete cooldowns[JAIL_REMAINING_KEY];

    player.setVariable('cooldown_' + JAIL_COOLDOWN_KEY, nextExpiry);
    syncCooldownHud(player);
    persistCooldownStore(player);

    return storedRemaining;
}

function snapshotJailRemaining(player, persistNow) {
    if (!player || !mp.players.exists(player)) return 0;

    const cooldowns = getCooldownStore(player);
    const expiry = Number(cooldowns[JAIL_COOLDOWN_KEY]);
    const now = Date.now();
    const remainingMs = (Number.isFinite(expiry) && expiry > now) ? (expiry - now) : 0;

    if (remainingMs > 0) {
        cooldowns[JAIL_REMAINING_KEY] = Math.ceil(remainingMs);
    } else {
        delete cooldowns[JAIL_REMAINING_KEY];
    }

    if (persistNow) {
        persistCooldownStore(player);
    }

    return Math.ceil(remainingMs);
}

function buildClientCooldownPayload(player) {
    const cooldowns = getCooldownStore(player);
    const now = Date.now();
    const payload = {};

    Object.keys(cooldowns).forEach(function(key) {
        const expiry = Number(cooldowns[key]);
        if (Number.isFinite(expiry) && expiry > now) {
            payload[key] = expiry;
        }
    });

    return payload;
}

function syncCooldownHud(player) {
    if (!player || !mp.players.exists(player)) return;
    player.call('updateCooldowns', [JSON.stringify(buildClientCooldownPayload(player))]);
}

function persistCooldownStore(player) {
    if (!player || !player.data || !player.data.dbId) return;
    db.query('UPDATE users SET cooldowns = ? WHERE id = ?', [JSON.stringify(getCooldownStore(player)), player.data.dbId])
        .catch(function(err) {
            console.error('[Jail] Failed to persist cooldown store:', err);
        });
}

function getJailExpiry(player) {
    restoreJailExpiryFromStoredRemaining(player);
    const cooldowns = getCooldownStore(player);
    const expiry = Number(cooldowns[JAIL_COOLDOWN_KEY]);
    return Number.isFinite(expiry) ? expiry : 0;
}

function getRemainingJailSeconds(player) {
    const expiry = getJailExpiry(player);
    if (!expiry) return 0;
    const remainingMs = expiry - Date.now();
    if (remainingMs <= 0) return 0;
    return Math.ceil(remainingMs / 1000);
}

function getRecommendedSentenceMinutes(player, fallbackMinutes) {
    const cooldowns = getCooldownStore(player);
    const now = Date.now();

    const wantedNoS = Number(cooldowns.wanted_nos);
    const wantedRoS = Number(cooldowns.wanted_ros);
    let bestExpiry = 0;

    if (Number.isFinite(wantedNoS) && wantedNoS > now) bestExpiry = Math.max(bestExpiry, wantedNoS);
    if (Number.isFinite(wantedRoS) && wantedRoS > now) bestExpiry = Math.max(bestExpiry, wantedRoS);

    if (bestExpiry > now) {
        return clampSentenceMinutes(Math.ceil((bestExpiry - now) / 60000));
    }

    return clampSentenceMinutes(fallbackMinutes || DEFAULT_SENTENCE_MINUTES);
}

function setJailSentence(player, minutes, options = {}) {
    if (!player || !mp.players.exists(player)) return 0;

    const cooldowns = getCooldownStore(player);
    const now = Date.now();
    const requestedExpiry = now + (clampSentenceMinutes(minutes) * 60000);
    const currentExpiry = Number(cooldowns[JAIL_COOLDOWN_KEY]);

    let nextExpiry = requestedExpiry;
    if (options.keepLonger !== false && Number.isFinite(currentExpiry) && currentExpiry > now) {
        nextExpiry = Math.max(requestedExpiry, currentExpiry);
    }

    cooldowns[JAIL_COOLDOWN_KEY] = nextExpiry;
    delete cooldowns[JAIL_REMAINING_KEY];
    player.setVariable('cooldown_' + JAIL_COOLDOWN_KEY, nextExpiry);
    syncCooldownHud(player);
    persistCooldownStore(player);

    return nextExpiry;
}

function clearJailSentence(player) {
    if (!player || !mp.players.exists(player)) return;

    const cooldowns = getCooldownStore(player);
    if (cooldowns[JAIL_COOLDOWN_KEY] === undefined && cooldowns[JAIL_REMAINING_KEY] === undefined) return;

    delete cooldowns[JAIL_COOLDOWN_KEY];
    delete cooldowns[JAIL_REMAINING_KEY];
    player.setVariable('cooldown_' + JAIL_COOLDOWN_KEY, null);
    syncCooldownHud(player);
    persistCooldownStore(player);
}

function getPrisonDimension(player) {
    return PRISON_DIMENSION_BASE;
}

function getRandomCellSpawn() {
    const idx = Math.floor(Math.random() * CELL_SPAWN_POINTS.length);
    return CELL_SPAWN_POINTS[idx];
}

function isInPrison(player) {
    if (!player || !mp.players.exists(player)) return false;
    return Number(player.dimension) === getPrisonDimension(player);
}

function sendToPrison(player, options = {}) {
    if (!player || !mp.players.exists(player) || !player.logged) return null;

    const remainingSeconds = getRemainingJailSeconds(player);
    const fallbackMinutes = remainingSeconds > 0
        ? Math.ceil(remainingSeconds / 60)
        : getRecommendedSentenceMinutes(player, DEFAULT_SENTENCE_MINUTES);
    const sentenceMinutes = Number.isFinite(Number(options.durationMinutes))
        ? clampSentenceMinutes(options.durationMinutes)
        : fallbackMinutes;

    if (options.setCooldown !== false) {
        setJailSentence(player, sentenceMinutes, { keepLonger: options.keepLonger !== false });
    }

    const spawn = getRandomCellSpawn();
    const dimension = getPrisonDimension(player);
    const pos = new mp.Vector3(spawn.x, spawn.y, spawn.z);

    if (options.clearClientRestraints !== false) {
        player.call('client:lspd:ejectAndTeleport', [spawn.x, spawn.y, spawn.z]);
    }

    const shouldRespawn = !!options.forceRespawn || player.health <= 0;

    if (shouldRespawn) {
        player.spawn(pos);
        if (player.health < 100) player.health = 100;
        
        // Delay dimension to prevent RageMP's implicit spawn dimension reset
        setTimeout(() => {
            if (mp.players.exists(player)) {
                player.dimension = dimension;
            }
        }, 150);
    } else {
        try {
            if (player.vehicle) player.removeFromVehicle();
        } catch (e) {}
        player.position = pos;
    }

    player.dimension = dimension;
    if (typeof spawn.h === 'number') player.heading = spawn.h;

    return { dimension, spawn, sentenceMinutes };
}

function releaseFromPrison(player, options = {}) {
    if (!player || !mp.players.exists(player) || !player.logged) return null;

    if (options.keepCooldown !== true) {
        clearJailSentence(player);
    }

    const outPos = new mp.Vector3(RELEASE_POINT.x, RELEASE_POINT.y, RELEASE_POINT.z);

    if (options.clearClientRestraints !== false) {
        player.call('client:lspd:ejectAndTeleport', [RELEASE_POINT.x, RELEASE_POINT.y, RELEASE_POINT.z]);
    }

    const shouldRespawn = !!options.forceRespawn || player.health <= 0;
    if (shouldRespawn) {
        player.spawn(outPos);
        if (player.health < 100) player.health = 100;
        
        setTimeout(() => {
            if (mp.players.exists(player)) {
                player.dimension = 0;
            }
        }, 150);
    } else {
        try {
            if (player.vehicle) player.removeFromVehicle();
        } catch (e) {}
        player.position = outPos;
    }

    player.dimension = 0;
    player.heading = RELEASE_POINT.h;
    player.setVariable('cuffed', false);

    if (options.notify !== false) {
        player.outputChatBox('!{#2ecc71}[JAIL] !{#ffffff}Your sentence is complete. You were released at the prison gate.');
    }

    return { released: true, position: RELEASE_POINT };
}

function ensurePrisonState(player) {
    if (!player || !mp.players.exists(player) || !player.logged) return;

    const remainingSeconds = getRemainingJailSeconds(player);
    if (remainingSeconds > 0) {
        // Re-apply dimension and variables forcefully so fast reconnects don't desync
        if (player.data.cooldowns && player.data.cooldowns[JAIL_COOLDOWN_KEY]) {
            player.setVariable('cooldown_' + JAIL_COOLDOWN_KEY, player.data.cooldowns[JAIL_COOLDOWN_KEY]);
        }
        syncCooldownHud(player);
        
        if (!isInPrison(player)) {
            sendToPrison(player, {
                setCooldown: false,
                keepLonger: true,
                clearClientRestraints: false,
                forceRespawn: false,
            });
        } else {
            // Force dimension anyway, RageMP sometimes breaks it on late client loads
            player.dimension = getPrisonDimension(player);
        }
        return;
    }

    if (getJailExpiry(player) > 0) {
        clearJailSentence(player);
    }

    if (isInPrison(player)) {
        releaseFromPrison(player, {
            notify: false,
            clearClientRestraints: false,
            forceRespawn: false,
        });
    }
}

setInterval(function() {
    const now = Date.now();

    mp.players.forEach(function(player) {
        if (!player.logged) return;

        const expiry = getJailExpiry(player);
        if (!expiry) return;

        if (expiry > now) {
            if (!player.data.__lastJailHudSyncAt || (now - player.data.__lastJailHudSyncAt) >= HUD_SYNC_INTERVAL_MS) {
                syncCooldownHud(player);
                snapshotJailRemaining(player, true);
                player.data.__lastJailHudSyncAt = now;
            }

            if (!isInPrison(player)) {
                sendToPrison(player, {
                    setCooldown: false,
                    keepLonger: true,
                    clearClientRestraints: false,
                    forceRespawn: false,
                });
            }
            return;
        }

        releaseFromPrison(player, {
            notify: true,
            clearClientRestraints: false,
            forceRespawn: false,
        });
    });
}, 1000);

mp.events.add('playerQuit', function(player) {
    if (!player || !player.logged) return;

    const remainingMs = snapshotJailRemaining(player, false);
    if (remainingMs > 0 || getStoredRemainingMs(player) > 0) {
        persistCooldownStore(player);
    }
});

mp.events.add('server:loadAccount', function(player) {
    setTimeout(function() {
        ensurePrisonState(player);
    }, 500);
});

mp.events.add('server:spawn:player', function(player) {
    setTimeout(function() {
        ensurePrisonState(player);
    }, 250);
});

module.exports = {
    CELL_SPAWN_POINTS,
    JAIL_COOLDOWN_KEY,
    JAIL_REMAINING_KEY,
    getPrisonDimension,
    isInPrison,
    getRemainingJailSeconds,
    getRecommendedSentenceMinutes,
    sendToPrison,
    releaseFromPrison,
};
