// packages/systems/factions/definitions/lsems.js
// ─────────────────────────────────────────────────────────────────────────────
//  Los Santos Emergency Medical Services — Civilian
//  Abilities: revive downed players, accept/dispatch 911 calls, faction vehicle
//  HQ: Central Medical Center (Pillbox Hill)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const FM = require('../factionManager');
const pm = require('../../../core/playerManager');

const KEY = 'lsems';

// ── Definition ────────────────────────────────────────────────────────────────
FM.register(KEY, {
    name:        'LS Emergency Medical Services',
    tag:         'EMS',
    type:        'civilian',
    color:       '#FF3C3C',
    description: 'Save lives across Los Santos. Respond to medical emergencies 24/7.',
    memberCap:   25,
    applicationsOpen: true,

    hqPosition:       { x: 296.07, y: -584.42, z: 43.26, h: 340.0 },
    armoryPosition:   { x: 290.30, y: -580.20, z: 43.26, h: 340.0 },
    vehspawnPosition: { x: 301.62, y: -591.75, z: 43.26, h: 155.0 },
    vehModel:         'ambulance',

    // Duty: stand at the hospital main entrance, get teleported to the break room inside
    dutyPosition:         { x: 307.5, y: -597.7, z: 43.3, h: 340.0 },
    dutyInteriorPosition: { x: 296.07, y: -584.42, z: 43.26, h: 340.0 },

    // Map blip shown to all players
    blipConfig: {
        sprite:   61,        // Hospital cross
        color:    1,         // Red
        scale:    1.0,
        label:    'EMS HQ',
        position: { x: 307.5, y: -597.7, z: 43.3 },
    },

    permissions: {
        USE_RADIO:      1,
        ACCESS_ARMORY:  1,
        SPAWN_VEH:      1,
        REVIVE_PLAYER:  1,
        DISPATCH_CALLS: 2,
        MANAGE_MEMBERS: 4,
    },

    ranks: [
        { rank: 1, name: 'EMT',           color: '#FF8888', salary: 700  },
        { rank: 2, name: 'Paramedic',      color: '#FFAAAA', salary: 1300 },
        { rank: 3, name: 'Senior Medic',   color: '#FFCCCC', salary: 2000 },
        { rank: 4, name: 'Supervisor',     color: '#FFDDDD', salary: 3000 },
        { rank: 5, name: 'Chief of EMS',   color: '#FFFFFF', salary: 4500 },
    ],
});

// ═════════════════════════════════════════════════════════════════════════════
//  EMS SYSTEMS
// ═════════════════════════════════════════════════════════════════════════════

// ── Pending 911 calls ─────────────────────────────────────────────────────────
const pendingCalls = new Map(); // callerId → { caller, pos, reason, time }

function ems(player)          { return FM.getFactionByPlayer(player)?.key === KEY; }
function canDo(player, action){ return ems(player) && FM.can(player, action); }
function findPlayer(arg) {
    const num = parseInt(arg);
    if (!isNaN(num)) return mp.players.toArray().find(p => p.data?.onlineId === num) || null;
    return mp.players.toArray().find(p => p.name.toLowerCase().includes(String(arg).toLowerCase())) || null;
}

// ── /911 [message] — Player calls EMS ────────────────────────────────────────
mp.events.addCommand('911', (player, fullText) => {
    if (!player.logged) return;
    const reason = (fullText || 'Medical Emergency').trim().substring(0, 100);
    const pos    = player.position;

    pendingCalls.set(player.data.dbId, { caller: player, pos, reason, time: Date.now() });

    // Notify all online EMS
    const msg = `!{FF3C3C}[911] !{FFFFFF}${player.name} at (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}) — "${reason}"`;
    FM.getDefinitions().get(KEY) && notifyEms(msg);
    player.outputChatBox('!{00FF00}[911] Emergency reported. EMS has been notified.');
});

function notifyEms(message) {
    mp.players.toArray().forEach(p => {
        if (p.data?.factionKey === KEY) p.outputChatBox(message);
    });
}

// ── /calls — See pending 911 calls ────────────────────────────────────────────
mp.events.addCommand('calls', (player) => {
    if (!player.logged || !ems(player)) return player.outputChatBox('!{FF0000}EMS only.');
    if (!pendingCalls.size) return player.outputChatBox('!{00FF00}[EMS] No pending calls.');
    player.outputChatBox('!{FF3C3C}[EMS] Pending Calls:');
    pendingCalls.forEach((call, uid) => {
        const mins = Math.floor((Date.now() - call.time) / 60000);
        player.outputChatBox(`!{FFFFFF}• ID ${call.caller?.data?.onlineId || uid} — ${call.reason} (${mins}m ago)`);
    });
});

// ── /respond <onlineId> — Accept a call & get GPS coords ──────────────────────
mp.events.addCommand('respond', (player, _, id) => {
    if (!player.logged || !canDo(player, 'DISPATCH_CALLS')) return player.outputChatBox('!{FF0000}EMS Paramedic+ only.');
    if (!id) return player.outputChatBox('!{FF0000}Usage: /respond [caller id]');

    const target = findPlayer(id);
    if (!target) return player.outputChatBox('!{FF0000}Player not found.');

    const call = pendingCalls.get(target.data.dbId);
    if (!call) return player.outputChatBox('!{FF0000}No active call for that player.');

    player.outputChatBox(`!{00FF00}[EMS] Responding to ${target.name} at (${call.pos.x.toFixed(0)}, ${call.pos.y.toFixed(0)})`);
    player.call('setWaypoint', [call.pos.x, call.pos.y]);

    target.outputChatBox(`!{00FF00}[EMS] ${player.name} is responding to your call!`);
    pendingCalls.delete(target.data.dbId);
});

// ── /revive <id> — Revive a downed player ────────────────────────────────────
mp.events.addCommand('revive', async (player, _, id) => {
    if (!player.logged) return;

    // If admin with no target → self-revive for admins only
    if (!id && player.data.adminLevel >= 3) {
        player.health = 200;
        return player.outputChatBox('!{00FF00}[Admin] Self-revived.');
    }

    if (!canDo(player, 'REVIVE_PLAYER')) return player.outputChatBox('!{FF0000}EMS only.');
    if (!id) return player.outputChatBox('!{FF0000}Usage: /revive [id]');

    const target = findPlayer(id);
    if (!target) return player.outputChatBox('!{FF0000}Player not found.');
    if (player.dist(target.position) > 6) return player.outputChatBox('!{FF0000}Too far away (must be < 6m).');

    const reviveCost = 500; // Cost the player pays for the revive

    target.health = 200;
    target.armour = 0;
    pendingCalls.delete(target.data.dbId); // Clear their 911 call if any

    mp.players.forEachInRange(player.position, 12, p => p.call('chat:push', [null, `* ${player.name} revives ${target.name}.`, 'me']));
    target.outputChatBox(`!{00FF00}[EMS] ${player.name} revived you. Revive fee: $${reviveCost}.`);
    player.outputChatBox(`!{00FF00}[EMS] Revived ${target.name}.`);

    // Charge the revived player
    await pm.removeMoneyAndSave(target, reviveCost, 'EMS Revive Fee').catch(() => {});

    // Give EMS officer a small reward
    await pm.addMoneyAndSave(player, 200, 'EMS Revive Reward');
});

// ── /fveh — Spawn ambulance ───────────────────────────────────────────────────
mp.events.addCommand('emsveh', (player) => {
    if (!player.logged || player.data.factionKey !== KEY || !FM.can(player, 'SPAWN_VEH')) return;
    const def = FM.getDefinition(KEY);
    const pos = def.vehspawnPosition;
    const veh = mp.vehicles.new(mp.joaat(def.vehModel), new mp.Vector3(pos.x, pos.y, pos.z), {
        heading: pos.h || 0, numberPlate: 'EMS', dimension: 0, locked: false, engine: false,
    });
    veh.setVariable('factionVeh', KEY);
    veh.setVariable('fuel', 100.0);
    setTimeout(() => { if (mp.players.exists(player) && mp.vehicles.exists(veh)) player.call('client:warpIntoVehicle', [veh.id, -1]); }, 250);
    player.outputChatBox('!{00FF00}[EMS] Ambulance spawned.');
});

// ── Auto-notify EMS when player health is critically low ─────────────────────
// (server-side: fires from client when health < 20)
mp.events.add('server:faction:ems911Auto', (player) => {
    if (!player.logged || pendingCalls.has(player.data.dbId)) return;
    const pos    = player.position;
    const reason = 'Player critically injured (auto-call)';
    pendingCalls.set(player.data.dbId, { caller: player, pos, reason, time: Date.now() });
    notifyEms(`!{FF3C3C}[AUTO-911] !{FFFFFF}${player.name} is critically injured at (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})!`);
});

// Clean up calls when player disconnects
mp.events.add('playerQuit', (player) => {
    if (player.data?.dbId) pendingCalls.delete(player.data.dbId);
});

console.log('[Factions] LSEMS definition loaded.');
