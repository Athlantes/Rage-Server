// packages/factions/lspd/arrestManager.js
// ─────────────────────────────────────────────────────────────────────────────
// Handles the full arrest pipeline:
//
//   /surrender  (RoS suspects only) — suspect freezes, flags themselves as compliant
//   /cuff [id]  (officer) — within 2m of suspect who is either surrendered OR on foot
//               RoS: only cuffable if surrendered
//               NoS: never cuffable via command (must be killed)
//   /uncuff [id] (officer) — removes cuffs without arresting
//   /detain     (automatic) — when a cuffed suspect is near an officer entering a PD vehicle
//   /ticket [id] [offenseKey] — issues fine for a RoS offense, clears that charge
//   /arrest [id] — processes a cuffed suspect: clears all wanted, logs to DB, optionally jails
//   /release [id] — removes cuffs + clears all wanted (let them go)
//   /charge [id] [offenseKey] — apply a wanted offense to a player (officer command)
//   /wanted [id] — check a player's current wanted status
// ─────────────────────────────────────────────────────────────────────────────

const wantedManager = require('./wantedManager');
const db = require('../../core/database');
const PlayerManager = require('../../core/playerManager');

const LSPD_FACTION_ID = 2;
const CUFF_RANGE = 2.5;       // meters
const CHARGE_RANGE = 10.0;    // meters (officer must be somewhat close to charge)
const DETAIN_SEAT = 1;        // back-left seat in vehicle

// ── In-memory cuff state ──────────────────────────────────────────────────────
// Map<suspectId, { officerId, surrendered }>
const cuffedPlayers = new Map();

// ── Helpers ───────────────────────────────────────────────────────────────────

function isOfficerOnDuty(player) {
    return player.logged && player.factionId === LSPD_FACTION_ID && player.getVariable('factionDuty');
}

function dist3(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function isCuffed(player) {
    return cuffedPlayers.has(player.id);
}

function getCuffData(player) {
    return cuffedPlayers.get(player.id);
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

// ── /surrender ────────────────────────────────────────────────────────────────

mp.events.addCommand('surrender', (player) => {
    if (!player.logged) return;

    if (isCuffed(player)) return player.outputChatBox('!{#ff4757}You are already cuffed.');

    const wantedType = wantedManager.getWantedType(player);

    if (!wantedType) {
        return player.outputChatBox('!{#ff4757}You are not wanted.');
    }

    if (wantedType === 'NoS') {
        return player.outputChatBox('!{#ff4757}You have a No Surrender charge. You cannot give up.');
    }

    // Mark as surrendered — freeze movement client-side
    player.setVariable('surrendered', true);
    player.call('client:lspd:setSurrendered', [true]);
    player.outputChatBox('!{#2ecc71}You raised your hands. An officer will cuff you shortly.');

    // Notify nearby officers
    mp.players.forEach(p => {
        if (!isOfficerOnDuty(p)) return;
        if (dist3(p.position, player.position) > 50) return;
        p.outputChatBox(`!{#2ecc71}[LSPD] !{#ffffff}${player.name.replace(/_/g, ' ')} has surrendered nearby.`);
    });

    console.log(`[Arrest] ${player.name} surrendered.`);
});

// ── /cuff [id] ────────────────────────────────────────────────────────────────

mp.events.addCommand('cuff', (officer, idStr) => {
    if (!isOfficerOnDuty(officer)) return officer.outputChatBox('!{#ff4757}You must be on duty to do this.');
    if (officer.vehicle) return officer.outputChatBox('!{#ff4757}Exit your vehicle first.');

    const targetId = parseInt(idStr);
    if (isNaN(targetId)) return officer.outputChatBox('!{#ff4757}Usage: /cuff [player ID]');

    const suspect = mp.players.at(targetId);
    if (!suspect || !mp.players.exists(suspect) || !suspect.logged) {
        return officer.outputChatBox('!{#ff4757}Player not found.');
    }

    if (isCuffed(suspect)) {
        return officer.outputChatBox('!{#ff4757}That player is already cuffed.');
    }

    if (dist3(officer.position, suspect.position) > CUFF_RANGE) {
        return officer.outputChatBox(`!{#ff4757}You are too far away. Get within ${CUFF_RANGE}m.`);
    }

    const wantedType = wantedManager.getWantedType(suspect);
    if (!wantedType) {
        return officer.outputChatBox('!{#ff4757}This player is not wanted.');
    }

    if (wantedType === 'NoS') {
        return officer.outputChatBox('!{#ff4757}This suspect has a No Surrender charge. You cannot cuff them — use lethal force.');
    }

    // RoS — must have surrendered first
    if (!suspect.getVariable('surrendered')) {
        return officer.outputChatBox('!{#ff4757}The suspect has not surrendered yet. Use /arrest to order them to surrender first.');
    }

    // Apply cuffs
    cuffedPlayers.set(suspect.id, { officerId: officer.id, surrendered: true });
    suspect.setVariable('cuffed', true);
    suspect.setVariable('surrendered', false);

    // Freeze the suspect client-side and play cuff animation
    suspect.call('client:lspd:setCuffed', [true, officer.id]);
    officer.call('client:lspd:cuffedSomeone', [suspect.id]);

    suspect.outputChatBox('!{#ff4757}You have been cuffed by an officer.');
    officer.outputChatBox(`!{#2ecc71}You cuffed ${suspect.name.replace(/_/g, ' ')}.`);

    // Broadcast to nearby players (roleplay visibility)
    mp.players.forEach(p => {
        if (p.id === officer.id || p.id === suspect.id) return;
        if (dist3(p.position, suspect.position) > 20) return;
        p.outputChatBox(`!{#888888}* ${officer.name.replace(/_/g, ' ')} cuffed ${suspect.name.replace(/_/g, ' ')}.`);
    });

    console.log(`[Arrest] Officer ${officer.name} cuffed ${suspect.name}.`);
});

// ── /uncuff [id] ──────────────────────────────────────────────────────────────

mp.events.addCommand('uncuff', (officer, idStr) => {
    if (!isOfficerOnDuty(officer)) return officer.outputChatBox('!{#ff4757}You must be on duty.');

    const targetId = parseInt(idStr);
    if (isNaN(targetId)) return officer.outputChatBox('!{#ff4757}Usage: /uncuff [player ID]');

    const suspect = mp.players.at(targetId);
    if (!suspect || !mp.players.exists(suspect)) return officer.outputChatBox('!{#ff4757}Player not found.');

    if (!isCuffed(suspect)) return officer.outputChatBox('!{#ff4757}That player is not cuffed.');

    cuffedPlayers.delete(suspect.id);
    suspect.setVariable('cuffed', false);
    suspect.call('client:lspd:setCuffed', [false, null]);

    suspect.outputChatBox('!{#2ecc71}You have been uncuffed.');
    officer.outputChatBox(`!{#2ecc71}You uncuffed ${suspect.name.replace(/_/g, ' ')}.`);
});

// ── /ticket [id] [offenseKey] ─────────────────────────────────────────────────

mp.events.addCommand('ticket', async (officer, args) => {
    if (!isOfficerOnDuty(officer)) return officer.outputChatBox('!{#ff4757}You must be on duty.');

    const parts = args ? args.split(' ') : [];
    if (parts.length < 2) return officer.outputChatBox('!{#ff4757}Usage: /ticket [player ID] [offense key]');

    const targetId = parseInt(parts[0]);
    const offenseKey = parts[1].toLowerCase();

    const suspect = mp.players.at(targetId);
    if (!suspect || !mp.players.exists(suspect) || !suspect.logged) {
        return officer.outputChatBox('!{#ff4757}Player not found.');
    }

    if (dist3(officer.position, suspect.position) > CUFF_RANGE) {
        return officer.outputChatBox(`!{#ff4757}You must be within ${CUFF_RANGE}m to issue a ticket.`);
    }

    const offense = wantedManager.OFFENSES[offenseKey];
    if (!offense) return officer.outputChatBox(`!{#ff4757}Unknown offense: ${offenseKey}`);

    if (offense.type === 'NoS') {
        return officer.outputChatBox('!{#ff4757}NoS offenses cannot be resolved with a ticket. Use /arrest.');
    }

    // Check suspect actually has this offense
    const entries = wantedManager.getWanted(suspect);
    const hasOffense = Array.from(entries.values()).some(e => e.offenseKey === offenseKey && e.expiresAt > Date.now());
    if (!hasOffense) {
        return officer.outputChatBox(`!{#ff4757}${suspect.name.replace(/_/g, ' ')} is not wanted for ${offense.label}.`);
    }

    // Deduct fine
    const fine = offense.fine;
    const paid = await PlayerManager.removeMoneyAndSave(suspect, fine, `Police Fine: ${offense.label}`);
    if (!paid) {
        return officer.outputChatBox(`!{#ff4757}Suspect doesn't have enough money ($${fine}) for this ticket.`);
    }

    wantedManager.clearOffense(suspect, offenseKey);

    suspect.outputChatBox(`!{#ffc300}[LSPD] !{#ffffff}You received a fine of !{#ff4757}$${fine} !{#ffffff}for: ${offense.label}.`);
    officer.outputChatBox(`!{#2ecc71}Ticket issued to ${suspect.name.replace(/_/g, ' ')} — $${fine} for ${offense.label}.`);

    // Log
    await logArrest(
        officer.data && officer.data.dbId,
        suspect.data && suspect.data.dbId,
        suspect.name,
        [offenseKey],
        'ticketed'
    );

    console.log(`[Arrest] Officer ${officer.name} ticketed ${suspect.name} for ${offenseKey} ($${fine}).`);
});

// ── /arrest [id] ─────────────────────────────────────────────────────────────

mp.events.addCommand('arrest', async (officer, idStr) => {
    if (!isOfficerOnDuty(officer)) return officer.outputChatBox('!{#ff4757}You must be on duty.');

    const targetId = parseInt(idStr);
    if (isNaN(targetId)) return officer.outputChatBox('!{#ff4757}Usage: /arrest [player ID]');

    const suspect = mp.players.at(targetId);
    if (!suspect || !mp.players.exists(suspect) || !suspect.logged) {
        return officer.outputChatBox('!{#ff4757}Player not found.');
    }

    if (!isCuffed(suspect)) {
        return officer.outputChatBox('!{#ff4757}The suspect must be cuffed first.');
    }

    if (dist3(officer.position, suspect.position) > CUFF_RANGE) {
        return officer.outputChatBox(`!{#ff4757}Get within ${CUFF_RANGE}m of the suspect.`);
    }

    // Gather all active offenses for the log
    const entries = wantedManager.getWanted(suspect);
    const activeOffenses = Array.from(entries.values())
        .filter(e => e.expiresAt > Date.now())
        .map(e => e.offenseKey);

    // Remove cuffs
    cuffedPlayers.delete(suspect.id);
    suspect.setVariable('cuffed', false);
    suspect.call('client:lspd:setCuffed', [false, null]);

    // Clear all wanted
    wantedManager.clearAllWanted(suspect, 'arrested');

    // Log to DB
    await logArrest(
        officer.data && officer.data.dbId,
        suspect.data && suspect.data.dbId,
        suspect.name,
        activeOffenses,
        'arrested'
    );

    suspect.outputChatBox(`!{#ff4757}[LSPD] !{#ffffff}You have been arrested by ${officer.name.replace(/_/g, ' ')}.`);
    officer.outputChatBox(`!{#2ecc71}${suspect.name.replace(/_/g, ' ')} has been processed and arrested.`);

    // Notify faction
    mp.players.forEach(p => {
        if (!isOfficerOnDuty(p)) return;
        p.outputChatBox(`!{#00a8ff}[LSPD] !{#ffffff}${suspect.name.replace(/_/g, ' ')} was arrested by ${officer.name.replace(/_/g, ' ')}.`);
    });

    console.log(`[Arrest] ${suspect.name} arrested by ${officer.name}. Offenses: ${activeOffenses.join(', ')}`);
});

// ── /release [id] ─────────────────────────────────────────────────────────────

mp.events.addCommand('release', async (officer, idStr) => {
    if (!isOfficerOnDuty(officer)) return officer.outputChatBox('!{#ff4757}You must be on duty.');

    const targetId = parseInt(idStr);
    if (isNaN(targetId)) return officer.outputChatBox('!{#ff4757}Usage: /release [player ID]');

    const suspect = mp.players.at(targetId);
    if (!suspect || !mp.players.exists(suspect) || !suspect.logged) {
        return officer.outputChatBox('!{#ff4757}Player not found.');
    }

    if (isCuffed(suspect)) {
        cuffedPlayers.delete(suspect.id);
        suspect.setVariable('cuffed', false);
        suspect.call('client:lspd:setCuffed', [false, null]);
    }

    const activeOffenses = Array.from(wantedManager.getWanted(suspect).values())
        .filter(e => e.expiresAt > Date.now())
        .map(e => e.offenseKey);

    wantedManager.clearAllWanted(suspect, 'released by officer');

    await logArrest(
        officer.data && officer.data.dbId,
        suspect.data && suspect.data.dbId,
        suspect.name,
        activeOffenses,
        'released'
    );

    suspect.outputChatBox(`!{#2ecc71}[LSPD] !{#ffffff}You have been released by ${officer.name.replace(/_/g, ' ')}.`);
    officer.outputChatBox(`!{#2ecc71}You released ${suspect.name.replace(/_/g, ' ')}.`);
});

// ── /charge [id] [offenseKey] ─────────────────────────────────────────────────

mp.events.addCommand('charge', (officer, args) => {
    if (!isOfficerOnDuty(officer)) return officer.outputChatBox('!{#ff4757}You must be on duty.');

    const parts = args ? args.split(' ') : [];
    if (parts.length < 2) {
        const list = Object.entries(wantedManager.OFFENSES)
            .map(([k, v]) => `!{#888888}${k} !{#ffffff}(${v.type}, ${Math.floor(v.duration / 60)}m)`)
            .join(', ');
        officer.outputChatBox('!{#ff4757}Usage: /charge [player ID] [offense key]');
        officer.outputChatBox(`!{#00a8ff}Offenses: ${list}`);
        return;
    }

    const targetId = parseInt(parts[0]);
    const offenseKey = parts[1].toLowerCase();

    const suspect = mp.players.at(targetId);
    if (!suspect || !mp.players.exists(suspect) || !suspect.logged) {
        return officer.outputChatBox('!{#ff4757}Player not found.');
    }

    if (dist3(officer.position, suspect.position) > CHARGE_RANGE) {
        return officer.outputChatBox(`!{#ff4757}You must be within ${CHARGE_RANGE}m to charge someone.`);
    }

    const applied = wantedManager.applyOffense(suspect, offenseKey, officer.id);
    if (applied) {
        officer.outputChatBox(`!{#2ecc71}Charged ${suspect.name.replace(/_/g, ' ')} with: ${wantedManager.OFFENSES[offenseKey].label}`);
    } else {
        officer.outputChatBox(`!{#ff4757}Unknown offense key: ${offenseKey}`);
    }
});

// ── /wanted [id] ──────────────────────────────────────────────────────────────

mp.events.addCommand('wanted', (officer, idStr) => {
    if (!isOfficerOnDuty(officer)) return officer.outputChatBox('!{#ff4757}You must be on duty.');

    const targetId = parseInt(idStr);
    if (isNaN(targetId)) return officer.outputChatBox('!{#ff4757}Usage: /wanted [player ID]');

    const suspect = mp.players.at(targetId);
    if (!suspect || !mp.players.exists(suspect) || !suspect.logged) {
        return officer.outputChatBox('!{#ff4757}Player not found.');
    }

    const entries = wantedManager.getWanted(suspect);
    const now = Date.now();
    const active = Array.from(entries.values()).filter(e => e.expiresAt > now);

    if (active.length === 0) {
        return officer.outputChatBox(`!{#2ecc71}${suspect.name.replace(/_/g, ' ')} has no active wanted status.`);
    }

    officer.outputChatBox(`!{#00a8ff}[WANTED CHECK] !{#ffffff}${suspect.name.replace(/_/g, ' ')}:`);
    active.forEach(e => {
        const remaining = Math.ceil((e.expiresAt - now) / 1000);
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        const typeColor = e.type === 'NoS' ? '!{#ff4757}' : '!{#ffc300}';
        officer.outputChatBox(`  ${typeColor}[${e.type}] !{#ffffff}${e.label} — ${mins}m ${secs}s remaining`);
    });
});

// ── Detain on vehicle entry: cuffed suspect near officer entering PD vehicle ──

mp.events.add('playerEnterVehicle', (officer, vehicle, seat) => {
    if (seat !== -1) return; // only driver seat
    if (!isOfficerOnDuty(officer)) return;
    if (vehicle.getVariable('factionId') !== LSPD_FACTION_ID) return;

    // Check for a cuffed player that this officer is responsible for, nearby
    cuffedPlayers.forEach((cuffData, suspectId) => {
        if (cuffData.officerId !== officer.id) return;

        const suspect = mp.players.at(suspectId);
        if (!suspect || !mp.players.exists(suspect)) return;
        if (dist3(officer.position, suspect.position) > 5.0) return;

        // Warp suspect into back seat
        setTimeout(() => {
            if (mp.players.exists(suspect) && mp.vehicles.exists(vehicle)) {
                suspect.call('client:warpIntoVehicle', [vehicle.id, DETAIN_SEAT]);
                suspect.outputChatBox('!{#ff4757}You have been detained in the police vehicle.');
                officer.outputChatBox(`!{#2ecc71}${suspect.name.replace(/_/g, ' ')} has been detained in your vehicle.`);
                console.log(`[Arrest] ${suspect.name} auto-detained into officer ${officer.name}'s vehicle.`);
            }
        }, 300);
    });
});

// ── Clean up cuff state on disconnect ─────────────────────────────────────────

mp.events.add('playerQuit', (player) => {
    cuffedPlayers.delete(player.id);
    // If this officer had someone cuffed, release that suspect
    cuffedPlayers.forEach((cuffData, suspectId) => {
        if (cuffData.officerId === player.id) {
            const suspect = mp.players.at(suspectId);
            if (suspect && mp.players.exists(suspect)) {
                cuffedPlayers.delete(suspectId);
                suspect.setVariable('cuffed', false);
                suspect.call('client:lspd:setCuffed', [false, null]);
                suspect.outputChatBox('!{#2ecc71}You were uncuffed because the officer disconnected.');
            }
        }
    });
});

module.exports = {
    isCuffed,
    getCuffData,
    cuffedPlayers,
    LSPD_FACTION_ID,
};