const fs = require('fs');
const path = require('path');
const playerManager = require('../../core/playerManager');
const jobManager = require('../jobManager');

const FACILITIES_FILE = path.join(__dirname, '../../data/truckerFacilities.json');
let facilities = [];
const activeSessions = new Map();

// ─── Load Facilities ───────────────────────────────────────────────────────
function loadFacilities() {
    if (fs.existsSync(FACILITIES_FILE)) {
        facilities = JSON.parse(fs.readFileSync(FACILITIES_FILE, 'utf8'));
        console.log(`[Trucker] Loaded ${facilities.length} facilities.`);
    } else {
        console.log(`[Trucker] ERROR: Facilities file not found at ${FACILITIES_FILE}`);
    }
}
loadFacilities();

// ─── Helpers ───────────────────────────────────────────────────────────────
function calcDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x, dy = pos1.y - pos2.y, dz = pos1.z - pos2.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

function getFacilityById(id) {
    return facilities.find(f => f.id === id) || null;
}

function getMainDepot() {
    return facilities.find(f => f.isMainDepot) || facilities[0] || null;
}

// ─── Vehicle Tiers ─────────────────────────────────────────────────────────
const MAX_TRUCKER_LEVEL = 50;

function getVehicleTier(level) {
    if (level >= 35) return { vehicleModel: 'phantom', trailerModel: 'trailers2', type: 'trailer' };
    if (level >= 20) return { vehicleModel: 'packer',  trailerModel: 'trailers2', type: 'trailer' };
    if (level >= 10) return { vehicleModel: 'hauler',  trailerModel: 'trailers2', type: 'trailer' };
                     return { vehicleModel: 'pounder', trailerModel: null,        type: 'boxTruck' };
}

// ─── Contract Generator ────────────────────────────────────────────────────
function generateContracts(playerLevel, startFacilityId) {
    const contracts = [];
    const numContracts = Math.floor(Math.random() * 6) + 10;
    const effectiveLevel = Math.min(playerLevel, MAX_TRUCKER_LEVEL);

    const startFacility = getFacilityById(startFacilityId) || getMainDepot();
    if (!startFacility) return [];

    const possibleDests = facilities.filter(f => f.id !== startFacility.id);
    if (possibleDests.length === 0) return [];

    for (let i = 0; i < numContracts; i++) {
        const jobLevel = Math.floor(Math.random() * effectiveLevel) + 1;
        const { vehicleModel, trailerModel, type } = getVehicleTier(jobLevel);

        const destFacility = possibleDests[Math.floor(Math.random() * possibleDests.length)];
        const pickupNodes  = startFacility.pickups[type];
        const dropoffNodes = destFacility.dropoffs[type];

        if (!pickupNodes || pickupNodes.length === 0 || !dropoffNodes || dropoffNodes.length === 0) continue;

        const pickupNode  = pickupNodes[Math.floor(Math.random() * pickupNodes.length)];
        const dropoffNode = dropoffNodes[Math.floor(Math.random() * dropoffNodes.length)];

        const distKm = (calcDistance(pickupNode, dropoffNode) / 1000).toFixed(2);
        const payout = Math.floor((parseFloat(distKm) * 150) + (jobLevel * 10));

        contracts.push({
            id:           `contract_${Date.now()}_${i}`,
            title:        `${startFacility.name} to ${destFacility.name}`,
            // Store IDs separately — never parse the title string
            originId:     startFacility.id,
            destId:       destFacility.id,
            levelReq:     jobLevel,
            type,
            distance:     distKm,
            pay:          payout,
            pickup:       pickupNode,
            dropoff:      dropoffNode,
            vehicleModel,
            trailerModel,
        });
    }
    return contracts.sort((a, b) => a.levelReq - b.levelReq);
}

// ─── Events ────────────────────────────────────────────────────────────────

mp.events.add('server:trucker:requestMenu', (player) => {
    const pLevel          = jobManager.getJobLevel(player, 'trucker') || 1;
    const currentFacId    = player.getVariable('currentTruckFacility') || getMainDepot()?.id || 'ls_depot';
    const routes          = generateContracts(pLevel, currentFacId);
    player.call('client:trucker:showMenu', [JSON.stringify(routes)]);
});

mp.events.add('server:trucker:selectContract', (player, contractJson) => {
    const contract = JSON.parse(contractJson);

    // Clean up old session
    if (activeSessions.has(player.id)) {
        const old = activeSessions.get(player.id);
        if (old.cab     && mp.vehicles.exists(old.cab))     old.cab.destroy();
        if (old.trailer && mp.vehicles.exists(old.trailer)) old.trailer.destroy();
        activeSessions.delete(player.id);
    }

    const originFacility = getFacilityById(contract.originId) || getMainDepot();
    const spawns = originFacility?.truckSpawns?.length > 0 ? originFacility.truckSpawns : null;
    const spawnNode = spawns
        ? spawns[Math.floor(Math.random() * spawns.length)]
        : { x: player.position.x, y: player.position.y, z: player.position.z, h: player.heading };

    const cab = mp.vehicles.new(
        mp.joaat(contract.vehicleModel),
        new mp.Vector3(spawnNode.x, spawnNode.y, spawnNode.z),
        { heading: spawnNode.h || 0, dimension: player.dimension }
    );
    cab.setVariable('fuel', 100);
    cab.jobOwner = player.id;

    setTimeout(() => {
        if (mp.players.exists(player) && mp.vehicles.exists(cab)) {
            player.putIntoVehicle(cab, 0);
        }
    }, 200);

    const session = { contract, cab, trailer: null, stage: 'pickup', trailerHooked: false };

    if (contract.type === 'trailer') {
        const trailer = mp.vehicles.new(
            mp.joaat(contract.trailerModel),
            new mp.Vector3(contract.pickup.x, contract.pickup.y, contract.pickup.z),
            { heading: contract.pickup.h || 0, dimension: player.dimension }
        );
        session.trailer = trailer;
        player.outputChatBox('!{00FF00}[Dispatch] !{FFFFFF}Cab ready. Drive to the loading bay and hook up your trailer.');
    } else {
        player.outputChatBox('!{00FF00}[Dispatch] !{FFFFFF}Box truck ready. Head to the loading bay to pick up your cargo.');
    }

    activeSessions.set(player.id, session);
    player.call('client:trucker:startJob', [JSON.stringify(contract)]);
});

// Client confirms trailer is attached (or box truck reached pickup)
mp.events.add('server:trucker:trailerHooked', (player) => {
    if (!activeSessions.has(player.id)) return;
    const session = activeSessions.get(player.id);
    if (session.stage !== 'pickup') return;

    if (session.contract.type === 'trailer') {
        if (!session.trailer || !mp.vehicles.exists(session.trailer)) {
            player.outputChatBox('!{FF0000}[Dispatch] !{FFFFFF}Trailer not found — contact an admin.');
            return;
        }
        session.trailerHooked = true;
        console.log(`[Trucker] ${player.name} hooked trailer successfully.`);
    }

    session.stage = 'dropoff';
    player.call('client:trucker:advanceToDropoff', [JSON.stringify(session.contract)]);
    player.outputChatBox('!{00FF00}[Dispatch] !{FFFFFF}Cargo loaded. Deliver to the dropoff point.');
});

mp.events.add('server:trucker:finishJob', async (player) => {
    if (!activeSessions.has(player.id)) return;
    const session  = activeSessions.get(player.id);
    const contract = session.contract;
    if (!contract) return;

    // Trailer jobs must have been through the hookup
    if (contract.type === 'trailer' && session.stage !== 'dropoff') {
        player.outputChatBox('!{FF0000}[Dispatch] !{FFFFFF}You haven\'t hooked up your trailer yet!');
        return;
    }

    const pay      = contract.pay;
    const xpGained = Math.floor(10 + (parseFloat(contract.distance) * 5));

    await playerManager.addMoneyAndSave(player, pay, `Trucking: ${contract.title}`);
    await jobManager.addJobXp(player, 'trucker', xpGained);

    player.outputChatBox('!{00FF00}[Dispatch] !{FFFFFF}Delivery complete! Great work.');
    player.call('client:showJobSubtitle',  [`+$${pay} | +${xpGained} XP`]);
    player.call('showNotification', ['Logistics', `Earned $${pay} for the delivery.`]);

    // Destroy trailer, keep cab
    if (session.trailer && mp.vehicles.exists(session.trailer)) {
        session.trailer.destroy();
        session.trailer = null;
    }

    // Continuous routing — open next board from destination
    const destFacility = getFacilityById(contract.destId);
    if (destFacility) {
        player.setVariable('currentTruckFacility', destFacility.id);
        const pLevel     = jobManager.getJobLevel(player, 'trucker') || 1;
        const nextRoutes = generateContracts(pLevel, destFacility.id);
        setTimeout(() => {
            if (mp.players.exists(player)) {
                player.call('client:trucker:showMenu', [JSON.stringify(nextRoutes)]);
            }
        }, 1500);
    }

    session.contract      = null;
    session.stage         = 'idle';
    session.trailer       = null;
    session.trailerHooked = false;
});

mp.events.add('server:trucker:quitJob', (player) => {
    if (!activeSessions.has(player.id)) return;
    const session = activeSessions.get(player.id);
    if (session.cab     && mp.vehicles.exists(session.cab))     session.cab.destroy();
    if (session.trailer && mp.vehicles.exists(session.trailer)) session.trailer.destroy();
    activeSessions.delete(player.id);
    player.setVariable('currentTruckFacility', null);
    player.outputChatBox('!{FF0000}[Dispatch] !{FFFFFF}Job session ended.');
});

// ─── Admin ─────────────────────────────────────────────────────────────────

mp.events.add('server:trucker:admin:addfacility', (player, id, name) => {
    if (facilities.some(f => f.id === id))
        return player.outputChatBox('!{FF0000}[Error] Facility ID already exists.');
    facilities.push({ id, name, isMainDepot: false, truckSpawns: [],
        pickups: { boxTruck: [], trailer: [] }, dropoffs: { boxTruck: [], trailer: [] } });
    fs.writeFileSync(FACILITIES_FILE, JSON.stringify(facilities, null, 2));
    player.outputChatBox(`!{00FF00}[Trucker] Facility '${name}' (ID: ${id}) created.`);
});

mp.events.add('server:trucker:admin:addnode', (player, facilityId, nodeType, vehType) => {
    const facility = facilities.find(f => f.id === facilityId);
    if (!facility) return player.outputChatBox('!{FF0000}[Error] Facility not found.');
    const pos = {
        x: parseFloat(player.position.x.toFixed(2)),
        y: parseFloat(player.position.y.toFixed(2)),
        z: parseFloat(player.position.z.toFixed(2)),
        h: parseFloat(player.heading.toFixed(2)),
    };
    if (nodeType === 'spawn') {
        facility.truckSpawns.push(pos);
        player.outputChatBox(`!{00FF00}[Trucker] Spawn saved for ${facility.name}.`);
    } else if (nodeType === 'pickup' || nodeType === 'dropoff') {
        const arrKey = nodeType === 'pickup' ? 'pickups' : 'dropoffs';
        const vehKey = vehType === 'box' ? 'boxTruck' : vehType === 'trailer' ? 'trailer' : null;
        if (!vehKey) return player.outputChatBox('!{FF0000}[Error] Specify "box" or "trailer".');
        facility[arrKey][vehKey].push(pos);
        player.outputChatBox(`!{00FF00}[Trucker] ${vehKey} ${nodeType} saved for ${facility.name}.`);
    } else {
        return player.outputChatBox('!{FF0000}[Error] Use: spawn, pickup, or dropoff.');
    }
    fs.writeFileSync(FACILITIES_FILE, JSON.stringify(facilities, null, 2));
});

// ─── Register with jobManager ───────────────────────────────────────────────
// Registers the trucker job so it appears in the playerMenu jobs panel and
// so job skill XP tracking (character_job_skills) works correctly.
// The trucker job manages its own NPC/blip/interaction loop independently —
// this registration is minimal (no pos, no colshape).
const jobManager_reg = require('../jobManager');
jobManager_reg.register('trucker', {
    name:        'Trucker',
    description: 'Haul freight across the state. Pick up contracts at the dispatch board, hook up your trailer, and deliver to depots for big payouts.',
    previewButtons: [],   // Trucker opens its own board — no standard preview needed
    pedModel:    null,    // NPC managed by client_packages/jobs/trucker.js
    blipSprite:  null,
    pos:         null,    // No colshape — interaction is the E-key + proximity check
}, {
    onStart: () => {},
    onStop:  () => {},
});