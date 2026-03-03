// packages/factions/wardrobe/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Faction Wardrobe System — Server Events
// Handles wardrobe interaction, uniform selection, and preview.
// Factions register their configs elsewhere; this file wires up the generic events.
// ─────────────────────────────────────────────────────────────────────────────

const wardrobeManager = require('./wardrobeManager');
const factionsManager = require('../factionsManager');

// ── Event: Open wardrobe (triggered from interaction colshape) ────────────────
mp.events.add('faction:wardrobe:open', (player) => {
    if (!player.logged) return;

    const factionId = player.factionId;
    if (!factionId) {
        return player.outputChatBox('!{#ff4757}You are not in a faction.');
    }

    const config = wardrobeManager.getConfig(factionId);
    if (!config) {
        return player.outputChatBox('!{#ff4757}Your faction does not have a wardrobe set up.');
    }

    // Check distance to wardrobe point
    if (config.wardrobePoint) {
        const dist = player.dist(config.wardrobePoint);
        if (dist > 3.0 || player.dimension !== (config.wardrobeDimension || 0)) {
            return player.outputChatBox('!{#ff4757}You must be at the wardrobe to change uniforms.');
        }
    }

    // Get gender-appropriate uniforms
    const uniforms = wardrobeManager.getUniformsForPlayer(player, factionId);
    const currentIndex = wardrobeManager.getSelectedIndex(player, factionId);

    // Build data for client
    const payload = {
        factionId: factionId,
        factionName: config.name,
        uniforms: uniforms.map((u, i) => ({
            index: i,
            name: u.name,
            description: u.description || '',
            selected: i === currentIndex
        })),
        currentIndex: currentIndex
    };

    player.call('client:wardrobe:open', [JSON.stringify(payload)]);
});

// ── Event: Preview a uniform (client asks to try it on) ───────────────────────
mp.events.add('server:wardrobe:preview', (player, factionIdStr, indexStr) => {
    if (!player.logged) return;

    const factionId = parseInt(factionIdStr);
    const index = parseInt(indexStr);

    if (player.factionId !== factionId) return;

    const uniforms = wardrobeManager.getUniformsForPlayer(player, factionId);
    if (!uniforms || !uniforms[index]) return;

    const uniform = uniforms[index];

    // Apply preview clothes
    if (uniform.components) {
        for (const comp of uniform.components) {
            player.setClothes(comp.id, comp.drawable, comp.texture, 0);
        }
    }
    if (uniform.props) {
        for (const prop of uniform.props) {
            player.setProp(prop.id, prop.drawable, prop.texture);
        }
    }
});

// ── Event: Select/confirm a uniform ───────────────────────────────────────────
mp.events.add('server:wardrobe:select', async (player, factionIdStr, indexStr) => {
    if (!player.logged) return;

    const factionId = parseInt(factionIdStr);
    const index = parseInt(indexStr);

    if (player.factionId !== factionId) return;

    const uniforms = wardrobeManager.getUniformsForPlayer(player, factionId);
    if (!uniforms || !uniforms[index]) {
        return player.outputChatBox('!{#ff4757}Invalid uniform selection.');
    }

    await wardrobeManager.savePlayerUniform(player, factionId, index);

    player.outputChatBox(`!{#00ff00}Uniform set: !{#ffffff}${uniforms[index].name}`);
    player.outputChatBox('!{#cccccc}This uniform will be applied when you go on duty.');

    // Restore normal clothes after selection (they're not on duty yet)
    wardrobeManager.removeUniform(player);
});

// ── Event: Close wardrobe (restore clothes to inventory state) ────────────────
mp.events.add('server:wardrobe:close', (player) => {
    if (!player.logged) return;

    // Only restore if they're NOT currently on duty wearing a uniform
    if (!player.getVariable('factionDuty')) {
        wardrobeManager.removeUniform(player);
    }
});

// ── Load uniform data when player faction data is loaded ──────────────────────
mp.events.add('factionDataLoaded', (player) => {
    if (player.factionId) {
        wardrobeManager.loadPlayerUniform(player);
    }
});

// ── Cleanup on disconnect ─────────────────────────────────────────────────────
mp.events.add('playerQuit', (player) => {
    wardrobeManager.clearPlayerCache(player);
});

console.log('[Wardrobe] Faction wardrobe system loaded.');

module.exports = wardrobeManager;
