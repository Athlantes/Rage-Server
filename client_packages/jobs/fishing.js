// client_packages/jobs/fishing.js
// =============================================================================
//  FISHING JOB — Client Side
//
//  No fixed spots. Players can fish anywhere with >= MIN_DEPTH_M of water.
//
//  On every E keypress the client runs a forward arc depth scan:
//  5 sample points spread across ±40° in front of the player at two distances
//  (PROBE_NEAR and PROBE_FAR metres). Uses mp.game.water.getWaterHeight for
//  the water surface Z and mp.game.gameplay.getGroundZFor3dCoord for the sea
//  bed Z. depth = surface - seaBed.
//
//  - No samples with water at all  → "Face the water before casting."
//  - Water found but depth < 1.5m  → "Water is too shallow here."
//  - At least one sample >= 1.5m   → cast fires
//
//  NOTE: getWaterHeight returns -100000 for shallow rivers (Raton Canyon etc.)
//  Those are treated as no-data and skipped; if no other sample clears the
//  depth threshold the cast is blocked.
// =============================================================================

'use strict';

// ---------------------------------------------------------------------------
//  CONSTANTS
// ---------------------------------------------------------------------------
const MIN_DEPTH_M    = 1.5;   // minimum water depth to allow casting
const PROBE_NEAR     = 3.0;   // metres ahead for near depth samples
const PROBE_FAR      = 8.0;   // metres ahead for far depth samples
const REEL_WINDOW_MS = 8000;  // ms client shows the reel-in subtitle

// ---------------------------------------------------------------------------
//  STATE
// ---------------------------------------------------------------------------
let isFishing   = false;  // a cast session is active
let biteReady   = false;  // fish is on the line, waiting for E
let castingAnim = false;  // fishing animation is playing
let marketBlip  = null;
let marketMenu  = null;

// ---------------------------------------------------------------------------
//  SETUP / CLEANUP
// ---------------------------------------------------------------------------
mp.events.add('client:fishing:setupMarket', (x, y, z) => {
    if (marketBlip && mp.blips.exists(marketBlip)) marketBlip.destroy();
    marketBlip = mp.blips.new(500, new mp.Vector3(x, y, z), {
        name: 'Fish Market', color: 2, scale: 0.9, shortRange: true
    });
});

mp.events.add('client:fishing:cleanup', () => {
    if (marketBlip && mp.blips.exists(marketBlip)) { marketBlip.destroy(); marketBlip = null; }
    if (marketMenu) { marketMenu.destroy(); marketMenu = null; mp.gui.cursor.show(false, false); }

    isFishing   = false;
    biteReady   = false;
    castingAnim = false;

    mp.players.local.freezePosition(false);
    stopFishingAnim();
});

// ---------------------------------------------------------------------------
//  WATER VALIDATION
// ---------------------------------------------------------------------------

/**
 * Samples water depth at a given world position.
 * Returns depth in metres (waterSurface - seaBed), or -1 if no water there.
 *
 * getWaterHeight returns -100000 for shallow rivers — treated as no data,
 * so those spots are handled by the facing arc check finding deeper points.
 */
function sampleDepth(x, y, z) {
    try {
        const waterHeight = mp.game.water.getWaterHeight(x, y, z + 10.0, 0.0);
        if (!waterHeight || waterHeight < -9999) return -1;

        const groundZ = mp.game.gameplay.getGroundZFor3dCoord(x, y, z + 10.0, false, false);
        return waterHeight - groundZ;
    } catch (e) {
        return -1;
    }
}

/**
 * Check that the player is facing deep water AND there is deep water ahead.
 *
 * Samples a forward arc of 5 points spread across ±40° in front of the player,
 * at distances of PROBE_NEAR and PROBE_FAR metres.
 * At least one sample must have depth >= MIN_DEPTH_M AND be in the forward
 * half (within ±90° of facing) to pass.
 *
 * This simultaneously checks:
 *   - FACING: samples are only taken in the forward arc, not behind
 *   - DEPTH:  each sample must clear the minimum depth threshold
 *
 * Returns { ok: bool, reason: string }
 */
function validateCastPosition() {
    const player  = mp.players.local;
    const pos     = player.position;
    const baseRad = (player.heading * Math.PI) / 180.0;

    // Sample points: 5 angles across a ±40° cone, at two distances
    const angles  = [-40, -20, 0, 20, 40];
    const distances = [PROBE_NEAR, PROBE_FAR];

    let foundWater = false;
    let foundDeep  = false;

    for (const angleDeg of angles) {
        const rad  = baseRad + (angleDeg * Math.PI / 180.0);
        const fwdX = -Math.sin(rad);
        const fwdY =  Math.cos(rad);

        for (const dist of distances) {
            const sx = pos.x + fwdX * dist;
            const sy = pos.y + fwdY * dist;
            const depth = sampleDepth(sx, sy, pos.z);

            if (depth >= 0) {
                foundWater = true;
                if (depth >= MIN_DEPTH_M) {
                    foundDeep = true;
                    break;
                }
            }
        }
        if (foundDeep) break;
    }

    if (!foundWater && !foundDeep) {
        return { ok: false, reason: 'Face the water before casting.' };
    }
    if (foundWater && !foundDeep) {
        return { ok: false, reason: 'Water is too shallow here. Find a deeper spot.' };
    }

    return { ok: true, reason: '' };
}

// ---------------------------------------------------------------------------
//  E KEY HANDLER
//  - If fish is biting → reel in
//  - If idle → validate position then cast
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
//  E KEY HANDLER — hooked via interaction:keypress (fired by interaction.js
//  when E is pressed and no colshape interaction is active)
// ---------------------------------------------------------------------------
mp.events.add('interaction:keypress', () => {
    if (mp.players.local.getVariable('activeJobId') !== 'fishing') return;

    // Fish is on the line — reel in
    if (isFishing && biteReady) {
        biteReady = false;
        mp.events.callRemote('server:fishing:reel');
        return;
    }

    // Already waiting for a bite — do nothing
    if (isFishing) return;

    // Validate position before casting
    const check = validateCastPosition();
    if (!check.ok) {
        mp.game.ui.setTextEntry('STRING');
        mp.game.ui.addTextComponentSubstringPlayerName(`~r~${check.reason}`);
        mp.game.ui.drawSubtitleTimed(3000, true);
        return;
    }

    // Cast — send position so server can determine water type (ocean/lake/river)
    const pos = mp.players.local.position;
    mp.events.callRemote('server:fishing:cast', pos.x, pos.y);
});

// ---------------------------------------------------------------------------
//  ANIMATION
// ---------------------------------------------------------------------------
function startFishingAnim() {
    const dict = 'amb@world_human_stand_fishing@idle_a';
    const name = 'idle_a';

    mp.game.streaming.requestAnimDict(dict);
    let attempts = 0;
    const iv = setInterval(() => {
        attempts++;
        if (mp.game.streaming.hasAnimDictLoaded(dict)) {
            clearInterval(iv);
            mp.players.local.taskPlayAnim(dict, name, 2.0, -1.0, -1, 1, 1.0, false, false, false);
            castingAnim = true;
        }
        if (attempts > 60) clearInterval(iv);
    }, 50);
}

function stopFishingAnim() {
    if (castingAnim) {
        mp.game.task.clearPedTasksImmediately(mp.players.local.handle);
        castingAnim = false;
    }
}

// ---------------------------------------------------------------------------
//  SERVER → CLIENT EVENTS
// ---------------------------------------------------------------------------
mp.events.add('client:fishing:startCast', () => {
    isFishing = true;
    biteReady = false;
    mp.players.local.freezePosition(true);
    startFishingAnim();

    mp.game.ui.setTextEntry('STRING');
    mp.game.ui.addTextComponentSubstringPlayerName('~b~Line in the water... wait for a bite.');
    mp.game.ui.drawSubtitleTimed(4000, true);
});

mp.events.add('client:fishing:bite', () => {
    biteReady = true;
    mp.game.cam.shakeGameplayCam('SMALL_EXPLOSION_SHAKE', 0.2);

    mp.game.ui.setTextEntry('STRING');
    mp.game.ui.addTextComponentSubstringPlayerName('~g~FISH ON THE LINE! Press ~b~E~w~ to reel in!');
    mp.game.ui.drawSubtitleTimed(REEL_WINDOW_MS, true);
});

mp.events.add('client:fishing:escapedFish', () => {
    isFishing = false;
    biteReady = false;
    mp.players.local.freezePosition(false);
    stopFishingAnim();
});

mp.events.add('client:fishing:reelDone', () => {
    isFishing = false;
    biteReady = false;
    mp.players.local.freezePosition(false);
    stopFishingAnim();
});

// ---------------------------------------------------------------------------
//  MARKET MENU
// ---------------------------------------------------------------------------
mp.events.add('client:fishing:openMarket', (itemsJson) => {
    if (marketMenu) {
        marketMenu.execute(`loadItems('${itemsJson}')`);
        return;
    }

    marketMenu = mp.browsers.new('package://ui/fishMarket.html');
    mp.gui.cursor.show(true, true);

    setTimeout(() => {
        if (marketMenu) marketMenu.execute(`loadItems('${itemsJson}')`);
    }, 300);
});

mp.events.add('client:fishing:closeMarket', () => {
    if (marketMenu) { marketMenu.destroy(); marketMenu = null; }
    mp.gui.cursor.show(false, false);
});

mp.events.add('client:fishing:sellAction', (itemId, amount) => {
    mp.events.callRemote('server:fishing:sell', itemId, amount);
});