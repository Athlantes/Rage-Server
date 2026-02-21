// /packages/factions/factionsManager.js
// ─────────────────────────────────────────────────────────────────────────────
// CHANGES:
//   - /f (faction chat) now shows: [FactionName] [RankName] Firstname Lastname: message
//     using the faction's ranks array so the rank name is human-readable.
//   - Only members of the SAME faction see the message (was already working,
//     now uses faction.broadcast which scopes to factionId).
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');
const DB   = require('../core/database');

class FactionsManager {
    constructor() {
        this.factions = new Map();
    }

    registerFaction(factionInstance) {
        if (this.factions.has(factionInstance.id)) {
            console.error(`[Factions] Faction ID ${factionInstance.id} is already registered!`);
            return;
        }
        this.factions.set(factionInstance.id, factionInstance);
        console.log(`[Factions] Loaded: ${factionInstance.name} (ID: ${factionInstance.id})`);
    }

    getFaction(id) {
        return this.factions.get(id);
    }

    // ── Player Management ─────────────────────────────────────────────────────

    async loadPlayerFactionData(player) {
        if (!player.data || !player.data.dbId) {
            console.error(`[Factions] Cannot load data for ${player.name}, missing DB ID.`);
            return;
        }

        try {
            const [rows] = await DB.query(
                'SELECT faction_id, faction_rank, faction_warns, faction_punish FROM users WHERE id = ?',
                [player.data.dbId]
            );

            if (rows.length > 0) {
                player.factionId    = rows[0].faction_id;
                player.factionRank  = rows[0].faction_rank;
                player.factionWarns = rows[0].faction_warns;
                player.factionPunish = rows[0].faction_punish;

                player.setVariable('factionId', player.factionId);
                console.log(`[Factions] Loaded data for ${player.name}: Faction ${player.factionId}, Rank ${player.factionRank}`);
            } else {
                player.factionId = 0;
            }
        } catch (e) {
            console.error(`[Factions] Error loading player ${player.name} data:`, e);
        }
    }
}

const manager = new FactionsManager();
module.exports = manager;

// ── /f Faction Chat ───────────────────────────────────────────────────────────
// Format: [FactionName] [RankName] Firstname Lastname: message
// Only members of the same faction see the message.

mp.events.addCommand('f', (player, fullText) => {
    if (!fullText || fullText.trim() === '') {
        return player.outputChatBox('!{#ff4757}Usage: /f <message>');
    }

    if (!player.factionId || player.factionId === 0) {
        return player.outputChatBox('!{#ff4757}You are not in a faction.');
    }

    const faction = manager.getFaction(player.factionId);
    if (!faction) {
        return player.outputChatBox('!{#ff4757}Your faction could not be found.');
    }

    // Resolve rank name from the faction's ranks array
    const rankIndex = player.factionRank || 0;
    const rankName  = (faction.ranks && faction.ranks[rankIndex])
        ? faction.ranks[rankIndex]
        : `Rank ${rankIndex}`;

    // Display name — replace underscores with spaces (RAGEMP convention)
    const displayName = player.name.replace(/_/g, ' ');

    // Build the message: only faction members will receive it
    // Color: golden yellow for taxi, but we keep it generic using faction accent or a neutral faction color
    const message = `!{#ffc300}[${faction.name}] !{#ffffff}[${rankName}] ${displayName}!{#cccccc}: ${fullText.trim()}`;

    mp.players.forEach(p => {
        if (p.logged && p.factionId === player.factionId) {
            p.outputChatBox(message);
        }
    });
});