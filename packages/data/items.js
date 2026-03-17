module.exports = {
    // --- CONSUMABLES (Allowed in Fast Slots) ---
    "burger": {
        name: "Cheeseburger",
        type: "food",
        weight: 0.2,
        isEquippable: true,
        maxStack: 5,
        icon: "burger.png",
        data: { foodValue: 40, waterValue: -5 }
    },
    "water": {
        name: "Water Bottle",
        type: "drink",
        weight: 0.5,
        isEquippable: true,
        maxStack: 5,
        icon: "water.png",
        data: { waterValue: 50 }
    },
    "apple": {
        name: "Apple",
        type: "food",
        weight: 0.1,
        isEquippable: true,
        maxStack: 20,
        icon: "apple.png",
        data: { foodValue: 15, waterValue: 10 }
    },

    // --- FARMING ITEMS ---
    "pumpkin": {
        name: "Pumpkin", type: "food", weight: 2.0, maxStack: 10,
        icon: "pumpkin.png" 
    },
    "seed_pumpkin": {
        name: "Pumpkin Seed",
        type: "seed", // Special type for Inventory logic
        weight: 0.1,
        maxStack: 20,
        icon: "seed_pumpkin.png",
        data: {
            propStart: 'prop_saplin_002_c', // Small plant
            propEnd: 'prop_veg_crop_03_pump',  // Ready plant
            growTime: 60000 * 10,               // 10 Minutes
            reward: 'pumpkin',
            rewardCount: 1,
            zOffset: -0.05
        }
    },
    "cabbage": {
        name: "Cabbage",
        type: "food",
        weight: 0.5,
        maxStack: 10,
        icon: "cabbage.png"
    },
    "seed_cabbage": {
        name: "Cabbage Seed",
        type: "seed", // Special type for Inventory logic
        weight: 0.1,
        maxStack: 20,
        icon: "seed_cabbage.png",
        data: {
            propStart: 'prop_veg_crop_04_leaf', // Small plant
            propEnd: 'prop_veg_crop_03_cab',     // Ready plant
            growTime: 60000 * 5,                 // 5 Minutes
            reward: 'cabbage',
            rewardCount: 1,
            zOffset: -0.05
        }
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
        icon: "old_sandwich.png",
        data: { foodValue: 10, waterValue: -5 }
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
    "wallet_stolen": {
        name: "Stolen Wallet",
        type: "misc",
        weight: 0.3,
        maxStack: 1,
        icon: "empty_wallet.png"
    },

    "shirt_white": {
        name: "White T-Shirt",
        type: "clothing",
        weight: 0.3,
        isEquippable: false,
        sex: 0,
        icon: "shirt_white.png",
        data: { componentId: 11, drawable: 1, texture: 0, torso: 15 }
    },

    // --- ROB ITEMS ---
    "skimmer_device": {
        name: "Skimmer Device",
        type: "tool",
        weight: 0.3,
        isEquippable: false,
        maxStack: 3,
        icon: "skimmer_device.png",
        data: { useFor: "atm_skimmer" }
    },

    "atm_skimmer_data": {
        name: "ATM Skimmer Data",
        type: "quest",
        weight: 0.0,
        isEquippable: false,
        maxStack: 1,
        icon: "atm_skimmer_data.png",
        data: { useFor: "atm_delivery" }
    },

    "dirty_cash": {
        name: "Dirty Cash",
        type: "money",
        weight: 0.00005,
        isEquippable: false,
        maxStack: 10000,
        icon: "dirty_cash.png",
        data: { useFor: "laundering" }
    },

    // --- WEAPONS (Allowed in Fast Slots) ---
    "pistol": {
        name: "Pistol .50",
        type: "weapon",
        weight: 1.5,
        isEquippable: true, // <--- ALLOW
        maxStack: 1,
        ammoItem: "pistol_ammo",
        data: { hash: "WEAPON_PISTOL50" }
    },
    "pistol_ammo": {
        name: "9mm Ammo",
        type: "ammo",
        weight: 0.01,
        isEquippable: false,
        maxStack: 100
    },

    // --- FISH ---
    "fish_anchovy": {
        name: "Anchovy",     type: "fish", weight: 0.01, maxStack: 20, icon: "fish_anchovy.png"
    },
    "fish_sardine": {
        name: "Sardine",     type: "fish", weight: 0.01, maxStack: 20, icon: "fish_sardine.png"
    },
    "fish_carp": {
        name: "Carp",        type: "fish", weight: 0.03, maxStack: 15, icon: "fish_carp.png"
    },
    "fish_bass": {
        name: "Bass",        type: "fish", weight: 0.04, maxStack: 15, icon: "fish_bass.png"
    },
    "fish_tuna": {
        name: "Tuna",        type: "fish", weight: 0.06, maxStack: 10, icon: "fish_tuna.png"
    },
    "fish_catfish": {
        name: "Catfish",     type: "fish", weight: 0.05, maxStack: 10, icon: "fish_catfish.png"
    },
    "fish_salmon": {
        name: "Salmon",      type: "fish", weight: 0.05, maxStack: 10, icon: "fish_salmon.png",  rarity: "rare"
    },
    "fish_swordfish": {
        name: "Swordfish",   type: "fish", weight: 0.08, maxStack: 5,  icon: "fish_swordfish.png", rarity: "rare"
    },
    "fish_sturgeon": {
        name: "Sturgeon",    type: "fish", weight: 0.1, maxStack: 5,  icon: "fish_sturgeon.png",  rarity: "rare"
    },
    
    // --- MALE TOPS (Sex: 0) ---
    'm_top_white_tee': { 
        name: "White T-Shirt", type: "clothing", weight: 0.2, maxStack: 1,
        sex: 0, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 11, drawable: 15, texture: 0, torso: 15 } 
    },
    'm_top_black_tee': { 
        name: "Black T-Shirt", type: "clothing", weight: 0.2, maxStack: 1,
        sex: 0, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 11, drawable: 15, texture: 1, torso: 15 } 
    },
    'm_top_jacket': { 
        name: "Denim Jacket", type: "clothing", weight: 0.8, maxStack: 1,
        sex: 0, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 11, drawable: 14, texture: 0, torso: 12 } 
    },
    'm_top_hoodie': {
        name: "Gray Hoodie", type: "clothing", weight: 0.5, maxStack: 1,
        sex: 0, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 11, drawable: 59, texture: 0, torso: 14 }
    },
    'm_top_polo': {
        name: "White Polo", type: "clothing", weight: 0.3, maxStack: 1,
        sex: 0, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 11, drawable: 29, texture: 0, torso: 15 }
    },

    // --- MALE LEGS (Sex: 0) ---
    'm_legs_blue_jeans': { 
        name: "Blue Jeans", type: "clothing", weight: 0.5, maxStack: 1,
        sex: 0, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 4, drawable: 1, texture: 0 } 
    },
    'm_legs_black_jeans': { 
        name: "Black Jeans", type: "clothing", weight: 0.5, maxStack: 1,
        sex: 0, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 4, drawable: 1, texture: 1 } 
    },
    'm_legs_khakis': {
        name: "Khaki Chinos", type: "clothing", weight: 0.4, maxStack: 1,
        sex: 0, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 4, drawable: 4, texture: 0 }
    },
    'm_legs_shorts': {
        name: "Cargo Shorts", type: "clothing", weight: 0.3, maxStack: 1,
        sex: 0, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 4, drawable: 10, texture: 0 }
    },

    // --- MALE SHOES (Sex: 0) ---
    'm_shoes_sneakers': { 
        name: "White Sneakers", type: "clothing", weight: 0.4, maxStack: 1,
        sex: 0, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 6, drawable: 1, texture: 0 } 
    },
    'm_shoes_boots': { 
        name: "Work Boots", type: "clothing", weight: 0.6, maxStack: 1,
        sex: 0, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 6, drawable: 12, texture: 0 } 
    },
    'm_shoes_hightops': {
        name: "High Tops", type: "clothing", weight: 0.5, maxStack: 1,
        sex: 0, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 6, drawable: 7, texture: 0 }
    },

    // --- FEMALE TOPS (Sex: 1) ---
    'f_top_white_tank': { 
        name: "White Tank Top", type: "clothing", weight: 0.1, maxStack: 1,
        sex: 1, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 11, drawable: 2, texture: 0, torso: 2 } 
    },
    'f_top_jacket': { 
        name: "Leather Jacket", type: "clothing", weight: 0.7, maxStack: 1,
        sex: 1, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 11, drawable: 7, texture: 0, torso: 7 } 
    },
    'f_top_blouse': {
        name: "Blouse", type: "clothing", weight: 0.2, maxStack: 1,
        sex: 1, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 11, drawable: 39, texture: 0, torso: 5 }
    },
    'f_top_hoodie': {
        name: "Hoodie", type: "clothing", weight: 0.5, maxStack: 1,
        sex: 1, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 11, drawable: 59, texture: 0, torso: 14 }
    },

    // --- FEMALE LEGS (Sex: 1) ---
    // --- FEMALE LEGS (Sex: 1) ---
    'f_legs_leggings': { 
        name: "Black Leggings", type: "clothing", weight: 0.3, maxStack: 1,
        sex: 1, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 4, drawable: 4, texture: 0 } 
    },
    'f_legs_jeans': { 
        name: "Skinny Jeans", type: "clothing", weight: 0.5, maxStack: 1,
        sex: 1, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 4, drawable: 1, texture: 0 } 
    },
    'f_legs_skirt': {
        name: "Denim Skirt", type: "clothing", weight: 0.3, maxStack: 1,
        sex: 1, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 4, drawable: 10, texture: 0 }
    },

    // --- FEMALE SHOES (Sex: 1) ---
    // --- FEMALE SHOES (Sex: 1) ---
    'f_shoes_sneakers': { 
        name: "Pink Sneakers", type: "clothing", weight: 0.4, maxStack: 1,
        sex: 1, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 6, drawable: 2, texture: 0 } 
    },
    'f_shoes_boots': {
        name: "Ankle Boots", type: "clothing", weight: 0.5, maxStack: 1,
        sex: 1, isEquippable: false, icon: "shirt_white.png",
        data: { componentId: 6, drawable: 3, texture: 0 }
    },

    // --- CAR PARTS (for tuning system) ---
    "car_part_common": {
        name: "Common Car Part",
        type: "car_part",
        rarity: "common",
        weight: 0.3,
        maxStack: 50,
        icon: "car_part_common.png"
    },
    "car_part_uncommon": {
        name: "Uncommon Car Part",
        type: "car_part",
        rarity: "uncommon",
        weight: 0.3,
        maxStack: 50,
        icon: "car_part_uncommon.png"
    },
    "car_part_rare": {
        name: "Rare Car Part",
        type: "car_part",
        rarity: "rare",
        weight: 0.3,
        maxStack: 30,
        icon: "car_part_rare.png"
    },
    "car_part_epic": {
        name: "Epic Car Part",
        type: "car_part",
        rarity: "epic",
        weight: 0.3,
        maxStack: 20,
        icon: "car_part_epic.png"
    },
    "car_part_legendary": {
        name: "Legendary Car Part",
        type: "car_part",
        rarity: "legendary",
        weight: 0.3,
        maxStack: 10,
        icon: "car_part_legendary.png"
    },


    // ══════════════════════════════════════════════════════════════════════════
    // RAW MATERIALS (used for crafting car components at the workbench)
    // ══════════════════════════════════════════════════════════════════════════
    "machine_oil": {
        name: "Machine Oil", type: "raw_material", weight: 0.5, maxStack: 30,
        icon: "machine_oil.png",
        description: "Used in drivetrain, turbo and engine component crafting."
    },
    "rubber_compound": {
        name: "Rubber Compound", type: "raw_material", weight: 0.3, maxStack: 30,
        icon: "rubber_compound.png",
        description: "Used in brake, clutch and tyre component crafting."
    },
    "aluminum_sheet": {
        name: "Aluminum Sheet", type: "raw_material", weight: 0.8, maxStack: 20,
        icon: "aluminum_sheet.png",
        description: "Used in lightweight and electronic component crafting."
    },
    "carbon_fiber": {
        name: "Carbon Fiber", type: "raw_material", weight: 0.4, maxStack: 15,
        icon: "carbon_fiber.png",
        description: "Rare material used for high-end chassis and aero components."
    },

    // ══════════════════════════════════════════════════════════════════════════
    // CAR COMPONENTS — 36 types × 5 rarities = 180 items
    // Used as specific upgrade requirements in the tuning system.
    // ══════════════════════════════════════════════════════════════════════════
    "crankshaft_common": {
        name: "Common Crankshaft", type: "car_component",
        category: "power", componentType: "crankshaft", rarity: "common",
        weight: 2.0, maxStack: 30,
        icon: "crankshaft.png",
        description: "Core rotating assembly of the engine."
    },
    "crankshaft_uncommon": {
        name: "Uncommon Crankshaft", type: "car_component",
        category: "power", componentType: "crankshaft", rarity: "uncommon",
        weight: 2.0, maxStack: 20,
        icon: "crankshaft.png",
        description: "Core rotating assembly of the engine."
    },
    "crankshaft_rare": {
        name: "Rare Crankshaft", type: "car_component",
        category: "power", componentType: "crankshaft", rarity: "rare",
        weight: 2.0, maxStack: 15,
        icon: "crankshaft.png",
        description: "Core rotating assembly of the engine."
    },
    "crankshaft_epic": {
        name: "Epic Crankshaft", type: "car_component",
        category: "power", componentType: "crankshaft", rarity: "epic",
        weight: 2.0, maxStack: 10,
        icon: "crankshaft.png",
        description: "Core rotating assembly of the engine."
    },
    "crankshaft_legendary": {
        name: "Legendary Crankshaft", type: "car_component",
        category: "power", componentType: "crankshaft", rarity: "legendary",
        weight: 2.0, maxStack: 5,
        icon: "crankshaft.png",
        description: "Core rotating assembly of the engine."
    },
    "piston_common": {
        name: "Common Piston", type: "car_component",
        category: "power", componentType: "piston", rarity: "common",
        weight: 0.8, maxStack: 30,
        icon: "piston.png",
        description: "Converts combustion force to rotational motion."
    },
    "piston_uncommon": {
        name: "Uncommon Piston", type: "car_component",
        category: "power", componentType: "piston", rarity: "uncommon",
        weight: 0.8, maxStack: 20,
        icon: "piston.png",
        description: "Converts combustion force to rotational motion."
    },
    "piston_rare": {
        name: "Rare Piston", type: "car_component",
        category: "power", componentType: "piston", rarity: "rare",
        weight: 0.8, maxStack: 15,
        icon: "piston.png",
        description: "Converts combustion force to rotational motion."
    },
    "piston_epic": {
        name: "Epic Piston", type: "car_component",
        category: "power", componentType: "piston", rarity: "epic",
        weight: 0.8, maxStack: 10,
        icon: "piston.png",
        description: "Converts combustion force to rotational motion."
    },
    "piston_legendary": {
        name: "Legendary Piston", type: "car_component",
        category: "power", componentType: "piston", rarity: "legendary",
        weight: 0.8, maxStack: 5,
        icon: "piston.png",
        description: "Converts combustion force to rotational motion."
    },
    "engine_block_common": {
        name: "Common Engine Block", type: "car_component",
        category: "power", componentType: "engine_block", rarity: "common",
        weight: 5.0, maxStack: 30,
        icon: "engine_block.png",
        description: "Main structural component housing the cylinders."
    },
    "engine_block_uncommon": {
        name: "Uncommon Engine Block", type: "car_component",
        category: "power", componentType: "engine_block", rarity: "uncommon",
        weight: 5.0, maxStack: 20,
        icon: "engine_block.png",
        description: "Main structural component housing the cylinders."
    },
    "engine_block_rare": {
        name: "Rare Engine Block", type: "car_component",
        category: "power", componentType: "engine_block", rarity: "rare",
        weight: 5.0, maxStack: 15,
        icon: "engine_block.png",
        description: "Main structural component housing the cylinders."
    },
    "engine_block_epic": {
        name: "Epic Engine Block", type: "car_component",
        category: "power", componentType: "engine_block", rarity: "epic",
        weight: 5.0, maxStack: 10,
        icon: "engine_block.png",
        description: "Main structural component housing the cylinders."
    },
    "engine_block_legendary": {
        name: "Legendary Engine Block", type: "car_component",
        category: "power", componentType: "engine_block", rarity: "legendary",
        weight: 5.0, maxStack: 5,
        icon: "engine_block.png",
        description: "Main structural component housing the cylinders."
    },
    "turbo_manifold_common": {
        name: "Common Turbo Manifold", type: "car_component",
        category: "power", componentType: "turbo_manifold", rarity: "common",
        weight: 2.0, maxStack: 30,
        icon: "turbo_manifold.png",
        description: "Channels exhaust gases into the turbocharger."
    },
    "turbo_manifold_uncommon": {
        name: "Uncommon Turbo Manifold", type: "car_component",
        category: "power", componentType: "turbo_manifold", rarity: "uncommon",
        weight: 2.0, maxStack: 20,
        icon: "turbo_manifold.png",
        description: "Channels exhaust gases into the turbocharger."
    },
    "turbo_manifold_rare": {
        name: "Rare Turbo Manifold", type: "car_component",
        category: "power", componentType: "turbo_manifold", rarity: "rare",
        weight: 2.0, maxStack: 15,
        icon: "turbo_manifold.png",
        description: "Channels exhaust gases into the turbocharger."
    },
    "turbo_manifold_epic": {
        name: "Epic Turbo Manifold", type: "car_component",
        category: "power", componentType: "turbo_manifold", rarity: "epic",
        weight: 2.0, maxStack: 10,
        icon: "turbo_manifold.png",
        description: "Channels exhaust gases into the turbocharger."
    },
    "turbo_manifold_legendary": {
        name: "Legendary Turbo Manifold", type: "car_component",
        category: "power", componentType: "turbo_manifold", rarity: "legendary",
        weight: 2.0, maxStack: 5,
        icon: "turbo_manifold.png",
        description: "Channels exhaust gases into the turbocharger."
    },
    "intercooler_common": {
        name: "Common Intercooler", type: "car_component",
        category: "power", componentType: "intercooler", rarity: "common",
        weight: 3.0, maxStack: 30,
        icon: "intercooler.png",
        description: "Cools compressed intake air for a denser charge."
    },
    "intercooler_uncommon": {
        name: "Uncommon Intercooler", type: "car_component",
        category: "power", componentType: "intercooler", rarity: "uncommon",
        weight: 3.0, maxStack: 20,
        icon: "intercooler.png",
        description: "Cools compressed intake air for a denser charge."
    },
    "intercooler_rare": {
        name: "Rare Intercooler", type: "car_component",
        category: "power", componentType: "intercooler", rarity: "rare",
        weight: 3.0, maxStack: 15,
        icon: "intercooler.png",
        description: "Cools compressed intake air for a denser charge."
    },
    "intercooler_epic": {
        name: "Epic Intercooler", type: "car_component",
        category: "power", componentType: "intercooler", rarity: "epic",
        weight: 3.0, maxStack: 10,
        icon: "intercooler.png",
        description: "Cools compressed intake air for a denser charge."
    },
    "intercooler_legendary": {
        name: "Legendary Intercooler", type: "car_component",
        category: "power", componentType: "intercooler", rarity: "legendary",
        weight: 3.0, maxStack: 5,
        icon: "intercooler.png",
        description: "Cools compressed intake air for a denser charge."
    },
    "wastegate_common": {
        name: "Common Wastegate", type: "car_component",
        category: "power", componentType: "wastegate", rarity: "common",
        weight: 1.5, maxStack: 30,
        icon: "wastegate.png",
        description: "Controls boost pressure by venting exhaust gases."
    },
    "wastegate_uncommon": {
        name: "Uncommon Wastegate", type: "car_component",
        category: "power", componentType: "wastegate", rarity: "uncommon",
        weight: 1.5, maxStack: 20,
        icon: "wastegate.png",
        description: "Controls boost pressure by venting exhaust gases."
    },
    "wastegate_rare": {
        name: "Rare Wastegate", type: "car_component",
        category: "power", componentType: "wastegate", rarity: "rare",
        weight: 1.5, maxStack: 15,
        icon: "wastegate.png",
        description: "Controls boost pressure by venting exhaust gases."
    },
    "wastegate_epic": {
        name: "Epic Wastegate", type: "car_component",
        category: "power", componentType: "wastegate", rarity: "epic",
        weight: 1.5, maxStack: 10,
        icon: "wastegate.png",
        description: "Controls boost pressure by venting exhaust gases."
    },
    "wastegate_legendary": {
        name: "Legendary Wastegate", type: "car_component",
        category: "power", componentType: "wastegate", rarity: "legendary",
        weight: 1.5, maxStack: 5,
        icon: "wastegate.png",
        description: "Controls boost pressure by venting exhaust gases."
    },
    "ecu_chip_common": {
        name: "Common ECU Chip", type: "car_component",
        category: "power", componentType: "ecu_chip", rarity: "common",
        weight: 0.2, maxStack: 30,
        icon: "ecu_chip.png",
        description: "Programmable engine control unit processor."
    },
    "ecu_chip_uncommon": {
        name: "Uncommon ECU Chip", type: "car_component",
        category: "power", componentType: "ecu_chip", rarity: "uncommon",
        weight: 0.2, maxStack: 20,
        icon: "ecu_chip.png",
        description: "Programmable engine control unit processor."
    },
    "ecu_chip_rare": {
        name: "Rare ECU Chip", type: "car_component",
        category: "power", componentType: "ecu_chip", rarity: "rare",
        weight: 0.2, maxStack: 15,
        icon: "ecu_chip.png",
        description: "Programmable engine control unit processor."
    },
    "ecu_chip_epic": {
        name: "Epic ECU Chip", type: "car_component",
        category: "power", componentType: "ecu_chip", rarity: "epic",
        weight: 0.2, maxStack: 10,
        icon: "ecu_chip.png",
        description: "Programmable engine control unit processor."
    },
    "ecu_chip_legendary": {
        name: "Legendary ECU Chip", type: "car_component",
        category: "power", componentType: "ecu_chip", rarity: "legendary",
        weight: 0.2, maxStack: 5,
        icon: "ecu_chip.png",
        description: "Programmable engine control unit processor."
    },
    "fuel_injector_common": {
        name: "Common Fuel Injector", type: "car_component",
        category: "power", componentType: "fuel_injector", rarity: "common",
        weight: 0.5, maxStack: 30,
        icon: "fuel_injector.png",
        description: "Precision fuel delivery nozzle."
    },
    "fuel_injector_uncommon": {
        name: "Uncommon Fuel Injector", type: "car_component",
        category: "power", componentType: "fuel_injector", rarity: "uncommon",
        weight: 0.5, maxStack: 20,
        icon: "fuel_injector.png",
        description: "Precision fuel delivery nozzle."
    },
    "fuel_injector_rare": {
        name: "Rare Fuel Injector", type: "car_component",
        category: "power", componentType: "fuel_injector", rarity: "rare",
        weight: 0.5, maxStack: 15,
        icon: "fuel_injector.png",
        description: "Precision fuel delivery nozzle."
    },
    "fuel_injector_epic": {
        name: "Epic Fuel Injector", type: "car_component",
        category: "power", componentType: "fuel_injector", rarity: "epic",
        weight: 0.5, maxStack: 10,
        icon: "fuel_injector.png",
        description: "Precision fuel delivery nozzle."
    },
    "fuel_injector_legendary": {
        name: "Legendary Fuel Injector", type: "car_component",
        category: "power", componentType: "fuel_injector", rarity: "legendary",
        weight: 0.5, maxStack: 5,
        icon: "fuel_injector.png",
        description: "Precision fuel delivery nozzle."
    },
    "exhaust_header_common": {
        name: "Common Exhaust Header", type: "car_component",
        category: "power", componentType: "exhaust_header", rarity: "common",
        weight: 3.0, maxStack: 30,
        icon: "exhaust_header.png",
        description: "Merges exhaust ports for optimal scavenging."
    },
    "exhaust_header_uncommon": {
        name: "Uncommon Exhaust Header", type: "car_component",
        category: "power", componentType: "exhaust_header", rarity: "uncommon",
        weight: 3.0, maxStack: 20,
        icon: "exhaust_header.png",
        description: "Merges exhaust ports for optimal scavenging."
    },
    "exhaust_header_rare": {
        name: "Rare Exhaust Header", type: "car_component",
        category: "power", componentType: "exhaust_header", rarity: "rare",
        weight: 3.0, maxStack: 15,
        icon: "exhaust_header.png",
        description: "Merges exhaust ports for optimal scavenging."
    },
    "exhaust_header_epic": {
        name: "Epic Exhaust Header", type: "car_component",
        category: "power", componentType: "exhaust_header", rarity: "epic",
        weight: 3.0, maxStack: 10,
        icon: "exhaust_header.png",
        description: "Merges exhaust ports for optimal scavenging."
    },
    "exhaust_header_legendary": {
        name: "Legendary Exhaust Header", type: "car_component",
        category: "power", componentType: "exhaust_header", rarity: "legendary",
        weight: 3.0, maxStack: 5,
        icon: "exhaust_header.png",
        description: "Merges exhaust ports for optimal scavenging."
    },
    "exhaust_manifold_common": {
        name: "Common Exhaust Manifold", type: "car_component",
        category: "power", componentType: "exhaust_manifold", rarity: "common",
        weight: 3.5, maxStack: 30,
        icon: "exhaust_manifold.png",
        description: "Collects exhaust from all cylinders into one outlet."
    },
    "exhaust_manifold_uncommon": {
        name: "Uncommon Exhaust Manifold", type: "car_component",
        category: "power", componentType: "exhaust_manifold", rarity: "uncommon",
        weight: 3.5, maxStack: 20,
        icon: "exhaust_manifold.png",
        description: "Collects exhaust from all cylinders into one outlet."
    },
    "exhaust_manifold_rare": {
        name: "Rare Exhaust Manifold", type: "car_component",
        category: "power", componentType: "exhaust_manifold", rarity: "rare",
        weight: 3.5, maxStack: 15,
        icon: "exhaust_manifold.png",
        description: "Collects exhaust from all cylinders into one outlet."
    },
    "exhaust_manifold_epic": {
        name: "Epic Exhaust Manifold", type: "car_component",
        category: "power", componentType: "exhaust_manifold", rarity: "epic",
        weight: 3.5, maxStack: 10,
        icon: "exhaust_manifold.png",
        description: "Collects exhaust from all cylinders into one outlet."
    },
    "exhaust_manifold_legendary": {
        name: "Legendary Exhaust Manifold", type: "car_component",
        category: "power", componentType: "exhaust_manifold", rarity: "legendary",
        weight: 3.5, maxStack: 5,
        icon: "exhaust_manifold.png",
        description: "Collects exhaust from all cylinders into one outlet."
    },
    "gear_set_common": {
        name: "Common Gear Set", type: "car_component",
        category: "drivetrain", componentType: "gear_set", rarity: "common",
        weight: 3.0, maxStack: 30,
        icon: "gear_set.png",
        description: "Close-ratio gear pairs for optimised power delivery."
    },
    "gear_set_uncommon": {
        name: "Uncommon Gear Set", type: "car_component",
        category: "drivetrain", componentType: "gear_set", rarity: "uncommon",
        weight: 3.0, maxStack: 20,
        icon: "gear_set.png",
        description: "Close-ratio gear pairs for optimised power delivery."
    },
    "gear_set_rare": {
        name: "Rare Gear Set", type: "car_component",
        category: "drivetrain", componentType: "gear_set", rarity: "rare",
        weight: 3.0, maxStack: 15,
        icon: "gear_set.png",
        description: "Close-ratio gear pairs for optimised power delivery."
    },
    "gear_set_epic": {
        name: "Epic Gear Set", type: "car_component",
        category: "drivetrain", componentType: "gear_set", rarity: "epic",
        weight: 3.0, maxStack: 10,
        icon: "gear_set.png",
        description: "Close-ratio gear pairs for optimised power delivery."
    },
    "gear_set_legendary": {
        name: "Legendary Gear Set", type: "car_component",
        category: "drivetrain", componentType: "gear_set", rarity: "legendary",
        weight: 3.0, maxStack: 5,
        icon: "gear_set.png",
        description: "Close-ratio gear pairs for optimised power delivery."
    },
    "clutch_kit_common": {
        name: "Common Clutch Kit", type: "car_component",
        category: "drivetrain", componentType: "clutch_kit", rarity: "common",
        weight: 1.5, maxStack: 30,
        icon: "clutch_kit.png",
        description: "Friction disc and pressure plate assembly."
    },
    "clutch_kit_uncommon": {
        name: "Uncommon Clutch Kit", type: "car_component",
        category: "drivetrain", componentType: "clutch_kit", rarity: "uncommon",
        weight: 1.5, maxStack: 20,
        icon: "clutch_kit.png",
        description: "Friction disc and pressure plate assembly."
    },
    "clutch_kit_rare": {
        name: "Rare Clutch Kit", type: "car_component",
        category: "drivetrain", componentType: "clutch_kit", rarity: "rare",
        weight: 1.5, maxStack: 15,
        icon: "clutch_kit.png",
        description: "Friction disc and pressure plate assembly."
    },
    "clutch_kit_epic": {
        name: "Epic Clutch Kit", type: "car_component",
        category: "drivetrain", componentType: "clutch_kit", rarity: "epic",
        weight: 1.5, maxStack: 10,
        icon: "clutch_kit.png",
        description: "Friction disc and pressure plate assembly."
    },
    "clutch_kit_legendary": {
        name: "Legendary Clutch Kit", type: "car_component",
        category: "drivetrain", componentType: "clutch_kit", rarity: "legendary",
        weight: 1.5, maxStack: 5,
        icon: "clutch_kit.png",
        description: "Friction disc and pressure plate assembly."
    },
    "lsd_pack_common": {
        name: "Common LSD Pack", type: "car_component",
        category: "drivetrain", componentType: "lsd_pack", rarity: "common",
        weight: 2.0, maxStack: 30,
        icon: "lsd_pack.png",
        description: "Limited slip differential clutch pack."
    },
    "lsd_pack_uncommon": {
        name: "Uncommon LSD Pack", type: "car_component",
        category: "drivetrain", componentType: "lsd_pack", rarity: "uncommon",
        weight: 2.0, maxStack: 20,
        icon: "lsd_pack.png",
        description: "Limited slip differential clutch pack."
    },
    "lsd_pack_rare": {
        name: "Rare LSD Pack", type: "car_component",
        category: "drivetrain", componentType: "lsd_pack", rarity: "rare",
        weight: 2.0, maxStack: 15,
        icon: "lsd_pack.png",
        description: "Limited slip differential clutch pack."
    },
    "lsd_pack_epic": {
        name: "Epic LSD Pack", type: "car_component",
        category: "drivetrain", componentType: "lsd_pack", rarity: "epic",
        weight: 2.0, maxStack: 10,
        icon: "lsd_pack.png",
        description: "Limited slip differential clutch pack."
    },
    "lsd_pack_legendary": {
        name: "Legendary LSD Pack", type: "car_component",
        category: "drivetrain", componentType: "lsd_pack", rarity: "legendary",
        weight: 2.0, maxStack: 5,
        icon: "lsd_pack.png",
        description: "Limited slip differential clutch pack."
    },
    "ring_pinion_common": {
        name: "Common Ring & Pinion", type: "car_component",
        category: "drivetrain", componentType: "ring_pinion", rarity: "common",
        weight: 2.5, maxStack: 30,
        icon: "ring_pinion.png",
        description: "Final drive gear set controlling axle ratio."
    },
    "ring_pinion_uncommon": {
        name: "Uncommon Ring & Pinion", type: "car_component",
        category: "drivetrain", componentType: "ring_pinion", rarity: "uncommon",
        weight: 2.5, maxStack: 20,
        icon: "ring_pinion.png",
        description: "Final drive gear set controlling axle ratio."
    },
    "ring_pinion_rare": {
        name: "Rare Ring & Pinion", type: "car_component",
        category: "drivetrain", componentType: "ring_pinion", rarity: "rare",
        weight: 2.5, maxStack: 15,
        icon: "ring_pinion.png",
        description: "Final drive gear set controlling axle ratio."
    },
    "ring_pinion_epic": {
        name: "Epic Ring & Pinion", type: "car_component",
        category: "drivetrain", componentType: "ring_pinion", rarity: "epic",
        weight: 2.5, maxStack: 10,
        icon: "ring_pinion.png",
        description: "Final drive gear set controlling axle ratio."
    },
    "ring_pinion_legendary": {
        name: "Legendary Ring & Pinion", type: "car_component",
        category: "drivetrain", componentType: "ring_pinion", rarity: "legendary",
        weight: 2.5, maxStack: 5,
        icon: "ring_pinion.png",
        description: "Final drive gear set controlling axle ratio."
    },
    "brake_rotor_common": {
        name: "Common Brake Rotor", type: "car_component",
        category: "handling", componentType: "brake_rotor", rarity: "common",
        weight: 2.0, maxStack: 30,
        icon: "brake_rotor.png",
        description: "Vented disc that absorbs braking heat."
    },
    "brake_rotor_uncommon": {
        name: "Uncommon Brake Rotor", type: "car_component",
        category: "handling", componentType: "brake_rotor", rarity: "uncommon",
        weight: 2.0, maxStack: 20,
        icon: "brake_rotor.png",
        description: "Vented disc that absorbs braking heat."
    },
    "brake_rotor_rare": {
        name: "Rare Brake Rotor", type: "car_component",
        category: "handling", componentType: "brake_rotor", rarity: "rare",
        weight: 2.0, maxStack: 15,
        icon: "brake_rotor.png",
        description: "Vented disc that absorbs braking heat."
    },
    "brake_rotor_epic": {
        name: "Epic Brake Rotor", type: "car_component",
        category: "handling", componentType: "brake_rotor", rarity: "epic",
        weight: 2.0, maxStack: 10,
        icon: "brake_rotor.png",
        description: "Vented disc that absorbs braking heat."
    },
    "brake_rotor_legendary": {
        name: "Legendary Brake Rotor", type: "car_component",
        category: "handling", componentType: "brake_rotor", rarity: "legendary",
        weight: 2.0, maxStack: 5,
        icon: "brake_rotor.png",
        description: "Vented disc that absorbs braking heat."
    },
    "brake_caliper_common": {
        name: "Common Brake Caliper", type: "car_component",
        category: "handling", componentType: "brake_caliper", rarity: "common",
        weight: 1.5, maxStack: 30,
        icon: "brake_caliper.png",
        description: "Hydraulic clamp that squeezes the rotor."
    },
    "brake_caliper_uncommon": {
        name: "Uncommon Brake Caliper", type: "car_component",
        category: "handling", componentType: "brake_caliper", rarity: "uncommon",
        weight: 1.5, maxStack: 20,
        icon: "brake_caliper.png",
        description: "Hydraulic clamp that squeezes the rotor."
    },
    "brake_caliper_rare": {
        name: "Rare Brake Caliper", type: "car_component",
        category: "handling", componentType: "brake_caliper", rarity: "rare",
        weight: 1.5, maxStack: 15,
        icon: "brake_caliper.png",
        description: "Hydraulic clamp that squeezes the rotor."
    },
    "brake_caliper_epic": {
        name: "Epic Brake Caliper", type: "car_component",
        category: "handling", componentType: "brake_caliper", rarity: "epic",
        weight: 1.5, maxStack: 10,
        icon: "brake_caliper.png",
        description: "Hydraulic clamp that squeezes the rotor."
    },
    "brake_caliper_legendary": {
        name: "Legendary Brake Caliper", type: "car_component",
        category: "handling", componentType: "brake_caliper", rarity: "legendary",
        weight: 1.5, maxStack: 5,
        icon: "brake_caliper.png",
        description: "Hydraulic clamp that squeezes the rotor."
    },
    "brake_pad_common": {
        name: "Common Brake Pad", type: "car_component",
        category: "handling", componentType: "brake_pad", rarity: "common",
        weight: 0.5, maxStack: 30,
        icon: "brake_pad.png",
        description: "High-friction compound for bite and fade resistance."
    },
    "brake_pad_uncommon": {
        name: "Uncommon Brake Pad", type: "car_component",
        category: "handling", componentType: "brake_pad", rarity: "uncommon",
        weight: 0.5, maxStack: 20,
        icon: "brake_pad.png",
        description: "High-friction compound for bite and fade resistance."
    },
    "brake_pad_rare": {
        name: "Rare Brake Pad", type: "car_component",
        category: "handling", componentType: "brake_pad", rarity: "rare",
        weight: 0.5, maxStack: 15,
        icon: "brake_pad.png",
        description: "High-friction compound for bite and fade resistance."
    },
    "brake_pad_epic": {
        name: "Epic Brake Pad", type: "car_component",
        category: "handling", componentType: "brake_pad", rarity: "epic",
        weight: 0.5, maxStack: 10,
        icon: "brake_pad.png",
        description: "High-friction compound for bite and fade resistance."
    },
    "brake_pad_legendary": {
        name: "Legendary Brake Pad", type: "car_component",
        category: "handling", componentType: "brake_pad", rarity: "legendary",
        weight: 0.5, maxStack: 5,
        icon: "brake_pad.png",
        description: "High-friction compound for bite and fade resistance."
    },
    "coilover_spring_common": {
        name: "Common Coilover Spring", type: "car_component",
        category: "handling", componentType: "coilover_spring", rarity: "common",
        weight: 2.0, maxStack: 30,
        icon: "coilover_spring.png",
        description: "Rate-specific spring for ride height tuning."
    },
    "coilover_spring_uncommon": {
        name: "Uncommon Coilover Spring", type: "car_component",
        category: "handling", componentType: "coilover_spring", rarity: "uncommon",
        weight: 2.0, maxStack: 20,
        icon: "coilover_spring.png",
        description: "Rate-specific spring for ride height tuning."
    },
    "coilover_spring_rare": {
        name: "Rare Coilover Spring", type: "car_component",
        category: "handling", componentType: "coilover_spring", rarity: "rare",
        weight: 2.0, maxStack: 15,
        icon: "coilover_spring.png",
        description: "Rate-specific spring for ride height tuning."
    },
    "coilover_spring_epic": {
        name: "Epic Coilover Spring", type: "car_component",
        category: "handling", componentType: "coilover_spring", rarity: "epic",
        weight: 2.0, maxStack: 10,
        icon: "coilover_spring.png",
        description: "Rate-specific spring for ride height tuning."
    },
    "coilover_spring_legendary": {
        name: "Legendary Coilover Spring", type: "car_component",
        category: "handling", componentType: "coilover_spring", rarity: "legendary",
        weight: 2.0, maxStack: 5,
        icon: "coilover_spring.png",
        description: "Rate-specific spring for ride height tuning."
    },
    "shock_absorber_common": {
        name: "Common Shock Absorber", type: "car_component",
        category: "handling", componentType: "shock_absorber", rarity: "common",
        weight: 2.5, maxStack: 30,
        icon: "shock_absorber.png",
        description: "Damper controlling suspension compression and rebound."
    },
    "shock_absorber_uncommon": {
        name: "Uncommon Shock Absorber", type: "car_component",
        category: "handling", componentType: "shock_absorber", rarity: "uncommon",
        weight: 2.5, maxStack: 20,
        icon: "shock_absorber.png",
        description: "Damper controlling suspension compression and rebound."
    },
    "shock_absorber_rare": {
        name: "Rare Shock Absorber", type: "car_component",
        category: "handling", componentType: "shock_absorber", rarity: "rare",
        weight: 2.5, maxStack: 15,
        icon: "shock_absorber.png",
        description: "Damper controlling suspension compression and rebound."
    },
    "shock_absorber_epic": {
        name: "Epic Shock Absorber", type: "car_component",
        category: "handling", componentType: "shock_absorber", rarity: "epic",
        weight: 2.5, maxStack: 10,
        icon: "shock_absorber.png",
        description: "Damper controlling suspension compression and rebound."
    },
    "shock_absorber_legendary": {
        name: "Legendary Shock Absorber", type: "car_component",
        category: "handling", componentType: "shock_absorber", rarity: "legendary",
        weight: 2.5, maxStack: 5,
        icon: "shock_absorber.png",
        description: "Damper controlling suspension compression and rebound."
    },
    "sway_bar_common": {
        name: "Common Sway Bar", type: "car_component",
        category: "handling", componentType: "sway_bar", rarity: "common",
        weight: 1.5, maxStack: 30,
        icon: "sway_bar.png",
        description: "Anti-roll bar connecting left and right suspension."
    },
    "sway_bar_uncommon": {
        name: "Uncommon Sway Bar", type: "car_component",
        category: "handling", componentType: "sway_bar", rarity: "uncommon",
        weight: 1.5, maxStack: 20,
        icon: "sway_bar.png",
        description: "Anti-roll bar connecting left and right suspension."
    },
    "sway_bar_rare": {
        name: "Rare Sway Bar", type: "car_component",
        category: "handling", componentType: "sway_bar", rarity: "rare",
        weight: 1.5, maxStack: 15,
        icon: "sway_bar.png",
        description: "Anti-roll bar connecting left and right suspension."
    },
    "sway_bar_epic": {
        name: "Epic Sway Bar", type: "car_component",
        category: "handling", componentType: "sway_bar", rarity: "epic",
        weight: 1.5, maxStack: 10,
        icon: "sway_bar.png",
        description: "Anti-roll bar connecting left and right suspension."
    },
    "sway_bar_legendary": {
        name: "Legendary Sway Bar", type: "car_component",
        category: "handling", componentType: "sway_bar", rarity: "legendary",
        weight: 1.5, maxStack: 5,
        icon: "sway_bar.png",
        description: "Anti-roll bar connecting left and right suspension."
    },
    "tire_compound_common": {
        name: "Common Tire Compound", type: "car_component",
        category: "handling", componentType: "tire_compound", rarity: "common",
        weight: 1.0, maxStack: 30,
        icon: "tire_compound.png",
        description: "Rubber formulation determining grip and wear characteristics."
    },
    "tire_compound_uncommon": {
        name: "Uncommon Tire Compound", type: "car_component",
        category: "handling", componentType: "tire_compound", rarity: "uncommon",
        weight: 1.0, maxStack: 20,
        icon: "tire_compound.png",
        description: "Rubber formulation determining grip and wear characteristics."
    },
    "tire_compound_rare": {
        name: "Rare Tire Compound", type: "car_component",
        category: "handling", componentType: "tire_compound", rarity: "rare",
        weight: 1.0, maxStack: 15,
        icon: "tire_compound.png",
        description: "Rubber formulation determining grip and wear characteristics."
    },
    "tire_compound_epic": {
        name: "Epic Tire Compound", type: "car_component",
        category: "handling", componentType: "tire_compound", rarity: "epic",
        weight: 1.0, maxStack: 10,
        icon: "tire_compound.png",
        description: "Rubber formulation determining grip and wear characteristics."
    },
    "tire_compound_legendary": {
        name: "Legendary Tire Compound", type: "car_component",
        category: "handling", componentType: "tire_compound", rarity: "legendary",
        weight: 1.0, maxStack: 5,
        icon: "tire_compound.png",
        description: "Rubber formulation determining grip and wear characteristics."
    },
    "wheel_bearing_common": {
        name: "Common Wheel Bearing", type: "car_component",
        category: "handling", componentType: "wheel_bearing", rarity: "common",
        weight: 0.5, maxStack: 30,
        icon: "wheel_bearing.png",
        description: "Low-friction bearing assembly for smooth wheel rotation."
    },
    "wheel_bearing_uncommon": {
        name: "Uncommon Wheel Bearing", type: "car_component",
        category: "handling", componentType: "wheel_bearing", rarity: "uncommon",
        weight: 0.5, maxStack: 20,
        icon: "wheel_bearing.png",
        description: "Low-friction bearing assembly for smooth wheel rotation."
    },
    "wheel_bearing_rare": {
        name: "Rare Wheel Bearing", type: "car_component",
        category: "handling", componentType: "wheel_bearing", rarity: "rare",
        weight: 0.5, maxStack: 15,
        icon: "wheel_bearing.png",
        description: "Low-friction bearing assembly for smooth wheel rotation."
    },
    "wheel_bearing_epic": {
        name: "Epic Wheel Bearing", type: "car_component",
        category: "handling", componentType: "wheel_bearing", rarity: "epic",
        weight: 0.5, maxStack: 10,
        icon: "wheel_bearing.png",
        description: "Low-friction bearing assembly for smooth wheel rotation."
    },
    "wheel_bearing_legendary": {
        name: "Legendary Wheel Bearing", type: "car_component",
        category: "handling", componentType: "wheel_bearing", rarity: "legendary",
        weight: 0.5, maxStack: 5,
        icon: "wheel_bearing.png",
        description: "Low-friction bearing assembly for smooth wheel rotation."
    },
    "chromoly_tube_common": {
        name: "Common Chromoly Tube", type: "car_component",
        category: "chassis", componentType: "chromoly_tube", rarity: "common",
        weight: 3.0, maxStack: 30,
        icon: "chromoly_tube.png",
        description: "High-strength chromoly steel tubing for cage construction."
    },
    "chromoly_tube_uncommon": {
        name: "Uncommon Chromoly Tube", type: "car_component",
        category: "chassis", componentType: "chromoly_tube", rarity: "uncommon",
        weight: 3.0, maxStack: 20,
        icon: "chromoly_tube.png",
        description: "High-strength chromoly steel tubing for cage construction."
    },
    "chromoly_tube_rare": {
        name: "Rare Chromoly Tube", type: "car_component",
        category: "chassis", componentType: "chromoly_tube", rarity: "rare",
        weight: 3.0, maxStack: 15,
        icon: "chromoly_tube.png",
        description: "High-strength chromoly steel tubing for cage construction."
    },
    "chromoly_tube_epic": {
        name: "Epic Chromoly Tube", type: "car_component",
        category: "chassis", componentType: "chromoly_tube", rarity: "epic",
        weight: 3.0, maxStack: 10,
        icon: "chromoly_tube.png",
        description: "High-strength chromoly steel tubing for cage construction."
    },
    "chromoly_tube_legendary": {
        name: "Legendary Chromoly Tube", type: "car_component",
        category: "chassis", componentType: "chromoly_tube", rarity: "legendary",
        weight: 3.0, maxStack: 5,
        icon: "chromoly_tube.png",
        description: "High-strength chromoly steel tubing for cage construction."
    },
    "gusset_plate_common": {
        name: "Common Gusset Plate", type: "car_component",
        category: "chassis", componentType: "gusset_plate", rarity: "common",
        weight: 1.0, maxStack: 30,
        icon: "gusset_plate.png",
        description: "Reinforcement plate for cage joint strength."
    },
    "gusset_plate_uncommon": {
        name: "Uncommon Gusset Plate", type: "car_component",
        category: "chassis", componentType: "gusset_plate", rarity: "uncommon",
        weight: 1.0, maxStack: 20,
        icon: "gusset_plate.png",
        description: "Reinforcement plate for cage joint strength."
    },
    "gusset_plate_rare": {
        name: "Rare Gusset Plate", type: "car_component",
        category: "chassis", componentType: "gusset_plate", rarity: "rare",
        weight: 1.0, maxStack: 15,
        icon: "gusset_plate.png",
        description: "Reinforcement plate for cage joint strength."
    },
    "gusset_plate_epic": {
        name: "Epic Gusset Plate", type: "car_component",
        category: "chassis", componentType: "gusset_plate", rarity: "epic",
        weight: 1.0, maxStack: 10,
        icon: "gusset_plate.png",
        description: "Reinforcement plate for cage joint strength."
    },
    "gusset_plate_legendary": {
        name: "Legendary Gusset Plate", type: "car_component",
        category: "chassis", componentType: "gusset_plate", rarity: "legendary",
        weight: 1.0, maxStack: 5,
        icon: "gusset_plate.png",
        description: "Reinforcement plate for cage joint strength."
    },
    "carbon_panel_common": {
        name: "Common Carbon Panel", type: "car_component",
        category: "chassis", componentType: "carbon_panel", rarity: "common",
        weight: 1.5, maxStack: 30,
        icon: "carbon_panel.png",
        description: "Carbon fibre replacement panel, drastically lighter than steel."
    },
    "carbon_panel_uncommon": {
        name: "Uncommon Carbon Panel", type: "car_component",
        category: "chassis", componentType: "carbon_panel", rarity: "uncommon",
        weight: 1.5, maxStack: 20,
        icon: "carbon_panel.png",
        description: "Carbon fibre replacement panel, drastically lighter than steel."
    },
    "carbon_panel_rare": {
        name: "Rare Carbon Panel", type: "car_component",
        category: "chassis", componentType: "carbon_panel", rarity: "rare",
        weight: 1.5, maxStack: 15,
        icon: "carbon_panel.png",
        description: "Carbon fibre replacement panel, drastically lighter than steel."
    },
    "carbon_panel_epic": {
        name: "Epic Carbon Panel", type: "car_component",
        category: "chassis", componentType: "carbon_panel", rarity: "epic",
        weight: 1.5, maxStack: 10,
        icon: "carbon_panel.png",
        description: "Carbon fibre replacement panel, drastically lighter than steel."
    },
    "carbon_panel_legendary": {
        name: "Legendary Carbon Panel", type: "car_component",
        category: "chassis", componentType: "carbon_panel", rarity: "legendary",
        weight: 1.5, maxStack: 5,
        icon: "carbon_panel.png",
        description: "Carbon fibre replacement panel, drastically lighter than steel."
    },
    "aluminum_hardware_common": {
        name: "Common Aluminum Hardware", type: "car_component",
        category: "chassis", componentType: "aluminum_hardware", rarity: "common",
        weight: 0.5, maxStack: 30,
        icon: "aluminum_hardware.png",
        description: "Lightweight fasteners, brackets and mounts."
    },
    "aluminum_hardware_uncommon": {
        name: "Uncommon Aluminum Hardware", type: "car_component",
        category: "chassis", componentType: "aluminum_hardware", rarity: "uncommon",
        weight: 0.5, maxStack: 20,
        icon: "aluminum_hardware.png",
        description: "Lightweight fasteners, brackets and mounts."
    },
    "aluminum_hardware_rare": {
        name: "Rare Aluminum Hardware", type: "car_component",
        category: "chassis", componentType: "aluminum_hardware", rarity: "rare",
        weight: 0.5, maxStack: 15,
        icon: "aluminum_hardware.png",
        description: "Lightweight fasteners, brackets and mounts."
    },
    "aluminum_hardware_epic": {
        name: "Epic Aluminum Hardware", type: "car_component",
        category: "chassis", componentType: "aluminum_hardware", rarity: "epic",
        weight: 0.5, maxStack: 10,
        icon: "aluminum_hardware.png",
        description: "Lightweight fasteners, brackets and mounts."
    },
    "aluminum_hardware_legendary": {
        name: "Legendary Aluminum Hardware", type: "car_component",
        category: "chassis", componentType: "aluminum_hardware", rarity: "legendary",
        weight: 0.5, maxStack: 5,
        icon: "aluminum_hardware.png",
        description: "Lightweight fasteners, brackets and mounts."
    },
    "hydraulic_cylinder_common": {
        name: "Common Hydraulic Cylinder", type: "car_component",
        category: "special", componentType: "hydraulic_cylinder", rarity: "common",
        weight: 1.5, maxStack: 30,
        icon: "hydraulic_cylinder.png",
        description: "Hydraulic actuator for the handbrake circuit."
    },
    "hydraulic_cylinder_uncommon": {
        name: "Uncommon Hydraulic Cylinder", type: "car_component",
        category: "special", componentType: "hydraulic_cylinder", rarity: "uncommon",
        weight: 1.5, maxStack: 20,
        icon: "hydraulic_cylinder.png",
        description: "Hydraulic actuator for the handbrake circuit."
    },
    "hydraulic_cylinder_rare": {
        name: "Rare Hydraulic Cylinder", type: "car_component",
        category: "special", componentType: "hydraulic_cylinder", rarity: "rare",
        weight: 1.5, maxStack: 15,
        icon: "hydraulic_cylinder.png",
        description: "Hydraulic actuator for the handbrake circuit."
    },
    "hydraulic_cylinder_epic": {
        name: "Epic Hydraulic Cylinder", type: "car_component",
        category: "special", componentType: "hydraulic_cylinder", rarity: "epic",
        weight: 1.5, maxStack: 10,
        icon: "hydraulic_cylinder.png",
        description: "Hydraulic actuator for the handbrake circuit."
    },
    "hydraulic_cylinder_legendary": {
        name: "Legendary Hydraulic Cylinder", type: "car_component",
        category: "special", componentType: "hydraulic_cylinder", rarity: "legendary",
        weight: 1.5, maxStack: 5,
        icon: "hydraulic_cylinder.png",
        description: "Hydraulic actuator for the handbrake circuit."
    },
    "bias_valve_common": {
        name: "Common Bias Valve", type: "car_component",
        category: "special", componentType: "bias_valve", rarity: "common",
        weight: 0.5, maxStack: 30,
        icon: "bias_valve.png",
        description: "Adjustable proportioning valve for rear brake bias."
    },
    "bias_valve_uncommon": {
        name: "Uncommon Bias Valve", type: "car_component",
        category: "special", componentType: "bias_valve", rarity: "uncommon",
        weight: 0.5, maxStack: 20,
        icon: "bias_valve.png",
        description: "Adjustable proportioning valve for rear brake bias."
    },
    "bias_valve_rare": {
        name: "Rare Bias Valve", type: "car_component",
        category: "special", componentType: "bias_valve", rarity: "rare",
        weight: 0.5, maxStack: 15,
        icon: "bias_valve.png",
        description: "Adjustable proportioning valve for rear brake bias."
    },
    "bias_valve_epic": {
        name: "Epic Bias Valve", type: "car_component",
        category: "special", componentType: "bias_valve", rarity: "epic",
        weight: 0.5, maxStack: 10,
        icon: "bias_valve.png",
        description: "Adjustable proportioning valve for rear brake bias."
    },
    "bias_valve_legendary": {
        name: "Legendary Bias Valve", type: "car_component",
        category: "special", componentType: "bias_valve", rarity: "legendary",
        weight: 0.5, maxStack: 5,
        icon: "bias_valve.png",
        description: "Adjustable proportioning valve for rear brake bias."
    },
    "launch_module_common": {
        name: "Common Launch Module", type: "car_component",
        category: "special", componentType: "launch_module", rarity: "common",
        weight: 0.5, maxStack: 30,
        icon: "launch_module.png",
        description: "Electronic module managing RPM hold and boost build."
    },
    "launch_module_uncommon": {
        name: "Uncommon Launch Module", type: "car_component",
        category: "special", componentType: "launch_module", rarity: "uncommon",
        weight: 0.5, maxStack: 20,
        icon: "launch_module.png",
        description: "Electronic module managing RPM hold and boost build."
    },
    "launch_module_rare": {
        name: "Rare Launch Module", type: "car_component",
        category: "special", componentType: "launch_module", rarity: "rare",
        weight: 0.5, maxStack: 15,
        icon: "launch_module.png",
        description: "Electronic module managing RPM hold and boost build."
    },
    "launch_module_epic": {
        name: "Epic Launch Module", type: "car_component",
        category: "special", componentType: "launch_module", rarity: "epic",
        weight: 0.5, maxStack: 10,
        icon: "launch_module.png",
        description: "Electronic module managing RPM hold and boost build."
    },
    "launch_module_legendary": {
        name: "Legendary Launch Module", type: "car_component",
        category: "special", componentType: "launch_module", rarity: "legendary",
        weight: 0.5, maxStack: 5,
        icon: "launch_module.png",
        description: "Electronic module managing RPM hold and boost build."
    },
    "rev_limiter_common": {
        name: "Common Rev Limiter", type: "car_component",
        category: "special", componentType: "rev_limiter", rarity: "common",
        weight: 0.3, maxStack: 30,
        icon: "rev_limiter.png",
        description: "Programmable two-step rev limiter chip."
    },
    "rev_limiter_uncommon": {
        name: "Uncommon Rev Limiter", type: "car_component",
        category: "special", componentType: "rev_limiter", rarity: "uncommon",
        weight: 0.3, maxStack: 20,
        icon: "rev_limiter.png",
        description: "Programmable two-step rev limiter chip."
    },
    "rev_limiter_rare": {
        name: "Rare Rev Limiter", type: "car_component",
        category: "special", componentType: "rev_limiter", rarity: "rare",
        weight: 0.3, maxStack: 15,
        icon: "rev_limiter.png",
        description: "Programmable two-step rev limiter chip."
    },
    "rev_limiter_epic": {
        name: "Epic Rev Limiter", type: "car_component",
        category: "special", componentType: "rev_limiter", rarity: "epic",
        weight: 0.3, maxStack: 10,
        icon: "rev_limiter.png",
        description: "Programmable two-step rev limiter chip."
    },
    "rev_limiter_legendary": {
        name: "Legendary Rev Limiter", type: "car_component",
        category: "special", componentType: "rev_limiter", rarity: "legendary",
        weight: 0.3, maxStack: 5,
        icon: "rev_limiter.png",
        description: "Programmable two-step rev limiter chip."
    },
    "lift_spacer_common": {
        name: "Common Lift Spacer", type: "car_component",
        category: "special", componentType: "lift_spacer", rarity: "common",
        weight: 1.5, maxStack: 30,
        icon: "lift_spacer.png",
        description: "Billet spacer raising the body from the frame."
    },
    "lift_spacer_uncommon": {
        name: "Uncommon Lift Spacer", type: "car_component",
        category: "special", componentType: "lift_spacer", rarity: "uncommon",
        weight: 1.5, maxStack: 20,
        icon: "lift_spacer.png",
        description: "Billet spacer raising the body from the frame."
    },
    "lift_spacer_rare": {
        name: "Rare Lift Spacer", type: "car_component",
        category: "special", componentType: "lift_spacer", rarity: "rare",
        weight: 1.5, maxStack: 15,
        icon: "lift_spacer.png",
        description: "Billet spacer raising the body from the frame."
    },
    "lift_spacer_epic": {
        name: "Epic Lift Spacer", type: "car_component",
        category: "special", componentType: "lift_spacer", rarity: "epic",
        weight: 1.5, maxStack: 10,
        icon: "lift_spacer.png",
        description: "Billet spacer raising the body from the frame."
    },
    "lift_spacer_legendary": {
        name: "Legendary Lift Spacer", type: "car_component",
        category: "special", componentType: "lift_spacer", rarity: "legendary",
        weight: 1.5, maxStack: 5,
        icon: "lift_spacer.png",
        description: "Billet spacer raising the body from the frame."
    },
    "extended_shock_common": {
        name: "Common Extended Shock", type: "car_component",
        category: "special", componentType: "extended_shock", rarity: "common",
        weight: 2.0, maxStack: 30,
        icon: "extended_shock.png",
        description: "Long-travel shock absorber for lift kit applications."
    },
    "extended_shock_uncommon": {
        name: "Uncommon Extended Shock", type: "car_component",
        category: "special", componentType: "extended_shock", rarity: "uncommon",
        weight: 2.0, maxStack: 20,
        icon: "extended_shock.png",
        description: "Long-travel shock absorber for lift kit applications."
    },
    "extended_shock_rare": {
        name: "Rare Extended Shock", type: "car_component",
        category: "special", componentType: "extended_shock", rarity: "rare",
        weight: 2.0, maxStack: 15,
        icon: "extended_shock.png",
        description: "Long-travel shock absorber for lift kit applications."
    },
    "extended_shock_epic": {
        name: "Epic Extended Shock", type: "car_component",
        category: "special", componentType: "extended_shock", rarity: "epic",
        weight: 2.0, maxStack: 10,
        icon: "extended_shock.png",
        description: "Long-travel shock absorber for lift kit applications."
    },
    "extended_shock_legendary": {
        name: "Legendary Extended Shock", type: "car_component",
        category: "special", componentType: "extended_shock", rarity: "legendary",
        weight: 2.0, maxStack: 5,
        icon: "extended_shock.png",
        description: "Long-travel shock absorber for lift kit applications."
    },
    "carbon_wing_common": {
        name: "Common Carbon Wing", type: "car_component",
        category: "special", componentType: "carbon_wing", rarity: "common",
        weight: 2.5, maxStack: 30,
        icon: "carbon_wing.png",
        description: "Full carbon fibre aerodynamic wing element."
    },
    "carbon_wing_uncommon": {
        name: "Uncommon Carbon Wing", type: "car_component",
        category: "special", componentType: "carbon_wing", rarity: "uncommon",
        weight: 2.5, maxStack: 20,
        icon: "carbon_wing.png",
        description: "Full carbon fibre aerodynamic wing element."
    },
    "carbon_wing_rare": {
        name: "Rare Carbon Wing", type: "car_component",
        category: "special", componentType: "carbon_wing", rarity: "rare",
        weight: 2.5, maxStack: 15,
        icon: "carbon_wing.png",
        description: "Full carbon fibre aerodynamic wing element."
    },
    "carbon_wing_epic": {
        name: "Epic Carbon Wing", type: "car_component",
        category: "special", componentType: "carbon_wing", rarity: "epic",
        weight: 2.5, maxStack: 10,
        icon: "carbon_wing.png",
        description: "Full carbon fibre aerodynamic wing element."
    },
    "carbon_wing_legendary": {
        name: "Legendary Carbon Wing", type: "car_component",
        category: "special", componentType: "carbon_wing", rarity: "legendary",
        weight: 2.5, maxStack: 5,
        icon: "carbon_wing.png",
        description: "Full carbon fibre aerodynamic wing element."
    },
    "actuator_motor_common": {
        name: "Common Actuator Motor", type: "car_component",
        category: "special", componentType: "actuator_motor", rarity: "common",
        weight: 1.0, maxStack: 30,
        icon: "actuator_motor.png",
        description: "Servo motor controlling active wing angle."
    },
    "actuator_motor_uncommon": {
        name: "Uncommon Actuator Motor", type: "car_component",
        category: "special", componentType: "actuator_motor", rarity: "uncommon",
        weight: 1.0, maxStack: 20,
        icon: "actuator_motor.png",
        description: "Servo motor controlling active wing angle."
    },
    "actuator_motor_rare": {
        name: "Rare Actuator Motor", type: "car_component",
        category: "special", componentType: "actuator_motor", rarity: "rare",
        weight: 1.0, maxStack: 15,
        icon: "actuator_motor.png",
        description: "Servo motor controlling active wing angle."
    },
    "actuator_motor_epic": {
        name: "Epic Actuator Motor", type: "car_component",
        category: "special", componentType: "actuator_motor", rarity: "epic",
        weight: 1.0, maxStack: 10,
        icon: "actuator_motor.png",
        description: "Servo motor controlling active wing angle."
    },
    "actuator_motor_legendary": {
        name: "Legendary Actuator Motor", type: "car_component",
        category: "special", componentType: "actuator_motor", rarity: "legendary",
        weight: 1.0, maxStack: 5,
        icon: "actuator_motor.png",
        description: "Servo motor controlling active wing angle."
    },
    "tune_kit_common": {
        name: "Common Tune Kit", type: "car_component",
        category: "special", componentType: "tune_kit", rarity: "common",
        weight: 0.5, maxStack: 30,
        icon: "tune_kit.png",
        description: "All-in-one street performance tuning package."
    },
    "tune_kit_uncommon": {
        name: "Uncommon Tune Kit", type: "car_component",
        category: "special", componentType: "tune_kit", rarity: "uncommon",
        weight: 0.5, maxStack: 20,
        icon: "tune_kit.png",
        description: "All-in-one street performance tuning package."
    },
    "tune_kit_rare": {
        name: "Rare Tune Kit", type: "car_component",
        category: "special", componentType: "tune_kit", rarity: "rare",
        weight: 0.5, maxStack: 15,
        icon: "tune_kit.png",
        description: "All-in-one street performance tuning package."
    },
    "tune_kit_epic": {
        name: "Epic Tune Kit", type: "car_component",
        category: "special", componentType: "tune_kit", rarity: "epic",
        weight: 0.5, maxStack: 10,
        icon: "tune_kit.png",
        description: "All-in-one street performance tuning package."
    },
    "tune_kit_legendary": {
        name: "Legendary Tune Kit", type: "car_component",
        category: "special", componentType: "tune_kit", rarity: "legendary",
        weight: 0.5, maxStack: 5,
        icon: "tune_kit.png",
        description: "All-in-one street performance tuning package."
    },
    "sport_spring_common": {
        name: "Common Sport Spring", type: "car_component",
        category: "special", componentType: "sport_spring", rarity: "common",
        weight: 1.0, maxStack: 30,
        icon: "sport_spring.png",
        description: "Progressive rate lowering spring set."
    },
    "sport_spring_uncommon": {
        name: "Uncommon Sport Spring", type: "car_component",
        category: "special", componentType: "sport_spring", rarity: "uncommon",
        weight: 1.0, maxStack: 20,
        icon: "sport_spring.png",
        description: "Progressive rate lowering spring set."
    },
    "sport_spring_rare": {
        name: "Rare Sport Spring", type: "car_component",
        category: "special", componentType: "sport_spring", rarity: "rare",
        weight: 1.0, maxStack: 15,
        icon: "sport_spring.png",
        description: "Progressive rate lowering spring set."
    },
    "sport_spring_epic": {
        name: "Epic Sport Spring", type: "car_component",
        category: "special", componentType: "sport_spring", rarity: "epic",
        weight: 1.0, maxStack: 10,
        icon: "sport_spring.png",
        description: "Progressive rate lowering spring set."
    },
    "sport_spring_legendary": {
        name: "Legendary Sport Spring", type: "car_component",
        category: "special", componentType: "sport_spring", rarity: "legendary",
        weight: 1.0, maxStack: 5,
        icon: "sport_spring.png",
        description: "Progressive rate lowering spring set."
    },

    // ── CARD PACKS ────────────────────────────────────────────────────────────
    "tuning_pack": {
        name: "Tuning Card Pack",
        type: "cardpack",
        weight: 0.1,
        maxStack: 10,
        icon: "tuning_pack.png",
        data: { packId: "tuning_pack" }
    },
    "power_pack": {
        name: "Power Card Pack",
        type: "cardpack",
        weight: 0.1,
        maxStack: 10,
        icon: "power_pack.png",
        data: { packId: "power_pack" }
    },
    "drivetrain_pack": {
        name: "Drivetrain Card Pack",
        type: "cardpack",
        weight: 0.1,
        maxStack: 10,
        icon: "drivetrain_pack.png",
        data: { packId: "drivetrain_pack" }
    },
    "handling_pack": {
        name: "Handling Card Pack",
        type: "cardpack",
        weight: 0.1,
        maxStack: 10,
        icon: "handling_pack.png",
        data: { packId: "handling_pack" }
    },
    "chassis_pack": {
        name: "Chassis Card Pack",
        type: "cardpack",
        weight: 0.1,
        maxStack: 10,
        icon: "chassis_pack.png",
        data: { packId: "chassis_pack" }
    },
    "special_pack": {
        name: "Special Card Pack",
        type: "cardpack",
        weight: 0.1,
        maxStack: 10,
        icon: "special_pack.png",
        data: { packId: "special_pack" }
    },
};