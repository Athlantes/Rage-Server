// packages/factions/lspd/arrestManager.js
// ─────────────────────────────────────────────────────────────────────────────
// Arrest pipeline (reworked):
//
//   RoS wanted players: officer approaches and presses G to cuff (proximity prompt).
//   NoS wanted players: cannot be cuffed — use lethal force.
//   No /surrender, /cuff, or /uncuff commands.
//
//   /ticket [id] [offenseKey] — fine for RoS offense, clears that charge
//   /arrest [id]              — process cuffed suspect: clear wanted, log
//   /release [id]             — remove cuffs + clear all wanted
//   /charge [id] [offenseKey] — apply wanted offense to a player (officer cmd)
//   /wanted [id]              — check a player's current wanted status
//
//   Jail Drop Points: officer drives cuffed suspect to a marked drop zone,
//   presses G at the point to send them to jail automatically.
// ─────────────────────────────────────────────────────────────────────────────

const wantedManager = require('./wantedManager');
const db = require('../../core/database');
const PlayerManager = require('../../core/playerManager');

const LSPD_FACTION_ID = 2;
const CUFF_RANGE      = 2.5;   // metres
const CHARGE_RANGE    = 10.0;
const DETAIN_SEAT     = 1;     // back-left seat

// ── Jail Drop Points ──────────────────────────────────────────────────────────
const JAIL_DROP_POINTS = [
    { x: 459.41,  y: -997.01, z: 25.02,  label: 'Mission Row PD — Booking' },
    { x: 1856.33, y: 3687.08, z: 33.91,  label: 'Sandy Shores PD — Booking' },
    { x: -448.15, y: 6012.55, z: 31.72,  label: 'Paleto Bay PD — Booking'  },
];
const JAIL_DROP_RANGE  = 10.0;
const JAIL_POSITION    = { x: 1849.0, y: 2600.0, z: 46.0 }; // Bolingbroke

// ── In-memory cuff state ──────────────────────────────────────────────────────
const cuffedPlayers = new Map(); // Map<suspectServerId, { officerId }>

// ── Helpers ───────────────────────────────────────────────────────────────────

function isOfficerOnDuty(player) {
    return player.logged && player.factionId === LSPD_FACTION_ID && player.getVariable('factionDuty');
}

function dist3(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function isCuffed(player) { return cuffedPlayers.has(player.id); }
function getCuffData(player) { return cuffedPlayers.get(player.id); }

function isNearJailDrop(position) {
    return JAIL_DROP_POINTS.some(p => dist3(position, p) <= JAIL_DROP_RANGE);
}

async function logArrest(officerDbId, suspectDbId, suspectName, offenses, outcome) {
    try {
        await db.query(
            `INSERT INTO arrest_records (officer_id, suspect_id, suspect_name, offenses, outcome, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [officerDbId, suspectDbId, suspectName, JSON.stringify(offenses), outcome]
        );
    } catch (e) {
        console.error('[Arrest] Failed to log arrest record:', e);
    }
}

// ── Broadcast cuff/uncuff animation to all players in range ──────────────────
// This ensures the animation is visible and synced to everyone nearby,
// not just the two participants.
function broadcastCuffAnim(suspect, officer, cuffing) {
    mp.players.forEach(p => {
        if (dist3(p.position, suspect.position) > 40) return;
        p.call('client:lspd:cuffAnim', [suspect.id, officer.id, cuffing]);
    });
}

// ── Core cuff function ────────────────────────────────────────────────────────

function doCuff(officer, suspect) {
    if (isCuffed(suspect)) {
        return officer.outputChatBox('!{#ff4757}That player is already cuffed.');
    }
    if (dist3(officer.position, suspect.position) > CUFF_RANGE) {
        return officer.outputChatBox(`!{#ff4757}Too far away — get within ${CUFF_RANGE}m.`);
    }

    const wantedType = wantedManager.getWantedType(suspect);
    if (!wantedType) return officer.outputChatBox('!{#ff4757}This player is not wanted.');
    if (wantedType === 'NoS') return officer.outputChatBox('!{#ff4757}NoS suspect — use lethal force. Cuffing is not possible.');

    cuffedPlayers.set(suspect.id, { officerId: officer.id });
    suspect.setVariable('cuffed', true);

    broadcastCuffAnim(suspect, officer, true);

    suspect.outputChatBox('!{#ff4757}You have been cuffed by an officer.');
    officer.outputChatBox(`!{#2ecc71}You cuffed ${suspect.name.replace(/_/g, ' ')}.`);

    mp.players.forEach(p => {
        if (p.id === officer.id || p.id === suspect.id) return;
        if (dist3(p.position, suspect.position) > 20) return;
        p.outputChatBox(`!{#888888}* ${officer.name.replace(/_/g, ' ')} cuffed ${suspect.name.replace(/_/g, ' ')}.`);
    });

    // Send drop point data so officer client can render blips
    officer.call('client:lspd:updateJailDrops', [JSON.stringify(JAIL_DROP_POINTS)]);
    console.log(`[Arrest] Officer ${officer.name} cuffed ${suspect.name}.`);
}

// ── G-key: officer tries to cuff a nearby RoS-wanted player ──────────────────

mp.events.add('server:lspd:tryCuff', (officer, suspectId) => {
    if (!isOfficerOnDuty(officer)) return;
    const suspect = mp.players.at(parseInt(suspectId));
    if (!suspect || !mp.players.exists(suspect) || !suspect.logged) return;
    doCuff(officer, suspect);
});

// ── G-key: officer at a jail drop point books the suspect ────────────────────

mp.events.add('server:lspd:tryJailDrop', (officer) => {
    if (!isOfficerOnDuty(officer)) return;
    if (!officer.vehicle) return officer.outputChatBox('!{#ff4757}You must be in a vehicle at a drop point.');
    if (officer.vehicle.getVariable('factionId') !== LSPD_FACTION_ID) return;
    if (!isNearJailDrop(officer.position)) return officer.outputChatBox('!{#ff4757}You are not at a jail drop point.');

    // Find a cuffed suspect of this officer who is a passenger in the same vehicle
    let suspect = null;
    cuffedPlayers.forEach((data, suspectId) => {
        if (data.officerId !== officer.id) return;
        const p = mp.players.at(suspectId);
        if (!p || !mp.players.exists(p)) return;
        if (p.vehicle && p.vehicle.id === officer.vehicle.id) suspect = p;
    });

    if (!suspect) return officer.outputChatBox('!{#ff4757}No cuffed suspect in your vehicle.');

    _processArrest(officer, suspect, true);
});

// ── Internal arrest processor ─────────────────────────────────────────────────

async function _processArrest(officer, suspect, sendToJail) {
    const entries = wantedManager.getWanted(suspect);
    const activeOffenses = Array.from(entries.values())
        .filter(e => e.expiresAt > Date.now())
        .map(e => e.offenseKey);

    cuffedPlayers.delete(suspect.id);
    suspect.setVariable('cuffed', false);

    broadcastCuffAnim(suspect, officer, false);
    wantedManager.clearAllWanted(suspect, 'arrested');

    await logArrest(
        officer.data && officer.data.dbId,
        suspect.data && suspect.data.dbId,
        suspect.name,
        activeOffenses,
        'arrested'
    );

    if (sendToJail && mp.players.exists(suspect)) {
        // Eject from vehicle first, then teleport
        suspect.call('client:lspd:ejectAndTeleport', [JAIL_POSITION.x, JAIL_POSITION.y, JAIL_POSITION.z]);
        suspect.outputChatBox('!{#ff4757}[LSPD] !{#ffffff}You have been booked into Bolingbroke Penitentiary.');
    } else {
        suspect.outputChatBox(`!{#ff4757}[LSPD] !{#ffffff}You have been arrested by ${officer.name.replace(/_/g, ' ')}.`);
    }

    officer.outputChatBox(`!{#2ecc71}${suspect.name.replace(/_/g, ' ')} processed and arrested.`);

    mp.players.forEach(p => {
        if (!isOfficerOnDuty(p)) return;
        p.outputChatBox(`!{#00a8ff}[LSPD] !{#ffffff}${suspect.name.replace(/_/g, ' ')} was arrested by ${officer.name.replace(/_/g, ' ')}.`);
    });

    console.log(`[Arrest] ${suspect.name} arrested by ${officer.name}. Offenses: ${activeOffenses.join(', ')}`);
}

// ── /ticket [id] [offenseKey] ─────────────────────────────────────────────────

mp.events.addCommand('ticket', async (officer, args) => {
    if (!isOfficerOnDuty(officer)) return officer.outputChatBox('!{#ff4757}You must be on duty.');

    const parts = args ? args.split(' ') : [];
    if (parts.length < 2) return officer.outputChatBox('!{#ff4757}Usage: /ticket [player ID] [offense key]');

    const targetId   = parseInt(parts[0]);
    const offenseKey = parts[1].toLowerCase();
    const suspect    = mp.players.at(targetId);

    if (!suspect || !mp.players.exists(suspect) || !suspect.logged)
        return officer.outputChatBox('!{#ff4757}Player not found.');
    if (dist3(officer.position, suspect.position) > CUFF_RANGE)
        return officer.outputChatBox(`!{#ff4757}Get within ${CUFF_RANGE}m to issue a ticket.`);

    const offense = wantedManager.OFFENSES[offenseKey];
    if (!offense) return officer.outputChatBox(`!{#ff4757}Unknown offense: ${offenseKey}`);
    if (offense.type === 'NoS') return officer.outputChatBox('!{#ff4757}NoS offenses cannot be ticketed. Use /arrest.');

    const entries    = wantedManager.getWanted(suspect);
    const hasOffense = Array.from(entries.values()).some(e => e.offenseKey === offenseKey && e.expiresAt > Date.now());
    if (!hasOffense) return officer.outputChatBox(`!{#ff4757}${suspect.name.replace(/_/g, ' ')} is not wanted for ${offense.label}.`);

    const fine = offense.fine;
    const paid = await PlayerManager.removeMoneyAndSave(suspect, fine, `Police Fine: ${offense.label}`);
    if (!paid) return officer.outputChatBox(`!{#ff4757}Suspect doesn't have enough money ($${fine}) for this ticket.`);

    wantedManager.clearOffense(suspect, offenseKey);
    suspect.outputChatBox(`!{#ffc300}[LSPD] !{#ffffff}You received a fine of !{#ff4757}$${fine} !{#ffffff}for: ${offense.label}.`);
    officer.outputChatBox(`!{#2ecc71}Ticket issued to ${suspect.name.replace(/_/g, ' ')} — $${fine} for ${offense.label}.`);

    await logArrest(officer.data && officer.data.dbId, suspect.data && suspect.data.dbId, suspect.name, [offenseKey], 'ticketed');
    console.log(`[Arrest] Officer ${officer.name} ticketed ${suspect.name} for ${offenseKey} ($${fine}).`);
});

// ── /arrest [id] ─────────────────────────────────────────────────────────────

mp.events.addCommand('arrest', async (officer, idStr) => {
    if (!isOfficerOnDuty(officer)) return officer.outputChatBox('!{#ff4757}You must be on duty.');

    const targetId = parseInt(idStr);
    if (isNaN(targetId)) return officer.outputChatBox('!{#ff4757}Usage: /arrest [player ID]');

    const suspect = mp.players.at(targetId);
    if (!suspect || !mp.players.exists(suspect) || !suspect.logged)
        return officer.outputChatBox('!{#ff4757}Player not found.');
    if (!isCuffed(suspect))
        return officer.outputChatBox('!{#ff4757}The suspect must be cuffed first.');
    if (dist3(officer.position, suspect.position) > CUFF_RANGE)
        return officer.outputChatBox(`!{#ff4757}Get within ${CUFF_RANGE}m of the suspect.`);

    await _processArrest(officer, suspect, false);
});

// ── /release [id] ─────────────────────────────────────────────────────────────

mp.events.addCommand('release', async (officer, idStr) => {
    if (!isOfficerOnDuty(officer)) return officer.outputChatBox('!{#ff4757}You must be on duty.');

    const targetId = parseInt(idStr);
    if (isNaN(targetId)) return officer.outputChatBox('!{#ff4757}Usage: /release [player ID]');

    const suspect = mp.players.at(targetId);
    if (!suspect || !mp.players.exists(suspect) || !suspect.logged)
        return officer.outputChatBox('!{#ff4757}Player not found.');

    if (isCuffed(suspect)) {
        cuffedPlayers.delete(suspect.id);
        suspect.setVariable('cuffed', false);
        broadcastCuffAnim(suspect, officer, false);
    }

    const activeOffenses = Array.from(wantedManager.getWanted(suspect).values())
        .filter(e => e.expiresAt > Date.now()).map(e => e.offenseKey);

    wantedManager.clearAllWanted(suspect, 'released by officer');
    await logArrest(officer.data && officer.data.dbId, suspect.data && suspect.data.dbId, suspect.name, activeOffenses, 'released');

    suspect.outputChatBox(`!{#2ecc71}[LSPD] !{#ffffff}You have been released by ${officer.name.replace(/_/g, ' ')}.`);
    officer.outputChatBox(`!{#2ecc71}You released ${suspect.name.replace(/_/g, ' ')}.`);
});

// ── /charge [id] [offenseKey] ─────────────────────────────────────────────────

mp.events.addCommand('charge', (officer, args) => {
    if (!isOfficerOnDuty(officer)) return officer.outputChatBox('!{#ff4757}You must be on duty.');

    const parts = args ? args.split(' ') : [];
    if (parts.length < 2) {
        const list = Object.entries(wantedManager.OFFENSES)
            .map(([k, v]) => `!{#888888}${k} !{#ffffff}(${v.type}, ${Math.floor(v.duration / 60)}m)`).join(', ');
        officer.outputChatBox('!{#ff4757}Usage: /charge [player ID] [offense key]');
        officer.outputChatBox(`!{#00a8ff}Offenses: ${list}`);
        return;
    }

    const targetId   = parseInt(parts[0]);
    const offenseKey = parts[1].toLowerCase();
    const suspect    = mp.players.at(targetId);

    if (!suspect || !mp.players.exists(suspect) || !suspect.logged)
        return officer.outputChatBox('!{#ff4757}Player not found.');
    if (dist3(officer.position, suspect.position) > CHARGE_RANGE)
        return officer.outputChatBox(`!{#ff4757}You must be within ${CHARGE_RANGE}m to charge someone.`);

    const applied = wantedManager.applyOffense(suspect, offenseKey, officer.id);
    if (applied) officer.outputChatBox(`!{#2ecc71}Charged ${suspect.name.replace(/_/g, ' ')} with: ${wantedManager.OFFENSES[offenseKey].label}`);
    else officer.outputChatBox(`!{#ff4757}Unknown offense key: ${offenseKey}`);
});

// ── /wanted [id] ──────────────────────────────────────────────────────────────

mp.events.addCommand('wanted', (officer, idStr) => {
    if (!isOfficerOnDuty(officer)) return officer.outputChatBox('!{#ff4757}You must be on duty.');

    const targetId = parseInt(idStr);
    if (isNaN(targetId)) return officer.outputChatBox('!{#ff4757}Usage: /wanted [player ID]');

    const suspect = mp.players.at(targetId);
    if (!suspect || !mp.players.exists(suspect) || !suspect.logged)
        return officer.outputChatBox('!{#ff4757}Player not found.');

    const entries = wantedManager.getWanted(suspect);
    const now     = Date.now();
    const active  = Array.from(entries.values()).filter(e => e.expiresAt > now);

    if (!active.length) return officer.outputChatBox(`!{#2ecc71}${suspect.name.replace(/_/g, ' ')} has no active wanted status.`);

    officer.outputChatBox(`!{#00a8ff}[WANTED CHECK] !{#ffffff}${suspect.name.replace(/_/g, ' ')}:`);
    active.forEach(e => {
        const remaining = Math.ceil((e.expiresAt - now) / 1000);
        const typeColor = e.type === 'NoS' ? '!{#ff4757}' : '!{#ffc300}';
        officer.outputChatBox(`  ${typeColor}[${e.type}] !{#ffffff}${e.label} — ${Math.floor(remaining/60)}m ${remaining%60}s remaining`);
    });
});

// ── Auto-detain: officer enters PD car while cuffed suspect is nearby ─────────

mp.events.add('playerEnterVehicle', (officer, vehicle, seat) => {
    if (seat !== -1) return;
    if (!isOfficerOnDuty(officer)) return;
    if (vehicle.getVariable('factionId') !== LSPD_FACTION_ID) return;

    cuffedPlayers.forEach((cuffData, suspectId) => {
        if (cuffData.officerId !== officer.id) return;
        const suspect = mp.players.at(suspectId);
        if (!suspect || !mp.players.exists(suspect)) return;
        if (dist3(officer.position, suspect.position) > 5.0) return;

        // Delay so officer enter anim completes, THEN tell suspect client to warp.
        // The client handler stops the follow-tick FIRST to prevent the Z-drop bug.
        setTimeout(() => {
            if (!mp.players.exists(suspect) || !mp.vehicles.exists(vehicle)) return;
            suspect.call('client:lspd:detainInVehicle', [vehicle.id, DETAIN_SEAT]);
            suspect.outputChatBox('!{#ff4757}You have been detained in the police vehicle.');
            officer.outputChatBox(`!{#2ecc71}${suspect.name.replace(/_/g, ' ')} detained in your vehicle.`);
            // Show blip overlay so officer knows where to drive
            officer.call('client:lspd:showJailDropPrompt', [JSON.stringify(JAIL_DROP_POINTS)]);
        }, 400);
    });
});

// ── Cleanup on disconnect ──────────────────────────────────────────────────────

mp.events.add('playerQuit', (player) => {
    cuffedPlayers.delete(player.id);
    cuffedPlayers.forEach((cuffData, suspectId) => {
        if (cuffData.officerId !== player.id) return;
        const suspect = mp.players.at(suspectId);
        if (suspect && mp.players.exists(suspect)) {
            cuffedPlayers.delete(suspectId);
            suspect.setVariable('cuffed', false);
            mp.players.forEach(p => {
                if (dist3(p.position, suspect.position) > 40) return;
                p.call('client:lspd:cuffAnim', [suspect.id, player.id, false]);
            });
            suspect.outputChatBox('!{#2ecc71}You were uncuffed because the officer disconnected.');
        }
    });
});

module.exports = { isCuffed, getCuffData, cuffedPlayers, LSPD_FACTION_ID, JAIL_DROP_POINTS };
