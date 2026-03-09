// client_packages/jobs/fishing.js
'use strict';

// ---------------------------------------------------------------------------
//  CONSTANTS
// ---------------------------------------------------------------------------
const MIN_DEPTH_M    = 1.0;   // Lowered slightly to be more forgiving
const PROBE_NEAR     = 3.0;   
const PROBE_FAR      = 8.0;   
const REEL_WINDOW_MS = 8000;  

// ---------------------------------------------------------------------------
//  STATE
// ---------------------------------------------------------------------------
let isFishing   = false;  
let biteReady   = false;  
let castingAnim = false;  
let marketBlip  = null;
let marketMenu  = null;
let fishingRod  = null;   
let jobActive   = false;  

// ---------------------------------------------------------------------------
//  SETUP / CLEANUP
// ---------------------------------------------------------------------------
mp.events.add('client:fishing:setupMarket', (x, y, z) => {
    if (marketBlip && mp.blips.exists(marketBlip)) marketBlip.destroy();
    marketBlip = mp.blips.new(500, new mp.Vector3(x, y, z), {
        name: 'Fish Market', color: 2, scale: 0.9, shortRange: true
    });

    jobActive = true; 
});

mp.events.add('client:fishing:cleanup', () => {
    if (marketBlip && mp.blips.exists(marketBlip)) { marketBlip.destroy(); marketBlip = null; }
    if (marketMenu) { marketMenu.destroy(); marketMenu = null; mp.gui.cursor.show(false, false); }

    isFishing   = false;
    biteReady   = false;
    castingAnim = false;
    jobActive   = false;

    mp.players.local.freezePosition(false);
    stopFishingAnim();
});

// ---------------------------------------------------------------------------
//  WATER VALIDATION
// ---------------------------------------------------------------------------
function sampleDepth(x, y, z) {
    try {
        // Safe check for water level
        let waterZ = mp.game.water.getWaterHeightNoWaves(x, y, z);
        if (waterZ == null || waterZ === undefined) {
            waterZ = mp.game.water.getWaterHeight(x, y, z);
        }

        if (typeof waterZ !== 'number' || waterZ < -999) return -1;

        // Ensure we aren't "street fishing" by checking the ground Z coordinate
        const groundZ = mp.game.gameplay.getGroundZFor3dCoord(x, y, z + 50.0, false, false);
        
        // If ground level is higher than water level, we are not above water
        if (groundZ && groundZ >= waterZ) return -1; 

        return waterZ - (groundZ || (z - 5.0));
    } catch (e) {
        return -1; // Fail silently without breaking the script
    }
}

function validateCastPosition() {
    const player  = mp.players.local;
    const pos     = player.position;
    const baseRad = (player.heading * Math.PI) / 180.0;
    
    // Check 3 points in front of the player (left, center, right)
    const angles  = [-40, 0, 40];
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

    if (!foundWater) return { ok: false, reason: 'Face the water before casting.' };
    if (!foundDeep) return { ok: false, reason: 'Water is too shallow here. Find a deeper spot.' };

    return { ok: true, reason: '' };
}

// ---------------------------------------------------------------------------
//  E KEY HANDLER - BOUND EXPLICITLY TO KEY DOWN (true)
// ---------------------------------------------------------------------------
mp.keys.bind(0x45, true, () => {
    // 0x45 is 'E'. "true" means it fires immediately on key press-down.
    if (!jobActive) return;
    if (mp.gui.cursor.visible) return;

    // Fish is on the line — reel in
    if (isFishing && biteReady) {
        biteReady = false;
        mp.events.callRemote('server:fishing:reel');
        return;
    }

    // Already casting/waiting — do nothing
    if (isFishing) return;

    // Validate Position
    const check = validateCastPosition();
    if (!check.ok) {
        // Replaced subtitle with standard GTA notification (100% reliable)
        mp.game.graphics.notify(`~r~${check.reason}`);
        return;
    }

    mp.events.callRemote('server:fishing:cast');
});

// ---------------------------------------------------------------------------
//  ANIMATION & PROPS
// ---------------------------------------------------------------------------
function createRod() {
    if (fishingRod) return;
    fishingRod = mp.objects.new(mp.game.joaat('prop_fishing_rod_01'), mp.players.local.position, {
        dimension: mp.players.local.dimension
    });
    setTimeout(() => {
        if (fishingRod && mp.objects.exists(fishingRod)) {
            fishingRod.attachTo(mp.players.local.handle, mp.players.local.getBoneIndex(18905),
                0.12, 0.05, 0.0,      // Position Offsets (x, y, z)
                50.0, 120.0, 160.0,   // Rotation Offsets (pitch, roll, yaw) - lowered pitch to dip it
                true, true, false, false, 1, true);
        }
    }, 150);
}

function destroyRod() {
    if (fishingRod && mp.objects.exists(fishingRod)) {
        fishingRod.destroy();
    }
    fishingRod = null;
}

function startFishingAnim() {
    const dict = 'amb@world_human_stand_fishing@idle_a';
    const name = 'idle_a';

    mp.game.streaming.requestAnimDict(dict);
    createRod(); 

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
    destroyRod(); 
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

    mp.game.graphics.notify('~b~Line in the water... wait for a bite.');
});

mp.events.add('client:fishing:bite', () => {
    biteReady = true;
    mp.game.cam.shakeGameplayCam('SMALL_EXPLOSION_SHAKE', 0.2);

    mp.game.graphics.notify('~g~FISH ON THE LINE! Press ~b~E~w~ to reel in!');
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