/**
 * ============================================================================
 * TRUCKER JOB — CLIENT
 * Handles NPC spawn, board UI, job lifecycle, trailer hookup detection
 * ============================================================================
 */

let truckerBrowser  = null;
let currentContract = null;
let currentObjective = null; // { blip, marker, pos, phase: 'pickup'|'dropoff' }
let lastWarningTime = 0;     // Prevents chat spam in the checking loop

// ─── NPC ───────────────────────────────────────────────────────────────────
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
    setTimeout(() => {
        if (truckerBrowser) {
            truckerBrowser.execute(`loadRoutes('${routesJson}')`);
        }
    }, 200);
});

// ─── CEF callbacks ─────────────────────────────────────────────────────────
mp.events.add('client:trucker:selectJob', (contractJson) => {
    closeBrowser();
    mp.events.callRemote('server:trucker:selectContract', contractJson);
});

mp.events.add('client:trucker:closeMenu', () => {
    closeBrowser();
    mp.events.callRemote('server:trucker:quitJob');
});

// ─── Job started by server ─────────────────────────────────────────────────
mp.events.add('client:trucker:startJob', (contractJson) => {
    currentContract = JSON.parse(contractJson);

    if (currentContract.type === 'trailer') {
        setObjective(currentContract.pickup, 'Hook Up Trailer', 'pickup', 1);
    } else {
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
    const marker = mp.markers.new(1, new mp.Vector3(pos.x, pos.y, pos.z - 1.0), 5.0, {
        color: [255, 165, 0, 150], visible: true,
    });

    currentObjective = { blip, marker, pos, phase };
}

function clearObjective() {
    if (!currentObjective) return;
    if (currentObjective.blip)   currentObjective.blip.destroy();
    if (currentObjective.marker) currentObjective.marker.destroy();
    currentObjective = null;
}

// ─── CUSTOM CHECKPOINT DETECTION (Checks Cab AND Trailer) ──────────────────
setInterval(() => {
    if (!currentObjective || !currentContract) return;

    const localVeh = mp.players.local.vehicle;
    if (!localVeh) return;

    const objPos = currentObjective.pos;
    const radius = 6.0;

    if (currentContract.type === 'trailer') {
        // ─── TRAILER JOB LOGIC ───
        let distToCab = getDistance(localVeh.position, objPos);
        let distToTrailer = 9999;
        let trailerAttached = false;

        const trailerHandle = localVeh.getTrailer(0);
        if (trailerHandle !== 0) {
            trailerAttached = true;
            const trailer = mp.vehicles.atHandle(trailerHandle);
            if (trailer) {
                distToTrailer = getDistance(trailer.position, objPos);
            }
        }

        if (distToCab <= radius || distToTrailer <= radius) {
            if (currentObjective.phase === 'pickup') {
                if (!trailerAttached) {
                    if (Date.now() - lastWarningTime > 5000) {
                        mp.game.graphics.notify('~y~Hook up the trailer first — back up to it!');
                        lastWarningTime = Date.now();
                    }
                    return; 
                }
                
                mp.game.graphics.notify('~g~Cargo loaded!~w~ Drive to the drop-off point.');
                clearObjective();
                mp.events.callRemote('server:trucker:trailerHooked');

            } else if (currentObjective.phase === 'dropoff') {
                clearObjective();
                mp.events.callRemote('server:trucker:finishJob');
                currentContract = null;
            }
        }
    } else {
        // ─── BOX TRUCK LOGIC (REAR CHECK) ───
        // 1. Get the bounding box dimensions of the vehicle model
        const dimensions = mp.game.gameplay.getModelDimensions(localVeh.model);
        
        // 2. dimensions.minimum.y gives us the furthest point backward relative to the vehicle center.
        // We use getOffsetFromInWorldCoords to find exactly where that is on the map right now.
        const rearPos = localVeh.getOffsetFromInWorldCoords(0, dimensions.minimum.y, 0);
        
        const distToRear = getDistance(rearPos, objPos);
        const distToCenter = getDistance(localVeh.position, objPos);

        // 3. Check if the REAR of the truck is inside the marker
        if (distToRear <= radius) {
            if (currentObjective.phase === 'pickup') {
                mp.game.graphics.notify('~g~Cargo loaded!~w~ Drive to the drop-off point.');
                clearObjective();
                mp.events.callRemote('server:trucker:trailerHooked'); 
            } else if (currentObjective.phase === 'dropoff') {
                clearObjective();
                mp.events.callRemote('server:trucker:finishJob');
                currentContract = null;
            }
        } 
        // 4. Warning if they drive in nose-first!
        else if (distToCenter <= radius && distToRear > radius) {
            if (Date.now() - lastWarningTime > 5000) {
                mp.game.graphics.notify('~y~Reverse into the loading bay! The back doors must touch the marker.');
                lastWarningTime = Date.now();
            }
        }
    }
}, 500);

// ─── E key — open menu near NPC ────────────────────────────────────────────
mp.keys.bind(0x45, true, () => {
    if (mp.gui.cursor.visible) return;
    const dist = getDistance(mp.players.local.position, { x: 814.36, y: -2982.50, z: 6.02 });
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

function getDistance(pos1, pos2) {
    return Math.hypot(pos1.x - pos2.x, pos1.y - pos2.y, pos1.z - pos2.z);
}