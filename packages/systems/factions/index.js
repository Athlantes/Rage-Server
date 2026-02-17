// packages/systems/factions/index.js
// ─────────────────────────────────────────────────────────────────────────────
//  Factions System — Entry Point
//  1. Load manager (singleton)
//  2. Load all definitions (each registers itself + its commands)
//  3. Shared commands: /f /finfo /fmembers /fstats /fleave
//  4. Admin commands:  /fenlist /fremove /flist
//  5. Event hooks:     login, payday, playerMenu
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const FM = require('./factionManager');
const db = require('../../core/database');

// ── 1. Load definitions ───────────────────────────────────────────────────────
require('./definitions/lspd');
require('./definitions/lsems');
require('./definitions/vagos');
// Add more definitions here:
// require('./definitions/sfpd');
// require('./definitions/ballas');

// ── 2. Boot: load DB data into memory ────────────────────────────────────────
FM.loadAll();

// ─────────────────────────────────────────────────────────────────────────────
//  SHARED COMMANDS (available to all faction members)
// ─────────────────────────────────────────────────────────────────────────────
const C = { ERR: '!{FF0000}', OK: '!{00FF00}', INFO: '!{FFFF00}', FAC: '!{44AAFF}' };
const ADMIN = 3;

function isAdmin(p) { return p.logged && (p.data.adminLevel || 0) >= ADMIN; }
function findOnline(arg) {
    const num = parseInt(arg);
    if (!isNaN(num)) return mp.players.toArray().find(p => p.data?.onlineId === num) || null;
    return mp.players.toArray().find(p => p.name.toLowerCase().includes(String(arg).toLowerCase())) || null;
}

// /f <message> — Faction radio
mp.events.addCommand('f', (player, fullText) => {
    if (!player.logged) return;
    if (!fullText?.trim()) return player.outputChatBox(`${C.ERR}Usage: /f [message]`);
    FM.factionChat(player, fullText.trim());
});

// /finfo — Info about your faction
mp.events.addCommand('finfo', (player) => {
    if (!player.logged) return;
    const def = FM.getFactionByPlayer(player);
    if (!def) return player.outputChatBox(`${C.INFO}You are not in a faction.`);
    const rank = player.data.factionRank || 1;
    const rankObj = def.ranks[rank - 1];
    player.outputChatBox(`${C.FAC}[${def.tag}] !{FFFFFF}${def.name}`);
    player.outputChatBox(`${C.INFO}Type: !{FFFFFF}${def.type} | Members: ${FM.getMembersByKey(def.key).length}/${def.memberCap}`);
    player.outputChatBox(`${C.INFO}Your Rank: !{${rankObj.color.replace('#','')}}${rankObj.name} (${rank}/5) | Salary: $${rankObj.salary.toLocaleString()}/payday`);
});

// /fmembers — Member list
mp.events.addCommand('fmembers', (player) => {
    if (!player.logged) return;
    const def = FM.getFactionByPlayer(player);
    if (!def) return player.outputChatBox(`${C.ERR}Not in a faction.`);
    const members  = FM.getMembersByKey(def.key);
    const onlineIds = new Set(mp.players.toArray().filter(p => p.data?.dbId).map(p => p.data.dbId));
    player.outputChatBox(`${C.FAC}[${def.tag}] Members (${members.length}/${def.memberCap}):`);
    [...members].sort((a,b) => b.rank - a.rank).forEach(m => {
        const status = onlineIds.has(m.userId) ? '!{00FF00}●' : '!{666666}○';
        player.outputChatBox(`${status} !{FFFFFF}${m.username} !{AAAAAA}(${def.ranks[m.rank-1]?.name})`);
    });
});

// /fstats — Your faction stats
mp.events.addCommand('fstats', (player) => {
    if (!player.logged) return;
    const def = FM.getFactionByPlayer(player);
    if (!def) return player.outputChatBox(`${C.INFO}Not in a faction.`);
    const rank = player.data.factionRank || 1;
    const r = def.ranks[rank-1];
    player.outputChatBox(`${C.FAC}[Faction] !{FFFFFF}${def.name}`);
    player.outputChatBox(`${C.INFO}Rank: !{${r.color.replace('#','')}}${r.name} (${rank}/5) | Salary: $${r.salary.toLocaleString()}`);
});

// /fleave — Leave your faction
mp.events.addCommand('fleave', async (player) => {
    if (!player.logged) return;
    await FM.leaveFaction(player);
});

// /duty — Toggle on/off duty (must be near faction HQ)
mp.events.addCommand('duty', (player) => {
    if (!player.logged) return;
    const def = FM.getFactionByPlayer(player);
    if (!def) return player.outputChatBox(`${C.ERR}You are not in a faction.`);

    const dutyPos = def.dutyPosition || def.hqPosition;
    if (!dutyPos) return player.outputChatBox(`${C.ERR}This faction has no duty location set.`);

    const dist = player.dist(new mp.Vector3(dutyPos.x, dutyPos.y, dutyPos.z));
    if (dist > 8) return player.outputChatBox(`${C.ERR}You must be near the ${def.name} HQ to go on/off duty.`);

    const isOnDuty = FM.isOnDuty(player);

    if (!isOnDuty) {
        // Going ON duty
        FM.setDuty(player, true);
        const color = def.color.replace('#','');
        player.outputChatBox(`!{${color}}[${def.tag}] !{00FF00}You are now ON DUTY.`);

        // Teleport to interior if defined
        if (def.dutyInteriorPosition) {
            const ip = def.dutyInteriorPosition;
            player.position = new mp.Vector3(ip.x, ip.y, ip.z);
            if (ip.h !== undefined) player.heading = ip.h;
        }

        // Notify faction members
        FM._notifyFaction(def.key, `!{${color}}[${def.tag}] !{AAAAAA}${player.name} is now on duty.`, 1);
    } else {
        // Going OFF duty
        FM.setDuty(player, false);
        const color = def.color.replace('#','');
        player.outputChatBox(`!{${color}}[${def.tag}] !{FFAA00}You are now OFF DUTY.`);

        // Teleport back outside
        const exitPos = def.dutyPosition || def.hqPosition;
        if (exitPos) {
            player.position = new mp.Vector3(exitPos.x, exitPos.y, exitPos.z);
            if (exitPos.h !== undefined) player.heading = exitPos.h;
        }

        FM._notifyFaction(def.key, `!{${color}}[${def.tag}] !{AAAAAA}${player.name} went off duty.`, 1);
    }
});

// /fpromote <id|name> <1-5> — Promote (rank 4+)
mp.events.addCommand('fpromote', async (player, fullText) => {
    if (!player.logged) return;
    const args = (fullText || '').split(' ');
    if (args.length < 2) return player.outputChatBox(`${C.ERR}Usage: /fpromote [id] [rank 1-5]`);
    const def = FM.getFactionByPlayer(player);
    if (!def) return player.outputChatBox(`${C.ERR}Not in a faction.`);
    let uid;
    const online = findOnline(args[0]);
    if (online) { uid = online.data.dbId; }
    else { const mem = FM.getMembersByKey(def.key).find(m => m.username.toLowerCase().includes(args[0].toLowerCase())); if (mem) uid = mem.userId; }
    if (!uid) return player.outputChatBox(`${C.ERR}Member not found.`);
    await FM.setMemberRank(player, uid, parseInt(args[1]));
});

// /fdemote <id|name> — Demote by 1 (rank 4+)
mp.events.addCommand('fdemote', async (player, _, id) => {
    if (!player.logged) return;
    const def = FM.getFactionByPlayer(player);
    if (!def) return player.outputChatBox(`${C.ERR}Not in a faction.`);
    let mem;
    const online = findOnline(id);
    if (online) mem = FM.getMemberData(def.key, online.data.dbId);
    else mem = FM.getMembersByKey(def.key).find(m => m.username.toLowerCase().includes(String(id).toLowerCase()));
    if (!mem) return player.outputChatBox(`${C.ERR}Member not found.`);
    await FM.setMemberRank(player, mem.userId, mem.rank - 1);
});

// /fkick <id|name> — Kick member (rank 4+)
mp.events.addCommand('fkick', async (player, _, id) => {
    if (!player.logged) return;
    const def = FM.getFactionByPlayer(player);
    if (!def) return player.outputChatBox(`${C.ERR}Not in a faction.`);
    const online = findOnline(id);
    let uid;
    if (online) { uid = online.data.dbId; }
    else { const mem = FM.getMembersByKey(def.key).find(m => m.username.toLowerCase().includes(String(id).toLowerCase())); if (mem) uid = mem.userId; }
    if (!uid) return player.outputChatBox(`${C.ERR}Member not found.`);
    await FM.kickMember(player, uid);
});

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

// /fenlist <id|name> <factionKey> [rank] — Enlist player into faction
mp.events.addCommand('fenlist', async (player, fullText) => {
    if (!isAdmin(player)) return player.outputChatBox(`${C.ERR}Admin only.`);
    const args = (fullText || '').split(' ');
    if (args.length < 2) return player.outputChatBox(`${C.ERR}Usage: /fenlist [id] [factionKey] [rank]`);
    const target = findOnline(args[0]);
    if (!target) return player.outputChatBox(`${C.ERR}Player not found (must be online).`);
    await FM.adminEnlist(player, target, args[1], parseInt(args[2]) || 1);
});

// /fremove <userId> — Remove player from their faction (by online ID or name)
mp.events.addCommand('fremove', async (player, _, id) => {
    if (!isAdmin(player)) return player.outputChatBox(`${C.ERR}Admin only.`);
    if (!id) return player.outputChatBox(`${C.ERR}Usage: /fremove [id or name]`);
    const target = findOnline(id);
    if (!target) return player.outputChatBox(`${C.ERR}Player not found (must be online).`);
    await FM.adminRemove(player, target.data.dbId);
});

// /flist — List all registered factions
mp.events.addCommand('flist', (player) => {
    if (!isAdmin(player) && (player.data.adminLevel || 0) < 1) return player.outputChatBox(`${C.ERR}Admin only.`);
    if (!FM.getDefinitions().size) return player.outputChatBox(`${C.INFO}No factions registered.`);
    player.outputChatBox(`${C.INFO}=== Registered Factions ===`);
    FM.getDefinitions().forEach((def, key) => {
        const members = FM.getMembersByKey(key);
        player.outputChatBox(`!{FFFFFF}${key}: ${def.name} [${def.tag}] | ${def.type} | ${members.length}/${def.memberCap} members`);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
//  SERVER EVENT HOOKS
// ─────────────────────────────────────────────────────────────────────────────

// ── Login hook ────────────────────────────────────────────────────────────────
mp.events.add('server:loadAccount', async (player) => {
    await FM.setupPlayerFaction(player, player.data.dbId);
    
    // [ADD THIS] Send blips immediately upon login
    const blips = FM.getBlipData();
    if (blips.length) {
        player.call('faction:setupBlips', [JSON.stringify(blips)]);
    }

    // Also load wanted level from DB
    try {
        const [rows] = await db.query('SELECT wanted_level FROM users WHERE id=?', [player.data.dbId]);
        if (rows.length) {
            player.data.wantedLevel = rows[0].wanted_level || 0;
            player.setVariable('wantedLevel', player.data.wantedLevel);
        }
    } catch (e) { /* column may not exist yet */ }
});

// ── Disconnect hook: clear duty state ────────────────────────────────────────
mp.events.add('playerQuit', (player) => {
    FM.onPlayerQuit(player);
});

// ── Send faction blips on spawn (map is ready at this point) ──────────────────
mp.events.add('playerSpawn', (player) => {
    if (!player.logged) return;
    const blips = FM.getBlipData();
    if (blips.length) player.call('faction:setupBlips', [JSON.stringify(blips)]);
});

// ── Client can also pull blips on demand (e.g. after a late spawn) ────────────
mp.events.add('server:faction:requestBlips', (player) => {
    if (!player.logged) return;
    const blips = FM.getBlipData();
    player.call('faction:setupBlips', [JSON.stringify(blips)]);
});

// ── Payday hook ───────────────────────────────────────────────────────────────
mp.events.add('server:payday:player', async (player) => {
    await FM.payPlayerSalary(player);
});

// ── PlayerMenu: getData hook ──────────────────────────────────────────────────
// Injects faction data into the playerMenu payload
mp.events.add('server:faction:getMenuData', async (player) => {
    if (!player.logged) return;
    try {
        const data = await FM.getPlayerMenuData(player);
        player.call('client:faction:receiveMenuData', [JSON.stringify(data)]);
    } catch (e) {
        console.error('[Factions] getMenuData error:', e);
    }
});

// ── Application actions from playerMenu ──────────────────────────────────────
mp.events.add('server:faction:apply', async (player, factionKey, message) => {
    if (!player.logged) return;
    await FM.applyToFaction(player, factionKey, message || '');
});

mp.events.add('server:faction:acceptApp', async (player, targetUserId) => {
    if (!player.logged) return;
    await FM.acceptApplication(player, parseInt(targetUserId));
});

mp.events.add('server:faction:rejectApp', async (player, targetUserId) => {
    if (!player.logged) return;
    await FM.rejectApplication(player, parseInt(targetUserId));
});

mp.events.add('server:faction:kick', async (player, targetUserId) => {
    if (!player.logged) return;
    await FM.kickMember(player, parseInt(targetUserId));
});

mp.events.add('server:faction:setRank', async (player, targetUserId, rank) => {
    if (!player.logged) return;
    await FM.setMemberRank(player, parseInt(targetUserId), parseInt(rank));
});

mp.events.add('server:faction:leave', async (player) => {
    if (!player.logged) return;
    await FM.leaveFaction(player);
});

console.log('[Factions] System fully loaded.');
module.exports = FM;
