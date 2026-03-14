// client_packages/systems/downState.js
// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-SIDE: Manages the local player's "down" state.
//
// Responsibilities:
//   - Show / hide the down-state CEF (red vignette + buttons)
//   - Play the ragdoll / crawling animation while down
//   - Forward button actions (Call Medic, Respawn) to the server
//   - Disable all keybinds while player is down (except the CEF buttons)
// ─────────────────────────────────────────────────────────────────────────────

let downBrowser = null;
let isDown      = false;
let downAnimTick = null;

// ── Animation helpers ─────────────────────────────────────────────────────────

const DOWN_ANIM_DICT = 'dead';
const DOWN_ANIM_NAME = 'dead_a';

function playDownAnimation() {
    const player = mp.players.local;

    mp.game.streaming.requestAnimDict(DOWN_ANIM_DICT);
    let attempts = 0;
    const iv = setInterval(() => {
        if (mp.game.streaming.hasAnimDictLoaded(DOWN_ANIM_DICT)) {
            clearInterval(iv);
            // flag 1 = loop, flag 4 = freeze last frame — use 1 to keep looping
            player.taskPlayAnim(DOWN_ANIM_DICT, DOWN_ANIM_NAME, 4.0, -1.0, -1, 1, 0, false, false, false);
        }
        if (++attempts > 60) clearInterval(iv);
    }, 50);
}

function stopDownAnimation() {
    mp.players.local.clearTasksImmediately();
}

// ── CEF helpers ───────────────────────────────────────────────────────────────

function openDownBrowser(data) {
    if (downBrowser) return;
    downBrowser = mp.browsers.new('package://ui/downState/index.html');
    downBrowser.active = true;

    // Cursor shown but gameplay still active so animation works
    mp.gui.cursor.show(true, true);

    setTimeout(() => {
        if (downBrowser) {
            downBrowser.execute(`init(${JSON.stringify(data)})`);
        }
    }, 300);
}

function closeDownBrowser() {
    if (downBrowser) {
        downBrowser.destroy();
        downBrowser = null;
    }
    mp.gui.cursor.show(false, false);
}

// ── Server → Client events ────────────────────────────────────────────────────

// Show down state CEF
mp.events.add('client:downState:show', (dataJson) => {
    let data = {};
    try { data = JSON.parse(dataJson); } catch (_) {}

    isDown = true;

    // Disable HUD radar to reinforce immersion
    mp.game.ui.displayRadar(false);

    playDownAnimation();
    openDownBrowser(data);
});

// Hide down state CEF (revive or respawn)
mp.events.add('client:downState:hide', () => {
    isDown = false;
    closeDownBrowser();
    mp.game.ui.displayRadar(true);
    stopDownAnimation();
});

// Stop animation only (server may do the position change itself)
mp.events.add('client:downState:stopAnimation', () => {
    stopDownAnimation();
});

// Medic call confirmed → tell CEF
mp.events.add('client:downState:medicCalled', () => {
    if (downBrowser) downBrowser.execute('onMedicCalled()');
});

// Error from server → show toast in CEF
mp.events.add('client:downState:error', (msg) => {
    if (downBrowser) downBrowser.execute(`showError(${JSON.stringify(msg)})`);
});

// Update medic count in CEF (fired when a medic goes on/off duty)
mp.events.add('client:downState:updateMedicCount', (count) => {
    if (downBrowser) downBrowser.execute(`updateMedicCount(${count})`);
});

// Respawn screen flash effect (brief white flash)
mp.events.add('client:downState:respawnEffect', () => {
    mp.game.graphics.startScreenEffect('DeathFailMPDark', 0, false);
    setTimeout(() => mp.game.graphics.stopScreenEffect('DeathFailMPDark'), 1200);
});

// ── CEF → Client (mp.trigger from HTML) ──────────────────────────────────────

// CEF fires this when "Call Medic" is pressed
mp.events.add('client:downState:requestCallMedic', () => {
    if (!isDown) return;
    // Resolve current zone name then fire server event
    const pos = mp.players.local.position;
    let locationName = 'Unknown Area';
    try {
        const key = mp.game.zone.getNameOfZone(pos.x, pos.y, pos.z);
        locationName = mp.game.gxt.get(key) || 'Unknown Area';
    } catch (_) {}
    mp.events.callRemote('server:downState:callMedic', locationName);
});

// CEF fires this when "Respawn" is pressed
mp.events.add('client:downState:requestRespawn', () => {
    if (!isDown) return;
    mp.events.callRemote('server:downState:respawn');
});

// ── Block most keys while down ────────────────────────────────────────────────
// We intercept common movement/weapon/sprint keys to prevent exploits.
// The E key and cursor interaction still work so the CEF buttons are usable.
const BLOCKED_CONTROLS = [
    0, 1, 2, 24, 25, 36, 44, 45, 46, 69, 70, 71, 72, 75, 114
];

mp.events.add('render', () => {
    if (!isDown) return;
    const player = mp.players.local;

    for (const ctrl of BLOCKED_CONTROLS) {
        mp.game.controls.disableControlAction(0, ctrl, true);
    }

    // Keep re-applying the animation if it was cleared
    if (!player.isPlayingAnim(DOWN_ANIM_DICT, DOWN_ANIM_NAME, 3)) {
        playDownAnimation();
    }
});
