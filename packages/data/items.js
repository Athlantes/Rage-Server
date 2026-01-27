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

    // --- CLOTHING (BLOCKED) ---
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