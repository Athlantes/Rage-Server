'use strict';

let isOnTrainJob = false;
let currentSpeedCap = 0;
let isAtStation = false;
let stationDwellEndTime = 0;
let lastDwellSubtitleSecond = -1;

let stationBlip = null;
let stationMarker = null;

let jobEngineId = null;
let jobCarriageIds = [];
let speedInterval = null;

const VEHICLE_CLASS_TRAIN = 21;
const CONTROL_EXIT_VEHICLE = 75;
const EXIT_ALLOW_SPEED = 1.0; 

// ── FIXED: Added native track-snapping ───────────────────────────────────────
mp.events.add('client:train:setupJob', (engineId, carriageIds, cap) => {
    jobEngineId = engineId;
    jobCarriageIds = carriageIds;
    currentSpeedCap = cap;
    isOnTrainJob = (cap > 0);

    if (speedInterval) clearInterval(speedInterval);

    if (cap > 0) {
        mp.gui.chat.push(`!{00BFFF}[LSRR] Speed limiter active — max ${(cap * 3.6).toFixed(0)} km/h.`);
        
        let player = mp.players.local;
        let vehicle = player.vehicle;
        
        // Force the train to snap to the nearest rail node the moment you enter
        if (vehicle && vehicle.getClass() === VEHICLE_CLASS_TRAIN) {
            // Replaced invoke with RAGE:MP function
            vehicle.setMissionTrainCoords(vehicle.position.x, vehicle.position.y, vehicle.position.z);
        }
        
        // Safely enforce the speed cap every 1 second
        speedInterval = setInterval(() => {
            if (!isOnTrainJob) {
                clearInterval(speedInterval);
                speedInterval = null;
                return;
            }

            let currentVehicle = mp.players.local.vehicle;
            
            if (currentVehicle && currentVehicle.getClass() === VEHICLE_CLASS_TRAIN) {
                // Replaced invoke with RAGE:MP function for the Engine
                currentVehicle.setTrainCruiseSpeed(currentSpeedCap);
                
                // Keep carriages synced if they exist
                jobCarriageIds.forEach(remoteId => {
                    let carriage = mp.vehicles.atRemoteId(remoteId);
                    if (carriage && carriage.handle !== 0) {
                        // Replaced invoke with RAGE:MP function for Carriages
                        carriage.setTrainCruiseSpeed(currentSpeedCap);
                    }
                });
            }
        }, 1000);
    }
});

// ── Render loop now only handles UI and disabling exits safely ───────────────
mp.events.add('render', () => {
    if (!isOnTrainJob) return;

    const player = mp.players.local;
    const vehicle = player.vehicle;

    if (!vehicle || vehicle.getClass() !== VEHICLE_CLASS_TRAIN) return;
    
    // Prevent bailing out of a moving train (causes glitches)
    if (vehicle.getSpeed() > EXIT_ALLOW_SPEED) {
        mp.game.controls.disableControlAction(0, CONTROL_EXIT_VEHICLE, true);
    }

    // Handle Station Loading UI
    if (isAtStation && stationDwellEndTime > 0) {
        const remaining = Math.max(0, stationDwellEndTime - Date.now());
        const secs = Math.ceil(remaining / 1000);

        if (secs !== lastDwellSubtitleSecond) {
            lastDwellSubtitleSecond = secs;
            mp.game.ui.setTextEntry('STRING');
            mp.game.ui.addTextComponentSubstringPlayerName(`~b~Loading / Unloading~w~ — ${secs}s remaining`);
            mp.game.ui.drawSubtitleTimed(1500, true);
        }

        if (remaining <= 0) {
            isAtStation = false;
            stationDwellEndTime = 0;
            lastDwellSubtitleSecond = -1;
        }
    }
});

mp.events.add('client:train:setStation', (stationName, x, y, z) => {
    clearStationObjectives();
    const pos = new mp.Vector3(x, y, z);

    stationBlip = mp.blips.new(326, pos, { name: stationName, color: 5, scale: 1.1, shortRange: false, dimension: mp.players.local.dimension });
    stationBlip.setRoute(true);
    stationBlip.setRouteColour(5);

    stationMarker = mp.markers.new(1, new mp.Vector3(x, y, z - 1.0), 6.0, { color: [50, 150, 255, 160], visible: true, dimension: mp.players.local.dimension });

    isAtStation = false;
    lastDwellSubtitleSecond = -1;
});

mp.events.add('client:train:arrived', (stationName, dwellMs) => {
    if (stationBlip && mp.blips.exists(stationBlip)) stationBlip.setRoute(false);
    if (stationMarker && mp.markers.exists(stationMarker)) {
        stationMarker.destroy();
        stationMarker = null;
    }

    isAtStation = true;
    stationDwellEndTime = Date.now() + dwellMs;
    lastDwellSubtitleSecond = -1;

    mp.game.audio.playSoundFrontend(-1, 'WAYPOINT_SET', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true);
    mp.gui.chat.push(`!{00BFFF}[LSRR] Arrived at ${stationName}. Loading/unloading in progress…`);
});

mp.events.add('client:train:routeComplete', () => {
    clearStationObjectives();
    isAtStation = false;
    stationDwellEndTime = 0;
    lastDwellSubtitleSecond = -1;
    mp.game.audio.playSoundFrontend(-1, 'CHECKPOINT_PERFECT', 'HUD_AWARDS', true);
});

function clearStationObjectives() {
    if (stationBlip && mp.blips.exists(stationBlip)) stationBlip.destroy();
    stationBlip = null;
    if (stationMarker && mp.markers.exists(stationMarker)) stationMarker.destroy();
    stationMarker = null;
}