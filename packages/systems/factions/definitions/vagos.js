// packages/systems/factions/definitions/vagos.js
// ─────────────────────────────────────────────────────────────────────────────
//  Los Santos Vagos — Criminal Organization
//  Abilities: drug lab processing, weapon distribution to members, radio
//  HQ: Forum Drive (East LS)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const FM = require('../factionManager');
const pm = require('../../../core/playerManager');
const db = require('../../../core/database');

const KEY = 'vagos';

// ── Drug lab config ───────────────────────────────────────────────────────────
// Each recipe: costs rawItemId x rawAmount, produces productItemId x productAmount after processingMs
const DRUG_RECIPES = [
    {
        id:          'weed_bag',
        name:        'Pack Weed',
        rawItem:     'weed_raw',
        rawAmount:   5,
        product:     'weed_bag',
        productAmount: 1,
        processingMs: 30_000, // 30 seconds
        minRank:     2,
    },
    {
        id:          'meth_pack',
        name:        'Cook Meth',
        rawItem:     'meth_ingredients',
        rawAmount:   3,
        product:     'meth_pack',
        productAmount: 2,
        processingMs: 90_000, // 90 seconds
        minRank:     3,
    },
];

// ── Weapon distribution config ────────────────────────────────────────────────
const DISTRIBUTABLE_WEAPONS = [
    { weapon: 'WEAPON_PISTOL',    ammo: 48,  cost: 3000,  minRank: 2, name: 'Pistol' },
    { weapon: 'WEAPON_MICROSMG',  ammo: 100, cost: 8000,  minRank: 3, name: 'Micro SMG' },
    { weapon: 'WEAPON_SAWNOFFSHOTGUN', ammo: 16, cost: 6000, minRank: 3, name: 'Sawn-off Shotgun' },
    { weapon: 'WEAPON_ASSAULTRIFLE', ammo: 120, cost: 20000, minRank: 4, name: 'Assault Rifle' },
];

// ── Active lab processes ──────────────────────────────────────────────────────
// playerId → { recipeId, timer, startedAt }
const activeProcesses = new Map();

// ── Definition ────────────────────────────────────────────────────────────────
FM.register(KEY, {
    name:        'Los Santos Vagos',
    tag:         'VAGO',
    type:        'criminal',
    color:       '#FFD700',
    description: 'One of the most powerful street gangs in East Los Santos. Loyalty above all.',
    memberCap:   30,
    applicationsOpen: false, // Invite only

    hqPosition:       { x: 99.86, y: -1954.38, z: 20.68, h: 185.0 },
    armoryPosition:   { x: 105.20, y: -1960.10, z: 20.68, h: 185.0 },
    vehspawnPosition: { x: 90.12, y: -1944.20, z: 20.68, h: 5.0   },
    vehModel:         'tornado3',

    drugLabPosition:  { x: 108.35, y: -1970.60, z: 20.68 },

    // Duty: stand at the hideout entrance, get teleported into the drug lab area
    dutyPosition:         { x: 96.4, y: -1945.2, z: 20.68, h: 185.0 },
    dutyInteriorPosition: { x: 108.35, y: -1970.60, z: 20.68, h: 185.0 },

    // Map blip shown to all players
    blipConfig: {
        sprite:   84,        // Gang activity / spray can
        color:    5,         // Yellow
        scale:    0.9,
        label:    'Vagos HQ',
        position: { x: 96.4, y: -1945.2, z: 20.68 },
    },

    permissions: {
        USE_RADIO:         1,
        SPAWN_VEH:         1,
        ACCESS_ARMORY:     2,
        USE_DRUG_LAB:      2,
        DISTRIBUTE_WEAPON: 3,
        MANAGE_MEMBERS:    4,
    },

    ranks: [
        { rank: 1, name: 'Shorty',       color: '#FFD700', salary: 400  },
        { rank: 2, name: 'Soldado',       color: '#FFD700', salary: 900  },
        { rank: 3, name: 'Veterano',      color: '#FFE44D', salary: 1600 },
        { rank: 4, name: 'Shot Caller',   color: '#FFEE88', salary: 2500 },
        { rank: 5, name: 'Jefe',          color: '#FFFFFF', salary: 4000 },
    ],
});

// ═════════════════════════════════════════════════════════════════════════════
//  CRIMINAL COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

function vagos(player)         { return FM.getFactionByPlayer(player)?.key === KEY; }
function canDo(player, action) { return vagos(player) && FM.can(player, action); }
function findPlayer(arg) {
    const num = parseInt(arg);
    if (!isNaN(num)) return mp.players.toArray().find(p => p.data?.onlineId === num) || null;
    return mp.players.toArray().find(p => p.name.toLowerCase().includes(String(arg).toLowerCase())) || null;
}

// ── /druglab — Open drug lab menu (must be near lab) ─────────────────────────
mp.events.addCommand('druglab', (player) => {
    if (!player.logged || !canDo(player, 'USE_DRUG_LAB')) return player.outputChatBox('!{FF0000}Vagos Soldado+ only.');
    const def = FM.getDefinition(KEY);
    if (!def.drugLabPosition) return player.outputChatBox('!{FF0000}No lab configured.');
    const lPos = def.drugLabPosition;
    if (player.dist(new mp.Vector3(lPos.x, lPos.y, lPos.z)) > 8) return player.outputChatBox('!{FF0000}Must be near the drug lab.');

    if (activeProcesses.has(player.id)) return player.outputChatBox('!{FF0000}You are already processing something. Wait.');

    const rank = player.data.factionRank || 1;
    const available = DRUG_RECIPES.filter(r => r.minRank <= rank);
    player.call('faction:openDrugLab', [JSON.stringify(available)]);
});

// ── server:faction:startProcess — player picks a recipe ──────────────────────
mp.events.add('server:faction:startProcess', async (player, recipeId) => {
    if (!player.logged || !canDo(player, 'USE_DRUG_LAB')) return;
    if (activeProcesses.has(player.id)) return player.outputChatBox('!{FF0000}Already processing.');

    const recipe = DRUG_RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;

    // Check rank
    if ((player.data.factionRank || 1) < recipe.minRank)
        return player.outputChatBox('!{FF0000}Rank too low for this recipe.');

    // Check inventory for raw material
    const Inventory = require('../../../systems/inventory');
    const hasEnough = Inventory.getItemCount(player, recipe.rawItem) >= recipe.rawAmount;
    if (!hasEnough)
        return player.outputChatBox(`!{FF0000}Need ${recipe.rawAmount}x ${recipe.rawItem}.`);

    // Consume raw items
    await Inventory.removeItem(player, recipe.rawItem, recipe.rawAmount);

    player.outputChatBox(`!{FFD700}[Lab] Processing: ${recipe.name}... (${recipe.processingMs / 1000}s)`);

    const timer = setTimeout(async () => {
        activeProcesses.delete(player.id);
        if (!mp.players.exists(player)) return;

        const ok = await Inventory.addItem(player, recipe.product, recipe.productAmount);
        if (ok) {
            player.outputChatBox(`!{00FF00}[Lab] Done! Produced ${recipe.productAmount}x ${recipe.product}.`);
        } else {
            player.outputChatBox('!{FF0000}[Lab] Inventory full. Product lost.');
        }
        db.query('INSERT INTO faction_action_log (officer_id,officer_name,target_id,target_name,action) VALUES (?,?,?,?,?)',
            [player.data.dbId, player.name, player.data.dbId, player.name, `druglab:${recipe.id}`]).catch(console.error);
    }, recipe.processingMs);

    activeProcesses.set(player.id, { recipeId, timer, startedAt: Date.now() });
});

// ── /fdistrib <id> <weaponIndex> — Give weapon to a faction member ────────────
mp.events.addCommand('fdistrib', async (player, fullText) => {
    if (!player.logged || !canDo(player, 'DISTRIBUTE_WEAPON'))
        return player.outputChatBox('!{FF0000}Vagos Veterano+ only.');

    const args = (fullText || '').split(' ');
    if (args.length < 2) {
        player.outputChatBox('!{FF0000}Usage: /fdistrib [id] [weaponIndex]');
        player.outputChatBox('!{FFFF00}Available: ' + DISTRIBUTABLE_WEAPONS.map((w, i) => `${i}: ${w.name} ($${w.cost})`).join(' | '));
        return;
    }

    const target = findPlayer(args[0]);
    if (!target) return player.outputChatBox('!{FF0000}Player not found.');
    if (player.dist(target.position) > 5) return player.outputChatBox('!{FF0000}Too far away.');

    // Target must also be in Vagos
    if (target.data.factionKey !== KEY) return player.outputChatBox('!{FF0000}Target is not a Vago.');

    const wIdx = parseInt(args[1]);
    const weapDef = DISTRIBUTABLE_WEAPONS[wIdx];
    if (!weapDef) return player.outputChatBox('!{FF0000}Invalid weapon index.');
    if ((player.data.factionRank || 1) < weapDef.minRank)
        return player.outputChatBox(`!{FF0000}Rank too low to distribute ${weapDef.name}.`);

    // Cost comes from the distributor
    const ok = await pm.removeMoneyAndSave(player, weapDef.cost, `Weapon distribution: ${weapDef.name}`);
    if (!ok) return player.outputChatBox(`!{FF0000}Need $${weapDef.cost.toLocaleString()} to distribute this.`);

    target.giveWeapon(mp.joaat(weapDef.weapon), weapDef.ammo);
    player.outputChatBox(`!{00FF00}[Vagos] Distributed ${weapDef.name} to ${target.name}.`);
    target.outputChatBox(`!{FFD700}[Vagos] ${player.name} gave you a ${weapDef.name}.`);
    mp.players.forEachInRange(player.position, 8, p => p.call('chat:push', [null, `* ${player.name} passes something to ${target.name}.`, 'me']));
});

// ── /vagosveh — Spawn faction vehicle ────────────────────────────────────────
mp.events.addCommand('vagosveh', (player) => {
    if (!player.logged || player.data.factionKey !== KEY || !FM.can(player, 'SPAWN_VEH')) return;
    const def = FM.getDefinition(KEY);
    const pos = def.vehspawnPosition;
    const veh = mp.vehicles.new(mp.joaat(def.vehModel), new mp.Vector3(pos.x, pos.y, pos.z), {
        heading: pos.h || 0, numberPlate: 'VAGOS', dimension: 0, locked: false, engine: false,
    });
    veh.setVariable('factionVeh', KEY);
    veh.setVariable('fuel', 100.0);
    setTimeout(() => { if (mp.players.exists(player) && mp.vehicles.exists(veh)) player.call('client:warpIntoVehicle', [veh.id, -1]); }, 250);
    player.outputChatBox('!{FFD700}[Vagos] Ride spawned.');
});

// ── /farmory — access weapon stash ───────────────────────────────────────────
mp.events.addCommand('vagosarmory', (player) => {
    if (!player.logged || !canDo(player, 'ACCESS_ARMORY')) return;
    const def = FM.getDefinition(KEY);
    if (!def.armoryPosition) return;
    const aPos = def.armoryPosition;
    if (player.dist(new mp.Vector3(aPos.x, aPos.y, aPos.z)) > 6) return player.outputChatBox('!{FF0000}Must be near the stash.');

    const rank = player.data.factionRank || 1;
    const available = DISTRIBUTABLE_WEAPONS.filter(w => w.minRank <= rank).map((w, i) => ({
        name: w.name, cost: w.cost, index: i
    }));
    player.call('faction:openArmory', [KEY, JSON.stringify(available)]);
});

mp.events.add('server:faction:armoryEquip', (player, factionKey, loadoutIndex) => {
    if (!player.logged || factionKey !== KEY || !canDo(player, 'ACCESS_ARMORY')) return;
    const rank = player.data.factionRank || 1;
    const available = DISTRIBUTABLE_WEAPONS.filter(w => w.minRank <= rank);
    const weapDef = available[parseInt(loadoutIndex)];
    if (!weapDef) return;
    // For criminal armory, player pays
    pm.removeMoneyAndSave(player, weapDef.cost, `Vagos Armory: ${weapDef.name}`).then(ok => {
        if (!ok) return player.outputChatBox(`!{FF0000}Need $${weapDef.cost.toLocaleString()}.`);
        player.giveWeapon(mp.joaat(weapDef.weapon), weapDef.ammo);
        player.outputChatBox(`!{00FF00}[Vagos Stash] Got ${weapDef.name}.`);
    });
});

// Cleanup processes on disconnect
mp.events.add('playerQuit', (player) => {
    const proc = activeProcesses.get(player.id);
    if (proc) { clearTimeout(proc.timer); activeProcesses.delete(player.id); }
});

console.log('[Factions] Vagos definition loaded.');
