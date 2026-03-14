// packages/factions/paramedic/paramedicDispatch.js
// ─────────────────────────────────────────────────────────────────────────────
// Handles the CPR revival flow for the Paramedic faction (factionId: 3).
//
// Flow:
//   1. Paramedic accepts dispatch call → drives to downed player location
//   2. Paramedic exits vehicle, walks to downed player (within CPR_RANGE)
//   3. Interaction prompt fires 'server:paramedic:startCPR'
//   4. Server validates proximity, starts 5-second CPR timer
//   5. After 5s → revivePlayer() is called (50% HP, player gets up)
// ─────────────────────────────────────────────────────────────────────────────

const dispatchManager  = require('../dispatch/dispatchManager');
const DISPATCH_CONFIGS = require('../dispatch/dispatchConfig');
const downStateManager = require('../../systems/downState');

const CPR_DURATION_MS = 5000; // 5 seconds
const CPR_RANGE       = 5.0;  // metres

// Map<paramedicServerId, targetPlayerId> — prevents double-CPR
const activeCPR = new Map();

// ── Phase 2: Paramedic arrived at scene ──────────────────────────────────────
mp.events.add('server:dispatch:paramedicArrived', (paramedic) => {
    const a = dispatchManager.getAssignment(paramedic.id);
    if (!a || a.factionId !== 3) return;

    a.phase = 2;
    const config = DISPATCH_CONFIGS[3];

    if (a.callerServerId !== null) {
        const caller = mp.players.at(a.callerServerId);
        if (caller && mp.players.exists(caller)) {
            caller.outputChatBox(`!{${config.accentColor}}${config.chatTag} !{#ffffff}${config.messages.arrived}`);
        }
    }

    console.log(`[EMS Dispatch] Paramedic ${paramedic.name} arrived at scene for call #${a.callId}`);
});

// ── CPR: Paramedic starts CPR on a downed player ─────────────────────────────
mp.events.add('server:paramedic:startCPR', (paramedic, targetIdStr) => {
    if (!paramedic.logged) return;
    if (paramedic.factionId !== 3) return;
    if (!paramedic.getVariable('factionDuty')) {
        paramedic.outputChatBox('!{#ff4757}[EMS] You must be on duty to perform CPR.');
        return;
    }
    if (activeCPR.has(paramedic.id)) {
        paramedic.outputChatBox('!{#ff4757}[EMS] You are already performing CPR.');
        return;
    }

    const targetId = parseInt(targetIdStr);
    if (isNaN(targetId)) return;

    const target = mp.players.at(targetId);
    if (!target || !mp.players.exists(target)) {
        paramedic.outputChatBox('!{#ff4757}[EMS] Player not found.');
        return;
    }

    if (!downStateManager.isPlayerDown(target)) {
        paramedic.outputChatBox('!{#ff4757}[EMS] This player is no longer down.');
        return;
    }

    // Proximity check
    const pp = paramedic.position;
    const tp = target.position;
    const dx = pp.x - tp.x, dy = pp.y - tp.y, dz = pp.z - tp.z;
    if (Math.sqrt(dx * dx + dy * dy + dz * dz) > CPR_RANGE) {
        paramedic.outputChatBox('!{#ff4757}[EMS] You are too far away to perform CPR.');
        return;
    }

    activeCPR.set(paramedic.id, targetId);

    // Start animation on paramedic's client
    paramedic.call('client:paramedic:startCPR', [CPR_DURATION_MS, targetId]);

    // Notify downed player
    const medName = paramedic.name.replace(/_/g, ' ');
    target.outputChatBox(`!{#ff4757}[EMS] !{#ffffff}${medName} is performing CPR on you...`);
    paramedic.outputChatBox(`!{#ff4757}[EMS] !{#ffffff}Performing CPR on ${target.name.replace(/_/g, ' ')}...`);

    // ── Resolution after CPR_DURATION ────────────────────────────────────────
    setTimeout(() => {
        activeCPR.delete(paramedic.id);

        if (!mp.players.exists(paramedic)) return;
        if (!mp.players.exists(target))    return;
        if (!downStateManager.isPlayerDown(target)) {
            // Already revived by someone else — still stop animation
            paramedic.call('client:paramedic:stopCPR', []);
            return;
        }

        // Final proximity check (tolerance: CPR_RANGE + 2m to be lenient)
        const pp2 = paramedic.position, tp2 = target.position;
        const dx2 = pp2.x - tp2.x, dy2 = pp2.y - tp2.y;
        if (Math.sqrt(dx2 * dx2 + dy2 * dy2) > CPR_RANGE + 2.0) {
            paramedic.outputChatBox('!{#ff4757}[EMS] You moved away — CPR failed. Try again.');
            paramedic.call('client:paramedic:stopCPR', []);
            return;
        }

        // ── Revive ────────────────────────────────────────────────────────────
        downStateManager.revivePlayer(target, paramedic);

        // Clear medic's active dispatch assignment if it was for this call
        const a = dispatchManager.getAssignment(paramedic.id);
        if (a && a.factionId === 3 && a.callerServerId === target.id) {
            dispatchManager.removeAssignment(paramedic.id);
            paramedic.call('client:dispatch:callCleared', []);
        }

        paramedic.call('client:paramedic:stopCPR', []);

        console.log(`[EMS Dispatch] ${paramedic.name} revived ${target.name} via CPR.`);

    }, CPR_DURATION_MS);
});

// ── Cleanup if paramedic disconnects mid-CPR ─────────────────────────────────
mp.events.add('playerQuit', (player) => {
    activeCPR.delete(player.id);
});
