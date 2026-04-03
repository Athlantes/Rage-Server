// /packages/factions/factionsManager.js
// ─────────────────────────────────────────────────────────────────────────────
// CHANGES:
//   - registerFaction automatically syncs the faction and its ranks to the DB.
//   - /f (faction chat) now shows: [FactionName] [RankName] Firstname Lastname: message
//     using the faction's ranks array so the rank name is human-readable.
//   - Only members of the SAME faction see the message.
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');
const DB   = require('../core/database');

class FactionsManager {
    constructor() {
        this.factions = new Map();
    }

    async registerFaction(factionInstance) {
        if (this.factions.has(factionInstance.id)) {
            console.error(`[Factions] Faction ID ${factionInstance.id} is already registered!`);
            return;
        }

        try {
            // 1. Sync Faction data into the `factions` table
            await DB.query(`
                INSERT INTO factions (id, \`key\`, name, type, color) 
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                name = VALUES(name), 
                type = VALUES(type), 
                color = VALUES(color)
            `, [
                factionInstance.id, 
                factionInstance.key, 
                factionInstance.name, 
                factionInstance.type, 
                factionInstance.color
            ]);

            // 2. Sync Faction Ranks into the `faction_ranks` table
            if (factionInstance.ranks && Array.isArray(factionInstance.ranks)) {
                for (let i = 0; i < factionInstance.ranks.length; i++) {
                    const rankName = factionInstance.ranks[i];
                    await DB.query(`
                        INSERT INTO faction_ranks (faction_id, rank_index, name)
                        VALUES (?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                        name = VALUES(name)
                    `, [factionInstance.id, i, rankName]);
                }
            }

            // 3. Save to memory
            this.factions.set(factionInstance.id, factionInstance);
            console.log(`[Factions] Loaded & DB Synced: ${factionInstance.name} (ID: ${factionInstance.id})`);

        } catch (error) {
            console.error(`[Factions] Failed to sync ${factionInstance.name} to DB:`, error);
        }
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

                // Notify other systems (e.g. wardrobe) that faction data is ready
                mp.events.call('factionDataLoaded', player);
            } else {
                player.factionId = null;
            }
        } catch (e) {
            console.error(`[Factions] Error loading player ${player.name} data:`, e);
        }
    }
}

const manager = new FactionsManager();
module.exports = manager;

// ── /f Faction Chat ───────────────────────────────────────────────────────────

mp.events.addCommand('f', (player, fullText) => {
    if (!fullText || fullText.trim() === '') {
        return player.outputChatBox('!{#ff4757}Usage: /f <message>');
    }

    if (!player.factionId) {
        return player.outputChatBox('!{#ff4757}You are not in a faction.');
    }

    const faction = manager.getFaction(player.factionId);
    if (!faction) {
        return player.outputChatBox('!{#ff4757}Your faction could not be found.');
    }

    const rankIndex = player.factionRank || 0;
    const rankName  = (faction.ranks && faction.ranks[rankIndex])
        ? faction.ranks[rankIndex]
        : `Rank ${rankIndex}`;

    const displayName = player.name.replace(/_/g, ' ');

    const message = `!{#ffc300}[${faction.name}] !{#ffffff}[${rankName}] ${displayName}!{#cccccc}: ${fullText.trim()}`;

    mp.players.forEach(p => {
        if (p.logged && p.factionId === player.factionId) {
            p.outputChatBox(message);
        }
    });
});