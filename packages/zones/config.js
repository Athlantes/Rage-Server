// packages/zones/config.js
module.exports = {
    // Define Zone Types and their default behaviors
    Types: {
        SAFE_ZONE: { id: 'safe_zone', visualEffects: true, invincible: true },
        NO_COLLISION: { id: 'no_collision', visualEffects: true, ghost: true },
        CITY_AREA: { id: 'city_area', visualEffects: false, invincible: false }
    },

    // Define the actual Zones
    Zones: [
        {
            id: 'gopostal_zone',
            type: 'NO_COLLISION',
            shape: 'polygon',
            minZ: 29.0, maxZ: 130.0,
            vertices: [ { x: 163.4, y: 109.8 }, { x: 7.0, y: 167.6 }, { x: -10.1, y: 119.2 }, { x: 146.7, y: 63.0 } ]
        },
        {
            id: 'garbage_zone',
            type: 'NO_COLLISION',
            shape: 'polygon',
            minZ: 20.0, maxZ: 150.0,
            vertices: [
                { x: -293.1, y: -1512.1 }, { x: -315.3, y: -1502.7 }, { x: -375.5, y: -1499.8 },
                { x: -378.6, y: -1556.1 }, { x: -367.7, y: -1584.1 }, { x: -368.2, y: -1626.9 },
                { x: -362.6, y: -1640.0 }, { x: -323.3, y: -1573.6 }, { x: -303.8, y: -1541.1 }
            ]
        },
        {
            id: 'ls_zone',
            type: 'CITY_AREA',
            shape: 'polygon',
            minZ: -100.0,
            maxZ: 800.0,
            vertices: [
                { x: -2991.2, y: 96.7 }, { x: -2562.2, y: 594.9 }, { x: -2091.7, y: 664.1 }, { x: -1556.6, y: 701.0 },
                { x: -1268.1, y: 727.6 }, { x: -1066.5, y: 922.9 }, { x: -780.7, y: 941.6 }, { x: -607.5, y: 943.9 },
                { x: -289.8, y: 1091.7 }, { x: 256.2, y: 1040.9 }, { x: 603.7, y: 916.3 }, { x: 1394.1, y: 476.7 },
                { x: 1604.1, y: 2.5 }, { x: 2080.5, y: -478.3 }, { x: 2353.7, y: -844.1 }, { x: 2127.9, y: -1589.2 },
                { x: 1748.6, y: -2602.9 }, { x: 1380.5, y: -3381.9 }, { x: -468.3, y: -3489.1 }, { x: -1414.4, y: -3744.2 },
                { x: -2294.9, y: -3261.0 }, { x: -1546.0, y: -1881.5 }
            ]
        }
    ]
};