// packages/data/tuningConfig.js
// Full tuning configuration — performance upgrades, visual mods, shop locations

// ─── Part Rarities ───
const PART_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// Item IDs matching items.js
const PART_ITEMS = {
    common:    'car_part_common',
    uncommon:  'car_part_uncommon',
    rare:      'car_part_rare',
    epic:      'car_part_epic',
    legendary: 'car_part_legendary'
};

// ─── Performance Mod Types (GTA modType mapping) ───
// Stage 0 = stock (-1), Stage 1 = index 0, Stage 2 = index 1, etc.
const PERFORMANCE_MODS = {
    engine: {
        name: "Engine",
        icon: "🔧",
        modType: 11,       // GTA mod type
        maxStage: 4,       // Up to EMS Level 4
        description: [
            "Stock Engine",
            "EMS Upgrade Lv.1 — +5% top speed",
            "EMS Upgrade Lv.2 — +10% top speed",
            "EMS Upgrade Lv.3 — +15% top speed",
            "EMS Upgrade Lv.4 — +20% top speed"
        ]
    },
    transmission: {
        name: "Transmission",
        icon: "⚙️",
        modType: 13,
        maxStage: 3,
        description: [
            "Stock Transmission",
            "Street Transmission — Smoother shifts",
            "Sport Transmission — Faster shifts",
            "Race Transmission — Lightning shifts"
        ]
    },
    brakes: {
        name: "Brakes",
        icon: "🛑",
        modType: 12,
        maxStage: 3,
        description: [
            "Stock Brakes",
            "Street Brakes — Better stopping",
            "Sport Brakes — Much better stopping",
            "Race Brakes — Maximum stopping power"
        ]
    },
    suspension: {
        name: "Suspension",
        icon: "🔩",
        modType: 15,
        maxStage: 4,
        description: [
            "Stock Suspension",
            "Lowered Suspension — Better cornering",
            "Street Suspension — Improved handling",
            "Sport Suspension — Tight handling",
            "Race Suspension — Track-ready handling"
        ]
    },
    turbo: {
        name: "Turbo",
        icon: "🌀",
        modType: 18,
        maxStage: 1,       // On or off
        description: [
            "No Turbo",
            "Turbo Installed — +15% acceleration"
        ]
    }
};

// ─── Performance Upgrade Requirements ───
// [grade][modKey][stage] = { money, partType, partAmount }
const PERF_REQUIREMENTS = {
    // ── F CLASS (Cheapest, mostly common/uncommon) ──
    F: {
        engine: [
            { stage: 1, money: 1500,  partType: 'common',   partAmount: 3 },
            { stage: 2, money: 3000,  partType: 'uncommon', partAmount: 4 },
            { stage: 3, money: 6000,  partType: 'rare',     partAmount: 3 },
            { stage: 4, money: 12000, partType: 'rare',     partAmount: 5 }
        ],
        transmission: [
            { stage: 1, money: 1200,  partType: 'common',   partAmount: 3 },
            { stage: 2, money: 2500,  partType: 'uncommon', partAmount: 3 },
            { stage: 3, money: 5000,  partType: 'rare',     partAmount: 2 }
        ],
        brakes: [
            { stage: 1, money: 1000,  partType: 'common',   partAmount: 2 },
            { stage: 2, money: 2000,  partType: 'uncommon', partAmount: 3 },
            { stage: 3, money: 4000,  partType: 'rare',     partAmount: 2 }
        ],
        suspension: [
            { stage: 1, money: 800,   partType: 'common',   partAmount: 2 },
            { stage: 2, money: 1800,  partType: 'common',   partAmount: 4 },
            { stage: 3, money: 3500,  partType: 'uncommon', partAmount: 3 },
            { stage: 4, money: 6000,  partType: 'rare',     partAmount: 2 }
        ],
        turbo: [
            { stage: 1, money: 3000,  partType: 'uncommon', partAmount: 5 }
        ]
    },

    // ── E CLASS ──
    E: {
        engine: [
            { stage: 1, money: 2000,  partType: 'common',   partAmount: 4 },
            { stage: 2, money: 4500,  partType: 'uncommon', partAmount: 5 },
            { stage: 3, money: 8000,  partType: 'rare',     partAmount: 4 },
            { stage: 4, money: 15000, partType: 'rare',     partAmount: 6 }
        ],
        transmission: [
            { stage: 1, money: 1500,  partType: 'common',   partAmount: 4 },
            { stage: 2, money: 3500,  partType: 'uncommon', partAmount: 4 },
            { stage: 3, money: 7000,  partType: 'rare',     partAmount: 3 }
        ],
        brakes: [
            { stage: 1, money: 1200,  partType: 'common',   partAmount: 3 },
            { stage: 2, money: 2800,  partType: 'uncommon', partAmount: 3 },
            { stage: 3, money: 5500,  partType: 'rare',     partAmount: 3 }
        ],
        suspension: [
            { stage: 1, money: 1000,  partType: 'common',   partAmount: 3 },
            { stage: 2, money: 2500,  partType: 'uncommon', partAmount: 3 },
            { stage: 3, money: 5000,  partType: 'uncommon', partAmount: 5 },
            { stage: 4, money: 8000,  partType: 'rare',     partAmount: 3 }
        ],
        turbo: [
            { stage: 1, money: 5000,  partType: 'uncommon', partAmount: 6 }
        ]
    },

    // ── D CLASS ──
    D: {
        engine: [
            { stage: 1, money: 3000,  partType: 'common',   partAmount: 5 },
            { stage: 2, money: 6000,  partType: 'uncommon', partAmount: 6 },
            { stage: 3, money: 10000, partType: 'rare',     partAmount: 5 },
            { stage: 4, money: 20000, partType: 'epic',     partAmount: 3 }
        ],
        transmission: [
            { stage: 1, money: 2000,  partType: 'common',   partAmount: 5 },
            { stage: 2, money: 5000,  partType: 'uncommon', partAmount: 5 },
            { stage: 3, money: 9000,  partType: 'rare',     partAmount: 4 }
        ],
        brakes: [
            { stage: 1, money: 1800,  partType: 'uncommon', partAmount: 3 },
            { stage: 2, money: 4000,  partType: 'uncommon', partAmount: 5 },
            { stage: 3, money: 7000,  partType: 'rare',     partAmount: 4 }
        ],
        suspension: [
            { stage: 1, money: 1500,  partType: 'common',   partAmount: 4 },
            { stage: 2, money: 3000,  partType: 'uncommon', partAmount: 4 },
            { stage: 3, money: 6000,  partType: 'rare',     partAmount: 3 },
            { stage: 4, money: 10000, partType: 'rare',     partAmount: 5 }
        ],
        turbo: [
            { stage: 1, money: 8000,  partType: 'rare',     partAmount: 5 }
        ]
    },

    // ── C CLASS ──
    C: {
        engine: [
            { stage: 1, money: 4000,  partType: 'uncommon', partAmount: 5 },
            { stage: 2, money: 8000,  partType: 'rare',     partAmount: 4 },
            { stage: 3, money: 14000, partType: 'epic',     partAmount: 3 },
            { stage: 4, money: 25000, partType: 'epic',     partAmount: 5 }
        ],
        transmission: [
            { stage: 1, money: 3000,  partType: 'uncommon', partAmount: 4 },
            { stage: 2, money: 6500,  partType: 'rare',     partAmount: 3 },
            { stage: 3, money: 12000, partType: 'epic',     partAmount: 3 }
        ],
        brakes: [
            { stage: 1, money: 2500,  partType: 'uncommon', partAmount: 4 },
            { stage: 2, money: 5000,  partType: 'rare',     partAmount: 3 },
            { stage: 3, money: 9000,  partType: 'epic',     partAmount: 2 }
        ],
        suspension: [
            { stage: 1, money: 2000,  partType: 'uncommon', partAmount: 3 },
            { stage: 2, money: 4500,  partType: 'uncommon', partAmount: 5 },
            { stage: 3, money: 8000,  partType: 'rare',     partAmount: 4 },
            { stage: 4, money: 14000, partType: 'epic',     partAmount: 3 }
        ],
        turbo: [
            { stage: 1, money: 12000, partType: 'rare',     partAmount: 5 }
        ]
    },

    // ── B CLASS ──
    B: {
        engine: [
            { stage: 1, money: 6000,  partType: 'uncommon', partAmount: 6 },
            { stage: 2, money: 12000, partType: 'rare',     partAmount: 5 },
            { stage: 3, money: 18000, partType: 'epic',     partAmount: 5 },
            { stage: 4, money: 35000, partType: 'legendary', partAmount: 3 }
        ],
        transmission: [
            { stage: 1, money: 4500,  partType: 'uncommon', partAmount: 5 },
            { stage: 2, money: 9000,  partType: 'rare',     partAmount: 4 },
            { stage: 3, money: 16000, partType: 'epic',     partAmount: 4 }
        ],
        brakes: [
            { stage: 1, money: 3500,  partType: 'rare',     partAmount: 3 },
            { stage: 2, money: 7000,  partType: 'rare',     partAmount: 5 },
            { stage: 3, money: 12000, partType: 'epic',     partAmount: 3 }
        ],
        suspension: [
            { stage: 1, money: 3000,  partType: 'uncommon', partAmount: 5 },
            { stage: 2, money: 6000,  partType: 'rare',     partAmount: 4 },
            { stage: 3, money: 10000, partType: 'epic',     partAmount: 3 },
            { stage: 4, money: 18000, partType: 'epic',     partAmount: 5 }
        ],
        turbo: [
            { stage: 1, money: 18000, partType: 'epic',     partAmount: 5 }
        ]
    },

    // ── A CLASS ──
    A: {
        engine: [
            { stage: 1, money: 8000,   partType: 'rare',      partAmount: 5 },
            { stage: 2, money: 15000,  partType: 'epic',      partAmount: 4 },
            { stage: 3, money: 25000,  partType: 'epic',      partAmount: 6 },
            { stage: 4, money: 45000,  partType: 'legendary', partAmount: 5 }
        ],
        transmission: [
            { stage: 1, money: 6000,   partType: 'rare',      partAmount: 4 },
            { stage: 2, money: 12000,  partType: 'epic',      partAmount: 3 },
            { stage: 3, money: 22000,  partType: 'legendary', partAmount: 3 }
        ],
        brakes: [
            { stage: 1, money: 5000,   partType: 'rare',      partAmount: 4 },
            { stage: 2, money: 10000,  partType: 'epic',      partAmount: 3 },
            { stage: 3, money: 18000,  partType: 'legendary', partAmount: 2 }
        ],
        suspension: [
            { stage: 1, money: 4000,   partType: 'rare',      partAmount: 3 },
            { stage: 2, money: 8000,   partType: 'rare',      partAmount: 5 },
            { stage: 3, money: 14000,  partType: 'epic',      partAmount: 4 },
            { stage: 4, money: 25000,  partType: 'legendary', partAmount: 3 }
        ],
        turbo: [
            { stage: 1, money: 25000,  partType: 'epic',      partAmount: 6 }
        ]
    },

    // ── S CLASS (Most expensive, epic/legendary) ──
    S: {
        engine: [
            { stage: 1, money: 12000,  partType: 'rare',      partAmount: 6 },
            { stage: 2, money: 20000,  partType: 'epic',      partAmount: 5 },
            { stage: 3, money: 35000,  partType: 'epic',      partAmount: 8 },
            { stage: 4, money: 60000,  partType: 'legendary', partAmount: 8 }
        ],
        transmission: [
            { stage: 1, money: 8000,   partType: 'rare',      partAmount: 5 },
            { stage: 2, money: 16000,  partType: 'epic',      partAmount: 5 },
            { stage: 3, money: 30000,  partType: 'legendary', partAmount: 5 }
        ],
        brakes: [
            { stage: 1, money: 6000,   partType: 'rare',      partAmount: 5 },
            { stage: 2, money: 12000,  partType: 'epic',      partAmount: 5 },
            { stage: 3, money: 22000,  partType: 'legendary', partAmount: 4 }
        ],
        suspension: [
            { stage: 1, money: 5000,   partType: 'rare',      partAmount: 5 },
            { stage: 2, money: 10000,  partType: 'epic',      partAmount: 4 },
            { stage: 3, money: 18000,  partType: 'epic',      partAmount: 6 },
            { stage: 4, money: 32000,  partType: 'legendary', partAmount: 5 }
        ],
        turbo: [
            { stage: 1, money: 40000,  partType: 'legendary', partAmount: 6 }
        ]
    }
};

// ─── Visual Mod Types ───
const VISUAL_MODS = {
    spoiler:     { name: "Spoiler",       modType: 0,  icon: "🏁" },
    fbumper:     { name: "Front Bumper",  modType: 1,  icon: "🔲" },
    rbumper:     { name: "Rear Bumper",   modType: 2,  icon: "🔳" },
    skirts:      { name: "Side Skirts",   modType: 3,  icon: "▬" },
    exhaust:     { name: "Exhaust",       modType: 4,  icon: "💨" },
    frame:       { name: "Roll Cage",     modType: 5,  icon: "🏗️" },
    grille:      { name: "Grille",        modType: 6,  icon: "⬛" },
    hood:        { name: "Hood",          modType: 7,  icon: "🔩" },
    fender:      { name: "Fender",        modType: 8,  icon: "🛡️" },
    rfender:     { name: "Right Fender",  modType: 9,  icon: "🛡️" },
    roof:        { name: "Roof",          modType: 10, icon: "🏠" },
    livery:      { name: "Livery",        modType: 48, icon: "🎨" }
};

// ─── Visual Mod Pricing per Grade ───
const VISUAL_PRICES = {
    F: { base: 500,   perMod: 200  },
    E: { base: 800,   perMod: 300  },
    D: { base: 1200,  perMod: 500  },
    C: { base: 2000,  perMod: 800  },
    B: { base: 3500,  perMod: 1200 },
    A: { base: 5000,  perMod: 1800 },
    S: { base: 8000,  perMod: 2500 }
};

// Price for a visual mod = base + (modIndex * perMod)
// So higher-index (fancier) options cost more

// ─── Tuning Shop Locations (markers instead of NPCs) ───
const TUNING_SHOPS = [
    {
        id: 'burton',
        name: "LS Customs — Burton",
        pos: { x: -337.13, y: -136.96, z: 39.01 },
        marker: { type: 1, color: [0, 168, 255, 180], scale: 1.5 }
    },
    {
        id: 'lsia',
        name: "LS Customs — LSIA",
        pos: { x: -1155.46, y: -2007.16, z: 13.18 },
        marker: { type: 1, color: [0, 168, 255, 180], scale: 1.5 }
    },
    {
        id: 'harmony',
        name: "Beeker's Garage — Harmony",
        pos: { x: 731.58, y: -1088.77, z: 22.17 },
        marker: { type: 1, color: [0, 168, 255, 180], scale: 1.5 }
    }
];

// ─── Paint Types (GTA finish types) ───
const PAINT_TYPES = [
    { id: 0, name: "Normal",    icon: "🎨" },
    { id: 1, name: "Metallic",  icon: "✨" },
    { id: 2, name: "Pearl",     icon: "💎" },
    { id: 3, name: "Matte",     icon: "🖤" },
    { id: 4, name: "Metal",     icon: "🔩" },
    { id: 5, name: "Chrome",    icon: "🪞" }
];

// ─── Preset Colors (curated palette) ───
const PRESET_COLORS = [
    // Reds
    { name: "Racing Red",      r: 192, g: 14,  b: 26  },
    { name: "Dark Red",        r: 106, g: 10,  b: 10  },
    { name: "Candy Red",       r: 182, g: 17,  b: 27  },
    { name: "Sunset Red",      r: 210, g: 60,  b: 60  },
    // Oranges
    { name: "Orange",          r: 234, g: 142, b: 36  },
    { name: "Bright Orange",   r: 255, g: 128, b: 0   },
    // Yellows
    { name: "Race Yellow",     r: 238, g: 198, b: 30  },
    { name: "Bronze",          r: 145, g: 115, b: 45  },
    { name: "Gold",            r: 218, g: 175, b: 60  },
    // Greens
    { name: "Dark Green",      r: 14,  g: 70,  b: 20  },
    { name: "Racing Green",    r: 0,   g: 100, b: 50  },
    { name: "Lime Green",      r: 102, g: 184, b: 31  },
    { name: "Gasoline Green",  r: 25,  g: 120, b: 80  },
    // Blues  
    { name: "Dark Blue",       r: 12,  g: 30,  b: 82  },
    { name: "Midnight Blue",   r: 15,  g: 25,  b: 60  },
    { name: "Galaxy Blue",     r: 30,  g: 60,  b: 130 },
    { name: "Racing Blue",     r: 0,   g: 84,  b: 165 },
    { name: "Ultra Blue",      r: 0,   g: 168, b: 255 },
    { name: "Light Blue",      r: 106, g: 170, b: 210 },
    // Purples
    { name: "Midnight Purple", r: 60,  g: 10,  b: 90  },
    { name: "Bright Purple",   r: 120, g: 30,  b: 180 },
    // Pinks
    { name: "Hot Pink",        r: 210, g: 30,  b: 120 },
    { name: "Salmon Pink",     r: 210, g: 120, b: 130 },
    // Whites / Silvers
    { name: "Frost White",     r: 234, g: 234, b: 234 },
    { name: "Ice White",       r: 252, g: 252, b: 252 },
    { name: "Cream",           r: 235, g: 225, b: 200 },
    { name: "Silver",          r: 165, g: 165, b: 170 },
    // Grays
    { name: "Slate Grey",      r: 108, g: 108, b: 112 },
    { name: "Graphite",        r: 60,  g: 60,  b: 60  },
    { name: "Anthracite",      r: 38,  g: 38,  b: 42  },
    // Blacks
    { name: "Black",           r: 14,  g: 14,  b: 14  },
    { name: "Carbon Black",    r: 25,  g: 25,  b: 25  }
];

// ─── Color Pricing per Grade ───
const COLOR_PRICES = {
    F: { preset: 300,   custom: 800,   paintType: 500  },
    E: { preset: 500,   custom: 1200,  paintType: 800  },
    D: { preset: 800,   custom: 2000,  paintType: 1200 },
    C: { preset: 1200,  custom: 3000,  paintType: 1800 },
    B: { preset: 2000,  custom: 5000,  paintType: 3000 },
    A: { preset: 3000,  custom: 7500,  paintType: 4500 },
    S: { preset: 5000,  custom: 12000, paintType: 7000 }
};
// preset = applying a preset color, custom = applying custom RGB, paintType = changing paint finish

// ═══ WHEEL TYPES ═══
const WHEEL_TYPES = [
    { id: 0, name: "Sport" },
    { id: 1, name: "Muscle" },
    { id: 2, name: "Lowrider" },
    { id: 3, name: "SUV" },
    { id: 4, name: "Offroad" },
    { id: 5, name: "Tuner" },
    { id: 7, name: "High End" }
];

// ═══ XENON HEADLIGHT COLORS ═══
const XENON_COLORS = [
    { id: -1, name: "Default",        hex: "#faf8dc" },
    { id: 0,  name: "White",          hex: "#ffffff" },
    { id: 1,  name: "Blue",           hex: "#2196F3" },
    { id: 2,  name: "Electric Blue",  hex: "#00bcd4" },
    { id: 3,  name: "Mint Green",     hex: "#98ff98" },
    { id: 4,  name: "Lime Green",     hex: "#32cd32" },
    { id: 5,  name: "Yellow",         hex: "#ffeb3b" },
    { id: 6,  name: "Golden",         hex: "#ffc107" },
    { id: 7,  name: "Orange",         hex: "#ff9800" },
    { id: 8,  name: "Red",            hex: "#f44336" },
    { id: 9,  name: "Pony Pink",      hex: "#ff69b4" },
    { id: 10, name: "Hot Pink",       hex: "#ff1493" },
    { id: 11, name: "Purple",         hex: "#9c27b0" },
    { id: 12, name: "Blacklight",     hex: "#4a0080" }
];

// ═══ NUMBER PLATE STYLES ═══
const PLATE_STYLES = [
    { id: 0, name: "Blue on White 1" },
    { id: 1, name: "Yellow on Black" },
    { id: 2, name: "Gold on Blue" },
    { id: 3, name: "Blue on White 2" },
    { id: 4, name: "Blue on White 3" },
    { id: 5, name: "Yankton" }
];

// ═══ NEON COLOR PRESETS ═══
const NEON_PRESETS = [
    { name: "White",         r: 255, g: 255, b: 255 },
    { name: "Blue",          r: 0,   g: 100, b: 255 },
    { name: "Electric Blue", r: 0,   g: 200, b: 255 },
    { name: "Mint Green",    r: 0,   g: 255, b: 140 },
    { name: "Lime Green",    r: 0,   g: 255, b: 0   },
    { name: "Yellow",        r: 255, g: 255, b: 0   },
    { name: "Orange",        r: 255, g: 150, b: 0   },
    { name: "Red",           r: 255, g: 0,   b: 0   },
    { name: "Pink",          r: 255, g: 0,   b: 150 },
    { name: "Purple",        r: 150, g: 0,   b: 255 }
];

// ═══ SPECIAL MOD PRICING PER GRADE ═══
const SPECIAL_PRICES = {
    F: { wheels: 800,   xenon: 400,  xenonColor: 300,  plate: 200,  neon: 1500,  neonColor: 500,  smoke: 800,   smokeColor: 400  },
    E: { wheels: 1200,  xenon: 600,  xenonColor: 400,  plate: 300,  neon: 2500,  neonColor: 800,  smoke: 1200,  smokeColor: 600  },
    D: { wheels: 2000,  xenon: 1000, xenonColor: 600,  plate: 500,  neon: 4000,  neonColor: 1200, smoke: 2000,  smokeColor: 1000 },
    C: { wheels: 3000,  xenon: 1500, xenonColor: 900,  plate: 800,  neon: 6000,  neonColor: 1800, smoke: 3000,  smokeColor: 1500 },
    B: { wheels: 5000,  xenon: 2500, xenonColor: 1500, plate: 1200, neon: 10000, neonColor: 3000, smoke: 5000,  smokeColor: 2500 },
    A: { wheels: 8000,  xenon: 4000, xenonColor: 2500, plate: 2000, neon: 15000, neonColor: 4500, smoke: 8000,  smokeColor: 4000 },
    S: { wheels: 12000, xenon: 6000, xenonColor: 4000, plate: 3000, neon: 22000, neonColor: 7000, smoke: 12000, smokeColor: 6000 }
};

module.exports = {
    PART_ITEMS,
    PART_RARITIES,
    PERFORMANCE_MODS,
    PERF_REQUIREMENTS,
    VISUAL_MODS,
    VISUAL_PRICES,
    TUNING_SHOPS,
    PAINT_TYPES,
    PRESET_COLORS,
    COLOR_PRICES,
    WHEEL_TYPES,
    XENON_COLORS,
    PLATE_STYLES,
    NEON_PRESETS,
    SPECIAL_PRICES
};
