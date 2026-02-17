// packages/systems/factions/definitions/lspd.js
// ─────────────────────────────────────────────────────────────────────────────
//  Los Santos Police Department — Law Enforcement
//  Abilities: cuff, fine, search (inventory), jail wanted players, speed cameras
//  HQ & Armory: Vinewood Police Station
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const FM = require('../factionManager');
const db = require('../../../core/database');
const pm = require('../../../core/playerManager');

const KEY = 'lspd';

// ── Jail location ─────────────────────────────────────────────────────────────
const JAIL_POS    = { x: 459.3, y: -997.5, z: 24.9 };  // LSPD holding cells
const JAIL_DIM    = 99; // Separate dimension for jail

// ── Armory loadouts ───────────────────────────────────────────────────────────
const ARMORY_LOADOUTS = [
    { name: 'Patrol Kit',  items: [{ weapon: 'WEAPON_COMBATPISTOL', ammo: 60 }, { weapon: 'WEAPON_NIGHTSTICK', ammo: 0 }], minRank: 1 },
    { name: 'Traffic Kit', items: [{ weapon: 'WEAPON_COMBATPISTOL', ammo: 60 }], minRank: 1 },
    { name: 'SWAT Kit',    items: [{ weapon: 'WEAPON_CARBINERIFLE', ammo: 180 }, { weapon: 'WEAPON_COMBATPISTOL', ammo: 60 }], minRank: 3 },
];

// ── Definition ────────────────────────────────────────────────────────────────
FM.register(KEY, {
    name:        'Los Santos Police Department',
    tag:         'LSPD',
    type:        'law',
    color:       '#003FFF',
    description: 'Protect and serve the citizens of Los Santos. Keep crime off the streets.',
    memberCap:   40,
    applicationsOpen: true,

    hqPosition:      { x: 458.66, y: -987.42, z: 30.69, h: 90.0 },
    armoryPosition:  { x: 463.64, y: -991.73, z: 30.69, h: 90.0 },
    vehspawnPosition:{ x: 432.30, y: -978.52, z: 30.69, h: -2.0  },
    vehModel:        'police3',

    // Duty: stand near the front entrance, get teleported to the bullpen/locker room inside
    dutyPosition:         { x: 430.2, y: -983.8, z: 30.7, h: 90.0 },
    dutyInteriorPosition: { x: 461.55, y: -1012.03, z: 26.33, h: 0.0 },

    // Map blip shown to all players
    blipConfig: {
        sprite:   60,        // Police badge shield
        color:    3,         // Blue
        scale:    1.0,
        label:    'LSPD HQ',
        position: { x: 430.2, y: -983.8, z: 30.7 },
    },

    // minRank required for each action
    permissions: {
        USE_RADIO:       1,
        ACCESS_ARMORY:   1,
        SPAWN_VEH:       1,
        CUFF_PLAYER:     1,
        CHECKID:         1,
        FINE_PLAYER:     2,
        SEARCH_PLAYER:   2,
        ARREST_PLAYER:   2,
        MANAGE_MEMBERS:  4,
    },

    ranks: [
        { rank: 1, name: 'Cadet',          color: '#8888FF', salary: 800  },
        { rank: 2, name: 'Officer',         color: '#AAAAFF', salary: 1400 },
        { rank: 3, name: 'Sergeant',        color: '#CCCCFF', salary: 2200 },
        { rank: 4, name: 'Lieutenant',      color: '#EEEEFF', salary: 3200 },
        { rank: 5, name: 'Chief of Police', color: '#FFFFFF', salary: 5000 },
    ],
});

// ═════════════════════════════════════════════════════════════════════════════
//  LAW ENFORCEMENT COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

function lspd(player) { return FM.getFactionByPlayer(player)?.key === KEY; }
function canDo(player, action) { return lspd(player) && FM.can(player, action); }
function findPlayer(arg) {
    const num = parseInt(arg);
    if (!isNaN(num)) return mp.players.toArray().find(p => p.data?.onlineId === num) || null;
    return mp.players.toArray().find(p => p.name.toLowerCase().includes(String(arg).toLowerCase())) || null;
}
function nearby(a, b, dist = 6) { return a.dist(b.position) <= dist; }

function log(officerId, officerName, targetId, targetName, action, amount = 0, reason = '') {
    db.query(
        'INSERT INTO faction_action_log (officer_id,officer_name,target_id,target_name,action,amount,reason) VALUES (?,?,?,?,?,?,?)',
        [officerId, officerName, targetId, targetName, action, amount, reason]
    ).catch(console.error);
}

// ── /cuff <id> ────────────────────────────────────────────────────────────────
mp.events.addCommand('cuff', (player, _, id) => {
    if (!player.logged) return;
    if (!canDo(player, 'CUFF_PLAYER')) return player.outputChatBox('!{FF0000}LSPD only.');
    if (!id) return player.outputChatBox('!{FF0000}Usage: /cuff [id]');
    const target = findPlayer(id);
    if (!target) return player.outputChatBox('!{FF0000}Player not found.');
    if (!nearby(player, target)) return player.outputChatBox('!{FF0000}Too far away.');

    const isCuffed = FM.cuffed.has(target.data.dbId);
    if (isCuffed) {
        FM.cuffed.delete(target.data.dbId);
        target.setVariable('isCuffed', false);
        target.call('faction:uncuff');
        target.outputChatBox('!{00FF00}You were uncuffed.');
        mp.players.forEachInRange(player.position, 12, p => p.call('chat:push', [null, `* ${player.name} uncuffs ${target.name}.`, 'me']));
        log(player.data.dbId, player.name, target.data.dbId, target.name, 'uncuff');
    } else {
        FM.cuffed.add(target.data.dbId);
        target.setVariable('isCuffed', true);
        target.call('faction:cuff');
        target.outputChatBox('!{FF4444}You have been handcuffed.');
        mp.players.forEachInRange(player.position, 12, p => p.call('chat:push', [null, `* ${player.name} handcuffs ${target.name}.`, 'me']));
        log(player.data.dbId, player.name, target.data.dbId, target.name, 'cuff');
    }
});

// ── /fine <id> <amount> [reason] ─────────────────────────────────────────────
mp.events.addCommand('fine', async (player, fullText) => {
    if (!player.logged || !canDo(player, 'FINE_PLAYER')) return player.outputChatBox('!{FF0000}LSPD Officer+ only.');
    const args = (fullText || '').trim().split(' ');
    if (args.length < 2) return player.outputChatBox('!{FF0000}Usage: /fine [id] [amount] [reason]');

    const target = findPlayer(args[0]);
    if (!target) return player.outputChatBox('!{FF0000}Player not found.');
    if (!nearby(player, target, 10)) return player.outputChatBox('!{FF0000}Too far away.');

    const amount = parseInt(args[1]);
    if (!amount || amount <= 0 || amount > 100000) return player.outputChatBox('!{FF0000}Invalid amount (max $100,000).');
    const reason = args.slice(2).join(' ') || 'Traffic Violation';

    const ok = await pm.removeMoneyAndSave(target, amount, `LSPD Fine by ${player.name}`);
    if (!ok) { player.outputChatBox('!{FF0000}Player cannot afford this fine.'); return; }

    target.outputChatBox(`!{FF4444}[LSPD] Fine: $${amount.toLocaleString()} — ${reason} (Officer: ${player.name})`);
    player.outputChatBox(`!{00FF00}[LSPD] Issued $${amount.toLocaleString()} fine to ${target.name}.`);
    mp.players.forEachInRange(player.position, 15, p => p.call('chat:push', [null, `* ${player.name} issues a $${amount} fine to ${target.name}. (${reason})`, 'me']));
    log(player.data.dbId, player.name, target.data.dbId, target.name, 'fine', amount, reason);
});

// ── /checkid <id> ─────────────────────────────────────────────────────────────
mp.events.addCommand('checkid', (player, _, id) => {
    if (!player.logged || !canDo(player, 'CHECKID')) return player.outputChatBox('!{FF0000}LSPD only.');
    if (!id) return player.outputChatBox('!{FF0000}Usage: /checkid [id]');
    const target = findPlayer(id);
    if (!target) return player.outputChatBox('!{FF0000}Player not found.');
    if (!nearby(player, target)) return player.outputChatBox('!{FF0000}Too far away.');

    const wanted  = target.data.wantedLevel || 0;
    const faction = FM.getFactionByPlayer(target);
    const facStr  = faction ? `${faction.name} (Rank ${target.data.factionRank})` : 'Civilian';
    const wantedStr = wanted > 0 ? `!{FF4444}⚠ WANTED Lv.${wanted}` : '!{00FF00}Clean';

    player.outputChatBox(`!{FFFF00}══ ID CHECK: ${target.name} ══`);
    player.outputChatBox(`!{FFFFFF}Level: ${target.data.level || 1} | Faction: ${facStr}`);
    player.outputChatBox(`Status: ${wantedStr}`);
    mp.players.forEachInRange(player.position, 8, p => p.call('chat:push', [null, `* ${player.name} checks ${target.name}'s ID.`, 'me']));
});

// ── /search <id> — check player inventory for illegal items ──────────────────
mp.events.addCommand('search', async (player, _, id) => {
    if (!player.logged || !canDo(player, 'SEARCH_PLAYER')) return player.outputChatBox('!{FF0000}LSPD Officer+ only.');
    if (!id) return player.outputChatBox('!{FF0000}Usage: /search [id]');
    const target = findPlayer(id);
    if (!target) return player.outputChatBox('!{FF0000}Player not found.');
    if (!nearby(player, target)) return player.outputChatBox('!{FF0000}Too far away.');
    if (!FM.cuffed.has(target.data.dbId)) return player.outputChatBox('!{FF0000}Player must be cuffed to be searched.');

    mp.players.forEachInRange(player.position, 10, p => p.call('chat:push', [null, `* ${player.name} searches ${target.name}.`, 'me']));

    const inventory = target.inventory || [];
    const ItemRegistry = require('../../../data/items');

    const illegalItems = inventory.filter(item => {
        const def = ItemRegistry[item.itemId];
        return def?.illegal === true;
    });

    if (!illegalItems.length) {
        player.outputChatBox(`!{00FF00}[Search] ${target.name} is clean.`);
        target.outputChatBox('!{00FF00}[Search] Officer found nothing on you.');
        return;
    }

    player.outputChatBox(`!{FF4444}[Search] Illegal items found on ${target.name}:`);
    illegalItems.forEach(item => {
        const def = ItemRegistry[item.itemId];
        player.outputChatBox(`!{FF8888}  • ${def?.name || item.itemId} x${item.count}`);
    });
    target.outputChatBox(`!{FF4444}[Search] Officer found illegal items on you.`);
    log(player.data.dbId, player.name, target.data.dbId, target.name, 'search');
});

// ── /arrest <id> [sentence mins] — sends cuffed wanted player to jail ────────
mp.events.addCommand('arrest', async (player, _, id, sentenceStr) => {
    if (!player.logged || !canDo(player, 'ARREST_PLAYER')) return player.outputChatBox('!{FF0000}LSPD Officer+ only.');
    if (!id) return player.outputChatBox('!{FF0000}Usage: /arrest [id] [minutes=5]');
    const target = findPlayer(id);
    if (!target) return player.outputChatBox('!{FF0000}Player not found.');
    if (!nearby(player, target)) return player.outputChatBox('!{FF0000}Too far away.');
    if (!FM.cuffed.has(target.data.dbId)) return player.outputChatBox('!{FF0000}Player must be cuffed first.');

    const wanted = target.data.wantedLevel || 0;
    if (wanted <= 0) return player.outputChatBox('!{FF0000}Player has no wanted level.');

    const sentence = Math.min(15, Math.max(1, parseInt(sentenceStr) || 5)); // 1-15 min sentence

    // Clear wanted, uncuff, teleport to jail
    target.data.wantedLevel = 0;
    target.setVariable('wantedLevel', 0);
    FM.cuffed.delete(target.data.dbId);
    target.setVariable('isCuffed', false);
    target.call('faction:uncuff');

    target.spawn(new mp.Vector3(JAIL_POS.x, JAIL_POS.y, JAIL_POS.z));
    target.dimension = JAIL_DIM;
    target.call('faction:jailed', [sentence]);
    target.outputChatBox(`!{FF4444}[LSPD] You have been arrested for ${sentence} minute(s). Serve your time.`);

    player.outputChatBox(`!{00FF00}[LSPD] ${target.name} arrested. Sentence: ${sentence} min.`);
    FM._notifyFaction(KEY, `!{FFAA00}[LSPD] ${player.name} arrested ${target.name} (${sentence}m).`, 1);
    log(player.data.dbId, player.name, target.data.dbId, target.name, 'arrest', sentence);

    // Release after sentence
    setTimeout(() => {
        if (!mp.players.exists(target)) return;
        target.spawn(new mp.Vector3(459.3, -1002.3, 25.05));
        target.dimension = 0;
        target.call('faction:released');
        target.outputChatBox('!{00FF00}[LSPD] Your sentence is over. You are free to go.');
    }, sentence * 60 * 1000);
});

// ── /wanted <id> <level 0-6> — Set wanted level (officer command) ─────────────
mp.events.addCommand('wanted', async (player, _, id, lvlStr) => {
    if (!player.logged || !canDo(player, 'FINE_PLAYER')) return player.outputChatBox('!{FF0000}LSPD Officer+ only.');
    if (!id) return player.outputChatBox('!{FF0000}Usage: /wanted [id] [level 0-6]');
    const target = findPlayer(id);
    if (!target) return player.outputChatBox('!{FF0000}Player not found.');

    const level = Math.min(6, Math.max(0, parseInt(lvlStr) || 0));
    target.data.wantedLevel = level;
    target.setVariable('wantedLevel', level);
    db.query('UPDATE users SET wanted_level=? WHERE id=?', [level, target.data.dbId]).catch(console.error);

    player.outputChatBox(`!{00FF00}[LSPD] Set ${target.name}'s wanted level to ${level}.`);
    target.outputChatBox(level > 0 ? `!{FF4444}[LSPD] You are now wanted (Level ${level}).` : '!{00FF00}[LSPD] Your record has been cleared.');
});

// ── /farmory — Open armory (must be near armory) ─────────────────────────────
mp.events.addCommand('farmory', (player) => {
    if (!player.logged || !canDo(player, 'ACCESS_ARMORY')) return player.outputChatBox('!{FF0000}LSPD only.');
    const def = FM.getDefinition(KEY);
    if (!def.armoryPosition) return player.outputChatBox('!{FF0000}No armory set.');
    const aPos = def.armoryPosition;
    if (player.dist(new mp.Vector3(aPos.x, aPos.y, aPos.z)) > 6) return player.outputChatBox('!{FF0000}Must be near the armory.');

    const available = ARMORY_LOADOUTS.filter(l => l.minRank <= player.data.factionRank);
    player.call('faction:openArmory', [KEY, JSON.stringify(available)]);
});

// ── server event: equip armory loadout ───────────────────────────────────────
mp.events.add('server:faction:armoryEquip', (player, factionKey, loadoutIndex) => {
    if (!player.logged || factionKey !== KEY || !canDo(player, 'ACCESS_ARMORY')) return;
    const available = ARMORY_LOADOUTS.filter(l => l.minRank <= player.data.factionRank);
    const loadout = available[parseInt(loadoutIndex)];
    if (!loadout) return;
    for (const item of loadout.items) {
        if (item.weapon !== 'WEAPON_UNARMED') player.giveWeapon(mp.joaat(item.weapon), item.ammo);
    }
    player.outputChatBox(`!{00FF00}[LSPD Armory] Equipped: ${loadout.name}.`);
});

// ── /fveh — Spawn faction vehicle ─────────────────────────────────────────────
mp.events.addCommand('fveh', (player) => {
    if (!player.logged || !FM.can(player, 'SPAWN_VEH') || player.data.factionKey !== KEY) return;
    const def = FM.getDefinition(KEY);
    if (!def.vehspawnPosition || !def.vehModel) return player.outputChatBox('!{FF0000}No vehicle spawn configured.');
    const pos = def.vehspawnPosition;
    const veh = mp.vehicles.new(mp.joaat(def.vehModel), new mp.Vector3(pos.x, pos.y, pos.z), {
        heading: pos.h || 0, numberPlate: 'LSPD', dimension: 0, locked: false, engine: false,
    });
    veh.setVariable('factionVeh', KEY);
    veh.setVariable('fuel', 100.0);
    setTimeout(() => { if (mp.players.exists(player) && mp.vehicles.exists(veh)) player.call('client:warpIntoVehicle', [veh.id, -1]); }, 250);
    player.outputChatBox('!{00FF00}[LSPD] Patrol vehicle spawned.');
});

console.log('[Factions] LSPD definition loaded.');
