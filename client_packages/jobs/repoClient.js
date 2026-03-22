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

// Variables for dynamic hostility
let npcsHostile = false;
let initialPedHealths = new Map();

// Relationship Groups for AI handling (Using built-in GTA groups)
const GUARD_GROUP = mp.game.joaat('SECURITY_GUARD');

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
    npcsHostile     = false;
    initialPedHealths.clear();

    mp.game.ui.setTextEntry('STRING');
    mp.game.ui.addTextComponentSubstringPlayerName('~y~Guards are protecting the target. Sneak up or take them out!');
    mp.game.ui.drawSubtitleTimed(6000, true);
    closeTracker();

    destroyBlip(trunkBlip);
    trunkBlip = createBlip(523, cx, cy, cz, 'Target Vehicle', 1, 0.9, true);

    setTimeout(() => {
        let pedSpawnData = [];
        try { pedSpawnData = JSON.parse(pedSpawnDataJson); } catch (e) {}
        
        const playerGroup = mp.players.local.getRelationshipGroupHash();

        // Ensure they start out Neutral (3) 
        mp.game.ped.setRelationshipBetweenGroups(3, GUARD_GROUP, playerGroup);
        mp.game.ped.setRelationshipBetweenGroups(3, playerGroup, GUARD_GROUP);

        pedSpawnData.forEach((sp, i) => {
            try {
                const modelHash = mp.game.joaat(sp.model);
                const ped = mp.peds.new(modelHash, new mp.Vector3(sp.x, sp.y, sp.z), sp.h, mp.players.local.dimension);
                localAmbushPeds.push(ped);
            } catch (e) {}
        });
        
        setTimeout(() => {
            localAmbushPeds.forEach(ped => {
                if (ped && mp.peds.exists(ped) && ped.handle !== 0) {
                    ped.freezePosition(false);
                    ped.setBlockingOfNonTemporaryEvents(true);
                    
                    // --- FIX: Force Remove ALL Invincibility Flags via Natives ---
                    ped.setInvincible(false);
                    mp.game.invoke('0x3882114BDE571AD4', ped.handle, false); // SET_ENTITY_INVINCIBLE
                    mp.game.invoke('0x1760FFA8AB074D66', ped.handle, true);  // SET_ENTITY_CAN_BE_DAMAGED
                    mp.game.invoke('0xFAEE099C6F890BB8', ped.handle, false, false, false, false, false, false, false, false); // SET_ENTITY_PROOFS
                    mp.game.invoke('0x63F58F7C80513AAD', ped.handle, true);  // SET_PED_CAN_BE_TARGETTED

                    ped.setRelationshipGroupHash(GUARD_GROUP);

                    const weaponHash = mp.game.joaat('WEAPON_PISTOL');
                    ped.giveWeapon(weaponHash, 9999, true); 
                    initialPedHealths.set(ped.handle, ped.getHealth());
                }
            });
        }, 1000);
    }, 1500);

    setupLockBreakInteraction(cx, cy, cz);
});

function makeNpcsHostile() {
    const local = mp.players.local;
    const playerGroup = local.getRelationshipGroupHash();

    mp.game.ui.setTextEntry('STRING');
    mp.game.ui.addTextComponentSubstringPlayerName('~r~The guards spotted you! Take them out!');
    mp.game.ui.drawSubtitleTimed(4000, true);

    // Instantly switch engine relationship to HATE (5)
    mp.game.ped.setRelationshipBetweenGroups(5, GUARD_GROUP, playerGroup);
    mp.game.ped.setRelationshipBetweenGroups(5, playerGroup, GUARD_GROUP);

    localAmbushPeds.forEach((ped) => {
        if (!ped || !mp.peds.exists(ped) || ped.handle === 0) return;
        try {
            if (ped.isDeadOrDying(true)) return;
            
            // Wipe the queue in case they already started the "Civilian Flee" animation
            ped.clearTasksImmediately();

            ped.setBlockingOfNonTemporaryEvents(true);
            ped.setFleeAttributes(0, false);
            
            // Combat attributes
            ped.setCombatAttributes(46, true); // Always fight
            ped.setCombatAttributes(0, false); // CANNOT USE COVER
            ped.setCombatAttributes(1, false); // CAN_USE_VEHICLES
            ped.setCombatAttributes(5, true);  // Can fight armed peds when not armed (Failsafe)
            
            // SET_PED_COMBAT_MOVEMENT (0 = Stationary)
            mp.game.invoke('0x4D9CA1009AFBD057', ped.handle, 0); 
            
            // Aggressive pursuit task using flags 16, 16
            ped.taskCombat(local.handle, 16, 16);
        } catch (e) {}
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
            if (!ped.isDeadOrDying(true)) {
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
    
    const local = mp.players.local;

    // --- Dynamic Aggro Logic ---
    if (!npcsHostile) {
        let shouldAggro = false;

        if (local.isShooting() && dist3D(local.position, lockBreakPos) < 60.0) {
            shouldAggro = true;
        }

        localAmbushPeds.forEach(ped => {
            if (!ped || !mp.peds.exists(ped) || ped.handle === 0) return;
            try {
                if (ped.isDeadOrDying(true)) return;

                if (dist3D(local.position, ped.position) < 12.0) {
                    shouldAggro = true;
                }

                const startHealth = initialPedHealths.get(ped.handle);
                if (startHealth && ped.getHealth() < startHealth) {
                    shouldAggro = true;
                }

                // Native wrapper check for aiming
                if (mp.game.player.isFreeAimingAtEntity(ped.handle)) {
                    shouldAggro = true;
                }
            } catch (e) {}
        });

        if (shouldAggro) {
            npcsHostile = true;
            makeNpcsHostile();
        }
    }
    // ---------------------------

    if (dist3D(local.position, lockBreakPos) > 8.0) return;

    let anyAlive = false;
    localAmbushPeds.forEach(ped => { 
        if (ped && mp.peds.exists(ped) && ped.handle !== 0) {
            if (!ped.isDeadOrDying(true)) {
                anyAlive = true; 
            }
        } 
    });
    
    if (anyAlive) return;

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
    npcsHostile = false; initialPedHealths.clear();
    
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