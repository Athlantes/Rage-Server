/**
 * ============================================================================
 * TRUCKER CARGO DEFINITIONS
 * ============================================================================
 * Modular cargo system for the trucker job.
 *
 * To add a new cargo category:
 *   1. Add an entry to BOX_TRUCK_CARGO or TRAILER_CARGO.
 *   2. Each entry has:
 *       id         – unique string key
 *       label      – display name shown in the dispatch board
 *       icon       – emoji icon shown on the card
 *       color      – CSS hex color used as the card accent stripe
 *       bonusPct   – % bonus on top of the base distance payout (0.10 = +10%)
 *       illegal    – (optional) if present, this cargo has an illegal variant
 *           label      – display name for the illegal run
 *           bonusPct   – bonus % for the illegal variant (should be higher)
 *           riskLabel  – short risk description shown in the UI
 *
 * For trailers, an additional field applies:
 *       trailerModels – array of RAGE:MP trailer model strings that match this cargo.
 *                       One is picked at random when the contract is generated.
 * ============================================================================
 */

// ─── Box Truck Cargo (levels 1-9) ─────────────────────────────────────────
const BOX_TRUCK_CARGO = [
    {
        id: 'fragile',
        label: 'Fragile Goods',
        icon: '🫙',
        color: '#5b9cf6',
        bonusPct: 0.10,
    },
    {
        id: 'food',
        label: 'Food & Perishables',
        icon: '🥩',
        color: '#4caf50',
        bonusPct: 0.08,
    },
    {
        id: 'beverage',
        label: 'Beverages',
        icon: '🍺',
        color: '#f9a825',
        bonusPct: 0.07,
    },
    {
        id: 'electronics',
        label: 'Consumer Electronics',
        icon: '📦',
        color: '#00bcd4',
        bonusPct: 0.18,
    },
    {
        id: 'high_value',
        label: 'High Value Cargo',
        icon: '💎',
        color: '#ffd700',
        bonusPct: 0.30,
        illegal: {
            label: 'Stolen Jewelry',
            bonusPct: 0.70,
            riskLabel: 'Police Risk',
        },
    },
    {
        id: 'pharma',
        label: 'Pharmaceuticals',
        icon: '💊',
        color: '#e91e63',
        bonusPct: 0.25,
        illegal: {
            label: 'Illicit Substances',
            bonusPct: 0.90,
            riskLabel: 'DEA Risk',
        },
    },
    {
        id: 'furniture',
        label: 'Furniture & Home',
        icon: '🛋️',
        color: '#795548',
        bonusPct: 0.06,
    },
    {
        id: 'medical',
        label: 'Medical Supplies',
        icon: '🩺',
        color: '#ff7043',
        bonusPct: 0.22,
    },
    {
        id: 'automotive_parts',
        label: 'Auto Parts',
        icon: '⚙️',
        color: '#9e9e9e',
        bonusPct: 0.12,
    },
    {
        id: 'clothing',
        label: 'Clothing & Apparel',
        icon: '👔',
        color: '#ab47bc',
        bonusPct: 0.09,
    },
    {
        id: 'art',
        label: 'Artwork & Antiques',
        icon: '🖼️',
        color: '#ff9800',
        bonusPct: 0.35,
        illegal: {
            label: 'Smuggled Antiquities',
            bonusPct: 0.85,
            riskLabel: 'Customs Risk',
        },
    },
    {
        id: 'weapons_legal',
        label: 'Licensed Firearms',
        icon: '🔫',
        color: '#546e7a',
        bonusPct: 0.28,
        illegal: {
            label: 'Unlicensed Weapons',
            bonusPct: 1.00,
            riskLabel: 'ATF Risk',
        },
    },
    {
        id: 'tobacco',
        label: 'Tobacco & Cigars',
        icon: '🚬',
        color: '#8d6e63',
        bonusPct: 0.10,
        illegal: {
            label: 'Bootleg Tobacco',
            bonusPct: 0.45,
            riskLabel: 'Tax Evasion',
        },
    },
    {
        id: 'alcohol',
        label: 'Spirits & Wine',
        icon: '🥃',
        color: '#c0392b',
        bonusPct: 0.12,
        illegal: {
            label: 'Moonshine Run',
            bonusPct: 0.50,
            riskLabel: 'TABC Risk',
        },
    },
    {
        id: 'livestock',
        label: 'Livestock',
        icon: '🐄',
        color: '#66bb6a',
        bonusPct: 0.15,
    },
    {
        id: 'cash',
        label: 'Cash in Transit',
        icon: '💰',
        color: '#00e676',
        bonusPct: 0.40,
        illegal: {
            label: 'Money Laundering',
            bonusPct: 1.20,
            riskLabel: 'FBI Risk',
        },
    },
];

// ─── Trailer Cargo (levels 10+) ─────────────────────────────────────────────
// trailerModels: RAGE:MP vehicle model names for the trailer that fits this cargo.
const TRAILER_CARGO = [
    // ── tr4 (car carrier) ──────────────────────────────────────────────────
    {
        id: 'luxury_cars',
        label: 'Luxury Vehicles',
        icon: '🚗',
        color: '#ffd700',
        bonusPct: 0.40,
        trailerModels: ['tr4'],
    },
    {
        id: 'vintage_cars',
        label: 'Vintage Automobiles',
        icon: '🏎️',
        color: '#ff9800',
        bonusPct: 0.45,
        trailerModels: ['tr4'],
    },
    {
        id: 'stolen_cars',
        label: 'Repossessed Fleet',
        icon: '🔑',
        color: '#9e9e9e',
        bonusPct: 0.20,
        trailerModels: ['tr4'],
        illegal: {
            label: 'Stolen Vehicles',
            bonusPct: 1.10,
            riskLabel: 'LSPD Risk',
        },
    },

    // ── docktrailer (dock box / intermodal) ───────────────────────────────
    {
        id: 'packages',
        label: 'Parcel Freight',
        icon: '📫',
        color: '#42a5f5',
        bonusPct: 0.10,
        trailerModels: ['docktrailer'],
    },
    {
        id: 'imported_clothing',
        label: 'Imported Textiles',
        icon: '🧥',
        color: '#ce93d8',
        bonusPct: 0.12,
        trailerModels: ['docktrailer'],
    },
    {
        id: 'imported_pharma',
        label: 'Imported Pharmaceuticals',
        icon: '💉',
        color: '#ef9a9a',
        bonusPct: 0.30,
        trailerModels: ['docktrailer'],
        illegal: {
            label: 'Illicit Pharma Shipment',
            bonusPct: 1.00,
            riskLabel: 'FDA / DEA Risk',
        },
    },
    {
        id: 'industrial_equipment',
        label: 'Industrial Equipment',
        icon: '🏗️',
        color: '#78909c',
        bonusPct: 0.20,
        trailerModels: ['docktrailer'],
    },
    {
        id: 'electronics_bulk',
        label: 'Bulk Electronics',
        icon: '🖥️',
        color: '#26c6da',
        bonusPct: 0.25,
        trailerModels: ['docktrailer'],
        illegal: {
            label: 'Counterfeit Tech',
            bonusPct: 0.80,
            riskLabel: 'Customs Risk',
        },
    },

    // ── trailerlogs (flatbed / logging) ───────────────────────────────────
    {
        id: 'timber',
        label: 'Timber & Logs',
        icon: '🪵',
        color: '#8d6e63',
        bonusPct: 0.10,
        trailerModels: ['trailerlogs'],
    },
    {
        id: 'lumber',
        label: 'Processed Lumber',
        icon: '🔨',
        color: '#a5845f',
        bonusPct: 0.12,
        trailerModels: ['trailerlogs'],
    },
    {
        id: 'biomass',
        label: 'Biomass Fuel',
        icon: '🌿',
        color: '#66bb6a',
        bonusPct: 0.08,
        trailerModels: ['trailerlogs'],
    },

    // ── tanker2 (orange tanker) ────────────────────────────────────────────
    {
        id: 'fuel',
        label: 'Petroleum Fuel',
        icon: '⛽',
        color: '#ff7043',
        bonusPct: 0.22,
        trailerModels: ['tanker2'],
    },
    {
        id: 'chemicals',
        label: 'Industrial Chemicals',
        icon: '⚗️',
        color: '#ffee58',
        bonusPct: 0.28,
        trailerModels: ['tanker2'],
        illegal: {
            label: 'Hazardous Waste',
            bonusPct: 0.90,
            riskLabel: 'EPA Risk',
        },
    },
    {
        id: 'liquid_food',
        label: 'Liquid Food Products',
        icon: '🥛',
        color: '#eeeeee',
        bonusPct: 0.12,
        trailerModels: ['tanker2'],
    },

    // ── tanker (second tanker model) ──────────────────────────────────────
    {
        id: 'crude_oil',
        label: 'Crude Oil',
        icon: '🛢️',
        color: '#4e342e',
        bonusPct: 0.35,
        trailerModels: ['tanker'],
    },
    {
        id: 'water',
        label: 'Potable Water',
        icon: '💧',
        color: '#4fc3f7',
        bonusPct: 0.05,
        trailerModels: ['tanker'],
    },
    {
        id: 'gas',
        label: 'Compressed Gas',
        icon: '💨',
        color: '#b0bec5',
        bonusPct: 0.30,
        trailerModels: ['tanker'],
        illegal: {
            label: 'Illegal Gas (Nitrous)',
            bonusPct: 0.75,
            riskLabel: 'DEA Risk',
        },
    },

    // ── tr3 (boat trailer) ────────────────────────────────────────────────
    {
        id: 'yacht',
        label: 'Luxury Yacht',
        icon: '⛵',
        color: '#29b6f6',
        bonusPct: 0.50,
        trailerModels: ['tr3'],
    },
    {
        id: 'speedboat',
        label: 'Racing Speedboat',
        icon: '🚤',
        color: '#1e88e5',
        bonusPct: 0.40,
        trailerModels: ['tr3'],
        illegal: {
            label: 'Cartel Smuggler Boat',
            bonusPct: 1.30,
            riskLabel: 'Coast Guard Risk',
        },
    },
    {
        id: 'fishing_vessel',
        label: 'Commercial Fishing Boat',
        icon: '🎣',
        color: '#0097a7',
        bonusPct: 0.20,
        trailerModels: ['tr3'],
    },

    // ── trailers3 (large box trailer) ─────────────────────────────────────
    {
        id: 'general_freight',
        label: 'General Freight',
        icon: '📦',
        color: '#607d8b',
        bonusPct: 0.08,
        trailerModels: ['trailers3'],
    },
    {
        id: 'household_goods',
        label: 'Household Goods',
        icon: '🏠',
        color: '#ff8a65',
        bonusPct: 0.10,
        trailerModels: ['trailers3'],
    },
    {
        id: 'weapons_cache',
        label: 'Decommissioned Arms',
        icon: '🔫',
        color: '#546e7a',
        bonusPct: 0.35,
        trailerModels: ['trailers3'],
        illegal: {
            label: 'Black Market Arms Cache',
            bonusPct: 1.40,
            riskLabel: 'FBI / ATF Risk',
        },
    },

    // ── trailers2 (BigArch / refrigerated) ────────────────────────────────
    {
        id: 'frozen_food',
        label: 'Frozen Food',
        icon: '🧊',
        color: '#80deea',
        bonusPct: 0.15,
        trailerModels: ['trailers2'],
    },
    {
        id: 'fresh_produce',
        label: 'Fresh Produce',
        icon: '🥦',
        color: '#a5d6a7',
        bonusPct: 0.12,
        trailerModels: ['trailers2'],
    },
    {
        id: 'pharma_cold_chain',
        label: 'Cold-Chain Pharma',
        icon: '🧬',
        color: '#f48fb1',
        bonusPct: 0.35,
        trailerModels: ['trailers2'],
        illegal: {
            label: 'Experimental Bioagents',
            bonusPct: 1.50,
            riskLabel: 'CDC / FBI Risk',
        },
    },

    // ── trailers4 (big metallic box) ──────────────────────────────────────
    {
        id: 'steel',
        label: 'Steel & Metal',
        icon: '🔩',
        color: '#90a4ae',
        bonusPct: 0.15,
        trailerModels: ['trailers4'],
    },
    {
        id: 'mining_ore',
        label: 'Mining Ore',
        icon: '⛏️',
        color: '#a1887f',
        bonusPct: 0.18,
        trailerModels: ['trailers4'],
    },
    {
        id: 'military_supplies',
        label: 'Military Equipment',
        icon: '🎖️',
        color: '#558b2f',
        bonusPct: 0.45,
        trailerModels: ['trailers4'],
        illegal: {
            label: 'Stolen Military Assets',
            bonusPct: 1.60,
            riskLabel: 'Army / FBI Risk',
        },
    },
    {
        id: 'server_hardware',
        label: 'Server Hardware',
        icon: '🖧',
        color: '#26c6da',
        bonusPct: 0.30,
        trailerModels: ['trailers4'],
        illegal: {
            label: 'Data Centre Heist',
            bonusPct: 0.95,
            riskLabel: 'Cybercrimes Risk',
        },
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Pick a random cargo for a box truck contract.
 * Set illegalChance (0-1) to control how often illegal variants are chosen.
 */
function pickBoxTruckCargo(illegalChance = 0.15) {
    const pool = BOX_TRUCK_CARGO;
    const base = pool[Math.floor(Math.random() * pool.length)];
    if (base.illegal && Math.random() < illegalChance) {
        return {
            id:        base.id + '_illegal',
            label:     base.illegal.label,
            icon:      base.icon,
            color:     '#e74c3c',         // illegal runs always flash red accent
            bonusPct:  base.illegal.bonusPct,
            illegal:   true,
            riskLabel: base.illegal.riskLabel,
        };
    }
    return { ...base, illegal: false };
}

/**
 * Pick a random cargo for a trailer contract.
 * Returns { cargo, trailerModel }.
 * Optionally restrict to a specific trailerModel.
 */
function pickTrailerCargo(forcedTrailerModel = null, illegalChance = 0.15) {
    let pool = TRAILER_CARGO;
    if (forcedTrailerModel) {
        pool = pool.filter(c => c.trailerModels.includes(forcedTrailerModel));
        if (pool.length === 0) pool = TRAILER_CARGO; // fallback
    }

    const base = pool[Math.floor(Math.random() * pool.length)];
    const trailerModel = base.trailerModels[Math.floor(Math.random() * base.trailerModels.length)];

    if (base.illegal && Math.random() < illegalChance) {
        return {
            cargo: {
                id:        base.id + '_illegal',
                label:     base.illegal.label,
                icon:      base.icon,
                color:     '#e74c3c',
                bonusPct:  base.illegal.bonusPct,
                illegal:   true,
                riskLabel: base.illegal.riskLabel,
            },
            trailerModel,
        };
    }
    return {
        cargo: { ...base, illegal: false, trailerModels: undefined },
        trailerModel,
    };
}

module.exports = {
    BOX_TRUCK_CARGO,
    TRAILER_CARGO,
    pickBoxTruckCargo,
    pickTrailerCargo,
};
