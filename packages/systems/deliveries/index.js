// packages/systems/deliveries/index.js
// ─────────────────────────────────────────────────────────────────────────────
//  Modular Delivery Definitions
//  Each business type registers its own delivery config here.
//  Add new types by inserting a new key in DELIVERY_TYPES.
//
//  Structure of each delivery type:
//  {
//    label        : string        — human-readable name shown in chat
//    vehicleModel : string        — RAGE:MP vehicle model hash name
//    pickupCoords : { x, y, z, heading } — where the van spawns / player walks to
//    dropoffs     : [{ x, y, z }]  — pool of possible drop locations (one picked at random)
//    pickupRadius : number        — colshape radius at pickup
//    dropoffRadius: number        — colshape radius at dropoff
//    inVehicle    : bool          — player must be in the vehicle at drop-off
//  }
// ─────────────────────────────────────────────────────────────────────────────

const DELIVERY_TYPES = {

    // ── 24/7 Convenience Store ────────────────────────────────────────────────
    convenience: {
        label:        '24/7 Convenience Store',
        vehicleModel: 'rumpo3',               // box van, fits the theme
        pickupCoords: { x: 12.8, y: -2478.4, z: 6.0, heading: 0 },  // Port/Docks warehouse

        // Four 24/7 store locations across the map
        dropoffs: [
            { x: 373.87,  y: 325.85,   z: 103.56 },  // Clinton Ave, Strawberry
            { x: 25.49,   y: -1345.73, z: 29.49  },  // Innocence Blvd, South LS
            { x: -707.67, y: -914.22,  z: 19.21  },  // Little Seoul
            { x: 1135.80, y: -982.28,  z: 46.41  },  // El Rancho Blvd, East LS
        ],

        pickupRadius:  14.0,  // generous — player just needs to reach the area
        dropoffRadius: 12.0,
        inVehicle:     true,  // must arrive in the van
    },

    // ── Placeholder for future types ──────────────────────────────────────────
    // gas_station: { ... },
    // dealership:  { ... },
    // tuning:      { ... },
};

/**
 * Returns the delivery definition for a given business type, or null.
 * @param {string} bizType
 * @returns {object|null}
 */
function getDeliveryDef(bizType) {
    return DELIVERY_TYPES[bizType] || null;
}

/**
 * Pick a random drop-off from a delivery definition.
 * @param {object} def  — result of getDeliveryDef()
 * @returns {{ x, y, z }}
 */
function pickDropoff(def) {
    const pool = def.dropoffs;
    return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = { getDeliveryDef, pickDropoff };
