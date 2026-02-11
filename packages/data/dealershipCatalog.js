// packages/data/dealershipCatalog.js
// Full vehicle catalog with prices, classes, types, and tier assignments
// Tiers: low (Low-End DS), mid (Medium DS), high (High-End DS)
// Performance Grade: F(worst) -> S(best), calculated from speed+accel+brake+traction

const catalog = [
    // ══════════════════════════════════════════════════
    //  COMPACTS (Class 0)
    // ══════════════════════════════════════════════════
    { model: "blista",    name: "Blista",        type: "Compacts",  tier: "low", price: 8000,   speed: 41.9, accel: 0.230, brake: 0.6, traction: 2.0, seats: 2, grade: "F" },
    { model: "brioso",    name: "Brioso 300",    type: "Compacts",  tier: "low", price: 9500,   speed: 41.5, accel: 0.290, brake: 0.6, traction: 2.3, seats: 2, grade: "F" },
    { model: "panto",     name: "Panto",         type: "Compacts",  tier: "low", price: 5500,   speed: 40.7, accel: 0.270, brake: 0.6, traction: 2.0, seats: 2, grade: "F" },
    { model: "prairie",   name: "Prairie",       type: "Compacts",  tier: "low", price: 7000,   speed: 40.8, accel: 0.220, brake: 0.6, traction: 1.9, seats: 2, grade: "F" },
    { model: "rhapsody",  name: "Rhapsody",      type: "Compacts",  tier: "low", price: 6000,   speed: 41.3, accel: 0.230, brake: 0.6, traction: 2.0, seats: 2, grade: "F" },
    { model: "issi2",     name: "Issi",          type: "Compacts",  tier: "low", price: 10000,  speed: 41.9, accel: 0.230, brake: 0.6, traction: 2.0, seats: 2, grade: "E" },

    // ══════════════════════════════════════════════════
    //  SEDANS (Class 1)
    // ══════════════════════════════════════════════════
    { model: "asea",      name: "Asea",          type: "Sedans",    tier: "low", price: 6000,   speed: 38.4, accel: 0.200, brake: 0.4, traction: 2.0, seats: 4, grade: "F" },
    { model: "emperor",   name: "Emperor",       type: "Sedans",    tier: "low", price: 5000,   speed: 33.8, accel: 0.140, brake: 0.6, traction: 1.9, seats: 4, grade: "F" },
    { model: "fugitive",  name: "Fugitive",      type: "Sedans",    tier: "low", price: 8000,   speed: 40.4, accel: 0.200, brake: 0.9, traction: 2.5, seats: 4, grade: "E" },
    { model: "ingot",     name: "Ingot",         type: "Sedans",    tier: "low", price: 4500,   speed: 32.1, accel: 0.140, brake: 0.6, traction: 1.9, seats: 4, grade: "F" },
    { model: "intruder",  name: "Intruder",      type: "Sedans",    tier: "low", price: 7500,   speed: 39.4, accel: 0.200, brake: 0.9, traction: 2.4, seats: 4, grade: "E" },
    { model: "premier",   name: "Premier",       type: "Sedans",    tier: "low", price: 7000,   speed: 38.4, accel: 0.200, brake: 0.6, traction: 2.1, seats: 4, grade: "E" },
    { model: "primo",     name: "Primo",         type: "Sedans",    tier: "low", price: 6500,   speed: 38.4, accel: 0.200, brake: 0.9, traction: 2.4, seats: 4, grade: "E" },
    { model: "regina",    name: "Regina",        type: "Sedans",    tier: "low", price: 4000,   speed: 30.6, accel: 0.140, brake: 0.6, traction: 1.9, seats: 4, grade: "F" },
    { model: "stanier",   name: "Stanier",       type: "Sedans",    tier: "low", price: 8500,   speed: 42.7, accel: 0.200, brake: 0.9, traction: 2.5, seats: 4, grade: "E" },
    { model: "stratum",   name: "Stratum",       type: "Sedans",    tier: "low", price: 9000,   speed: 41.7, accel: 0.210, brake: 0.6, traction: 2.2, seats: 4, grade: "E" },
    { model: "surge",     name: "Surge",         type: "Sedans",    tier: "low", price: 12000,  speed: 24.2, accel: 0.100, brake: 0.6, traction: 2.1, seats: 4, grade: "F" },
    { model: "warrener",  name: "Warrener",      type: "Sedans",    tier: "low", price: 7000,   speed: 38.4, accel: 0.245, brake: 0.9, traction: 2.2, seats: 4, grade: "E" },
    { model: "washingt",  name: "Washington",    type: "Sedans",    tier: "low", price: 10000,  speed: 42.7, accel: 0.200, brake: 0.9, traction: 2.5, seats: 4, grade: "E" },
    { model: "schafter5", name: "Schafter V12",  type: "Sedans",    tier: "mid", price: 45000,  speed: 50.0, accel: 0.290, brake: 0.9, traction: 2.5, seats: 4, grade: "B" },
    { model: "cog55",     name: "Cognoscenti 55",type: "Sedans",    tier: "mid", price: 35000,  speed: 46.3, accel: 0.265, brake: 0.6, traction: 2.2, seats: 4, grade: "C" },
    { model: "superd",    name: "Super Diamond",  type: "Sedans",   tier: "mid", price: 38000,  speed: 45.2, accel: 0.260, brake: 0.6, traction: 2.1, seats: 4, grade: "C" },
    { model: "stafford",  name: "Stafford",      type: "Sedans",    tier: "mid", price: 30000,  speed: 38.1, accel: 0.200, brake: 0.5, traction: 2.0, seats: 2, grade: "D" },
    { model: "glendale",  name: "Glendale",      type: "Sedans",    tier: "low", price: 11000,  speed: 39.7, accel: 0.235, brake: 0.7, traction: 2.0, seats: 4, grade: "E" },

    // ══════════════════════════════════════════════════
    //  SUVs (Class 2)
    // ══════════════════════════════════════════════════
    { model: "fq2",       name: "FQ 2",          type: "SUVs",      tier: "low", price: 9000,   speed: 39.9, accel: 0.180, brake: 0.3, traction: 2.0, seats: 4, grade: "E" },
    { model: "habanero",  name: "Habanero",      type: "SUVs",      tier: "low", price: 9500,   speed: 39.9, accel: 0.180, brake: 0.3, traction: 2.1, seats: 4, grade: "E" },
    { model: "landstal",  name: "Landstalker",   type: "SUVs",      tier: "low", price: 10000,  speed: 36.8, accel: 0.180, brake: 0.8, traction: 2.1, seats: 4, grade: "E" },
    { model: "serrano",   name: "Serrano",       type: "SUVs",      tier: "low", price: 11000,  speed: 40.4, accel: 0.200, brake: 0.4, traction: 2.1, seats: 4, grade: "E" },
    { model: "seminole",  name: "Seminole",      type: "SUVs",      tier: "low", price: 10500,  speed: 36.8, accel: 0.180, brake: 0.8, traction: 2.0, seats: 4, grade: "E" },
    { model: "bjxl",      name: "BeeJay XL",     type: "SUVs",      tier: "low", price: 11500,  speed: 36.4, accel: 0.190, brake: 0.8, traction: 2.0, seats: 4, grade: "E" },
    { model: "granger",   name: "Granger",       type: "SUVs",      tier: "low", price: 13000,  speed: 36.4, accel: 0.190, brake: 0.8, traction: 2.1, seats: 8, grade: "E" },
    { model: "radi",      name: "Radius",        type: "SUVs",      tier: "mid", price: 22000,  speed: 39.4, accel: 0.200, brake: 0.8, traction: 2.3, seats: 4, grade: "D" },
    { model: "rocoto",    name: "Rocoto",        type: "SUVs",      tier: "mid", price: 25000,  speed: 41.3, accel: 0.190, brake: 0.3, traction: 2.1, seats: 4, grade: "D" },
    { model: "contender", name: "Contender",     type: "SUVs",      tier: "mid", price: 28000,  speed: 41.4, accel: 0.260, brake: 0.6, traction: 2.1, seats: 4, grade: "C" },
    { model: "xls",       name: "XLS",           type: "SUVs",      tier: "mid", price: 32000,  speed: 44.0, accel: 0.260, brake: 0.6, traction: 2.0, seats: 4, grade: "C" },
    { model: "baller4",   name: "Baller LE",     type: "SUVs",      tier: "mid", price: 40000,  speed: 45.0, accel: 0.270, brake: 0.6, traction: 2.0, seats: 4, grade: "C" },
    { model: "huntley",   name: "Huntley S",     type: "SUVs",      tier: "mid", price: 38000,  speed: 45.3, accel: 0.265, brake: 0.6, traction: 2.1, seats: 4, grade: "C" },
    { model: "toros",     name: "Toros",          type: "SUVs",      tier: "high", price: 85000, speed: 48.9, accel: 0.320, brake: 0.8, traction: 2.3, seats: 4, grade: "B" },

    // ══════════════════════════════════════════════════
    //  COUPES (Class 3)
    // ══════════════════════════════════════════════════
    { model: "felon2",    name: "Felon GT",      type: "Coupes",    tier: "mid", price: 28000,  speed: 43.5, accel: 0.240, brake: 0.9, traction: 2.5, seats: 2, grade: "C" },
    { model: "sentinel",  name: "Sentinel",      type: "Coupes",    tier: "mid", price: 26000,  speed: 45.5, accel: 0.210, brake: 0.9, traction: 2.5, seats: 2, grade: "C" },
    { model: "sentinel2", name: "Sentinel XS",   type: "Coupes",    tier: "mid", price: 28000,  speed: 45.5, accel: 0.210, brake: 0.9, traction: 2.5, seats: 4, grade: "C" },
    { model: "zion",      name: "Zion",          type: "Coupes",    tier: "mid", price: 30000,  speed: 46.9, accel: 0.220, brake: 0.9, traction: 2.6, seats: 2, grade: "C" },
    { model: "zion2",     name: "Zion Cabrio",   type: "Coupes",    tier: "mid", price: 32000,  speed: 46.9, accel: 0.220, brake: 0.9, traction: 2.6, seats: 2, grade: "C" },
    { model: "jackal",    name: "Jackal",        type: "Coupes",    tier: "mid", price: 33000,  speed: 46.0, accel: 0.220, brake: 0.9, traction: 2.6, seats: 4, grade: "C" },
    { model: "felon",     name: "Felon",         type: "Coupes",    tier: "mid", price: 35000,  speed: 45.8, accel: 0.240, brake: 0.9, traction: 2.5, seats: 4, grade: "C" },
    { model: "oracle",    name: "Oracle",        type: "Coupes",    tier: "mid", price: 36000,  speed: 46.2, accel: 0.270, brake: 0.9, traction: 2.3, seats: 4, grade: "C" },
    { model: "f620",      name: "F620",          type: "Coupes",    tier: "mid", price: 42000,  speed: 48.0, accel: 0.240, brake: 0.9, traction: 2.5, seats: 2, grade: "B" },
    { model: "exemplar",  name: "Exemplar",      type: "Coupes",    tier: "mid", price: 45000,  speed: 48.1, accel: 0.260, brake: 0.9, traction: 2.6, seats: 4, grade: "B" },
    { model: "windsor",   name: "Windsor",       type: "Coupes",    tier: "high", price: 75000, speed: 48.0, accel: 0.280, brake: 0.7, traction: 2.2, seats: 2, grade: "B" },
    { model: "windsor2",  name: "Windsor Drop",  type: "Coupes",    tier: "high", price: 80000, speed: 47.9, accel: 0.279, brake: 0.7, traction: 2.2, seats: 4, grade: "B" },
    { model: "cogcabri",  name: "Cognoscenti Cabrio", type: "Coupes", tier: "high", price: 70000, speed: 45.2, accel: 0.260, brake: 0.6, traction: 2.3, seats: 2, grade: "B" },

    // ══════════════════════════════════════════════════
    //  MUSCLE (Class 4)
    // ══════════════════════════════════════════════════
    { model: "picador",   name: "Picador",       type: "Muscle",    tier: "low", price: 8000,   speed: 40.8, accel: 0.220, brake: 0.8, traction: 2.0, seats: 2, grade: "E" },
    { model: "tampa",     name: "Tampa",         type: "Muscle",    tier: "low", price: 10000,  speed: 42.3, accel: 0.270, brake: 0.8, traction: 2.3, seats: 2, grade: "D" },
    { model: "blade",     name: "Blade",         type: "Muscle",    tier: "low", price: 11000,  speed: 42.2, accel: 0.324, brake: 0.8, traction: 2.2, seats: 2, grade: "D" },
    { model: "vigero",    name: "Vigero",        type: "Muscle",    tier: "low", price: 12000,  speed: 46.7, accel: 0.290, brake: 0.8, traction: 2.0, seats: 2, grade: "D" },
    { model: "sabregt",   name: "Sabre Turbo",   type: "Muscle",    tier: "low", price: 14000,  speed: 46.7, accel: 0.280, brake: 0.8, traction: 2.3, seats: 2, grade: "D" },
    { model: "phoenix",   name: "Phoenix",       type: "Muscle",    tier: "low", price: 15000,  speed: 47.3, accel: 0.280, brake: 0.8, traction: 2.1, seats: 2, grade: "D" },
    { model: "gauntlet",  name: "Gauntlet",      type: "Muscle",    tier: "mid", price: 25000,  speed: 47.0, accel: 0.300, brake: 0.9, traction: 2.5, seats: 2, grade: "C" },
    { model: "dominato",  name: "Dominator",     type: "Muscle",    tier: "mid", price: 28000,  speed: 48.3, accel: 0.290, brake: 0.8, traction: 2.3, seats: 2, grade: "C" },
    { model: "ruiner",    name: "Ruiner",        type: "Muscle",    tier: "mid", price: 26000,  speed: 48.3, accel: 0.280, brake: 0.8, traction: 2.2, seats: 2, grade: "C" },
    { model: "dukes",     name: "Dukes",         type: "Muscle",    tier: "mid", price: 30000,  speed: 47.8, accel: 0.320, brake: 0.8, traction: 2.3, seats: 2, grade: "C" },
    { model: "tulip",     name: "Tulip",         type: "Muscle",    tier: "mid", price: 32000,  speed: 48.9, accel: 0.320, brake: 0.5, traction: 2.3, seats: 4, grade: "C" },
    { model: "ellie",     name: "Ellie",         type: "Muscle",    tier: "mid", price: 35000,  speed: 45.8, accel: 0.325, brake: 0.5, traction: 2.5, seats: 2, grade: "C" },
    { model: "clique",    name: "Clique",        type: "Muscle",    tier: "mid", price: 36000,  speed: 46.0, accel: 0.300, brake: 0.8, traction: 2.4, seats: 2, grade: "C" },
    { model: "gauntlet4", name: "Gauntlet Classic", type: "Muscle", tier: "mid", price: 42000,  speed: 48.7, accel: 0.360, brake: 0.9, traction: 2.4, seats: 2, grade: "B" },
    { model: "dominato2", name: "Dominator GTX", type: "Muscle",    tier: "high", price: 65000, speed: 49.0, accel: 0.310, brake: 0.9, traction: 2.3, seats: 2, grade: "B" },
    { model: "yosemite",  name: "Yosemite",      type: "Muscle",    tier: "low", price: 13000,  speed: 41.6, accel: 0.285, brake: 0.8, traction: 2.4, seats: 2, grade: "D" },
    { model: "deviant",   name: "Deviant",       type: "Muscle",    tier: "mid", price: 34000,  speed: 42.5, accel: 0.290, brake: 0.5, traction: 2.3, seats: 2, grade: "C" },

    // ══════════════════════════════════════════════════
    //  SPORTS CLASSICS (Class 5)
    // ══════════════════════════════════════════════════
    { model: "peyote",    name: "Peyote",        type: "Sports Classics", tier: "low", price: 9000,  speed: 36.9, accel: 0.160, brake: 0.3, traction: 1.9, seats: 2, grade: "F" },
    { model: "tornado",   name: "Tornado",       type: "Sports Classics", tier: "low", price: 8000,  speed: 36.9, accel: 0.160, brake: 0.3, traction: 1.8, seats: 2, grade: "F" },
    { model: "manana",    name: "Manana",        type: "Sports Classics", tier: "low", price: 7500,  speed: 36.9, accel: 0.160, brake: 0.3, traction: 1.9, seats: 2, grade: "F" },
    { model: "nebula",    name: "Nebula Turbo",  type: "Sports Classics", tier: "low", price: 12000, speed: 37.9, accel: 0.240, brake: 0.5, traction: 1.9, seats: 2, grade: "E" },
    { model: "cheburek",  name: "Cheburek",      type: "Sports Classics", tier: "low", price: 11000, speed: 44.6, accel: 0.265, brake: 0.8, traction: 2.3, seats: 2, grade: "D" },
    { model: "retinue",   name: "Retinue",       type: "Sports Classics", tier: "low", price: 14000, speed: 42.7, accel: 0.228, brake: 0.7, traction: 2.0, seats: 2, grade: "D" },
    { model: "z190",      name: "190z",          type: "Sports Classics", tier: "mid", price: 32000, speed: 43.9, accel: 0.270, brake: 0.9, traction: 2.3, seats: 2, grade: "C" },
    { model: "savestra",  name: "Savestra",      type: "Sports Classics", tier: "mid", price: 30000, speed: 43.8, accel: 0.237, brake: 0.7, traction: 2.0, seats: 2, grade: "D" },
    { model: "gt500",     name: "GT500",         type: "Sports Classics", tier: "mid", price: 38000, speed: 45.9, accel: 0.290, brake: 0.8, traction: 2.2, seats: 2, grade: "C" },
    { model: "stinger",   name: "Stinger",       type: "Sports Classics", tier: "mid", price: 40000, speed: 45.2, accel: 0.260, brake: 0.6, traction: 2.1, seats: 2, grade: "C" },
    { model: "feltzer3",  name: "Stirling GT",   type: "Sports Classics", tier: "mid", price: 45000, speed: 46.0, accel: 0.300, brake: 0.8, traction: 2.4, seats: 2, grade: "B" },
    { model: "coquette2", name: "Coquette Classic", type: "Sports Classics", tier: "mid", price: 48000, speed: 49.5, accel: 0.340, brake: 0.5, traction: 2.3, seats: 2, grade: "B" },
    { model: "jb700",     name: "JB 700",        type: "Sports Classics", tier: "high", price: 75000, speed: 50.0, accel: 0.260, brake: 0.6, traction: 2.1, seats: 2, grade: "B" },
    { model: "monroe",    name: "Monroe",        type: "Sports Classics", tier: "high", price: 78000, speed: 50.0, accel: 0.280, brake: 0.7, traction: 2.2, seats: 2, grade: "B" },
    { model: "ztype",     name: "Z-Type",        type: "Sports Classics", tier: "high", price: 120000, speed: 51.3, accel: 0.300, brake: 0.7, traction: 2.3, seats: 2, grade: "A" },
    { model: "cheetah2",  name: "Cheetah Classic", type: "Sports Classics", tier: "high", price: 95000, speed: 49.9, accel: 0.300, brake: 0.8, traction: 2.6, seats: 2, grade: "A" },
    { model: "turismo2",  name: "Turismo Classic", type: "Sports Classics", tier: "high", price: 90000, speed: 49.5, accel: 0.340, brake: 0.5, traction: 2.6, seats: 2, grade: "A" },

    // ══════════════════════════════════════════════════
    //  SPORTS (Class 6)
    // ══════════════════════════════════════════════════
    { model: "futo",      name: "Futo",          type: "Sports",    tier: "low", price: 12000,  speed: 45.0, accel: 0.290, brake: 0.5, traction: 2.0, seats: 2, grade: "D" },
    { model: "penumbra",  name: "Penumbra",      type: "Sports",    tier: "low", price: 14000,  speed: 40.8, accel: 0.220, brake: 0.8, traction: 2.3, seats: 2, grade: "D" },
    { model: "sultan",    name: "Sultan",        type: "Sports",    tier: "low", price: 16000,  speed: 45.2, accel: 0.260, brake: 0.4, traction: 2.4, seats: 4, grade: "D" },
    { model: "buffalo",   name: "Buffalo",       type: "Sports",    tier: "low", price: 15000,  speed: 45.2, accel: 0.270, brake: 0.9, traction: 2.5, seats: 4, grade: "D" },
    { model: "kuruma",    name: "Kuruma",        type: "Sports",    tier: "mid", price: 28000,  speed: 46.9, accel: 0.310, brake: 0.5, traction: 2.5, seats: 4, grade: "C" },
    { model: "jester",    name: "Jester",        type: "Sports",    tier: "mid", price: 35000,  speed: 46.0, accel: 0.300, brake: 0.9, traction: 2.5, seats: 2, grade: "C" },
    { model: "elegy2",    name: "Elegy RH8",     type: "Sports",    tier: "mid", price: 38000,  speed: 48.7, accel: 0.330, brake: 0.5, traction: 2.7, seats: 2, grade: "B" },
    { model: "banshee",   name: "Banshee",       type: "Sports",    tier: "mid", price: 40000,  speed: 47.5, accel: 0.340, brake: 1.0, traction: 2.4, seats: 2, grade: "B" },
    { model: "comet2",    name: "Comet",         type: "Sports",    tier: "mid", price: 42000,  speed: 50.2, accel: 0.340, brake: 0.8, traction: 2.6, seats: 2, grade: "B" },
    { model: "feltzer",   name: "Feltzer",       type: "Sports",    tier: "mid", price: 44000,  speed: 49.5, accel: 0.340, brake: 0.8, traction: 2.6, seats: 2, grade: "B" },
    { model: "surano",    name: "Surano",        type: "Sports",    tier: "mid", price: 48000,  speed: 50.4, accel: 0.340, brake: 1.0, traction: 2.5, seats: 2, grade: "B" },
    { model: "rapidgt",   name: "Rapid GT",      type: "Sports",    tier: "mid", price: 46000,  speed: 50.1, accel: 0.360, brake: 1.0, traction: 2.5, seats: 2, grade: "B" },
    { model: "coquette",  name: "Coquette",      type: "Sports",    tier: "mid", price: 50000,  speed: 50.5, accel: 0.330, brake: 0.8, traction: 2.5, seats: 2, grade: "B" },
    { model: "carboniz",  name: "Carbonizzare",  type: "Sports",    tier: "high", price: 68000, speed: 48.3, accel: 0.350, brake: 0.8, traction: 2.4, seats: 2, grade: "B" },
    { model: "massacro",  name: "Massacro",      type: "Sports",    tier: "high", price: 72000, speed: 50.5, accel: 0.364, brake: 0.9, traction: 2.4, seats: 2, grade: "A" },
    { model: "seven70",   name: "Seven-70",      type: "Sports",    tier: "high", price: 78000, speed: 50.9, accel: 0.335, brake: 1.0, traction: 2.6, seats: 2, grade: "A" },
    { model: "schlagen",  name: "Schlagen GT",   type: "Sports",    tier: "high", price: 85000, speed: 52.1, accel: 0.370, brake: 0.8, traction: 2.5, seats: 2, grade: "A" },
    { model: "italigto",  name: "Itali GTO",     type: "Sports",    tier: "high", price: 95000, speed: 52.4, accel: 0.400, brake: 1.1, traction: 2.6, seats: 2, grade: "S" },
    { model: "pariah",    name: "Pariah",        type: "Sports",    tier: "high", price: 70000, speed: 48.7, accel: 0.321, brake: 1.0, traction: 2.6, seats: 2, grade: "A" },
    { model: "jugular",   name: "Jugular",       type: "Sports",    tier: "high", price: 75000, speed: 48.6, accel: 0.378, brake: 1.1, traction: 2.6, seats: 4, grade: "A" },
    { model: "neo",       name: "Neo",           type: "Sports",    tier: "high", price: 88000, speed: 51.2, accel: 0.387, brake: 1.2, traction: 2.6, seats: 2, grade: "S" },

    // ══════════════════════════════════════════════════
    //  SUPER (Class 7)
    // ══════════════════════════════════════════════════
    { model: "vacca",     name: "Vacca",         type: "Super",     tier: "high", price: 120000, speed: 50.3, accel: 0.300, brake: 1.0, traction: 2.6, seats: 2, grade: "A" },
    { model: "bullet",    name: "Bullet",        type: "Super",     tier: "high", price: 125000, speed: 49.8, accel: 0.330, brake: 0.8, traction: 2.5, seats: 2, grade: "A" },
    { model: "cheetah",   name: "Cheetah",       type: "Super",     tier: "high", price: 135000, speed: 50.0, accel: 0.320, brake: 0.8, traction: 2.6, seats: 2, grade: "A" },
    { model: "entityxf",  name: "Entity XF",     type: "Super",     tier: "high", price: 140000, speed: 50.9, accel: 0.330, brake: 0.9, traction: 2.8, seats: 2, grade: "A" },
    { model: "zentorno",  name: "Zentorno",      type: "Super",     tier: "high", price: 150000, speed: 49.7, accel: 0.354, brake: 1.0, traction: 2.6, seats: 2, grade: "A" },
    { model: "turismor",  name: "Turismo R",     type: "Super",     tier: "high", price: 155000, speed: 51.1, accel: 0.353, brake: 1.2, traction: 2.6, seats: 2, grade: "S" },
    { model: "t20",       name: "T20",           type: "Super",     tier: "high", price: 165000, speed: 49.7, accel: 0.365, brake: 1.1, traction: 2.7, seats: 2, grade: "S" },
    { model: "osiris",    name: "Osiris",        type: "Super",     tier: "high", price: 160000, speed: 49.7, accel: 0.360, brake: 1.1, traction: 2.7, seats: 2, grade: "S" },
    { model: "adder",     name: "Adder",         type: "Super",     tier: "high", price: 180000, speed: 51.8, accel: 0.320, brake: 1.0, traction: 2.5, seats: 2, grade: "A" },
    { model: "nero2",     name: "Nero Custom",   type: "Super",     tier: "high", price: 195000, speed: 52.9, accel: 0.340, brake: 1.1, traction: 2.7, seats: 2, grade: "S" },
    { model: "vagner",    name: "Vagner",        type: "Super",     tier: "high", price: 210000, speed: 52.6, accel: 0.370, brake: 1.1, traction: 2.8, seats: 2, grade: "S" },
    { model: "deveste",   name: "Deveste Eight",  type: "Super",    tier: "high", price: 225000, speed: 52.7, accel: 0.420, brake: 1.0, traction: 2.7, seats: 2, grade: "S" },
    { model: "krieger",   name: "Krieger",       type: "Super",     tier: "high", price: 240000, speed: 52.6, accel: 0.374, brake: 1.1, traction: 2.8, seats: 2, grade: "S" },
    { model: "emerus",    name: "Emerus",        type: "Super",     tier: "high", price: 235000, speed: 50.9, accel: 0.378, brake: 1.2, traction: 2.8, seats: 2, grade: "S" },
    { model: "taipan",    name: "Taipan",        type: "Super",     tier: "high", price: 250000, speed: 53.9, accel: 0.357, brake: 1.0, traction: 2.6, seats: 2, grade: "S" },
    { model: "entity2",   name: "Entity XXR",    type: "Super",     tier: "high", price: 260000, speed: 53.7, accel: 0.355, brake: 1.0, traction: 2.8, seats: 2, grade: "S" },
    { model: "thrax",     name: "Thrax",         type: "Super",     tier: "high", price: 200000, speed: 50.2, accel: 0.340, brake: 1.2, traction: 2.7, seats: 2, grade: "S" },

    // ══════════════════════════════════════════════════
    //  MOTORCYCLES (Class 8)
    // ══════════════════════════════════════════════════
    { model: "faggio",    name: "Faggio",        type: "Motorcycles", tier: "low", price: 2500,  speed: 23.5, accel: 0.100, brake: 0.4, traction: 1.6, seats: 2, grade: "F" },
    { model: "pcj",       name: "PCJ-600",       type: "Motorcycles", tier: "low", price: 8000,  speed: 39.8, accel: 0.260, brake: 1.3, traction: 2.0, seats: 2, grade: "D" },
    { model: "vader",     name: "Vader",         type: "Motorcycles", tier: "low", price: 9000,  speed: 42.3, accel: 0.270, brake: 1.1, traction: 1.9, seats: 2, grade: "D" },
    { model: "enduro",    name: "Enduro",        type: "Motorcycles", tier: "low", price: 7000,  speed: 39.7, accel: 0.300, brake: 1.1, traction: 2.2, seats: 2, grade: "D" },
    { model: "sanchez01", name: "Sanchez",       type: "Motorcycles", tier: "low", price: 6500,  speed: 39.3, accel: 0.280, brake: 1.1, traction: 2.1, seats: 2, grade: "D" },
    { model: "bati",      name: "Bati 801",      type: "Motorcycles", tier: "mid", price: 18000, speed: 49.3, accel: 0.300, brake: 1.4, traction: 2.3, seats: 2, grade: "B" },
    { model: "double",    name: "Double T",      type: "Motorcycles", tier: "mid", price: 20000, speed: 47.9, accel: 0.310, brake: 1.4, traction: 2.2, seats: 2, grade: "B" },
    { model: "akuma",     name: "Akuma",         type: "Motorcycles", tier: "mid", price: 22000, speed: 48.3, accel: 0.400, brake: 1.2, traction: 2.1, seats: 2, grade: "B" },
    { model: "carbon",    name: "Carbon RS",     type: "Motorcycles", tier: "mid", price: 25000, speed: 47.0, accel: 0.300, brake: 1.3, traction: 2.1, seats: 2, grade: "B" },
    { model: "bf400",     name: "BF400",         type: "Motorcycles", tier: "mid", price: 15000, speed: 44.1, accel: 0.290, brake: 1.1, traction: 2.1, seats: 2, grade: "C" },
    { model: "hakuchou",  name: "Hakuchou",      type: "Motorcycles", tier: "high", price: 55000, speed: 49.5, accel: 0.315, brake: 1.4, traction: 2.3, seats: 2, grade: "A" },
    { model: "hakuchou2", name: "Hakuchou Drag", type: "Motorcycles", tier: "high", price: 75000, speed: 52.0, accel: 0.425, brake: 1.4, traction: 2.9, seats: 2, grade: "S" },
    { model: "shotaro",   name: "Shotaro",       type: "Motorcycles", tier: "high", price: 85000, speed: 51.2, accel: 0.400, brake: 1.4, traction: 2.7, seats: 1, grade: "S" },

    // ══════════════════════════════════════════════════
    //  OFF-ROAD (Class 9)
    // ══════════════════════════════════════════════════
    { model: "bodhi2",    name: "Bodhi",         type: "Off-Road",  tier: "low", price: 7000,   speed: 35.5, accel: 0.215, brake: 1.1, traction: 2.3, seats: 4, grade: "E" },
    { model: "rancherx",  name: "Rancher XL",    type: "Off-Road",  tier: "low", price: 8000,   speed: 35.2, accel: 0.180, brake: 0.8, traction: 1.9, seats: 4, grade: "E" },
    { model: "bfinject",  name: "BF Injection",  type: "Off-Road",  tier: "low", price: 10000,  speed: 40.8, accel: 0.220, brake: 0.6, traction: 1.9, seats: 2, grade: "D" },
    { model: "rebel02",   name: "Rebel",         type: "Off-Road",  tier: "low", price: 9000,   speed: 38.4, accel: 0.200, brake: 0.6, traction: 2.0, seats: 2, grade: "E" },
    { model: "sandking",  name: "Sandking XL",   type: "Off-Road",  tier: "low", price: 14000,  speed: 38.4, accel: 0.200, brake: 0.6, traction: 2.0, seats: 4, grade: "E" },
    { model: "kamacho",   name: "Kamacho",       type: "Off-Road",  tier: "mid", price: 28000,  speed: 40.9, accel: 0.255, brake: 0.3, traction: 2.0, seats: 2, grade: "D" },
    { model: "riata",     name: "Riata",         type: "Off-Road",  tier: "mid", price: 25000,  speed: 40.4, accel: 0.250, brake: 0.3, traction: 2.0, seats: 2, grade: "D" },
    { model: "freecrawler", name: "Freecrawler", type: "Off-Road",  tier: "mid", price: 30000,  speed: 36.6, accel: 0.240, brake: 0.3, traction: 2.0, seats: 4, grade: "D" },
    { model: "nightshark", name: "Nightshark",   type: "Off-Road",  tier: "mid", price: 45000,  speed: 36.8, accel: 0.270, brake: 0.8, traction: 2.1, seats: 4, grade: "C" },
    { model: "trophy",    name: "Trophy Truck",  type: "Off-Road",  tier: "mid", price: 35000,  speed: 43.4, accel: 0.339, brake: 0.3, traction: 2.5, seats: 2, grade: "C" },
    { model: "brawler",   name: "Brawler",       type: "Off-Road",  tier: "high", price: 60000, speed: 46.7, accel: 0.280, brake: 0.9, traction: 1.9, seats: 2, grade: "B" },
    { model: "bifta",     name: "Bifta",         type: "Off-Road",  tier: "mid", price: 20000,  speed: 45.2, accel: 0.260, brake: 0.7, traction: 2.0, seats: 2, grade: "C" },
];

// Dealership locations
const DEALERSHIPS = {
    low: {
        name: "Budget Auto",
        blipColor: 2, // green
        pos: { x: -31.07, y: -1106.57, z: 26.42 },       // Pillbox Hill
        spawnPos: { x: -44.43, y: -1101.36, z: 26.42, heading: 70.0 },
        camPos: { x: -47.0, y: -1095.0, z: 27.5 },
        camLookAt: { x: -44.43, y: -1101.36, z: 27.0 },
        npc: { model: 'mp_m_waremech_01', x: -31.07, y: -1106.57, z: 26.42, h: -16.31 }
    },
    mid: {
        name: "Premium Motors",
        blipColor: 3, // blue
        pos: { x: -787.81, y: -222.55, z: 37.08 },        // Rockford Hills
        spawnPos: { x: -793.28, y: -225.49, z: 37.08, heading: 120.0 },
        camPos: { x: -789.0, y: -219.0, z: 38.5 },
        camLookAt: { x: -793.28, y: -225.49, z: 37.5 },
        npc: { model: 'a_m_y_business_02', x: -787.81, y: -222.55, z: 36.08, heading: 70.0 }
    },
    high: {
        name: "Legendary Motorsport",
        blipColor: 1, // red
        pos: { x: -1260.00, y: -357.97, z: 36.96 },      // Morningwood
        spawnPos: { x: -1252.25, y: -361.11, z: 36.96, heading: 210.0 },
        camPos: { x: -1255.0, y: -355.0, z: 38.5 },
        camLookAt: { x: -1252.25, y: -361.11, z: 37.5 },
        npc: { model: 'a_m_y_business_01', x: -1260.00, y: -357.97, z: 35.96, heading: 25.0 }
    }
};

module.exports = { catalog, DEALERSHIPS };
