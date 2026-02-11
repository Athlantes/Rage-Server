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
            { x: -69.66, y: -1118.80, z: 26.04, heading: 160.0 },
            { x: -73.34, y: -1119.65, z: 26.04, heading: 160.0 },
            { x: -77.02, y: -1120.50, z: 26.04, heading: 160.0 },
            { x: -63.54, y: -1091.45, z: 26.42, heading: 340.0 },
            { x: -59.86, y: -1090.60, z: 26.42, heading: 340.0 },
            { x: -56.18, y: -1089.75, z: 26.42, heading: 340.0 }
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
            { x: -1155.30, y: -1762.61, z: 3.84, heading: 125.0 },
            { x: -1152.40, y: -1766.47, z: 3.84, heading: 125.0 },
            { x: -1149.50, y: -1770.33, z: 3.84, heading: 125.0 },
            { x: -1188.12, y: -1696.28, z: 4.03, heading: -55.0 },
            { x: -1191.02, y: -1692.42, z: 4.03, heading: -55.0 },
            { x: -1193.92, y: -1688.56, z: 4.03, heading: -55.0 }
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
            { x: -172.74, y: -1185.75, z: 23.02, heading: 0.0 },
            { x: -176.54, y: -1185.75, z: 23.02, heading: 0.0 },
            { x: -180.34, y: -1185.75, z: 23.02, heading: 0.0 },
            { x: -160.91, y: -1153.65, z: 24.07, heading: 180.0 },
            { x: -164.71, y: -1153.65, z: 24.07, heading: 180.0 },
            { x: -168.51, y: -1153.65, z: 24.07, heading: 180.0 }
        ],
        npc: { model: 'a_m_y_business_01', x: -196.98, y: -1169.11, z: 23.88, heading: -85.82 }
    }
};

module.exports = { catalog, DEALERSHIPS, DEALERSHIP_DIM_OFFSET };
