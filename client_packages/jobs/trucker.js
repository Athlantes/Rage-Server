/**
 * ============================================================================
 * TRUCKER JOB — CLIENT
 * Handles NPC spawn, board UI, job lifecycle, trailer hookup detection
 * ============================================================================
 */

let truckerBrowser  = null;
let currentContract = null;
let currentObjective = null; // { blip, marker, colshape, phase: 'pickup'|'dropoff' }

// ─── NPC ───────────────────────────────────────────────────────────────────
// Use playerReady so the game world is fully loaded before placing the ped.
// Calling mp.peds.new() at script load time results in the ped not appearing.
mp.events.add('playerReady', () => {
    mp.peds.new(
        mp.game.joaat('s_m_m_trucker_01'),
        new mp.Vector3(814.36, -2982.50, 6.02),
        -87.83,
        0
    );
});

// ─── Open dispatch board ───────────────────────────────────────────────────
mp.events.add('client:trucker:showMenu', (routesJson) => {
    if (!truckerBrowser) {
        truckerBrowser = mp.browsers.new('package://ui/trucker/index.html');
        mp.gui.cursor.show(true, true);
    }
    // Small delay so the browser has time to initialise
    setTimeout(() => {
        if (truckerBrowser) {
            truckerBrowser.execute(`loadRoutes('${routesJson}')`);
        }
    }, 200);
});

// ─── CEF callbacks ─────────────────────────────────────────────────────────

// Player clicked Accept
mp.events.add('client:trucker:selectJob', (contractJson) => {
    closeBrowser();
    mp.events.callRemote('server:trucker:selectContract', contractJson);
});

// Player closed the board without accepting
mp.events.add('client:trucker:closeMenu', () => {
    closeBrowser();
    mp.events.callRemote('server:trucker:quitJob');
});

// ─── Job started by server ─────────────────────────────────────────────────
mp.events.add('client:trucker:startJob', (contractJson) => {
    currentContract = JSON.parse(contractJson);

    if (currentContract.type === 'trailer') {
        // First objective: reach pickup bay to hook the trailer
        setObjective(currentContract.pickup, 'Hook Up Trailer', 'pickup', 1);
    } else {
        // Box truck: just reach the loading bay
        setObjective(currentContract.pickup, 'Load Cargo', 'pickup', 1);
    }
});

// Server confirmed hookup / box-truck load — advance to dropoff
mp.events.add('client:trucker:advanceToDropoff', (contractJson) => {
    clearObjective();
    currentContract = JSON.parse(contractJson);
    setObjective(currentContract.dropoff, 'Deliver Cargo', 'dropoff', 5);
});

// ─── Objective helpers ─────────────────────────────────────────────────────
function setObjective(pos, label, phase, blipColor) {
    clearObjective();

    const blip = mp.blips.new(1, new mp.Vector3(pos.x, pos.y, pos.z), {
        name: label, color: blipColor, scale: 1, route: true,
    });
    const marker = mp.markers.new(1, new mp.Vector3(pos.x, pos.y, pos.z - 1.0), 4.0, {
        color: [255, 165, 0, 150], visible: true,
    });
    const colshape = mp.colshapes.newSphere(pos.x, pos.y, pos.z, 4.0);

    currentObjective = { blip, marker, colshape, phase };
}

function clearObjective() {
    if (!currentObjective) return;
    if (currentObjective.blip)     currentObjective.blip.destroy();
    if (currentObjective.marker)   currentObjective.marker.destroy();
    if (currentObjective.colshape) currentObjective.colshape.destroy();
    currentObjective = null;
}

// ─── Colshape entry — game loop ────────────────────────────────────────────
mp.events.add('playerEnterColshape', (shape) => {
    if (!currentObjective || shape !== currentObjective.colshape) return;
    if (!currentContract) return;

    if (currentObjective.phase === 'pickup') {
        // ── Trailer job: verify trailer is attached before advancing ──────────
        if (currentContract.type === 'trailer') {
            const localVeh = mp.players.local.vehicle;
            if (!localVeh) {
                mp.game.graphics.notify('~r~You must be in your cab to hook the trailer!');
                return;
            }

            // Check native trailer attachment
            const trailerHandle = mp.game.vehicle.getVehicleTrailerVehicle(localVeh.handle);
            if (!trailerHandle || trailerHandle === 0) {
                mp.game.graphics.notify('~y~Hook up the trailer first — back up to it!');
                return; // Don't advance yet — let them try again
            }
        }

        // Box truck or trailer confirmed attached
        mp.game.graphics.notify('~g~Cargo loaded!~w~ Drive to the drop-off point.');
        clearObjective();
        mp.events.callRemote('server:trucker:trailerHooked');

    } else if (currentObjective.phase === 'dropoff') {
        clearObjective();
        mp.events.callRemote('server:trucker:finishJob');
        currentContract = null;
    }
});

// ─── E key — open menu near NPC ────────────────────────────────────────────
mp.keys.bind(0x45, true, () => {
    if (mp.gui.cursor.visible) return;
    const dist = mp.players.local.position
        .subtract(new mp.Vector3(814.36, -2982.50, 6.02)).length();
    if (dist < 5.0) {
        mp.events.callRemote('server:trucker:requestMenu');
    }
});

// ─── Utility ───────────────────────────────────────────────────────────────
function closeBrowser() {
    if (truckerBrowser) {
        truckerBrowser.destroy();
        truckerBrowser = null;
        mp.gui.cursor.show(false, false);
    }
}
