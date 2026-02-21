// /packages/factions/Faction.js

class Faction {
    constructor(id, name, type, ranks) {
        this.id = id;               // e.g., 1
        this.name = name;           // e.g., "Los Santos Police Department"
        this.type = type;           // e.g., "LEO", "MAFIA", "PEACEFUL"
        this.ranks = ranks;         // Array of rank names: ["Cadet", "Officer", ..., "Chief"]
        
        // You can add generic properties here like vault balance, stock, etc.
    }

    // --- Core Methods ---

    // Send a message to all online members of this faction
    broadcast(message, color = "!{#00a8ff}") {
        mp.players.forEach(player => {
            if (player.logged && player.factionId === this.id) { // <--- CHANGE HERE
                player.outputChatBox(`${color}[${this.name}] ${player.name}: ${message}`);
            }
        });
    }

    // Get all online members (useful for UI menus or logic)
    getOnlineMembers() {
        let members = [];
        mp.players.forEach(player => {
            if (player.logged && player.factionId === this.id) { // <--- CHANGE HERE
                members.push(player);
            }
        });
        return members;
    }

    // A utility to check if a player has a required rank
    hasRank(player, requiredRank) {
        if (player.factionId !== this.id) return false;
        return player.factionRank >= requiredRank;
    }
}

module.exports = Faction;