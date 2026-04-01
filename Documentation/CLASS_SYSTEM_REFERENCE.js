/**
 * CHARACTER CLASS SYSTEM - QUICK REFERENCE
 * 
 * A concise reference for the Character Class System
 */

// ═════════════════════════════════════════════════════════════════════════════
// CLASSES & SUBCLASSES
// ═════════════════════════════════════════════════════════════════════════════

/*
ENFORCER 🛡️ (#FF3333) - Combat specialist, slowest movement
├── Soldier      (15% combat bonus)
├── Enforcer     (25% combat bonus)
└── Warlord      (40% combat bonus)

HUSTLER 💰 (#FFB700) - Money maker, balanced
├── Grinder      (15% job pay, 5% crafting speed)
├── Entrepreneur (25% job pay, 10% crafting speed)
└── Tycoon       (40% job pay, 15% crafting speed)

CRAFTSMAN 🔧 (#8B4513) - Building specialist, -material cost
├── Apprentice   (15% speed, -10% cost)
├── Master       (25% speed, -20% cost)
└── Legendary    (40% speed, -30% cost)

RACER 🏎️ (#FF00FF) - Speed demon, fastest movement
├── Rookie       (15% speed, 5% vehicle control)
├── Pro          (25% speed, 10% vehicle control)
└── Legend       (40% speed, 15% vehicle control)

MEDIC 🏥 (#00CC66) - Support, healing specialist
├── Paramedic    (20% healing, 10% revive speed)
├── Doctor       (35% healing, 20% revive speed)
└── Surgeon      (50% healing, 30% revive speed)

INFILTRATOR 👻 (#0099FF) - Stealth master, faster hacking
├── Scout        (15% stealth, -10% hacking cooldown)
├── Operative    (25% stealth, -20% hacking cooldown)
└── Ghost        (40% stealth, -30% hacking cooldown)
*/

// ═════════════════════════════════════════════════════════════════════════════
// KEY FILES
// ═════════════════════════════════════════════════════════════════════════════

/*
SERVER:
- packages/systems/classDefinitions.js    ← Class data definitions
- packages/systems/classManager.js        ← Main API (getClassBonus, etc.)
- packages/systems/charCreator.js         ← MODIFIED (triggers selector)

CLIENT:
- client_packages/systems/classSelector.js      ← Event handlers
- client_packages/ui/classSelector/index.html   ← UI
- client_packages/ui/classSelector/styles.css   ← Styling
- client_packages/ui/classSelector/app.js       ← UI Logic

DATABASE:
- sql/sql.sql                             ← character_classes table

CONFIG:
- packages/systems/index.js               ← MODIFIED (requires classManager)
- client_packages/index.js                ← MODIFIED (requires classSelector)
*/

// ═════════════════════════════════════════════════════════════════════════════
// API REFERENCE
// ═════════════════════════════════════════════════════════════════════════════

/*
Import at top of file:
const classManager = require('./classManager');

MAIN FUNCTIONS:
─────────────────────────────────────────────────────────────────────────────

classManager.hasClass(player)
→ Returns: boolean
→ Usage: Check if player has selected a class

classManager.getPlayerClassId(player)
→ Returns: string (e.g., 'HUSTLER') or null
→ Usage: Get which class player is

classManager.getPlayerSubclassId(player)
→ Returns: string (e.g., 'tycoon') or null
→ Usage: Get which subclass player is

classManager.getPlayerClassInfo(player)
→ Returns: { classId, subclassId, classInfo, subclassInfo } or null
→ Usage: Get full class data object

classManager.getClassBonus(player, bonusKey, defaultValue)
→ Returns: number (multiplier)
→ Usage: Get single bonus value
→ Example: classManager.getClassBonus(player, 'jobPayMultiplier', 1.0)
→ Example: classManager.getClassBonus(player, 'atmSkimmerCooldownMultiplier', 1.0)

classManager.getClassBonuses(player, bonusKeysArray)
→ Returns: object { bonusKey: multiplier, ... }
→ Usage: Get multiple bonuses at once
→ Example: const bonuses = classManager.getClassBonuses(player, 
           ['craftingSpeedMultiplier', 'materialCostMultiplier'])
*/

// ═════════════════════════════════════════════════════════════════════════════
// BONUS KEYS (for getClassBonus)
// ═════════════════════════════════════════════════════════════════════════════

/*
COMBAT:
- combatDamageMultiplier (1.15-1.40 for Enforcers)

MOVEMENT:
- movementSpeedMultiplier (0.85-1.40, lower=slower, higher=faster)

JOBS:
- jobPayMultiplier (1.15-1.40 for Hustlers)

CRAFTING:
- craftingSpeedMultiplier (1.05-1.15 for general crafting)
- carCraftingSpeedMultiplier (1.10-1.35 for vehicle crafting)
- materialCostMultiplier (0.70-0.90, lower=cheaper)

VEHICLES:
- vehicleAccelerationMultiplier (1.05-1.20 for Racers)
- vehicleHandlingMultiplier (1.05-1.15 for Racers)

HEALING:
- healingPowerMultiplier (1.20-1.50 for Medics)
- reviveSpeedMultiplier (1.10-1.35)
- reviveCooldownMultiplier (0.70-0.90, lower=faster recovery)

CRIME:
- atmSkimmerPayMultiplier (1.10-1.30 for Hustlers)
- atmSkimmerCooldownMultiplier (0.75-1.0 for Infiltrators)

STEALTH:
- stealthDetectionAvoidanceMultiplier (1.15-1.40)
- hackingCooldownMultiplier (0.70-0.90 for Infiltrators)
*/

// ═════════════════════════════════════════════════════════════════════════════
// INTEGRATION PATTERNS
// ═════════════════════════════════════════════════════════════════════════════

/*
PATTERN 1: Speed / Duration
─────────────────────────────────────────────────────────────────────────────
const baseTime = 30000; // 30 seconds
const speedMultiplier = classManager.getClassBonus(player, 'carCraftingSpeedMultiplier', 1.0);
const actualTime = baseTime / speedMultiplier; // Divide for speed increase

PATTERN 2: Cost / Resource Reduction
─────────────────────────────────────────────────────────────────────────────
const requiredMaterials = recipe.materials;
const costMultiplier = classManager.getClassBonus(player, 'materialCostMultiplier', 1.0);
const actualRequired = Math.ceil(requiredMaterials * costMultiplier); // Multiply for cost

PATTERN 3: Damage / Pay / Stat Increase
─────────────────────────────────────────────────────────────────────────────
const basePay = 5000;
const payMultiplier = classManager.getClassBonus(player, 'jobPayMultiplier', 1.0);
const actualPay = Math.floor(basePay * payMultiplier); // Multiply for increase

PATTERN 4: Cooldown Reduction
─────────────────────────────────────────────────────────────────────────────
const baseCooldown = 600000; // 10 minutes
const cooldownMultiplier = classManager.getClassBonus(player, 'atmSkimmerCooldownMultiplier', 1.0);
const actualCooldown = baseCooldown * cooldownMultiplier; // 0.75 = 25% faster

PATTERN 5: Multiple Bonuses at Once
─────────────────────────────────────────────────────────────────────────────
const bonuses = classManager.getClassBonuses(player, [
    'carCraftingSpeedMultiplier',
    'materialCostMultiplier'
]);
const craftTime = baseTime / bonuses.carCraftingSpeedMultiplier;
const materials = Math.ceil(baseRequirement * bonuses.materialCostMultiplier);
*/

// ═════════════════════════════════════════════════════════════════════════════
// QUICK START EXAMPLES
// ═════════════════════════════════════════════════════════════════════════════

/*
EXAMPLE 1: Reduce cooldown for Infiltrators
─────────────────────────────────────────────────────────────────────────────
const classManager = require('./classManager');

mp.events.add('server:atmSkimmer:start', (player, atmIndex) => {
    const cooldownMult = classManager.getClassBonus(player, 'atmSkimmerCooldownMultiplier', 1.0);
    const cooldown = 3600000 * cooldownMult; // 1 hour base
    
    // Set cooldown...
});

EXAMPLE 2: Increase job pay for Hustlers
─────────────────────────────────────────────────────────────────────────────
const classManager = require('./classManager');

mp.events.add('server:job:complete', (player, basePay) => {
    const payMult = classManager.getClassBonus(player, 'jobPayMultiplier', 1.0);
    const finalPay = Math.floor(basePay * payMult);
    
    player.giveMoneyBank(finalPay);
});

EXAMPLE 3: Reduce materials for Craftsman
─────────────────────────────────────────────────────────────────────────────
const classManager = require('./classManager');

mp.events.add('server:craft:start', (player, recipe) => {
    const costMult = classManager.getClassBonus(player, 'materialCostMultiplier', 1.0);
    
    recipe.materials.forEach(mat => {
        const required = Math.ceil(mat.count * costMult);
        // Check inventory for required amount
    });
});
*/

// ═════════════════════════════════════════════════════════════════════════════
// DEBUGGING
// ═════════════════════════════════════════════════════════════════════════════

/*
Check player's class in console:
mp.events.call('checkPlayerClass', targetPlayer);

Check bonuses:
const classManager = require('./classManager');
const info = classManager.getPlayerClassInfo(targetPlayer);
console.log(info.subclassInfo.bonuses);

Check database:
SELECT * FROM character_classes WHERE character_id = 123;

Check if class system loaded:
Look for: "[ClassManager] Applied bonuses for CLASSNAME/SUBCLASSNAME"
*/

// ═════════════════════════════════════════════════════════════════════════════
// COMMON MISTAKES
// ═════════════════════════════════════════════════════════════════════════════

/*
❌ WRONG: Using wrong bonus key (typo)
getClassBonus(player, 'jobPayMultipler') // Missing 'i'

✅ RIGHT: Use exact key name
getClassBonus(player, 'jobPayMultiplier')

─────────────────────────────────────────────────────────────────────────────

❌ WRONG: Dividing when you should multiply
const costReduced = baseCost / costMultiplier; // Wrong!

✅ RIGHT: Multiply for cost reduction
const costReduced = baseCost * costMultiplier; // Right (0.9 = 10% off)

─────────────────────────────────────────────────────────────────────────────

❌ WRONG: Forgetting to import classManager
const bonus = classManager.getClassBonus(...) // ReferenceError

✅ RIGHT: Require at top of file
const classManager = require('./classManager');

─────────────────────────────────────────────────────────────────────────────

❌ WRONG: Assuming player always has a class
const bonus = classManager.getPlayerClassInfo(player).bonuses; // Might be null

✅ RIGHT: Check first
const classInfo = classManager.getPlayerClassInfo(player);
const bonus = classInfo ? classInfo.subclassInfo.bonuses : {};
*/

// ═════════════════════════════════════════════════════════════════════════════
// BONUS MULTIPLIER REFERENCE TABLE
// ═════════════════════════════════════════════════════════════════════════════

/*
Multiplier:  Effect:               Example:
─────────────────────────────────────────────────────────────────────────────
0.70         30% reduction         300s → 210s (30% faster)
0.75         25% reduction         400s → 300s (25% faster)
0.80         20% reduction         500s → 400s (20% faster)
0.85         15% reduction         600s → 510s (15% faster)
0.90         10% reduction         1000s → 900s (10% faster)
1.0          No change             100s → 100s (baseline)
1.05         5% increase           1000 → 1050 (5% more)
1.10         10% increase          1000 → 1100 (10% more)
1.15         15% increase          1000 → 1150 (15% more)
1.20         20% increase          1000 → 1200 (20% more)
1.25         25% increase          1000 → 1250 (25% more)
1.30         30% increase          1000 → 1300 (30% more)
1.35         35% increase          1000 → 1350 (35% more)
1.40         40% increase          1000 → 1400 (40% more)

Formula for SPEED/FREQUENCY (divide):
  newValue = baseValue / multiplier
  
Formula for COST/DURATION (multiply):
  newValue = baseValue * multiplier
*/

module.exports = { quickReference: true };
