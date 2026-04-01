/**
 * CHARACTER CLASS SYSTEM - INTEGRATION EXAMPLES
 * Copy-paste ready code for integrating class bonuses into your systems
 */

// ═════════════════════════════════════════════════════════════════════════════
// EXAMPLE 1: ATM SKIMMER (atmSkimmer.js)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Modify the ATM skimmer to apply cooldown reductions for Infiltrator class
 * Add this to the top of atmSkimmer.js:
 */

const classManager = require('../packages/systems/classManager');

// Then, wherever you handle ATM skimmer cooldowns, modify it like:

// BEFORE:
// const COOLDOWN_TIME = 3600000; // 1 hour

// AFTER:
const getATMCooldown = (player) => {
    const baseCooldown = 3600000; // 1 hour base
    
    if (!player.data?.id) return baseCooldown;
    
    // Infiltrator Scout: 0.90 (10% faster)
    // Infiltrator Operative: 0.80 (20% faster)
    // Infiltrator Ghost: 0.70 (30% faster)
    const multiplier = classManager.getClassBonus(player, 'atmSkimmerCooldownMultiplier', 1.0);
    
    return baseCooldown * multiplier;
};

// Usage in your cooldown logic:
// const cooldown = getATMCooldown(player);
// serverAtmStates[atmIndex] = { state: 'cooldown', readyAt: Date.now() + cooldown };

// And for pay multiplier:
const getATMSkimmerPay = (player, basePay) => {
    // Hustler Grinder: 1.10 (10% more)
    // Hustler Entrepreneur: 1.20 (20% more)
    // Hustler Tycoon: 1.30 (30% more)
    const multiplier = classManager.getClassBonus(player, 'atmSkimmerPayMultiplier', 1.0);
    return Math.floor(basePay * multiplier);
};

// ═════════════════════════════════════════════════════════════════════════════
// EXAMPLE 2: CAR CRAFTING (carCrafting.js)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Modify car crafting to apply Craftsman bonuses
 * Add to the top of carCrafting.js:
 */

const classManager = require('../packages/systems/classManager');

// Create a function to apply class bonuses to recipes:
const applyClassBonusesToRecipe = (player, recipe) => {
    if (!recipe) return recipe;
    
    const bonuses = classManager.getClassBonuses(player, [
        'carCraftingSpeedMultiplier',
        'materialCostMultiplier'
    ]);
    
    // Copy recipe to avoid modifying original
    const modifiedRecipe = JSON.parse(JSON.stringify(recipe));
    
    // Apply crafting speed bonus
    modifiedRecipe.craftTime = Math.ceil(modifiedRecipe.craftTime / bonuses.carCraftingSpeedMultiplier);
    
    // Apply material cost reduction
    if (modifiedRecipe.materials && Array.isArray(modifiedRecipe.materials)) {
        modifiedRecipe.materials = modifiedRecipe.materials.map(material => ({
            ...material,
            required: Math.ceil(material.required * bonuses.materialCostMultiplier)
        }));
    }
    
    return modifiedRecipe;
};

// Usage: Call this when displaying recipes to player
// const finalizedRecipe = applyClassBonusesToRecipe(player, recipeFromDatabase);

// In server event for crafting start:
mp.events.add('server:crafting:startCraft', (player, recipeId) => {
    const recipe = RECIPES[recipeId]; // Your recipe database
    if (!recipe) return;
    
    const character = getPlayerData(player); // Your player lookup
    const bonuses = classManager.getClassBonuses(player, [
        'carCraftingSpeedMultiplier',
        'materialCostMultiplier'
    ]);
    
    // Check if player has required materials (accounting for reduction)
    let canCraft = true;
    if (recipe.materials) {
        recipe.materials.forEach(material => {
            const required = Math.ceil(material.required * bonuses.materialCostMultiplier);
            const have = character.inventory[material.itemId] || 0;
            if (have < required) canCraft = false;
        });
    }
    
    if (!canCraft) {
        player.outputChatBox('!{FF0000}You don\'t have enough materials');
        return;
    }
    
    // Remove materials (reduced amounts)
    if (recipe.materials) {
        recipe.materials.forEach(material => {
            const required = Math.ceil(material.required * bonuses.materialCostMultiplier);
            removeInventoryItem(player, material.itemId, required);
        });
    }
    
    // Set craft completion time (reduced for faster crafters)
    const craftTime = recipe.craftTime / bonuses.carCraftingSpeedMultiplier;
    
    setTimeout(() => {
        giveInventoryItem(player, recipe.outputItem, 1);
        player.outputChatBox(`!{32FF32}Crafted: ${recipe.name} (Class Bonus: -${Math.round((1 - bonuses.materialCostMultiplier) * 100)}% materials)`);
    }, craftTime);
});

// ═════════════════════════════════════════════════════════════════════════════
// EXAMPLE 3: JOB PAY (jobs/farmer.js, trucker.js, etc.)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Modify any job to apply Hustler income bonuses
 * In your job completion handler:
 */

const classManager = require('../packages/systems/classManager');

const completeJobTask = (player, basePay) => {
    // Hustler Grinder: 1.15 (15% more)
    // Hustler Entrepreneur: 1.25 (25% more)  
    // Hustler Tycoon: 1.40 (40% more)
    const payMultiplier = classManager.getClassBonus(player, 'jobPayMultiplier', 1.0);
    const finalPay = Math.floor(basePay * payMultiplier);
    
    player.giveMoneyBank(finalPay);
    
    const bonusText = payMultiplier > 1 ? ` +${Math.round((payMultiplier - 1) * 100)}% class bonus` : '';
    player.outputChatBox(`!{32FF32}Job completed: $${finalPay}${bonusText}`);
};

// Example: In trucker job
mp.events.add('server:job:trucker:deliver', (player, location) => {
    const BASE_PAY = 2500;
    
    // Get the final payment with class bonus
    const classManager = require('../packages/systems/classManager');
    const payMultiplier = classManager.getClassBonus(player, 'jobPayMultiplier', 1.0);
    const finalPay = Math.floor(BASE_PAY * payMultiplier);
    
    player.giveMoneyBank(finalPay);
    player.outputChatBox(`!{32FF32}Delivery complete! $${finalPay}`);
});

// ═════════════════════════════════════════════════════════════════════════════
// EXAMPLE 4: MEDIC SYSTEM (Optional healing/revival)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * If you implement a medic healing/revival system
 */

const classManager = require('../packages/systems/classManager');

const startHealingProcess = (medic, target, baseHealAmount) => {
    // Medic Paramedic: 1.20 (20% more healing)
    // Medic Doctor: 1.35 (35% more)
    // Medic Surgeon: 1.50 (50% more)
    const healingMultiplier = classManager.getClassBonus(medic, 'healingPowerMultiplier', 1.0);
    const finalHealAmount = Math.floor(baseHealAmount * healingMultiplier);
    
    target.health = Math.min(200, target.health + finalHealAmount); // Max health 200
    medic.outputChatBox(`!{32FF32}Healed ${target.name} for ${finalHealAmount} HP`);
};

const startReviveProcess = (medic, target) => {
    // Revive speed multiplier (how fast the animation progresses)
    // Medic Paramedic: 1.10 (10% faster)
    // Medic Doctor: 1.20 (20% faster)
    // Medic Surgeon: 1.35 (35% faster)
    const reviveSpeedMultiplier = classManager.getClassBonus(medic, 'reviveSpeedMultiplier', 1.0);
    
    // Revive cooldown multiplier (how often you can revive)
    // Medic Paramedic: 0.90 (10% faster cooldown recovery)
    // Medic Doctor: 0.80 (20% faster)
    // Medic Surgeon: 0.70 (30% faster)
    const reviveCooldownMultiplier = classManager.getClassBonus(medic, 'reviveCooldownMultiplier', 1.0);
    
    // Base revive time: 30 seconds
    const baseReviveTime = 30000;
    const actualReviveTime = baseReviveTime / reviveSpeedMultiplier;
    
    medic.outputChatBox(`Reviving ${target.name}... (${actualReviveTime / 1000} seconds)`);
    
    setTimeout(() => {
        target.health = 100;
        target.outputChatBox('You have been revived!');
    }, actualReviveTime);
    
    // Set cooldown on medic
    medic.lastReviveTime = Date.now();
    medic.reviveCooldown = 300000 * reviveCooldownMultiplier; // 5 min base
};

// ═════════════════════════════════════════════════════════════════════════════
// EXAMPLE 5: GENERIC SYSTEM - HOW TO USE getClassBonuses
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Template for any system - get multiple bonuses at once
 */

const classManager = require('../packages/systems/classManager');

const processSystemWithMultipleBonuses = (player, baseStat1, baseStat2, baseStat3) => {
    // Get all bonuses you need in one call
    const bonuses = classManager.getClassBonuses(player, [
        'statBonus1Multiplier',
        'statBonus2Multiplier',
        'statBonus3Multiplier'
    ]);
    
    // Apply bonuses
    const result1 = baseStat1 * bonuses.statBonus1Multiplier;
    const result2 = baseStat2 * bonuses.statBonus2Multiplier;
    const result3 = baseStat3 * bonuses.statBonus3Multiplier;
    
    console.log(`Bonuses applied: ${JSON.stringify(bonuses)}`);
    
    return { result1, result2, result3 };
};

// ═════════════════════════════════════════════════════════════════════════════
// EXAMPLE 6: CHECKING PLAYER CLASS TYPE (For special dialogue or interactions)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Check what class a player is and change dialog/behavior
 */

const classManager = require('../packages/systems/classManager');

const talkToNPC = (player, npcType) => {
    const classInfo = classManager.getPlayerClassInfo(player);
    
    if (!classInfo) {
        console.log('Player has no class yet');
        return;
    }
    
    const classId = classInfo.classId;
    const subclassId = classInfo.subclassId;
    
    // Example: Different dialog for different classes
    if (classId === 'INFILTRATOR') {
        npc.say(`Hey, ${player.name}... I like your style. Quiet types are my favorite.`);
    } else if (classId === 'MEDIC') {
        npc.say(`Appreciate your healing skills, doc. Could use someone like you around here.`);
    } else if (classId === 'RACER') {
        npc.say(`I hear you can drive. We could use someone with your speed.`);
    } else {
        npc.say(`What's up, ${player.name}?`);
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// EXAMPLE 7: MANUAL CLASS CHANGE (Admin command)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * If you want to add command to change player class
 */

const classManager = require('../packages/systems/classManager');

mp.events.add('server:admin:changeClass', (player, targetPlayer, classId, subclassId) => {
    if (!player.data.admin) return;
    
    const success = classManager.savePlayerClass(targetPlayer, classId, subclassId);
    
    if (success) {
        player.outputChatBox(`Changed ${targetPlayer.name}'s class to ${classId}/${subclassId}`);
        targetPlayer.outputChatBox(`!{FFFF00}Your class has been changed to ${classId}/${subclassId}`);
    } else {
        player.outputChatBox(`Failed to change class for ${targetPlayer.name}`);
    }
});

// Usage: /changeclass playerid HUSTLER tycoon

// ═════════════════════════════════════════════════════════════════════════════
// EXAMPLE 8: CHECKING BONUSES (For UI/stats display)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Display player's class bonuses (e.g., in character stats menu)
 */

const classManager = require('../packages/systems/classManager');

const displayPlayerStats = (player) => {
    const classInfo = classManager.getPlayerClassInfo(player);
    
    if (!classInfo) {
        console.log('Player has no class');
        return;
    }
    
    console.log(`=== ${classInfo.classId} / ${classInfo.subclassId} ===`);
    
    const bonuses = classInfo.subclassInfo.bonuses;
    Object.entries(bonuses).forEach(([bonusKey, bonusData]) => {
        if (bonusData.type === 'percentModifier') {
            const percentage = Math.round((bonusData.value - 1) * 100);
            const sign = percentage > 0 ? '+' : '';
            console.log(`${bonusKey}: ${sign}${percentage}%`);
        } else if (bonusData.type === 'cooldownReduction') {
            const percentage = Math.round((1 - bonusData.value) * 100);
            console.log(`${bonusKey}: -${percentage}% cooldown`);
        }
    });
};

// Call this to print to console:
// displayPlayerStats(somePlayer);

module.exports = {
    examples: 'See above for integration code snippets'
};
