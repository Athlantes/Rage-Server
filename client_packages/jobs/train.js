// =============================================================================
//  client_packages/jobs/train.js
//  Train Driver Job — Client Side
//
//  RESPONSIBILITIES:
//    1. render loop  — Speed cap via SET_TRAIN_CRUISE_SPEED + SET_VEHICLE_MAX_SPEED
//                    — Disable "exit vehicle" control while the train is moving
//                    — Show dwell countdown subtitle while at a station
//    2. Station visuals — Blip + marker managed here (not via manager.js),
//                         created/destroyed on server events
//    3. Sound feedback  — Plays audio cues on arrival and route completion
//
//  HOW SPEED CAP WORKS:
//    The server sends the cap value (m/s) via `client:train:setSpeedCap`.
//    Every render frame, if the train exceeds the cap, two RAGE:MP vehicle
//    methods are called:
//      • vehicle.setTrainCruiseSpeed(cap) — train-specific throttle limiter
//      • vehicle.setMaxSpeed(cap)         — hard speed ceiling (fallback)
//    Using both ensures the cap works whether RageMP treats the `freight`
//    model as a train entity or a standard vehicle.
//
//  ADD THIS FILE:
//    The main client_packages/index.js already has a jobs section.
//    Add:  require('./jobs/train.js');   after the existing job requires.
// =============================================================================

'use strict';

// ---------------------------------------------------------------------------
//  STATE
// ---------------------------------------------------------------------------

/** True only while the local player has an active train job session. */
let isOnTrainJob = false;

/**
 * Speed cap received from the server (m/s).
 * 0 = disabled.  Set via `client:train:setSpeedCap`.
 */
let currentSpeedCap = 0;

/**
 * Whether the local player is currently in a station dwell period.
 * Used by the render loop to decide whether to show the countdown.
 */
let isAtStation = false;

/** Absolute timestamp (ms) when the current dwell period ends. */
let stationDwellEndTime = 0;

/**
 * Tracks the last whole-second value shown in the dwell countdown,
 * so we only call drawSubtitleTimed once per second rather than every frame.
 */
let lastDwellSubtitleSecond = -1;

/** Currently active station blip (mp.Blip).  null when none. */
let stationBlip = null;

/** Currently active station marker (mp.Marker).  null when none. */
let stationMarker = null;

// ---------------------------------------------------------------------------
//  GTA V CONSTANTS
// ---------------------------------------------------------------------------

/** Vehicle class for trains (freight, metrotrain, etc.). */
const VEHICLE_CLASS_TRAIN = 21;

/**
 * Control action 75 — INPUT_EXIT_VEHICLE (default: F / Y on controller).
 * Disabled while the train is moving to prevent accidental ejection, which
 * can desync the server-side entity and cause client-side physics glitches.
 */
const CONTROL_EXIT_VEHICLE = 75;

/**
 * Speed threshold (m/s) below which the exit-vehicle control is re-enabled.
 * Trains are considered "stopped" below this speed.
 * ~3.6 km/h — slow enough that an intentional dismount is safe.
 */
const EXIT_ALLOW_SPEED = 1.0; // m/s

// ---------------------------------------------------------------------------
//  RENDER LOOP  (runs every frame)
// ---------------------------------------------------------------------------

mp.events.add('render', () => {
    // Early-exit: only process while the player has an active train job
    if (!isOnTrainJob) return;

    const player  = mp.players.local;
    const vehicle = player.vehicle;

    // Not in a vehicle — nothing to do
    if (!vehicle) return;

    // Only apply train logic to train-class vehicles
    if (vehicle.getClass() !== VEHICLE_CLASS_TRAIN) return;

    // ── Driver-seat check ─────────────────────────────────────────────────
    // Only the driver should apply speed control.
    // getPedInSeat(-1) returns the ped object (or handle) occupying the
    // driver's seat. We compare against the local player's handle.
    // NOTE: getPedInSeat will crash on trailer models — safe here because
    // `freight` is not a trailer.
    const driverPed = vehicle.getPedInSeat(-1);
    if (!driverPed || driverPed !== player.handle) return;

    const currentSpeed = vehicle.getSpeed(); // m/s

    // ── Speed cap ─────────────────────────────────────────────────────────
    if (currentSpeedCap > 0 && currentSpeed > currentSpeedCap) {
        // Primary: train-specific method — controls the engine throttle target
        vehicle.setTrainCruiseSpeed(currentSpeedCap);

        // Fallback: hard vehicle speed ceiling — works even if the freight
        // model is treated as a regular vehicle rather than a train entity
        vehicle.setMaxSpeed(currentSpeedCap);
    }

    // ── Disable exit-vehicle control while the train is moving ───────────
    // Prevents players from accidentally pressing F/Y at speed, which would
    // ragdoll them and leave the server-side train entity driverless.
    if (currentSpeed > EXIT_ALLOW_SPEED) {
        // disableControlAction(inputGroup, control, disable)
        // inputGroup 0 = regular gameplay controls
        mp.game.controls.disableControlAction(0, CONTROL_EXIT_VEHICLE, true);
    }

    // ── Dwell countdown subtitle ──────────────────────────────────────────
    // Shows "Loading/Unloading — Xs remaining" while at a station.
    // We only refresh the subtitle once per whole second to avoid flickering.
    if (isAtStation && stationDwellEndTime > 0) {
        const remaining = Math.max(0, stationDwellEndTime - Date.now());
        const secs      = Math.ceil(remaining / 1000);

        if (secs !== lastDwellSubtitleSecond) {
            lastDwellSubtitleSecond = secs;

            // drawSubtitleTimed duration is set to 1 500 ms so each call
            // overlaps slightly, preventing a blank frame between updates.
            mp.game.ui.setTextEntry('STRING');
            mp.game.ui.addTextComponentSubstringPlayerName(
                `~b~Loading / Unloading~w~ — ${secs}s remaining`
            );
            mp.game.ui.drawSubtitleTimed(1500, true);
        }

        // When the countdown hits zero, clear the dwell state.
        // The server will send dispatchNextStation shortly after.
        if (remaining <= 0) {
            isAtStation             = false;
            stationDwellEndTime     = 0;
            lastDwellSubtitleSecond = -1;
        }
    }
});

// ---------------------------------------------------------------------------
//  SERVER → CLIENT EVENTS
// ---------------------------------------------------------------------------

/**
 * server sends speed cap (m/s) when the job starts.
 * Also acts as the job "active" flag for the render loop.
 *
 * @param {number} cap  Speed cap in m/s.  Pass 0 to disable.
 */
mp.events.add('client:train:setSpeedCap', (cap) => {
    currentSpeedCap = cap;
    isOnTrainJob    = (cap > 0);

    if (cap > 0) {
        mp.gui.chat.push(
            `!{00BFFF}[LSRR] Speed limiter active — max ${(cap * 3.6).toFixed(0)} km/h.`
        );
    }
});

// ---------------------------------------------------------------------------

/**
 * Server sends the name and world position of the next target station.
 * Creates a blip with route highlighting and a large cylinder marker.
 * Clears any previous station objective visuals first.
 *
 * @param {string} stationName  Human-readable station name for the blip label
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
mp.events.add('client:train:setStation', (stationName, x, y, z) => {
    // Always clear the previous station's visuals first
    clearStationObjectives();

    const pos = new mp.Vector3(x, y, z);

    // ── Station blip ──────────────────────────────────────────────────────
    // Sprite 326 = train icon; color 5 = yellow
    stationBlip = mp.blips.new(326, pos, {
        name:       stationName,
        color:      5,
        scale:      1.1,
        shortRange: false,
        dimension:  mp.players.local.dimension,
    });

    // Activate minimap route so the GPS draws a path to the station
    stationBlip.setRoute(true);
    stationBlip.setRouteColour(5);

    // ── Station marker ────────────────────────────────────────────────────
    // Type 1 = upward-pointing cylinder arrow; placed 1 unit below world pos
    // so the base aligns with the rail surface.
    stationMarker = mp.markers.new(1, new mp.Vector3(x, y, z - 1.0), 6.0, {
        color:     [50, 150, 255, 160],  // RGBA — semi-transparent blue
        visible:   true,
        dimension: mp.players.local.dimension,
    });

    // Reset dwell state for this new stop
    isAtStation             = false;
    lastDwellSubtitleSecond = -1;
});

// ---------------------------------------------------------------------------

/**
 * Server fires this when the train enters the station colshape.
 * Transitions the visuals from "approach mode" to "dwell mode":
 *   • Removes the GPS route + approach marker (we're already here)
 *   • Starts the dwell countdown timer in the render loop
 *   • Plays an arrival sound cue
 *
 * @param {string} stationName  Used for the chat confirmation message
 * @param {number} dwellMs      Duration of the dwell period in milliseconds
 */
mp.events.add('client:train:arrived', (stationName, dwellMs) => {
    // ── Remove approach visuals ───────────────────────────────────────────
    // Turn off the GPS route highlight — we've arrived
    if (stationBlip && mp.blips.exists(stationBlip)) {
        stationBlip.setRoute(false);
    }

    // Destroy the large approach marker
    if (stationMarker && mp.markers.exists(stationMarker)) {
        stationMarker.destroy();
        stationMarker = null;
    }

    // ── Start dwell countdown ─────────────────────────────────────────────
    isAtStation             = true;
    stationDwellEndTime     = Date.now() + dwellMs;
    lastDwellSubtitleSecond = -1;

    // ── Sound cue ─────────────────────────────────────────────────────────
    // "WAYPOINT_SET" plays the standard GPS destination-reached chime
    mp.game.audio.playSoundFrontend(-1, 'WAYPOINT_SET', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true);

    mp.gui.chat.push(`!{00BFFF}[LSRR] Arrived at ${stationName}. Loading/unloading in progress…`);
});

// ---------------------------------------------------------------------------

/**
 * Server fires this when:
 *   (a) The full route is complete (all stations visited), OR
 *   (b) The job is stopped for any reason (stopwork, vehicle destroyed, etc.)
 *
 * Clears all station visuals and resets dwell state.
 */
mp.events.add('client:train:routeComplete', () => {
    clearStationObjectives();

    // Reset dwell state
    isAtStation             = false;
    stationDwellEndTime     = 0;
    lastDwellSubtitleSecond = -1;

    // ── Route completion sound cue ────────────────────────────────────────
    mp.game.audio.playSoundFrontend(-1, 'CHECKPOINT_PERFECT', 'HUD_AWARDS', true);
});

// ---------------------------------------------------------------------------
//  HELPERS
// ---------------------------------------------------------------------------

/**
 * Destroys the current station blip and marker if they exist.
 * Safe to call multiple times.
 */
function clearStationObjectives() {
    if (stationBlip && mp.blips.exists(stationBlip)) {
        stationBlip.destroy();
    }
    stationBlip = null;

    if (stationMarker && mp.markers.exists(stationMarker)) {
        stationMarker.destroy();
    }
    stationMarker = null;
}