const db = require('../core/database');
const playerManager = require('../core/playerManager');
const inventory = require('./inventory');
const ItemRegistry = require('../data/items');

// ─── CONFIGURATION ───
const WORKBENCHES = [
    { x: -227.67, y: -1327.65, z: 30.89, h: 95.12 },
    { x: -1146.72, y: -2002.67, z: 13.18, h: 48.86 },
    { x: 737.76, y: -1077.85, z: 22.17, h: -91.26 },
    { x: -345.39, y: -130.90, z: 39.01, h: 70.51 },
    { x: 1188.76, y: 2640.73, z: 38.40, h: -90.48 },
    { x: 101.16, y: 6616.53, z: 32.44, h: 140.58 }
];

const RECIPES = [

    // ── POWER COMPONENTS ──────────────────────────────────────────
    // Crankshaft
    {id:'crankshaft_common',resultId:'crankshaft_common',name:'Common Crankshaft',description:'Core rotating assembly of the engine.',rarity:'common',category:'power',inputs:[{itemId:'scrap_metal',count:4}, {itemId:'machine_oil',count:2}],cost:200,baseChance:90},

    {id:'crankshaft_uncommon',resultId:'crankshaft_uncommon',name:'Uncommon Crankshaft',description:'Core rotating assembly of the engine.',rarity:'uncommon',category:'power',inputs:[{itemId:'crankshaft_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'crankshaft_rare',resultId:'crankshaft_rare',name:'Rare Crankshaft',description:'Core rotating assembly of the engine.',rarity:'rare',category:'power',inputs:[{itemId:'crankshaft_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'crankshaft_epic',resultId:'crankshaft_epic',name:'Epic Crankshaft',description:'Core rotating assembly of the engine.',rarity:'epic',category:'power',inputs:[{itemId:'crankshaft_rare',count:3}],cost:8000,baseChance:45},

    {id:'crankshaft_legendary',resultId:'crankshaft_legendary',name:'Legendary Crankshaft',description:'Core rotating assembly of the engine.',rarity:'legendary',category:'power',inputs:[{itemId:'crankshaft_epic',count:2}],cost:25000,baseChance:30},

    // Piston
    {id:'piston_common',resultId:'piston_common',name:'Common Piston',description:'Converts combustion force to rotational motion.',rarity:'common',category:'power',inputs:[{itemId:'scrap_metal',count:3}],cost:200,baseChance:90},

    {id:'piston_uncommon',resultId:'piston_uncommon',name:'Uncommon Piston',description:'Converts combustion force to rotational motion.',rarity:'uncommon',category:'power',inputs:[{itemId:'piston_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'piston_rare',resultId:'piston_rare',name:'Rare Piston',description:'Converts combustion force to rotational motion.',rarity:'rare',category:'power',inputs:[{itemId:'piston_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'piston_epic',resultId:'piston_epic',name:'Epic Piston',description:'Converts combustion force to rotational motion.',rarity:'epic',category:'power',inputs:[{itemId:'piston_rare',count:3}],cost:8000,baseChance:45},

    {id:'piston_legendary',resultId:'piston_legendary',name:'Legendary Piston',description:'Converts combustion force to rotational motion.',rarity:'legendary',category:'power',inputs:[{itemId:'piston_epic',count:2}],cost:25000,baseChance:30},

    // Engine Block
    {id:'engine_block_common',resultId:'engine_block_common',name:'Common Engine Block',description:'Main structural component housing the cylinders.',rarity:'common',category:'power',inputs:[{itemId:'scrap_metal',count:6}, {itemId:'machine_oil',count:3}],cost:200,baseChance:90},

    {id:'engine_block_uncommon',resultId:'engine_block_uncommon',name:'Uncommon Engine Block',description:'Main structural component housing the cylinders.',rarity:'uncommon',category:'power',inputs:[{itemId:'engine_block_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'engine_block_rare',resultId:'engine_block_rare',name:'Rare Engine Block',description:'Main structural component housing the cylinders.',rarity:'rare',category:'power',inputs:[{itemId:'engine_block_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'engine_block_epic',resultId:'engine_block_epic',name:'Epic Engine Block',description:'Main structural component housing the cylinders.',rarity:'epic',category:'power',inputs:[{itemId:'engine_block_rare',count:3}],cost:8000,baseChance:45},

    {id:'engine_block_legendary',resultId:'engine_block_legendary',name:'Legendary Engine Block',description:'Main structural component housing the cylinders.',rarity:'legendary',category:'power',inputs:[{itemId:'engine_block_epic',count:2}],cost:25000,baseChance:30},

    // Turbo Manifold
    {id:'turbo_manifold_common',resultId:'turbo_manifold_common',name:'Common Turbo Manifold',description:'Channels exhaust gases into the turbocharger.',rarity:'common',category:'power',inputs:[{itemId:'scrap_metal',count:3}, {itemId:'machine_oil',count:2}],cost:200,baseChance:90},

    {id:'turbo_manifold_uncommon',resultId:'turbo_manifold_uncommon',name:'Uncommon Turbo Manifold',description:'Channels exhaust gases into the turbocharger.',rarity:'uncommon',category:'power',inputs:[{itemId:'turbo_manifold_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'turbo_manifold_rare',resultId:'turbo_manifold_rare',name:'Rare Turbo Manifold',description:'Channels exhaust gases into the turbocharger.',rarity:'rare',category:'power',inputs:[{itemId:'turbo_manifold_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'turbo_manifold_epic',resultId:'turbo_manifold_epic',name:'Epic Turbo Manifold',description:'Channels exhaust gases into the turbocharger.',rarity:'epic',category:'power',inputs:[{itemId:'turbo_manifold_rare',count:3}],cost:8000,baseChance:45},

    {id:'turbo_manifold_legendary',resultId:'turbo_manifold_legendary',name:'Legendary Turbo Manifold',description:'Channels exhaust gases into the turbocharger.',rarity:'legendary',category:'power',inputs:[{itemId:'turbo_manifold_epic',count:2}],cost:25000,baseChance:30},

    // Intercooler
    {id:'intercooler_common',resultId:'intercooler_common',name:'Common Intercooler',description:'Cools compressed intake air for a denser charge.',rarity:'common',category:'power',inputs:[{itemId:'aluminum_sheet',count:3}, {itemId:'machine_oil',count:1}],cost:200,baseChance:90},

    {id:'intercooler_uncommon',resultId:'intercooler_uncommon',name:'Uncommon Intercooler',description:'Cools compressed intake air for a denser charge.',rarity:'uncommon',category:'power',inputs:[{itemId:'intercooler_common',count:3},{itemId:'aluminum_sheet',count:1}],cost:800,baseChance:75},

    {id:'intercooler_rare',resultId:'intercooler_rare',name:'Rare Intercooler',description:'Cools compressed intake air for a denser charge.',rarity:'rare',category:'power',inputs:[{itemId:'intercooler_uncommon',count:3},{itemId:'aluminum_sheet',count:1}],cost:2500,baseChance:60},

    {id:'intercooler_epic',resultId:'intercooler_epic',name:'Epic Intercooler',description:'Cools compressed intake air for a denser charge.',rarity:'epic',category:'power',inputs:[{itemId:'intercooler_rare',count:3}],cost:8000,baseChance:45},

    {id:'intercooler_legendary',resultId:'intercooler_legendary',name:'Legendary Intercooler',description:'Cools compressed intake air for a denser charge.',rarity:'legendary',category:'power',inputs:[{itemId:'intercooler_epic',count:2}],cost:25000,baseChance:30},

    // Wastegate
    {id:'wastegate_common',resultId:'wastegate_common',name:'Common Wastegate',description:'Controls boost pressure by venting exhaust gases.',rarity:'common',category:'power',inputs:[{itemId:'scrap_metal',count:2}, {itemId:'machine_oil',count:1}],cost:200,baseChance:90},

    {id:'wastegate_uncommon',resultId:'wastegate_uncommon',name:'Uncommon Wastegate',description:'Controls boost pressure by venting exhaust gases.',rarity:'uncommon',category:'power',inputs:[{itemId:'wastegate_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'wastegate_rare',resultId:'wastegate_rare',name:'Rare Wastegate',description:'Controls boost pressure by venting exhaust gases.',rarity:'rare',category:'power',inputs:[{itemId:'wastegate_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'wastegate_epic',resultId:'wastegate_epic',name:'Epic Wastegate',description:'Controls boost pressure by venting exhaust gases.',rarity:'epic',category:'power',inputs:[{itemId:'wastegate_rare',count:3}],cost:8000,baseChance:45},

    {id:'wastegate_legendary',resultId:'wastegate_legendary',name:'Legendary Wastegate',description:'Controls boost pressure by venting exhaust gases.',rarity:'legendary',category:'power',inputs:[{itemId:'wastegate_epic',count:2}],cost:25000,baseChance:30},

    // ECU Chip
    {id:'ecu_chip_common',resultId:'ecu_chip_common',name:'Common ECU Chip',description:'Programmable engine control unit processor.',rarity:'common',category:'power',inputs:[{itemId:'aluminum_sheet',count:2}],cost:200,baseChance:90},

    {id:'ecu_chip_uncommon',resultId:'ecu_chip_uncommon',name:'Uncommon ECU Chip',description:'Programmable engine control unit processor.',rarity:'uncommon',category:'power',inputs:[{itemId:'ecu_chip_common',count:3},{itemId:'aluminum_sheet',count:1}],cost:800,baseChance:75},

    {id:'ecu_chip_rare',resultId:'ecu_chip_rare',name:'Rare ECU Chip',description:'Programmable engine control unit processor.',rarity:'rare',category:'power',inputs:[{itemId:'ecu_chip_uncommon',count:3},{itemId:'aluminum_sheet',count:1}],cost:2500,baseChance:60},

    {id:'ecu_chip_epic',resultId:'ecu_chip_epic',name:'Epic ECU Chip',description:'Programmable engine control unit processor.',rarity:'epic',category:'power',inputs:[{itemId:'ecu_chip_rare',count:3}],cost:8000,baseChance:45},

    {id:'ecu_chip_legendary',resultId:'ecu_chip_legendary',name:'Legendary ECU Chip',description:'Programmable engine control unit processor.',rarity:'legendary',category:'power',inputs:[{itemId:'ecu_chip_epic',count:2}],cost:25000,baseChance:30},

    // Fuel Injector
    {id:'fuel_injector_common',resultId:'fuel_injector_common',name:'Common Fuel Injector',description:'Precision fuel delivery nozzle.',rarity:'common',category:'power',inputs:[{itemId:'aluminum_sheet',count:2}, {itemId:'machine_oil',count:1}],cost:200,baseChance:90},

    {id:'fuel_injector_uncommon',resultId:'fuel_injector_uncommon',name:'Uncommon Fuel Injector',description:'Precision fuel delivery nozzle.',rarity:'uncommon',category:'power',inputs:[{itemId:'fuel_injector_common',count:3},{itemId:'aluminum_sheet',count:1}],cost:800,baseChance:75},

    {id:'fuel_injector_rare',resultId:'fuel_injector_rare',name:'Rare Fuel Injector',description:'Precision fuel delivery nozzle.',rarity:'rare',category:'power',inputs:[{itemId:'fuel_injector_uncommon',count:3},{itemId:'aluminum_sheet',count:1}],cost:2500,baseChance:60},

    {id:'fuel_injector_epic',resultId:'fuel_injector_epic',name:'Epic Fuel Injector',description:'Precision fuel delivery nozzle.',rarity:'epic',category:'power',inputs:[{itemId:'fuel_injector_rare',count:3}],cost:8000,baseChance:45},

    {id:'fuel_injector_legendary',resultId:'fuel_injector_legendary',name:'Legendary Fuel Injector',description:'Precision fuel delivery nozzle.',rarity:'legendary',category:'power',inputs:[{itemId:'fuel_injector_epic',count:2}],cost:25000,baseChance:30},

    // Exhaust Header
    {id:'exhaust_header_common',resultId:'exhaust_header_common',name:'Common Exhaust Header',description:'Merges exhaust ports for optimal scavenging.',rarity:'common',category:'power',inputs:[{itemId:'scrap_metal',count:3}, {itemId:'aluminum_sheet',count:1}],cost:200,baseChance:90},

    {id:'exhaust_header_uncommon',resultId:'exhaust_header_uncommon',name:'Uncommon Exhaust Header',description:'Merges exhaust ports for optimal scavenging.',rarity:'uncommon',category:'power',inputs:[{itemId:'exhaust_header_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'exhaust_header_rare',resultId:'exhaust_header_rare',name:'Rare Exhaust Header',description:'Merges exhaust ports for optimal scavenging.',rarity:'rare',category:'power',inputs:[{itemId:'exhaust_header_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'exhaust_header_epic',resultId:'exhaust_header_epic',name:'Epic Exhaust Header',description:'Merges exhaust ports for optimal scavenging.',rarity:'epic',category:'power',inputs:[{itemId:'exhaust_header_rare',count:3}],cost:8000,baseChance:45},

    {id:'exhaust_header_legendary',resultId:'exhaust_header_legendary',name:'Legendary Exhaust Header',description:'Merges exhaust ports for optimal scavenging.',rarity:'legendary',category:'power',inputs:[{itemId:'exhaust_header_epic',count:2}],cost:25000,baseChance:30},

    // Exhaust Manifold
    {id:'exhaust_manifold_common',resultId:'exhaust_manifold_common',name:'Common Exhaust Manifold',description:'Collects exhaust from all cylinders into one outlet.',rarity:'common',category:'power',inputs:[{itemId:'scrap_metal',count:4}],cost:200,baseChance:90},

    {id:'exhaust_manifold_uncommon',resultId:'exhaust_manifold_uncommon',name:'Uncommon Exhaust Manifold',description:'Collects exhaust from all cylinders into one outlet.',rarity:'uncommon',category:'power',inputs:[{itemId:'exhaust_manifold_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'exhaust_manifold_rare',resultId:'exhaust_manifold_rare',name:'Rare Exhaust Manifold',description:'Collects exhaust from all cylinders into one outlet.',rarity:'rare',category:'power',inputs:[{itemId:'exhaust_manifold_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'exhaust_manifold_epic',resultId:'exhaust_manifold_epic',name:'Epic Exhaust Manifold',description:'Collects exhaust from all cylinders into one outlet.',rarity:'epic',category:'power',inputs:[{itemId:'exhaust_manifold_rare',count:3}],cost:8000,baseChance:45},

    {id:'exhaust_manifold_legendary',resultId:'exhaust_manifold_legendary',name:'Legendary Exhaust Manifold',description:'Collects exhaust from all cylinders into one outlet.',rarity:'legendary',category:'power',inputs:[{itemId:'exhaust_manifold_epic',count:2}],cost:25000,baseChance:30},


    // ── DRIVETRAIN COMPONENTS ──────────────────────────────────────────
    // Gear Set
    {id:'gear_set_common',resultId:'gear_set_common',name:'Common Gear Set',description:'Close-ratio gear pairs for optimised power delivery.',rarity:'common',category:'drivetrain',inputs:[{itemId:'scrap_metal',count:4}, {itemId:'machine_oil',count:2}],cost:200,baseChance:90},

    {id:'gear_set_uncommon',resultId:'gear_set_uncommon',name:'Uncommon Gear Set',description:'Close-ratio gear pairs for optimised power delivery.',rarity:'uncommon',category:'drivetrain',inputs:[{itemId:'gear_set_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'gear_set_rare',resultId:'gear_set_rare',name:'Rare Gear Set',description:'Close-ratio gear pairs for optimised power delivery.',rarity:'rare',category:'drivetrain',inputs:[{itemId:'gear_set_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'gear_set_epic',resultId:'gear_set_epic',name:'Epic Gear Set',description:'Close-ratio gear pairs for optimised power delivery.',rarity:'epic',category:'drivetrain',inputs:[{itemId:'gear_set_rare',count:3}],cost:8000,baseChance:45},

    {id:'gear_set_legendary',resultId:'gear_set_legendary',name:'Legendary Gear Set',description:'Close-ratio gear pairs for optimised power delivery.',rarity:'legendary',category:'drivetrain',inputs:[{itemId:'gear_set_epic',count:2}],cost:25000,baseChance:30},

    // Clutch Kit
    {id:'clutch_kit_common',resultId:'clutch_kit_common',name:'Common Clutch Kit',description:'Friction disc and pressure plate assembly.',rarity:'common',category:'drivetrain',inputs:[{itemId:'rubber_compound',count:3}, {itemId:'scrap_metal',count:1}],cost:200,baseChance:90},

    {id:'clutch_kit_uncommon',resultId:'clutch_kit_uncommon',name:'Uncommon Clutch Kit',description:'Friction disc and pressure plate assembly.',rarity:'uncommon',category:'drivetrain',inputs:[{itemId:'clutch_kit_common',count:3},{itemId:'rubber_compound',count:1}],cost:800,baseChance:75},

    {id:'clutch_kit_rare',resultId:'clutch_kit_rare',name:'Rare Clutch Kit',description:'Friction disc and pressure plate assembly.',rarity:'rare',category:'drivetrain',inputs:[{itemId:'clutch_kit_uncommon',count:3},{itemId:'rubber_compound',count:1}],cost:2500,baseChance:60},

    {id:'clutch_kit_epic',resultId:'clutch_kit_epic',name:'Epic Clutch Kit',description:'Friction disc and pressure plate assembly.',rarity:'epic',category:'drivetrain',inputs:[{itemId:'clutch_kit_rare',count:3}],cost:8000,baseChance:45},

    {id:'clutch_kit_legendary',resultId:'clutch_kit_legendary',name:'Legendary Clutch Kit',description:'Friction disc and pressure plate assembly.',rarity:'legendary',category:'drivetrain',inputs:[{itemId:'clutch_kit_epic',count:2}],cost:25000,baseChance:30},

    // LSD Pack
    {id:'lsd_pack_common',resultId:'lsd_pack_common',name:'Common LSD Pack',description:'Limited slip differential clutch pack.',rarity:'common',category:'drivetrain',inputs:[{itemId:'scrap_metal',count:3}, {itemId:'machine_oil',count:2}],cost:200,baseChance:90},

    {id:'lsd_pack_uncommon',resultId:'lsd_pack_uncommon',name:'Uncommon LSD Pack',description:'Limited slip differential clutch pack.',rarity:'uncommon',category:'drivetrain',inputs:[{itemId:'lsd_pack_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'lsd_pack_rare',resultId:'lsd_pack_rare',name:'Rare LSD Pack',description:'Limited slip differential clutch pack.',rarity:'rare',category:'drivetrain',inputs:[{itemId:'lsd_pack_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'lsd_pack_epic',resultId:'lsd_pack_epic',name:'Epic LSD Pack',description:'Limited slip differential clutch pack.',rarity:'epic',category:'drivetrain',inputs:[{itemId:'lsd_pack_rare',count:3}],cost:8000,baseChance:45},

    {id:'lsd_pack_legendary',resultId:'lsd_pack_legendary',name:'Legendary LSD Pack',description:'Limited slip differential clutch pack.',rarity:'legendary',category:'drivetrain',inputs:[{itemId:'lsd_pack_epic',count:2}],cost:25000,baseChance:30},

    // Ring & Pinion
    {id:'ring_pinion_common',resultId:'ring_pinion_common',name:'Common Ring & Pinion',description:'Final drive gear set controlling axle ratio.',rarity:'common',category:'drivetrain',inputs:[{itemId:'scrap_metal',count:4}, {itemId:'machine_oil',count:1}],cost:200,baseChance:90},

    {id:'ring_pinion_uncommon',resultId:'ring_pinion_uncommon',name:'Uncommon Ring & Pinion',description:'Final drive gear set controlling axle ratio.',rarity:'uncommon',category:'drivetrain',inputs:[{itemId:'ring_pinion_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'ring_pinion_rare',resultId:'ring_pinion_rare',name:'Rare Ring & Pinion',description:'Final drive gear set controlling axle ratio.',rarity:'rare',category:'drivetrain',inputs:[{itemId:'ring_pinion_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'ring_pinion_epic',resultId:'ring_pinion_epic',name:'Epic Ring & Pinion',description:'Final drive gear set controlling axle ratio.',rarity:'epic',category:'drivetrain',inputs:[{itemId:'ring_pinion_rare',count:3}],cost:8000,baseChance:45},

    {id:'ring_pinion_legendary',resultId:'ring_pinion_legendary',name:'Legendary Ring & Pinion',description:'Final drive gear set controlling axle ratio.',rarity:'legendary',category:'drivetrain',inputs:[{itemId:'ring_pinion_epic',count:2}],cost:25000,baseChance:30},


    // ── HANDLING COMPONENTS ──────────────────────────────────────────
    // Brake Rotor
    {id:'brake_rotor_common',resultId:'brake_rotor_common',name:'Common Brake Rotor',description:'Vented disc that absorbs braking heat.',rarity:'common',category:'handling',inputs:[{itemId:'scrap_metal',count:3}],cost:200,baseChance:90},

    {id:'brake_rotor_uncommon',resultId:'brake_rotor_uncommon',name:'Uncommon Brake Rotor',description:'Vented disc that absorbs braking heat.',rarity:'uncommon',category:'handling',inputs:[{itemId:'brake_rotor_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'brake_rotor_rare',resultId:'brake_rotor_rare',name:'Rare Brake Rotor',description:'Vented disc that absorbs braking heat.',rarity:'rare',category:'handling',inputs:[{itemId:'brake_rotor_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'brake_rotor_epic',resultId:'brake_rotor_epic',name:'Epic Brake Rotor',description:'Vented disc that absorbs braking heat.',rarity:'epic',category:'handling',inputs:[{itemId:'brake_rotor_rare',count:3}],cost:8000,baseChance:45},

    {id:'brake_rotor_legendary',resultId:'brake_rotor_legendary',name:'Legendary Brake Rotor',description:'Vented disc that absorbs braking heat.',rarity:'legendary',category:'handling',inputs:[{itemId:'brake_rotor_epic',count:2}],cost:25000,baseChance:30},

    // Brake Caliper
    {id:'brake_caliper_common',resultId:'brake_caliper_common',name:'Common Brake Caliper',description:'Hydraulic clamp that squeezes the rotor.',rarity:'common',category:'handling',inputs:[{itemId:'scrap_metal',count:2}, {itemId:'aluminum_sheet',count:1}],cost:200,baseChance:90},

    {id:'brake_caliper_uncommon',resultId:'brake_caliper_uncommon',name:'Uncommon Brake Caliper',description:'Hydraulic clamp that squeezes the rotor.',rarity:'uncommon',category:'handling',inputs:[{itemId:'brake_caliper_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'brake_caliper_rare',resultId:'brake_caliper_rare',name:'Rare Brake Caliper',description:'Hydraulic clamp that squeezes the rotor.',rarity:'rare',category:'handling',inputs:[{itemId:'brake_caliper_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'brake_caliper_epic',resultId:'brake_caliper_epic',name:'Epic Brake Caliper',description:'Hydraulic clamp that squeezes the rotor.',rarity:'epic',category:'handling',inputs:[{itemId:'brake_caliper_rare',count:3}],cost:8000,baseChance:45},

    {id:'brake_caliper_legendary',resultId:'brake_caliper_legendary',name:'Legendary Brake Caliper',description:'Hydraulic clamp that squeezes the rotor.',rarity:'legendary',category:'handling',inputs:[{itemId:'brake_caliper_epic',count:2}],cost:25000,baseChance:30},

    // Brake Pad
    {id:'brake_pad_common',resultId:'brake_pad_common',name:'Common Brake Pad',description:'High-friction compound for bite and fade resistance.',rarity:'common',category:'handling',inputs:[{itemId:'rubber_compound',count:2}],cost:200,baseChance:90},

    {id:'brake_pad_uncommon',resultId:'brake_pad_uncommon',name:'Uncommon Brake Pad',description:'High-friction compound for bite and fade resistance.',rarity:'uncommon',category:'handling',inputs:[{itemId:'brake_pad_common',count:3},{itemId:'rubber_compound',count:1}],cost:800,baseChance:75},

    {id:'brake_pad_rare',resultId:'brake_pad_rare',name:'Rare Brake Pad',description:'High-friction compound for bite and fade resistance.',rarity:'rare',category:'handling',inputs:[{itemId:'brake_pad_uncommon',count:3},{itemId:'rubber_compound',count:1}],cost:2500,baseChance:60},

    {id:'brake_pad_epic',resultId:'brake_pad_epic',name:'Epic Brake Pad',description:'High-friction compound for bite and fade resistance.',rarity:'epic',category:'handling',inputs:[{itemId:'brake_pad_rare',count:3}],cost:8000,baseChance:45},

    {id:'brake_pad_legendary',resultId:'brake_pad_legendary',name:'Legendary Brake Pad',description:'High-friction compound for bite and fade resistance.',rarity:'legendary',category:'handling',inputs:[{itemId:'brake_pad_epic',count:2}],cost:25000,baseChance:30},

    // Coilover Spring
    {id:'coilover_spring_common',resultId:'coilover_spring_common',name:'Common Coilover Spring',description:'Rate-specific spring for ride height tuning.',rarity:'common',category:'handling',inputs:[{itemId:'scrap_metal',count:3}, {itemId:'machine_oil',count:1}],cost:200,baseChance:90},

    {id:'coilover_spring_uncommon',resultId:'coilover_spring_uncommon',name:'Uncommon Coilover Spring',description:'Rate-specific spring for ride height tuning.',rarity:'uncommon',category:'handling',inputs:[{itemId:'coilover_spring_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'coilover_spring_rare',resultId:'coilover_spring_rare',name:'Rare Coilover Spring',description:'Rate-specific spring for ride height tuning.',rarity:'rare',category:'handling',inputs:[{itemId:'coilover_spring_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'coilover_spring_epic',resultId:'coilover_spring_epic',name:'Epic Coilover Spring',description:'Rate-specific spring for ride height tuning.',rarity:'epic',category:'handling',inputs:[{itemId:'coilover_spring_rare',count:3}],cost:8000,baseChance:45},

    {id:'coilover_spring_legendary',resultId:'coilover_spring_legendary',name:'Legendary Coilover Spring',description:'Rate-specific spring for ride height tuning.',rarity:'legendary',category:'handling',inputs:[{itemId:'coilover_spring_epic',count:2}],cost:25000,baseChance:30},

    // Shock Absorber
    {id:'shock_absorber_common',resultId:'shock_absorber_common',name:'Common Shock Absorber',description:'Damper controlling suspension compression and rebound.',rarity:'common',category:'handling',inputs:[{itemId:'scrap_metal',count:2}, {itemId:'machine_oil',count:2}],cost:200,baseChance:90},

    {id:'shock_absorber_uncommon',resultId:'shock_absorber_uncommon',name:'Uncommon Shock Absorber',description:'Damper controlling suspension compression and rebound.',rarity:'uncommon',category:'handling',inputs:[{itemId:'shock_absorber_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'shock_absorber_rare',resultId:'shock_absorber_rare',name:'Rare Shock Absorber',description:'Damper controlling suspension compression and rebound.',rarity:'rare',category:'handling',inputs:[{itemId:'shock_absorber_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'shock_absorber_epic',resultId:'shock_absorber_epic',name:'Epic Shock Absorber',description:'Damper controlling suspension compression and rebound.',rarity:'epic',category:'handling',inputs:[{itemId:'shock_absorber_rare',count:3}],cost:8000,baseChance:45},

    {id:'shock_absorber_legendary',resultId:'shock_absorber_legendary',name:'Legendary Shock Absorber',description:'Damper controlling suspension compression and rebound.',rarity:'legendary',category:'handling',inputs:[{itemId:'shock_absorber_epic',count:2}],cost:25000,baseChance:30},

    // Sway Bar
    {id:'sway_bar_common',resultId:'sway_bar_common',name:'Common Sway Bar',description:'Anti-roll bar connecting left and right suspension.',rarity:'common',category:'handling',inputs:[{itemId:'scrap_metal',count:3}],cost:200,baseChance:90},

    {id:'sway_bar_uncommon',resultId:'sway_bar_uncommon',name:'Uncommon Sway Bar',description:'Anti-roll bar connecting left and right suspension.',rarity:'uncommon',category:'handling',inputs:[{itemId:'sway_bar_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'sway_bar_rare',resultId:'sway_bar_rare',name:'Rare Sway Bar',description:'Anti-roll bar connecting left and right suspension.',rarity:'rare',category:'handling',inputs:[{itemId:'sway_bar_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'sway_bar_epic',resultId:'sway_bar_epic',name:'Epic Sway Bar',description:'Anti-roll bar connecting left and right suspension.',rarity:'epic',category:'handling',inputs:[{itemId:'sway_bar_rare',count:3}],cost:8000,baseChance:45},

    {id:'sway_bar_legendary',resultId:'sway_bar_legendary',name:'Legendary Sway Bar',description:'Anti-roll bar connecting left and right suspension.',rarity:'legendary',category:'handling',inputs:[{itemId:'sway_bar_epic',count:2}],cost:25000,baseChance:30},

    // Tire Compound
    {id:'tire_compound_common',resultId:'tire_compound_common',name:'Common Tire Compound',description:'Rubber formulation determining grip and wear characteristics.',rarity:'common',category:'handling',inputs:[{itemId:'rubber_compound',count:4}],cost:200,baseChance:90},

    {id:'tire_compound_uncommon',resultId:'tire_compound_uncommon',name:'Uncommon Tire Compound',description:'Rubber formulation determining grip and wear characteristics.',rarity:'uncommon',category:'handling',inputs:[{itemId:'tire_compound_common',count:3},{itemId:'rubber_compound',count:1}],cost:800,baseChance:75},

    {id:'tire_compound_rare',resultId:'tire_compound_rare',name:'Rare Tire Compound',description:'Rubber formulation determining grip and wear characteristics.',rarity:'rare',category:'handling',inputs:[{itemId:'tire_compound_uncommon',count:3},{itemId:'rubber_compound',count:1}],cost:2500,baseChance:60},

    {id:'tire_compound_epic',resultId:'tire_compound_epic',name:'Epic Tire Compound',description:'Rubber formulation determining grip and wear characteristics.',rarity:'epic',category:'handling',inputs:[{itemId:'tire_compound_rare',count:3}],cost:8000,baseChance:45},

    {id:'tire_compound_legendary',resultId:'tire_compound_legendary',name:'Legendary Tire Compound',description:'Rubber formulation determining grip and wear characteristics.',rarity:'legendary',category:'handling',inputs:[{itemId:'tire_compound_epic',count:2}],cost:25000,baseChance:30},

    // Wheel Bearing
    {id:'wheel_bearing_common',resultId:'wheel_bearing_common',name:'Common Wheel Bearing',description:'Low-friction bearing assembly for smooth wheel rotation.',rarity:'common',category:'handling',inputs:[{itemId:'scrap_metal',count:2}, {itemId:'machine_oil',count:1}],cost:200,baseChance:90},

    {id:'wheel_bearing_uncommon',resultId:'wheel_bearing_uncommon',name:'Uncommon Wheel Bearing',description:'Low-friction bearing assembly for smooth wheel rotation.',rarity:'uncommon',category:'handling',inputs:[{itemId:'wheel_bearing_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'wheel_bearing_rare',resultId:'wheel_bearing_rare',name:'Rare Wheel Bearing',description:'Low-friction bearing assembly for smooth wheel rotation.',rarity:'rare',category:'handling',inputs:[{itemId:'wheel_bearing_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'wheel_bearing_epic',resultId:'wheel_bearing_epic',name:'Epic Wheel Bearing',description:'Low-friction bearing assembly for smooth wheel rotation.',rarity:'epic',category:'handling',inputs:[{itemId:'wheel_bearing_rare',count:3}],cost:8000,baseChance:45},

    {id:'wheel_bearing_legendary',resultId:'wheel_bearing_legendary',name:'Legendary Wheel Bearing',description:'Low-friction bearing assembly for smooth wheel rotation.',rarity:'legendary',category:'handling',inputs:[{itemId:'wheel_bearing_epic',count:2}],cost:25000,baseChance:30},


    // ── CHASSIS COMPONENTS ──────────────────────────────────────────
    // Chromoly Tube
    {id:'chromoly_tube_common',resultId:'chromoly_tube_common',name:'Common Chromoly Tube',description:'High-strength chromoly steel tubing for cage construction.',rarity:'common',category:'chassis',inputs:[{itemId:'scrap_metal',count:5}, {itemId:'carbon_fiber',count:1}],cost:200,baseChance:90},

    {id:'chromoly_tube_uncommon',resultId:'chromoly_tube_uncommon',name:'Uncommon Chromoly Tube',description:'High-strength chromoly steel tubing for cage construction.',rarity:'uncommon',category:'chassis',inputs:[{itemId:'chromoly_tube_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'chromoly_tube_rare',resultId:'chromoly_tube_rare',name:'Rare Chromoly Tube',description:'High-strength chromoly steel tubing for cage construction.',rarity:'rare',category:'chassis',inputs:[{itemId:'chromoly_tube_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'chromoly_tube_epic',resultId:'chromoly_tube_epic',name:'Epic Chromoly Tube',description:'High-strength chromoly steel tubing for cage construction.',rarity:'epic',category:'chassis',inputs:[{itemId:'chromoly_tube_rare',count:3}],cost:8000,baseChance:45},

    {id:'chromoly_tube_legendary',resultId:'chromoly_tube_legendary',name:'Legendary Chromoly Tube',description:'High-strength chromoly steel tubing for cage construction.',rarity:'legendary',category:'chassis',inputs:[{itemId:'chromoly_tube_epic',count:2}],cost:25000,baseChance:30},

    // Gusset Plate
    {id:'gusset_plate_common',resultId:'gusset_plate_common',name:'Common Gusset Plate',description:'Reinforcement plate for cage joint strength.',rarity:'common',category:'chassis',inputs:[{itemId:'scrap_metal',count:3}],cost:200,baseChance:90},

    {id:'gusset_plate_uncommon',resultId:'gusset_plate_uncommon',name:'Uncommon Gusset Plate',description:'Reinforcement plate for cage joint strength.',rarity:'uncommon',category:'chassis',inputs:[{itemId:'gusset_plate_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'gusset_plate_rare',resultId:'gusset_plate_rare',name:'Rare Gusset Plate',description:'Reinforcement plate for cage joint strength.',rarity:'rare',category:'chassis',inputs:[{itemId:'gusset_plate_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'gusset_plate_epic',resultId:'gusset_plate_epic',name:'Epic Gusset Plate',description:'Reinforcement plate for cage joint strength.',rarity:'epic',category:'chassis',inputs:[{itemId:'gusset_plate_rare',count:3}],cost:8000,baseChance:45},

    {id:'gusset_plate_legendary',resultId:'gusset_plate_legendary',name:'Legendary Gusset Plate',description:'Reinforcement plate for cage joint strength.',rarity:'legendary',category:'chassis',inputs:[{itemId:'gusset_plate_epic',count:2}],cost:25000,baseChance:30},

    // Carbon Panel
    {id:'carbon_panel_common',resultId:'carbon_panel_common',name:'Common Carbon Panel',description:'Carbon fibre replacement panel, drastically lighter than steel.',rarity:'common',category:'chassis',inputs:[{itemId:'carbon_fiber',count:2}, {itemId:'aluminum_sheet',count:2}],cost:200,baseChance:90},

    {id:'carbon_panel_uncommon',resultId:'carbon_panel_uncommon',name:'Uncommon Carbon Panel',description:'Carbon fibre replacement panel, drastically lighter than steel.',rarity:'uncommon',category:'chassis',inputs:[{itemId:'carbon_panel_common',count:3},{itemId:'carbon_fiber',count:1}],cost:800,baseChance:75},

    {id:'carbon_panel_rare',resultId:'carbon_panel_rare',name:'Rare Carbon Panel',description:'Carbon fibre replacement panel, drastically lighter than steel.',rarity:'rare',category:'chassis',inputs:[{itemId:'carbon_panel_uncommon',count:3},{itemId:'carbon_fiber',count:1}],cost:2500,baseChance:60},

    {id:'carbon_panel_epic',resultId:'carbon_panel_epic',name:'Epic Carbon Panel',description:'Carbon fibre replacement panel, drastically lighter than steel.',rarity:'epic',category:'chassis',inputs:[{itemId:'carbon_panel_rare',count:3}],cost:8000,baseChance:45},

    {id:'carbon_panel_legendary',resultId:'carbon_panel_legendary',name:'Legendary Carbon Panel',description:'Carbon fibre replacement panel, drastically lighter than steel.',rarity:'legendary',category:'chassis',inputs:[{itemId:'carbon_panel_epic',count:2}],cost:25000,baseChance:30},

    // Aluminum Hardware
    {id:'aluminum_hardware_common',resultId:'aluminum_hardware_common',name:'Common Aluminum Hardware',description:'Lightweight fasteners, brackets and mounts.',rarity:'common',category:'chassis',inputs:[{itemId:'aluminum_sheet',count:3}],cost:200,baseChance:90},

    {id:'aluminum_hardware_uncommon',resultId:'aluminum_hardware_uncommon',name:'Uncommon Aluminum Hardware',description:'Lightweight fasteners, brackets and mounts.',rarity:'uncommon',category:'chassis',inputs:[{itemId:'aluminum_hardware_common',count:3},{itemId:'aluminum_sheet',count:1}],cost:800,baseChance:75},

    {id:'aluminum_hardware_rare',resultId:'aluminum_hardware_rare',name:'Rare Aluminum Hardware',description:'Lightweight fasteners, brackets and mounts.',rarity:'rare',category:'chassis',inputs:[{itemId:'aluminum_hardware_uncommon',count:3},{itemId:'aluminum_sheet',count:1}],cost:2500,baseChance:60},

    {id:'aluminum_hardware_epic',resultId:'aluminum_hardware_epic',name:'Epic Aluminum Hardware',description:'Lightweight fasteners, brackets and mounts.',rarity:'epic',category:'chassis',inputs:[{itemId:'aluminum_hardware_rare',count:3}],cost:8000,baseChance:45},

    {id:'aluminum_hardware_legendary',resultId:'aluminum_hardware_legendary',name:'Legendary Aluminum Hardware',description:'Lightweight fasteners, brackets and mounts.',rarity:'legendary',category:'chassis',inputs:[{itemId:'aluminum_hardware_epic',count:2}],cost:25000,baseChance:30},


    // ── SPECIAL COMPONENTS ──────────────────────────────────────────
    // Hydraulic Cylinder
    {id:'hydraulic_cylinder_common',resultId:'hydraulic_cylinder_common',name:'Common Hydraulic Cylinder',description:'Hydraulic actuator for the handbrake circuit.',rarity:'common',category:'special',inputs:[{itemId:'scrap_metal',count:2}, {itemId:'machine_oil',count:2}],cost:200,baseChance:90},

    {id:'hydraulic_cylinder_uncommon',resultId:'hydraulic_cylinder_uncommon',name:'Uncommon Hydraulic Cylinder',description:'Hydraulic actuator for the handbrake circuit.',rarity:'uncommon',category:'special',inputs:[{itemId:'hydraulic_cylinder_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'hydraulic_cylinder_rare',resultId:'hydraulic_cylinder_rare',name:'Rare Hydraulic Cylinder',description:'Hydraulic actuator for the handbrake circuit.',rarity:'rare',category:'special',inputs:[{itemId:'hydraulic_cylinder_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'hydraulic_cylinder_epic',resultId:'hydraulic_cylinder_epic',name:'Epic Hydraulic Cylinder',description:'Hydraulic actuator for the handbrake circuit.',rarity:'epic',category:'special',inputs:[{itemId:'hydraulic_cylinder_rare',count:3}],cost:8000,baseChance:45},

    {id:'hydraulic_cylinder_legendary',resultId:'hydraulic_cylinder_legendary',name:'Legendary Hydraulic Cylinder',description:'Hydraulic actuator for the handbrake circuit.',rarity:'legendary',category:'special',inputs:[{itemId:'hydraulic_cylinder_epic',count:2}],cost:25000,baseChance:30},

    // Bias Valve
    {id:'bias_valve_common',resultId:'bias_valve_common',name:'Common Bias Valve',description:'Adjustable proportioning valve for rear brake bias.',rarity:'common',category:'special',inputs:[{itemId:'aluminum_sheet',count:2}, {itemId:'machine_oil',count:1}],cost:200,baseChance:90},

    {id:'bias_valve_uncommon',resultId:'bias_valve_uncommon',name:'Uncommon Bias Valve',description:'Adjustable proportioning valve for rear brake bias.',rarity:'uncommon',category:'special',inputs:[{itemId:'bias_valve_common',count:3},{itemId:'aluminum_sheet',count:1}],cost:800,baseChance:75},

    {id:'bias_valve_rare',resultId:'bias_valve_rare',name:'Rare Bias Valve',description:'Adjustable proportioning valve for rear brake bias.',rarity:'rare',category:'special',inputs:[{itemId:'bias_valve_uncommon',count:3},{itemId:'aluminum_sheet',count:1}],cost:2500,baseChance:60},

    {id:'bias_valve_epic',resultId:'bias_valve_epic',name:'Epic Bias Valve',description:'Adjustable proportioning valve for rear brake bias.',rarity:'epic',category:'special',inputs:[{itemId:'bias_valve_rare',count:3}],cost:8000,baseChance:45},

    {id:'bias_valve_legendary',resultId:'bias_valve_legendary',name:'Legendary Bias Valve',description:'Adjustable proportioning valve for rear brake bias.',rarity:'legendary',category:'special',inputs:[{itemId:'bias_valve_epic',count:2}],cost:25000,baseChance:30},

    // Launch Module
    {id:'launch_module_common',resultId:'launch_module_common',name:'Common Launch Module',description:'Electronic module managing RPM hold and boost build.',rarity:'common',category:'special',inputs:[{itemId:'aluminum_sheet',count:2}, {itemId:'machine_oil',count:1}],cost:200,baseChance:90},

    {id:'launch_module_uncommon',resultId:'launch_module_uncommon',name:'Uncommon Launch Module',description:'Electronic module managing RPM hold and boost build.',rarity:'uncommon',category:'special',inputs:[{itemId:'launch_module_common',count:3},{itemId:'aluminum_sheet',count:1}],cost:800,baseChance:75},

    {id:'launch_module_rare',resultId:'launch_module_rare',name:'Rare Launch Module',description:'Electronic module managing RPM hold and boost build.',rarity:'rare',category:'special',inputs:[{itemId:'launch_module_uncommon',count:3},{itemId:'aluminum_sheet',count:1}],cost:2500,baseChance:60},

    {id:'launch_module_epic',resultId:'launch_module_epic',name:'Epic Launch Module',description:'Electronic module managing RPM hold and boost build.',rarity:'epic',category:'special',inputs:[{itemId:'launch_module_rare',count:3}],cost:8000,baseChance:45},

    {id:'launch_module_legendary',resultId:'launch_module_legendary',name:'Legendary Launch Module',description:'Electronic module managing RPM hold and boost build.',rarity:'legendary',category:'special',inputs:[{itemId:'launch_module_epic',count:2}],cost:25000,baseChance:30},

    // Rev Limiter
    {id:'rev_limiter_common',resultId:'rev_limiter_common',name:'Common Rev Limiter',description:'Programmable two-step rev limiter chip.',rarity:'common',category:'special',inputs:[{itemId:'aluminum_sheet',count:2}],cost:200,baseChance:90},

    {id:'rev_limiter_uncommon',resultId:'rev_limiter_uncommon',name:'Uncommon Rev Limiter',description:'Programmable two-step rev limiter chip.',rarity:'uncommon',category:'special',inputs:[{itemId:'rev_limiter_common',count:3},{itemId:'aluminum_sheet',count:1}],cost:800,baseChance:75},

    {id:'rev_limiter_rare',resultId:'rev_limiter_rare',name:'Rare Rev Limiter',description:'Programmable two-step rev limiter chip.',rarity:'rare',category:'special',inputs:[{itemId:'rev_limiter_uncommon',count:3},{itemId:'aluminum_sheet',count:1}],cost:2500,baseChance:60},

    {id:'rev_limiter_epic',resultId:'rev_limiter_epic',name:'Epic Rev Limiter',description:'Programmable two-step rev limiter chip.',rarity:'epic',category:'special',inputs:[{itemId:'rev_limiter_rare',count:3}],cost:8000,baseChance:45},

    {id:'rev_limiter_legendary',resultId:'rev_limiter_legendary',name:'Legendary Rev Limiter',description:'Programmable two-step rev limiter chip.',rarity:'legendary',category:'special',inputs:[{itemId:'rev_limiter_epic',count:2}],cost:25000,baseChance:30},

    // Lift Spacer
    {id:'lift_spacer_common',resultId:'lift_spacer_common',name:'Common Lift Spacer',description:'Billet spacer raising the body from the frame.',rarity:'common',category:'special',inputs:[{itemId:'scrap_metal',count:3}, {itemId:'aluminum_sheet',count:1}],cost:200,baseChance:90},

    {id:'lift_spacer_uncommon',resultId:'lift_spacer_uncommon',name:'Uncommon Lift Spacer',description:'Billet spacer raising the body from the frame.',rarity:'uncommon',category:'special',inputs:[{itemId:'lift_spacer_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'lift_spacer_rare',resultId:'lift_spacer_rare',name:'Rare Lift Spacer',description:'Billet spacer raising the body from the frame.',rarity:'rare',category:'special',inputs:[{itemId:'lift_spacer_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'lift_spacer_epic',resultId:'lift_spacer_epic',name:'Epic Lift Spacer',description:'Billet spacer raising the body from the frame.',rarity:'epic',category:'special',inputs:[{itemId:'lift_spacer_rare',count:3}],cost:8000,baseChance:45},

    {id:'lift_spacer_legendary',resultId:'lift_spacer_legendary',name:'Legendary Lift Spacer',description:'Billet spacer raising the body from the frame.',rarity:'legendary',category:'special',inputs:[{itemId:'lift_spacer_epic',count:2}],cost:25000,baseChance:30},

    // Extended Shock
    {id:'extended_shock_common',resultId:'extended_shock_common',name:'Common Extended Shock',description:'Long-travel shock absorber for lift kit applications.',rarity:'common',category:'special',inputs:[{itemId:'scrap_metal',count:2}, {itemId:'machine_oil',count:2}],cost:200,baseChance:90},

    {id:'extended_shock_uncommon',resultId:'extended_shock_uncommon',name:'Uncommon Extended Shock',description:'Long-travel shock absorber for lift kit applications.',rarity:'uncommon',category:'special',inputs:[{itemId:'extended_shock_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'extended_shock_rare',resultId:'extended_shock_rare',name:'Rare Extended Shock',description:'Long-travel shock absorber for lift kit applications.',rarity:'rare',category:'special',inputs:[{itemId:'extended_shock_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'extended_shock_epic',resultId:'extended_shock_epic',name:'Epic Extended Shock',description:'Long-travel shock absorber for lift kit applications.',rarity:'epic',category:'special',inputs:[{itemId:'extended_shock_rare',count:3}],cost:8000,baseChance:45},

    {id:'extended_shock_legendary',resultId:'extended_shock_legendary',name:'Legendary Extended Shock',description:'Long-travel shock absorber for lift kit applications.',rarity:'legendary',category:'special',inputs:[{itemId:'extended_shock_epic',count:2}],cost:25000,baseChance:30},

    // Carbon Wing
    {id:'carbon_wing_common',resultId:'carbon_wing_common',name:'Common Carbon Wing',description:'Full carbon fibre aerodynamic wing element.',rarity:'common',category:'special',inputs:[{itemId:'carbon_fiber',count:3}, {itemId:'aluminum_sheet',count:2}],cost:200,baseChance:90},

    {id:'carbon_wing_uncommon',resultId:'carbon_wing_uncommon',name:'Uncommon Carbon Wing',description:'Full carbon fibre aerodynamic wing element.',rarity:'uncommon',category:'special',inputs:[{itemId:'carbon_wing_common',count:3},{itemId:'carbon_fiber',count:1}],cost:800,baseChance:75},

    {id:'carbon_wing_rare',resultId:'carbon_wing_rare',name:'Rare Carbon Wing',description:'Full carbon fibre aerodynamic wing element.',rarity:'rare',category:'special',inputs:[{itemId:'carbon_wing_uncommon',count:3},{itemId:'carbon_fiber',count:1}],cost:2500,baseChance:60},

    {id:'carbon_wing_epic',resultId:'carbon_wing_epic',name:'Epic Carbon Wing',description:'Full carbon fibre aerodynamic wing element.',rarity:'epic',category:'special',inputs:[{itemId:'carbon_wing_rare',count:3}],cost:8000,baseChance:45},

    {id:'carbon_wing_legendary',resultId:'carbon_wing_legendary',name:'Legendary Carbon Wing',description:'Full carbon fibre aerodynamic wing element.',rarity:'legendary',category:'special',inputs:[{itemId:'carbon_wing_epic',count:2}],cost:25000,baseChance:30},

    // Actuator Motor
    {id:'actuator_motor_common',resultId:'actuator_motor_common',name:'Common Actuator Motor',description:'Servo motor controlling active wing angle.',rarity:'common',category:'special',inputs:[{itemId:'aluminum_sheet',count:2}, {itemId:'machine_oil',count:1}],cost:200,baseChance:90},

    {id:'actuator_motor_uncommon',resultId:'actuator_motor_uncommon',name:'Uncommon Actuator Motor',description:'Servo motor controlling active wing angle.',rarity:'uncommon',category:'special',inputs:[{itemId:'actuator_motor_common',count:3},{itemId:'aluminum_sheet',count:1}],cost:800,baseChance:75},

    {id:'actuator_motor_rare',resultId:'actuator_motor_rare',name:'Rare Actuator Motor',description:'Servo motor controlling active wing angle.',rarity:'rare',category:'special',inputs:[{itemId:'actuator_motor_uncommon',count:3},{itemId:'aluminum_sheet',count:1}],cost:2500,baseChance:60},

    {id:'actuator_motor_epic',resultId:'actuator_motor_epic',name:'Epic Actuator Motor',description:'Servo motor controlling active wing angle.',rarity:'epic',category:'special',inputs:[{itemId:'actuator_motor_rare',count:3}],cost:8000,baseChance:45},

    {id:'actuator_motor_legendary',resultId:'actuator_motor_legendary',name:'Legendary Actuator Motor',description:'Servo motor controlling active wing angle.',rarity:'legendary',category:'special',inputs:[{itemId:'actuator_motor_epic',count:2}],cost:25000,baseChance:30},

    // Tune Kit
    {id:'tune_kit_common',resultId:'tune_kit_common',name:'Common Tune Kit',description:'All-in-one street performance tuning package.',rarity:'common',category:'special',inputs:[{itemId:'scrap_metal',count:2}, {itemId:'machine_oil',count:1}],cost:200,baseChance:90},

    {id:'tune_kit_uncommon',resultId:'tune_kit_uncommon',name:'Uncommon Tune Kit',description:'All-in-one street performance tuning package.',rarity:'uncommon',category:'special',inputs:[{itemId:'tune_kit_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'tune_kit_rare',resultId:'tune_kit_rare',name:'Rare Tune Kit',description:'All-in-one street performance tuning package.',rarity:'rare',category:'special',inputs:[{itemId:'tune_kit_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'tune_kit_epic',resultId:'tune_kit_epic',name:'Epic Tune Kit',description:'All-in-one street performance tuning package.',rarity:'epic',category:'special',inputs:[{itemId:'tune_kit_rare',count:3}],cost:8000,baseChance:45},

    {id:'tune_kit_legendary',resultId:'tune_kit_legendary',name:'Legendary Tune Kit',description:'All-in-one street performance tuning package.',rarity:'legendary',category:'special',inputs:[{itemId:'tune_kit_epic',count:2}],cost:25000,baseChance:30},

    // Sport Spring
    {id:'sport_spring_common',resultId:'sport_spring_common',name:'Common Sport Spring',description:'Progressive rate lowering spring set.',rarity:'common',category:'special',inputs:[{itemId:'scrap_metal',count:2}],cost:200,baseChance:90},

    {id:'sport_spring_uncommon',resultId:'sport_spring_uncommon',name:'Uncommon Sport Spring',description:'Progressive rate lowering spring set.',rarity:'uncommon',category:'special',inputs:[{itemId:'sport_spring_common',count:3},{itemId:'scrap_metal',count:1}],cost:800,baseChance:75},

    {id:'sport_spring_rare',resultId:'sport_spring_rare',name:'Rare Sport Spring',description:'Progressive rate lowering spring set.',rarity:'rare',category:'special',inputs:[{itemId:'sport_spring_uncommon',count:3},{itemId:'scrap_metal',count:1}],cost:2500,baseChance:60},

    {id:'sport_spring_epic',resultId:'sport_spring_epic',name:'Epic Sport Spring',description:'Progressive rate lowering spring set.',rarity:'epic',category:'special',inputs:[{itemId:'sport_spring_rare',count:3}],cost:8000,baseChance:45},

    {id:'sport_spring_legendary',resultId:'sport_spring_legendary',name:'Legendary Sport Spring',description:'Progressive rate lowering spring set.',rarity:'legendary',category:'special',inputs:[{itemId:'sport_spring_epic',count:2}],cost:25000,baseChance:30},

];

// ─── HELPER FUNCTIONS ───
function countPlayerItem(player, itemId) {
    if (!player.inventory) return 0;
    return player.inventory
        .filter(i => i.itemId === itemId)
        .reduce((sum, i) => sum + i.count, 0);
}

async function removePlayerItems(player, itemId, amount) {
    if (!player.inventory) return false;
    let remaining = amount;
    const stacks = player.inventory.filter(i => i.itemId === itemId).sort((a, b) => a.count - b.count);

    for (const stack of stacks) {
        if (remaining <= 0) break;
        if (stack.count <= remaining) {
            remaining -= stack.count;
            await db.query('DELETE FROM character_inventory WHERE id = ?', [stack.id]);
            player.inventory = player.inventory.filter(i => i !== stack);
        } else {
            stack.count -= remaining;
            remaining = 0;
            await db.query('UPDATE character_inventory SET count = ? WHERE id = ?', [stack.count, stack.id]);
        }
    }
    inventory.syncClient(player);
    return remaining <= 0;
}

// ─── INIT ───
mp.events.add('packagesLoaded', () => {
    WORKBENCHES.forEach((wb) => {
        mp.blips.new(643, new mp.Vector3(wb.x, wb.y, wb.z), { name: "Crafting Workbench", color: 47, shortRange: true, scale: 0.8 });
        mp.markers.new(1, new mp.Vector3(wb.x, wb.y, wb.z - 1.0), 1.0, { color: [255, 165, 0, 150], visible: true, dimension: 0 });
        const colshape = mp.colshapes.newSphere(wb.x, wb.y, wb.z, 2.0);
        colshape.setVariable('interaction', { title: 'Workbench', text: 'Press E to craft parts', event: 'server:crafting:open', requireOnFoot: true });
    });
    console.log(`[Crafting] ${WORKBENCHES.length} workbenches initialized.`);
});

// ─── EVENTS ───
mp.events.add('server:crafting:open', (player) => {
    if (!player.logged) return;
    sendCraftingData(player);
});

async function sendCraftingData(player) {
    const recipeData = RECIPES.map(r => {
        const inputData = r.inputs.map(input => {
            const def = ItemRegistry[input.itemId];
            return {
                itemId:    input.itemId,
                name:      def ? def.name : input.itemId,
                count:     input.count,
                playerHas: countPlayerItem(player, input.itemId)
            };
        });
        const boostCost = Math.floor(r.cost * 0.25);
        return {
            ...r,
            inputs:      inputData,
            boostCost,
            boostAmount: 15,
            canCraft:    inputData.every(i => i.playerHas >= i.count)
        };
    });

    const playerInfo = { cash: player.data.money || 0 };
    player.call('client:crafting:open', [JSON.stringify(recipeData), JSON.stringify(playerInfo)]);
}

mp.events.add('server:crafting:craft', async (player, recipeId, useBoost) => {
    if (!player.logged) return;

    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;

    // Calculate Costs
    let totalMoneyCost = recipe.cost;
    let chance = recipe.baseChance;

    if (useBoost) {
        const boostCost = Math.floor(recipe.cost * 0.25);
        totalMoneyCost += boostCost;
        chance += 15; // +15% Boost
    }
    if (chance > 100) chance = 100;

    // 1. Validate Resources
    if (player.data.money < totalMoneyCost) {
        return player.call('showNotification', ['Crafting', `Insufficient funds! Need $${totalMoneyCost.toLocaleString()}.`]);
    }

    for (const input of recipe.inputs) {
        if (countPlayerItem(player, input.itemId) < input.count) {
            return player.call('showNotification', ['Crafting', `Missing materials.`]);
        }
    }

    // 2. Consume EVERYTHING first (Risk phase)
    const moneyOk = await playerManager.removeMoneyAndSave(player, totalMoneyCost, `Crafting Attempt: ${recipe.name}`);
    if (!moneyOk) return player.call('showNotification', ['Crafting', 'Transaction error.']);

    for (const input of recipe.inputs) {
        await removePlayerItems(player, input.itemId, input.count);
    }

    // 3. Roll for Success
    const roll = Math.random() * 100;
    const success = roll <= chance;

    if (success) {
        // SUCCESS: Give Item
        await inventory.addItem(player, recipe.resultId, 1);
        player.call('showNotification', ['Crafting', `Success! Crafted ${recipe.name}.`]);
        player.call('client:crafting:result', [true, `Successfully crafted ${recipe.name}`]);
    } else {
        // FAILURE: Refund Logic
        let refundMsg = "Crafting Failed! Refunded: ";
        
        // 50% Money Refund
        const refundMoney = Math.floor(totalMoneyCost * 0.5);
        await playerManager.addMoneyAndSave(player, refundMoney, `Crafting Refund (Fail)`);
        refundMsg += `$${refundMoney}`;

        // 80% Item Refund (Rounded down)
        for (const input of recipe.inputs) {
            const refundAmt = Math.floor(input.count * 0.8);
            if (refundAmt > 0) {
                await inventory.addItem(player, input.itemId, refundAmt);
                refundMsg += `, ${refundAmt}x ${ItemRegistry[input.itemId].name}`;
            }
        }
        
        player.call('showNotification', ['Crafting', 'Construction Failed. Materials damaged.']);
        player.call('client:crafting:result', [false, `Construction Failed.\n${refundMsg}`]);
    }
    
    // Refresh UI
    sendCraftingData(player);
});