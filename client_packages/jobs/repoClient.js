// client_packages/jobs/repoClient.js
// ============================================================
// CLIENT-SIDE — Repo Job PvE Minigame
// ============================================================
//
// Responsibilities:
//  - Zone blip / waypoint management
//  - Trunk interaction visuals
//  - Detecting when player boards the dummy car → open tracker CEF
//  - Distance polling → update tracker CEF with distance data
//  - Ambush hostile trigger for spawned NPCs
//  - Lock-break progress bar on wanted car
//  - Delivery waypoint
//  - Full cleanup on job end
//
// CEF file: package://tracker/index.html
// ============================================================

'use strict';

// ──────────────────────────────────────────────────────────────
// LOCAL STATE
// ──────────────────────────────────────────────────────────────

let repoPhase        = 'idle'; // mirrors server phase names
let zoneBlip         = null;
let trunkBlip        = null;
let deliverBlip      = null;

let trackerBrowser   = null;    // CEF browser for radar UI
let trackerActive    = false;

let wantedPos        = null;    // { x, y, z } — target the tracker points at
let dummyCarNetId    = -1;      // network id of dummy car (used to detect boarding)
let wantedCarNetId   = -1;      // network id of wanted car

// Polling intervals
let trackerInterval  = null;    // updates CEF with distance every 300ms
let vehicleCheckInt  = null;    // checks if player has boarded dummy car
let localAmbushPeds  = [];      // client-side only ped handles (invisible to other players)

// Lock-break state
let lockBreakActive  = false;
let lockBreakBlip    = null;
let lockBreakShape   = null;    // local colshape near wanted car
let lockBreakTimer   = null;

// Quit key (BACKSPACE = 0x08)
const KEY_QUIT = 0x08;

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────

function dist3D(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

function createBlip(sprite, x, y, z, name, color, scale, route) {
    const blip = mp.blips.new(sprite, new mp.Vector3(x, y, z), {
        name: name, color: color, scale: scale, shortRange: false
    });
    if (route) { blip.setRoute(true); blip.setRouteColour(color); }
    return blip;
}

function destroyBlip(blip) {
    if (blip && mp.blips.exists(blip)) blip.destroy();
}

function clearInterval2(id) {
    if (id) clearInterval(id);
    return null;
}

function destroyBrowser() {
    if (trackerBrowser) {
        try { trackerBrowser.destroy(); } catch (_) {}
        trackerBrowser = null;
    }
    trackerActive = false;
}

// ──────────────────────────────────────────────────────────────
// TRACKER CEF MANAGEMENT
// ──────────────────────────────────────────────────────────────

function openTracker() {
    if (trackerBrowser) return; // already open
    console.log('[RepoClient] Opening tracker CEF...');
    trackerBrowser = mp.browsers.new('package://tracker/index.html');
    trackerActive  = true;

    // Start distance-update interval once browser is created
    // The browser emits 'tracker:ready' when its JS is loaded; we use a small delay as fallback
    setTimeout(() => startTrackerInterval(), 1500);
}

function closeTracker() {
    trackerInterval = clearInterval2(trackerInterval);
    destroyBrowser();
    console.log('[RepoClient] Tracker CEF closed.');
}

function startTrackerInterval() {
    if (trackerInterval) return;
    trackerInterval = setInterval(() => {
        if (!trackerBrowser || !wantedPos) return;
        const local = mp.players.local;
        const d = dist3D(local.position, wantedPos);
        try {
            trackerBrowser.execute(`updateDistance(${Math.round(d)});`);
        } catch (e) {
            // Browser may be mid-destroy — swallow
        }
    }, 300);
}

// ──────────────────────────────────────────────────────────────
// PHASE: SHOW ZONE BLIP (Phase 1)
// ──────────────────────────────────────────────────────────────

mp.events.add('client:repo:showZoneBlip', (cx, cy, cz, radius) => {
    repoPhase = 'PHASE_1_FIND_DUMMY';
    console.log(`[RepoClient] Phase 1 — zone blip at ${cx}, ${cy}, ${cz}`);

    destroyBlip(zoneBlip);
    // Sprite 9 = radius blip (circular) — color 56 = light blue
    zoneBlip = mp.blips.new(9, new mp.Vector3(cx, cy, cz), {
        name: 'Investigate Area',
        color: 56,
        alpha: 128,
        scale: radius / 10   // approximate visual scale
    });

    // Also set a waypoint chevron on the minimap
    mp.game.ui.setNewWaypoint(cx, cy);

    mp.gui.chat.push(`!{#FFA500}[REPO]!{#FFFFFF} Drive to the marked area.`);
});

// ──────────────────────────────────────────────────────────────
// PHASE: GET TOOLS — dummy car + trunk marker visible (Phase 2)
// ──────────────────────────────────────────────────────────────

mp.events.add('client:repo:phaseGetTools', (mx, my, mz) => {
    repoPhase = 'PHASE_2_GET_TOOLS';
    console.log(`[RepoClient] Phase 2 — trunk at ${mx}, ${my}, ${mz}`);

    destroyBlip(zoneBlip);
    zoneBlip = null;
    mp.game.ui.clearGpsFlags();   // clear zone blip waypoint

    destroyBlip(trunkBlip);
    trunkBlip = createBlip(279, mx, my, mz, 'Grab Tools', 5, 0.8, true);

    mp.gui.chat.push('!{#FFA500}[REPO]!{#FFFFFF} Approach the car trunk and press ~b~E~w~ to grab the tools.');
});

// ──────────────────────────────────────────────────────────────
// PHASE: RADAR — player gets tools; must board dummy car (Phase 3)
// ──────────────────────────────────────────────────────────────

mp.events.add('client:repo:phaseRadar', (dummyNetId, wx, wy, wz) => {
    repoPhase    = 'PHASE_3_RADAR';
    dummyCarNetId = dummyNetId;
    wantedPos    = { x: wx, y: wy, z: wz };
    console.log(`[RepoClient] Phase 3 — radar mode. Dummy car netId: ${dummyNetId}`);

    destroyBlip(trunkBlip);
    trunkBlip = null;

    // Play tool-grab animation (brief, non-blocking)
    const local = mp.players.local;
    mp.game.streaming.requestAnimDict('pickup_object');
    setTimeout(() => {
        if (mp.game.streaming.hasAnimDictLoaded('pickup_object')) {
            local.taskPlayAnim('pickup_object', 'pickup_low', 8.0, -8.0, 1200, 1, 0, false, false, false);
        }
    }, 500);

    mp.game.ui.setNewWaypoint(wx, wy); // rough waypoint toward wanted area

    // Show notification
    mp.game.ui.setTextEntry('STRING');
    mp.game.ui.addTextComponentSubstringPlayerName('Tools acquired. Board the ~b~vehicle~w~ to activate the tracker.');
    mp.game.ui.drawSubtitleTimed(6000, true);

    // Poll every second to detect boarding the dummy car
    vehicleCheckInt = setInterval(() => {
        const veh = mp.players.local.vehicle;
        if (!veh) return;

        // Check if the vehicle the player is in IS the dummy car
        // mp.vehicles.atRemoteId converts server entity id → local handle
        let dummyLocal = null;
        try { dummyLocal = mp.vehicles.atRemoteId(dummyCarNetId); } catch (_) {}

        if (dummyLocal && mp.vehicles.exists(dummyLocal) && veh.handle === dummyLocal.handle) {
            // Player boarded the dummy car as driver (seat -1)
            if (veh.getPedInSeat(-1) === mp.players.local.handle) {
                vehicleCheckInt = clearInterval2(vehicleCheckInt);
                onBoardedDummyCar();
            }
        }
    }, 1000);
});

function onBoardedDummyCar() {
    console.log('[RepoClient] Player boarded dummy car — opening tracker CEF.');
    mp.events.callRemote('server:repo:boardedDummyCar');
    openTracker();
}

// ──────────────────────────────────────────────────────────────
// PHASE: AMBUSH — wanted car spawned server-side; peds spawned CLIENT-SIDE (Phase 4)
// ──────────────────────────────────────────────────────────────

mp.events.add('client:repo:phaseAmbush', (wantedNetId, pedSpawnDataJson, cx, cy, cz) => {
    repoPhase      = 'PHASE_4_AMBUSH';
    wantedCarNetId  = wantedNetId;
    localAmbushPeds = [];
    console.log(`[RepoClient] Phase 4 — ambush! Wanted car netId: ${wantedNetId}`);

    // Dramatic notification
    mp.game.ui.setTextEntry('STRING');
    mp.game.ui.addTextComponentSubstringPlayerName('~r~ARMED GUARDS~w~ are protecting the target. Eliminate them!');
    mp.game.ui.drawSubtitleTimed(6000, true);

    // Close tracker — radar stops while fighting
    closeTracker();

    // Blip for wanted car location
    destroyBlip(trunkBlip);
    trunkBlip = createBlip(523, cx, cy, cz, 'Target Vehicle', 1, 0.9, true);

    // Spawn peds client-side after a short delay (gives area time to stream in)
    setTimeout(() => {
        let pedSpawnData = [];
        try { pedSpawnData = JSON.parse(pedSpawnDataJson); } catch (e) {
            console.error('[RepoClient] Failed to parse ped spawn data:', e);
        }

        pedSpawnData.forEach((sp, i) => {
            try {
                const ped = mp.peds.new(
                    mp.game.joaat(sp.model),
                    new mp.Vector3(sp.x, sp.y, sp.z),
                    sp.h,
                    mp.players.local.dimension
                );
                localAmbushPeds.push(ped);
                console.log(`[RepoClient] Spawned local ped #${i + 1}: ${sp.model}`);
            } catch (e) {
                console.error(`[RepoClient] Failed to spawn ped #${i + 1}:`, e);
            }
        });

        // Make hostile after another short delay so models finish loading
        setTimeout(() => makeNpcsHostile(), 2000);
    }, 1500);

    // Set up lock-break interaction near wanted car
    setupLockBreakInteraction(cx, cy, cz);
});

function makeNpcsHostile() {
    console.log(`[RepoClient] Making ${localAmbushPeds.length} local ped(s) hostile...`);
    const local = mp.players.local;

    localAmbushPeds.forEach((ped, i) => {
        if (!ped || !mp.peds.exists(ped)) return;
        try {
            ped.giveWeaponToPed(mp.game.joaat('WEAPON_PISTOL'), 200, false, true);
            ped.taskCombatPed(local.handle, 0, 16);
            ped.setBlockingOfNonTemporaryEvents(false);
            ped.setFleeAttributes(0, true);
            ped.setCombatAttributes(46, true); // always fight, never flee
            console.log(`[RepoClient] Local ped #${i + 1} is now hostile.`);
        } catch (e) {
            console.error(`[RepoClient] Error making local ped #${i + 1} hostile:`, e);
        }
    });
}

// ──────────────────────────────────────────────────────────────
// LOCK-BREAK INTERACTION
// ──────────────────────────────────────────────────────────────

function setupLockBreakInteraction(cx, cy, cz) {
    // Clean up any previous lock colshape
    if (lockBreakShape) { try { lockBreakShape.destroy(); } catch(_){} lockBreakShape = null; }

    // Local colshape — client-side only, triggers via interaction:keypress
    lockBreakShape = mp.colshapes.newSphere(cx, cy, cz, 5.0);
    lockBreakShape.interaction = {
        title: 'Target Vehicle',
        text: 'Press ~b~E~w~ to break the lock',
        event: null, // handled manually below
        requireOnFoot: true,
        _isLockBreak: true
    };

    // Blip near car door
    destroyBlip(lockBreakBlip);
    lockBreakBlip = createBlip(1, cx, cy, cz + 1.0, 'Break Lock', 6, 0.7, false); // small yellow marker blip
}

// Hook into the generic interaction keypress to catch lock-break E presses
mp.events.add('interaction:keypress', () => {
    if (repoPhase !== 'PHASE_4_AMBUSH') return;
    if (lockBreakActive) return;
    if (mp.players.local.vehicle) return; // must be on foot

    const local = mp.players.local;

    // Check if any ambush ped is still alive (all must be down to break lock)
    let anyAlive = false;
    localAmbushPeds.forEach(ped => {
        if (ped && mp.peds.exists(ped) && !ped.isDead()) anyAlive = true;
    });

    if (anyAlive) {
        mp.game.ui.setTextEntry('STRING');
        mp.game.ui.addTextComponentSubstringPlayerName('~r~Eliminate all guards first!');
        mp.game.ui.drawSubtitleTimed(3000, true);
        return;
    }

    // Check distance to wanted car
    let wantedLocal = null;
    try { wantedLocal = mp.vehicles.atRemoteId(wantedCarNetId); } catch (_) {}
    if (!wantedLocal || !mp.vehicles.exists(wantedLocal)) return;

    const d = dist3D(local.position, wantedLocal.position);
    if (d > 6.0) return; // not close enough

    // Start lock-break progress bar
    startLockBreak();
});

function startLockBreak() {
    lockBreakActive = true;
    console.log('[RepoClient] Lock break started...');

    const DURATION = 5000; // 5 seconds
    const start = Date.now();

    // Show progress via native mp.game.ui drawing (no CEF needed)
    // We'll pulse a subtitle countdown
    mp.game.ui.setTextEntry('STRING');
    mp.game.ui.addTextComponentSubstringPlayerName('~b~Breaking lock...~w~ Don\'t move!');
    mp.game.ui.drawSubtitleTimed(DURATION + 500, true);

    // Play animation
    mp.game.streaming.requestAnimDict('anim@amb@clubhouse@caricabarile@male@');
    const local = mp.players.local;
    setTimeout(() => {
        if (mp.game.streaming.hasAnimDictLoaded('anim@amb@clubhouse@caricabarile@male@')) {
            local.taskPlayAnim('anim@amb@clubhouse@caricabarile@male@', 'caricabarile_idle', 8.0, -8.0, DURATION, 1, 0, false, false, false);
        }
    }, 200);

    lockBreakTimer = setTimeout(() => {
        lockBreakActive = false;
        console.log('[RepoClient] Lock break complete! Notifying server...');

        // Clean up
        if (lockBreakShape) { try { lockBreakShape.destroy(); } catch(_){} lockBreakShape = null; }
        destroyBlip(lockBreakBlip); lockBreakBlip = null;
        destroyBlip(trunkBlip);    trunkBlip      = null;

        mp.events.callRemote('server:repo:lockBroken');
    }, DURATION);
}

// ──────────────────────────────────────────────────────────────
// PHASE: ENTER WANTED CAR (server confirms lock broken)
// ──────────────────────────────────────────────────────────────

mp.events.add('client:repo:enterWantedCar', (wantedNetId) => {
    console.log(`[RepoClient] Entering wanted car netId ${wantedNetId}...`);
    if (wantedNetId < 0) return;

    let wantedLocal = null;
    try { wantedLocal = mp.vehicles.atRemoteId(wantedNetId); } catch (_) {}
    if (!wantedLocal || !mp.vehicles.exists(wantedLocal)) return;

    mp.players.local.taskWarpPedIntoVehicle(wantedLocal.handle, -1); // warp into driver seat
});

// ──────────────────────────────────────────────────────────────
// PHASE: DELIVER (Phase 5)
// ──────────────────────────────────────────────────────────────

mp.events.add('client:repo:phaseDeliver', (dx, dy, dz) => {
    repoPhase = 'PHASE_5_DELIVER';
    console.log(`[RepoClient] Phase 5 — deliver to ${dx}, ${dy}, ${dz}`);

    // Close tracker radar
    closeTracker();
    vehicleCheckInt  = clearInterval2(vehicleCheckInt);

    // Delivery blip + route
    destroyBlip(deliverBlip);
    destroyBlip(trunkBlip);
    deliverBlip = createBlip(479, dx, dy, dz, 'Deliver to Salvatore', 2, 0.9, true);
    mp.game.ui.setNewWaypoint(dx, dy);

    mp.game.ui.setTextEntry('STRING');
    mp.game.ui.addTextComponentSubstringPlayerName('~g~Drive the vehicle to Salvatore\'s location.~w~');
    mp.game.ui.drawSubtitleTimed(6000, true);
});

// ──────────────────────────────────────────────────────────────
// SYNC (called by server on login / job state change)
// ──────────────────────────────────────────────────────────────

mp.events.add('client:repo:sync', (jsonStr) => {
    // Just stored server-side — can be used for HUD display if desired
    try {
        const jobs = JSON.parse(jsonStr);
        // e.g., update a job tracker overlay
    } catch (_) {}
});

// ──────────────────────────────────────────────────────────────
// FULL CLEANUP (called by server on complete, quit, or disconnect)
// ──────────────────────────────────────────────────────────────

mp.events.add('client:repo:cleanup', () => {
    console.log('[RepoClient] Full cleanup.');
    repoPhase      = 'idle';
    wantedPos      = null;
    dummyCarNetId  = -1;
    wantedCarNetId = -1;
    lockBreakActive = false;

    // Destroy client-side peds
    localAmbushPeds.forEach(ped => { try { if (mp.peds.exists(ped)) ped.destroy(); } catch (_) {} });
    localAmbushPeds = [];

    vehicleCheckInt = clearInterval2(vehicleCheckInt);
    trackerInterval = clearInterval2(trackerInterval);
    if (lockBreakTimer) { clearTimeout(lockBreakTimer); lockBreakTimer = null; }

    closeTracker();
    destroyBlip(zoneBlip);    zoneBlip    = null;
    destroyBlip(trunkBlip);   trunkBlip   = null;
    destroyBlip(deliverBlip); deliverBlip = null;
    destroyBlip(lockBreakBlip); lockBreakBlip = null;
    if (lockBreakShape) { try { lockBreakShape.destroy(); } catch(_){} lockBreakShape = null; }

    mp.game.ui.clearGpsFlags();
});

// ──────────────────────────────────────────────────────────────
// QUIT KEY — BACKSPACE while in a repo phase
// ──────────────────────────────────────────────────────────────

mp.keys.bind(KEY_QUIT, false, () => {
    if (repoPhase === 'idle') return;
    if (mp.gui.cursor.visible) return; // don't intercept if a menu is open

    // Ask confirmation — simple subtitle prompt
    // (In production you'd open a small CEF confirm dialog)
    mp.gui.chat.push('!{#FFA500}[REPO]!{#FFFFFF} Type /quitrepo to abandon the current job.');
});

// /quitrepo command
mp.events.add('consoleInput', (text) => {
    if (text.toLowerCase() !== '/quitrepo') return;
    if (repoPhase === 'idle') return;
    mp.events.callRemote('server:repo:quit');
});

console.log('[RepoClient] Repo job client script loaded.');
