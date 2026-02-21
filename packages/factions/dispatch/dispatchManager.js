// packages/factions/dispatch/dispatchManager.js
// ─────────────────────────────────────────────────────────────────────────────

const DISPATCH_CONFIGS = require('./dispatchConfig');

class DispatchManager {
    constructor() {
        // Map<factionId, Map<callId, callObject>>
        this.calls = new Map();
        this._nextCallId = 1;

        // FIX A – track which driver has which active call
        // Map<driverId, { callId, callerServerId, callerName, coords }>
        this.activeAssignments = new Map();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    addCall(factionId, callData) {
        if (!DISPATCH_CONFIGS[factionId]) {
            console.warn(`[Dispatch] No config for factionId ${factionId}`);
            return null;
        }

        if (!this.calls.has(factionId)) {
            this.calls.set(factionId, new Map());
        }

        const callId = this._nextCallId++;
        const call = {
            id:             callId,
            factionId,
            callerName:     callData.callerName     || 'Unknown',
            callerServerId: callData.callerServerId || null,
            coords:         callData.coords,
            location:       callData.location       || 'Unknown Area',
            callType:       callData.callType        || null,
            createdAt:      Date.now(),
            acceptedBy:     null,
        };

        this.calls.get(factionId).set(callId, call);
        console.log(`[Dispatch] New call #${callId} for faction ${factionId} — ${call.callerName} @ ${call.location}`);

        const config = DISPATCH_CONFIGS[factionId];
        const color = config.accentColor || '#ffc300'; 
        
        mp.players.forEach(player => {
            if (player.logged && player.factionId === factionId && player.getVariable('factionDuty')) {
                player.outputChatBox(`!{${color}}[Dispatch] !{#ffffff}${call.callerName}!{${color}} called for a taxi in !{#ffffff}${call.location}!{${color}}.`);
            }
        });
        // -----------------------------------

        this._broadcastToFaction(factionId);

        return call;
    }

    acceptCall(driver, callId) {
        const factionId = driver.factionId;

        if (!this.calls.has(factionId)) return;

        const factionCalls = this.calls.get(factionId);
        const call = factionCalls.get(callId);

        if (!call) {
            driver.call('client:dispatch:error', ['This call no longer exists.']);
            return;
        }

        if (call.acceptedBy !== null) {
            driver.call('client:dispatch:error', ['This call was just taken by someone else.']);
            return;
        }

        call.acceptedBy = driver.id;
        factionCalls.delete(callId);

        this.activeAssignments.set(driver.id, {
            callId,
            callerServerId: call.callerServerId,
            callerName:     call.callerName,
            coords:         call.coords,
            phase:          1,
            driverVehicleId: driver.vehicle ? driver.vehicle.id : null,
        });

        driver.call('client:dispatch:accepted', [JSON.stringify({
            callId,
            callerName: call.callerName,
            coords:     call.coords,
            location:   call.location,
        })]);

        if (call.callerServerId !== null) {
            const caller = mp.players.at(call.callerServerId);
            if (caller && mp.players.exists(caller)) {
                caller.outputChatBox(`!{#ffc300}[TAXI] A taxi driver is on the way to you!`);
                caller.call('client:dispatch:callerNotified', [driver.name]);
            }
        }

        this._broadcastToFaction(factionId);
        console.log(`[Dispatch] Call #${callId} accepted by ${driver.name} (ID: ${driver.id})`);
    }

    // Phase 2 – driver arrived at pickup, notify caller to board
    driverArrived(driver) {
        const a = this.activeAssignments.get(driver.id);
        if (!a) return;

        a.phase = 2;
        // Refresh vehicle ID in case driver spawned a new cab after accepting
        a.driverVehicleId = driver.vehicle ? driver.vehicle.id : null;

        if (a.callerServerId !== null) {
            const caller = mp.players.at(a.callerServerId);
            if (caller && mp.players.exists(caller)) {
                caller.outputChatBox('!{#00e676}[TAXI] Your driver has arrived! Get in the yellow cab.');
            }
        }

        console.log('[Dispatch] Driver ' + driver.name + ' arrived at pickup for call #' + a.callId);
    }

    // Phase 3 – caller boarded (detected via playerEnterVehicle server event)
    callerBoarded(callerPlayer, vehicle) {
        let assignment = null;
        let driverId   = null;

        this.activeAssignments.forEach((a, dId) => {
            if (
                a.callerServerId === callerPlayer.id &&
                a.phase === 2 &&
                a.driverVehicleId === vehicle.id
            ) {
                assignment = a;
                driverId   = dId;
            }
        });

        if (!assignment || driverId === null) return;

        assignment.phase = 3;

        // Tell the driver their HUD should advance to phase 3
        const driver = mp.players.at(driverId);
        if (driver && mp.players.exists(driver)) {
            driver.call('client:taxi:callerBoarded', []);
        }

        // Prompt the caller to set a waypoint
        callerPlayer.call('client:taxi:promptWaypoint', []);

        console.log('[Dispatch] Caller boarded for call #' + assignment.callId + ', waiting for waypoint');
    }

    // Phase 4 – caller set waypoint, send destination to driver
    waypointSet(caller, x, y, z, location) {
        let targetAssignment = null;
        let driverId = null;

        this.activeAssignments.forEach((a, dId) => {
            if (a.callerServerId === caller.id) {
                targetAssignment = a;
                driverId = dId;
            }
        });

        if (!targetAssignment || driverId === null) return;

        targetAssignment.phase = 4;
        targetAssignment.destCoords = { x, y, z };
        targetAssignment.destLocation = location;

        const driver = mp.players.at(driverId);
        if (driver && mp.players.exists(driver)) {
            driver.call('client:taxi:setDestination', [JSON.stringify({
                coords: { x, y, z },
                location: location || 'Unknown Area',
            })]);
        }

        console.log('[Dispatch] Destination set for call #' + targetAssignment.callId + ': ' + location);
    }

    // Phase 5 – driver reached destination
    rideComplete(driver) {
        const a = this.activeAssignments.get(driver.id);
        if (!a) return;

        this.activeAssignments.delete(driver.id);

        if (a.callerServerId !== null) {
            const caller = mp.players.at(a.callerServerId);
            if (caller && mp.players.exists(caller)) {
                caller.outputChatBox('!{#00e676}[TAXI] You have arrived at your destination. Thanks for riding!');
            }
        }

        console.log('[Dispatch] Ride #' + a.callId + ' completed by ' + driver.name);
    }

    // FIX C – cancel an active assignment (caller quit, admin cancel, etc.)
    cancelAssignment(driverId, reason) {
        const assignment = this.activeAssignments.get(driverId);
        if (!assignment) return;

        this.activeAssignments.delete(driverId);

        const driver = mp.players.at(driverId);
        if (driver && mp.players.exists(driver)) {
            driver.call('client:dispatch:callCleared', []);
            if (reason) {
                driver.outputChatBox(`!{#ff4757}[TAXI] Call cancelled: ${reason}`);
            }
        }
    }

    clearFaction(factionId) {
        this.calls.delete(factionId);
        this._broadcastToFaction(factionId);
    }

    getCallsForFaction(factionId) {
        if (!this.calls.has(factionId)) return [];
        const arr = Array.from(this.calls.get(factionId).values());
        return arr.sort((a, b) => a.createdAt - b.createdAt);
    }

    openForPlayer(player) {
        const factionId = player.factionId;

        if (!factionId || factionId === 0) {
            player.outputChatBox('!{#ff4757}You are not in a faction.');
            return false;
        }

        if (!DISPATCH_CONFIGS[factionId]) return false;

        if (!player.getVariable('factionDuty')) {
            player.outputChatBox('!{#ff4757}You must be on duty to use dispatch.');
            return false;
        }

        const vehicle = player.vehicle;
        if (!vehicle) {
            player.outputChatBox('!{#ff4757}You must be in a faction vehicle to use dispatch.');
            return false;
        }

        if (vehicle.getVariable('factionId') !== factionId) {
            player.outputChatBox('!{#ff4757}You must be in a faction vehicle to use dispatch.');
            return false;
        }

        this._sendToPlayer(player);
        return true;
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    _broadcastToFaction(factionId) {
        mp.players.forEach(player => {
            if (!player.logged) return;
            if (player.factionId !== factionId) return;
            if (!player.getVariable('factionDuty')) return;

            const vehicle = player.vehicle;
            if (!vehicle) return;
            if (vehicle.getVariable('factionId') !== factionId) return;

            if (player.getVariable('dispatchOpen')) {
                this._sendToPlayer(player);
            }
        });
    }

    _sendToPlayer(player) {
        const factionId = player.factionId;
        const config    = DISPATCH_CONFIGS[factionId];
        const rawCalls  = this.getCallsForFaction(factionId);

        const callsWithDistance = rawCalls.map(call => {
            let distMeters = 9999;
            if (call.coords && player.position) {
                const dx = call.coords.x - player.position.x;
                const dy = call.coords.y - player.position.y;
                const dz = call.coords.z - player.position.z;
                distMeters = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz));
            }

            const waitSecs = Math.round((Date.now() - call.createdAt) / 1000);

            return {
                id:          call.id,
                callerName:  call.callerName,
                location:    call.location,
                callType:    call.callType,
                distanceRaw: distMeters,
                distance:    distMeters >= 1000
                                 ? (distMeters / 1000).toFixed(1) + ' km'
                                 : distMeters + ' m',
                waitTime:    waitSecs < 60
                                 ? waitSecs + 's'
                                 : Math.floor(waitSecs / 60) + 'm ' + (waitSecs % 60) + 's',
                coords:      call.coords,
            };
        });

        const payload = {
            config: {
                title:        config.title,
                subtitle:     config.subtitle,
                accentColor:  config.accentColor,
                icon:         config.icon,
                columns:      config.columns,
                actionButton: config.actionButton,
                emptyMessage: config.emptyMessage,
                emptyIcon:    config.emptyIcon,
            },
            calls: callsWithDistance,
        };

        player.call('client:dispatch:open', [JSON.stringify(payload)]);
    }
}

const manager = new DispatchManager();
module.exports = manager;

// ── Global Server Events ──────────────────────────────────────────────────────

mp.events.add('server:dispatch:open', (player) => {
    const wasOpen = player.getVariable('dispatchOpen');

    if (wasOpen) {
        player.setVariable('dispatchOpen', false);
        player.call('client:dispatch:close', []);
        return;
    }

    const success = manager.openForPlayer(player);
    if (success) {
        player.setVariable('dispatchOpen', true);
    }
});

mp.events.add('server:dispatch:close', (player) => {
    player.setVariable('dispatchOpen', false);
});

mp.events.add('server:dispatch:accept', (player, callIdStr) => {
    const callId = parseInt(callIdStr);
    if (isNaN(callId)) return;

    if (!player.getVariable('factionDuty') || !player.vehicle) {
        player.call('client:dispatch:error', ['You must be on duty in a faction vehicle.']);
        return;
    }

    player.setVariable('dispatchOpen', false);
    manager.acceptCall(player, callId);
});

// FIX B – driver arrived event from client tick
mp.events.add('server:dispatch:driverArrived', (player) => {
    manager.driverArrived(player);
});

mp.events.add('playerExitVehicle', (player) => {
    if (player.getVariable('dispatchOpen')) {
        player.setVariable('dispatchOpen', false);
        player.call('client:dispatch:close', []);
    }
});

// FIX D – if a caller disconnects, cancel the driver's active run
mp.events.add('playerQuit', (player) => {
    // Check if this disconnecting player is someone's caller
    manager.activeAssignments.forEach((assignment, driverId) => {
        if (assignment.callerServerId === player.id) {
            manager.cancelAssignment(driverId, 'Caller disconnected.');
        }
    });
});

// Phase 2 → 3: server detects caller entered the driver's vehicle
// Uses playerEnterVehicle so we match on the actual player object — no NPC false-positives
mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
    // Only care about passenger seats (seat -1 = driver)
    if (seat === -1) return;
    if (!player.logged) return;

    // Check if this player is a caller in any active assignment (phase 2)
    manager.callerBoarded(player, vehicle);
});

// Phase 3 → 4: caller placed their waypoint
mp.events.add('server:dispatch:waypointSet', (player, x, y, z, location) => {
    manager.waypointSet(player, parseFloat(x), parseFloat(y), parseFloat(z), location);
});

// Phase 4 → 5: driver reached the drop-off zone
mp.events.add('server:dispatch:rideComplete', (player) => {
    manager.rideComplete(player);
});