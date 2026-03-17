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

        // ─ POWER PACK ────────────────────────────────────────────────────────
        power_pack: {
            id:          'power_pack',
            name:        'Power Card Pack',
            description: 'Engine & forced-induction components. Every card is a power upgrade.',
            theme:       'red',
            cardCount:   5,
            rewards: [
                // ─ COMMON ────────────────────────────────────────────────────
                { id:'pw_cash_300',              type:'cash', name:'$300 Cash',                    value:300,   rarity:'common',    weight:200, icon:'cash',            description:'Small payout.' },
                { id:'pw_cash_600',              type:'cash', name:'$600 Cash',                    value:600,   rarity:'common',    weight:160, icon:'cash',            description:'Covers workshop fees.' },
                { id:'pw_scrap_x8',              type:'item', name:'Scrap Metal ×8',               itemId:'scrap_metal',              count:8,  rarity:'common',    weight:150, icon:'scrap_metal',     description:'Raw salvage for crafting.' },
                { id:'pw_oil_x4',                type:'item', name:'Machine Oil ×4',               itemId:'machine_oil',              count:4,  rarity:'common',    weight:140, icon:'machine_oil',     description:'Lubricant for engine components.' },
                { id:'pw_piston_com',            type:'item', name:'Common Piston ×2',             itemId:'piston_common',            count:2,  rarity:'common',    weight:130, icon:'piston',          description:'Basic piston set.' },
                { id:'pw_crank_com',             type:'item', name:'Common Crankshaft',            itemId:'crankshaft_common',        count:1,  rarity:'common',    weight:120, icon:'crankshaft',      description:'Entry-level crankshaft.' },
                { id:'pw_engblk_com',            type:'item', name:'Common Engine Block',          itemId:'engine_block_common',      count:1,  rarity:'common',    weight:110, icon:'engine_block',    description:'Stock engine block.' },
                { id:'pw_turbo_com',             type:'item', name:'Common Turbo Manifold',        itemId:'turbo_manifold_common',    count:1,  rarity:'common',    weight:110, icon:'turbo_manifold',  description:'Standard manifold.' },
                { id:'pw_intercool_com',         type:'item', name:'Common Intercooler',           itemId:'intercooler_common',       count:1,  rarity:'common',    weight:100, icon:'intercooler',     description:'Basic intercooler.' },
                { id:'pw_wastegate_com',         type:'item', name:'Common Wastegate',             itemId:'wastegate_common',         count:1,  rarity:'common',    weight:100, icon:'wastegate',       description:'Factory wastegate.' },
                { id:'pw_ecu_com',               type:'item', name:'Common ECU Chip',              itemId:'ecu_chip_common',          count:1,  rarity:'common',    weight:95,  icon:'ecu_chip',        description:'Base ECU processor.' },
                { id:'pw_injector_com',          type:'item', name:'Common Fuel Injector',         itemId:'fuel_injector_common',     count:1,  rarity:'common',    weight:95,  icon:'fuel_injector',   description:'Standard injector.' },
                { id:'pw_exhdr_com',             type:'item', name:'Common Exhaust Header',        itemId:'exhaust_header_common',    count:1,  rarity:'common',    weight:90,  icon:'exhaust_header',  description:'Replacement header.' },
                { id:'pw_exman_com',             type:'item', name:'Common Exhaust Manifold',      itemId:'exhaust_manifold_common',  count:1,  rarity:'common',    weight:90,  icon:'exhaust_manifold',description:'Cast iron manifold.' },
                // ─ UNCOMMON ──────────────────────────────────────────────────
                { id:'pw_cash_2000',             type:'cash', name:'$2,000 Cash',                  value:2000,  rarity:'uncommon',  weight:110, icon:'cash',            description:'A nice bonus.' },
                { id:'pw_alum_x3',               type:'item', name:'Aluminum Sheet ×3',            itemId:'aluminum_sheet',           count:3,  rarity:'uncommon',  weight:100, icon:'aluminum_sheet',  description:'Lightweight fabrication material.' },
                { id:'pw_piston_unc',            type:'item', name:'Uncommon Piston',              itemId:'piston_uncommon',          count:1,  rarity:'uncommon',  weight:90,  icon:'piston',          description:'Performance-ground piston.' },
                { id:'pw_crank_unc',             type:'item', name:'Uncommon Crankshaft',          itemId:'crankshaft_uncommon',      count:1,  rarity:'uncommon',  weight:85,  icon:'crankshaft',      description:'Balanced crankshaft.' },
                { id:'pw_turbo_unc',             type:'item', name:'Uncommon Turbo Manifold',      itemId:'turbo_manifold_uncommon',  count:1,  rarity:'uncommon',  weight:80,  icon:'turbo_manifold',  description:'Ported turbo manifold.' },
                { id:'pw_intercool_unc',         type:'item', name:'Uncommon Intercooler',         itemId:'intercooler_uncommon',     count:1,  rarity:'uncommon',  weight:80,  icon:'intercooler',     description:'Upgraded intercooler.' },
                { id:'pw_ecu_unc',               type:'item', name:'Uncommon ECU Chip',            itemId:'ecu_chip_uncommon',        count:1,  rarity:'uncommon',  weight:75,  icon:'ecu_chip',        description:'Remapped ECU.' },
                { id:'pw_injector_unc',          type:'item', name:'Uncommon Fuel Injector ×2',    itemId:'fuel_injector_uncommon',   count:2,  rarity:'uncommon',  weight:70,  icon:'fuel_injector',   description:'High-flow injectors.' },
                { id:'pw_pp_20',                 type:'pp',   name:'20 Premium Points',            value:20,    rarity:'uncommon',  weight:65,  icon:'premium_points',  description:'Premium currency.' },
                // ─ RARE ──────────────────────────────────────────────────────
                { id:'pw_cash_8000',             type:'cash', name:'$8,000 Cash',                  value:8000,  rarity:'rare',      weight:45,  icon:'cash',            description:'Serious coin.' },
                { id:'pw_carbon_x2',             type:'item', name:'Carbon Fiber ×2',              itemId:'carbon_fiber',             count:2,  rarity:'rare',        weight:40,  icon:'carbon_fiber',    description:'Premium lightweight material.' },
                { id:'pw_crank_rare',            type:'item', name:'Rare Crankshaft',              itemId:'crankshaft_rare',          count:1,  rarity:'rare',        weight:38,  icon:'crankshaft',      description:'Forged billet crankshaft.' },
                { id:'pw_engblk_rare',           type:'item', name:'Rare Engine Block',            itemId:'engine_block_rare',        count:1,  rarity:'rare',        weight:35,  icon:'engine_block',    description:'Race-prepped engine block.' },
                { id:'pw_intercool_rare',        type:'item', name:'Rare Intercooler',             itemId:'intercooler_rare',         count:1,  rarity:'rare',        weight:33,  icon:'intercooler',     description:'High-flow bar-and-plate.' },
                { id:'pw_ecu_rare',              type:'item', name:'Rare ECU Chip',                itemId:'ecu_chip_rare',            count:1,  rarity:'rare',        weight:30,  icon:'ecu_chip',        description:'Stage 3 ECU map.' },
                { id:'pw_pp_50',                 type:'pp',   name:'50 Premium Points',            value:50,    rarity:'rare',        weight:28,  icon:'premium_points',  description:'Premium boost.' },
                // ─ EPIC ──────────────────────────────────────────────────────
                { id:'pw_cash_25000',            type:'cash', name:'$25,000 Cash',                 value:25000, rarity:'epic',        weight:14,  icon:'cash',            description:'Big engine money.' },
                { id:'pw_crank_epic',            type:'item', name:'Epic Crankshaft',              itemId:'crankshaft_epic',          count:1,  rarity:'epic',        weight:11,  icon:'crankshaft',      description:'Titanium competition crank.' },
                { id:'pw_engblk_epic',           type:'item', name:'Epic Engine Block',            itemId:'engine_block_epic',        count:1,  rarity:'epic',        weight:10,  icon:'engine_block',    description:'Competition billet block.' },
                { id:'pw_turbo_epic',            type:'item', name:'Epic Turbo Manifold',          itemId:'turbo_manifold_epic',      count:1,  rarity:'epic',        weight:9,   icon:'turbo_manifold',  description:'Equal-length race manifold.' },
                { id:'pw_pp_100',                type:'pp',   name:'100 Premium Points',           value:100,   rarity:'epic',        weight:8,   icon:'premium_points',  description:'Premium jackpot.' },
                // ─ LEGENDARY ─────────────────────────────────────────────────
                { id:'pw_jackpot',               type:'cash', name:'🎰 $80,000 JACKPOT!',         value:80000, rarity:'legendary',   weight:3,   icon:'cash',            description:'The engine gods smile on you!' },
                { id:'pw_crank_leg',             type:'item', name:'Legendary Crankshaft',         itemId:'crankshaft_legendary',     count:1,  rarity:'legendary',   weight:2,   icon:'crankshaft',      description:'Titanium crankshaft, hand-balanced.' },
                { id:'pw_engblk_leg',            type:'item', name:'Legendary Engine Block',       itemId:'engine_block_legendary',   count:1,  rarity:'legendary',   weight:2,   icon:'engine_block',    description:'Fully blueprinted race block.' },
            ],
        },

        // ─ DRIVETRAIN PACK ───────────────────────────────────────────────────
        drivetrain_pack: {
            id:          'drivetrain_pack',
            name:        'Drivetrain Card Pack',
            description: 'Gearbox, differential and clutch components for peak power delivery.',
            theme:       'orange',
            cardCount:   5,
            rewards: [
                // ─ COMMON ────────────────────────────────────────────────────
                { id:'dt_cash_300',              type:'cash', name:'$300 Cash',                    value:300,   rarity:'common',    weight:200, icon:'cash',            description:'Small payout.' },
                { id:'dt_cash_600',              type:'cash', name:'$600 Cash',                    value:600,   rarity:'common',    weight:160, icon:'cash',            description:'Workshop coverage.' },
                { id:'dt_scrap_x8',              type:'item', name:'Scrap Metal ×8',               itemId:'scrap_metal',              count:8,  rarity:'common',    weight:150, icon:'scrap_metal',     description:'Salvage for crafting.' },
                { id:'dt_oil_x6',                type:'item', name:'Machine Oil ×6',               itemId:'machine_oil',              count:6,  rarity:'common',    weight:145, icon:'machine_oil',     description:'Essential drivetrain lubricant.' },
                { id:'dt_rubber_x4',             type:'item', name:'Rubber Compound ×4',           itemId:'rubber_compound',          count:4,  rarity:'common',    weight:135, icon:'rubber_compound', description:'For clutch and seal work.' },
                { id:'dt_gear_com',              type:'item', name:'Common Gear Set',              itemId:'gear_set_common',          count:1,  rarity:'common',    weight:130, icon:'gear_set',        description:'Street-ratio gear set.' },
                { id:'dt_clutch_com',            type:'item', name:'Common Clutch Kit',            itemId:'clutch_kit_common',        count:1,  rarity:'common',    weight:120, icon:'clutch_kit',      description:'Standard clutch plate & cover.' },
                { id:'dt_lsd_com',               type:'item', name:'Common LSD Pack',              itemId:'lsd_pack_common',          count:1,  rarity:'common',    weight:110, icon:'lsd_pack',        description:'Entry LSD clutch pack.' },
                { id:'dt_ring_com',              type:'item', name:'Common Ring & Pinion',         itemId:'ring_pinion_common',       count:1,  rarity:'common',    weight:110, icon:'ring_pinion',     description:'Factory final drive ratio.' },
                // ─ UNCOMMON ──────────────────────────────────────────────────
                { id:'dt_cash_2000',             type:'cash', name:'$2,000 Cash',                  value:2000,  rarity:'uncommon',  weight:110, icon:'cash',            description:'A nice bonus.' },
                { id:'dt_alum_x3',               type:'item', name:'Aluminum Sheet ×3',            itemId:'aluminum_sheet',           count:3,  rarity:'uncommon',  weight:100, icon:'aluminum_sheet',  description:'Light hardware material.' },
                { id:'dt_gear_unc',              type:'item', name:'Uncommon Gear Set',            itemId:'gear_set_uncommon',        count:1,  rarity:'uncommon',  weight:90,  icon:'gear_set',        description:'Close-ratio performance gears.' },
                { id:'dt_clutch_unc',            type:'item', name:'Uncommon Clutch Kit',          itemId:'clutch_kit_uncommon',      count:1,  rarity:'uncommon',  weight:85,  icon:'clutch_kit',      description:'Upgraded friction clutch kit.' },
                { id:'dt_lsd_unc',               type:'item', name:'Uncommon LSD Pack',            itemId:'lsd_pack_uncommon',        count:1,  rarity:'uncommon',  weight:80,  icon:'lsd_pack',        description:'Sport LSD clutch stack.' },
                { id:'dt_ring_unc',              type:'item', name:'Uncommon Ring & Pinion',       itemId:'ring_pinion_uncommon',     count:1,  rarity:'uncommon',  weight:75,  icon:'ring_pinion',     description:'Performance final drive.' },
                { id:'dt_pp_20',                 type:'pp',   name:'20 Premium Points',            value:20,    rarity:'uncommon',  weight:65,  icon:'premium_points',  description:'Premium currency.' },
                // ─ RARE ──────────────────────────────────────────────────────
                { id:'dt_cash_8000',             type:'cash', name:'$8,000 Cash',                  value:8000,  rarity:'rare',      weight:45,  icon:'cash',            description:'Serious coin.' },
                { id:'dt_carbon_x2',             type:'item', name:'Carbon Fiber ×2',              itemId:'carbon_fiber',             count:2,  rarity:'rare',        weight:40,  icon:'carbon_fiber',    description:'Premium lightweight material.' },
                { id:'dt_gear_rare',             type:'item', name:'Rare Gear Set',                itemId:'gear_set_rare',            count:1,  rarity:'rare',        weight:38,  icon:'gear_set',        description:'Race-spec gear set.' },
                { id:'dt_clutch_rare',           type:'item', name:'Rare Clutch Kit',              itemId:'clutch_kit_rare',          count:1,  rarity:'rare',        weight:35,  icon:'clutch_kit',      description:'Carbon-ceramic clutch.' },
                { id:'dt_lsd_rare',              type:'item', name:'Rare LSD Pack',                itemId:'lsd_pack_rare',            count:1,  rarity:'rare',        weight:33,  icon:'lsd_pack',        description:'Motorsport LSD pack.' },
                { id:'dt_ring_rare',             type:'item', name:'Rare Ring & Pinion',           itemId:'ring_pinion_rare',         count:1,  rarity:'rare',        weight:30,  icon:'ring_pinion',     description:'Short final drive ratio.' },
                { id:'dt_pp_50',                 type:'pp',   name:'50 Premium Points',            value:50,    rarity:'rare',        weight:28,  icon:'premium_points',  description:'Premium boost.' },
                // ─ EPIC ──────────────────────────────────────────────────────
                { id:'dt_cash_25000',            type:'cash', name:'$25,000 Cash',                 value:25000, rarity:'epic',        weight:14,  icon:'cash',            description:'Big drivetrain money.' },
                { id:'dt_gear_epic',             type:'item', name:'Epic Gear Set',                itemId:'gear_set_epic',            count:1,  rarity:'epic',        weight:11,  icon:'gear_set',        description:'Dog-engagement race gears.' },
                { id:'dt_clutch_epic',           type:'item', name:'Epic Clutch Kit',              itemId:'clutch_kit_epic',          count:1,  rarity:'epic',        weight:10,  icon:'clutch_kit',      description:'Twin-plate ceramic clutch.' },
                { id:'dt_lsd_epic',              type:'item', name:'Epic LSD Pack',                itemId:'lsd_pack_epic',            count:1,  rarity:'epic',        weight:9,   icon:'lsd_pack',        description:'Full competition LSD.' },
                { id:'dt_pp_100',                type:'pp',   name:'100 Premium Points',           value:100,   rarity:'epic',        weight:8,   icon:'premium_points',  description:'Premium jackpot.' },
                // ─ LEGENDARY ─────────────────────────────────────────────────
                { id:'dt_jackpot',               type:'cash', name:'🎰 $80,000 JACKPOT!',         value:80000, rarity:'legendary',   weight:3,   icon:'cash',            description:'The gearbox gods reward you!' },
                { id:'dt_gear_leg',              type:'item', name:'Legendary Gear Set',           itemId:'gear_set_legendary',       count:1,  rarity:'legendary',   weight:2,   icon:'gear_set',        description:'Sequential race gear set.' },
                { id:'dt_lsd_leg',               type:'item', name:'Legendary LSD Pack',           itemId:'lsd_pack_legendary',       count:1,  rarity:'legendary',   weight:2,   icon:'lsd_pack',        description:'Active torque-vectoring LSD.' },
            ],
        },

        // ─ HANDLING PACK ─────────────────────────────────────────────────────
        handling_pack: {
            id:          'handling_pack',
            name:        'Handling Card Pack',
            description: 'Brakes, suspension and tyres. Master every corner.',
            theme:       'blue',
            cardCount:   5,
            rewards: [
                // ─ COMMON ────────────────────────────────────────────────────
                { id:'ha_cash_300',              type:'cash', name:'$300 Cash',                    value:300,   rarity:'common',    weight:200, icon:'cash',            description:'Small payout.' },
                { id:'ha_cash_600',              type:'cash', name:'$600 Cash',                    value:600,   rarity:'common',    weight:160, icon:'cash',            description:'Workshop coverage.' },
                { id:'ha_scrap_x6',              type:'item', name:'Scrap Metal ×6',               itemId:'scrap_metal',              count:6,  rarity:'common',    weight:150, icon:'scrap_metal',     description:'Metal for suspension work.' },
                { id:'ha_rubber_x6',             type:'item', name:'Rubber Compound ×6',           itemId:'rubber_compound',          count:6,  rarity:'common',    weight:145, icon:'rubber_compound', description:'For brakes and tyres.' },
                { id:'ha_oil_x3',                type:'item', name:'Machine Oil ×3',               itemId:'machine_oil',              count:3,  rarity:'common',    weight:130, icon:'machine_oil',     description:'Damper lubricant.' },
                { id:'ha_brake_rotor_com',       type:'item', name:'Common Brake Rotor',           itemId:'brake_rotor_common',       count:1,  rarity:'common',    weight:120, icon:'brake_rotor',     description:'Vented stock rotor.' },
                { id:'ha_brake_cal_com',         type:'item', name:'Common Brake Caliper',         itemId:'brake_caliper_common',     count:1,  rarity:'common',    weight:115, icon:'brake_caliper',   description:'Single-piston caliper.' },
                { id:'ha_brake_pad_com',         type:'item', name:'Common Brake Pad ×2',          itemId:'brake_pad_common',         count:2,  rarity:'common',    weight:110, icon:'brake_pad',       description:'Standard brake pads.' },
                { id:'ha_coil_com',              type:'item', name:'Common Coilover Spring',       itemId:'coilover_spring_common',   count:1,  rarity:'common',    weight:105, icon:'coilover_spring', description:'Stock rate spring.' },
                { id:'ha_shock_com',             type:'item', name:'Common Shock Absorber',        itemId:'shock_absorber_common',    count:1,  rarity:'common',    weight:105, icon:'shock_absorber',  description:'Standard damper.' },
                { id:'ha_sway_com',              type:'item', name:'Common Sway Bar',              itemId:'sway_bar_common',          count:1,  rarity:'common',    weight:100, icon:'sway_bar',        description:'Factory anti-roll bar.' },
                { id:'ha_tire_com',              type:'item', name:'Common Tire Compound ×2',      itemId:'tire_compound_common',     count:2,  rarity:'common',    weight:100, icon:'tire_compound',   description:'All-season rubber.' },
                { id:'ha_bearing_com',           type:'item', name:'Common Wheel Bearing ×2',      itemId:'wheel_bearing_common',     count:2,  rarity:'common',    weight:95,  icon:'wheel_bearing',   description:'Standard wheel bearing.' },
                // ─ UNCOMMON ──────────────────────────────────────────────────
                { id:'ha_cash_2000',             type:'cash', name:'$2,000 Cash',                  value:2000,  rarity:'uncommon',  weight:110, icon:'cash',            description:'A nice bonus.' },
                { id:'ha_alum_x3',               type:'item', name:'Aluminum Sheet ×3',            itemId:'aluminum_sheet',           count:3,  rarity:'uncommon',  weight:100, icon:'aluminum_sheet',  description:'Lightweight bracket material.' },
                { id:'ha_brake_rotor_unc',       type:'item', name:'Uncommon Brake Rotor',         itemId:'brake_rotor_uncommon',     count:1,  rarity:'uncommon',  weight:90,  icon:'brake_rotor',     description:'Drilled performance rotor.' },
                { id:'ha_coil_unc',              type:'item', name:'Uncommon Coilover Spring ×2',  itemId:'coilover_spring_uncommon', count:2,  rarity:'uncommon',  weight:85,  icon:'coilover_spring', description:'Sport lowering springs.' },
                { id:'ha_shock_unc',             type:'item', name:'Uncommon Shock Absorber',      itemId:'shock_absorber_uncommon',  count:1,  rarity:'uncommon',  weight:80,  icon:'shock_absorber',  description:'Adjustable damper.' },
                { id:'ha_tire_unc',              type:'item', name:'Uncommon Tire Compound',       itemId:'tire_compound_uncommon',   count:1,  rarity:'uncommon',  weight:75,  icon:'tire_compound',   description:'Performance compound.' },
                { id:'ha_sway_unc',              type:'item', name:'Uncommon Sway Bar',            itemId:'sway_bar_uncommon',        count:1,  rarity:'uncommon',  weight:70,  icon:'sway_bar',        description:'Sport anti-roll bar.' },
                { id:'ha_pp_20',                 type:'pp',   name:'20 Premium Points',            value:20,    rarity:'uncommon',  weight:65,  icon:'premium_points',  description:'Premium currency.' },
                // ─ RARE ──────────────────────────────────────────────────────
                { id:'ha_cash_8000',             type:'cash', name:'$8,000 Cash',                  value:8000,  rarity:'rare',      weight:45,  icon:'cash',            description:'Serious coin.' },
                { id:'ha_carbon_x2',             type:'item', name:'Carbon Fiber ×2',              itemId:'carbon_fiber',             count:2,  rarity:'rare',        weight:40,  icon:'carbon_fiber',    description:'Lightweight material.' },
                { id:'ha_brake_rotor_rare',      type:'item', name:'Rare Brake Rotor',             itemId:'brake_rotor_rare',         count:1,  rarity:'rare',        weight:38,  icon:'brake_rotor',     description:'Cross-drilled floating rotor.' },
                { id:'ha_coil_rare',             type:'item', name:'Rare Coilover Spring',         itemId:'coilover_spring_rare',     count:1,  rarity:'rare',        weight:35,  icon:'coilover_spring', description:'Race-spec spring rate.' },
                { id:'ha_shock_rare_x2',         type:'item', name:'Rare Shock Absorber ×2',       itemId:'shock_absorber_rare',      count:2,  rarity:'rare',        weight:33,  icon:'shock_absorber',  description:'Motorsport-grade dampers.' },
                { id:'ha_tire_rare',             type:'item', name:'Rare Tire Compound',           itemId:'tire_compound_rare',       count:1,  rarity:'rare',        weight:30,  icon:'tire_compound',   description:'Slick-pattern track compound.' },
                { id:'ha_pp_50',                 type:'pp',   name:'50 Premium Points',            value:50,    rarity:'rare',        weight:28,  icon:'premium_points',  description:'Premium boost.' },
                // ─ EPIC ──────────────────────────────────────────────────────
                { id:'ha_cash_25000',            type:'cash', name:'$25,000 Cash',                 value:25000, rarity:'epic',        weight:14,  icon:'cash',            description:'Big handling money.' },
                { id:'ha_coil_epic',             type:'item', name:'Epic Coilover Spring',         itemId:'coilover_spring_epic',     count:1,  rarity:'epic',        weight:11,  icon:'coilover_spring', description:'Competition coilover unit.' },
                { id:'ha_shock_epic',            type:'item', name:'Epic Shock Absorber',          itemId:'shock_absorber_epic',      count:1,  rarity:'epic',        weight:10,  icon:'shock_absorber',  description:'Remote-reservoir damper.' },
                { id:'ha_tire_epic',             type:'item', name:'Epic Tire Compound',           itemId:'tire_compound_epic',       count:1,  rarity:'epic',        weight:9,   icon:'tire_compound',   description:'Slick race tyre compound.' },
                { id:'ha_pp_100',                type:'pp',   name:'100 Premium Points',           value:100,   rarity:'epic',        weight:8,   icon:'premium_points',  description:'Premium jackpot.' },
                // ─ LEGENDARY ─────────────────────────────────────────────────
                { id:'ha_jackpot',               type:'cash', name:'🎰 $80,000 JACKPOT!',         value:80000, rarity:'legendary',   weight:3,   icon:'cash',            description:'Grip gods rewarded your dedication!' },
                { id:'ha_shock_leg',             type:'item', name:'Legendary Shock Absorber',     itemId:'shock_absorber_legendary', count:1,  rarity:'legendary',   weight:2,   icon:'shock_absorber',  description:'Active magnetic ride damper.' },
                { id:'ha_tire_leg',              type:'item', name:'Legendary Tire Compound',      itemId:'tire_compound_legendary',  count:1,  rarity:'legendary',   weight:2,   icon:'tire_compound',   description:'Full slick ultra-grip compound.' },
            ],
        },

        // ─ CHASSIS PACK ──────────────────────────────────────────────────────
        chassis_pack: {
            id:          'chassis_pack',
            name:        'Chassis Card Pack',
            description: 'Roll cage, carbon panels and weight-reduction hardware.',
            theme:       'silver',
            cardCount:   5,
            rewards: [
                // ─ COMMON ────────────────────────────────────────────────────
                { id:'ch_cash_300',              type:'cash', name:'$300 Cash',                    value:300,   rarity:'common',    weight:200, icon:'cash',            description:'Small payout.' },
                { id:'ch_cash_600',              type:'cash', name:'$600 Cash',                    value:600,   rarity:'common',    weight:160, icon:'cash',            description:'Workshop coverage.' },
                { id:'ch_scrap_x10',             type:'item', name:'Scrap Metal ×10',              itemId:'scrap_metal',              count:10, rarity:'common',    weight:155, icon:'scrap_metal',     description:'Steel for chassis work.' },
                { id:'ch_alum_x4',               type:'item', name:'Aluminum Sheet ×4',            itemId:'aluminum_sheet',           count:4,  rarity:'common',    weight:145, icon:'aluminum_sheet',  description:'Hardware and brackets.' },
                { id:'ch_chromoly_com',          type:'item', name:'Common Chromoly Tube',         itemId:'chromoly_tube_common',     count:1,  rarity:'common',    weight:130, icon:'chromoly_tube',   description:'Basic cage tube.' },
                { id:'ch_gusset_com_x2',         type:'item', name:'Common Gusset Plate ×2',       itemId:'gusset_plate_common',      count:2,  rarity:'common',    weight:120, icon:'gusset_plate',    description:'Joint reinforcement plates.' },
                { id:'ch_carbon_panel_com',      type:'item', name:'Common Carbon Panel',          itemId:'carbon_panel_common',      count:1,  rarity:'common',    weight:115, icon:'carbon_panel',    description:'Lightweight replacement panel.' },
                { id:'ch_alum_hw_com',           type:'item', name:'Common Aluminum Hardware ×2',  itemId:'aluminum_hardware_common', count:2,  rarity:'common',    weight:110, icon:'aluminum_hardware',description:'Lightweight fasteners.' },
                // ─ UNCOMMON ──────────────────────────────────────────────────
                { id:'ch_cash_2000',             type:'cash', name:'$2,000 Cash',                  value:2000,  rarity:'uncommon',  weight:110, icon:'cash',            description:'A nice bonus.' },
                { id:'ch_carbon_x2',             type:'item', name:'Carbon Fiber ×2',              itemId:'carbon_fiber',             count:2,  rarity:'uncommon',  weight:105, icon:'carbon_fiber',    description:'Premium lightweight material.' },
                { id:'ch_chromoly_unc',          type:'item', name:'Uncommon Chromoly Tube',       itemId:'chromoly_tube_uncommon',   count:1,  rarity:'uncommon',  weight:95,  icon:'chromoly_tube',   description:'Seamless DOM cage tube.' },
                { id:'ch_gusset_unc',            type:'item', name:'Uncommon Gusset Plate',        itemId:'gusset_plate_uncommon',    count:1,  rarity:'uncommon',  weight:85,  icon:'gusset_plate',    description:'CNC-cut gusset.' },
                { id:'ch_carbon_panel_unc',      type:'item', name:'Uncommon Carbon Panel',        itemId:'carbon_panel_uncommon',    count:1,  rarity:'uncommon',  weight:80,  icon:'carbon_panel',    description:'2×2 twill carbon panel.' },
                { id:'ch_alum_hw_unc',           type:'item', name:'Uncommon Aluminum Hardware',   itemId:'aluminum_hardware_uncommon',count:1, rarity:'uncommon',  weight:75,  icon:'aluminum_hardware',description:'Titanium-grade fasteners.' },
                { id:'ch_pp_20',                 type:'pp',   name:'20 Premium Points',            value:20,    rarity:'uncommon',  weight:65,  icon:'premium_points',  description:'Premium currency.' },
                // ─ RARE ──────────────────────────────────────────────────────
                { id:'ch_cash_8000',             type:'cash', name:'$8,000 Cash',                  value:8000,  rarity:'rare',      weight:45,  icon:'cash',            description:'Serious coin.' },
                { id:'ch_carbon_x4',             type:'item', name:'Carbon Fiber ×4',              itemId:'carbon_fiber',             count:4,  rarity:'rare',        weight:40,  icon:'carbon_fiber',    description:'High-value material bundle.' },
                { id:'ch_chromoly_rare',         type:'item', name:'Rare Chromoly Tube',           itemId:'chromoly_tube_rare',       count:1,  rarity:'rare',        weight:38,  icon:'chromoly_tube',   description:'4130 chromoly tube, bent.' },
                { id:'ch_carbon_panel_rare',     type:'item', name:'Rare Carbon Panel',            itemId:'carbon_panel_rare',        count:1,  rarity:'rare',        weight:35,  icon:'carbon_panel',    description:'Dry carbon exterior panel.' },
                { id:'ch_gusset_rare',           type:'item', name:'Rare Gusset Plate',            itemId:'gusset_plate_rare',        count:1,  rarity:'rare',        weight:30,  icon:'gusset_plate',    description:'Laser-cut chromoly gusset.' },
                { id:'ch_alum_hw_rare',          type:'item', name:'Rare Aluminum Hardware',       itemId:'aluminum_hardware_rare',   count:1,  rarity:'rare',        weight:28,  icon:'aluminum_hardware',description:'Anodized titanium kit.' },
                { id:'ch_pp_50',                 type:'pp',   name:'50 Premium Points',            value:50,    rarity:'rare',        weight:28,  icon:'premium_points',  description:'Premium boost.' },
                // ─ EPIC ──────────────────────────────────────────────────────
                { id:'ch_cash_25000',            type:'cash', name:'$25,000 Cash',                 value:25000, rarity:'epic',        weight:14,  icon:'cash',            description:'Big chassis money.' },
                { id:'ch_chromoly_epic',         type:'item', name:'Epic Chromoly Tube',           itemId:'chromoly_tube_epic',       count:1,  rarity:'epic',        weight:11,  icon:'chromoly_tube',   description:'Competition cage tube set.' },
                { id:'ch_carbon_panel_epic',     type:'item', name:'Epic Carbon Panel ×2',         itemId:'carbon_panel_epic',        count:2,  rarity:'epic',        weight:10,  icon:'carbon_panel',    description:'Full dry-carbon body panels.' },
                { id:'ch_alum_hw_epic',          type:'item', name:'Epic Aluminum Hardware',       itemId:'aluminum_hardware_epic',   count:1,  rarity:'epic',        weight:9,   icon:'aluminum_hardware',description:'Full titanium fastener set.' },
                { id:'ch_pp_100',                type:'pp',   name:'100 Premium Points',           value:100,   rarity:'epic',        weight:8,   icon:'premium_points',  description:'Premium jackpot.' },
                // ─ LEGENDARY ─────────────────────────────────────────────────
                { id:'ch_jackpot',               type:'cash', name:'🎰 $80,000 JACKPOT!',         value:80000, rarity:'legendary',   weight:3,   icon:'cash',            description:'The fabricators bow to you!' },
                { id:'ch_chromoly_leg',          type:'item', name:'Legendary Chromoly Tube',      itemId:'chromoly_tube_legendary',  count:1,  rarity:'legendary',   weight:2,   icon:'chromoly_tube',   description:'FIA-spec chromoly cage kit.' },
                { id:'ch_carbon_panel_leg',      type:'item', name:'Legendary Carbon Panel ×2',    itemId:'carbon_panel_legendary',   count:2,  rarity:'legendary',   weight:2,   icon:'carbon_panel',    description:'Prepreg full-carbon body kit.' },
            ],
        },

        // ─ SPECIAL PACK ──────────────────────────────────────────────────────
        special_pack: {
            id:          'special_pack',
            name:        'Special Card Pack',
            description: 'Hydraulics, aero, launch control and exotic build items.',
            theme:       'purple',
            cardCount:   5,
            rewards: [
                // ─ COMMON ────────────────────────────────────────────────────
                { id:'sp_cash_300',              type:'cash', name:'$300 Cash',                    value:300,   rarity:'common',    weight:200, icon:'cash',            description:'Small payout.' },
                { id:'sp_cash_600',              type:'cash', name:'$600 Cash',                    value:600,   rarity:'common',    weight:160, icon:'cash',            description:'Workshop coverage.' },
                { id:'sp_scrap_x6',              type:'item', name:'Scrap Metal ×6',               itemId:'scrap_metal',              count:6,  rarity:'common',    weight:150, icon:'scrap_metal',     description:'Salvage for exotic builds.' },
                { id:'sp_alum_x4',               type:'item', name:'Aluminum Sheet ×4',            itemId:'aluminum_sheet',           count:4,  rarity:'common',    weight:140, icon:'aluminum_sheet',  description:'Electronic component base.' },
                { id:'sp_oil_x3',                type:'item', name:'Machine Oil ×3',               itemId:'machine_oil',              count:3,  rarity:'common',    weight:130, icon:'machine_oil',     description:'Hydraulic fluid base.' },
                { id:'sp_hyd_com',               type:'item', name:'Common Hydraulic Cylinder',    itemId:'hydraulic_cylinder_common',count:1,  rarity:'common',    weight:120, icon:'hydraulic_cylinder',description:'Standard hydraulic actuator.' },
                { id:'sp_bias_com',              type:'item', name:'Common Bias Valve',            itemId:'bias_valve_common',        count:1,  rarity:'common',    weight:115, icon:'bias_valve',      description:'Entry bias valve.' },
                { id:'sp_launch_com',            type:'item', name:'Common Launch Module',         itemId:'launch_module_common',     count:1,  rarity:'common',    weight:110, icon:'launch_module',   description:'Basic launch control.' },
                { id:'sp_rev_com',               type:'item', name:'Common Rev Limiter',           itemId:'rev_limiter_common',       count:1,  rarity:'common',    weight:105, icon:'rev_limiter',     description:'Two-step rev limiter.' },
                { id:'sp_lift_com',              type:'item', name:'Common Lift Spacer',           itemId:'lift_spacer_common',       count:1,  rarity:'common',    weight:100, icon:'lift_spacer',     description:'Body lift spacer.' },
                { id:'sp_exshock_com',           type:'item', name:'Common Extended Shock',        itemId:'extended_shock_common',    count:1,  rarity:'common',    weight:100, icon:'extended_shock',  description:'Long-travel shock.' },
                { id:'sp_wing_com',              type:'item', name:'Common Carbon Wing',           itemId:'carbon_wing_common',       count:1,  rarity:'common',    weight:95,  icon:'carbon_wing',     description:'Street aero wing.' },
                { id:'sp_act_com',               type:'item', name:'Common Actuator Motor',        itemId:'actuator_motor_common',    count:1,  rarity:'common',    weight:90,  icon:'actuator_motor',  description:'Wing servo motor.' },
                { id:'sp_tune_com',              type:'item', name:'Common Tune Kit',              itemId:'tune_kit_common',          count:1,  rarity:'common',    weight:90,  icon:'tune_kit',        description:'Street tune package.' },
                { id:'sp_spring_com',            type:'item', name:'Common Sport Spring',          itemId:'sport_spring_common',      count:1,  rarity:'common',    weight:85,  icon:'sport_spring',    description:'Lowering spring set.' },
                // ─ UNCOMMON ──────────────────────────────────────────────────
                { id:'sp_cash_2000',             type:'cash', name:'$2,000 Cash',                  value:2000,  rarity:'uncommon',  weight:110, icon:'cash',            description:'A nice bonus.' },
                { id:'sp_carbon_x2',             type:'item', name:'Carbon Fiber ×2',              itemId:'carbon_fiber',             count:2,  rarity:'uncommon',  weight:100, icon:'carbon_fiber',    description:'Aero fabrication material.' },
                { id:'sp_wing_unc',              type:'item', name:'Uncommon Carbon Wing',         itemId:'carbon_wing_uncommon',     count:1,  rarity:'uncommon',  weight:90,  icon:'carbon_wing',     description:'Track aero wing.' },
                { id:'sp_launch_unc',            type:'item', name:'Uncommon Launch Module',       itemId:'launch_module_uncommon',   count:1,  rarity:'uncommon',  weight:85,  icon:'launch_module',   description:'Improved launch control.' },
                { id:'sp_tune_unc',              type:'item', name:'Uncommon Tune Kit',            itemId:'tune_kit_uncommon',        count:1,  rarity:'uncommon',  weight:80,  icon:'tune_kit',        description:'Sport tune package.' },
                { id:'sp_hyd_unc',               type:'item', name:'Uncommon Hydraulic Cylinder',  itemId:'hydraulic_cylinder_uncommon',count:1,rarity:'uncommon',  weight:75,  icon:'hydraulic_cylinder',description:'High-pressure actuator.' },
                { id:'sp_act_unc',               type:'item', name:'Uncommon Actuator Motor',      itemId:'actuator_motor_uncommon',  count:1,  rarity:'uncommon',  weight:70,  icon:'actuator_motor',  description:'Precision servo motor.' },
                { id:'sp_pp_20',                 type:'pp',   name:'20 Premium Points',            value:20,    rarity:'uncommon',  weight:65,  icon:'premium_points',  description:'Premium currency.' },
                // ─ RARE ──────────────────────────────────────────────────────
                { id:'sp_cash_8000',             type:'cash', name:'$8,000 Cash',                  value:8000,  rarity:'rare',      weight:45,  icon:'cash',            description:'Serious coin.' },
                { id:'sp_carbon_x3',             type:'item', name:'Carbon Fiber ×3',              itemId:'carbon_fiber',             count:3,  rarity:'rare',        weight:40,  icon:'carbon_fiber',    description:'Premium aero material.' },
                { id:'sp_wing_rare',             type:'item', name:'Rare Carbon Wing',             itemId:'carbon_wing_rare',         count:1,  rarity:'rare',        weight:38,  icon:'carbon_wing',     description:'Race aero carbon wing.' },
                { id:'sp_launch_rare',           type:'item', name:'Rare Launch Module',           itemId:'launch_module_rare',       count:1,  rarity:'rare',        weight:35,  icon:'launch_module',   description:'Pro launch control.' },
                { id:'sp_tune_rare',             type:'item', name:'Rare Tune Kit',                itemId:'tune_kit_rare',            count:1,  rarity:'rare',        weight:33,  icon:'tune_kit',        description:'Stage 3 tune package.' },
                { id:'sp_bias_rare',             type:'item', name:'Rare Bias Valve',              itemId:'bias_valve_rare',          count:1,  rarity:'rare',        weight:30,  icon:'bias_valve',      description:'Adjustable proportioning valve.' },
                { id:'sp_pp_50',                 type:'pp',   name:'50 Premium Points',            value:50,    rarity:'rare',        weight:28,  icon:'premium_points',  description:'Premium boost.' },
                // ─ EPIC ──────────────────────────────────────────────────────
                { id:'sp_cash_25000',            type:'cash', name:'$25,000 Cash',                 value:25000, rarity:'epic',        weight:14,  icon:'cash',            description:'Exotic build budget.' },
                { id:'sp_wing_epic',             type:'item', name:'Epic Carbon Wing',             itemId:'carbon_wing_epic',         count:1,  rarity:'epic',        weight:11,  icon:'carbon_wing',     description:'Active aero carbon wing.' },
                { id:'sp_tune_epic',             type:'item', name:'Epic Tune Kit',                itemId:'tune_kit_epic',            count:1,  rarity:'epic',        weight:10,  icon:'tune_kit',        description:'Full competition tune.' },
                { id:'sp_launch_epic',           type:'item', name:'Epic Launch Module',           itemId:'launch_module_epic',       count:1,  rarity:'epic',        weight:9,   icon:'launch_module',   description:'Race launch control system.' },
                { id:'sp_pp_100',                type:'pp',   name:'100 Premium Points',           value:100,   rarity:'epic',        weight:8,   icon:'premium_points',  description:'Premium jackpot.' },
                // ─ LEGENDARY ─────────────────────────────────────────────────
                { id:'sp_jackpot',               type:'cash', name:'🎰 $80,000 JACKPOT!',         value:80000, rarity:'legendary',   weight:3,   icon:'cash',            description:'The special gods have spoken!' },
                { id:'sp_wing_leg',              type:'item', name:'Legendary Carbon Wing',        itemId:'carbon_wing_legendary',    count:1,  rarity:'legendary',   weight:2,   icon:'carbon_wing',     description:'Full active aero wing.' },
                { id:'sp_tune_leg',              type:'item', name:'Legendary Tune Kit',           itemId:'tune_kit_legendary',       count:1,  rarity:'legendary',   weight:2,   icon:'tune_kit',        description:'Factory racing tune package.' },
            ],
        },

    }, // end packs
};