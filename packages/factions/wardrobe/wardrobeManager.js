// packages/factions/wardrobe/wardrobeManager.js
// ─────────────────────────────────────────────────────────────────────────────
// Modular Faction Wardrobe Manager
// Handles uniform selection, persistence, and clothing application for any faction.
// Each faction registers its own uniform config via registerUniforms().
// ─────────────────────────────────────────────────────────────────────────────

const DB = require('../../core/database');

class WardrobeManager {
    constructor() {
        // Map<factionId, { name, wardrobePoint, wardrobeDimension, uniforms: { male: [...], female: [...] } }>
        this.factionConfigs = new Map();
        // Map<"charId:factionId", uniformIndex> — runtime cache
        this.playerSelections = new Map();
    }

    // ── Registration ──────────────────────────────────────────────────────────

    /**
     * Register uniform options for a faction.
     * @param {number} factionId
     * @param {object} config
     * @param {string} config.name           - Display name (e.g. "Taxi Wardrobe")
     * @param {object} config.wardrobePoint  - mp.Vector3 position of the wardrobe checkpoint
     * @param {number} config.wardrobeDimension - Dimension of the wardrobe checkpoint
     * @param {Array}  config.uniforms.male  - Array of uniform objects for male characters
     * @param {Array}  config.uniforms.female - Array of uniform objects for female characters
     *
     * Each uniform object: { name, description, components: [{ id, drawable, texture }], props: [{ id, drawable, texture }] }
     *   components → player.setClothes(id, drawable, texture, 0)
     *   props      → player.setProp(id, drawable, texture)  (optional, e.g. hats)
     */
    registerUniforms(factionId, config) {
        if (this.factionConfigs.has(factionId)) {
            console.warn(`[Wardrobe] Faction ${factionId} already has uniforms registered — overwriting.`);
        }
        this.factionConfigs.set(factionId, config);
        console.log(`[Wardrobe] Registered ${config.uniforms.male.length} male + ${config.uniforms.female.length} female uniforms for faction ${factionId} (${config.name})`);
    }

    /**
     * Get the config for a faction.
     */
    getConfig(factionId) {
        return this.factionConfigs.get(factionId);
    }

    // ── Database ──────────────────────────────────────────────────────────────

    /**
     * Load a player's selected uniform for their faction from DB.
     * Call this after player logs in and faction data is loaded.
     */
    async loadPlayerUniform(player) {
        if (!player.data || !player.data.dbId || !player.factionId) return;

        const key = `${player.data.dbId}:${player.factionId}`;
        try {
            const [rows] = await DB.query(
                'SELECT uniform_index FROM faction_uniforms WHERE character_id = ? AND faction_id = ?',
                [player.data.dbId, player.factionId]
            );
            if (rows.length > 0) {
                this.playerSelections.set(key, rows[0].uniform_index);
            }
        } catch (e) {
            console.error(`[Wardrobe] Failed to load uniform for ${player.name}:`, e);
        }
    }

    /**
     * Save a player's uniform selection to DB and cache.
     */
    async savePlayerUniform(player, factionId, uniformIndex) {
        if (!player.data || !player.data.dbId) return;

        const key = `${player.data.dbId}:${factionId}`;
        try {
            await DB.query(
                `INSERT INTO faction_uniforms (character_id, faction_id, uniform_index)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE uniform_index = VALUES(uniform_index)`,
                [player.data.dbId, factionId, uniformIndex]
            );
            this.playerSelections.set(key, uniformIndex);
        } catch (e) {
            console.error(`[Wardrobe] Failed to save uniform for ${player.name}:`, e);
        }
    }

    /**
     * Get the selected uniform index for a player+faction, or null if none.
     */
    getSelectedIndex(player, factionId) {
        if (!player.data || !player.data.dbId) return null;
        const key = `${player.data.dbId}:${factionId}`;
        const idx = this.playerSelections.get(key);
        return idx !== undefined ? idx : null;
    }

    /**
     * Check if the player has a uniform set for the given faction.
     */
    hasUniformSet(player, factionId) {
        return this.getSelectedIndex(player, factionId) !== null;
    }

    // ── Clothing Application ──────────────────────────────────────────────────

    /**
     * Get the gender-appropriate uniforms list for a player.
     */
    getUniformsForPlayer(player, factionId) {
        const config = this.factionConfigs.get(factionId);
        if (!config) return [];
        const isMale = (player.data.gender === 0);
        return isMale ? config.uniforms.male : config.uniforms.female;
    }

    /**
     * Apply the selected uniform to the player (visual only, no inventory changes).
     * Returns true if applied, false if no uniform is set.
     */
    applyUniform(player, factionId) {
        const idx = this.getSelectedIndex(player, factionId);
        if (idx === null) return false;

        const uniforms = this.getUniformsForPlayer(player, factionId);
        if (!uniforms || !uniforms[idx]) return false;

        const uniform = uniforms[idx];

        // Apply clothing components
        if (uniform.components) {
            for (const comp of uniform.components) {
                player.setClothes(comp.id, comp.drawable, comp.texture, 0);
            }
        }

        // Apply props (hats, glasses, etc.)
        if (uniform.props) {
            for (const prop of uniform.props) {
                player.setProp(prop.id, prop.drawable, prop.texture);
            }
        }

        player.setVariable('wearingFactionUniform', true);
        return true;
    }

    /**
     * Remove the uniform and restore inventory-based outfit.
     * Uses the inventory system's refreshClothes method.
     */
    removeUniform(player) {
        try {
            // Get the inventory manager to restore clothes from inventory
            const inventoryManager = require('../../systems/inventory');
            if (inventoryManager && typeof inventoryManager.refreshClothes === 'function') {
                inventoryManager.refreshClothes(player);
            }
        } catch (e) {
            console.error('[Wardrobe] Failed to restore clothes from inventory:', e);
        }
        player.setVariable('wearingFactionUniform', false);
    }

    /**
     * Clear cache when player disconnects.
     */
    clearPlayerCache(player) {
        if (!player.data || !player.data.dbId) return;
        // Clear all faction selections for this player
        for (const [key] of this.playerSelections) {
            if (key.startsWith(`${player.data.dbId}:`)) {
                this.playerSelections.delete(key);
            }
        }
    }
}

const manager = new WardrobeManager();
module.exports = manager;
