const db = require('../core/database');
const { CLASS_DEFINITIONS, BONUS_CALLBACKS } = require('./classDefinitions');

// ─────────────────────────────────────────────────────────────────────────────
// 1. INITIALIZATION & DATA LOADING
// ─────────────────────────────────────────────────────────────────────────────

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
            applyClassBonuses(player);
        } else {
            player.data.classData = null;
        }
    } catch (e) {
        player.data.classData = null;
    }
}

async function savePlayerClass(player, classId, subclassId) {
    if (!player.data.dbId) return false;

    const upperClassId = classId.toUpperCase();
    const lowerSubclassId = subclassId.toLowerCase();

    const classData = CLASS_DEFINITIONS[upperClassId];
    if (!classData || !classData.subclasses[lowerSubclassId]) return false;

    try {
        const [existing] = await db.query(
            "SELECT id FROM character_classes WHERE character_id = ?",
            [player.data.dbId]
        );

        if (existing.length > 0) {
            await db.query(
                "UPDATE character_classes SET class_id = ?, subclass_id = ? WHERE character_id = ?",
                [classId, subclassId, player.data.dbId]
            );
        } else {
            await db.query(
                "INSERT INTO character_classes (character_id, class_id, subclass_id) VALUES (?, ?, ?)",
                [player.data.dbId, upperClassId, lowerSubclassId]
            );
        }

        player.data.classData = {
            classId: upperClassId,
            subclassId: lowerSubclassId,
            classInfo: classData,
            subclassInfo: classData.subclasses[lowerSubclassId],
        };

        applyClassBonuses(player);
        return true;
    } catch (e) {
        return false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. BONUS APPLICATION
// ─────────────────────────────────────────────────────────────────────────────

function applyClassBonuses(player) {
    if (!player.data.classData || !player.data.classData.subclassInfo) return;

    const bonuses = player.data.classData.subclassInfo.bonuses || {};

    Object.entries(bonuses).forEach(([bonusKey, bonusData]) => {
        const callback = BONUS_CALLBACKS[bonusKey];
        if (!callback) return;

        if (
            bonusData.type === 'percentModifier' ||
            bonusData.type === 'cooldownReduction' ||
            bonusData.type === 'flatBonus'
        ) {
            callback(player, bonusData.value);
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getPlayerClassId(player) {
    return player.data?.classData?.classId || null;
}

function getPlayerSubclassId(player) {
    return player.data?.classData?.subclassId || null;
}

function getPlayerClassInfo(player) {
    return player.data?.classData || null;
}

function hasClass(player) {
    return player.data?.classData?.classId !== undefined && player.data.classData.classId !== null;
}

function getClassBonus(player, bonusKey, defaultValue = 1.0) {
    if (!player.data?.classData) return defaultValue;
    const stored = player.data.classData[bonusKey];
    return stored !== undefined ? stored : defaultValue;
}

function getClassBonuses(player, bonusKeys) {
    const bonuses = {};
    bonusKeys.forEach(key => { bonuses[key] = getClassBonus(player, key, 1.0); });
    return bonuses;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SERVER EVENTS
// ─────────────────────────────────────────────────────────────────────────────

mp.events.add('playerJoin', async (player) => {
    setTimeout(() => {
        loadPlayerClass(player);
    }, 500);
});

mp.events.add('server:class:save', async (player, classId, subclassId) => {
    try {
        const success = await savePlayerClass(player, classId, subclassId);
        player.call('client:class:saved', success);

        if (success) {
            player.outputChatBox("!{32FF32}Class selected: " + classId + "/" + subclassId);

            const webServer = require('../webserver');
            player.call('prepareScreenshot', [webServer.mugshotUploadUrl, player.data.dbId]);

            setTimeout(() => {
                if (mp.players.exists(player)) {
                    mp.events.call('server:auth:finalized', player);
                }
            }, 500);
        } else {
            player.outputChatBox("!{FF0000}Failed to save class. Please try again.");
        }
    } catch (err) {
        player.call('client:class:saved', false);
        player.outputChatBox("!{FF0000}Error saving class. Please try again.");
    }
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