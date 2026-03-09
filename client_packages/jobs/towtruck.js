// client_packages/jobs/towtruck.js
// =============================================================================
//  TOW TRUCK — Client Side
//
//  HOW SYNC WORKS:
//    The server sets truck.setVariable('towedVehicleId', towed.id) when hooked
//    and truck.setVariable('towedVehicleId', null) when released.
//
//    addDataHandler('towedVehicleId') fires on EVERY client automatically
//    whenever that netVar changes on any vehicle — including when a vehicle
//    streams in for the first time with the variable already set.
//
//    Each client calls the native:
//      towTruck.attachToTowTruck(towedVeh.handle, rear, x, y, z)
//    The method is called ON THE TOW TRUCK, towed car handle as the argument.
//    This matches GTA's native: ATTACH_VEHICLE_TO_TOW_TRUCK(towTruck, vehicle, ...)
// =============================================================================

'use strict';

// ---------------------------------------------------------------------------
//  Shared attach helper — used by both dataHandler and streamIn handler
// ---------------------------------------------------------------------------
function doAttach(towTruck, towedRemoteId) {
    let attempts = 0;
    const tryAttach = setInterval(() => {
        attempts++;

        if (!mp.vehicles.exists(towTruck)) {
            clearInterval(tryAttach);
            return;
        }

        const towedVeh = mp.vehicles.atRemoteId(towedRemoteId);
        if (towedVeh && mp.vehicles.exists(towedVeh)) {
            // Called ON the tow truck, towed car handle as argument.
            // rear = true, offsets = 0 (use model's default hook point)
            towTruck.attachToTowTruck(towedVeh.handle, true, 0.0, 0.0, 0.0);
            clearInterval(tryAttach);
        }

        if (attempts > 40) clearInterval(tryAttach); // give up after 2s
    }, 50);
}

// ---------------------------------------------------------------------------
//  ATTACH / DETACH via netVar dataHandler
//
//  Fires on every client when 'towedVehicleId' changes on any vehicle.
//  entity = the tow truck (the vehicle that has the variable set on it)
//  value  = remote id of the towed car, or null to detach
// ---------------------------------------------------------------------------
mp.events.addDataHandler('towedVehicleId', (towTruck, towedRemoteId) => {
    if (!towTruck || towTruck.type !== 'vehicle') return;

    if (towedRemoteId !== null && towedRemoteId !== undefined) {
        doAttach(towTruck, towedRemoteId);
    } else {
        // Detach — find which vehicle this truck is currently towing and release it
        mp.vehicles.forEachInStreamRange((veh) => {
            if (!veh || !mp.vehicles.exists(veh)) return;
            if (veh.isAttachedToTowTruck(towTruck.handle)) {
                veh.detachFromTowTruck(towTruck.handle);
            }
        });
    }
});

// ---------------------------------------------------------------------------
//  STREAM-IN HANDLER
//  If a tow truck streams in while already towing (e.g. player joins mid-job),
//  the dataHandler fires automatically for the variable change but we add this
//  as a safety net in case the towed car streams in slightly later.
// ---------------------------------------------------------------------------
mp.events.add('entityStreamIn', (entity) => {
    if (!entity || entity.type !== 'vehicle') return;

    const towedRemoteId = entity.getVariable('towedVehicleId');
    if (towedRemoteId === null || towedRemoteId === undefined) return;

    doAttach(entity, towedRemoteId);
});