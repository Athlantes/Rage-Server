// packages/data/dealershipCatalog.js
// Full vehicle catalog with prices, classes, types, and tier assignments
// Tiers: low (Low-End DS), mid (Medium DS), high (High-End DS)
// Performance Grade: F(worst) -> S(best), calculated from speed+accel+brake+traction

// packages/data/dealershipCatalog.js
// Full vehicle catalog with prices, classes, types, and tier assignments
// Tiers: low (Low-End DS), mid (Medium DS), high (High-End DS)
// Performance Grade: F(worst) -> S(best)
// Stats: topSpeed (km/h), accelTime (0-100 km/h in seconds), brakeDistance (100-0 km/h in meters), grip (lateral g-force)

const catalog = [
    // ══════════════════════════════════════════════════
    //  COMPACTS (Class 0)
    // ══════════════════════════════════════════════════
    { model: "blista",    name: "Blista",        type: "Compacts",  tier: "low", price: 8000,   topSpeed: 151, accelTime: 7.2, brakeDistance: 49, grip: 0.80, seats: 2, grade: "F" },
    { model: "brioso",    name: "Brioso 300",    type: "Compacts",  tier: "low", price: 9500,   topSpeed: 149, accelTime: 5.7, brakeDistance: 49, grip: 0.92, seats: 2, grade: "F" },
    { model: "panto",     name: "Panto",         type: "Compacts",  tier: "low", price: 5500,   topSpeed: 147, accelTime: 6.1, brakeDistance: 49, grip: 0.80, seats: 2, grade: "F" },
    { model: "prairie",   name: "Prairie",       type: "Compacts",  tier: "low", price: 7000,   topSpeed: 147, accelTime: 7.5, brakeDistance: 49, grip: 0.76, seats: 2, grade: "F" },
    { model: "rhapsody",  name: "Rhapsody",      type: "Compacts",  tier: "low", price: 6000,   topSpeed: 149, accelTime: 7.2, brakeDistance: 49, grip: 0.80, seats: 2, grade: "F" },
    { model: "issi2",     name: "Issi",          type: "Compacts",  tier: "low", price: 10000,  topSpeed: 151, accelTime: 7.2, brakeDistance: 49, grip: 0.80, seats: 2, grade: "E" },

    // ══════════════════════════════════════════════════
    //  SEDANS (Class 1)
    // ══════════════════════════════════════════════════
    { model: "asea",      name: "Asea",          type: "Sedans",    tier: "low", price: 6000,   topSpeed: 138, accelTime: 8.3, brakeDistance: 56, grip: 0.80, seats: 4, grade: "F" },
    { model: "emperor",   name: "Emperor",       type: "Sedans",    tier: "low", price: 5000,   topSpeed: 122, accelTime: 11.8, brakeDistance: 49, grip: 0.76, seats: 4, grade: "F" },
    { model: "fugitive",  name: "Fugitive",      type: "Sedans",    tier: "low", price: 8000,   topSpeed: 145, accelTime: 8.3, brakeDistance: 39, grip: 1.00, seats: 4, grade: "E" },
    { model: "ingot",     name: "Ingot",         type: "Sedans",    tier: "low", price: 4500,   topSpeed: 116, accelTime: 11.8, brakeDistance: 49, grip: 0.76, seats: 4, grade: "F" },
    { model: "intruder",  name: "Intruder",      type: "Sedans",    tier: "low", price: 7500,   topSpeed: 142, accelTime: 8.3, brakeDistance: 39, grip: 0.96, seats: 4, grade: "E" },
    { model: "premier",   name: "Premier",       type: "Sedans",    tier: "low", price: 7000,   topSpeed: 138, accelTime: 8.3, brakeDistance: 49, grip: 0.84, seats: 4, grade: "E" },
    { model: "primo",     name: "Primo",         type: "Sedans",    tier: "low", price: 6500,   topSpeed: 138, accelTime: 8.3, brakeDistance: 39, grip: 0.96, seats: 4, grade: "E" },
    { model: "regina",    name: "Regina",        type: "Sedans",    tier: "low", price: 4000,   topSpeed: 110, accelTime: 11.8, brakeDistance: 49, grip: 0.76, seats: 4, grade: "F" },
    { model: "stanier",   name: "Stanier",       type: "Sedans",    tier: "low", price: 8500,   topSpeed: 154, accelTime: 8.3, brakeDistance: 39, grip: 1.00, seats: 4, grade: "E" },
    { model: "stratum",   name: "Stratum",       type: "Sedans",    tier: "low", price: 9000,   topSpeed: 150, accelTime: 7.9, brakeDistance: 49, grip: 0.88, seats: 4, grade: "E" },
    { model: "surge",     name: "Surge",         type: "Sedans",    tier: "low", price: 12000,  topSpeed: 87,  accelTime: 16.5, brakeDistance: 49, grip: 0.84, seats: 4, grade: "F" },
    { model: "warrener",  name: "Warrener",      type: "Sedans",    tier: "low", price: 7000,   topSpeed: 138, accelTime: 6.7, brakeDistance: 39, grip: 0.88, seats: 4, grade: "E" },
    { model: "washingt",  name: "Washington",    type: "Sedans",    tier: "low", price: 10000,  topSpeed: 154, accelTime: 8.3, brakeDistance: 39, grip: 1.00, seats: 4, grade: "E" },
    { model: "schafter5", name: "Schafter V12",  type: "Sedans",    tier: "mid", price: 45000,  topSpeed: 180, accelTime: 5.7, brakeDistance: 39, grip: 1.00, seats: 4, grade: "B" },
    { model: "cog55",     name: "Cognoscenti 55",type: "Sedans",    tier: "mid", price: 35000,  topSpeed: 167, accelTime: 6.2, brakeDistance: 49, grip: 0.88, seats: 4, grade: "C" },
    { model: "superd",    name: "Super Diamond",  type: "Sedans",   tier: "mid", price: 38000,  topSpeed: 163, accelTime: 6.3, brakeDistance: 49, grip: 0.84, seats: 4, grade: "C" },
    { model: "stafford",  name: "Stafford",      type: "Sedans",    tier: "mid", price: 30000,  topSpeed: 137, accelTime: 8.3, brakeDistance: 53, grip: 0.80, seats: 2, grade: "D" },
    { model: "glendale",  name: "Glendale",      type: "Sedans",    tier: "low", price: 11000,  topSpeed: 143, accelTime: 7.0, brakeDistance: 46, grip: 0.80, seats: 4, grade: "E" },

    // ══════════════════════════════════════════════════
    //  SUVs (Class 2)
    // ══════════════════════════════════════════════════
    { model: "fq2",       name: "FQ 2",          type: "SUVs",      tier: "low", price: 9000,   topSpeed: 144, accelTime: 9.2, brakeDistance: 60, grip: 0.80, seats: 4, grade: "E" },
    { model: "habanero",  name: "Habanero",      type: "SUVs",      tier: "low", price: 9500,   topSpeed: 144, accelTime: 9.2, brakeDistance: 60, grip: 0.84, seats: 4, grade: "E" },
    { model: "landstal",  name: "Landstalker",   type: "SUVs",      tier: "low", price: 10000,  topSpeed: 132, accelTime: 9.2, brakeDistance: 42, grip: 0.84, seats: 4, grade: "E" },
    { model: "serrano",   name: "Serrano",       type: "SUVs",      tier: "low", price: 11000,  topSpeed: 145, accelTime: 8.3, brakeDistance: 56, grip: 0.84, seats: 4, grade: "E" },
    { model: "seminole",  name: "Seminole",      type: "SUVs",      tier: "low", price: 10500,  topSpeed: 132, accelTime: 9.2, brakeDistance: 42, grip: 0.80, seats: 4, grade: "E" },
    { model: "bjxl",      name: "BeeJay XL",     type: "SUVs",      tier: "low", price: 11500,  topSpeed: 131, accelTime: 8.7, brakeDistance: 42, grip: 0.80, seats: 4, grade: "E" },
    { model: "granger",   name: "Granger",       type: "SUVs",      tier: "low", price: 13000,  topSpeed: 131, accelTime: 8.7, brakeDistance: 42, grip: 0.84, seats: 8, grade: "E" },
    { model: "radi",      name: "Radius",        type: "SUVs",      tier: "mid", price: 22000,  topSpeed: 142, accelTime: 8.3, brakeDistance: 42, grip: 0.92, seats: 4, grade: "D" },
    { model: "rocoto",    name: "Rocoto",        type: "SUVs",      tier: "mid", price: 25000,  topSpeed: 149, accelTime: 8.7, brakeDistance: 60, grip: 0.84, seats: 4, grade: "D" },
    { model: "contender", name: "Contender",     type: "SUVs",      tier: "mid", price: 28000,  topSpeed: 149, accelTime: 6.3, brakeDistance: 49, grip: 0.84, seats: 4, grade: "C" },
    { model: "xls",       name: "XLS",           type: "SUVs",      tier: "mid", price: 32000,  topSpeed: 158, accelTime: 6.3, brakeDistance: 49, grip: 0.80, seats: 4, grade: "C" },
    { model: "baller4",   name: "Baller LE",     type: "SUVs",      tier: "mid", price: 40000,  topSpeed: 162, accelTime: 6.1, brakeDistance: 49, grip: 0.80, seats: 4, grade: "C" },
    { model: "huntley",   name: "Huntley S",     type: "SUVs",      tier: "mid", price: 38000,  topSpeed: 163, accelTime: 6.2, brakeDistance: 49, grip: 0.84, seats: 4, grade: "C" },
    { model: "toros",     name: "Toros",          type: "SUVs",      tier: "high", price: 85000, topSpeed: 176, accelTime: 5.2, brakeDistance: 42, grip: 0.92, seats: 4, grade: "B" },

    // ══════════════════════════════════════════════════
    //  COUPES (Class 3)
    // ══════════════════════════════════════════════════
    { model: "felon2",    name: "Felon GT",      type: "Coupes",    tier: "mid", price: 28000,  topSpeed: 157, accelTime: 6.9, brakeDistance: 39, grip: 1.00, seats: 2, grade: "C" },
    { model: "sentinel",  name: "Sentinel",      type: "Coupes",    tier: "mid", price: 26000,  topSpeed: 164, accelTime: 7.9, brakeDistance: 39, grip: 1.00, seats: 2, grade: "C" },
    { model: "sentinel2", name: "Sentinel XS",   type: "Coupes",    tier: "mid", price: 28000,  topSpeed: 164, accelTime: 7.9, brakeDistance: 39, grip: 1.00, seats: 4, grade: "C" },
    { model: "zion",      name: "Zion",          type: "Coupes",    tier: "mid", price: 30000,  topSpeed: 169, accelTime: 7.5, brakeDistance: 39, grip: 1.04, seats: 2, grade: "C" },
    { model: "zion2",     name: "Zion Cabrio",   type: "Coupes",    tier: "mid", price: 32000,  topSpeed: 169, accelTime: 7.5, brakeDistance: 39, grip: 1.04, seats: 2, grade: "C" },
    { model: "jackal",    name: "Jackal",        type: "Coupes",    tier: "mid", price: 33000,  topSpeed: 166, accelTime: 7.5, brakeDistance: 39, grip: 1.04, seats: 4, grade: "C" },
    { model: "felon",     name: "Felon",         type: "Coupes",    tier: "mid", price: 35000,  topSpeed: 165, accelTime: 6.9, brakeDistance: 39, grip: 1.00, seats: 4, grade: "C" },
    { model: "oracle",    name: "Oracle",        type: "Coupes",    tier: "mid", price: 36000,  topSpeed: 166, accelTime: 6.1, brakeDistance: 39, grip: 0.92, seats: 4, grade: "C" },
    { model: "f620",      name: "F620",          type: "Coupes",    tier: "mid", price: 42000,  topSpeed: 173, accelTime: 6.9, brakeDistance: 39, grip: 1.00, seats: 2, grade: "B" },
    { model: "exemplar",  name: "Exemplar",      type: "Coupes",    tier: "mid", price: 45000,  topSpeed: 173, accelTime: 6.3, brakeDistance: 39, grip: 1.04, seats: 4, grade: "B" },
    { model: "windsor",   name: "Windsor",       type: "Coupes",    tier: "high", price: 75000, topSpeed: 173, accelTime: 5.9, brakeDistance: 46, grip: 0.88, seats: 2, grade: "B" },
    { model: "windsor2",  name: "Windsor Drop",  type: "Coupes",    tier: "high", price: 80000, topSpeed: 172, accelTime: 5.9, brakeDistance: 46, grip: 0.88, seats: 4, grade: "B" },
    { model: "cogcabri",  name: "Cognoscenti Cabrio", type: "Coupes", tier: "high", price: 70000, topSpeed: 163, accelTime: 6.3, brakeDistance: 49, grip: 0.92, seats: 2, grade: "B" },

    // ══════════════════════════════════════════════════
    //  MUSCLE (Class 4)
    // ══════════════════════════════════════════════════
    { model: "picador",   name: "Picador",       type: "Muscle",    tier: "low", price: 8000,   topSpeed: 147, accelTime: 7.5, brakeDistance: 42, grip: 0.80, seats: 2, grade: "E" },
    { model: "tampa",     name: "Tampa",         type: "Muscle",    tier: "low", price: 10000,  topSpeed: 152, accelTime: 6.1, brakeDistance: 42, grip: 0.92, seats: 2, grade: "D" },
    { model: "blade",     name: "Blade",         type: "Muscle",    tier: "low", price: 11000,  topSpeed: 152, accelTime: 5.1, brakeDistance: 42, grip: 0.88, seats: 2, grade: "D" },
    { model: "vigero",    name: "Vigero",        type: "Muscle",    tier: "low", price: 12000,  topSpeed: 168, accelTime: 5.7, brakeDistance: 42, grip: 0.80, seats: 2, grade: "D" },
    { model: "sabregt",   name: "Sabre Turbo",   type: "Muscle",    tier: "low", price: 14000,  topSpeed: 168, accelTime: 5.9, brakeDistance: 42, grip: 0.92, seats: 2, grade: "D" },
    { model: "phoenix",   name: "Phoenix",       type: "Muscle",    tier: "low", price: 15000,  topSpeed: 170, accelTime: 5.9, brakeDistance: 42, grip: 0.84, seats: 2, grade: "D" },
    { model: "gauntlet",  name: "Gauntlet",      type: "Muscle",    tier: "mid", price: 25000,  topSpeed: 169, accelTime: 5.5, brakeDistance: 39, grip: 1.00, seats: 2, grade: "C" },
    { model: "dominato",  name: "Dominator",     type: "Muscle",    tier: "mid", price: 28000,  topSpeed: 174, accelTime: 5.7, brakeDistance: 42, grip: 0.92, seats: 2, grade: "C" },
    { model: "ruiner",    name: "Ruiner",        type: "Muscle",    tier: "mid", price: 26000,  topSpeed: 174, accelTime: 5.9, brakeDistance: 42, grip: 0.88, seats: 2, grade: "C" },
    { model: "dukes",     name: "Dukes",         type: "Muscle",    tier: "mid", price: 30000,  topSpeed: 172, accelTime: 5.2, brakeDistance: 42, grip: 0.92, seats: 2, grade: "C" },
    { model: "tulip",     name: "Tulip",         type: "Muscle",    tier: "mid", price: 32000,  topSpeed: 176, accelTime: 5.2, brakeDistance: 53, grip: 0.92, seats: 4, grade: "C" },
    { model: "ellie",     name: "Ellie",         type: "Muscle",    tier: "mid", price: 35000,  topSpeed: 165, accelTime: 5.1, brakeDistance: 53, grip: 1.00, seats: 2, grade: "C" },
    { model: "clique",    name: "Clique",        type: "Muscle",    tier: "mid", price: 36000,  topSpeed: 166, accelTime: 5.5, brakeDistance: 42, grip: 0.96, seats: 2, grade: "C" },
    { model: "gauntlet4", name: "Gauntlet Classic", type: "Muscle", tier: "mid", price: 42000,  topSpeed: 175, accelTime: 4.6, brakeDistance: 39, grip: 0.96, seats: 2, grade: "B" },
    { model: "dominato2", name: "Dominator GTX", type: "Muscle",    tier: "high", price: 65000, topSpeed: 176, accelTime: 5.3, brakeDistance: 39, grip: 0.92, seats: 2, grade: "B" },
    { model: "yosemite",  name: "Yosemite",      type: "Muscle",    tier: "low", price: 13000,  topSpeed: 150, accelTime: 5.8, brakeDistance: 42, grip: 0.96, seats: 2, grade: "D" },
    { model: "deviant",   name: "Deviant",       type: "Muscle",    tier: "mid", price: 34000,  topSpeed: 153, accelTime: 5.7, brakeDistance: 53, grip: 0.92, seats: 2, grade: "C" },

    // ══════════════════════════════════════════════════
    //  SPORTS CLASSICS (Class 5)
    // ══════════════════════════════════════════════════
    { model: "peyote",    name: "Peyote",        type: "Sports Classics", tier: "low", price: 9000,  topSpeed: 133, accelTime: 10.3, brakeDistance: 60, grip: 0.76, seats: 2, grade: "F" },
    { model: "tornado",   name: "Tornado",       type: "Sports Classics", tier: "low", price: 8000,  topSpeed: 133, accelTime: 10.3, brakeDistance: 60, grip: 0.72, seats: 2, grade: "F" },
    { model: "manana",    name: "Manana",        type: "Sports Classics", tier: "low", price: 7500,  topSpeed: 133, accelTime: 10.3, brakeDistance: 60, grip: 0.76, seats: 2, grade: "F" },
    { model: "nebula",    name: "Nebula Turbo",  type: "Sports Classics", tier: "low", price: 12000, topSpeed: 136, accelTime: 6.9, brakeDistance: 53, grip: 0.76, seats: 2, grade: "E" },
    { model: "cheburek",  name: "Cheburek",      type: "Sports Classics", tier: "low", price: 11000, topSpeed: 161, accelTime: 6.2, brakeDistance: 42, grip: 0.92, seats: 2, grade: "D" },
    { model: "retinue",   name: "Retinue",       type: "Sports Classics", tier: "low", price: 14000, topSpeed: 154, accelTime: 7.2, brakeDistance: 46, grip: 0.80, seats: 2, grade: "D" },
    { model: "z190",      name: "190z",          type: "Sports Classics", tier: "mid", price: 32000, topSpeed: 158, accelTime: 6.1, brakeDistance: 39, grip: 0.92, seats: 2, grade: "C" },
    { model: "savestra",  name: "Savestra",      type: "Sports Classics", tier: "mid", price: 30000, topSpeed: 158, accelTime: 7.0, brakeDistance: 46, grip: 0.80, seats: 2, grade: "D" },
    { model: "gt500",     name: "GT500",         type: "Sports Classics", tier: "mid", price: 38000, topSpeed: 165, accelTime: 5.7, brakeDistance: 42, grip: 0.88, seats: 2, grade: "C" },
    { model: "stinger",   name: "Stinger",       type: "Sports Classics", tier: "mid", price: 40000, topSpeed: 163, accelTime: 6.3, brakeDistance: 49, grip: 0.84, seats: 2, grade: "C" },
    { model: "feltzer3",  name: "Stirling GT",   type: "Sports Classics", tier: "mid", price: 45000, topSpeed: 166, accelTime: 5.5, brakeDistance: 42, grip: 0.96, seats: 2, grade: "B" },
    { model: "coquette2", name: "Coquette Classic", type: "Sports Classics", tier: "mid", price: 48000, topSpeed: 178, accelTime: 4.9, brakeDistance: 53, grip: 0.92, seats: 2, grade: "B" },
    { model: "jb700",     name: "JB 700",        type: "Sports Classics", tier: "high", price: 75000, topSpeed: 180, accelTime: 6.3, brakeDistance: 49, grip: 0.84, seats: 2, grade: "B" },
    { model: "monroe",    name: "Monroe",        type: "Sports Classics", tier: "high", price: 78000, topSpeed: 180, accelTime: 5.9, brakeDistance: 46, grip: 0.88, seats: 2, grade: "B" },
    { model: "ztype",     name: "Z-Type",        type: "Sports Classics", tier: "high", price: 120000, topSpeed: 185, accelTime: 5.5, brakeDistance: 46, grip: 0.92, seats: 2, grade: "A" },
    { model: "cheetah2",  name: "Cheetah Classic", type: "Sports Classics", tier: "high", price: 95000, topSpeed: 180, accelTime: 5.5, brakeDistance: 42, grip: 1.04, seats: 2, grade: "A" },
    { model: "turismo2",  name: "Turismo Classic", type: "Sports Classics", tier: "high", price: 90000, topSpeed: 178, accelTime: 4.9, brakeDistance: 53, grip: 1.04, seats: 2, grade: "A" },

    // ══════════════════════════════════════════════════
    //  SPORTS (Class 6)
    // ══════════════════════════════════════════════════
    { model: "futo",      name: "Futo",          type: "Sports",    tier: "low", price: 12000,  topSpeed: 162, accelTime: 5.7, brakeDistance: 53, grip: 0.80, seats: 2, grade: "D" },
    { model: "penumbra",  name: "Penumbra",      type: "Sports",    tier: "low", price: 14000,  topSpeed: 147, accelTime: 7.5, brakeDistance: 42, grip: 0.92, seats: 2, grade: "D" },
    { model: "sultan",    name: "Sultan",        type: "Sports",    tier: "low", price: 16000,  topSpeed: 163, accelTime: 6.3, brakeDistance: 56, grip: 0.96, seats: 4, grade: "D" },
    { model: "buffalo",   name: "Buffalo",       type: "Sports",    tier: "low", price: 15000,  topSpeed: 163, accelTime: 6.1, brakeDistance: 39, grip: 1.00, seats: 4, grade: "D" },
    { model: "kuruma",    name: "Kuruma",        type: "Sports",    tier: "mid", price: 28000,  topSpeed: 169, accelTime: 5.3, brakeDistance: 53, grip: 1.00, seats: 4, grade: "C" },
    { model: "jester",    name: "Jester",        type: "Sports",    tier: "mid", price: 35000,  topSpeed: 166, accelTime: 5.5, brakeDistance: 39, grip: 1.00, seats: 2, grade: "C" },
    { model: "elegy2",    name: "Elegy RH8",     type: "Sports",    tier: "mid", price: 38000,  topSpeed: 175, accelTime: 5.0, brakeDistance: 53, grip: 1.08, seats: 2, grade: "B" },
    { model: "banshee",   name: "Banshee",       type: "Sports",    tier: "mid", price: 40000,  topSpeed: 171, accelTime: 4.9, brakeDistance: 35, grip: 0.96, seats: 2, grade: "B" },
    { model: "comet2",    name: "Comet",         type: "Sports",    tier: "mid", price: 42000,  topSpeed: 181, accelTime: 4.9, brakeDistance: 42, grip: 1.04, seats: 2, grade: "B" },
    { model: "feltzer",   name: "Feltzer",       type: "Sports",    tier: "mid", price: 44000,  topSpeed: 178, accelTime: 4.9, brakeDistance: 42, grip: 1.04, seats: 2, grade: "B" },
    { model: "surano",    name: "Surano",        type: "Sports",    tier: "mid", price: 48000,  topSpeed: 181, accelTime: 4.9, brakeDistance: 35, grip: 1.00, seats: 2, grade: "B" },
    { model: "rapidgt",   name: "Rapid GT",      type: "Sports",    tier: "mid", price: 46000,  topSpeed: 180, accelTime: 4.6, brakeDistance: 35, grip: 1.00, seats: 2, grade: "B" },
    { model: "coquette",  name: "Coquette",      type: "Sports",    tier: "mid", price: 50000,  topSpeed: 182, accelTime: 5.0, brakeDistance: 42, grip: 1.00, seats: 2, grade: "B" },
    { model: "carboniz",  name: "Carbonizzare",  type: "Sports",    tier: "high", price: 68000, topSpeed: 174, accelTime: 4.7, brakeDistance: 42, grip: 0.96, seats: 2, grade: "B" },
    { model: "massacro",  name: "Massacro",      type: "Sports",    tier: "high", price: 72000, topSpeed: 182, accelTime: 4.5, brakeDistance: 39, grip: 0.96, seats: 2, grade: "A" },
    { model: "seven70",   name: "Seven-70",      type: "Sports",    tier: "high", price: 78000, topSpeed: 183, accelTime: 4.9, brakeDistance: 35, grip: 1.04, seats: 2, grade: "A" },
    { model: "schlagen",  name: "Schlagen GT",   type: "Sports",    tier: "high", price: 85000, topSpeed: 188, accelTime: 4.5, brakeDistance: 42, grip: 1.00, seats: 2, grade: "A" },
    { model: "italigto",  name: "Itali GTO",     type: "Sports",    tier: "high", price: 95000, topSpeed: 189, accelTime: 4.1, brakeDistance: 32, grip: 1.04, seats: 2, grade: "S" },
    { model: "pariah",    name: "Pariah",        type: "Sports",    tier: "high", price: 70000, topSpeed: 175, accelTime: 5.1, brakeDistance: 35, grip: 1.04, seats: 2, grade: "A" },
    { model: "jugular",   name: "Jugular",       type: "Sports",    tier: "high", price: 75000, topSpeed: 175, accelTime: 4.4, brakeDistance: 32, grip: 1.04, seats: 4, grade: "A" },
    { model: "neo",       name: "Neo",           type: "Sports",    tier: "high", price: 88000, topSpeed: 184, accelTime: 4.3, brakeDistance: 28, grip: 1.04, seats: 2, grade: "S" },

    // ══════════════════════════════════════════════════
    //  SUPER (Class 7)
    // ══════════════════════════════════════════════════
    { model: "vacca",     name: "Vacca",         type: "Super",     tier: "high", price: 120000, topSpeed: 181, accelTime: 5.5, brakeDistance: 35, grip: 1.04, seats: 2, grade: "A" },
    { model: "bullet",    name: "Bullet",        type: "Super",     tier: "high", price: 125000, topSpeed: 179, accelTime: 5.0, brakeDistance: 42, grip: 1.00, seats: 2, grade: "A" },
    { model: "cheetah",   name: "Cheetah",       type: "Super",     tier: "high", price: 135000, topSpeed: 180, accelTime: 5.2, brakeDistance: 42, grip: 1.04, seats: 2, grade: "A" },
    { model: "entityxf",  name: "Entity XF",     type: "Super",     tier: "high", price: 140000, topSpeed: 183, accelTime: 5.0, brakeDistance: 39, grip: 1.12, seats: 2, grade: "A" },
    { model: "zentorno",  name: "Zentorno",      type: "Super",     tier: "high", price: 150000, topSpeed: 179, accelTime: 4.7, brakeDistance: 35, grip: 1.04, seats: 2, grade: "A" },
    { model: "turismor",  name: "Turismo R",     type: "Super",     tier: "high", price: 155000, topSpeed: 184, accelTime: 4.7, brakeDistance: 28, grip: 1.04, seats: 2, grade: "S" },
    { model: "t20",       name: "T20",           type: "Super",     tier: "high", price: 165000, topSpeed: 179, accelTime: 4.5, brakeDistance: 32, grip: 1.08, seats: 2, grade: "S" },
    { model: "osiris",    name: "Osiris",        type: "Super",     tier: "high", price: 160000, topSpeed: 179, accelTime: 4.6, brakeDistance: 32, grip: 1.08, seats: 2, grade: "S" },
    { model: "adder",     name: "Adder",         type: "Super",     tier: "high", price: 180000, topSpeed: 186, accelTime: 5.2, brakeDistance: 35, grip: 1.00, seats: 2, grade: "A" },
    { model: "nero2",     name: "Nero Custom",   type: "Super",     tier: "high", price: 195000, topSpeed: 190, accelTime: 4.9, brakeDistance: 32, grip: 1.08, seats: 2, grade: "S" },
    { model: "vagner",    name: "Vagner",        type: "Super",     tier: "high", price: 210000, topSpeed: 189, accelTime: 4.5, brakeDistance: 32, grip: 1.12, seats: 2, grade: "S" },
    { model: "deveste",   name: "Deveste Eight",  type: "Super",    tier: "high", price: 225000, topSpeed: 190, accelTime: 3.9, brakeDistance: 35, grip: 1.08, seats: 2, grade: "S" },
    { model: "krieger",   name: "Krieger",       type: "Super",     tier: "high", price: 240000, topSpeed: 189, accelTime: 4.4, brakeDistance: 32, grip: 1.12, seats: 2, grade: "S" },
    { model: "emerus",    name: "Emerus",        type: "Super",     tier: "high", price: 235000, topSpeed: 183, accelTime: 4.4, brakeDistance: 28, grip: 1.12, seats: 2, grade: "S" },
    { model: "taipan",    name: "Taipan",        type: "Super",     tier: "high", price: 250000, topSpeed: 194, accelTime: 4.6, brakeDistance: 35, grip: 1.04, seats: 2, grade: "S" },
    { model: "entity2",   name: "Entity XXR",    type: "Super",     tier: "high", price: 260000, topSpeed: 193, accelTime: 4.6, brakeDistance: 35, grip: 1.12, seats: 2, grade: "S" },
    { model: "thrax",     name: "Thrax",         type: "Super",     tier: "high", price: 200000, topSpeed: 181, accelTime: 4.9, brakeDistance: 28, grip: 1.08, seats: 2, grade: "S" },

    // ══════════════════════════════════════════════════
    //  MOTORCYCLES (Class 8)
    // ══════════════════════════════════════════════════
    { model: "faggio",    name: "Faggio",        type: "Motorcycles", tier: "low", price: 2500,  topSpeed: 85,  accelTime: 16.5, brakeDistance: 56, grip: 0.64, seats: 2, grade: "F" },
    { model: "pcj",       name: "PCJ-600",       type: "Motorcycles", tier: "low", price: 8000,  topSpeed: 143, accelTime: 6.3, brakeDistance: 25, grip: 0.80, seats: 2, grade: "D" },
    { model: "vader",     name: "Vader",         type: "Motorcycles", tier: "low", price: 9000,  topSpeed: 152, accelTime: 6.1, brakeDistance: 32, grip: 0.76, seats: 2, grade: "D" },
    { model: "enduro",    name: "Enduro",        type: "Motorcycles", tier: "low", price: 7000,  topSpeed: 143, accelTime: 5.5, brakeDistance: 32, grip: 0.88, seats: 2, grade: "D" },
    { model: "sanchez01", name: "Sanchez",       type: "Motorcycles", tier: "low", price: 6500,  topSpeed: 142, accelTime: 5.9, brakeDistance: 32, grip: 0.84, seats: 2, grade: "D" },
    { model: "bati",      name: "Bati 801",      type: "Motorcycles", tier: "mid", price: 18000, topSpeed: 177, accelTime: 5.5, brakeDistance: 21, grip: 0.92, seats: 2, grade: "B" },
    { model: "double",    name: "Double T",      type: "Motorcycles", tier: "mid", price: 20000, topSpeed: 172, accelTime: 5.3, brakeDistance: 21, grip: 0.88, seats: 2, grade: "B" },
    { model: "akuma",     name: "Akuma",         type: "Motorcycles", tier: "mid", price: 22000, topSpeed: 174, accelTime: 4.1, brakeDistance: 28, grip: 0.84, seats: 2, grade: "B" },
    { model: "carbon",    name: "Carbon RS",     type: "Motorcycles", tier: "mid", price: 25000, topSpeed: 169, accelTime: 5.5, brakeDistance: 25, grip: 0.84, seats: 2, grade: "B" },
    { model: "bf400",     name: "BF400",         type: "Motorcycles", tier: "mid", price: 15000, topSpeed: 159, accelTime: 5.7, brakeDistance: 32, grip: 0.84, seats: 2, grade: "C" },
    { model: "hakuchou",  name: "Hakuchou",      type: "Motorcycles", tier: "high", price: 55000, topSpeed: 178, accelTime: 5.2, brakeDistance: 21, grip: 0.92, seats: 2, grade: "A" },
    { model: "hakuchou2", name: "Hakuchou Drag", type: "Motorcycles", tier: "high", price: 75000, topSpeed: 187, accelTime: 3.9, brakeDistance: 21, grip: 1.16, seats: 2, grade: "S" },
    { model: "shotaro",   name: "Shotaro",       type: "Motorcycles", tier: "high", price: 85000, topSpeed: 184, accelTime: 4.1, brakeDistance: 21, grip: 1.08, seats: 1, grade: "S" },

    // ══════════════════════════════════════════════════
    //  OFF-ROAD (Class 9)
    // ══════════════════════════════════════════════════
    { model: "bodhi2",    name: "Bodhi",         type: "Off-Road",  tier: "low", price: 7000,   topSpeed: 128, accelTime: 7.7, brakeDistance: 32, grip: 0.92, seats: 4, grade: "E" },
    { model: "rancherx",  name: "Rancher XL",    type: "Off-Road",  tier: "low", price: 8000,   topSpeed: 127, accelTime: 9.2, brakeDistance: 42, grip: 0.76, seats: 4, grade: "E" },
    { model: "bfinject",  name: "BF Injection",  type: "Off-Road",  tier: "low", price: 10000,  topSpeed: 147, accelTime: 7.5, brakeDistance: 49, grip: 0.76, seats: 2, grade: "D" },
    { model: "rebel02",   name: "Rebel",         type: "Off-Road",  tier: "low", price: 9000,   topSpeed: 138, accelTime: 8.3, brakeDistance: 49, grip: 0.80, seats: 2, grade: "E" },
    { model: "sandking",  name: "Sandking XL",   type: "Off-Road",  tier: "low", price: 14000,  topSpeed: 138, accelTime: 8.3, brakeDistance: 49, grip: 0.80, seats: 4, grade: "E" },
    { model: "kamacho",   name: "Kamacho",       type: "Off-Road",  tier: "mid", price: 28000,  topSpeed: 147, accelTime: 6.5, brakeDistance: 60, grip: 0.80, seats: 2, grade: "D" },
    { model: "riata",     name: "Riata",         type: "Off-Road",  tier: "mid", price: 25000,  topSpeed: 145, accelTime: 6.6, brakeDistance: 60, grip: 0.80, seats: 2, grade: "D" },
    { model: "freecrawler", name: "Freecrawler", type: "Off-Road",  tier: "mid", price: 30000,  topSpeed: 132, accelTime: 6.9, brakeDistance: 60, grip: 0.80, seats: 4, grade: "D" },
    { model: "nightshark", name: "Nightshark",   type: "Off-Road",  tier: "mid", price: 45000,  topSpeed: 132, accelTime: 6.1, brakeDistance: 42, grip: 0.84, seats: 4, grade: "C" },
    { model: "trophy",    name: "Trophy Truck",  type: "Off-Road",  tier: "mid", price: 35000,  topSpeed: 156, accelTime: 4.9, brakeDistance: 60, grip: 1.00, seats: 2, grade: "C" },
    { model: "brawler",   name: "Brawler",       type: "Off-Road",  tier: "high", price: 60000, topSpeed: 168, accelTime: 5.9, brakeDistance: 39, grip: 0.76, seats: 2, grade: "B" },
    { model: "bifta",     name: "Bifta",         type: "Off-Road",  tier: "mid", price: 20000,  topSpeed: 163, accelTime: 6.3, brakeDistance: 46, grip: 0.80, seats: 2, grade: "C" },
];

// Dimension offset: each player gets dimension (DEALERSHIP_DIM_OFFSET + player.id)
// to isolate them while browsing/test-driving
const DEALERSHIP_DIM_OFFSET = 10000;

// Dealership locations
const DEALERSHIPS = {
    low: {
        name: "Budget Auto",
        blipColor: 2, // green
        pos: { x: -31.07, y: -1106.57, z: 26.42 },       // Pillbox Hill
        spawnPos: { x: -44.43, y: -1101.36, z: 26.42, heading: 70.0 },
        camPos: { x: -47.0, y: -1095.0, z: 27.5 },
        camLookAt: { x: -44.43, y: -1101.36, z: 27.0 },
        testDrivePos: { x: -55.79, y: -1111.07, z: 26.03, heading: 74.54 },
        parkingSpots: [
            // BudgetLot1
            { x: 359.70, y: -1159.68, z: 28.88, h: 89.30 },
            { x: 347.20, y: -1157.02, z: 28.88, h: -90.52 },
            { x: 358.86, y: -1165.90, z: 28.88, h: 89.07 },
            { x: 347.28, y: -1166.04, z: 28.88, h: -90.08 },
            { x: 325.42, y: -1153.81, z: 28.88, h: -89.94 },
            { x: 325.94, y: -1156.89, z: 28.88, h: -89.64 },
            { x: 336.68, y: -1156.73, z: 28.88, h: 88.95 },
            { x: 337.02, y: -1159.63, z: 28.88, h: 89.75 },
            { x: 337.19, y: -1163.02, z: 28.88, h: 89.71 },
            { x: 336.91, y: -1165.91, z: 28.88, h: 89.00 },
            // BudgetLot2
            { x: 158.27, y: -1082.49, z: 28.78, h: 0.17 },
            { x: 154.66, y: -1081.72, z: 28.78, h: -1.06 },
            { x: 151.05, y: -1081.58, z: 28.79, h: 0.26 },
            { x: 147.28, y: -1081.79, z: 28.78, h: -0.65 },
            { x: 143.65, y: -1081.76, z: 28.78, h: -1.96 },
            { x: 139.85, y: -1081.57, z: 28.78, h: 1.85 },
            { x: 135.95, y: -1082.20, z: 28.78, h: 3.02 },
            { x: 132.31, y: -1081.71, z: 28.78, h: 1.33 },
            { x: 128.63, y: -1081.49, z: 28.78, h: 0.71 },
            { x: 124.91, y: -1081.67, z: 28.78, h: 0.03 },
            { x: 121.22, y: -1081.84, z: 28.78, h: 1.67 },
            { x: 117.52, y: -1081.91, z: 28.78, h: 1.10 },
            { x: 106.07, y: -1063.23, z: 28.79, h: -112.51 },
            { x: 107.41, y: -1059.80, z: 28.79, h: -113.81 },
            { x: 108.81, y: -1056.33, z: 28.80, h: -112.39 },
            { x: 110.40, y: -1052.90, z: 28.80, h: -114.49 },
            // BudgetLot3
            { x: 48.10, y: -1056.20, z: 37.74, h: 71.03 },
            { x: 47.35, y: -1058.95, z: 37.74, h: 69.12 },
            { x: 46.23, y: -1061.41, z: 37.74, h: 69.66 },
            { x: 45.49, y: -1064.18, z: 37.74, h: 68.91 },
            { x: 44.38, y: -1066.80, z: 37.74, h: 66.85 },
            { x: 43.25, y: -1069.36, z: 37.74, h: 66.85 },
            { x: 42.07, y: -1071.85, z: 37.74, h: 67.69 },
            { x: 15.34, y: -1103.29, z: 37.74, h: 68.77 },
            { x: 14.39, y: -1105.91, z: 37.74, h: 69.87 },
            { x: 13.74, y: -1108.73, z: 37.74, h: 70.39 },
            { x: 12.17, y: -1111.38, z: 37.74, h: 69.21 },
            { x: 34.90, y: -1051.60, z: 37.74, h: -110.11 },
            { x: 34.38, y: -1054.51, z: 37.74, h: -111.31 },
            { x: 26.78, y: -1073.13, z: 37.74, h: 69.49 },
            { x: 27.94, y: -1070.60, z: 37.74, h: 69.23 },
            { x: 28.90, y: -1067.86, z: 37.74, h: 71.31 },
            // BudgetLot4
            { x: -302.32, y: -1004.50, z: 29.97, h: -110.71 },
            { x: -302.41, y: -1007.68, z: 29.97, h: -109.22 },
            { x: -303.20, y: -1010.53, z: 29.97, h: -110.85 },
            { x: -304.48, y: -1013.23, z: 29.97, h: -109.84 },
            { x: -305.10, y: -1016.35, z: 29.97, h: -109.98 },
            { x: -291.89, y: -1020.89, z: 29.97, h: -109.83 },
            { x: -291.16, y: -1017.84, z: 29.97, h: -112.66 },
            { x: -290.30, y: -1015.05, z: 29.97, h: -111.72 },
            { x: -288.97, y: -1012.13, z: 29.97, h: -110.50 },
            { x: -287.91, y: -1009.54, z: 29.97, h: -109.93 },
            { x: -282.68, y: -1011.43, z: 29.97, h: -109.91 },
            { x: -283.01, y: -1014.67, z: 29.97, h: -110.78 },
            { x: -284.19, y: -1017.28, z: 29.97, h: -109.39 },
            { x: -284.82, y: -1020.42, z: 29.97, h: -111.55 },
            { x: -285.87, y: -1023.11, z: 29.97, h: -111.46 },
        ],
        npc: { model: 'mp_m_waremech_01', x: -31.07, y: -1106.57, z: 26.42, heading: -16.31 }
    },
    mid: {
        name: "Premium Motors",
        blipColor: 3, // blue
        pos: { x: -1149.95, y: -1710.46, z: 9.49 },        // Bay City
        spawnPos: { x: -1178.99, y: -1722.20, z: 4.03, heading: -55.74 },
        camPos: { x: -1177.54, y: -1715.57, z: 5.45 },
        camLookAt: { x: -1178.99, y: -1722.20, z: 4.03 },
        testDrivePos: { x: -1166.20, y: -1769.80, z: 3.50, heading: -56.39 },
        parkingSpots: [
            // PremiumLot1
            { x: -960.09, y: -1590.62, z: 4.61, h: 19.72 },
            { x: -963.05, y: -1591.61, z: 4.61, h: 18.74 },
            { x: -965.91, y: -1592.81, z: 4.61, h: 18.34 },
            { x: -969.05, y: -1593.92, z: 4.61, h: 19.87 },
            { x: -972.23, y: -1594.75, z: 4.61, h: 20.59 },
            { x: -967.11, y: -1578.09, z: 4.61, h: -159.45 },
            { x: -964.16, y: -1576.97, z: 4.61, h: -160.50 },
            { x: -951.97, y: -1572.60, z: 4.61, h: -158.64 },
            { x: -949.03, y: -1571.39, z: 4.61, h: -159.77 },
            { x: -973.81, y: -1560.02, z: 4.64, h: 20.52 },
            { x: -970.90, y: -1558.73, z: 4.63, h: 20.58 },
            { x: -958.72, y: -1554.33, z: 4.62, h: 19.14 },
            { x: -955.76, y: -1553.18, z: 4.61, h: 20.67 },
            { x: -925.04, y: -1544.16, z: 4.61, h: 19.74 },
            { x: -922.04, y: -1542.71, z: 4.61, h: 18.70 },
            { x: -919.24, y: -1541.51, z: 4.61, h: 20.92 },
            { x: -916.02, y: -1540.63, z: 4.61, h: 20.81 },
            { x: -913.09, y: -1539.21, z: 4.61, h: 21.00 },
            { x: -902.25, y: -1500.80, z: 4.61, h: 18.55 },
            { x: -905.26, y: -1502.28, z: 4.61, h: 20.34 },
            { x: -917.29, y: -1506.55, z: 4.61, h: 17.80 },
            { x: -920.31, y: -1507.49, z: 4.61, h: 22.65 },
            // PremiumLot2
            { x: -965.33, y: -1502.21, z: 4.60, h: -55.90 },
            { x: -967.16, y: -1499.26, z: 4.59, h: -54.89 },
            { x: -969.10, y: -1496.52, z: 4.58, h: -54.57 },
            { x: -971.08, y: -1493.48, z: 4.58, h: -52.78 },
            { x: -972.73, y: -1490.79, z: 4.58, h: -53.67 },
            { x: -977.64, y: -1483.40, z: 4.60, h: -55.05 },
            { x: -979.57, y: -1480.30, z: 4.60, h: -54.49 },
            { x: -981.66, y: -1477.62, z: 4.60, h: -54.16 },
            { x: -983.48, y: -1474.70, z: 4.60, h: -53.42 },
            { x: -985.76, y: -1472.02, z: 4.63, h: -53.83 },
            // PremiumLot3
            { x: -1038.51, y: -1427.78, z: 5.01, h: 72.90 },
            { x: -1037.60, y: -1424.19, z: 5.01, h: 74.54 },
            { x: -1036.79, y: -1420.73, z: 5.02, h: 76.23 },
            { x: -1048.52, y: -1417.25, z: 5.01, h: -104.91 },
            { x: -1049.89, y: -1420.67, z: 5.01, h: -104.91 },
            { x: -1050.77, y: -1424.17, z: 5.01, h: -103.27 },
            { x: -1051.24, y: -1428.10, z: 5.01, h: -106.51 },
            { x: -1052.17, y: -1431.56, z: 5.01, h: -106.37 },
            { x: -1060.34, y: -1429.48, z: 5.01, h: 75.36 },
            { x: -1059.19, y: -1425.85, z: 5.01, h: 74.17 },
            { x: -1058.52, y: -1422.13, z: 5.01, h: 74.08 },
            { x: -1057.05, y: -1418.73, z: 5.01, h: 76.42 },
            { x: -1056.12, y: -1415.20, z: 5.01, h: 73.69 },
            { x: -1073.25, y: -1447.00, z: 4.96, h: -103.86 },
            { x: -1073.03, y: -1442.89, z: 5.00, h: -101.67 },
            { x: -1072.81, y: -1439.21, z: 4.98, h: -104.42 },
        ],
        npc: { model: 'a_m_y_business_02', x: -1149.95, y: -1710.46, z: 9.49, heading: -56.50 }
    },
    high: {
        name: "Luxury Motorsport",
        blipColor: 1, // red
        pos: { x: -196.98, y: -1169.11, z: 23.88 },      // Strawberry
        spawnPos: { x: -184.87, y: -1174.42, z: 22.71, heading: 0.14 },
        camPos: { x: -189.23, y: -1169.27, z: 23.94 },
        camLookAt: { x: -184.87, y: -1174.42, z: 22.71 },
        testDrivePos: { x: -157.94, y: -1161.30, z: 23.40, heading: 0.44 },
        parkingSpots: [
            // LuxuryLot1
            { x: 111.44, y: -1081.10, z: 28.78, h: -19.61 },
            { x: 107.90, y: -1079.98, z: 28.78, h: -19.66 },
            { x: 104.56, y: -1078.36, z: 28.78, h: -20.55 },
            { x: 119.05, y: -1069.56, z: 28.78, h: -179.02 },
            { x: 122.45, y: -1070.08, z: 28.78, h: -177.94 },
            { x: 125.71, y: -1069.92, z: 28.78, h: 179.72 },
            { x: 128.98, y: -1069.99, z: 28.78, h: -178.78 },
            { x: 132.27, y: -1070.39, z: 28.78, h: 179.40 },
            { x: 135.59, y: -1070.11, z: 28.78, h: 178.54 },
            { x: 138.84, y: -1070.54, z: 28.78, h: -178.30 },
            // LuxuryLot2
            { x: 22.42, y: -1071.49, z: 37.74, h: 71.70 },
            { x: 22.58, y: -1068.58, z: 37.74, h: 70.94 },
            { x: 23.39, y: -1065.97, z: 37.74, h: 70.26 },
            { x: 11.56, y: -1061.72, z: 37.74, h: 70.22 },
            { x: 10.67, y: -1064.23, z: 37.74, h: 70.91 },
            { x: 9.88, y: -1066.94, z: 37.74, h: 70.15 },
            { x: 4.99, y: -1065.18, z: 37.74, h: 70.19 },
            { x: 5.85, y: -1062.50, z: 37.74, h: 69.55 },
            { x: 6.04, y: -1059.61, z: 37.74, h: 70.41 },
            { x: -6.02, y: -1104.54, z: 37.74, h: -113.15 },
            { x: -5.23, y: -1101.96, z: 37.74, h: -109.42 },
            { x: -3.90, y: -1099.53, z: 37.74, h: -110.26 },
            { x: -3.38, y: -1096.79, z: 37.74, h: -110.37 },
            { x: -2.07, y: -1094.29, z: 37.74, h: -110.20 },
            { x: -1.11, y: -1091.63, z: 37.74, h: -108.54 },
            { x: -0.11, y: -1088.92, z: 37.74, h: -111.28 },
            { x: 0.84, y: -1086.18, z: 37.74, h: -111.55 },
            { x: 2.06, y: -1083.53, z: 37.74, h: -110.52 },
            { x: -14.56, y: -1070.33, z: 37.74, h: -109.36 },
            { x: -13.64, y: -1067.72, z: 37.74, h: -108.97 },
            { x: -12.85, y: -1065.06, z: 37.74, h: -109.54 },
            { x: -11.84, y: -1062.23, z: 37.74, h: -109.42 },
            { x: -8.66, y: -1053.79, z: 37.74, h: -110.19 },
            { x: -7.72, y: -1051.24, z: 37.74, h: -108.87 },
            { x: -6.85, y: -1048.52, z: 37.74, h: -109.10 },
            { x: -6.00, y: -1045.82, z: 37.74, h: -110.04 },
            // LuxuryLot3
            { x: -333.13, y: -1009.66, z: 29.97, h: -109.02 },
            { x: -331.37, y: -1006.52, z: 29.97, h: -110.30 },
            { x: -330.52, y: -1003.92, z: 29.97, h: -110.33 },
            { x: -329.51, y: -1000.94, z: 29.97, h: -110.33 },
            { x: -328.55, y: -998.09, z: 29.97, h: -110.78 },
            { x: -327.05, y: -995.41, z: 29.97, h: -107.89 },
            { x: -321.82, y: -997.27, z: 29.97, h: -111.95 },
            { x: -321.88, y: -1000.81, z: 29.97, h: -111.92 },
            { x: -323.05, y: -1003.33, z: 29.97, h: -111.86 },
            { x: -324.08, y: -1006.34, z: 29.97, h: -110.12 },
            { x: -325.30, y: -1009.03, z: 29.97, h: -109.27 },
            { x: -327.03, y: -1011.57, z: 29.97, h: -112.73 },
            { x: -311.08, y: -1013.74, z: 29.97, h: -110.61 },
            { x: -310.88, y: -1010.84, z: 29.97, h: -111.15 },
            { x: -309.93, y: -1007.99, z: 29.97, h: -111.96 },
            { x: -308.66, y: -1005.30, z: 29.97, h: -108.91 },
            { x: -307.86, y: -1002.40, z: 29.97, h: -110.81 },
            // LuxuryLot4
            { x: -326.92, y: -956.19, z: 30.67, h: -110.81 },
            { x: -325.35, y: -952.89, z: 30.67, h: -109.81 },
            { x: -324.30, y: -949.38, z: 30.67, h: -110.32 },
            { x: -322.70, y: -946.00, z: 30.67, h: -109.81 },
            { x: -321.77, y: -942.33, z: 30.67, h: -108.70 },
            { x: -320.28, y: -939.13, z: 30.67, h: -110.39 },
            { x: -318.90, y: -935.65, z: 30.67, h: -110.26 },
            { x: -317.59, y: -932.16, z: 30.67, h: -108.95 },
            { x: -316.73, y: -928.29, z: 30.67, h: -108.67 },
            { x: -306.94, y: -947.57, z: 30.67, h: 71.35 },
            { x: -308.56, y: -950.75, z: 30.67, h: 68.27 },
            { x: -309.58, y: -954.35, z: 30.67, h: 70.63 },
            { x: -310.94, y: -957.86, z: 30.67, h: 70.29 },
            { x: -312.31, y: -961.18, z: 30.67, h: 70.14 },
            { x: -313.52, y: -964.80, z: 30.67, h: 71.82 },
        ],
        npc: { model: 'a_m_y_business_01', x: -196.98, y: -1169.11, z: 23.88, heading: -85.82 }
    }
};

module.exports = { catalog, DEALERSHIPS, DEALERSHIP_DIM_OFFSET };
