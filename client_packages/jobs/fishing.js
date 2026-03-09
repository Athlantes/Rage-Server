// client_packages/jobs/fishing.js
'use strict';

// ---------------------------------------------------------------------------
//  CONSTANTS
// ---------------------------------------------------------------------------
const MIN_DEPTH_M = 1.0;
const PROBE_NEAR  = 3.0;
const PROBE_FAR   = 8.0;

// ---------------------------------------------------------------------------
//  STATE
// ---------------------------------------------------------------------------
let isFishing    = false;
let biteReady    = false;
let castingAnim  = false;
let jobActive    = false;
let fishingRod   = null;

// CEF browser for minigame + bobber label
let mgBrowser    = null;

// Bobber (mp.markers.new — same API as every other job)
let bobberMarker = null;
let bobberPos    = null;   // { x, y, z }
let bobberState  = 'none'; // 'none' | 'waiting' | 'bite'

// Market blip
let marketBlip   = null;

// ---------------------------------------------------------------------------
//  CEF BROWSER — lazy-create, always alive while job is active
// ---------------------------------------------------------------------------
function ensureMgBrowser(cb) {
    if (mgBrowser) { if (cb) cb(); return; }
    mgBrowser = mp.browsers.new('package://ui/fishingMinigame.html');
    // Give the page a moment to load before executing JS into it
    setTimeout(() => { if (cb) cb(); }, 250);
}

function browserExec(js) {
    if (mgBrowser) mgBrowser.execute(js);
}

function destroyMgBrowser() {
    if (mgBrowser) { mgBrowser.destroy(); mgBrowser = null; }
}

// ---------------------------------------------------------------------------
//  BOBBER MARKER  (mp.markers.new — no native draw calls)
// ---------------------------------------------------------------------------
const MARKER_BLUE  = [30,  120, 255, 200];
const MARKER_GREEN = [0,   220, 80,  220];

function spawnBobber(pos) {
    destroyBobber();
    bobberPos   = pos;
    bobberState = 'waiting';
    bobberMarker = mp.markers.new(
        0,  // upward chevron / cone
        new mp.Vector3(pos.x, pos.y, pos.z),
        0.25,
        { color: MARKER_BLUE, visible: true, dimension: mp.players.local.dimension }
    );
}

function setBobberBite() {
    bobberState = 'bite';
    if (bobberMarker && mp.markers.exists(bobberMarker)) {
        bobberMarker.color = MARKER_GREEN;
    }
}

function destroyBobber() {
    if (bobberMarker && mp.markers.exists(bobberMarker)) bobberMarker.destroy();
    bobberMarker = null;
    bobberPos    = null;
    bobberState  = 'none';
}

// ---------------------------------------------------------------------------
//  WATER VALIDATION
// ---------------------------------------------------------------------------
function _sampleDepth(x, y, z) {
    try {
        let wz = mp.game.water.getWaterHeightNoWaves(x, y, z);
        if (wz == null || wz === undefined) wz = mp.game.water.getWaterHeight(x, y, z);
        if (typeof wz !== 'number' || wz < -999) return -1;
        const gz = mp.game.gameplay.getGroundZFor3dCoord(x, y, z + 50.0, false, false);
        if (gz && gz >= wz) return -1;
        return wz - (gz || (z - 5.0));
    } catch (e) { return -1; }
}

function _computeBobberPos() {
    const player = mp.players.local;
    const pos    = player.position;
    const rad    = (player.heading * Math.PI) / 180.0;
    const fwdX   = -Math.sin(rad);
    const fwdY   =  Math.cos(rad);
    const dist   = PROBE_NEAR + 2.0;
    const sx = pos.x + fwdX * dist;
    const sy = pos.y + fwdY * dist;
    let waterZ = pos.z;
    try {
        const wz = mp.game.water.getWaterHeightNoWaves(sx, sy, pos.z);
        if (typeof wz === 'number' && wz > -999) waterZ = wz;
    } catch (e) {}
    return { x: sx, y: sy, z: waterZ + 0.15 };
}

function _validateCast() {
    const player  = mp.players.local;
    const pos     = player.position;
    const baseRad = (player.heading * Math.PI) / 180.0;
    let foundWater = false, foundDeep = false;

    for (const angleDeg of [-40, 0, 40]) {
        const rad  = baseRad + (angleDeg * Math.PI / 180.0);
        const fwdX = -Math.sin(rad);
        const fwdY =  Math.cos(rad);
        for (const dist of [PROBE_NEAR, PROBE_FAR]) {
            const depth = _sampleDepth(pos.x + fwdX * dist, pos.y + fwdY * dist, pos.z);
            if (depth >= 0) {
                foundWater = true;
                if (depth >= MIN_DEPTH_M) { foundDeep = true; break; }
            }
        }
        if (foundDeep) break;
    }

    if (!foundWater) return { ok: false, reason: 'Face the water before casting.' };
    if (!foundDeep)  return { ok: false, reason: 'Water is too shallow here. Find a deeper spot.' };
    return { ok: true };
}

// ---------------------------------------------------------------------------
//  SETUP / CLEANUP
// ---------------------------------------------------------------------------
mp.events.add('client:fishing:setupMarket', (x, y, z) => {
    if (marketBlip && mp.blips.exists(marketBlip)) marketBlip.destroy();
    marketBlip = mp.blips.new(500, new mp.Vector3(x, y, z), {
        name: 'Fish Market', color: 2, scale: 0.9, shortRange: true
    });
    jobActive = true;

    // Spin up the CEF browser now so it's ready before the first cast
    ensureMgBrowser();

    mp.events.call('showNotification', 'Fisherman', 'Stand at any water edge and press ~b~E~w~ to cast.');
});

mp.events.add('client:fishing:cleanup', () => {
    if (marketBlip && mp.blips.exists(marketBlip)) { marketBlip.destroy(); marketBlip = null; }

    isFishing   = false;
    biteReady   = false;
    castingAnim = false;
    jobActive   = false;

    destroyBobber();
    _stopMinigameBrowser(null);
    destroyMgBrowser();
    mp.players.local.freezePosition(false);
    _stopFishingAnim();

    mp.events.call('client:clearAllJobObjectives');
});

// ---------------------------------------------------------------------------
//  E KEY HANDLER
// ---------------------------------------------------------------------------
mp.keys.bind(0x45, true, () => {
    if (!jobActive) return;
    if (mp.gui.cursor.visible) return;

    // Minigame running — attempt reel
    if (biteReady) {
        // Ask the CEF browser for the current indicator value via a custom event
        // We keep mgValue mirrored in client JS state to avoid async issues
        const inZone = _mgValueInZone();
        _stopMinigameBrowser(inZone ? 'success' : 'fail');

        if (inZone) {
            mp.events.callRemote('server:fishing:reel');
        } else {
            mp.events.call('showNotification', 'Fishing', '~r~You fumbled the reel! The fish escaped.');
            mp.events.callRemote('server:fishing:missReel');
        }
        biteReady = false;
        return;
    }

    if (isFishing) return; // Waiting for bite — nothing to do

    // Cast validation
    const check = _validateCast();
    if (!check.ok) {
        mp.events.call('showNotification', 'Fishing', `~r~${check.reason}`);
        return;
    }

    mp.events.callRemote('server:fishing:cast');
});

// ---------------------------------------------------------------------------
//  ANIMATION & PROPS
// ---------------------------------------------------------------------------
function _createRod() {
    if (fishingRod) return;
    fishingRod = mp.objects.new(mp.game.joaat('prop_fishing_rod_01'), mp.players.local.position, {
        dimension: mp.players.local.dimension
    });
    setTimeout(() => {
        if (fishingRod && mp.objects.exists(fishingRod)) {
            fishingRod.attachTo(
                mp.players.local.handle,
                mp.players.local.getBoneIndex(18905),
                0.12, 0.05, 0.0,
                50.0, 120.0, 160.0,
                true, true, false, false, 1, true
            );
        }
    }, 150);
}

function _destroyRod() {
    if (fishingRod && mp.objects.exists(fishingRod)) fishingRod.destroy();
    fishingRod = null;
}

function _startFishingAnim() {
    const dict = 'amb@world_human_stand_fishing@idle_a';
    const name = 'idle_a';
    mp.game.streaming.requestAnimDict(dict);
    _createRod();
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

function _stopFishingAnim() {
    _destroyRod();
    if (castingAnim) {
        mp.game.task.clearPedTasksImmediately(mp.players.local.handle);
        castingAnim = false;
    }
}

// ---------------------------------------------------------------------------
//  MINIGAME — state mirrored in JS for instant E-key check
//  The CEF does the rendering; we keep a parallel value here.
// ---------------------------------------------------------------------------
let _mgValue     = 0;
let _mgDir       = 1;
let _mgSpeed     = 40;
let _mgMin       = 35;
let _mgMax       = 65;
let _mgInterval  = null;

function _startMinigame(rarity) {
    // Difficulty scales with rarity:
    //   common   — wide zone (30–40), slow bar (28–36)
    //   uncommon — medium zone (18–26), medium bar (42–54)
    //   rare     — narrow zone (8–14), fast bar (62–78)
    let zoneMin, zoneMax, speedMin, speedMax;
    if (rarity === 'rare') {
        zoneMin = 8;  zoneMax = 14; speedMin = 62; speedMax = 78;
    } else if (rarity === 'uncommon') {
        zoneMin = 18; zoneMax = 26; speedMin = 42; speedMax = 54;
    } else {
        zoneMin = 30; zoneMax = 40; speedMin = 28; speedMax = 36;
    }

    const zoneWidth = zoneMin + Math.floor(Math.random() * (zoneMax - zoneMin + 1));
    _mgMin   = 10 + Math.floor(Math.random() * (80 - zoneWidth));
    _mgMax   = _mgMin + zoneWidth;
    _mgSpeed = speedMin + Math.floor(Math.random() * (speedMax - speedMin + 1));
    _mgValue = 0;
    _mgDir   = 1;

    // Tell the CEF to render the bar
    browserExec(`startMinigame(${_mgMin}, ${_mgMax}, ${_mgSpeed})`);

    // Mirror the same movement logic on the client side for the E-key check
    let last = Date.now();
    if (_mgInterval) clearInterval(_mgInterval);
    _mgInterval = setInterval(() => {
        const now   = Date.now();
        const delta = (now - last) / 1000;
        last        = now;
        _mgValue   += _mgDir * _mgSpeed * delta;
        if (_mgValue >= 100) { _mgValue = 100; _mgDir = -1; }
        if (_mgValue <= 0)   { _mgValue = 0;   _mgDir  = 1; }
    }, 16);
}

function _stopMinigameBrowser(result) {
    // result: 'success' | 'fail' | null (null = hide instantly, no flash)
    if (_mgInterval) { clearInterval(_mgInterval); _mgInterval = null; }
    browserExec(`stopMinigame(${result ? `'${result}'` : 'null'})`);
}

function _mgValueInZone() {
    return _mgValue >= _mgMin && _mgValue <= _mgMax;
}

// ---------------------------------------------------------------------------
//  BOBBER LABEL — pushed to CEF every render frame via world3dToScreen2d
//  This is the ONLY place we call world3dToScreen2d, and we do it solely to
//  get a 2D coordinate to pass into the CEF — no native text rendering at all.
// ---------------------------------------------------------------------------
mp.events.add('render', () => {
    if (!mgBrowser || !bobberPos || bobberState === 'none') return;

    const screen = mp.game.graphics.world3dToScreen2d(
        new mp.Vector3(bobberPos.x, bobberPos.y, bobberPos.z + 0.6)
    );

    if (screen) {
        browserExec(`showBobber(${screen.x}, ${screen.y}, '${bobberState}')`);
    }
});

// ---------------------------------------------------------------------------
//  SERVER → CLIENT EVENTS
// ---------------------------------------------------------------------------
mp.events.add('client:fishing:startCast', () => {
    isFishing = true;
    biteReady = false;

    // Spawn the bobber marker in the world (mp.markers.new — no native draw)
    spawnBobber(_computeBobberPos());

    // Show bobber label in CEF
    if (bobberPos) {
        const screen = mp.game.graphics.world3dToScreen2d(
            new mp.Vector3(bobberPos.x, bobberPos.y, bobberPos.z + 0.6)
        );
        if (screen) browserExec(`showBobber(${screen.x}, ${screen.y}, 'waiting')`);
    }

    mp.players.local.freezePosition(true);
    _startFishingAnim();

    mp.events.call('showNotification', 'Fishing', '~b~Line in the water... wait for a bite.');
});

mp.events.add('client:fishing:bite', (rarity) => {
    biteReady = true;
    setBobberBite(); // turns marker green

    // Start minigame with difficulty tuned to fish rarity
    _startMinigame(rarity || 'common');

    mp.events.call('showNotification', 'Fishing',
        '~g~FISH ON THE LINE! ~w~Press ~b~E~w~ when the bar hits the ~g~green zone~w~!');
});

mp.events.add('client:fishing:escapedFish', () => {
    _resetCastState();
    mp.events.call('showNotification', 'Fishing', '~r~The fish got away! Press ~b~E~w~ to cast again.');
});

mp.events.add('client:fishing:reelDone', (fishName, fishRarity, xp) => {
    _resetCastState();
    const tag = fishRarity === 'rare'     ? '~y~[RARE] '     :
                fishRarity === 'uncommon' ? '~b~[UNCOMMON] ' : '';
    mp.events.call('showNotification', 'Fishing',
        `${tag}~w~Caught a ~g~${fishName}~w~! ~y~+${xp} XP`);
});

mp.events.add('client:fishing:inventoryFull', () => {
    _resetCastState();
    mp.events.call('showNotification', 'Inventory', '~r~Inventory full! Sell your fish first.');
});

function _resetCastState() {
    isFishing = false;
    biteReady = false;
    destroyBobber();
    browserExec(`showBobber(0, 0, 'hide')`);
    _stopMinigameBrowser(null);
    mp.players.local.freezePosition(false);
    _stopFishingAnim();
}

// ---------------------------------------------------------------------------
//  MARKET MENU
// ---------------------------------------------------------------------------
let marketMenu = null;

mp.events.add('client:fishing:openMarket', (itemsJson) => {
    if (marketMenu) { marketMenu.execute(`loadItems('${itemsJson}')`); return; }
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