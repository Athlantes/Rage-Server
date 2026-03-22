// client_packages/jobs/repoClient.js
// ============================================================
// CLIENT-SIDE — Repo Job PvE Minigame
// ============================================================

'use strict';

let repoPhase        = 'idle';
let zoneBlip         = null;
let trunkBlip        = null;
let deliverBlip      = null;

let trackerBrowser   = null;
let trackerActive    = false;

let wantedPos        = null;
let dummyCarNetId    = -1;
let wantedCarNetId   = -1;

let trackerInterval  = null;
let localAmbushPeds  = [];
let ambushTriggered  = false; 

let lockBreakActive  = false;
let lockBreakBlip    = null;
let lockBreakPos     = null;
let lockBreakTimer   = null;

const KEY_QUIT = 0x08;

function dist3D(a, b) { const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return Math.sqrt(dx*dx + dy*dy + dz*dz); }
function createBlip(sprite, x, y, z, name, color, scale, route) {
    const blip = mp.blips.new(sprite, new mp.Vector3(x, y, z), { name: name, color: color, scale: scale, shortRange: false });
    if (route) { blip.setRoute(true); blip.setRouteColour(color); }
    return blip;
}
function destroyBlip(blip) { if (blip && mp.blips.exists(blip)) blip.destroy(); }
function clearInterval2(id) { if (id) clearInterval(id); return null; }
function destroyBrowser() { if (trackerBrowser) { try { trackerBrowser.destroy(); } catch (_) {} trackerBrowser = null; } trackerActive = false; }

function openTracker() {
    if (trackerBrowser) return;
    trackerBrowser = mp.browsers.new('package://tracker/index.html');
    trackerActive  = true;
    setTimeout(() => startTrackerInterval(), 1500);
}

function closeTracker() {
    trackerInterval = clearInterval2(trackerInterval);
    destroyBrowser();
}

function startTrackerInterval() {
    if (trackerInterval) return;
    ambushTriggered = false; 
    
    trackerInterval = setInterval(() => {
        if (!trackerBrowser || !wantedPos) return;
        const local = mp.players.local;
        const d = dist3D(local.position, wantedPos);
        
        if (d <= 150.0 && !ambushTriggered && repoPhase === 'PHASE_3_RADAR') {
            ambushTriggered = true;
            mp.events.callRemote('server:repo:triggerAmbush');
        }

        try { trackerBrowser.execute(`updateDistance(${Math.round(d)});`); } catch (e) {}
    }, 300);
}

mp.events.add('client:repo:showZoneBlip', (cx, cy, cz, radius) => {
    repoPhase = 'PHASE_1_FIND_DUMMY';
    destroyBlip(zoneBlip);
    zoneBlip = mp.blips.new(9, new mp.Vector3(cx, cy, cz), { name: 'Investigate Area', color: 56, alpha: 128, scale: radius / 10 });
    mp.game.ui.setNewWaypoint(cx, cy);
    mp.gui.chat.push(`!{#FFA500}[REPO]!{#FFFFFF} Drive to the marked area.`);
});

mp.events.add('client:repo:phaseGetTools', (mx, my, mz) => {
    repoPhase = 'PHASE_2_GET_TOOLS';
    destroyBlip(zoneBlip); zoneBlip = null;
    mp.game.ui.clearGpsFlags();
    destroyBlip(trunkBlip);
    trunkBlip = createBlip(279, mx, my, mz, 'Grab Tools', 5, 0.8, true);
    mp.gui.chat.push('!{#FFA500}[REPO]!{#FFFFFF} Approach the car trunk and press ~b~E~w~ to grab the tools.');
});

mp.events.add('client:repo:phaseRadar', (dummyNetId, wx, wy, wz) => {
    repoPhase    = 'PHASE_3_RADAR';
    dummyCarNetId = dummyNetId;
    wantedPos    = { x: wx, y: wy, z: wz };
    destroyBlip(trunkBlip); trunkBlip = null;

    const local = mp.players.local;
    mp.game.streaming.requestAnimDict('pickup_object');
    
    setTimeout(() => { 
        if (mp.game.streaming.hasAnimDictLoaded('pickup_object')) {
            mp.game.task.taskPlayAnim(local.handle, 'pickup_object', 'pickup_low', 8.0, -8.0, 1200, 1, 0, false, false, false);
        }
    }, 500);
    
    mp.game.ui.setNewWaypoint(wx, wy);
    mp.game.ui.setTextEntry('STRING');
    mp.game.ui.addTextComponentSubstringPlayerName('Tools acquired. Board the ~b~vehicle~w~ to activate the tracker.');
    mp.game.ui.drawSubtitleTimed(6000, true);
});

mp.events.add('playerEnterVehicle', (vehicle, seat) => {
    if (repoPhase !== 'PHASE_3_RADAR') return;
    if (seat !== -1) return; 

    let dummyLocal = null;
    try { dummyLocal = mp.vehicles.atRemoteId(dummyCarNetId); } catch (_) {}

    if (dummyLocal && mp.vehicles.exists(dummyLocal) && vehicle.handle === dummyLocal.handle) {
        onBoardedDummyCar();
    }
});

function onBoardedDummyCar() {
    mp.events.callRemote('server:repo:boardedDummyCar');
    openTracker();
}

mp.events.add('client:repo:phaseAmbush', (wantedNetId, pedSpawnDataJson, cx, cy, cz) => {
    repoPhase      = 'PHASE_4_AMBUSH';
    wantedCarNetId  = wantedNetId;
    localAmbushPeds = [];

    mp.game.ui.setTextEntry('STRING');
    mp.game.ui.addTextComponentSubstringPlayerName('~r~ARMED GUARDS~w~ are protecting the target. Eliminate them!');
    mp.game.ui.drawSubtitleTimed(6000, true);
    closeTracker();

    destroyBlip(trunkBlip);
    trunkBlip = createBlip(523, cx, cy, cz, 'Target Vehicle', 1, 0.9, true);

    setTimeout(() => {
        let pedSpawnData = [];
        try { pedSpawnData = JSON.parse(pedSpawnDataJson); } catch (e) {}
        
        pedSpawnData.forEach((sp, i) => {
            try {
                // RAGE requires a hash for client side mp.peds.new
                const modelHash = mp.game.joaat(sp.model);
                const ped = mp.peds.new(modelHash, new mp.Vector3(sp.x, sp.y, sp.z), sp.h, mp.players.local.dimension);
                localAmbushPeds.push(ped);
            } catch (e) {}
        });
        
        // Let handles initialize, then give weapons and tasks
        setTimeout(() => makeNpcsHostile(), 2000);
    }, 1500);

    setupLockBreakInteraction(cx, cy, cz);
});

function makeNpcsHostile() {
    const local = mp.players.local;
    localAmbushPeds.forEach((ped) => {
        // Verify ped spawned successfully and got an engine handle
        if (!ped || !mp.peds.exists(ped) || ped.handle === 0) return;
        
        try {
            const weaponHash = mp.game.joaat('WEAPON_PISTOL');
            
            // Natives must be used with ped.handle
            mp.game.weapon.giveWeaponToPed(ped.handle, weaponHash, 200, false, true);
            mp.game.ped.setBlockingOfNonTemporaryEvents(ped.handle, false);
            mp.game.ped.setPedFleeAttributes(ped.handle, 0, false);
            mp.game.ped.setPedCombatAttributes(ped.handle, 46, true);
            
            // Tell ped to fight the player
            mp.game.task.taskCombatPed(ped.handle, local.handle, 0, 16);
        } catch (e) {
            // Failsafe catch
        }
    });
}

function setupLockBreakInteraction(cx, cy, cz) {
    lockBreakPos = { x: cx, y: cy, z: cz };
    destroyBlip(lockBreakBlip);
    lockBreakBlip = createBlip(1, cx, cy, cz + 1.0, 'Break Lock', 6, 0.7, false);
}

mp.events.add('interaction:keypress', () => {
    if (repoPhase !== 'PHASE_4_AMBUSH' || lockBreakActive || mp.players.local.vehicle || !lockBreakPos) return;
    const local = mp.players.local;
    if (dist3D(local.position, lockBreakPos) > 8.0) return;

    let anyAlive = false;
    localAmbushPeds.forEach(ped => { 
        if (ped && mp.peds.exists(ped) && ped.handle !== 0) {
            // Use native check for death
            if (!mp.game.ped.isPedDeadOrDying(ped.handle, true)) {
                anyAlive = true;
            }
        } 
    });

    if (anyAlive) {
        mp.game.ui.setTextEntry('STRING');
        mp.game.ui.addTextComponentSubstringPlayerName('~r~Eliminate all guards first!');
        mp.game.ui.drawSubtitleTimed(3000, true);
        return;
    }

    let wantedLocal = null;
    try { wantedLocal = mp.vehicles.atRemoteId(wantedCarNetId); } catch (_) {}
    if (wantedLocal && mp.vehicles.exists(wantedLocal) && dist3D(local.position, wantedLocal.position) > 6.0) return;

    startLockBreak();
});

mp.events.add('render', () => {
    if (repoPhase !== 'PHASE_4_AMBUSH' || lockBreakActive || !lockBreakPos || mp.players.local.vehicle) return;
    if (dist3D(mp.players.local.position, lockBreakPos) > 8.0) return;

    let anyAlive = false;
    localAmbushPeds.forEach(ped => { 
        if (ped && mp.peds.exists(ped) && ped.handle !== 0) {
            if (!mp.game.ped.isPedDeadOrDying(ped.handle, true)) {
                anyAlive = true; 
            }
        } 
    });
    if (anyAlive) return;

    // Fixed RAGE wrapper displayHelpTextThisFrame argument
    mp.game.ui.displayHelpTextThisFrame("Press ~b~E~w~ to break the lock", false);
});

function startLockBreak() {
    lockBreakActive = true;
    const DURATION = 5000;
    mp.game.ui.setTextEntry('STRING');
    mp.game.ui.addTextComponentSubstringPlayerName('~b~Breaking lock...~w~ Don\'t move!');
    mp.game.ui.drawSubtitleTimed(DURATION + 500, true);

    mp.game.streaming.requestAnimDict('anim@amb@clubhouse@caricabarile@male@');
    const local = mp.players.local;
    
    setTimeout(() => { 
        if (mp.game.streaming.hasAnimDictLoaded('anim@amb@clubhouse@caricabarile@male@')) {
            mp.game.task.taskPlayAnim(local.handle, 'anim@amb@clubhouse@caricabarile@male@', 'caricabarile_idle', 8.0, -8.0, DURATION, 1, 0, false, false, false);
        }
    }, 200);

    lockBreakTimer = setTimeout(() => {
        lockBreakActive = false;
        destroyBlip(lockBreakBlip); lockBreakBlip = null;
        destroyBlip(trunkBlip);    trunkBlip      = null;
        mp.events.callRemote('server:repo:lockBroken');
    }, DURATION);
}

mp.events.add('client:repo:enterWantedCar', (wantedNetId) => {
    if (wantedNetId < 0) return;
    let wantedLocal = null;
    try { wantedLocal = mp.vehicles.atRemoteId(wantedNetId); } catch (_) {}
    if (!wantedLocal || !mp.vehicles.exists(wantedLocal)) return;

    // Use task namespace with handle for entry
    mp.game.task.taskEnterVehicle(mp.players.local.handle, wantedLocal.handle, 10000, -1, 1.0, 1, 0); 
});

mp.events.add('client:repo:phaseDeliver', (dx, dy, dz) => {
    repoPhase = 'PHASE_5_DELIVER';
    closeTracker();
    destroyBlip(deliverBlip); destroyBlip(trunkBlip);
    deliverBlip = createBlip(479, dx, dy, dz, 'Deliver to Salvatore', 2, 0.9, true);
    mp.game.ui.setNewWaypoint(dx, dy);

    mp.game.ui.setTextEntry('STRING');
    mp.game.ui.addTextComponentSubstringPlayerName('~g~Drive the vehicle to Salvatore\'s location.~w~');
    mp.game.ui.drawSubtitleTimed(6000, true);
});

mp.events.add('client:repo:sync', (jsonStr) => { try { const jobs = JSON.parse(jsonStr); } catch (_) {} });

mp.events.add('client:repo:cleanup', () => {
    repoPhase = 'idle'; wantedPos = null; dummyCarNetId = -1; wantedCarNetId = -1; lockBreakActive = false;
    localAmbushPeds.forEach(ped => { try { if (mp.peds.exists(ped)) ped.destroy(); } catch (_) {} });
    localAmbushPeds = [];
    trackerInterval = clearInterval2(trackerInterval);
    if (lockBreakTimer) { clearTimeout(lockBreakTimer); lockBreakTimer = null; }
    closeTracker();
    destroyBlip(zoneBlip); zoneBlip = null;
    destroyBlip(trunkBlip); trunkBlip = null;
    destroyBlip(deliverBlip); deliverBlip = null;
    destroyBlip(lockBreakBlip); lockBreakBlip = null;
    lockBreakPos = null;
    mp.game.ui.clearGpsFlags();
});

mp.keys.bind(KEY_QUIT, false, () => {
    if (repoPhase === 'idle' || mp.gui.cursor.visible) return;
    mp.gui.chat.push('!{#FFA500}[REPO]!{#FFFFFF} Type /quitrepo to abandon the current job.');
});

mp.events.add('consoleInput', (text) => {
    if (text.toLowerCase() === '/quitrepo' && repoPhase !== 'idle') mp.events.callRemote('server:repo:quit');
});