module.exports = {
    // --- CONSUMABLES (Allowed in Fast Slots) ---
    "burger": {
        name: "Cheeseburger",
        type: "food",
        weight: 0.2,
        isEquippable: true, // <--- ALLOW
        maxStack: 5,
        icon: "burger.png"
    },
    "water": {
        name: "Water Bottle",
        type: "drink",
        weight: 0.5,
        isEquippable: true, // <--- ALLOW
        maxStack: 5,
        icon: "water.png"
    },

    // --- DUMPSTER LOOT ---
    "scrap_metal": {
        name: "Scrap Metal",
        type: "misc",
        weight: 0.5,
        maxStack: 10,
        icon: "scrap_metal.png" // Ensure you have this image or use a placeholder
    },
    "broken_glass": {
        name: "Broken Glass",
        type: "misc",
        weight: 0.1,
        maxStack: 20,
        icon: "broken_glass.png"
    },
    "old_sandwich": {
        name: "Moldy Sandwich",
        type: "food",
        weight: 0.2,
        maxStack: 5,
        icon: "old_sandwich.png" // Reusing burger icon for now
    },
    "plastic_bottle": {
        name: "Empty Bottle",
        type: "misc",
        weight: 0.1,
        maxStack: 10,
        icon: "plastic_bottle.png" 
    },
    "empty_wallet": {
        name: "Empty Wallet",
        type: "misc",
        weight: 0.2,
        maxStack: 1,
        icon: "empty_wallet.png"
    },

    "shirt_white": {
        name: "White T-Shirt",
        type: "clothing",
        weight: 0.3,
        isEquippable: false,
        sex: 0,
        data: { componentId: 11, drawable: 1, texture: 0, torso: 15 }
    },

    // --- WEAPONS (Allowed in Fast Slots) ---
    "pistol": {
        name: "Pistol .50",
        type: "weapon",
        weight: 1.5,
        isEquippable: true, // <--- ALLOW
        maxStack: 1,
        data: { hash: "WEAPON_PISTOL50" }
    },
    "pistol_ammo": {
        name: "9mm Ammo",
        type: "ammo",
        weight: 0.01,
        isEquippable: false,
        maxStack: 100
    }
};