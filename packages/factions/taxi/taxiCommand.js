// packages/factions/taxi/taxiCommand.js
// ─────────────────────────────────────────────────────────────────────────────
// Taxi phone app server events.
// Players request a taxi through the phone Taxi app by selecting a destination.
// The app shows driver count, location list, and a progress tracker.
// ─────────────────────────────────────────────────────────────────────────────

const dispatchManager = require('../dispatch/dispatchManager');
const PlayerManager   = require('../../core/playerManager');

const TAXI_FACTION_ID   = 1;
const CALL_COOLDOWN_MS  = 60 * 1000;
const FARE_PER_KM       = 50;
const MIN_DISTANCE_KM   = 0.5;
const GTA_UNITS_PER_KM  = 1000;

// Track cooldowns & active phone calls: Map<playerId, data>
const callerCooldowns = new Map();
const activePhoneCalls = new Map(); // playerId → { callId, destName, fare, phase }

// ── Helper: count on-duty taxi drivers ────────────────────────────────────────
function countOnDutyDrivers() {
    let count = 0;
    mp.players.forEach(p => {
        if (p.logged && p.factionId === TAXI_FACTION_ID && p.getVariable('factionDuty')) {
            count++;
        }
    });
    return count;
}

// ── Helper: calculate fare from distance ──────────────────────────────────────
function calculateFare(pickupX, pickupY, pickupZ, destX, destY, destZ) {
    const dx = destX - pickupX;
    const dy = destY - pickupY;
    const dz = destZ - pickupZ;
    const distUnits = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const distKm = distUnits / GTA_UNITS_PER_KM;
    return { distKm: Math.round(distKm * 10) / 10, fare: Math.round(distKm * FARE_PER_KM) };
}

// ── Phone app: request taxi data (driver count + locations) ───────────────────
mp.events.add('server:taxi:requestAppData', (player) => {
    if (!player.logged) return;

    const driversOnDuty = countOnDutyDrivers();

    // Check if player already has an active call
    const existing = activePhoneCalls.get(player.id);
    if (existing) {
        player.call('client:taxi:receiveAppData', [JSON.stringify({
            driversOnDuty,
            activeCall: {
                phase: existing.phase,
                destName: existing.destName,
                fare: existing.fare,
                driverName: existing.driverName || null
            }
        })]);
        return;
    }

    // Also send GPS locations (reuse the GPS cache from phone maps)
    // GPS locations are fetched separately via server:phone:requestGPS on the client side

    player.call('client:taxi:receiveAppData', [JSON.stringify({
        driversOnDuty,
        activeCall: null
    })]);
});

// ── Phone app: call a taxi ────────────────────────────────────────────────────
mp.events.add('server:taxi:callFromPhone', (player, destName, destX, destY, destZ, pickupZone) => {
    if (!player.logged) return;

    // Check cooldown
    const lastCall = callerCooldowns.get(player.id) || 0;
    const remaining = Math.ceil((lastCall + CALL_COOLDOWN_MS - Date.now()) / 1000);
    if (remaining > 0) {
        player.call('client:taxi:callError', [`Please wait ${remaining}s before calling again.`]);
        return;
    }

    // Check if already has an active call
    if (activePhoneCalls.has(player.id)) {
        player.call('client:taxi:callError', ['You already have an active taxi request.']);
        return;
    }

    // Detect if passenger is already in a taxi with an on-duty driver
    let inTaxiDriver = null;
    if (player.vehicle) {
        const veh = player.vehicle;
        const vehFactionId = veh.getVariable('factionId');
        if (vehFactionId === TAXI_FACTION_ID) {
            // Find the driver of this vehicle
            mp.players.forEach(p => {
                if (p.logged && p.vehicle && p.vehicle.id === veh.id
                    && p.id !== player.id
                    && p.factionId === TAXI_FACTION_ID
                    && p.getVariable('factionDuty')) {
                    inTaxiDriver = p;
                }
            });
        }
        if (!inTaxiDriver) {
            player.call('client:taxi:callError', ['You are already in a vehicle.']);
            return;
        }
    }

    // Check on-duty drivers (skip if already in a taxi with a driver)
    if (!inTaxiDriver) {
        const driversOnDuty = countOnDutyDrivers();
        if (driversOnDuty === 0) {
            player.call('client:taxi:callError', ['No taxi drivers are available right now.']);
            return;
        }
    }

    // Parse coordinates
    const dX = parseFloat(destX);
    const dY = parseFloat(destY);
    const dZ = parseFloat(destZ);

    // Calculate fare
    const pickup = player.position;
    const { distKm, fare } = calculateFare(pickup.x, pickup.y, pickup.z, dX, dY, dZ);

    if (distKm < MIN_DISTANCE_KM) {
        player.call('client:taxi:callError', [`Destination is too close (${distKm} km). Minimum distance is ${MIN_DISTANCE_KM} km.`]);
        return;
    }

    // Check if player has enough money for at least the upfront 50%
    const upfrontCost = Math.ceil(fare / 2);
    if (!player.data || (player.data.money || 0) < upfrontCost) {
        player.call('client:taxi:callError', [`You need at least $${upfrontCost} for the upfront fare.`]);
        return;
    }

    // Set cooldown
    callerCooldowns.set(player.id, Date.now());

    const callerName = player.name.replace(/_/g, ' ');
    const locationName = destName || 'Unknown Area';

    // Resolve pickup zone name on server (best effort)
    let pickupLocation = pickupZone || 'Unknown Area';

    // ── Auto-assign: passenger is already in a taxi with an on-duty driver ────
    if (inTaxiDriver) {
        // Check the driver doesn't already have an active assignment
        const existingAssignment = dispatchManager.getAssignment(inTaxiDriver.id);
        if (existingAssignment) {
            player.call('client:taxi:callError', ['Your driver already has an active fare.']);
            return;
        }

        const driverName = inTaxiDriver.name.replace(/_/g, ' ');

        // Fix 1: Create the assignment via the safe API instead of touching internals directly
        const callId = dispatchManager.createDirectAssignment(inTaxiDriver.id, {
            factionId:       TAXI_FACTION_ID,
            callerServerId:  player.id,
            callerName:      callerName,
            coords:          { x: pickup.x, y: pickup.y, z: pickup.z },
            phase:           3,
            driverVehicleId: inTaxiDriver.vehicle ? inTaxiDriver.vehicle.id : null,
            destCoords:      { x: dX, y: dY, z: dZ },
            destLocation:    locationName,
            fare:            fare,
            distKm:          distKm,
        });

        // Track the active phone call (already at phase 3 — on the way)
        activePhoneCalls.set(player.id, {
            callId: callId,
            destName: locationName,
            destCoords: { x: dX, y: dY, z: dZ },
            fare: fare,
            distKm: distKm,
            upfrontPaid: false,
            phase: 3,
            driverName: driverName,
            driverId: inTaxiDriver.id,
        });

        // Initialize driver's client-side ride state (normally done by client:dispatch:accepted)
        inTaxiDriver.call('client:taxi:autoAssignRide', [JSON.stringify({
            callerName: callerName,
            coords: { x: dX, y: dY, z: dZ },
            location: locationName,
        })]);

        // Confirm to passenger phone and jump straight to phase 3
        player.call('client:taxi:callPlaced', [JSON.stringify({
            destName: locationName,
            fare: fare,
            distKm: distKm,
            phase: 3
        })]);

        // Immediately show on-the-way progress
        player.call('client:taxi:phoneProgress', [JSON.stringify({
            phase: 1,
            driverName: driverName,
        })]);
        setTimeout(() => {
            if (mp.players.exists(player)) {
                player.call('client:taxi:phoneProgress', [JSON.stringify({ phase: 3, destName: locationName })]);
            }
        }, 500);

        // Handle fare (deduct upfront)
        (async () => {
            const upfront = Math.ceil(fare / 2);
            await PlayerManager.removeMoneyAndSave(player, upfront, 'Taxi Fare (Upfront 50%)');
            activePhoneCalls.get(player.id) && (activePhoneCalls.get(player.id).upfrontPaid = true);
            player.outputChatBox(`!{#ffc300}[TAXI] !{#ffffff}Upfront fare: !{#ff4757}-$${upfront}`);

            if (mp.players.exists(inTaxiDriver)) {
                await PlayerManager.addMoneyAndSave(inTaxiDriver, upfront, 'Taxi Fare Income (50%)');
                inTaxiDriver.outputChatBox(`!{#ffc300}[TAXI] !{#ffffff}Fare income: !{#00ff00}+$${upfront}`);
            }
        })();

        player.outputChatBox(`!{#ffc300}[TAXI] !{#ffffff}Ride auto-assigned to your driver, ${driverName}!`);
        inTaxiDriver.outputChatBox(`!{#ffc300}[TAXI] !{#ffffff}${callerName} set a destination: ${locationName}. Head there now!`);

        console.log(`[Dispatch] Taxi auto-assigned: ${callerName} → driver ${driverName} (already in vehicle)`);
        return;
    }

    // ── Normal flow: create dispatch call ─────────────────────────────────────
    const call = dispatchManager.addCall(TAXI_FACTION_ID, {
        callerName,
        callerServerId: player.id,
        coords: { x: pickup.x, y: pickup.y, z: pickup.z },
        location: pickupLocation,
        // Extended taxi data
        destCoords: { x: dX, y: dY, z: dZ },
        destLocation: locationName,
        fare: fare,
        distKm: distKm,
    });

    if (!call) {
        player.call('client:taxi:callError', ['Failed to create taxi request. Try again.']);
        return;
    }

    // Track the active phone call
    activePhoneCalls.set(player.id, {
        callId: call.id,
        destName: locationName,
        destCoords: { x: dX, y: dY, z: dZ },
        fare: fare,
        distKm: distKm,
        upfrontPaid: false,
        phase: 0, // 0=waiting, 1=driver accepted, 2=driver arrived, 3=on the way, 4=finished
        driverName: null,
        driverId: null,
    });

    // Send confirmation to phone
    player.call('client:taxi:callPlaced', [JSON.stringify({
        destName: locationName,
        fare: fare,
        distKm: distKm,
        phase: 0
    })]);
});

// ── Phone app: cancel a taxi call ─────────────────────────────────────────────
mp.events.add('server:taxi:cancelCall', (player) => {
    if (!player.logged) return;
    const phoneCall = activePhoneCalls.get(player.id);
    if (!phoneCall) return;

    // If a driver has accepted, cancel the assignment
    if (phoneCall.driverId !== null) {
        dispatchManager.cancelAssignment(phoneCall.driverId, 'Passenger cancelled the ride.');
    }

    // Remove pending dispatch call if not yet accepted
    dispatchManager.removePendingCall(TAXI_FACTION_ID, phoneCall.callId);

    activePhoneCalls.delete(player.id);
    player.call('client:taxi:callCancelled', []);
});

// ── Phone app: submit rating ──────────────────────────────────────────────────
mp.events.add('server:taxi:submitRating', async (player, starsStr) => {
    if (!player.logged) return;

    const stars = parseInt(starsStr);
    if (isNaN(stars) || stars < 1 || stars > 5) return;

    const phoneCall = activePhoneCalls.get(player.id);
    if (!phoneCall || phoneCall.phase !== 4) return;

    // Notify the driver about the rating
    if (phoneCall.driverId !== null) {
        const driver = mp.players.at(phoneCall.driverId);
        if (driver && mp.players.exists(driver)) {
            const starStr = '★'.repeat(stars) + '☆'.repeat(5 - stars);
            driver.outputChatBox(`!{#ffc300}[TAXI] !{#ffffff}${player.name.replace(/_/g, ' ')} rated your ride: !{#ffc300}${starStr} !{#ffffff}(${stars}/5)`);

            // Fix 3: Keep in-memory running average for display this session
            if (!driver.taxiRatings) driver.taxiRatings = { total: 0, count: 0 };
            driver.taxiRatings.total += stars;
            driver.taxiRatings.count += 1;
            const avg = (driver.taxiRatings.total / driver.taxiRatings.count).toFixed(1);
            driver.outputChatBox(`!{#888888}Your average rating this session: ${avg}/5.0 (${driver.taxiRatings.count} rides)`);

            // Fix 3: Persist to dedicated taxi_ratings table — no NULLs polluting users
            if (driver.data && driver.data.dbId) {
                try {
                    const db = require('../../core/database');
                    await db.query(
                        `INSERT INTO taxi_ratings (user_id, rating_total, rating_count)
                         VALUES (?, ?, 1)
                         ON DUPLICATE KEY UPDATE
                             rating_total = rating_total + VALUES(rating_total),
                             rating_count = rating_count + 1`,
                        [driver.data.dbId, stars]
                    );
                    console.log(`[Taxi] Saved rating ${stars}/5 for ${driver.name} (dbId: ${driver.data.dbId})`);
                } catch (e) {
                    console.error('[Taxi] Failed to persist rating:', e);
                }
            }
        }
    }

    activePhoneCalls.delete(player.id);
    player.call('client:taxi:ratingSubmitted', []);
});

// ── Hooks for dispatch phases (called by taxiDispatch.js) ─────────────────────

function onDriverAccepted(callerId, driverId, driverName) {
    const phoneCall = activePhoneCalls.get(callerId);
    if (!phoneCall) return;
    phoneCall.phase = 1;
    phoneCall.driverId = driverId;
    phoneCall.driverName = driverName;

    const caller = mp.players.at(callerId);
    if (caller && mp.players.exists(caller)) {
        caller.call('client:taxi:phoneProgress', [JSON.stringify({
            phase: 1,
            driverName: driverName
        })]);
    }
}

function onDriverArrived(callerId) {
    const phoneCall = activePhoneCalls.get(callerId);
    if (!phoneCall) return;
    phoneCall.phase = 2;

    const caller = mp.players.at(callerId);
    if (caller && mp.players.exists(caller)) {
        caller.call('client:taxi:phoneProgress', [JSON.stringify({ phase: 2 })]);
    }
}

async function onCallerBoarded(callerId) {
    const phoneCall = activePhoneCalls.get(callerId);
    if (!phoneCall) return;
    phoneCall.phase = 3;

    const caller = mp.players.at(callerId);
    if (caller && mp.players.exists(caller)) {
        // Deduct 50% upfront fare
        const upfront = Math.ceil(phoneCall.fare / 2);
        if (!phoneCall.upfrontPaid) {
            await PlayerManager.removeMoneyAndSave(caller, upfront, 'Taxi Fare (Upfront 50%)');
            phoneCall.upfrontPaid = true;
            caller.outputChatBox(`!{#ffc300}[TAXI] !{#ffffff}Upfront fare: !{#ff4757}-$${upfront}`);
        }

        caller.call('client:taxi:phoneProgress', [JSON.stringify({
            phase: 3,
            destName: phoneCall.destName
        })]);
    }

    // Give upfront to driver
    if (phoneCall.driverId !== null) {
        const driver = mp.players.at(phoneCall.driverId);
        if (driver && mp.players.exists(driver)) {
            const upfront = Math.ceil(phoneCall.fare / 2);
            await PlayerManager.addMoneyAndSave(driver, upfront, 'Taxi Fare Income (50%)');
            driver.outputChatBox(`!{#ffc300}[TAXI] !{#ffffff}Fare income: !{#00ff00}+$${upfront}`);
        }
    }
}

async function onRideComplete(callerId) {
    const phoneCall = activePhoneCalls.get(callerId);
    if (!phoneCall) return;
    phoneCall.phase = 4;

    const caller = mp.players.at(callerId);
    if (caller && mp.players.exists(caller)) {
        // Deduct remaining 50%
        const remaining = phoneCall.fare - Math.ceil(phoneCall.fare / 2);
        if (remaining > 0) {
            await PlayerManager.removeMoneyAndSave(caller, remaining, 'Taxi Fare (Final 50%)');
            caller.outputChatBox(`!{#ffc300}[TAXI] !{#ffffff}Final fare: !{#ff4757}-$${remaining}`);
            caller.outputChatBox(`!{#ffc300}[TAXI] !{#ffffff}Total ride cost: !{#ff4757}$${phoneCall.fare} !{#888888}(${phoneCall.distKm} km)`);
        }

        // Show rating screen on phone
        caller.call('client:taxi:phoneProgress', [JSON.stringify({
            phase: 4,
            fare: phoneCall.fare,
            distKm: phoneCall.distKm,
            driverName: phoneCall.driverName
        })]);
    }

    // Give remaining to driver
    if (phoneCall.driverId !== null) {
        const driver = mp.players.at(phoneCall.driverId);
        if (driver && mp.players.exists(driver)) {
            const remaining = phoneCall.fare - Math.ceil(phoneCall.fare / 2);
            if (remaining > 0) {
                await PlayerManager.addMoneyAndSave(driver, remaining, 'Taxi Fare Income (Final 50%)');
                driver.outputChatBox(`!{#ffc300}[TAXI] !{#ffffff}Fare income: !{#00ff00}+$${remaining}`);
                driver.outputChatBox(`!{#ffc300}[TAXI] !{#ffffff}Total earned: !{#00ff00}$${phoneCall.fare}`);
            }
        }
    }
}

// ── Fix 3: Load persisted ratings from taxi_ratings table on login ────────────
// Fires only for taxi faction members via the factionDataLoaded event,
// so non-taxi players are never touched.
mp.events.add('factionDataLoaded', async (player) => {
    if (player.factionId !== TAXI_FACTION_ID) return;
    if (!player.data || !player.data.dbId) return;

    try {
        const db = require('../../core/database');
        const [rows] = await db.query(
            'SELECT rating_total, rating_count FROM taxi_ratings WHERE user_id = ?',
            [player.data.dbId]
        );
        if (rows.length > 0) {
            player.taxiRatings = { total: rows[0].rating_total, count: rows[0].rating_count };
            const avg = (rows[0].rating_total / rows[0].rating_count).toFixed(1);
            console.log(`[Taxi] ${player.name} loaded ratings: ${avg}/5 (${rows[0].rating_count} rides)`);
        } else {
            player.taxiRatings = { total: 0, count: 0 };
        }
    } catch (e) {
        console.error('[Taxi] Failed to load ratings for', player.name, e);
        player.taxiRatings = { total: 0, count: 0 };
    }
});

// ── Fix 2: Handle call expiry cleanup on the server ──────────────────────────
mp.events.add('server:taxi:callExpired', (player) => {
    // Called when the client acknowledges the expiry; clean up their phone state
    activePhoneCalls.delete(player.id);
});

// ── Cleanup on disconnect ─────────────────────────────────────────────────────
mp.events.add('playerQuit', (player) => {
    callerCooldowns.delete(player.id);

    const phoneCall = activePhoneCalls.get(player.id);
    if (phoneCall && phoneCall.driverId !== null) {
        dispatchManager.cancelAssignment(phoneCall.driverId, 'Passenger disconnected.');
    }
    activePhoneCalls.delete(player.id);
});

module.exports = {
    activePhoneCalls,
    onDriverAccepted,
    onDriverArrived,
    onCallerBoarded,
    onRideComplete,
    countOnDutyDrivers,
    TAXI_FACTION_ID,
};