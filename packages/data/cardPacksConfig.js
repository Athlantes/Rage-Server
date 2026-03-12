/**
 * cardPacksConfig.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central configuration for all Card Pack loot tables.
 *
 * WEIGHT SYSTEM:
 *   Each reward has a `weight` value. The drop chance is:
 *     chance% = (weight / totalWeightOfAllRewards) * 100
 *
 *   Example: weight 400 in a pool totalling 1000 = 40% drop chance.
 *
 * REWARD TYPES:
 *   'cash'  → Adds player.data.money
 *   'pp'    → Adds player.data.premiumPoints
 *   'item'  → Calls inventorySystem.addItem(player, itemId, count)
 *
 * RARITY ORDER (worst → best, used by disconnect protection):
 *   common < uncommon < rare < epic < legendary
 * ─────────────────────────────────────────────────────────────────────────────
 */

module.exports = {

    // ── RARITY META ──────────────────────────────────────────────────────────
    rarities: {
        common:    { label: 'Common',    color: '#9E9E9E', glow: 'rgba(158,158,158,0.6)' },
        uncommon:  { label: 'Uncommon',  color: '#4CAF50', glow: 'rgba(76,175,80,0.7)'  },
        rare:      { label: 'Rare',      color: '#2196F3', glow: 'rgba(33,150,243,0.7)' },
        epic:      { label: 'Epic',      color: '#9C27B0', glow: 'rgba(156,39,176,0.8)' },
        legendary: { label: 'Legendary', color: '#FF6B35', glow: 'rgba(255,107,53,0.9)' },
    },

    // Higher number = weaker rarity (used to determine "worst" item on disconnect)
    rarityRank: { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 },

    // Progressive re-roll costs in Premium Points
    rerollCosts: [50, 100, 250, 500],

    // ── PACK DEFINITIONS ─────────────────────────────────────────────────────
    packs: {

        // ─ BRONZE STARTER PACK ───────────────────────────────────────────────
        tuning_pack: {
            id:          'tuning_pack',
            name:        'Tuning Card Pack',
            description: '',
            theme:       'bronze', // drives CSS theming in the UI
            cardCount:   5,

            rewards: [
                // COMMON ─────────────────────────────────────────────────────
                {
                    id: 'cash_250', type: 'cash', name: '$250 Cash',
                    value: 250, rarity: 'common', weight: 350,
                    icon: '💵', description: 'A couple of crumpled bills.'
                },
                {
                    id: 'cash_500', type: 'cash', name: '$500 Cash',
                    value: 500, rarity: 'common', weight: 300,
                    icon: '💵', description: 'Enough for a decent meal.'
                },
                {
                    id: 'common_part_x5', type: 'item', name: 'Common Car Part ×5',
                    itemId: 'car_part_common', count: 5, rarity: 'common', weight: 280,
                    icon: '🔧', description: 'Car parts used for tuning.'
                },
                {
                    id: 'common_part_x2', type: 'item', name: 'Common Car Part ×2',
                    itemId: 'car_part_common', count: 2, rarity: 'common', weight: 300,
                    icon: '🔧', description: 'Car parts used for tuning.'
                },
                // UNCOMMON ───────────────────────────────────────────────────
                {
                    id: 'cash_1500', type: 'cash', name: '$1,500 Cash',
                    value: 1500, rarity: 'uncommon', weight: 180,
                    icon: '💰', description: 'A nice little bonus.'
                },
                {
                    id: 'cash_3000', type: 'cash', name: '$3,000 Cash',
                    value: 3000, rarity: 'uncommon', weight: 140,
                    icon: '💰', description: 'Getting somewhere.'
                },
                {
                    id: 'uncommon_part_x2', type: 'item', name: 'Uncommon Car Part ×2',
                    itemId: 'car_part_uncommon', count: 2, rarity: 'uncommon', weight: 130,
                    icon: '🔧', description: 'Car parts used for tuning.'
                },
                {
                    id: 'pp_15', type: 'pp', name: '15 Premium Points',
                    value: 15, rarity: 'uncommon', weight: 120,
                    icon: '⭐', description: 'A sprinkle of premium currency.'
                },
                // RARE ────────────────────────────────────────────────────────
                {
                    id: 'cash_7500', type: 'cash', name: '$7,500 Cash',
                    value: 7500, rarity: 'rare', weight: 70,
                    icon: '💎', description: 'A generous sum.'
                },
                {
                    id: 'pp_50', type: 'pp', name: '50 Premium Points',
                    value: 50, rarity: 'rare', weight: 55,
                    icon: '🌟', description: 'Almost enough for a re-roll.'
                },
                {
                    id: 'rare_part_x2', type: 'item', name: 'Rare Car Part ×2',
                    itemId: 'car_part_rare', count: 2, rarity: 'rare', weight: 55,
                    icon: '🔧', description: 'Car parts used for tuning.'
                },
                // EPIC ────────────────────────────────────────────────────────
                {
                    id: 'cash_20000', type: 'cash', name: '$20,000 Cash',
                    value: 20000, rarity: 'epic', weight: 20,
                    icon: '🏆', description: 'Big money from a small pack!'
                },
                {
                    id: 'pp_100', type: 'pp', name: '100 Premium Points',
                    value: 100, rarity: 'epic', weight: 15,
                    icon: '👑', description: 'A hundred points of premium power.'
                },
                {
                    id: 'epic_part_x2', type: 'item', name: 'Epic Car Part ×2',
                    itemId: 'car_part_epic', count: 2, rarity: 'epic', weight: 15,
                    icon: '🔧', description: 'Car parts used for tuning.'
                },
                // LEGENDARY ───────────────────────────────────────────────────
                {
                    id: 'bronze_jackpot', type: 'cash', name: '🎰 $75,000 JACKPOT!',
                    value: 75000, rarity: 'legendary', weight: 5,
                    icon: '🎰', description: 'Against all odds, you hit the jackpot!'
                },
                {
                    id: 'legendary_part_x2', type: 'item', name: 'Legendary Car Part ×2',
                    itemId: 'car_part_legendary', count: 2, rarity: 'legendary', weight: 5,
                    icon: '🔧', description: 'Car parts used for tuning.'
                },
            ],
        },
    }, // end packs
};
