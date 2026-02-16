const db = require('../core/database');

// --- CONFIGURATION ---
const INTERIORS = {
    "motel": { x: 151.45, y: -1007.57, z: -99.00 },
    "low_end": { x: 266.00, y: -1007.00, z: -101.00 },
    "medium": { x: 346.52, y: -1012.42, z: -99.20 },
    "modern": { x: -786.86, y: 315.76, z: 217.63 },
    "luxury": { x: -1459.17, y: -520.58, z: 56.92 }
};

let houses = [];

// --- HELPER ---
function calculateDistance(v1, v2) {
    const dx = v1.x - v2.x;
    const dy = v1.y - v2.y;
    const dz = v1.z - v2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// --- LOAD HOUSES ---
async function loadHouses() {
    try {
        const [rows] = await db.query("SELECT * FROM houses");
        houses = []; 
        rows.forEach(row => {
            createHouseEntities(row);
        });
        console.log(`[House Manager] Loaded ${houses.length} houses.`);
    } catch (err) {
        console.error('[House Manager] Failed to load houses:', err);
    }
}

// --- CREATE ENTITIES (Exterior & Interior) ---
function createHouseEntities(houseData) {
    let pos;
    try {
        pos = typeof houseData.position === 'string' ? JSON.parse(houseData.position) : houseData.position;
    } catch (e) {
        console.error(`[House] Error parsing position for ID ${houseData.id}`);
        return;
    }
    
    const isOwned = houseData.owner_id > 0;
    const interiorPos = INTERIORS[houseData.interior_preset] || INTERIORS["motel"];

    const house = {
        id: houseData.id,
        ownerId: houseData.owner_id,
        price: houseData.price,
        position: pos,
        interior: houseData.interior_preset,
        locked: !!houseData.locked,
        
        // --- EXTERIOR (Street) ---
        label: mp.labels.new(
            `House #${houseData.id}\n${isOwned ? "~r~Owned" : `~g~For Sale: $${houseData.price}`}`, 
            new mp.Vector3(pos.x, pos.y, pos.z),
            { los: true, font: 4, drawDistance: 10, dimension: 0 }
        ),
        marker: mp.markers.new(1, new mp.Vector3(pos.x, pos.y, pos.z - 1.0), 1.0, {
            color: isOwned ? [255, 0, 0, 100] : [0, 255, 0, 100],
            visible: true,
            dimension: 0
        }),
        colshape: mp.colshapes.newSphere(pos.x, pos.y, pos.z, 1.5, 0), // Dim 0
        blip: mp.blips.new(40, new mp.Vector3(pos.x, pos.y, pos.z), {
            name: isOwned ? "House (Owned)" : "House For Sale",
            color: isOwned ? 1 : 2,
            shortRange: true,
            scale: 0.8
        }),

        // --- INTERIOR (Inside) ---
        intMarker: mp.markers.new(1, new mp.Vector3(interiorPos.x, interiorPos.y, interiorPos.z - 1.0), 1.0, {
            color: [255, 255, 0, 100], 
            visible: true,
            dimension: houseData.id 
        }),
        intColshape: mp.colshapes.newSphere(interiorPos.x, interiorPos.y, interiorPos.z, 1.5, houseData.id)
    };

    // --- SETUP INTERACTION DATA ---
    house.colshape.houseId = house.id;
    house.colshape.setVariable('interaction', {
        title: `House #${house.id}`,
        text: isOwned ? (house.locked ? "Door Locked" : "Press E to Enter") : `For Sale: $${house.price} (Press E to Buy)`,
        event: 'playerInteract',
        requireOnFoot: true
    });

    house.intColshape.houseId = house.id;
    house.intColshape.setVariable('interaction', {
        title: `House Interior`,
        text: "Press E to Exit",
        event: 'playerInteract',
        requireOnFoot: true
    });

    houses.push(house);
}

// --- API FUNCTIONS ---

async function createNewHouse(player, price, interiorName) {
    if (!INTERIORS[interiorName]) return player.outputChatBox("!{FF0000}Invalid interior. Available: " + Object.keys(INTERIORS).join(', '));
    
    const pos = player.position;
    const posJSON = JSON.stringify({ x: pos.x, y: pos.y, z: pos.z });

    try {
        const [result] = await db.query(
            "INSERT INTO houses (price, position, interior_preset) VALUES (?, ?, ?)",
            [price, posJSON, interiorName]
        );
        
        createHouseEntities({
            id: result.insertId,
            owner_id: 0,
            price: price,
            position: { x: pos.x, y: pos.y, z: pos.z },
            interior_preset: interiorName,
            locked: 0
        });
        
        player.outputChatBox(`!{00FF00}House #${result.insertId} created!`);
    } catch (err) {
        console.error(err);
        player.outputChatBox("!{FF0000}Database error.");
    }
}

async function deleteNearestHouse(player) {
    const house = getNearestHouse(player.position);
    if (!house) return player.outputChatBox("!{FF0000}No house nearby.");

    try {
        await db.query("DELETE FROM houses WHERE id = ?", [house.id]);
        
        if (house.label) house.label.destroy();
        if (house.marker) house.marker.destroy();
        if (house.blip) house.blip.destroy();
        if (house.colshape) house.colshape.destroy();
        if (house.intMarker) house.intMarker.destroy();
        if (house.intColshape) house.intColshape.destroy();
        
        houses = houses.filter(h => h.id !== house.id);
        player.outputChatBox(`!{00FF00}House #${house.id} deleted.`);
    } catch (err) {
        console.error(err);
    }
}

async function buyHouse(player) {
    const house = getNearestHouse(player.position);
    if (!house) return player.outputChatBox("!{FF0000}Not near a house.");
    if (house.ownerId > 0) return player.outputChatBox("!{FF0000}Already owned.");
    
    // NEW: Check if player already owns a house
    const existingHouse = getHouseByOwner(player.data.dbId);
    if (existingHouse) {
        return player.outputChatBox(`!{FF0000}You already own House #${existingHouse.id}. You can only own 1 house.`);
    }

    if ((player.data.money || 0) < house.price) return player.outputChatBox("!{FF0000}Insufficient funds.");

    try {
        await db.query("UPDATE houses SET owner_id = ? WHERE id = ?", [player.data.dbId, house.id]);
        
        player.data.money -= house.price;
        player.setVariable('money', player.data.money);
        // NOTE: Ensure you save money to DB here or in your player save loop
        
        house.ownerId = player.data.dbId;
        updateHouseVisuals(house);
        
        player.outputChatBox(`!{00FF00}Congratulations! You bought House #${house.id}.`);
    } catch (err) {
        console.error(err);
    }
}

function updateHouseVisuals(house) {
    const isOwned = house.ownerId > 0;
    
    if (house.label) house.label.text = `House #${house.id}\n${isOwned ? "~r~Owned" : `~g~For Sale: $${house.price}`}`;
    if (house.marker) house.marker.setColor(isOwned ? 255 : 0, isOwned ? 0 : 255, 0, 100);
    
    if (house.blip) {
        house.blip.color = isOwned ? 1 : 2;
        house.blip.name = isOwned ? "House (Owned)" : "House For Sale";
    }

    if (house.colshape) {
        house.colshape.setVariable('interaction', {
            title: `House #${house.id}`,
            text: isOwned ? (house.locked ? "Door Locked" : "Press E to Enter") : `For Sale: $${house.price} (Press E to Buy)`,
            event: 'playerInteract',
            requireOnFoot: true
        });
    }
}

function processInteraction(player) {
    // 1. EXIT (Dimension > 0)
    if (player.dimension > 0) {
        const house = houses.find(h => h.id === player.dimension);
        if (house && house.intColshape && house.intColshape.isPointWithin(player.position)) {
            player.position = new mp.Vector3(house.position.x, house.position.y, house.position.z);
            player.dimension = 0;
            return;
        }
    }

    // 2. ENTER/BUY (Dimension 0)
    const house = getNearestHouse(player.position);
    if (house && house.colshape && house.colshape.isPointWithin(player.position)) {
        if (house.ownerId === 0) {
            buyHouse(player);
            return;
        }
        if (house.locked) return player.outputChatBox("!{FF0000}The door is locked.");
        
        const targetPos = INTERIORS[house.interior];
        player.position = new mp.Vector3(targetPos.x, targetPos.y, targetPos.z);
        player.dimension = house.id;
        return;
    }
}

async function lockHouse(player) {
    const house = getNearestHouse(player.position) || houses.find(h => h.id === player.dimension);
    if (!house) return;
    
    if (house.ownerId !== player.data.dbId) return player.outputChatBox("!{FF0000}You don't own this keys.");

    house.locked = !house.locked;
    await db.query("UPDATE houses SET locked = ? WHERE id = ?", [house.locked ? 1 : 0, house.id]);
    
    player.outputChatBox(house.locked ? "!{FF0000}House Locked." : "!{00FF00}House Unlocked.");
    updateHouseVisuals(house); 
}

function getNearestHouse(pos) {
    let nearest = null;
    let minDist = 3.0;
    houses.forEach(h => {
        const dist = calculateDistance(h.position, pos);
        if (dist < minDist) {
            minDist = dist;
            nearest = h;
        }
    });
    return nearest;
}

function getHouseById(id) { return houses.find(h => h.id === id); }

function getHouseByOwner(ownerId) {
    return houses.find(h => h.ownerId === ownerId);
}

mp.events.add('playerInteract', (player) => {
    processInteraction(player);
});

// Initialize
loadHouses();

module.exports = {
    createNewHouse,
    deleteNearestHouse,
    buyHouse,
    lockHouse,
    getHouseById,
    getHouseByOwner,
    getNearestHouse, // THIS WAS MISSING
    houses
};