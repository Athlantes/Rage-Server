const db = require('../core/database');

// --- CONFIGURATION: Interior Presets ---
// Coordinates INSIDE the specific interior models (Teleport destinations)
const INTERIORS = {
    "motel": { x: 151.45, y: -1007.57, z: -99.00 },
    "low_end": { x: 266.00, y: -1007.00, z: -101.00 },
    "medium": { x: 346.52, y: -1012.42, z: -99.20 },
    "modern": { x: -786.86, y: 315.76, z: 217.63 },
    "luxury": { x: -1459.17, y: -520.58, z: 56.92 }
};

// Local cache
let houses = [];

// --- HELPER: Safe Distance Calculation ---
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
            createHouseEntity(row);
        });
        console.log(`[House Manager] Loaded ${houses.length} houses.`);
    } catch (err) {
        console.error('[House Manager] Failed to load houses:', err);
    }
}

// --- CREATE VISUALS (Marker, Label, Blip) ---
function createHouseEntity(houseData) {
    let pos;
    try {
        pos = typeof houseData.position === 'string' ? JSON.parse(houseData.position) : houseData.position;
    } catch (e) {
        console.error(`[House] Error parsing position for House ID ${houseData.id}`);
        return;
    }
    
    const isOwned = houseData.owner_id > 0;

    const house = {
        id: houseData.id,
        ownerId: houseData.owner_id,
        price: houseData.price,
        position: pos,
        interior: houseData.interior_preset,
        locked: !!houseData.locked,
        
        // 1. Text Label
        label: mp.labels.new(
            `House #${houseData.id}\n${isOwned ? "~r~Owned" : `~g~For Sale: $${houseData.price}`}`, 
            new mp.Vector3(pos.x, pos.y, pos.z),
            {
                los: true,
                font: 4,
                drawDistance: 10,
                color: [255, 255, 255, 255]
            }
        ),

        // 2. Ground Marker (Cylinder)
        marker: mp.markers.new(1, new mp.Vector3(pos.x, pos.y, pos.z - 1.0), 1.0, {
            color: isOwned ? [255, 0, 0, 100] : [0, 255, 0, 100], 
            visible: true
        }),

        // 3. Map Blip
        blip: mp.blips.new(40, new mp.Vector3(pos.x, pos.y, pos.z), {
            name: isOwned ? "House (Owned)" : "House For Sale",
            color: isOwned ? 1 : 2, 
            shortRange: true, 
            scale: 0.8
        }),

        // 4. Colshape for Interaction
        colshape: mp.colshapes.newSphere(pos.x, pos.y, pos.z, 1.5)
    };

    house.colshape.houseId = house.id;
    houses.push(house);
}

// --- API FUNCTIONS ---

async function createNewHouse(player, price, interiorName) {
    if (!INTERIORS[interiorName]) return player.outputChatBox("!{FF0000}Invalid interior preset. Available: " + Object.keys(INTERIORS).join(', '));
    
    const pos = player.position;
    const posJSON = JSON.stringify({ x: pos.x, y: pos.y, z: pos.z });

    try {
        const [result] = await db.query(
            "INSERT INTO houses (price, position, interior_preset) VALUES (?, ?, ?)",
            [price, posJSON, interiorName]
        );
        
        const newHouseData = {
            id: result.insertId,
            owner_id: 0,
            price: price,
            position: { x: pos.x, y: pos.y, z: pos.z }, 
            interior_preset: interiorName,
            locked: 0
        };
        createHouseEntity(newHouseData);
        
        player.outputChatBox(`!{00FF00}House #${result.insertId} created!`);
    } catch (err) {
        console.error(err);
        player.outputChatBox("!{FF0000}Database error creating house.");
    }
}

async function deleteNearestHouse(player) {
    const house = getNearestHouse(player.position);
    if (!house) return player.outputChatBox("!{FF0000}No house nearby.");

    try {
        await db.query("DELETE FROM houses WHERE id = ?", [house.id]);
        
        // Cleanup visuals
        if (house.label && mp.labels.exists(house.label)) house.label.destroy();
        if (house.marker && mp.markers.exists(house.marker)) house.marker.destroy();
        if (house.blip && mp.blips.exists(house.blip)) house.blip.destroy();
        if (house.colshape && mp.colshapes.exists(house.colshape)) house.colshape.destroy();
        
        houses = houses.filter(h => h.id !== house.id);
        
        player.outputChatBox(`!{00FF00}House #${house.id} deleted.`);
    } catch (err) {
        console.error(err);
        player.outputChatBox("!{FF0000}Database error deleting house.");
    }
}

async function buyHouse(player) {
    const house = getNearestHouse(player.position);
    if (!house) return player.outputChatBox("!{FF0000}You are not near a house entrance.");
    if (house.ownerId > 0) return player.outputChatBox("!{FF0000}This house is already owned.");
    
    if ((player.data.money || 0) < house.price) return player.outputChatBox("!{FF0000}You don't have enough money.");

    try {
        await db.query("UPDATE houses SET owner_id = ? WHERE id = ?", [player.data.dbId, house.id]);
        
        // Deduct Money
        player.data.money -= house.price;
        // NOTE: Update user money in DB here if you use a sync system
        // await db.query("UPDATE users SET money = ? WHERE id = ?", [player.data.money, player.data.dbId]);
        
        player.setVariable('money', player.data.money);
        
        // Update Cache & Visuals
        house.ownerId = player.data.dbId;
        
        if (house.label && mp.labels.exists(house.label)) {
            house.label.text = `House #${house.id}\n~r~Owned`;
        }
        
        if (house.marker && mp.markers.exists(house.marker)) {
            house.marker.setColor(255, 0, 0, 100); 
        }

        if (house.blip && mp.blips.exists(house.blip)) {
            house.blip.color = 1; // FIX: Property, not method
            house.blip.name = "House (Owned)";
        }
        
        player.outputChatBox(`!{00FF00}You bought House #${house.id} for $${house.price}!`);
    } catch (err) {
        console.error(err);
        player.outputChatBox("!{FF0000}Transaction failed.");
    }
}

function playerInteract(player) {
    // 1. EXIT: Check if player is INSIDE a house (Dimension > 0)
    if (player.dimension > 0) {
        const house = houses.find(h => h.id === player.dimension);
        if (house) {
            const exitPos = INTERIORS[house.interior];
            if (calculateDistance(player.position, exitPos) < 3.0) {
                player.position = new mp.Vector3(house.position.x, house.position.y, house.position.z);
                player.dimension = 0;
                player.outputChatBox("Exited house.");
            }
        }
        return;
    }

    // 2. ENTER: Check if player is OUTSIDE (Dimension 0)
    const house = getNearestHouse(player.position);
    if (house) {
        if (house.locked) return player.outputChatBox("!{FF0000}The door is locked.");
        
        const targetPos = INTERIORS[house.interior];
        player.position = new mp.Vector3(targetPos.x, targetPos.y, targetPos.z);
        player.dimension = house.id; // Dimension = House ID
        player.outputChatBox("Entered house.");
    }
}

async function lockHouse(player) {
    let house = null;

    if (player.dimension > 0) {
        house = houses.find(h => h.id === player.dimension);
    } else {
        house = getNearestHouse(player.position);
    }

    if (!house) return player.outputChatBox("!{FF0000}No house found.");
    if (house.ownerId !== player.data.dbId) return player.outputChatBox("!{FF0000}You don't own this house.");

    const newLockState = !house.locked;
    house.locked = newLockState;
    
    await db.query("UPDATE houses SET locked = ? WHERE id = ?", [newLockState ? 1 : 0, house.id]);
    
    player.outputChatBox(newLockState ? "!{FF0000}House Locked." : "!{00FF00}House Unlocked.");
}

// --- UTILS ---
function getNearestHouse(pos) {
    let nearest = null;
    let minDist = 3.0; // Interaction range
    
    houses.forEach(h => {
        const dist = calculateDistance(h.position, pos);
        if (dist < minDist) {
            minDist = dist;
            nearest = h;
        }
    });
    return nearest;
}

function getHouseById(id) {
    return houses.find(h => h.id === id);
}

// Allow client to trigger interaction
mp.events.add('server:houseInteract', (player) => {
    playerInteract(player);
});

// Initialize
loadHouses();

module.exports = {
    createNewHouse,
    deleteNearestHouse,
    buyHouse,
    playerInteract,
    lockHouse,
    getHouseById,
    getNearestHouse, 
    houses
};