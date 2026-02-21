// packages/factions/dispatch/dispatchManager.js
// ─────────────────────────────────────────────────────────────────────────────
// DispatchManager — server-side brain of the dispatch system.
//
// Responsibilities:
//   • Store active calls per faction in memory
//   • Accept a new call (from /calltaxi or any future command)
//   • Broadcast the updated call list to all on-duty faction drivers
//   • Handle Accept → assign driver, remove call, set waypoint, notify caller
//   • Expose helpers for adding faction-specific call types
// ─────────────────────────────────────────────────────────────────────────────

const DISPATCH_CONFIGS = require('./dispatchConfig');

class DispatchManager {
    constructor() {
        // Map<factionId, Map<callId, callObject>>
        this.calls = new Map();
        this._nextCallId = 1;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Add a new dispatch call for a faction.
     * @param {number} factionId
     * @param {object} callData  - { callerName, callerServerId, coords, location, callType? }
     * @returns {object} the created call
     */
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
            id: callId,
            factionId,
            callerName: callData.callerName || 'Unknown',
            callerServerId: callData.callerServerId || null,  // RAGEMP server ID for notification
            coords: callData.coords,                           // { x, y, z }
            location: callData.location || 'Unknown Area',
            callType: callData.callType || null,
            createdAt: Date.now(),
            acceptedBy: null,
        };

        this.calls.get(factionId).set(callId, call);

        console.log(`[Dispatch] New call #${callId} for faction ${factionId} — ${call.callerName} @ ${call.location}`);

        // Broadcast to all eligible drivers
        this._broadcastToFaction(factionId);

        return call;
    }

    /**
     * A driver accepts a call.
     * @param {object} driver - RAGEMP player object
     * @param {number} callId
     */
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

        // Assign to this driver
        call.acceptedBy = driver.id;
        factionCalls.delete(callId);

        // 1. Close menu & set waypoint for the driver
        driver.call('client:dispatch:accepted', [JSON.stringify({
            callId,
            callerName: call.callerName,
            coords: call.coords,
            location: call.location,
        })]);

        // 2. Notify the caller (if still online)
        if (call.callerServerId !== null) {
            const caller = mp.players.at(call.callerServerId);
            if (caller && mp.players.exists(caller)) {
                caller.outputChatBox(`!{#ffc300}[TAXI] A taxi driver is on the way to you! ETA coming soon.`);
                caller.call('client:dispatch:callerNotified', [driver.name]);
            }
        }

        // 3. Broadcast updated list (call removed) to all other drivers
        this._broadcastToFaction(factionId);

        console.log(`[Dispatch] Call #${callId} accepted by ${driver.name} (ID: ${driver.id})`);
    }

    /**
     * Remove all calls for a faction (e.g., server reset).
     */
    clearFaction(factionId) {
        this.calls.delete(factionId);
        this._broadcastToFaction(factionId);
    }

    /**
     * Get all active calls for a faction as a sorted array.
     * Sorted oldest → newest so drivers see the most urgent calls first.
     */
    getCallsForFaction(factionId) {
        if (!this.calls.has(factionId)) return [];
        const arr = Array.from(this.calls.get(factionId).values());
        return arr.sort((a, b) => a.createdAt - b.createdAt);
    }

    // ── Open Menu Request (called when player presses P) ──────────────────────

    /**
     * Validate and send dispatch data to a player.
     * Returns false if player is not eligible.
     */
    openForPlayer(player) {
        const factionId = player.factionId;

        // Must be in a faction
        if (!factionId || factionId === 0) {
            player.outputChatBox('!{#ff4757}You are not in a faction.');
            return false;
        }

        // Must have a dispatch config for this faction
        if (!DISPATCH_CONFIGS[factionId]) {
            return false; // Silently ignore factions without dispatch
        }

        // Must be on duty
        if (!player.getVariable('factionDuty')) {
            player.outputChatBox('!{#ff4757}You must be on duty to use dispatch.');
            return false;
        }

        // Must be in a faction vehicle (driver seat)
        const vehicle = player.vehicle;
        if (!vehicle) {
            player.outputChatBox('!{#ff4757}You must be in a faction vehicle to use dispatch.');
            return false;
        }

        if (vehicle.getVariable('factionId') !== factionId) {
            player.outputChatBox('!{#ff4757}You must be in a faction vehicle to use dispatch.');
            return false;
        }

        // All checks passed — build and send payload
        this._sendToPlayer(player);
        return true;
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    /**
     * Broadcast the current call list to all eligible drivers of a faction.
     * "Eligible" = on duty + in a faction vehicle.
     * Also used to push real-time updates (e.g. after a call is accepted).
     */
    _broadcastToFaction(factionId) {
        mp.players.forEach(player => {
            if (!player.getVariable('loggedIn')) return;
            if (player.factionId !== factionId) return;
            if (!player.getVariable('factionDuty')) return;

            const vehicle = player.vehicle;
            if (!vehicle) return;
            if (vehicle.getVariable('factionId') !== factionId) return;

            // Only push if the player currently has the dispatch menu open
            if (player.getVariable('dispatchOpen')) {
                this._sendToPlayer(player);
            }
        });
    }

    /**
     * Build the full payload and send it to one player.
     */
    _sendToPlayer(player) {
        const factionId = player.factionId;
        const config = DISPATCH_CONFIGS[factionId];
        const rawCalls = this.getCallsForFaction(factionId);

        // Compute distance from this player to each call
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
                id: call.id,
                callerName: call.callerName,
                location: call.location,
                callType: call.callType,
                distanceRaw: distMeters,
                distance: distMeters >= 1000
                    ? (distMeters / 1000).toFixed(1) + ' km'
                    : distMeters + ' m',
                waitTime: waitSecs < 60
                    ? waitSecs + 's'
                    : Math.floor(waitSecs / 60) + 'm ' + (waitSecs % 60) + 's',
                coords: call.coords,
            };
        });

        const payload = {
            config: {
                title: config.title,
                subtitle: config.subtitle,
                accentColor: config.accentColor,
                icon: config.icon,
                columns: config.columns,
                actionButton: config.actionButton,
                emptyMessage: config.emptyMessage,
                emptyIcon: config.emptyIcon,
            },
            calls: callsWithDistance,
        };

        player.call('client:dispatch:open', [JSON.stringify(payload)]);
    }
}

const manager = new DispatchManager();
module.exports = manager;

// ── Global Server Events ──────────────────────────────────────────────────────

// Player presses P and requests dispatch
mp.events.add('server:dispatch:open', (player) => {
    const wasOpen = player.getVariable('dispatchOpen');

    if (wasOpen) {
        // Toggle off — close the menu
        player.setVariable('dispatchOpen', false);
        player.call('client:dispatch:close', []);
        return;
    }

    const success = manager.openForPlayer(player);
    if (success) {
        player.setVariable('dispatchOpen', true);
    }
});

// Player closes dispatch menu (X button or Escape)
mp.events.add('server:dispatch:close', (player) => {
    player.setVariable('dispatchOpen', false);
});

// Player accepts a call
mp.events.add('server:dispatch:accept', (player, callIdStr) => {
    const callId = parseInt(callIdStr);
    if (isNaN(callId)) return;

    // Validate player is still eligible before accepting
    if (!player.getVariable('factionDuty') || !player.vehicle) {
        player.call('client:dispatch:error', ['You must be on duty in a faction vehicle.']);
        return;
    }

    player.setVariable('dispatchOpen', false);
    manager.acceptCall(player, callId);
});

// Clean up when player leaves vehicle or goes off duty
mp.events.add('playerExitVehicle', (player) => {
    if (player.getVariable('dispatchOpen')) {
        player.setVariable('dispatchOpen', false);
        player.call('client:dispatch:close', []);
    }
});
