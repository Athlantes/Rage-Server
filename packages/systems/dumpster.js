const Inventory = require('./inventory'); 
const { isRateLimited } = require('../core/rateLimit');
const playerManager = require('../core/playerManager');

// Configuration
const CONFIG = {
    searchTime: 4000, 
    cooldownMinutes: 1, 
    damageChance: 0.15, 
    damageAmount: 10,   
    nothingChance: 0.25 
};

// Loot Table
const LOOT_TABLE = [
    { itemId: 'scrap_metal', min: 1, max: 3, weight: 50 },
    { itemId: 'plastic_bottle', min: 1, max: 2, weight: 40 },
    { itemId: 'broken_glass', min: 1, max: 5, weight: 30 },
    { itemId: 'old_sandwich', min: 1, max: 1, weight: 20 },
    { itemId: 'wallet_stolen', min: 1, max: 1, weight: 5 }, 
    { itemId: 'pistol_ammo', min: 2, max: 5, weight: 2 },
    { itemId: 'seed_pumpkin', min: 1, max: 3, weight: 15 },
];

class DumpsterSystem {
    constructor() {
        this.initEvents();
    }

    initEvents() {
        mp.events.add('server:searchDumpster', (player, dumpsterPosJson) => {
            if (!player || !mp.players.exists(player)) return;
            
            // We receive position as JSON string to ensure precision logic works
            const pos = JSON.parse(dumpsterPosJson);
            this.handleSearch(player, pos);
        });
    }

    async handleSearch(player, dumpsterPos) {
        if (player.vehicle) return;
        
        // --- FIX 1: Rate Limit Rejection ---
        // If limit is hit, tell client to RESET so they aren't stuck
        if (isRateLimited(player, 'dumpster:search', 2, 10000)) {
            player.call('showNotification', ['Dumpster', 'You are searching too fast.']);
            player.call('client:resetDumpsterSearch'); // <--- NEW EVENT
            return;
        }
        
        // --- FIX 2: Distance Check ---
        // Increased to 4.0 to match client, AND added reset if failed
        if (player.dist(new mp.Vector3(dumpsterPos.x, dumpsterPos.y, dumpsterPos.z)) > 4) {
            player.call('client:resetDumpsterSearch'); // <--- NEW EVENT
            return; 
        }

        // 2. Global Cooldown Check
        if (playerManager.hasCooldown(player, 'dumpster')) {
            const mins = playerManager.getCooldownTime(player, 'dumpster');
            player.call('client:resetDumpsterSearch'); 
            return player.call('showNotification', ['Dumpster', `You are tired. Rest for ${mins} minutes.`]);
        }

        // 3. Start Animation (Success)
        player.call('client:startDumpsterAnim', [CONFIG.searchTime]);
        
        // 4. Process Outcome
        setTimeout(async () => {
            if (!mp.players.exists(player)) return;
            
            // 5. Set Global Cooldown
            await playerManager.setCooldown(player, 'dumpster', CONFIG.cooldownMinutes);

            const roll = Math.random();

            // Outcome A: Injury
            if (roll < CONFIG.damageChance) {
                player.health = Math.max(0, player.health - CONFIG.damageAmount);
                player.call('showNotification', ['Danger', 'You cut your hand on broken glass!']);
                return;
            }

            // Outcome B: Nothing
            if (roll < (CONFIG.damageChance + CONFIG.nothingChance)) {
                player.call('showNotification', ['Dumpster', 'You found nothing but trash.']);
                return;
            }

            // Outcome C: Loot
            const item = this.getRandomLoot();
            const success = await Inventory.addItem(player, item.itemId, item.count);
            
            if (success) {
                player.call('showNotification', ['Dumpster', `Found ${item.count}x ${item.itemId.replace('_', ' ')}.`]);
            } else {
                player.call('showNotification', ['Inventory', 'No space to take the item.']);
            }

        }, CONFIG.searchTime);
    }

    getRandomLoot() {
        const totalWeight = LOOT_TABLE.reduce((sum, item) => sum + item.weight, 0);
        let random = Math.floor(Math.random() * totalWeight);
        
        for (const item of LOOT_TABLE) {
            if (random < item.weight) {
                const count = Math.floor(Math.random() * (item.max - item.min + 1)) + item.min;
                return { itemId: item.itemId, count: count };
            }
            random -= item.weight;
        }
        return { itemId: 'scrap_metal', count: 1 };
    }
}

module.exports = new DumpsterSystem();