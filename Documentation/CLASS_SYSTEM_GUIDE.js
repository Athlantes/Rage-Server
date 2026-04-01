/**
 * CHARACTER CLASS SYSTEM - IMPLEMENTATION GUIDE
 * 
 * A modular, scalable character class system with subclasses and bonuses
 * Designed for easy integration with other game systems
 */

// ═════════════════════════════════════════════════════════════════════════════
// OVERVIEW
// ═════════════════════════════════════════════════════════════════════════════

/*
 * The Character Class System consists of:
 * 
 * 1. 6 Balanced Classes with 3 Subclasses each
 * 2. Flexible Bonus System
 * 3. Full Server-Client Integration
 * 4. Beautiful Spawn-Selector-Style UI
 * 5. Database Persistence
 * 
 * CLASSES:
 * - ENFORCER (🛡️ #FF3333)   - Combat focused, slowest movement
 * - HUSTLER (💰 #FFB700)     - Money focused, balanced bonuses
 * - CRAFTSMAN (🔧 #8B4513)   - Crafting focused, building specialist
 * - RACER (🏎️ #FF00FF)       - Speed focused, fastest movement
 * - MEDIC (🏥 #00CC66)       - Support focused, healing bonuses
 * - INFILTRATOR (👻 #0099FF) - Stealth focused, hacking specialist
 * 
 * EACH CLASS HAS 3 SUBCLASSES:
 * - Entry Level (15% bonus)
 * - Mid Level (25% bonus)
 * - Expert Level (40% bonus)
 */

// ═════════════════════════════════════════════════════════════════════════════
// FILE STRUCTURE
// ═════════════════════════════════════════════════════════════════════════════

/*
 * SERVER-SIDE:
 * - packages/systems/classDefinitions.js  - Class data and bonus definitions
 * - packages/systems/classManager.js      - Server logic and database operations
 * - packages/systems/charCreator.js       - MODIFIED: Integrates class selector
 * - packages/systems/index.js             - MODIFIED: Requires classManager
 * - sql/sql.sql                           - MODIFIED: Added character_classes table
 * 
 * CLIENT-SIDE:
 * - client_packages/systems/classSelector.js - Client event handlers
 * - client_packages/ui/classSelector/
 *   ├── index.html  - Main UI structure
 *   ├── styles.css  - Styling (spawn selector theme)
 *   └── app.js      - UI logic and interactions
 * - client_packages/index.js              - MODIFIED: Requires classSelector
 */

// ═════════════════════════════════════════════════════════════════════════════
// WORKFLOW
// ═════════════════════════════════════════════════════════════════════════════

/*
 * 1. Player completes character creation (charCreator.js)
 * 2. Server checks if player has a class (classManager.hasClass)
 * 3. If no class: server calls client to show class selector
 * 4. Player sees 6 class cards (can select one)
 * 5. Player selects subclass and sees bonuses
 * 6. Player confirms selection
 * 7. Client sends: client:classSelector:confirm (classId, subclassId)
 * 8. Server saves to database (classManager.savePlayerClass)
 * 9. Server applies all bonuses (classManager.applyClassBonuses)
 * 10. Player enters game with class bonuses active
 */

// ═════════════════════════════════════════════════════════════════════════════
// INTEGRATION: HOW TO USE IN OTHER SYSTEMS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * EXAMPLE 1: ATM SKIMMER COOLDOWN REDUCTION
 * 
 * In: packages/systems/atmSkimmer.js (or wherever you define ATM skimmer logic)
 */

// --- BEFORE (without classes) ---
const BASE_COOLDOWN = 600000; // 10 minutes

// --- AFTER (with classes) ---
const classManager = require('../packages/systems/classManager');

const startATMSkimmer = (player) => {
    const baseCooldown = 600000; // 10 minutes
    
    // Get the multiplier from player's class
    // For Infiltrator: Ghost = 0.75 (25% faster)
    const cooldownMultiplier = classManager.getClassBonus(player, 'atmSkimmerCooldownMultiplier', 1.0);
    
    const actualCooldown = baseCooldown * cooldownMultiplier;
    
    console.log(`[ATM Skimmer] Cooldown: ${actualCooldown}ms (Multiplier: ${cooldownMultiplier})`);
    
    // Continue with normal skimmer logic...
    setTimer(actualCooldown, () => {
        // Cooldown expires
    });
};

/**
 * EXAMPLE 2: CAR CRAFTING SPEED & MATERIAL COST
 * 
 * In: packages/systems/carCrafting.js
 */

const carCraftingStart = (player, recipe) => {
    // Get both bonuses at once
    const bonuses = classManager.getClassBonuses(player, [
        'carCraftingSpeedMultiplier',
        'materialCostMultiplier'
    ]);
    
    // Adjust crafting time
    const baseTime = recipe.craftTime; // e.g., 300000ms (5 minutes)
    const actualTime = baseTime / bonuses.carCraftingSpeedMultiplier;
    
    // Adjust material costs
    const adjustedRecipe = recipe.materials.map(material => ({
        ...material,
        required: Math.ceil(material.required * bonuses.materialCostMultiplier)
    }));
    
    console.log(`[Car Crafting] Time: ${actualTime}ms, Materials reduced by: ${Math.round((1 - bonuses.materialCostMultiplier) * 100)}%`);
    
    // Continue with crafting...
};

/**
 * EXAMPLE 3: JOB PAY BONUS
 * 
 * In: packages/jobs/farmer.js, trucker.js, etc.
 */

const completeJobTask = (player, payment) => {
    const jobPayMultiplier = classManager.getClassBonus(player, 'jobPayMultiplier', 1.0);
    const finalPayment = Math.floor(payment * jobPayMultiplier);
    
    player.giveMoneyBank(finalPayment);
    player.outputChatBox(`!{32FF32}+$${finalPayment} (Class Bonus: ${Math.round((jobPayMultiplier - 1) * 100)}%)`);
};

/**
 * EXAMPLE 4: HEALING SYSTEM
 * 
 * In: wherever you handle medic revivals
 */

const revivePlayer = (medic, targetPlayer) => {
    const reviveSpeedMultiplier = classManager.getClassBonus(medic, 'reviveSpeedMultiplier', 1.0);
    const reviveTime = 30000; // 30 seconds base
    const actualTime = reviveTime / reviveSpeedMultiplier;
    
    console.log(`[Medic] Revive time: ${actualTime}ms for ${targetPlayer.name}`);
    
    // Start revive animation/progress
};

/**
 * EXAMPLE 5: CUSTOM BONUS NOT IN DEFINITIONS
 * 
 * If you need to add a new bonus type that doesn't exist:
 * 
 * 1. Add to classDefinitions.js BONUS_CALLBACKS:
 */

// In BONUS_CALLBACKS object:
// myCustomBonus: (player, value) => {
//     if (player.data.classData) player.data.classData.myCustomBonusMultiplier = value;
// },

// 2. Add bonus to subclass definition:
// In CLASS_DEFINITIONS > hustler > grinder:
// myCustomBonus: { type: 'percentModifier', value: 1.20 },

// 3. Retrieve in your system:
// const bonus = classManager.getClassBonus(player, 'myCustomBonusMultiplier', 1.0);

// ═════════════════════════════════════════════════════════════════════════════
// KEY API FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * classManager.hasClass(player)
 * Check if player has a class selected
 * @returns boolean
 */

/**
 * classManager.getPlayerClassId(player)
 * Get player's class ID (e.g., 'ENFORCER')
 * @returns string or null
 */

/**
 * classManager.getPlayerSubclassId(player)
 * Get player's subclass ID (e.g., 'soldier')
 * @returns string or null
 */

/**
 * classManager.getPlayerClassInfo(player)
 * Get full class data object
 * @returns object or null
 */

/**
 * classManager.getClassBonus(player, bonusKey, defaultValue)
 * Get a single bonus multiplier
 * @param player - Player object
 * @param bonusKey - String like 'jobPayMultiplier', 'craftingSpeedMultiplier'
 * @param defaultValue - Return value if bonus not found (default: 1.0)
 * @returns number
 */

/**
 * classManager.getClassBonuses(player, bonusKeys)
 * Get multiple bonuses at once
 * @param player - Player object
 * @param bonusKeys - Array of bonus key strings
 * @returns object like { jobPayMultiplier: 1.25, craftingSpeedMultiplier: 1.15 }
 */

/**
 * classManager.savePlayerClass(player, classId, subclassId)
 * Manually save a class (usually not needed, automatic during creation)
 * @returns boolean (success)
 */

// ═════════════════════════════════════════════════════════════════════════════
// ADDING NEW CLASSES OR MODIFYING
// ═════════════════════════════════════════════════════════════════════════════

/*
 * TO ADD A NEW CLASS:
 * 
 * 1. Open packages/systems/classDefinitions.js
 * 2. Add new entry to CLASS_DEFINITIONS object:
 * 
 * NEWCLASS: {
 *     id: 'newclass',
 *     name: 'NEWCLASS',
 *     icon: '🎯',
 *     color: '#FF0000',
 *     description: 'Description here',
 *     story: 'Story text',
 *     subclasses: {
 *         subclass1: {
 *             name: 'Subclass 1 Name',
 *             description: 'Description',
 *             bonuses: {
 *                 bonusKey1: { type: 'percentModifier', value: 1.15 },
 *                 bonusKey2: { type: 'cooldownReduction', value: 0.90 }
 *             }
 *         },
 *         // ... more subclasses
 *     }
 * }
 * 
 * 3. Update client-side UI in client_packages/ui/classSelector/app.js
 *    Add to CLASSES object with matching structure
 * 
 * TO MODIFY EXISTING BONUSES:
 * 
 * Edit the value in classDefinitions.js
 * Example: change 1.15 to 1.25 for stronger bonus
 */

// ═════════════════════════════════════════════════════════════════════════════
// DATABASE SCHEMA
// ═════════════════════════════════════════════════════════════════════════════

/*
 * CREATE TABLE character_classes (
 *     id INT AUTO_INCREMENT PRIMARY KEY,
 *     character_id INT NOT NULL UNIQUE,
 *     class_id VARCHAR(50) NOT NULL,
 *     subclass_id VARCHAR(50) NOT NULL,
 *     selected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 *     FOREIGN KEY (character_id) REFERENCES users(id) ON DELETE CASCADE
 * );
 * 
 * This table stores:
 * - One record per character (unique character_id)
 * - The selected class_id and subclass_id
 * - When they selected it
 */

// ═════════════════════════════════════════════════════════════════════════════
// BONUS TYPES & MULTIPLIERS
// ═════════════════════════════════════════════════════════════════════════════

/*
 * PERCENT MODIFIER:
 * type: 'percentModifier'
 * value: 1.15 means 15% increase, 0.9 means 10% decrease
 * Usage: result = baseValue * multiplier
 * Example: damage = 100 * 1.25 = 125 (25% more)
 * 
 * FLAT BONUS:
 * type: 'flatBonus'
 * value: Direct numeric addition
 * Usage: result = baseValue + bonus
 * Example: armor = 50 + 10 = 60
 * 
 * COOLDOWN REDUCTION:
 * type: 'cooldownReduction'
 * value: 0.8 means 20% faster (cooldown * 0.8)
 * Usage: cooldown = baseCooldown * multiplier
 * Example: cooldown = 600000 * 0.75 = 450000 (25% faster)
 */

// ═════════════════════════════════════════════════════════════════════════════
// TESTING
// ═════════════════════════════════════════════════════════════════════════════

/*
 * In-game testing:
 * 
 * 1. Create a new character
 * 2. Select a class from the UI
 * 3. Check console for: "[ClassManager] Applied bonuses for CLASS/SUBCLASS"
 * 4. Check database: SELECT * FROM character_classes WHERE character_id = X
 * 5. Test any integrated system (e.g., ATM skimmer cooldowns)
 * 
 * Debug command (add to core if needed):
 * mp.events.add('checkClass', (player) => {
 *     const info = classManager.getPlayerClassInfo(player);
 *     console.log('Class Info:', info);
 * });
 */

// ═════════════════════════════════════════════════════════════════════════════
// TROUBLESHOOTING
// ═════════════════════════════════════════════════════════════════════════════

/*
 * Q: Class selector doesn't appear after char creation
 * A: Check client_packages/index.js includes classSelector.js
 *    Make sure charCreator.js requires classManager.js
 *    Check database for character_classes table
 * 
 * Q: Bonuses not applying
 * A: Verify bonus key names match exactly (case sensitive)
 *    Check BONUS_CALLBACKS in classDefinitions.js
 *    Verify your system is calling getClassBonus correctly
 *    Check that player.data.classData exists
 * 
 * Q: UI won't load
 * A: Check client_packages/ui/classSelector/ files exist
 *    Verify app.js has correct CLASSES object
 *    Check browser console for JavaScript errors
 *    Ensure paths in index.html are correct
 * 
 * Q: Class not saving to database
 * A: Check character_id is valid
 *    Verify database connection working
 *    Check classManager logs for errors
 *    Ensure user has permissions to write to database
 */

module.exports = {
    guide: {
        overview: 'See top of this file',
        integration: 'See INTEGRATION section',
        api: 'See KEY API FUNCTIONS section',
        database: 'See DATABASE SCHEMA section'
    }
};
