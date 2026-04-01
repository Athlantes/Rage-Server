/**
 * Class Manager - Server-side
 * Handles player class selection, saving, loading, and bonus application
 */

const db = require('../core/database');
const { CLASS_DEFINITIONS, BONUS_CALLBACKS } = require('./classDefinitions');

// ─────────────────────────────────────────────────────────────────────────────
// 1. INITIALIZATION & DATA LOADING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load player's class data from database
 * @param {Player} player - RAGE MP player instance
 */
async function loadPlayerClass(player) {
    if (!player.data.dbId) return;

    try {
        const [rows] = await db.query(
            "SELECT class_id, subclass_id FROM character_classes WHERE character_id = ?",
            [player.data.dbId]
        );

        if (rows.length > 0) {
            const { class_id, subclass_id } = rows[0];
            player.data.classData = {
                classId: class_id,
                subclassId: subclass_id,
                classInfo: CLASS_DEFINITIONS[class_id],
                subclassInfo: CLASS_DEFINITIONS[class_id].subclasses[subclass_id],
            };
            
            // Apply all bonuses
            applyClassBonuses(player);
        } else {
            // Initialize empty classData for new characters (no class selected yet)
            player.data.classData = null;
        }
    } catch (e) {
        console.error(`[ClassManager] Error loading class for player ${player.data.dbId}:`, e);
        player.data.classData = null;
    }
}

/**
 * Save player's class selection to database
 * @param {Player} player - RAGE MP player instance
 * @param {string} classId - Class ID (e.g., 'ENFORCER')
 * @param {string} subclassId - Subclass ID (e.g., 'soldier')
 */
async function savePlayerClass(player, classId, subclassId) {
    if (!player.data.dbId) return false;

    // Convert to uppercase to match CLASS_DEFINITIONS keys
    const upperClassId = classId.toUpperCase();
    const lowerSubclassId = subclassId.toLowerCase();

    const classData = CLASS_DEFINITIONS[upperClassId];
    if (!classData || !classData.subclasses[lowerSubclassId]) {
        console.error(`[ClassManager] Invalid class/subclass combination: ${upperClassId}/${lowerSubclassId}`);
        console.error('[ClassManager] Available classes:', Object.keys(CLASS_DEFINITIONS));
        return false;
    }

    try {
        // Check if record exists
        const [existing] = await db.query(
            "SELECT id FROM character_classes WHERE character_id = ?",
            [player.data.dbId]
        );

        if (existing.length > 0) {
            // Update existing
            await db.query(
                "UPDATE character_classes SET class_id = ?, subclass_id = ? WHERE character_id = ?",
                [classId, subclassId, player.data.dbId]
            );
        } else {
            // Insert new
            await db.query(
                "INSERT INTO character_classes (character_id, class_id, subclass_id) VALUES (?, ?, ?)",
                [player.data.dbId, upperClassId, lowerSubclassId]
            );
        }

        // Update in memory
        player.data.classData = {
            classId: upperClassId,
            subclassId: lowerSubclassId,
            classInfo: classData,
            subclassInfo: classData.subclasses[lowerSubclassId],
        };

        // Apply bonuses
        applyClassBonuses(player);

        console.log(`[ClassManager] Saved class for player ${player.data.dbId}: ${upperClassId}/${lowerSubclassId}`);
        return true;
    } catch (e) {
        console.error(`[ClassManager] Error saving class for player ${player.data.dbId}:`, e);
        return false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. BONUS APPLICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply all bonuses from player's current class/subclass
 * @param {Player} player - RAGE MP player instance
 */
function applyClassBonuses(player) {
    if (!player.data.classData || !player.data.classData.subclassInfo) return;

    // Initialize classData structure if needed
    if (!player.data.classData) {
        player.data.classData = {};
    }

    const bonuses = player.data.classData.subclassInfo.bonuses || {};

    Object.entries(bonuses).forEach(([bonusKey, bonusData]) => {
        const callback = BONUS_CALLBACKS[bonusKey];
        if (!callback) {
            console.warn(`[ClassManager] No callback registered for bonus: ${bonusKey}`);
            return;
        }

        // Apply based on bonus type
        if (bonusData.type === 'percentModifier') {
            callback(player, bonusData.value);
        } else if (bonusData.type === 'cooldownReduction') {
            callback(player, bonusData.value);
        } else if (bonusData.type === 'flatBonus') {
            callback(player, bonusData.value);
        }
    });

    console.log(`[ClassManager] Applied bonuses for ${player.data.classData.classId}/${player.data.classData.subclassId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. QUERY FUNCTIONS (For Other Systems)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get player's class ID
 * @param {Player} player - RAGE MP player instance
 * @returns {string|null} - Class ID or null
 */
function getPlayerClassId(player) {
    return player.data?.classData?.classId || null;
}

/**
 * Get player's subclass ID
 * @param {Player} player - RAGE MP player instance
 * @returns {string|null} - Subclass ID or null
 */
function getPlayerSubclassId(player) {
    return player.data?.classData?.subclassId || null;
}

/**
 * Get player's full class info
 * @param {Player} player - RAGE MP player instance
 * @returns {object|null} - Full class data or null
 */
function getPlayerClassInfo(player) {
    return player.data?.classData || null;
}

/**
 * Check if player has a class
 * @param {Player} player - RAGE MP player instance
 * @returns {boolean}
 */
function hasClass(player) {
    return player.data?.classData?.classId !== undefined && player.data.classData.classId !== null;
}

/**
 * Get bonus multiplier for player
 * Usage: atmSkimmer pay = BASE_PAY * getClassBonus(player, 'atmSkimmerPayMultiplier', 1.0)
 * @param {Player} player - RAGE MP player instance
 * @param {string} bonusKey - Bonus key to retrieve
 * @param {number} defaultValue - Default value if bonus not found
 * @returns {number} - Bonus multiplier value
 */
function getClassBonus(player, bonusKey, defaultValue = 1.0) {
    if (!player.data?.classData) return defaultValue;

    const storedBonus = player.data.classData[bonusKey];
    return storedBonus !== undefined ? storedBonus : defaultValue;
}

/**
 * Get multiple bonus multipliers at once
 * @param {Player} player - RAGE MP player instance
 * @param {string[]} bonusKeys - Array of bonus keys
 * @returns {object} - Map of bonusKey: multiplier
 */
function getClassBonuses(player, bonusKeys) {
    const bonuses = {};
    bonusKeys.forEach(key => {
        bonuses[key] = getClassBonus(player, key, 1.0);
    });
    return bonuses;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SERVER EVENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CLIENT FEEDBACK HANDLERS - Monitor class selector UI status
 */
mp.events.add('server:classSelector:eventReceived', (player) => {
    console.log(`[ClassSelector] ${player.name}: Event received on client`);
});

mp.events.add('server:classSelector:created', (player) => {
    console.log(`[ClassSelector] ${player.name}: Browser created successfully`);
});

mp.events.add('server:classSelector:reused', (player) => {
    console.log(`[ClassSelector] ${player.name}: Browser reused`);
});

mp.events.add('server:classSelector:alreadyActive', (player) => {
    console.log(`[ClassSelector] ${player.name}: Class selection already active`);
});

mp.events.add('server:classSelector:error', (player, errorMessage) => {
    console.error(`[ClassSelector] ${player.name}: ERROR - ${errorMessage}`);
});

/**
 * Player joining - load their class data
 */
mp.events.add('playerJoin', async (player) => {
    // Small delay to ensure player data is initialized
    setTimeout(() => {
        loadPlayerClass(player);
    }, 500);
});

/**
 * Client requests to save class (after character creation)
 */
mp.events.add('server:class:save', async (player, classId, subclassId) => {
    try {
        const success = await savePlayerClass(player, classId, subclassId);
        player.call('client:class:saved', success);
        
        if (success) {
            player.outputChatBox("!{32FF32}Class selected: " + classId + "/" + subclassId);
            console.log(`[ClassManager] Class saved successfully for ${player.name}`);

            const webServer = require('../webserver');
            player.call('prepareScreenshot', [webServer.mugshotUploadUrl, player.data.dbId]);
            
            // Character creation is now complete - finalize auth
            setTimeout(() => {
                if (mp.players.exists(player)) {
                    mp.events.call('server:auth:finalized', player);
                    console.log('[ClassManager] Auth finalized after class selection');
                }
            }, 500);
        } else {
            console.error(`[ClassManager] Failed to save class for ${player.name}`);
            player.outputChatBox("!{FF0000}Failed to save class. Please try again.");
        }
    } catch (err) {
        console.error('[ClassManager] Error in server:class:save:', err);
        player.call('client:class:saved', false);
        player.outputChatBox("!{FF0000}Error saving class. Please try again.");
    }
});

/**
 * For debugging - check player's class
 */
mp.events.add('checkPlayerClass', (player) => {
    if (!player.data?.classData) {
        return console.log(`${player.name} has no class selected`);
    }
    
    console.log(`${player.name} - Class: ${player.data.classData.classId}, Subclass: ${player.data.classData.subclassId}`);
    console.log('Bonuses:', player.data.classData.subclassInfo.bonuses);
});

/**
 * For debugging - manually trigger class selector
 */
mp.events.add('testClassSelector', (player) => {
    if (!player) {
        console.error('[ClassManager] testClassSelector: player not found');
        return;
    }
    
    console.log(`[ClassManager] Manually triggering class selector for ${player.name}`);
    player.call('client:classSelector:start');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    loadPlayerClass,
    savePlayerClass,
    applyClassBonuses,
    getPlayerClassId,
    getPlayerSubclassId,
    getPlayerClassInfo,
    hasClass,
    getClassBonus,
    getClassBonuses,
};
