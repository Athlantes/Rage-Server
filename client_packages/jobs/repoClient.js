// client_packages/jobs/repoClient.js
// ============================================================
// CLIENT-SIDE — Repo Job PvE Minigame
// ============================================================

'use strict';

let repoPhase        = 'idle';
let zoneBlip         = null;
let trunkBlip        = null;
let deliverBlip      = null;
let repoSearchBlip = null;
let deliverMarker    = null;
let trunkAnimActive  = false;

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

function destroyBrowser() { 
    if (trackerBrowser) { try { trackerBrowser.destroy(); } catch (_) {} trackerBrowser = null; } 
    trackerActive = false; 
}

function openTracker() {
    if (trackerBrowser) return;
    trackerBrowser = mp.browsers.new('package://tracker/index.html');
    trackerActive  = true;
    setTimeout(() => startTrackerInterval(), 1500);
}

function closeTracker() {
    if (trackerInterval) {
        clearInterval(trackerInterval);
        trackerInterval = null;
    }
    destroyBrowser();
}

function startTrackerInterval() {
    if (trackerInterval) return;
    ambushTriggered = false; 
    
    trackerInterval = setInterval(() => {
        if (!wantedPos) return;
        const local = mp.players.local;
        const d = dist3D(local.position, wantedPos);
        
        if (d <= 150.0 && !ambushTriggered && repoPhase === 'PHASE_3_RADAR') {
            ambushTriggered = true;
            mp.events.callRemote('server:repo:triggerAmbush');
        }
    }, 300);
}

mp.events.add('client:repo:phaseGetTools', (dummyNetId, cx, cy, cz) => {
    repoPhase = 'PHASE_2_GET_TOOLS';
    dummyCarNetId = dummyNetId;
    destroyBlip(trunkBlip);

    trunkBlip = createBlip(279, cx, cy, cz, 'Dummy Car', 5, 0.8, true);
    mp.gui.chat.push('!{#FFA500}[REPO]!{#FFFFFF} Mergi exact în spatele mașinii (la portbagaj) și apasă ~b~E~w~ pentru unelte.');
});

mp.events.add('client:repo:phaseRadar', (dummyNetId, wx, wy, wz) => {
    repoPhase    = 'PHASE_3_RADAR';
    dummyCarNetId = dummyNetId;
    wantedPos    = { x: wx, y: wy, z: wz };
    destroyBlip(trunkBlip); trunkBlip = null;
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
    mp.game.ui.addTextComponentSubstringPlayerName('~r~The guards spotted you!');
    mp.game.ui.drawSubtitleTimed(4000, true);

    mp.game.ped.setRelationshipBetweenGroups(5, GUARD_GROUP, playerGroup);
    mp.game.ped.setRelationshipBetweenGroups(5, playerGroup, GUARD_GROUP);

    localAmbushPeds.forEach((ped) => {
        if (!ped || !mp.peds.exists(ped) || ped.handle === 0) return;
        try {
            if (ped.isDeadOrDying(true) || ped.getHealth() <= 0) return;
            
            ped.clearTasksImmediately();

            ped.setBlockingOfNonTemporaryEvents(true);
            ped.setFleeAttributes(0, false);
            
            ped.setCombatAttributes(46, true); 
            ped.setCombatAttributes(0, false); 
            ped.setCombatAttributes(1, false); 
            ped.setCombatAttributes(5, true);  
            
            mp.game.invoke('0x4D9CA1009AFBD057', ped.handle, 0); 
            
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
    
    // Check if player is within 8 meters of the interaction spot
    if (dist3D(local.position, lockBreakPos) > 8.0) return;

    startLockBreak();
});

mp.events.add('render', () => {
    const local = mp.players.local;

    if (trackerActive && trackerBrowser && wantedPos) {
        const playerPos = local.position;
        
        const d = dist3D(playerPos, wantedPos);

        const dx = wantedPos.x - playerPos.x;
        const dy = wantedPos.y - playerPos.y;
        
        const targetHeading = Math.atan2(dx, dy) * (180 / Math.PI);
        const camHeading = mp.game.cam.getGameplayCamRot(2).z;
        const uiAngle = targetHeading + camHeading;

        try { 
            trackerBrowser.execute(`updateTrackerState(${uiAngle}, ${Math.round(d)})`); 
        } catch (e) {}
    }

    if (repoPhase !== 'PHASE_4_AMBUSH' || lockBreakActive || !lockBreakPos || local.vehicle) return;

    // --- Dynamic Aggro Logic ---
    if (!npcsHostile) {
        let shouldAggro = false;

        if (local.isShooting() && dist3D(local.position, lockBreakPos) < 60.0) {
            shouldAggro = true;
        }

        localAmbushPeds.forEach(ped => {
            try {
                if (!ped || !mp.peds.exists(ped) || ped.handle === 0) return;
                if (ped.isDeadOrDying(true) || ped.getHealth() <= 0) return;

                if (dist3D(local.position, ped.position) < 12.0) {
                    shouldAggro = true;
                }

                const startHealth = initialPedHealths.get(ped.handle);
                if (startHealth && ped.getHealth() < startHealth) {
                    shouldAggro = true;
                }

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
    if (dist3D(local.position, lockBreakPos) <= 8.0) {
        mp.game.controls.disableControlAction(0, 23, true); // Disable Enter Vehicle (F)
        mp.game.ui.displayHelpTextThisFrame("Press ~b~E~w~ to break the lock", false);
    }

    // Adaugă acest bloc imediat deasupra verificărilor pentru lockBreakActive
    if (repoPhase === 'PHASE_2_GET_TOOLS' && !trunkAnimActive && !local.vehicle) {
        let dummyVehicle = mp.vehicles.atRemoteId(dummyCarNetId);
        if (dummyVehicle && dummyVehicle.handle !== 0) {
            const bootBone = dummyVehicle.getBoneIndexByName('boot');
            let trunkPos = dummyVehicle.position;
            
            if (bootBone !== -1) {
                trunkPos = dummyVehicle.getBoneCoords(bootBone, 0, 0, 0);
            } else {
                const fwd = dummyVehicle.getForwardVector();
                trunkPos = new mp.Vector3(dummyVehicle.position.x - fwd.x * 2.5, dummyVehicle.position.y - fwd.y * 2.5, dummyVehicle.position.z);
            }

            if (dist3D(local.position, trunkPos) <= 1.5) {
                mp.game.ui.displayHelpTextThisFrame("Apasă ~b~E~w~ pentru a căuta în portbagaj", false);
            }
        }
    }
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
        lockBreakTimer = null; // Clear the timer ID immediately so the cleanup function ignores it
        destroyBlip(lockBreakBlip); lockBreakBlip = null;
        destroyBlip(trunkBlip);    trunkBlip      = null;
        mp.events.callRemote('server:repo:lockBroken');
    }, DURATION);
}

// Eveniment pentru a crea zona gri de căutare
mp.events.add('client:repo:createSearchArea', (x, y, z, radius) => {
    // Curățăm un blip vechi dacă există (siguranță)
    if (repoSearchBlip && mp.blips.exists(repoSearchBlip)) {
        repoSearchBlip.destroy();
    }

    // Creăm un blip de tip zonă (ID 9)
    repoSearchBlip = mp.blips.new(9, new mp.Vector3(x, y, z), {       
        color: 39,          // Gri deschis neutru
        alpha: 100,         // Transparență scăzută
        scale: 20, // Dimensiunea zonei
        shortRange: true,   // Îl ține ascuns pe harta globală dacă ești prea departe
        drawDistance: 0
    });
});

// Eveniment pentru a distruge zona când a fost găsită mașina
mp.events.add('client:repo:destroySearchArea', () => {
    if (repoSearchBlip && mp.blips.exists(repoSearchBlip)) {
        repoSearchBlip.destroy();
        repoSearchBlip = null;
    }
});

mp.events.add('client:repo:enterWantedCar', (wantedNetId) => {
    if (wantedNetId < 0) return;
    let wantedLocal = null;
    try { wantedLocal = mp.vehicles.atRemoteId(wantedNetId); } catch (_) {}
    if (!wantedLocal || !mp.vehicles.exists(wantedLocal)) return;

    // Slight delay to ensure the server's VehicleSync has applied the unlock state
    setTimeout(() => {
        mp.players.local.taskEnterVehicle(wantedLocal.handle, 10000, -1, 1.0, 1, 0); 
    }, 500);
});

mp.events.add('client:repo:phaseDeliver', (dx, dy, dz) => {
    repoPhase = 'PHASE_5_DELIVER';
    closeTracker();
    destroyBlip(deliverBlip); destroyBlip(trunkBlip);
    
    deliverBlip = createBlip(1, dx, dy, dz, 'Deliver to Salvatore', 1, 0.8, true);
    
    // Scale reduced to 4.0
    deliverMarker = mp.markers.new(1, new mp.Vector3(dx, dy, dz - 1.0), 4.0, {
        color: [255, 0, 0, 150],
        visible: true
    });

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
    
    if (trackerInterval) { clearInterval(trackerInterval); trackerInterval = null; }
    if (lockBreakTimer) { clearTimeout(lockBreakTimer); lockBreakTimer = null; }
    
    closeTracker();
    destroyBlip(zoneBlip); zoneBlip = null;
    destroyBlip(trunkBlip); trunkBlip = null;
    destroyBlip(deliverBlip); deliverBlip = null;
    destroyBlip(lockBreakBlip); lockBreakBlip = null;
    lockBreakPos = null;
    
    if (deliverMarker) {
        deliverMarker.destroy();
        deliverMarker = null;
    }
    
    mp.game.ui.clearGpsFlags();
});

mp.keys.bind(0x45, false, () => { // Tasta E
    if (repoPhase === 'PHASE_2_GET_TOOLS' && !trunkAnimActive && !mp.players.local.vehicle) {
        let dummyVehicle = mp.vehicles.atRemoteId(dummyCarNetId);
        if (dummyVehicle && dummyVehicle.handle !== 0) {
            
            // Calculăm unde este portbagajul
            const bootBone = dummyVehicle.getBoneIndexByName('boot');
            let trunkPos = dummyVehicle.position;
            
            if (bootBone !== -1) {
                // Use the native to get the bone position for vehicles
                trunkPos = mp.game.invokeVector3('0x44A8FCB8ED227738', dummyVehicle.handle, bootBone);
            } else {
                // Fallback daca masina nu are boot bone
                const fwd = dummyVehicle.getForwardVector();
                trunkPos = new mp.Vector3(
                    dummyVehicle.position.x - fwd.x * 2.5,
                    dummyVehicle.position.y - fwd.y * 2.5,
                    dummyVehicle.position.z
                );
            }

            // Distanță foarte mică (1.5 metri max) față de PORTBAGAJ, nu centrul mașinii
            if (dist3D(mp.players.local.position, trunkPos) <= 1.5) {
                startTrunkLootSequence(dummyVehicle);
            } else if (dist3D(mp.players.local.position, dummyVehicle.position) <= 5.0) {
                mp.gui.chat.push('!{#FFA500}[REPO]!{#FFFFFF} Trebuie să te poziționezi exact în spatele mașinii!');
            }
        }
    }
});

function startTrunkLootSequence(vehicle) {
    trunkAnimActive = true;
    const DURATION = 3500; // 3.5 secunde durează acțiunea
    const local = mp.players.local;

    // 1. Deschide ușa portbagajului (index 5)
    vehicle.setDoorOpen(5, false, false);
    
    mp.game.ui.setTextEntry('STRING');
    mp.game.ui.addTextComponentSubstringPlayerName('~y~Cauți uneltele în portbagaj...');
    mp.game.ui.drawSubtitleTimed(DURATION, true);

    // 2. Play la animația de căutare
    mp.game.streaming.requestAnimDict('anim@heists@narcotics@trash');
    let waitAnim = setInterval(() => {
        if (mp.game.streaming.hasAnimDictLoaded('anim@heists@narcotics@trash')) {
            clearInterval(waitAnim);
            mp.game.task.taskPlayAnim(local.handle, 'anim@heists@narcotics@trash', 'rummage', 8.0, -8.0, DURATION, 1, 0, false, false, false);
            
            // 3. Finalizarea acțiunii
            setTimeout(() => {
                // Închidem portbagajul
                if (vehicle && mp.vehicles.exists(vehicle)) {
                    vehicle.setDoorShut(5, false);
                }
                trunkAnimActive = false;
                
                // Trimitem confirmarea către server pentru a trece la faza 3
                mp.events.callRemote('server:repo:toolsGrabbed');
            }, DURATION);
        }
    }, 50);
}

mp.keys.bind(KEY_QUIT, false, () => {
    if (repoPhase === 'idle' || mp.gui.cursor.visible) return;
    mp.gui.chat.push('!{#FFA500}[REPO]!{#FFFFFF} Type /quitrepo to abandon the current job.');
});

mp.events.add('consoleInput', (text) => {
    if (text.toLowerCase() === '/quitrepo' && repoPhase !== 'idle') mp.events.callRemote('server:repo:quit');
});