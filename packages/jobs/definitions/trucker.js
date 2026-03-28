const fs = require('fs');
const path = require('path');

const FACILITIES_FILE = path.join(__dirname, '../../data/truckerFacilities.json');
let facilities = [];
const activeSessions = new Map();

// Load Database
function loadFacilities() {
    if (fs.existsSync(FACILITIES_FILE)) {
        facilities = JSON.parse(fs.readFileSync(FACILITIES_FILE, 'utf8'));
        console.log(`[Trucker] Loaded ${facilities.length} dynamic facilities.`);
    } else {
        console.log(`[Trucker] Error: Facilities file not found at ${FACILITIES_FILE}`);
    }
}
loadFacilities();

function calcDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Procedural Route Generator
function generateContracts(playerLevel, startFacilityId) {
    const contracts = [];
    const numContracts = Math.floor(Math.random() * 6) + 10; // 10 to 15 jobs
    
    const startFacility = facilities.find(f => f.id === startFacilityId) || facilities.find(f => f.isMainDepot);
    const possibleDests = facilities.filter(f => f.id !== startFacility.id);

    if (possibleDests.length === 0) return [];

    for (let i = 0; i < numContracts; i++) {
        // Random level requirement up to the player's current level
        const jobLevel = Math.floor(Math.random() * playerLevel) + 1;
        const isTrailerJob = jobLevel >= 20;
        const type = isTrailerJob ? 'trailer' : 'boxTruck';

        const destFacility = possibleDests[Math.floor(Math.random() * possibleDests.length)];
        
        // Grab random nodes (prevents players from getting the exact same spot if you have multiple defined)
        const pickupNodes = startFacility.pickups[type];
        const dropoffNodes = destFacility.dropoffs[type];

        if (!pickupNodes || pickupNodes.length === 0 || !dropoffNodes || dropoffNodes.length === 0) continue;

        const pickupNode = pickupNodes[Math.floor(Math.random() * pickupNodes.length)];
        const dropoffNode = dropoffNodes[Math.floor(Math.random() * dropoffNodes.length)];

        const distKm = (calcDistance(pickupNode, dropoffNode) / 1000).toFixed(2);
        
        // Dynamic Payout: $150 per km + $10 base per required level
        const payout = Math.floor((parseFloat(distKm) * 150) + (jobLevel * 10));

        contracts.push({
            id: `contract_${Date.now()}_${i}`,
            title: `${startFacility.name} to ${destFacility.name}`,
            levelReq: jobLevel,
            type: type,
            distance: distKm,
            pay: payout,
            pickup: pickupNode,
            dropoff: dropoffNode,
            vehicleModel: isTrailerJob ? 'phantom' : 'benson',
            trailerModel: isTrailerJob ? 'trailers2' : null
        });
    }
    // Sort from lowest level to highest
    return contracts.sort((a, b) => a.levelReq - b.levelReq);
}

// Client requests the menu
mp.events.add('server:trucker:requestMenu', (player) => {
    // Default to level 25 for testing if they don't have a variable saved
    const pLevel = player.getVariable('truckerLvl') || 25; 
    let currentFacilityId = player.getVariable('currentTruckFacility') || 'ls_depot';

    const generatedRoutes = generateContracts(pLevel, currentFacilityId);
    player.call('client:trucker:showMenu', [JSON.stringify(generatedRoutes)]);
});

// Client selects a job
mp.events.add('server:trucker:selectContract', (player, contractJson) => {
    const contract = JSON.parse(contractJson);
    const startFacility = facilities.find(f => f.name === contract.title.split(' to ')[0]);

    // Clean up old session if exists
    if (activeSessions.has(player.id)) {
        const old = activeSessions.get(player.id);
        if (old.cab && mp.vehicles.exists(old.cab)) old.cab.destroy();
        if (old.trailer && mp.vehicles.exists(old.trailer)) old.trailer.destroy();
    }

    let spawnNode = startFacility && startFacility.truckSpawns.length > 0 
        ? startFacility.truckSpawns[Math.floor(Math.random() * startFacility.truckSpawns.length)] 
        : player.position; 

    // Spawn Cab
    const cab = mp.vehicles.new(mp.joaat(contract.vehicleModel), new mp.Vector3(spawnNode.x, spawnNode.y, spawnNode.z), {
        heading: spawnNode.h || 0,
        dimension: player.dimension
    });
    
    player.putIntoVehicle(cab, -1);

    const session = { contract, cab, trailer: null, stage: 'pickup' };

    // Spawn Trailer if Lvl 20+
    if (contract.type === 'trailer') {
        const trailer = mp.vehicles.new(mp.joaat(contract.trailerModel), new mp.Vector3(contract.pickup.x, contract.pickup.y, contract.pickup.z), {
            heading: contract.pickup.h || 0,
            dimension: player.dimension
        });
        session.trailer = trailer;
        player.outputChatBox(`!{00FF00}[Dispatch] !{FFFFFF}Cab ready. Hook up your trailer at the loading bay.`);
    } else {
        player.outputChatBox(`!{00FF00}[Dispatch] !{FFFFFF}Box truck ready. Drive to the loading bay.`);
    }

    activeSessions.set(player.id, session);
    player.call('client:trucker:startJob', [JSON.stringify(contract)]);
});

// Finish Job Event
mp.events.add('server:trucker:finishJob', (player) => {
    if (!activeSessions.has(player.id)) return;
    
    const session = activeSessions.get(player.id);
    const pay = session.contract.pay;

    // Destroy trailer, keep cab for next job
    if (session.trailer && mp.vehicles.exists(session.trailer)) {
        session.trailer.destroy();
    }
    
    // Give money/XP (Replace with your actual economy framework calls)
    player.outputChatBox(`!{00FF00}[Dispatch] !{FFFFFF}Delivery complete. Earned $${pay}.`);
    // Example: player.setVariable('money', player.getVariable('money') + pay);
    
    // Save their new location so next menu generates from here
    const destFacility = facilities.find(f => f.name === session.contract.title.split(' to ')[1]);
    if (destFacility) {
        player.setVariable('currentTruckFacility', destFacility.id);
    }

    activeSessions.delete(player.id);
});

// --- ADMIN EVENTS ROUTED FROM COMMANDS.JS ---

mp.events.add('server:trucker:admin:addfacility', (player, id, name) => {
    // Check if ID already exists
    if (facilities.some(f => f.id === id)) {
        return player.outputChatBox('!{FF0000}[Error] A facility with that ID already exists.');
    }

    facilities.push({
        id: id,
        name: name,
        isMainDepot: false, // Default to false, edit JSON manually if making a new Main Depot
        truckSpawns: [],
        pickups: { boxTruck: [], trailer: [] },
        dropoffs: { boxTruck: [], trailer: [] }
    });
    
    fs.writeFileSync(FACILITIES_FILE, JSON.stringify(facilities, null, 2));
    player.outputChatBox(`!{00FF00}[Trucker] Facility '${name}' (ID: ${id}) created successfully.`);
});

mp.events.add('server:trucker:admin:addnode', (player, facilityId, nodeType, vehType) => {
    const facility = facilities.find(f => f.id === facilityId);
    if (!facility) return player.outputChatBox('!{FF0000}[Error] Facility ID not found.');

    // Capture exact position and heading
    const pos = {
        x: parseFloat(player.position.x.toFixed(2)),
        y: parseFloat(player.position.y.toFixed(2)),
        z: parseFloat(player.position.z.toFixed(2)),
        h: parseFloat(player.heading.toFixed(2))
    };

    if (nodeType === 'spawn') {
        facility.truckSpawns.push(pos);
        player.outputChatBox(`!{00FF00}[Trucker] Saved Truck Spawn node for ${facility.name}.`);
    } 
    else if (nodeType === 'pickup' || nodeType === 'dropoff') {
        // Map friendly command names to JSON array names
        const actualType = nodeType === 'pickup' ? 'pickups' : 'dropoffs';
        const actualVeh = vehType === 'box' ? 'boxTruck' : (vehType === 'trailer' ? 'trailer' : null);

        if (!actualVeh) {
            return player.outputChatBox('!{FF0000}[Error] You must specify vehicle type: "box" or "trailer".');
        }

        facility[actualType][actualVeh].push(pos);
        player.outputChatBox(`!{00FF00}[Trucker] Saved ${actualVeh} ${nodeType} node for ${facility.name}.`);
    } 
    else {
        return player.outputChatBox('!{FF0000}[Error] Invalid node type. Use spawn, pickup, or dropoff.');
    }

    // Save to database instantly
    fs.writeFileSync(FACILITIES_FILE, JSON.stringify(facilities, null, 2));
});