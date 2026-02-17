// client_packages/systems/faction.js
// ─────────────────────────────────────────────────────────────────────────────
//  Factions System — Client Side
//  Handles: cuff animation, faction panel open, armory UI bridge,
//           faction HQ blips on map, duty enter/exit teleport
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

let isCuffed = false;
let cuffInterval = null;

// ── CUFF ─────────────────────────────────────────────────────────────────────
mp.events.add('faction:cuff', () => {
    isCuffed = true;
    mp.players.local.setVariable('isCuffed', true);

    // Play hands-behind-back scenario
    mp.game.task.taskPlayAnim(
        mp.players.local.handle,
        'mp_arresting', 'idle',
        8.0, -8.0, -1, 49, 0, false, false, false
    );

    // Keep re-applying the anim so player can't escape it
    cuffInterval = setInterval(() => {
        if (!isCuffed) return;
        mp.game.task.taskPlayAnim(
            mp.players.local.handle,
            'mp_arresting', 'idle',
            8.0, -8.0, -1, 49, 0, false, false, false
        );
        // Prevent sprinting while cuffed
        mp.game.controls.disableControlAction(0, 21, true);  // Sprint
        mp.game.controls.disableControlAction(0, 22, true);  // Jump
        mp.game.controls.disableControlAction(0, 24, true);  // Attack
        mp.game.controls.disableControlAction(0, 257, true); // Attack 2
    }, 1500);
});

mp.events.add('faction:uncuff', () => {
    isCuffed = false;
    mp.players.local.setVariable('isCuffed', false);
    if (cuffInterval) { clearInterval(cuffInterval); cuffInterval = null; }
    mp.game.task.clearPedTasks(mp.players.local.handle);
});

// ── HQ BLIPS ON MAP ───────────────────────────────────────────────────────────
const factionBlips = [];

function buildBlips(blipsJson) {
    // Clean up any previous blips
    factionBlips.forEach(b => { try { b.destroy(); } catch(e) {} });
    factionBlips.length = 0;

    let configs;
    try { configs = JSON.parse(blipsJson); } catch(e) { return; }

    configs.forEach(cfg => {
        const pos  = cfg.position;
        const blip = mp.blips.new(
            cfg.sprite,
            new mp.Vector3(pos.x, pos.y, pos.z),
            {
                name:       cfg.label || 'Faction HQ',
                color:      cfg.color  ?? 0,
                scale:      cfg.scale  ?? 1.0,
                shortRange: true,
            }
        );
        factionBlips.push(blip);
    });
}

// Server sends blips on playerSpawn
mp.events.add('faction:setupBlips', buildBlips);

// Also request blips ourselves on spawn as a safety net
mp.events.add('playerSpawn', () => {
    mp.events.callRemote('server:faction:requestBlips');
});

// ── FACTION PANEL ─────────────────────────────────────────────────────────────
let panelOpen = false;

mp.events.add('faction:openPanel', (dataJson) => {
    if (panelOpen) return;
    panelOpen = true;

    mp.browsers.new(`package://systems/factionPanel/index.html`).then(browser => {
        browser.active = true;
        mp.cursor.show(true, true);

        browser.execute(`loadData(${dataJson})`);

        mp.events.add('faction:panel:close', () => {
            panelOpen = false;
            browser.destroy();
            mp.cursor.show(false, false);
            mp.events.remove('faction:panel:close');
        });
    });
});

// ── ARMORY PANEL ──────────────────────────────────────────────────────────────
let armoryOpen = false;

mp.events.add('faction:openArmory', (loadoutsJson) => {
    if (armoryOpen) return;
    armoryOpen = true;

    mp.browsers.new(`package://systems/factionArmory/index.html`).then(browser => {
        browser.active = true;
        mp.cursor.show(true, true);
        browser.execute(`loadLoadouts(${loadoutsJson})`);

        mp.events.add('faction:armory:close', () => {
            armoryOpen = false;
            browser.destroy();
            mp.cursor.show(false, false);
            mp.events.remove('faction:armory:close');
        });
    });
});

// ── DRUG LAB UI ───────────────────────────────────────────────────────────────
mp.events.add('faction:openDrugLab', () => {
    mp.browsers.new(`package://systems/factionDrugLab/index.html`).then(browser => {
        browser.active = true;
        mp.cursor.show(true, true);

        mp.events.add('faction:druglab:close', () => {
            browser.destroy();
            mp.cursor.show(false, false);
            mp.events.remove('faction:druglab:close');
        });
    });
});

// ── JAIL ──────────────────────────────────────────────────────────────────────
mp.events.add('faction:jailed', (sentenceMinutes) => {
    // Show a countdown notification - the server handles actual release
    mp.game.ui.setNotificationTextEntry('STRING');
    mp.game.ui.addNotificationToQueue();
});

mp.events.add('faction:released', () => {
    mp.game.ui.setNotificationTextEntry('STRING');
});


let isCuffed = false;
let cuffInterval = null;

// ── CUFF ─────────────────────────────────────────────────────────────────────
mp.events.add('faction:cuff', () => {
    isCuffed = true;
    mp.players.local.setVariable('isCuffed', true);

    // Play hands-behind-back scenario
    mp.game.task.taskPlayAnim(
        mp.players.local.handle,
        'mp_arresting', 'idle',
        8.0, -8.0, -1, 49, 0, false, false, false
    );

    // Keep re-applying the anim so player can't escape it
    cuffInterval = setInterval(() => {
        if (!isCuffed) return;
        mp.game.task.taskPlayAnim(
            mp.players.local.handle,
            'mp_arresting', 'idle',
            8.0, -8.0, -1, 49, 0, false, false, false
        );
        // Prevent sprinting while cuffed
        mp.game.controls.disableControlAction(0, 21, true);  // Sprint
        mp.game.controls.disableControlAction(0, 22, true);  // Jump
        mp.game.controls.disableControlAction(0, 24, true);  // Attack
        mp.game.controls.disableControlAction(0, 257, true); // Attack 2
    }, 1500);
});

mp.events.add('faction:uncuff', () => {
    isCuffed = false;
    mp.players.local.setVariable('isCuffed', false);
    if (cuffInterval) { clearInterval(cuffInterval); cuffInterval = null; }
    mp.game.task.clearPedTasks(mp.players.local.handle);
});

// ── FACTION PANEL ─────────────────────────────────────────────────────────────
let panelOpen = false;

mp.events.add('faction:openPanel', (dataJson) => {
    if (panelOpen) return;
    panelOpen = true;

    mp.browsers.new(`package://systems/factionPanel/index.html`).then(browser => {
        browser.active = true;
        mp.cursor.show(true, true);

        browser.execute(`loadData(${dataJson})`);

        mp.events.add('faction:panel:close', () => {
            panelOpen = false;
            browser.destroy();
            mp.cursor.show(false, false);
            mp.events.remove('faction:panel:close');
        });
    });
});

// ── ARMORY PANEL ──────────────────────────────────────────────────────────────
let armoryOpen = false;

mp.events.add('faction:openArmory', (loadoutsJson) => {
    if (armoryOpen) return;
    armoryOpen = true;

    mp.browsers.new(`package://systems/factionArmory/index.html`).then(browser => {
        browser.active = true;
        mp.cursor.show(true, true);
        browser.execute(`loadLoadouts(${loadoutsJson})`);

        mp.events.add('faction:armory:close', () => {
            armoryOpen = false;
            browser.destroy();
            mp.cursor.show(false, false);
            mp.events.remove('faction:armory:close');
        });
    });
});

// ── DRUG LAB UI ───────────────────────────────────────────────────────────────
mp.events.add('faction:openDrugLab', () => {
    mp.browsers.new(`package://systems/factionDrugLab/index.html`).then(browser => {
        browser.active = true;
        mp.cursor.show(true, true);

        mp.events.add('faction:druglab:close', () => {
            browser.destroy();
            mp.cursor.show(false, false);
            mp.events.remove('faction:druglab:close');
        });
    });
});
