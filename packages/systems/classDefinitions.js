/**
 * Class Definitions for Character Class System
 * Defines all available classes, subclasses, and their bonuses
 * 
 * Bonus Types:
 * - percentModifier: %age increase/decrease (e.g., 1.25 = 25% increase)
 * - flatBonus: Direct stat increase
 * - cooldownReduction: Cooldown multiplier (e.g., 0.8 = 20% less cooldown)
 */

const CLASS_DEFINITIONS = {
    ENFORCER: {
        id: 'enforcer',
        name: 'ENFORCER',
        icon: '🛡️',
        color: '#FF3333',
        description: 'Masters of combat and control. Enforcers are tough, intimidating, and built for conflict.',
        story: 'You\'ve learned to fight hard and survive harder. The streets respect power.',
        subclasses: {
            soldier: {
                name: 'Soldier',
                description: 'Trained operative',
                bonuses: {
                    combatDamage: { type: 'percentModifier', value: 1.15 },
                    movementSpeed: { type: 'percentModifier', value: 0.95 },
                    atmSkimmerCooldown: { type: 'cooldownReduction', value: 1.0 },
                }
            },
            enforcer: {
                name: 'Enforcer',
                description: 'Seasoned veteran',
                bonuses: {
                    combatDamage: { type: 'percentModifier', value: 1.25 },
                    movementSpeed: { type: 'percentModifier', value: 0.90 },
                    atmSkimmerCooldown: { type: 'cooldownReduction', value: 1.0 },
                }
            },
            warlord: {
                name: 'Warlord',
                description: 'Feared commander',
                bonuses: {
                    combatDamage: { type: 'percentModifier', value: 1.40 },
                    movementSpeed: { type: 'percentModifier', value: 0.85 },
                    atmSkimmerCooldown: { type: 'cooldownReduction', value: 1.0 },
                }
            }
        }
    },

    HUSTLER: {
        id: 'hustler',
        name: 'HUSTLER',
        icon: '💰',
        color: '#FFB700',
        description: 'Money moves and business instincts. Hustlers always find a way to profit.',
        story: 'Every interaction is an opportunity. The only currency that matters is cash.',
        subclasses: {
            grinder: {
                name: 'Grinder',
                description: 'Rising entrepreneur',
                bonuses: {
                    jobPayMultiplier: { type: 'percentModifier', value: 1.15 },
                    craftingSpeed: { type: 'percentModifier', value: 1.05 },
                    atmSkimmerPayMultiplier: { type: 'percentModifier', value: 1.10 },
                }
            },
            entrepreneur: {
                name: 'Entrepreneur',
                description: 'Seasoned dealer',
                bonuses: {
                    jobPayMultiplier: { type: 'percentModifier', value: 1.25 },
                    craftingSpeed: { type: 'percentModifier', value: 1.10 },
                    atmSkimmerPayMultiplier: { type: 'percentModifier', value: 1.20 },
                }
            },
            tycoon: {
                name: 'Tycoon',
                description: 'Business magnate',
                bonuses: {
                    jobPayMultiplier: { type: 'percentModifier', value: 1.40 },
                    craftingSpeed: { type: 'percentModifier', value: 1.15 },
                    atmSkimmerPayMultiplier: { type: 'percentModifier', value: 1.30 },
                }
            }
        }
    },

    CRAFTSMAN: {
        id: 'craftsman',
        name: 'CRAFTSMAN',
        icon: '🔧',
        color: '#8B4513',
        description: 'Masters of creation and engineering. Craftsmen build better, faster, cheaper.',
        story: 'Your hands know how to build anything. Every creation is a masterpiece.',
        subclasses: {
            apprentice: {
                name: 'Apprentice',
                description: 'Learning the trade',
                bonuses: {
                    craftingSpeed: { type: 'percentModifier', value: 1.15 },
                    materialCost: { type: 'percentModifier', value: 0.90 },
                    carCraftingSpeed: { type: 'percentModifier', value: 1.10 },
                }
            },
            master: {
                name: 'Master',
                description: 'Skilled builder',
                bonuses: {
                    craftingSpeed: { type: 'percentModifier', value: 1.25 },
                    materialCost: { type: 'percentModifier', value: 0.80 },
                    carCraftingSpeed: { type: 'percentModifier', value: 1.20 },
                }
            },
            legendary: {
                name: 'Legendary',
                description: 'Perfect craftsman',
                bonuses: {
                    craftingSpeed: { type: 'percentModifier', value: 1.40 },
                    materialCost: { type: 'percentModifier', value: 0.70 },
                    carCraftingSpeed: { type: 'percentModifier', value: 1.35 },
                }
            }
        }
    },

    RACER: {
        id: 'racer',
        name: 'RACER',
        icon: '🏎️',
        color: '#FF00FF',
        description: 'Speed demons and adrenaline junkies. Racers are the fastest on the road.',
        story: 'Pedal to the metal. Nothing compares to the rush of velocity.',
        subclasses: {
            rookie: {
                name: 'Rookie',
                description: 'Young speedster',
                bonuses: {
                    movementSpeed: { type: 'percentModifier', value: 1.15 },
                    vehicleAcceleration: { type: 'percentModifier', value: 1.05 },
                    vehicleHandling: { type: 'percentModifier', value: 1.05 },
                }
            },
            pro: {
                name: 'Pro',
                description: 'Seasoned racer',
                bonuses: {
                    movementSpeed: { type: 'percentModifier', value: 1.25 },
                    vehicleAcceleration: { type: 'percentModifier', value: 1.10 },
                    vehicleHandling: { type: 'percentModifier', value: 1.10 },
                }
            },
            legend: {
                name: 'Legend',
                description: 'Champion driver',
                bonuses: {
                    movementSpeed: { type: 'percentModifier', value: 1.40 },
                    vehicleAcceleration: { type: 'percentModifier', value: 1.20 },
                    vehicleHandling: { type: 'percentModifier', value: 1.15 },
                }
            }
        }
    },

    MEDIC: {
        id: 'medic',
        name: 'MEDIC',
        icon: '🏥',
        color: '#00CC66',
        description: 'Healers and lifesavers. Medics keep their allies in the fight.',
        story: 'Saving lives is your calling. You\'re a second chance at survival.',
        subclasses: {
            paramedic: {
                name: 'Paramedic',
                description: 'First responder',
                bonuses: {
                    healingPower: { type: 'percentModifier', value: 1.20 },
                    reviveSpeed: { type: 'percentModifier', value: 1.10 },
                    reviveCooldown: { type: 'cooldownReduction', value: 0.90 },
                }
            },
            doctor: {
                name: 'Doctor',
                description: 'Professional healer',
                bonuses: {
                    healingPower: { type: 'percentModifier', value: 1.35 },
                    reviveSpeed: { type: 'percentModifier', value: 1.20 },
                    reviveCooldown: { type: 'cooldownReduction', value: 0.80 },
                }
            },
            surgeon: {
                name: 'Surgeon',
                description: 'Master of life',
                bonuses: {
                    healingPower: { type: 'percentModifier', value: 1.50 },
                    reviveSpeed: { type: 'percentModifier', value: 1.35 },
                    reviveCooldown: { type: 'cooldownReduction', value: 0.70 },
                }
            }
        }
    },

    INFILTRATOR: {
        id: 'infiltrator',
        name: 'INFILTRATOR',
        icon: '👻',
        color: '#0099FF',
        description: 'Shadows and secrets. Infiltrators operate outside the law unseen.',
        story: 'Invisibility is an art. You slip through the cracks everyone else misses.',
        subclasses: {
            scout: {
                name: 'Scout',
                description: 'Sneaky operator',
                bonuses: {
                    stealthDetectionAvoidance: { type: 'percentModifier', value: 1.15 },
                    hackingCooldown: { type: 'cooldownReduction', value: 0.90 },
                    atmSkimmerCooldown: { type: 'cooldownReduction', value: 0.90 },
                }
            },
            operative: {
                name: 'Operative',
                description: 'Professional spy',
                bonuses: {
                    stealthDetectionAvoidance: { type: 'percentModifier', value: 1.25 },
                    hackingCooldown: { type: 'cooldownReduction', value: 0.80 },
                    atmSkimmerCooldown: { type: 'cooldownReduction', value: 0.85 },
                }
            },
            ghost: {
                name: 'Ghost',
                description: 'Master phantom',
                bonuses: {
                    stealthDetectionAvoidance: { type: 'percentModifier', value: 1.40 },
                    hackingCooldown: { type: 'cooldownReduction', value: 0.70 },
                    atmSkimmerCooldown: { type: 'cooldownReduction', value: 0.75 },
                }
            }
        }
    }
};

/**
 * Bonus Application Registry
 * Maps bonus keys to callback functions that apply them to systems
 * Format: 'bonusKey': (player, value) => void
 */
const BONUS_CALLBACKS = {
    // Combat bonuses
    combatDamage: (player, value) => {
        if (player.data.classData) player.data.classData.combatDamageMultiplier = value;
    },
    
    // Movement bonuses
    movementSpeed: (player, value) => {
        if (player.data.classData) player.data.classData.movementSpeedMultiplier = value;
    },
    
    // Job bonuses
    jobPayMultiplier: (player, value) => {
        if (player.data.classData) player.data.classData.jobPayMultiplier = value;
    },
    
    // Crafting bonuses
    craftingSpeed: (player, value) => {
        if (player.data.classData) player.data.classData.craftingSpeedMultiplier = value;
    },
    carCraftingSpeed: (player, value) => {
        if (player.data.classData) player.data.classData.carCraftingSpeedMultiplier = value;
    },
    materialCost: (player, value) => {
        if (player.data.classData) player.data.classData.materialCostMultiplier = value;
    },
    
    // Vehicle bonuses
    vehicleAcceleration: (player, value) => {
        if (player.data.classData) player.data.classData.vehicleAccelerationMultiplier = value;
    },
    vehicleHandling: (player, value) => {
        if (player.data.classData) player.data.classData.vehicleHandlingMultiplier = value;
    },
    
    // Healing bonuses
    healingPower: (player, value) => {
        if (player.data.classData) player.data.classData.healingPowerMultiplier = value;
    },
    reviveSpeed: (player, value) => {
        if (player.data.classData) player.data.classData.reviveSpeedMultiplier = value;
    },
    reviveCooldown: (player, value) => {
        if (player.data.classData) player.data.classData.reviveCooldownMultiplier = value;
    },
    
    // Crime/special bonuses
    atmSkimmerPayMultiplier: (player, value) => {
        if (player.data.classData) player.data.classData.atmSkimmerPayMultiplier = value;
    },
    atmSkimmerCooldown: (player, value) => {
        if (player.data.classData) player.data.classData.atmSkimmerCooldownMultiplier = value;
    },
    
    // Stealth bonuses
    stealthDetectionAvoidance: (player, value) => {
        if (player.data.classData) player.data.classData.stealthDetectionAvoidanceMultiplier = value;
    },
    hackingCooldown: (player, value) => {
        if (player.data.classData) player.data.classData.hackingCooldownMultiplier = value;
    },
};

module.exports = {
    CLASS_DEFINITIONS,
    BONUS_CALLBACKS,
    getAllClasses: () => Object.keys(CLASS_DEFINITIONS).map(key => CLASS_DEFINITIONS[key]),
    getClass: (classId) => CLASS_DEFINITIONS[classId.toUpperCase()] || null,
    getSubclass: (classId, subclassId) => {
        const classData = CLASS_DEFINITIONS[classId.toUpperCase()];
        return classData ? classData.subclasses[subclassId] : null;
    },
    getClassBonuses: (classId, subclassId) => {
        const subclass = module.exports.getSubclass(classId, subclassId);
        return subclass ? subclass.bonuses : null;
    }
};
