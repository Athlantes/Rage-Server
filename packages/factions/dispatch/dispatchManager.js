// packages/factions/dispatch/dispatchManager.js
const DISPATCH_CONFIGS = require('./dispatchConfig');

class DispatchManager {
    constructor() {
        // Map<factionId, Map<callId, callObject>>
        this.calls = new Map();
        this._nextCallId = 1;

        // Tracks ALL active assignments across ALL factions
        // Map<driverId, { callId, factionId, callerServerId, callerName, coords, phase, driverVehicleId }>
        this.activeAssignments = new Map();
    }

    // ── Public API (Generic for all factions) ────────────────────────────────

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
            callerServerId: callData.callerServerId ?? null,
            coords:         callData.coords,
            location:       callData.location       || 'Unknown Area',
            callType:       callData.callType       || null,
            createdAt:      Date.now(),
            acceptedBy:     null,
            // Extended data (taxi etc.)
            destCoords:     callData.destCoords     ?? null,
            destLocation:   callData.destLocation   || null,
            fare:           callData.fare           || 0,
            distKm:         callData.distKm         || 0,
        };

        this.calls.get(factionId).set(callId, call);
        console.log(`[Dispatch] New call #${callId} for faction ${factionId} — ${call.callerName} @ ${call.location}`);

        // --- Generic Chat Notification for all on-duty faction members ---
        const config = DISPATCH_CONFIGS[factionId];
        const color = config.accentColor || '#ffffff'; 
        
        mp.players.forEach(player => {
            if (player.logged && player.factionId === factionId && player.getVariable('factionDuty')) {
                player.outputChatBox(`!{${color}}!{#ffffff}${call.callerName}!{${color}} called for a dispatch in !{#ffffff}${call.location}!{${color}}.`);
            }
        });

        this._broadcastToFaction(factionId);

        return call;
    }

    acceptCall(driver, callId) {
        const factionId = driver.factionId;
        const config = DISPATCH_CONFIGS[factionId];

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

        // Register active assignment so server knows who's going where
        this.activeAssignments.set(driver.id, {
            callId,
            factionId, // Track the faction so modules (like taxi) know if it's theirs
            callerServerId: call.callerServerId,
            callerName:     call.callerName,
            coords:         call.coords,
            phase:          1,   // starts at 1 (en-route to caller)
            driverVehicleId: driver.vehicle ? driver.vehicle.id : null,
            // Extended taxi data
            destCoords:     call.destCoords || null,
            destLocation:   call.destLocation || null,
            fare:           call.fare || 0,
            distKm:         call.distKm || 0,
        });

        driver.call('client:dispatch:accepted', [JSON.stringify({
            callId,
            callerName: call.callerName,
            coords:     call.coords,
            location:   call.location,
        })]);

        // Generic Caller Notification
        if (call.callerServerId !== null) {
            const caller = mp.players.at(call.callerServerId);
            if (caller && mp.players.exists(caller)) {
                // E.g. "[TAXI] A taxi driver is on the way to you!" or "[911] An officer is responding."
                caller.outputChatBox(`!{${config.accentColor || '#ffffff'}}${config.chatTag || '[DISPATCH]'} !{#ffffff}${config.messages.onWay}`);
            }
        }

        // Hook: Notify taxi phone app when driver accepts
        if (factionId === 1) {
            try {
                const taxiCommand = require('../taxi/taxiCommand');
                taxiCommand.onDriverAccepted(call.callerServerId, driver.id, driver.name.replace(/_/g, ' '));
            } catch (e) {
                console.error('[Dispatch] Error in taxi onDriverAccepted hook:', e);
            }
        }

        this._broadcastToFaction(factionId);
        console.log(`[Dispatch] Call #${callId} accepted by ${driver.name} (ID: ${driver.id}, Faction: ${factionId})`);
    }

    cancelAssignment(driverId, reason) {
        const assignment = this.activeAssignments.get(driverId);
        if (!assignment) return;

        const config = DISPATCH_CONFIGS[assignment.factionId];
        this.activeAssignments.delete(driverId);

        const driver = mp.players.at(driverId);
        if (driver && mp.players.exists(driver)) {
            driver.call('client:dispatch:callCleared', []);
            if (reason) {
                driver.outputChatBox(`!{${config ? config.accentColor : '#ff4757'}}${config ? config.chatTag : '[DISPATCH]'} !{#ffffff}Call cancelled: ${reason}`);
            }
        }
    }

    // ── Helper Methods for Faction Modules ──────────────────────────────────

    getAssignment(driverId) {
        return this.activeAssignments.get(driverId);
    }

    getAssignmentByCaller(callerId) {
        let foundAssignment = null;
        let foundDriverId = null;

        this.activeAssignments.forEach((a, dId) => {
            if (a.callerServerId === callerId) {
                foundAssignment = a;
                foundDriverId = dId;
            }
        });

        return { assignment: foundAssignment, driverId: foundDriverId };
    }

    removeAssignment(driverId) {
        this.activeAssignments.delete(driverId);
    }

    // ── Internal System Methods ─────────────────────────────────────────────

    clearFaction(factionId) {
        this.calls.delete(factionId);
        this._broadcastToFaction(factionId);
    }

    removePendingCall(factionId, callId) {
        if (!this.calls.has(factionId)) return;
        this.calls.get(factionId).delete(callId);
        this._broadcastToFaction(factionId);
    }

    getCallsForFaction(factionId) {
        if (!this.calls.has(factionId)) return [];
        const arr = Array.from(this.calls.get(factionId).values());
        return arr.sort((a, b) => a.createdAt - b.createdAt);
    }

    openForPlayer(player) {
        const factionId = player.factionId;

        if (!factionId) {
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
                destLocation: call.destLocation || '',
                fare:        call.fare || 0,
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

// ── Global Server Events (Generic for all dispatch) ───────────────────────────

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

mp.events.add('playerExitVehicle', (player) => {
    if (player.getVariable('dispatchOpen')) {
        player.setVariable('dispatchOpen', false);
        player.call('client:dispatch:close', []);
    }
});

// Cancel active run if the caller disconnects
mp.events.add('playerQuit', (player) => {
    manager.activeAssignments.forEach((assignment, driverId) => {
        if (assignment.callerServerId === player.id) {
            manager.cancelAssignment(driverId, 'Caller disconnected.');
        }
    });
});