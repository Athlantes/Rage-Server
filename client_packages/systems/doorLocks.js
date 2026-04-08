const MAX_SEARCH_RADIUS = 25.0;
const APPLY_RADIUS = 120.0;
const LINK_GROUP_RADIUS = 3.4;
const MAX_GROUP_SIZE = 8;
const AIM_RAYCAST_DISTANCE = 12.0;
const STREAMED_OBJECT_FALLBACK_RADIUS = 4.0;

const SEARCH_OFFSETS = [
    [0.0, 0.0],
    [1.2, 0.0],
    [-1.2, 0.0],
    [0.0, 1.2],
    [0.0, -1.2],
    [2.4, 0.0],
    [-2.4, 0.0],
    [0.0, 2.4],
    [0.0, -2.4],
    [1.8, 1.8],
    [1.8, -1.8],
    [-1.8, 1.8],
    [-1.8, -1.8]
];

const DOOR_MODEL_NAMES = [
    // LSPD / public building doors
    'v_ilev_ph_door01',
    'v_ilev_ph_door002',
    'v_ilev_ph_door003',
    'v_ilev_ph_door004',
    'v_ilev_ph_gendoor002',
    'v_ilev_ph_gendoor004',
    'v_ilev_ph_gendoor005',
    'v_ilev_ph_cellgate',
    'v_ilev_ph_cellgate02',
    'v_ilev_ph_cellgate03',
    'v_ilev_shrfdoor',
    'v_ilev_rc_door2',
    'v_ilev_j2_door',
    'v_ilev_j3_door',
    'v_ilev_fa_frontdoor',
    'v_ilev_fh_frontdoor',
    'v_ilev_ta_door',
    'v_ilev_carmod3door',
    'v_ilev_bl_door_l',
    'v_ilev_bl_door_r',
    'v_ilev_lostdoor',
    'hei_v_ilev_lostdoor',
    'v_ilev_arm_secdoor',
    'v_ilev_cor_firedoor',
    'v_ilev_cd_door2',
    'v_ilev_cd_door3',
    'v_ilev_cd_door4',

    // Michael / house style doors and gates
    'v_ilev_mm_door',
    'v_ilev_mm_doorm_l',
    'v_ilev_mm_doorm_r',
    'v_ilev_housedoor1',
    'v_ilev_housedoor2',
    'v_ilev_housedoor3',
    'v_ilev_housedoor4',
    'prop_lrggate_01c_l',
    'prop_lrggate_01c_r',

    // Garage doors
    'v_ilev_garagdoor',
    'prop_com_gar_door_01',
    'prop_com_gar_door_02',
    'prop_com_gar_door_03',
    'prop_ld_garaged_01',
    'prop_ld_garaged_02',
    'prop_gar_door_01',
    'prop_gar_door_02',
    'prop_gar_door_03',
    'hei_prop_com_mp_gar2',
    'hei_prop_com_mp_gar2_l',
    'hei_prop_com_mp_gar2_r',
    'hei_prop_ss1_mpint_garage2',

    // Common city/prison/security gates
    'prop_gate_airport_01',
    'prop_gate_airport_01_r',
    'prop_gate_military_01',
    'prop_gate_prison_01',
    'prop_gate_prison_01_l',
    'prop_gate_prison_01_r',
    'prop_gate_farm_03',
    'prop_gate_farm_03_l',
    'prop_gate_farm_post',
    'prop_fnclink_03gate5',
    'prop_fnclink_03gate4',
    'prop_fnclink_02gate7',
    'prop_fnclink_02gate6',
    'prop_sec_gate_01b',
    'prop_sec_gate_01c',
    'prop_sec_gate_01d',
    'prop_lrggate_01',
    'prop_lrggate_03',
    'prop_lrggate_03b',

    // Bank/heist/security style doors
    'v_ilev_bank4door01',
    'v_ilev_bank4door02',
    'v_ilev_bank4door03',
    'v_ilev_bank4door04',
    'v_ilev_bank4door05',
    'v_ilev_bank4door06',
    'hei_prop_heist_sec_door',
    'hei_prop_station_gate',
    'hei_v_ilev_bk_gate2_pris',
    'hei_v_ilev_bk_gate_pris',
    'hei_v_ilev_bk_safegate_pris'
];

const DOOR_MODEL_HASHES = Array.from(new Set(DOOR_MODEL_NAMES.map((name) => mp.game.joaat(name))));
const lockedDoors = new Map();

function roundCoord(value) {
    return Number(parseFloat(value).toFixed(3));
}

function buildDoorKey(modelHash, x, y, z) {
    return `${modelHash}:${x.toFixed(3)}:${y.toFixed(3)}:${z.toFixed(3)}`;
}

function getDistance3D(ax, ay, az, bx, by, bz) {
    const dx = ax - bx;
    const dy = ay - by;
    const dz = az - bz;
    return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}

function clampRadius(value) {
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) return 8.0;
    return Math.min(MAX_SEARCH_RADIUS, Math.max(2.0, parsed));
}

function getModelHashFromHandle(handle) {
    if (!handle || handle === 0) return NaN;

    try {
        return parseInt(mp.game.invoke('0x9F47B058362C84B5', handle), 10); // GET_ENTITY_MODEL
    } catch (e) {
        return NaN;
    }
}

function rotationToDirection(rot) {
    const z = rot.z * (Math.PI / 180.0);
    const x = rot.x * (Math.PI / 180.0);
    const cosX = Math.abs(Math.cos(x));

    return {
        x: -Math.sin(z) * cosX,
        y: Math.cos(z) * cosX,
        z: Math.sin(x)
    };
}

function getAimedObjectDoor(localPlayer, maxDistance) {
    const camPos = mp.game.cam.getGameplayCoord();
    const camRot = mp.game.cam.getGameplayCamRot(2);
    const dir = rotationToDirection(camRot);

    const endPos = new mp.Vector3(
        camPos.x + (dir.x * maxDistance),
        camPos.y + (dir.y * maxDistance),
        camPos.z + (dir.z * maxDistance)
    );

    let raycast;
    try {
        raycast = mp.raycasting.testPointToPoint(camPos, endPos, [localPlayer], 17); // world + objects
    } catch (e) {
        return null;
    }

    if (!raycast || !raycast.entity) return null;

    const ent = raycast.entity;
    if (ent && ent.type && ent.type !== 'object') return null;

    const handle = (typeof ent.handle === 'number') ? ent.handle : ((typeof ent === 'number') ? ent : 0);
    if (!handle || handle === 0) return null;

    const modelHash = getModelHashFromHandle(handle);
    if (Number.isNaN(modelHash)) return null;

    const coords = mp.game.entity.getCoords(handle, true);
    if (!coords) return null;

    const distance = getDistance3D(
        localPlayer.position.x,
        localPlayer.position.y,
        localPlayer.position.z,
        coords.x,
        coords.y,
        coords.z
    );

    if (distance > (maxDistance + 1.0)) return null;

    return normalizeDoor(modelHash, coords.x, coords.y, coords.z, localPlayer.position);
}

function getNearestStreamedObjectDoor(position, radius) {
    if (!mp.objects || typeof mp.objects.forEachInStreamRange !== 'function') return null;

    let nearest = null;

    mp.objects.forEachInStreamRange((obj) => {
        if (!obj || !obj.handle || obj.handle === 0) return;

        const op = obj.position;
        if (!op) return;

        const distance = getDistance3D(position.x, position.y, position.z, op.x, op.y, op.z);
        if (distance > radius) return;

        const modelHash = getModelHashFromHandle(obj.handle);
        if (Number.isNaN(modelHash)) return;

        const candidate = normalizeDoor(modelHash, op.x, op.y, op.z, position);
        if (!nearest || candidate.distance < nearest.distance) {
            nearest = candidate;
        }
    });

    return nearest;
}

function normalizeDoor(modelHash, x, y, z, referencePos) {
    const rx = roundCoord(x);
    const ry = roundCoord(y);
    const rz = roundCoord(z);
    return {
        modelHash,
        x: rx,
        y: ry,
        z: rz,
        distance: getDistance3D(referencePos.x, referencePos.y, referencePos.z, rx, ry, rz)
    };
}

function addDoorCandidate(candidates, modelHash, coords, referencePos, maxDistance) {
    const normalized = normalizeDoor(modelHash, coords.x, coords.y, coords.z, referencePos);
    if (normalized.distance > (maxDistance + 0.2)) return;

    const key = buildDoorKey(normalized.modelHash, normalized.x, normalized.y, normalized.z);
    const existing = candidates.get(key);

    if (!existing || normalized.distance < existing.distance) {
        candidates.set(key, normalized);
    }
}

function collectDoorsAround(centerPos, radius, modelHashes = DOOR_MODEL_HASHES) {
    const candidates = new Map();

    for (const modelHash of modelHashes) {
        for (const offset of SEARCH_OFFSETS) {
            const sx = centerPos.x + offset[0];
            const sy = centerPos.y + offset[1];

            const handle = mp.game.object.getClosestObjectOfType(
                sx,
                sy,
                centerPos.z,
                radius,
                modelHash,
                false,
                false,
                false
            );

            if (!handle || handle === 0) continue;

            const coords = mp.game.entity.getCoords(handle, true);
            if (!coords) continue;

            addDoorCandidate(candidates, modelHash, coords, centerPos, radius);
        }
    }

    return Array.from(candidates.values()).sort((a, b) => a.distance - b.distance);
}

function findNearestDoor(position, radius) {
    const doors = collectDoorsAround(position, radius);
    return doors.length > 0 ? doors[0] : null;
}

function collectLinkedDoors(anchorDoor) {
    const center = { x: anchorDoor.x, y: anchorDoor.y, z: anchorDoor.z };
    const sameModelNearby = collectDoorsAround(center, LINK_GROUP_RADIUS, [anchorDoor.modelHash]);
    const knownDoorsNearby = collectDoorsAround(center, LINK_GROUP_RADIUS);
    const nearby = sameModelNearby.concat(knownDoorsNearby);

    const anchorKey = buildDoorKey(anchorDoor.modelHash, anchorDoor.x, anchorDoor.y, anchorDoor.z);
    const linked = [];
    const addedKeys = new Set();

    for (const door of nearby) {
        const key = buildDoorKey(door.modelHash, door.x, door.y, door.z);
        if (addedKeys.has(key)) continue;
        addedKeys.add(key);
        linked.push(door);
        if (linked.length >= MAX_GROUP_SIZE) break;
    }

    if (!addedKeys.has(anchorKey)) {
        linked.unshift({
            modelHash: anchorDoor.modelHash,
            x: anchorDoor.x,
            y: anchorDoor.y,
            z: anchorDoor.z,
            distance: 0.0
        });
    }

    return linked.slice(0, MAX_GROUP_SIZE);
}

function applyDoorState(modelHashRaw, xRaw, yRaw, zRaw, lockedRaw) {
    const modelHash = parseInt(modelHashRaw, 10);
    const x = roundCoord(xRaw);
    const y = roundCoord(yRaw);
    const z = roundCoord(zRaw);
    const locked = !!lockedRaw;

    if (Number.isNaN(modelHash) || Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) return;

    const key = buildDoorKey(modelHash, x, y, z);

    if (locked) {
        lockedDoors.set(key, { modelHash, x, y, z });
    } else {
        lockedDoors.delete(key);
    }

    mp.game.object.doorControl(modelHash, x, y, z, locked, 0.0, 0.0, 0.0);
}

mp.events.add('client:doorlock:toggleNearest', (radiusRaw) => {
    const localPlayer = mp.players.local;
    if (!localPlayer) return;

    const radius = clampRadius(radiusRaw);
    let nearest = findNearestDoor(localPlayer.position, radius);

    if (!nearest) {
        nearest = getAimedObjectDoor(localPlayer, Math.min(MAX_SEARCH_RADIUS, Math.max(AIM_RAYCAST_DISTANCE, radius + 2.0)));
    }

    if (!nearest) {
        nearest = getNearestStreamedObjectDoor(localPlayer.position, Math.min(STREAMED_OBJECT_FALLBACK_RADIUS, Math.max(2.5, radius)));
    }

    if (!nearest) {
        return mp.events.callRemote('server:doorlock:toggleNearestFailed', `No nearby door found. Try looking directly at the MLO door and run /lockdoor again.`);
    }

    const groupedDoors = collectLinkedDoors(nearest).map((door) => ({
        modelHash: door.modelHash,
        x: roundCoord(door.x),
        y: roundCoord(door.y),
        z: roundCoord(door.z),
        distance: Number(door.distance.toFixed(2))
    }));

    const payload = {
        radius: Number(radius.toFixed(2)),
        doors: groupedDoors
    };

    mp.events.callRemote('server:doorlock:toggleNearestBatch', JSON.stringify(payload));
});

mp.events.add('client:doorlock:setState', (modelHash, x, y, z, locked) => {
    applyDoorState(modelHash, x, y, z, locked);
});

mp.events.add('client:doorlock:syncAll', (payload) => {
    lockedDoors.clear();

    if (!payload) return;

    let data;
    try {
        data = JSON.parse(payload);
    } catch (e) {
        return;
    }

    if (!Array.isArray(data)) return;

    data.forEach((door) => {
        if (!door || !door.locked) return;
        applyDoorState(door.modelHash, door.x, door.y, door.z, true);
    });
});

setInterval(() => {
    const localPlayer = mp.players.local;
    if (!localPlayer) return;

    const p = localPlayer.position;
    lockedDoors.forEach((door) => {
        const distance = getDistance3D(p.x, p.y, p.z, door.x, door.y, door.z);
        if (distance <= APPLY_RADIUS) {
            mp.game.object.doorControl(door.modelHash, door.x, door.y, door.z, true, 0.0, 0.0, 0.0);
        }
    });
}, 250);
