// packages/data/hospitals.js
// ─────────────────────────────────────────────────────────────────────────────
// All hospital locations in San Andreas with their spawn points.
// Used by the down state system for respawning and by the paramedic faction
// to place map blips.
// ─────────────────────────────────────────────────────────────────────────────

const HOSPITALS = [
    {
        id: 1,
        name: 'Pillbox Hill Medical Center',
        blipName: 'LSMC - Pillbox Hill',
        coords: { x: 297.7,  y: -591.8,  z: 43.3  },
        spawnPoint: { x: 306.0,  y: -601.5,  z: 43.3,  h: 70.0  },
    },
    {
        id: 2,
        name: 'Central Los Santos Medical Center',
        blipName: 'LSMC - South LS',
        coords: { x: 356.4,  y: -1416.8, z: 32.5  },
        spawnPoint: { x: 360.0,  y: -1427.5, z: 32.5,  h: 350.0 },
    },
    {
        id: 3,
        name: 'Sandy Shores Medical Center',
        blipName: 'Medical Center - Sandy Shores',
        coords: { x: 1839.6, y: 3672.5,  z: 34.3  },
        spawnPoint: { x: 1839.6, y: 3681.5,  z: 34.3,  h: 180.0 },
    },
    {
        id: 4,
        name: 'Paleto Bay Medical Center',
        blipName: 'Medical Center - Paleto Bay',
        coords: { x: -248.3, y: 6332.1,  z: 33.0  },
        spawnPoint: { x: -248.3, y: 6320.0,  z: 33.0,  h: 0.0   },
    },
];

/**
 * Returns the nearest hospital to the given { x, y, z } position object.
 */
function getNearestHospital(position) {
    let nearest = HOSPITALS[0];
    let minDist  = Infinity;

    for (const hospital of HOSPITALS) {
        const dx = hospital.coords.x - position.x;
        const dy = hospital.coords.y - position.y;
        const dz = hospital.coords.z - position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < minDist) {
            minDist  = dist;
            nearest  = hospital;
        }
    }

    return nearest;
}

module.exports = { HOSPITALS, getNearestHospital };
