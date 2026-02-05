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
    "apple": {
        name: "Apple",
        type: "food",
        weight: 0.1,
        isEquippable: true, // <--- ALLOW
        maxStack: 20,
        icon: "apple.png"
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
    },
    
// --- MALE TOPS (Sex: 0) ---
    'm_top_white_tee': { 
        name: "White T-Shirt", type: "clothing", weight: 0.2, maxStack: 1,
        sex: 0, isEquippable: false,
        data: { componentId: 11, drawable: 15, texture: 0, torso: 15 } 
    },
    'm_top_black_tee': { 
        name: "Black T-Shirt", type: "clothing", weight: 0.2, maxStack: 1,
        sex: 0, isEquippable: false,
        data: { componentId: 11, drawable: 15, texture: 1, torso: 15 } 
    },
    'm_top_jacket': { 
        name: "Denim Jacket", type: "clothing", weight: 0.8, maxStack: 1,
        sex: 0, isEquippable: false,
        data: { componentId: 11, drawable: 14, texture: 0, torso: 12 } 
    },

    // --- MALE LEGS (Sex: 0) ---
    'm_legs_blue_jeans': { 
        name: "Blue Jeans", type: "clothing", weight: 0.5, maxStack: 1,
        sex: 0, isEquippable: false,
        data: { componentId: 4, drawable: 1, texture: 0 } 
    },
    'm_legs_black_jeans': { 
        name: "Black Jeans", type: "clothing", weight: 0.5, maxStack: 1,
        sex: 0, isEquippable: false,
        data: { componentId: 4, drawable: 1, texture: 1 } 
    },

    // --- MALE SHOES (Sex: 0) ---
    'm_shoes_sneakers': { 
        name: "White Sneakers", type: "clothing", weight: 0.4, maxStack: 1,
        sex: 0, isEquippable: false,
        data: { componentId: 6, drawable: 1, texture: 0 } 
    },
    'm_shoes_boots': { 
        name: "Work Boots", type: "clothing", weight: 0.6, maxStack: 1,
        sex: 0, isEquippable: false,
        data: { componentId: 6, drawable: 12, texture: 0 } 
    },

    // --- FEMALE TOPS (Sex: 1) ---
    'f_top_white_tank': { 
        name: "White Tank Top", type: "clothing", weight: 0.1, maxStack: 1,
        sex: 1, isEquippable: false,
        data: { componentId: 11, drawable: 2, texture: 0, torso: 2 } 
    },
    'f_top_jacket': { 
        name: "Leather Jacket", type: "clothing", weight: 0.7, maxStack: 1,
        sex: 1, isEquippable: false,
        data: { componentId: 11, drawable: 7, texture: 0, torso: 7 } 
    },

    // --- FEMALE LEGS (Sex: 1) ---
    'f_legs_leggings': { 
        name: "Black Leggings", type: "clothing", weight: 0.3, maxStack: 1,
        sex: 1, isEquippable: false,
        data: { componentId: 4, drawable: 4, texture: 0 } 
    },
    'f_legs_jeans': { 
        name: "Skinny Jeans", type: "clothing", weight: 0.5, maxStack: 1,
        sex: 1, isEquippable: false,
        data: { componentId: 4, drawable: 1, texture: 0 } 
    },

    // --- FEMALE SHOES (Sex: 1) ---
    'f_shoes_sneakers': { 
        name: "Pink Sneakers", type: "clothing", weight: 0.4, maxStack: 1,
        sex: 1, isEquippable: false,
        data: { componentId: 6, drawable: 2, texture: 0 } 
    }
};