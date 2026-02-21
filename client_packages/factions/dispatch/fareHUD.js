// client_packages/factions/dispatch/fareHUD.js
// ─────────────────────────────────────────────────────────────────────────────
// Manages the "Active Fare" HUD strip shown after a driver accepts a dispatch call.
// Communicates with the overlay browser (overlay.html) to show/hide the strip.
// ─────────────────────────────────────────────────────────────────────────────

let activeFare = null;
let fareDistInterval = null;

// ── Show fare HUD when call accepted ─────────────────────────────────────────
mp.events.add('dispatch:showFareHUD', (data) => {
    activeFare = data;

    // Tell overlay to show the fare HUD strip
    const overlayBrowser = global.overlayBrowser || null;
    if (overlayBrowser) {
        overlayBrowser.execute(`showFareHUD(${JSON.stringify(data)})`);
    }

    // Update distance every 2 seconds while fare is active
    if (fareDistInterval) clearInterval(fareDistInterval);
    fareDistInterval = setInterval(() => {
        if (!activeFare || !activeFare.coords) return;

        const player = mp.players.local;
        const pos = player.position;
        const dx = activeFare.coords.x - pos.x;
        const dy = activeFare.coords.y - pos.y;
        const dz = activeFare.coords.z - pos.z;
        const distMeters = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz));

        const distStr = distMeters >= 1000
            ? (distMeters / 1000).toFixed(1) + ' km'
            : distMeters + ' m';

        const overlay = global.overlayBrowser || null;
        if (overlay) {
            overlay.execute(`updateFareDistance(${JSON.stringify(distStr)})`);
        }

        // Auto-clear HUD when driver arrives within 10m
        if (distMeters <= 10) {
            clearFareHUD();
        }
    }, 2000);
});

// ── Clear fare HUD ────────────────────────────────────────────────────────────
function clearFareHUD() {
    activeFare = null;

    if (fareDistInterval) {
        clearInterval(fareDistInterval);
        fareDistInterval = null;
    }

    const overlayBrowser = global.overlayBrowser || null;
    if (overlayBrowser) {
        overlayBrowser.execute(`hideFareHUD()`);
    }
}

// Server can also force-clear (e.g. fare completed, player got out)
mp.events.add('client:dispatch:clearFare', () => {
    clearFareHUD();
    // Clear waypoint
    mp.game.ui.setNewWaypoint(0, 0); // Clears waypoint in RAGEMP
});

// Clear if player exits vehicle while fare is active
mp.events.add('playerExitVehicle', (vehicle, seat) => {
    if (activeFare && seat === -1) {
        // Slight delay to let the server check if they arrived at destination
        setTimeout(() => {
            // Only auto-clear if server hasn't already done it
            if (activeFare) clearFareHUD();
        }, 5000);
    }
});
