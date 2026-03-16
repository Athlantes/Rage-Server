/**
 * cardPacksConfig.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central configuration for all Card Pack loot tables.
 *
 * WEIGHT SYSTEM:
 * Each reward has a `weight` value. The drop chance is:
 * chance% = (weight / totalWeightOfAllRewards) * 100
 *
 * Example: weight 400 in a pool totalling 1000 = 40% drop chance.
 *
 * REWARD TYPES:
 * 'cash'  → Adds player.data.money
 * 'pp'    → Adds player.data.premiumPoints
 * 'item'  → Calls inventorySystem.addItem(player, itemId, count)
 *
 * RARITY ORDER (worst → best, used by disconnect protection):
 * common < uncommon < rare < epic < legendary
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

        // ─ BRONZE STARTER PACK (Tuning Pack) ─────────────────────────────────
        tuning_pack: {
            id:          'tuning_pack',
            name:        'Tuning Card Pack',
            description: '',
            theme:       'bronze', // drives CSS theming in the UI
            cardCount:   5,


            rewards: [
                // ─ COMMON ────────────────────────────────────────────────────
                { id:'cash_250',           type:'cash', name:'$250 Cash',               value:250,   rarity:'common',    weight:220, icon:'cash',         description:'A couple of crumpled bills.' },
                { id:'cash_500',           type:'cash', name:'$500 Cash',               value:500,   rarity:'common',    weight:180, icon:'cash',         description:'Enough for a decent meal.' },
                { id:'piston_x4',          type:'item', name:'Common Piston ×4',        itemId:'piston_common',          count:4, rarity:'common',    weight:160, icon:'piston',  description:'Basic pistons for entry-level engine work.' },
                { id:'brake_pad_x4',       type:'item', name:'Common Brake Pad ×4',     itemId:'brake_pad_common',       count:4, rarity:'common',    weight:150, icon:'brake_pad',  description:'Entry-grade brake friction material.' },
                { id:'tire_compound_x4',   type:'item', name:'Common Tire Compound ×4', itemId:'tire_compound_common',   count:4, rarity:'common',    weight:140, icon:'tire_compound',  description:'Standard rubber compound.' },
                { id:'exhaust_manifold_x2',type:'item', name:'Common Exhaust Manifold ×2',itemId:'exhaust_manifold_common',count:2,rarity:'common',  weight:130, icon:'exhaust_manifold',  description:'Stock-replacement exhaust collector.' },
                { id:'scrap_metal_x8',     type:'item', name:'Scrap Metal ×8',          itemId:'scrap_metal',            count:8, rarity:'common',    weight:120, icon:'scrap_metal',           description:'Raw salvage for crafting.' },
                { id:'machine_oil_x4',     type:'item', name:'Machine Oil ×4',          itemId:'machine_oil',            count:4, rarity:'common',    weight:120, icon:'machine_oil',           description:'Lubricant for mechanical components.' },
                // ─ UNCOMMON ──────────────────────────────────────────────────
                { id:'cash_1500',          type:'cash', name:'$1,500 Cash',             value:1500,  rarity:'uncommon',  weight:130, icon:'cash',         description:'A nice bonus.' },
                { id:'cash_3000',          type:'cash', name:'$3,000 Cash',             value:3000,  rarity:'uncommon',  weight:100, icon:'cash',         description:'Getting somewhere.' },
                { id:'gear_set_unc',       type:'item', name:'Uncommon Gear Set',       itemId:'gear_set_uncommon',      count:1, rarity:'uncommon',  weight:90,  icon:'gear_set',description:'Improved ratio gear set.' },
                { id:'coilover_unc_x2',    type:'item', name:'Uncommon Coilover Spring ×2',itemId:'coilover_spring_uncommon',count:2,rarity:'uncommon',weight:85,  icon:'coilover_spring',description:'Sport-grade lowering springs.' },
                { id:'brake_rotor_unc',    type:'item', name:'Uncommon Brake Rotor',    itemId:'brake_rotor_uncommon',   count:1, rarity:'uncommon',  weight:80,  icon:'brake_rotor',description:'Drilled and slotted performance rotor.' },
                { id:'turbo_manifold_unc_x2',type:'item',name:'Uncommon Turbo Manifold ×2',itemId:'turbo_manifold_uncommon',count:2,rarity:'uncommon',weight:75,  icon:'turbo_manifold',description:'Improved exhaust routing for boost.' },
                { id:'carbon_fiber_x3',    type:'item', name:'Carbon Fiber ×3',         itemId:'carbon_fiber',           count:3, rarity:'uncommon',  weight:70,  icon:'carbon_fiber',          description:'High-value lightweight material.' },
                { id:'pp_15',              type:'pp',   name:'15 Premium Points',       value:15,    rarity:'uncommon',  weight:65,  icon:'premium_points', description:'A sprinkle of premium currency.' },
                // ─ RARE ──────────────────────────────────────────────────────
                { id:'cash_7500',          type:'cash', name:'$7,500 Cash',             value:7500,  rarity:'rare',      weight:50,  icon:'cash',         description:'A generous sum.' },
                { id:'crankshaft_rare',    type:'item', name:'Rare Crankshaft',         itemId:'crankshaft_rare',        count:1, rarity:'rare',      weight:45,  icon:'crankshaft',    description:'Forged billet crankshaft.' },
                { id:'shock_absorber_rare_x2',type:'item',name:'Rare Shock Absorber ×2',itemId:'shock_absorber_rare',   count:2, rarity:'rare',      weight:40,  icon:'shock_absorber',    description:'Motorsport-grade dampers.' },
                { id:'intercooler_rare',   type:'item', name:'Rare Intercooler',        itemId:'intercooler_rare',       count:1, rarity:'rare',      weight:38,  icon:'intercooler',    description:'High-flow bar and plate intercooler.' },
                { id:'pp_50',              type:'pp',   name:'50 Premium Points',       value:50,    rarity:'rare',      weight:35,  icon:'premium_points', description:'Almost enough for a re-roll.' },
                // ─ EPIC ──────────────────────────────────────────────────────
                { id:'cash_20000',         type:'cash', name:'$20,000 Cash',            value:20000, rarity:'epic',      weight:18,  icon:'cash',         description:'Big money from a small pack!' },
                { id:'engine_block_epic',  type:'item', name:'Epic Engine Block',       itemId:'engine_block_epic',      count:1, rarity:'epic',      weight:12,  icon:'engine_block',    description:'Competition-spec billet engine block.' },
                { id:'carbon_panel_epic_x2',type:'item',name:'Epic Carbon Panel ×2',   itemId:'carbon_panel_epic',      count:2, rarity:'epic',      weight:10,  icon:'carbon_panel',    description:'Full-dry carbon replacement panels.' },
                { id:'pp_100',             type:'pp',   name:'100 Premium Points',      value:100,   rarity:'epic',      weight:9,   icon:'premium_points', description:'A hundred points of premium power.' },
                // ─ LEGENDARY ─────────────────────────────────────────────────
                { id:'bronze_jackpot',     type:'cash', name:'🎰 $75,000 JACKPOT!',    value:75000, rarity:'legendary', weight:4,   icon:'cash',         description:'Against all odds, you hit the jackpot!' },
                { id:'crankshaft_leg',     type:'item', name:'Legendary Crankshaft',    itemId:'crankshaft_legendary',   count:1, rarity:'legendary', weight:3,   icon:'crankshaft',description:'Titanium competition crankshaft.' },
                { id:'carbon_wing_leg',    type:'item', name:'Legendary Carbon Wing',   itemId:'carbon_wing_legendary',  count:1, rarity:'legendary', weight:2,   icon:'carbon_wing',description:'Full active aero carbon wing element.' },
            ],

        },
    }, // end packs
};