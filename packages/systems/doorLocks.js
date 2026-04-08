const fs = require('fs');
const path = require('path');

const ADMIN_LEVEL_REQUIRED = 3;
const MAX_CLIENT_SEARCH_RADIUS = 25.0;
const LOCK_SYNC_DELAY_MS = 1500;
const MAX_BATCH_DOORS = 8;
const LINKED_DOOR_MAX_DISTANCE = 4.0;
const SAVE_DEBOUNCE_MS = 200;
const SAVE_FILE_PATH = path.join(__dirname, '../data/saved_doorlocks.json');

const lockedDoors = new Map();
let saveTimer = null;

function roundCoord(value) {
    return Number(parseFloat(value).toFixed(3));
}

function buildDoorKey(modelHash, x, y, z) {
    return `${modelHash}:${x.toFixed(3)}:${y.toFixed(3)}:${z.toFixed(3)}`;
}

function isAdmin(player) {
    return player && player.logged && (player.data.adminLevel || 0) >= ADMIN_LEVEL_REQUIRED;
}

function getDistance3D(ax, ay, az, bx, by, bz) {
    const dx = ax - bx;
    const dy = ay - by;
    const dz = az - bz;
    return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}

function sendDoorState(player, modelHash, x, y, z, locked) {
    if (!mp.players.exists(player)) return;
    player.call('client:doorlock:setState', [modelHash, x, y, z, locked]);
}

function broadcastDoorState(modelHash, x, y, z, locked) {
    mp.players.forEach((p) => {
        if (p.logged) sendDoorState(p, modelHash, x, y, z, locked);
    });
}

function sendAllLockedDoors(player) {
    if (!mp.players.exists(player)) return;
    const payload = JSON.stringify(Array.from(lockedDoors.values()));
    player.call('client:doorlock:syncAll', [payload]);
}

function persistLockedDoorsNow() {
    const payload = JSON.stringify(Array.from(lockedDoors.values()), null, 2);
    fs.writeFile(SAVE_FILE_PATH, payload, 'utf8', (err) => {
        if (err) {
            console.error('[DoorLock] Failed to persist door locks:', err);
        }
    });
}

function queuePersistLockedDoors() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveTimer = null;
        persistLockedDoorsNow();
    }, SAVE_DEBOUNCE_MS);
}

function loadPersistedDoorLocks() {
    if (!fs.existsSync(SAVE_FILE_PATH)) {
        console.log('[DoorLock] No persisted lock file found; starting empty.');
        return;
    }

    try {
        const raw = fs.readFileSync(SAVE_FILE_PATH, 'utf8');
        if (!raw || !raw.trim()) return;

        const data = JSON.parse(raw);
        if (!Array.isArray(data)) {
            console.warn('[DoorLock] Persisted lock file is not an array; ignoring.');
            return;
        }

        let loadedCount = 0;
        data.forEach((door) => {
            const modelHash = parseInt(door.modelHash, 10);
            const x = roundCoord(door.x);
            const y = roundCoord(door.y);
            const z = roundCoord(door.z);

            if (Number.isNaN(modelHash) || Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) return;

            const key = buildDoorKey(modelHash, x, y, z);
            if (lockedDoors.has(key)) return;

            lockedDoors.set(key, { modelHash, x, y, z, locked: true });
            loadedCount++;
        });

        console.log(`[DoorLock] Loaded ${loadedCount} persisted locked door(s).`);
    } catch (err) {
        console.error('[DoorLock] Failed to load persisted door locks:', err);
    }
}

function toggleDoorSet(player, doors) {
    if (!doors || doors.length === 0) {
        player.outputChatBox('!{FF0000}[DoorLock] No valid door data.');
        return;
    }

    const anchor = doors[0];
    const anchorKey = buildDoorKey(anchor.modelHash, anchor.x, anchor.y, anchor.z);
    const shouldLock = !lockedDoors.has(anchorKey);

    let affectedCount = 0;

    doors.forEach((door) => {
        const key = buildDoorKey(door.modelHash, door.x, door.y, door.z);

        if (shouldLock) {
            if (!lockedDoors.has(key)) affectedCount++;
            lockedDoors.set(key, { modelHash: door.modelHash, x: door.x, y: door.y, z: door.z, locked: true });
        } else {
            if (lockedDoors.has(key)) affectedCount++;
            lockedDoors.delete(key);
        }

        broadcastDoorState(door.modelHash, door.x, door.y, door.z, shouldLock);
    });

    queuePersistLockedDoors();

    player.outputChatBox(`!{00FF00}[DoorLock] ${shouldLock ? 'Locked' : 'Unlocked'} ${doors.length} door(s). (${affectedCount} changed)`);
}

mp.events.add('server:doorlock:toggleNearestResult', (player, modelHashRaw, xRaw, yRaw, zRaw, distanceRaw) => {
    if (!isAdmin(player)) return;

    const modelHash = parseInt(modelHashRaw, 10);
    const x = roundCoord(xRaw);
    const y = roundCoord(yRaw);
    const z = roundCoord(zRaw);
    const clientDistance = parseFloat(distanceRaw);

    if (Number.isNaN(modelHash) || Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
        return player.outputChatBox('!{FF0000}[DoorLock] Invalid door data received.');
    }

    if (!Number.isNaN(clientDistance) && clientDistance > (MAX_CLIENT_SEARCH_RADIUS + 1.0)) {
        return player.outputChatBox('!{FF0000}[DoorLock] Door is out of allowed range.');
    }

    const serverDistance = player.dist(new mp.Vector3(x, y, z));
    if (serverDistance > (MAX_CLIENT_SEARCH_RADIUS + 5.0)) {
        return player.outputChatBox('!{FF0000}[DoorLock] You are too far away from this door.');
    }

    toggleDoorSet(player, [{ modelHash, x, y, z, serverDistance }]);
});

mp.events.add('server:doorlock:toggleNearestBatch', (player, payloadJson) => {
    if (!isAdmin(player)) return;

    let payload;
    try {
        payload = JSON.parse(payloadJson);
    } catch (e) {
        return player.outputChatBox('!{FF0000}[DoorLock] Invalid door payload.');
    }

    if (!payload || !Array.isArray(payload.doors) || payload.doors.length === 0) {
        return player.outputChatBox('!{FF0000}[DoorLock] No door data received.');
    }

    const uniqueDoors = new Map();

    for (const rawDoor of payload.doors.slice(0, MAX_BATCH_DOORS)) {
        const modelHash = parseInt(rawDoor.modelHash, 10);
        const x = roundCoord(rawDoor.x);
        const y = roundCoord(rawDoor.y);
        const z = roundCoord(rawDoor.z);

        if (Number.isNaN(modelHash) || Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) continue;

        const serverDistance = player.dist(new mp.Vector3(x, y, z));
        if (serverDistance > (MAX_CLIENT_SEARCH_RADIUS + 6.0)) continue;

        const key = buildDoorKey(modelHash, x, y, z);
        if (uniqueDoors.has(key)) continue;

        uniqueDoors.set(key, { modelHash, x, y, z, serverDistance });
    }

    const doors = Array.from(uniqueDoors.values()).sort((a, b) => a.serverDistance - b.serverDistance);
    if (doors.length === 0) {
        return player.outputChatBox('!{FF0000}[DoorLock] No valid nearby doors in payload.');
    }

    const anchor = doors[0];
    const groupedDoors = doors.filter((door) => {
        const offsetDistance = getDistance3D(anchor.x, anchor.y, anchor.z, door.x, door.y, door.z);
        return offsetDistance <= (LINKED_DOOR_MAX_DISTANCE + 0.25);
    });

    toggleDoorSet(player, groupedDoors);
});

mp.events.add('server:doorlock:toggleNearestFailed', (player, reason) => {
    if (!isAdmin(player)) return;
    const cleanReason = (typeof reason === 'string' && reason.trim().length > 0)
        ? reason.trim()
        : 'No supported door/gate found nearby.';

    player.outputChatBox(`!{FF0000}[DoorLock] ${cleanReason}`);
});

mp.events.add('server:spawn:player', (player) => {
    setTimeout(() => {
        if (!mp.players.exists(player) || !player.logged) return;
        sendAllLockedDoors(player);
    }, LOCK_SYNC_DELAY_MS);
});

loadPersistedDoorLocks();

module.exports = {
    sendAllLockedDoors
};
