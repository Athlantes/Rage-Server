// packages/systems/fuel.js  ← PATCHED VERSION
// ─────────────────────────────────────────────────────────────────────────────
//  Drop-in replacement for the existing fuel.js.
//  Adds permit passive commission hook: when a player refuels at a business
//  whose permit is held by a family, 5% of the transaction goes to their safe.
//
//  CHANGES vs original:
//    • Import PermitManager (lazy to avoid circular deps)
//    • After successful refuel, call permitManager.handlePassiveCommission()
//    • Uses the FUEL_STATION_BIZ_MAP to translate pump coords → business ID
// ─────────────────────────────────────────────────────────────────────────────
const PlayerManager = require('../core/playerManager');
const FuelStations  = require('../data/fuelLocations').FuelStations;
const QuestEvents   = require('../core/questEvents');
const { isRateLimited } = require('../core/rateLimit');

// Lazy-load to avoid circular dep with familyManager
let permitManager = null;
function getPermitManager() {
    if (!permitManager) {
        try { permitManager = require('./permitManager'); } catch(e) { /* not loaded yet */ }
    }
    return permitManager;
}

const CONFIG = {
    pricePerLiter:    2,
    fuelTankCapacity: 100,
};

// Map each station name → business ID (must match businesses table seeds)
const STATION_BIZ_MAP = {
    'Paleto Bay Gas Station':   1,
    'Sandy Shores Gas Station': 2,
    'Davis Gas Station':        7,
    // Add any other stations as needed
};

// 1. Initialize Pumps (unchanged)
FuelStations.forEach((station) => {
    station.pumps.forEach((pump) => {
        const shape = mp.colshapes.newSphere(pump.x, pump.y, pump.z, 2.0, 0);
        shape.setVariable('interaction', {
            title:          station.name,
            text:           'Press E to Refuel',
            event:          'server:openFuelUI',
            requireVehicle: true,
            requireDriver:  true,
            // Store station name for permit lookup
            stationName:    station.name,
        });
    });
});

// 2. Open UI Event (unchanged)
mp.events.add('server:openFuelUI', (player) => {
    const veh = player.vehicle;
    if (!veh) return;

    if (veh.engine) {
        veh.engine = false;
        veh.setVariable('engine', false);
        player.call('showNotification', ['Vehicle System', 'Engine turned off for refueling.']);
    }

    let currentFuel = veh.getVariable('fuel') || 0;
    if (currentFuel < 0) currentFuel = 0;
    const maxRefuelAmount = Math.floor(CONFIG.fuelTankCapacity - currentFuel);

    player.call('client:openFuelBrowser', [currentFuel, maxRefuelAmount, CONFIG.pricePerLiter]);
});

// 3. Process Transaction (PATCHED — passive commission hook added)
mp.events.add('server:processRefuel', async (player, litersToFill) => {
    if (isRateLimited(player, 'fuel:refuel', 2, 5000)) return;
    const veh = player.vehicle;
    if (!veh) return;

    litersToFill = parseInt(litersToFill);
    if (litersToFill <= 0) return;

    const cost = litersToFill * CONFIG.pricePerLiter;

    if (player.data.money < cost) {
        return player.call('showNotification', ['Gas Station', `You need $${cost} to fill ${litersToFill}L.`]);
    }

    await PlayerManager.removeMoneyAndSave(player, cost, 'Fuel Purchase');

    const currentFuel = veh.getVariable('fuel') || 0;
    const newFuel     = Math.min(CONFIG.fuelTankCapacity, currentFuel + litersToFill);
    veh.setVariable('fuel', newFuel);

    player.call('showNotification', ['Gas Station', `Filled ${litersToFill}L for $${cost}. Fuel: ${Math.floor(newFuel)}%`]);

    // ── Permit passive commission hook ────────────────────────────────────────
    try {
        const pm = getPermitManager();
        if (pm) {
            // Find nearest station to resolve business ID
            const pos = player.position;
            let closestStation = null;
            let closestDist    = Infinity;
            for (const station of FuelStations) {
                for (const pump of station.pumps) {
                    const d = Math.sqrt(
                        Math.pow(pos.x - pump.x, 2) + Math.pow(pos.y - pump.y, 2)
                    );
                    if (d < closestDist) { closestDist = d; closestStation = station; }
                }
            }
            if (closestStation && STATION_BIZ_MAP[closestStation.name]) {
                const bizId = STATION_BIZ_MAP[closestStation.name];
                await pm.handlePassiveCommission(bizId, player, cost);
            }
        }
    } catch (err) {
        console.error('[Fuel] Permit commission error:', err);
    }
    // ── End permit hook ───────────────────────────────────────────────────────

    // Quest event (unchanged)
    try { QuestEvents.onRefuel(player, litersToFill); } catch(e) {}
});
