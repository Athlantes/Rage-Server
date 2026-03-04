// client_packages/factions/lspd/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Handles client-side LSPD mechanics:
//   - Surrender: plays hands-up animation, freezes local player
//   - Cuffed: plays cuff animation, freezes movement
//   - Garage vehicle selection menu (simple NativeUI-style via browser)
// ─────────────────────────────────────────────────────────────────────────────

// ── Animation dictionary constants ───────────────────────────────────────────
const ANIM_SURRENDER  = { dict: 'missminuteman_1ig_2', anim: 'handsup_base',   flag: 49 };
const ANIM_CUFFED     = { dict: 'mp_arresting',        anim: 'idle',           flag: 49 };
const ANIM_CUFF_INTRO = { dict: 'mp_arresting',        anim: 'a_uncuff',       flag: 48 };

let surrendered = false;
let cuffed = false;
let cuffedToOfficerId = null;
let cuffFollowTick = null;

// ── Load animation dictionary helper ─────────────────────────────────────────

async function loadAnimDict(dict) {
    return new Promise((resolve) => {
        if (mp.game.streaming.hasAnimDictLoaded(dict)) return resolve();
        mp.game.streaming.requestAnimDict(dict);
        const check = setInterval(() => {
            if (mp.game.streaming.hasAnimDictLoaded(dict)) {
                clearInterval(check);
                resolve();
            }
        }, 50);
    });
}

// ── Surrender ─────────────────────────────────────────────────────────────────

mp.events.add('client:lspd:setSurrendered', async (isSurrendered) => {
    surrendered = isSurrendered;

    if (isSurrendered) {
        await loadAnimDict(ANIM_SURRENDER.dict);
        mp.players.local.taskPlayAnim(
            ANIM_SURRENDER.dict, ANIM_SURRENDER.anim,
            8.0, -8.0, -1, ANIM_SURRENDER.flag, 0, false, false, false
        );
        // Freeze controls — only camera & talking allowed
        mp.game.controls.disableControlAction(0, 30, true); // move LR
        mp.game.controls.disableControlAction(0, 31, true); // move UD
        mp.game.controls.disableControlAction(0, 21, true); // sprint
    } else {
        mp.players.local.clearTasks();
    }
});

// ── Cuffed ────────────────────────────────────────────────────────────────────

mp.events.add('client:lspd:setCuffed', async (isCuffed, officerId) => {
    cuffed = isCuffed;
    cuffedToOfficerId = officerId;

    if (isCuffed) {
        // Play cuff intro then loop idle
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

        // Start follow tick — keep cuffed player near officer
        if (cuffFollowTick) clearInterval(cuffFollowTick);
        cuffFollowTick = setInterval(() => {
            if (!cuffed || cuffedToOfficerId === null) {
                clearInterval(cuffFollowTick);
                cuffFollowTick = null;
                return;
            }

            const officer = mp.players.atRemoteId(cuffedToOfficerId);
            if (!officer || !mp.players.exists(officer)) return;

            const offPos = officer.position;
            const myPos  = mp.players.local.position;

            const dx = offPos.x - myPos.x;
            const dy = offPos.y - myPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // If too far away (officer moved), teleport us beside them
            if (dist > 3.5) {
                const behind = new mp.Vector3(
                    offPos.x - Math.sin(officer.heading * Math.PI / 180) * 1.0,
                    offPos.y - Math.cos(officer.heading * Math.PI / 180) * 1.0,
                    offPos.z
                );
                mp.players.local.position = behind;
            }

            // Block all movement controls
            mp.game.controls.disableControlAction(0, 30, true);
            mp.game.controls.disableControlAction(0, 31, true);
            mp.game.controls.disableControlAction(0, 21, true);
            mp.game.controls.disableControlAction(0, 22, true);
            mp.game.controls.disableControlAction(0, 24, true); // attack
            mp.game.controls.disableControlAction(0, 25, true); // aim
        }, 100);

    } else {
        // Remove cuffs
        cuffed = false;
        cuffedToOfficerId = null;
        surrendered = false;

        if (cuffFollowTick) { clearInterval(cuffFollowTick); cuffFollowTick = null; }
        mp.players.local.clearTasks();
    }
});

// Officer feedback when they cuff someone
mp.events.add('client:lspd:cuffedSomeone', (suspectId) => {
    // Play cuff animation on officer side too (mirrored)
    loadAnimDict('mp_arresting').then(() => {
        mp.players.local.taskPlayAnim('mp_arresting', 'a_uncuff', 8.0, -8.0, 2000, 48, 0, false, false, false);
    });
});

// ── Garage vehicle selection ──────────────────────────────────────────────────

let garageBrowser = null;

mp.events.add('client:lspd:openGarageMenu', (catalogJson) => {
    if (garageBrowser) { garageBrowser.destroy(); garageBrowser = null; }

    garageBrowser = mp.browsers.new('package://factions/lspd/garage.html');
    mp.gui.cursor.visible = true;

    setTimeout(() => {
        if (garageBrowser) {
            garageBrowser.execute(`loadCatalog(${JSON.stringify(catalogJson)})`);
        }
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

// ── Cleanup on death: clear animations and cuff state ────────────────────────

mp.events.add('playerDeath', () => {
    if (surrendered) {
        surrendered = false;
        mp.players.local.clearTasks();
    }
    // Cuff state is cleared server-side on death event; client just cleans up
    if (cuffed) {
        cuffed = false;
        cuffedToOfficerId = null;
        if (cuffFollowTick) { clearInterval(cuffFollowTick); cuffFollowTick = null; }
        mp.players.local.clearTasks();
    }
});