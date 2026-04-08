// client_packages/factions/lspd/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Client-side LSPD mechanics.
//
//  Interaction prompt
//  ------------------
//  Uses the EXISTING overlay multi-key array format so "G  Cuff PlayerName"
//  renders with the correct key badge styling.  The cuff/jail prompt is managed
//  via a separate `gKeyInteraction` variable and NEVER touches `activeInteraction`
//  (the ColShape E-key slot), so the two systems cannot conflict.
//
//  When BOTH prompts need to show at once (e.g. player inside a colshape AND
//  near a RoS suspect) the overlay merges them into a single multi-row prompt.
//
//  Animation sync
//  --------------
//  client:lspd:cuffAnim is broadcast by the server to ALL players within range,
//  so the cuff animation is visible to bystanders too.
//
//  Vehicle detain fix
//  ------------------
//  Follow-tick is killed synchronously BEFORE setIntoVehicle to prevent the
//  Z-drop / under-map bug.
// ─────────────────────────────────────────────────────────────────────────────

const ANIM_CUFFED     = { dict: 'mp_arresting', anim: 'idle',    flag: 49 };
const ANIM_CUFF_INTRO = { dict: 'mp_arresting', anim: 'a_uncuff',flag: 48 };

// ── Local state ───────────────────────────────────────────────────────────────
let cuffed            = false;
let cuffedToOfficerId = null;
let cuffFollowTick    = null;

// Officer-side
let jailDropPoints  = [];
let jailDropBlips   = [];
let nearJailDrop    = false;
let nearCuffTarget  = null; // { remoteId, displayName } | null
// The current G-key action to show (null = none)
// { key:'G', label:'...', accent?:true, pd?:true }
let gKeyAction      = null;

// ── Util ──────────────────────────────────────────────────────────────────────

async function loadAnimDict(dict) {
    return new Promise(resolve => {
        if (mp.game.streaming.hasAnimDictLoaded(dict)) return resolve();
        mp.game.streaming.requestAnimDict(dict);
        const iv = setInterval(() => {
            if (mp.game.streaming.hasAnimDictLoaded(dict)) { clearInterval(iv); resolve(); }
        }, 50);
    });
}

function dist2(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function dist3(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// ── Prompt rendering ──────────────────────────────────────────────────────────
// We call showInteraction with a multi-row array that merges the ColShape E-key
// row (if any) with our G-key row.  This way a single setInteraction call always
// renders the full picture and neither system stomps the other.
//
// We hook into the existing 'interaction:restore' event so our row survives
// menu-close restores too.

// Read the ColShape slot without modifying it
function getActiveColshapeInteraction() {
    // interaction.js stores this in its own closure; we can't read it directly.
    // Instead we track it ourselves via a shadow variable updated by the events.
    return _shadowColshapeInteraction;
}

let _shadowColshapeInteraction = null;
let _lastEntrySurrenderPrompt = null;

function shouldUseEntrySurrenderPrompt() {
    const cs = _shadowColshapeInteraction;
    if (!cs || cs.event !== 'faction:lspd:enter') return false;

    const local = mp.players.local;
    if (!local || local.vehicle) return false;

    const wantedType = local.getVariable ? local.getVariable('wantedType') : null;
    const dutyCountRaw = local.getVariable ? local.getVariable('lspdDutyCount') : 0;
    const dutyCount = Number(dutyCountRaw || 0);

    return !!wantedType && dutyCount === 0;
}

mp.events.add('playerEnterColshape', (shape) => {
    if (!shape || !mp.colshapes.exists(shape)) return;
    const data = shape.getVariable('interaction') || shape.interaction;
    if (data) _shadowColshapeInteraction = data;
});

mp.events.add('playerExitColshape', (shape) => {
    // If the colshape was destroyed while we were inside it, clear the prompt just in case
    if (!shape || !mp.colshapes.exists(shape)) {
        if (_shadowColshapeInteraction) {
            _shadowColshapeInteraction = null;
            refreshPrompt();
        }
        return;
    }

    const data = shape.getVariable('interaction') || shape.interaction;
    if (data) { 
        _shadowColshapeInteraction = null; 
        refreshPrompt(); 
    }
});

function refreshPrompt() {
    const rows = [];

    // E-key row from colshape (if any)
    const cs = _shadowColshapeInteraction;
    if (cs) {
        if (shouldUseEntrySurrenderPrompt()) {
            rows.push({ key: 'E', label: 'No one is on duty. You can Surrender. Press E to Surrender.' });
        } else {
            rows.push({ key: 'E', label: (cs.title ? cs.title + ': ' : '') + (cs.text || '') });
        }
    }

    // G-key row (cuff or jail drop)
    if (gKeyAction) {
        rows.push(gKeyAction);
    }

    if (rows.length === 0) {
        mp.events.call('hideInteraction');
    } else {
        // Pass as JSON array string — overlay's multi-key path handles this
        mp.events.call('showInteraction', JSON.stringify(rows));
    }
}

// Keep our shadow in sync when interaction:restore fires (menu close)
mp.events.add('interaction:restore', () => {
    refreshPrompt();
});

function setGKeyAction(action) {
    // action = { key:'G', label:'...', pd?:true } or null
    gKeyAction = action;
    refreshPrompt();
}

// ── Cuff animation (synced to all nearby clients) ─────────────────────────────

mp.events.add('client:lspd:cuffAnim', async (suspectRemoteId, officerRemoteId, cuffing) => {
    const isLocalSuspect = (suspectRemoteId === mp.players.local.remoteId);
    const isLocalOfficer = (officerRemoteId  === mp.players.local.remoteId);

    if (isLocalSuspect) {
        cuffed            = cuffing;
        cuffedToOfficerId = cuffing ? officerRemoteId : null;

        if (cuffing) {
            await loadAnimDict(ANIM_CUFF_INTRO.dict);
            mp.players.local.taskPlayAnim(
                ANIM_CUFF_INTRO.dict, ANIM_CUFF_INTRO.anim,
                8.0, -8.0, 2000, ANIM_CUFF_INTRO.flag, 0, false, false, false
            );
            setTimeout(async () => {
                if (!cuffed) return;
                await loadAnimDict(ANIM_CUFFED.dict);
                mp.players.local.taskPlayAnim(
                    ANIM_CUFFED.dict, ANIM_CUFFED.anim,
                    8.0, -8.0, -1, ANIM_CUFFED.flag, 0, false, false, false
                );
            }, 2100);

            // Follow-tick: keep cuffed player beside officer while on foot
            if (cuffFollowTick) clearInterval(cuffFollowTick);
            cuffFollowTick = setInterval(() => {
                if (!cuffed || cuffedToOfficerId === null) {
                    clearInterval(cuffFollowTick); cuffFollowTick = null; return;
                }
                if (mp.players.local.vehicle) return; // in car — detain handles position

                const officer = mp.players.atRemoteId(cuffedToOfficerId);
                if (!officer || !mp.players.exists(officer)) return;
                if (officer.vehicle) return;

                const offPos = officer.position;
                const myPos  = mp.players.local.position;
                const dist   = Math.sqrt((offPos.x-myPos.x)**2 + (offPos.y-myPos.y)**2);

                if (dist > 3.5) {
                    mp.players.local.position = new mp.Vector3(
                        offPos.x - Math.sin(officer.heading * Math.PI / 180) * 1.0,
                        offPos.y - Math.cos(officer.heading * Math.PI / 180) * 1.0,
                        offPos.z
                    );
                }
                [30, 31, 21, 22, 24, 25].forEach(ctrl =>
                    mp.game.controls.disableControlAction(0, ctrl, true)
                );
            }, 100);

        } else {
            cuffed = false; cuffedToOfficerId = null;
            if (cuffFollowTick) { clearInterval(cuffFollowTick); cuffFollowTick = null; }
            mp.players.local.clearTasks();
            clearJailDropBlips();
        }

    } else if (isLocalOfficer && cuffing) {
        await loadAnimDict(ANIM_CUFF_INTRO.dict);
        mp.players.local.taskPlayAnim(
            ANIM_CUFF_INTRO.dict, ANIM_CUFF_INTRO.anim,
            8.0, -8.0, 2000, ANIM_CUFF_INTRO.flag, 0, false, false, false
        );
    }
    // Bystanders: RAGE syncs ped anims automatically via the streamer.
});

// ── Vehicle detain ────────────────────────────────────────────────────────────

mp.events.add('client:lspd:detainInVehicle', (vehId, seat) => {
    // Kill follow-tick FIRST — this prevents the Z-drop / under-map bug.
    if (cuffFollowTick) { clearInterval(cuffFollowTick); cuffFollowTick = null; }
    mp.players.local.clearTasks();

    const doWarp = () => {
        const veh = mp.vehicles.atRemoteId(vehId);
        if (!veh || !mp.vehicles.exists(veh)) return false;
        mp.players.local.setIntoVehicle(veh.handle, seat);
        return true;
    };

    const resumeAnim = () => {
        setTimeout(async () => {
            if (!cuffed) return;
            await loadAnimDict(ANIM_CUFFED.dict);
            mp.players.local.taskPlayAnim(
                ANIM_CUFFED.dict, ANIM_CUFFED.anim,
                8.0, -8.0, -1, ANIM_CUFFED.flag, 0, false, false, false
            );
        }, 600);
    };

    if (!doWarp()) {
        setTimeout(() => { if (doWarp()) resumeAnim(); }, 400);
    } else {
        resumeAnim();
    }
});

// ── Eject & teleport to jail ──────────────────────────────────────────────────

mp.events.add('client:lspd:ejectAndTeleport', (x, y, z) => {
    if (cuffFollowTick) { clearInterval(cuffFollowTick); cuffFollowTick = null; }
    mp.players.local.clearTasks();
    cuffed = false; cuffedToOfficerId = null;
    mp.players.local.position = new mp.Vector3(x, y, z);
    clearJailDropBlips();
    setGKeyAction(null);
});

// ── Jail drop blips ───────────────────────────────────────────────────────────

function clearJailDropBlips() {
    jailDropBlips.forEach(b => { try { b.destroy(); } catch(e) {} });
    jailDropBlips = []; jailDropPoints = []; nearJailDrop = false;
}

mp.events.add('client:lspd:updateJailDrops', (pointsJson) => {
    clearJailDropBlips();
    jailDropPoints = JSON.parse(pointsJson);
    jailDropPoints.forEach(p => {
        const blip = mp.blips.new(
            431,
            new mp.Vector3(p.x, p.y, p.z),
            { shortRange: false, name: p.label, color: 3, scale: 0.9 }
        );
        jailDropBlips.push(blip);
    });
});

mp.events.add('client:lspd:showJailDropPrompt', (pointsJson) => {
    mp.events.call('client:lspd:updateJailDrops', pointsJson);
});

// ── Proximity tick — officer G-key context detection ─────────────────────────
// Runs every 300ms. Checks two mutually exclusive contexts:
//   1. Officer is driving a PD car at a jail drop point  → "G  Book Suspect"
//   2. Officer is on foot near a RoS-wanted player       → "G  Cuff PlayerName"
// Only touches gKeyAction — never activeInteraction (E-key / ColShape).

setInterval(() => {
    const entryPromptActive = shouldUseEntrySurrenderPrompt();
    if (_lastEntrySurrenderPrompt === null) {
        _lastEntrySurrenderPrompt = entryPromptActive;
    } else if (entryPromptActive !== _lastEntrySurrenderPrompt) {
        _lastEntrySurrenderPrompt = entryPromptActive;
        refreshPrompt();
    }

    if (mp.gui.cursor.visible) {
        if (gKeyAction) setGKeyAction(null);
        return;
    }

    const local     = mp.players.local;
    const duty      = local.getVariable('factionDuty');
    const faction   = local.getVariable('factionId') || local.factionId;
    const isOfficer = duty && faction === 2;

    if (!isOfficer) {
        if (gKeyAction || nearCuffTarget || nearJailDrop) {
            nearCuffTarget = null; nearJailDrop = false;
            setGKeyAction(null);
        }
        return;
    }

    // Context 1: at a jail drop point in a PD vehicle
    if (local.vehicle && jailDropPoints.length > 0) {
        const pos = local.position;
        const atDrop = jailDropPoints.some(p => dist3(pos, p) <= 10);

        if (atDrop !== nearJailDrop) {
            nearJailDrop = atDrop;
            setGKeyAction(atDrop
                ? { key: 'G', label: 'Book Suspect', pd: true }
                : null
            );
        }
        // Don't check cuff while in a vehicle
        if (nearCuffTarget) { nearCuffTarget = null; }
        return;
    }

    // Clear jail-drop state if we left the vehicle
    if (nearJailDrop) { nearJailDrop = false; }

    // Context 2: on foot near a RoS-wanted player
    if (local.vehicle) {
        if (nearCuffTarget) { nearCuffTarget = null; setGKeyAction(null); }
        return;
    }

    let closest = null, closestDist = 3.0;
    mp.players.forEach(p => {
        if (p.remoteId === local.remoteId) return;
        if (!p.getVariable) return;
        if (p.getVariable('cuffed')) return;
        if (p.getVariable('wantedType') !== 'RoS') return;
        const d = dist2(local.position, p.position);
        if (d < closestDist) { closestDist = d; closest = p; }
    });

    if (closest) {
        const rid  = closest.remoteId;
        const name = closest.name.replace(/_/g, ' ');
        if (!nearCuffTarget || nearCuffTarget.remoteId !== rid) {
            nearCuffTarget = { remoteId: rid, displayName: name };
            setGKeyAction({ key: 'G', label: `Cuff ${name}`, pd: true });
        }
    } else if (nearCuffTarget) {
        nearCuffTarget = null;
        setGKeyAction(null);
    }
}, 300);

// ── G key ─────────────────────────────────────────────────────────────────────

mp.keys.bind(0x47, true, () => {
    if (mp.gui.cursor.visible) return;
    if (nearJailDrop) {
        mp.events.callRemote('server:lspd:tryJailDrop');
    } else if (nearCuffTarget) {
        mp.events.callRemote('server:lspd:tryCuff', nearCuffTarget.remoteId);
    }
});

// ── Garage menu ───────────────────────────────────────────────────────────────

let garageBrowser = null;

mp.events.add('client:lspd:openGarageMenu', (catalogJson) => {
    if (garageBrowser) { garageBrowser.destroy(); garageBrowser = null; }
    garageBrowser = mp.browsers.new('package://factions/lspd/garage.html');
    mp.gui.cursor.visible = true;
    setTimeout(() => {
        if (garageBrowser) garageBrowser.execute(`loadCatalog(${JSON.stringify(catalogJson)})`);
    }, 150);
});

mp.events.add('client:lspd:selectVehicle', (modelStr) => {
    if (garageBrowser) { garageBrowser.destroy(); garageBrowser = null; }
    mp.gui.cursor.visible = false;
    mp.events.callRemote('server:lspd:spawnVehicle', modelStr);
});

mp.events.add('client:lspd:closeGarage', () => {
    if (garageBrowser) { garageBrowser.destroy(); garageBrowser = null; }
    mp.gui.cursor.visible = false;
});

// ── Stop Order UI ─────────────────────────────────────────────────────────────

mp.events.add('client:lspd:showStopOrder',     (n) => mp.events.call('showStopOrderNotification', n, false));
mp.events.add('client:lspd:showStopOrderSent', (n) => mp.events.call('showStopOrderNotification', n, true));

// ── Weapon shot relay ─────────────────────────────────────────────────────────

mp.events.add('playerWeaponShot', (targetPosition, targetEntity) => {
    const id = (targetEntity && targetEntity.type === 'player') ? targetEntity.remoteId : -1;
    mp.events.callRemote('server:wanted:weaponShot', id);
});

// ── Death cleanup ─────────────────────────────────────────────────────────────

mp.events.add('playerDeath', () => {
    if (cuffed) {
        cuffed = false; cuffedToOfficerId = null;
        if (cuffFollowTick) { clearInterval(cuffFollowTick); cuffFollowTick = null; }
        mp.players.local.clearTasks();
    }
    clearJailDropBlips();
    nearCuffTarget = null; nearJailDrop = false;
    setGKeyAction(null);
});
