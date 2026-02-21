// /packages/factions/factionsManager.js
const fs = require('fs');
const path = require('path');
const DB = require('../core/database'); // Assuming this exports your mysql2 pool

class FactionsManager {
    constructor() {
        this.factions = new Map();
    }

    // Registers a newly created faction into the memory
    registerFaction(factionInstance) {
        if (this.factions.has(factionInstance.id)) {
            console.error(`[Factions] Faction ID ${factionInstance.id} is already registered!`);
            return;
        }
        this.factions.set(factionInstance.id, factionInstance);
        console.log(`[Factions] Loaded: ${factionInstance.name} (ID: ${factionInstance.id})`);
    }

    // Get a faction by ID
    getFaction(id) {
        return this.factions.get(id);
    }

    // --- Player Management ---

    // Call this when a player logs in (e.g., in your auth.js)
    async loadPlayerFactionData(player) {
        // Double check we actually have the player's DB ID
        if (!player.data || !player.data.dbId) {
            console.error(`[Factions] Cannot load data for ${player.name}, missing DB ID.`);
            return;
        }

        try {
            // CHANGE 1: Use 'users' table instead of 'accounts'
            // CHANGE 2: Use player.data.dbId
            const [rows] = await DB.query(
                "SELECT faction_id, faction_rank, faction_warns, faction_punish FROM users WHERE id = ?", 
                [player.data.dbId] 
            );

            if (rows.length > 0) {
                player.factionId = rows[0].faction_id;
                player.factionRank = rows[0].faction_rank;
                player.factionWarns = rows[0].faction_warns;
                player.factionPunish = rows[0].faction_punish;
                
                // Sync to client for UI purposes (Radial Menu, Inventory, etc.)
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

// --- Global Faction Events ---

// Example: Faction Chat
mp.events.addCommand('f', (player, fullText) => {
    if (!player.factionId || player.factionId === 0) {
        return player.outputChatBox("!{#ff0000}You are not in a faction.");
    }

    const faction = manager.getFaction(player.factionId);
    if (faction) {
        faction.broadcast(`(Rank ${player.factionRank}) ${fullText}`);
    }
});