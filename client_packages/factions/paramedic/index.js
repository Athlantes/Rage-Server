// client_packages/factions/paramedic/index.js
// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-SIDE: Paramedic faction logic
//
// Responsibilities:
//   - Show blips on map for every downed player (visible only to on-duty medics)
//   - Show an E-key CPR interaction prompt when close to a downed player
//   - Play CPR animation while performing CPR
//   - Show the CPR progress overlay
//   - Dispatch flow (phase 1 arrival) — fires server:dispatch:paramedicArrived
// ─────────────────────────────────────────────────────────────────────────────

// ── State ─────────────────────────────────────────────────────────────────────

// Map<playerId, blip> — blips for downed players
const downedBlips   = new Map();
// Current downed players: Array of { id, pos }
let downedList      = [];

// CPR state
let cprBrowser      = null;
let isCPRing        = false;
let cprTargetId     = null;

// CPR interaction prompt state
let nearbyDownedId  = null;
let cprPromptActive = false;

const CPR_INTERACT_RANGE = 5.0;

// ── Dispatch arrival blip / marker tracking ───────────────────────────────────
// re-use the standard dispatch client for phase 1 en-route, so we just handle
// the arrival event here:

// ── Helpers ───────────────────────────────────────────────────────────────────

function isParamedicOnDuty() {
    // Note: faction/duty data is not directly readable client-side from
    // server variables in RAGEMP without a custom sync. We track via a local flag.
    return _paramedicDuty;
}

let _paramedicDuty = false;

mp.events.add('client:faction:dutyState', (factionId, onDuty) => {
    if (factionId === 3) {
        _paramedicDuty = onDuty;
        if (!onDuty) {
            clearAllDownedBlips();
        }
    }
});

// ── Downed player blip management ────────────────────────────────────────────

function clearAllDownedBlips() {
    downedBlips.forEach(blip => { try { blip.destroy(); } catch (_) {} });
    downedBlips.clear();
}

function syncDownedBlips(list) {
    // Remove blips that are no longer downed
    downedBlips.forEach((blip, id) => {
        const still = list.find(p => p.id === id);
        if (!still) {
            try { blip.destroy(); } catch (_) {}
            downedBlips.delete(id);
        }
    });

    // Add blips for new downed players
    list.forEach(p => {
        if (!downedBlips.has(p.id)) {
            const pos  = p.pos;
            const blip = mp.blips.new(280, new mp.Vector3(pos.x, pos.y, pos.z), {
                name:       'Patient Down',
                color:      1,      // Red
                scale:      1.0,
                shortRange: false,
            });
            downedBlips.set(p.id, blip);
        } else {
            // Update position if player moved (ragdoll can drift slightly)
            try {
                downedBlips.get(p.id).position = new mp.Vector3(p.pos.x, p.pos.y, p.pos.z);
            } catch (_) {}
        }
    });
}

mp.events.add('client:paramedic:syncDownedPlayers', (dataJson) => {
    try {
        downedList = JSON.parse(dataJson);
    } catch (_) {
        downedList = [];
    }
    syncDownedBlips(downedList);
});

// ── CPR proximity prompt (render loop) ───────────────────────────────────────

mp.events.add('render', () => {
    if (!_paramedicDuty || isCPRing) return;

    const myPos = mp.players.local.position;
    let closestId   = null;
    let closestDist = CPR_INTERACT_RANGE;

    for (const p of downedList) {
        const dx = myPos.x - p.pos.x;
        const dy = myPos.y - p.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
            closestDist = dist;
            closestId   = p.id;
        }
    }

    if (closestId !== null && closestId !== nearbyDownedId) {
        nearbyDownedId  = closestId;
        cprPromptActive = true;
        mp.events.call('showInteraction', 'Patient Down', 'Perform CPR');
    } else if (closestId === null && nearbyDownedId !== null) {
        nearbyDownedId  = null;
        cprPromptActive = false;
        mp.events.call('hideInteraction');
    }
});

// ── E Key — start CPR ─────────────────────────────────────────────────────────
// We hook into the generic interaction:keypress event so it plays nicely with
// the existing interaction system.
mp.events.add('interaction:keypress', () => {
    if (!cprPromptActive || nearbyDownedId === null) return;
    if (!_paramedicDuty) return;
    if (isCPRing) return;

    // Fire server to start CPR
    mp.events.callRemote('server:paramedic:startCPR', nearbyDownedId.toString());
});

// ── CPR animation / overlay ───────────────────────────────────────────────────

const CPR_DICT = 'amb@medic@standing@tendtodead@base';
const CPR_ANIM = 'base';

mp.events.add('client:paramedic:startCPR', (durationMs, targetId) => {
    isCPRing    = true;
    cprTargetId = targetId;

    cprPromptActive = false;
    mp.events.call('hideInteraction');

    // Play CPR animation
    const player = mp.players.local;
    mp.game.streaming.requestAnimDict(CPR_DICT);
    let attempts = 0;
    const iv = setInterval(() => {
        if (mp.game.streaming.hasAnimDictLoaded(CPR_DICT)) {
            clearInterval(iv);
            player.taskPlayAnim(CPR_DICT, CPR_ANIM, 4.0, -1.0, durationMs, 1, 0, false, false, false);
        }
        if (++attempts > 60) clearInterval(iv);
    }, 50);

    // Open CPR progress overlay
    if (!cprBrowser) {
        cprBrowser = mp.browsers.new('package://ui/paramedic/cprOverlay.html');
        cprBrowser.active = true;
    }
    setTimeout(() => {
        if (cprBrowser) cprBrowser.execute(`startCPR(${durationMs})`);
    }, 200);
});

mp.events.add('client:paramedic:stopCPR', () => {
    isCPRing    = false;
    cprTargetId = null;

    mp.players.local.clearTasksImmediately();

    if (cprBrowser) {
        cprBrowser.execute('stopCPR()');
        setTimeout(() => {
            if (cprBrowser) { cprBrowser.destroy(); cprBrowser = null; }
        }, 600);
    }
});

// ── Phase 1 arrival detection: fire paramedicArrived when close to dispatch target ──
// The standard dispatch client handles blip/marker for phase 1.
// We monitor proximity and fire the paramedic-specific arrival event.

let paramedicArrivalTick = null;
let arrivalCoords        = null;

mp.events.add('client:dispatch:accepted', () => {
    // Only set up paramedic-specific arrival monitoring if we are a paramedic.
    // The standard dispatch client also runs, so don't duplicate — just capture coords.
    // The coords come through the standard accepted event payload which the main
    // dispatch script handles. We hook into the `server:dispatch:driverArrived`
    // moment by listening for proximity in the dispatch script instead.
    // For paramedics we use a separate arrival event name.
});

// Listen for the dispatch-accepted data from the server (re-parse here for our own proximity tick)
mp.events.add('client:paramedic:dispatchAccepted', (dataJson) => {
    let data;
    try { data = JSON.parse(dataJson); } catch (_) { return; }
    if (!data || !data.coords) return;

    arrivalCoords = new mp.Vector3(data.coords.x, data.coords.y, data.coords.z);

    if (paramedicArrivalTick) clearInterval(paramedicArrivalTick);
    paramedicArrivalTick = setInterval(() => {
        const pos  = mp.players.local.position;
        const dx   = pos.x - arrivalCoords.x;
        const dy   = pos.y - arrivalCoords.y;
        const dz   = pos.z - arrivalCoords.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist <= 12.0) {
            clearInterval(paramedicArrivalTick);
            paramedicArrivalTick = null;
            arrivalCoords        = null;
            mp.events.callRemote('server:dispatch:paramedicArrived');
        }
    }, 500);
});

// When call is cleared, cancel arrival monitoring
mp.events.add('client:dispatch:callCleared', () => {
    if (paramedicArrivalTick) {
        clearInterval(paramedicArrivalTick);
        paramedicArrivalTick = null;
    }
    arrivalCoords = null;
});
