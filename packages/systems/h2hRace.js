// packages/systems/h2hRace.js
// ============================================================================
//  HEAD-TO-HEAD RACE SYSTEM  — Server Side
// ============================================================================

const INVITE_TIMEOUT_MS   = 60_000;   // 60 seconds to accept
const MIN_DISTANCE        = 5.0;      // Players must be within 5 m to start
const COUNTDOWN_SECONDS   = 3;        // 3-second countdown before GO
const MIN_CHECKPOINT_DIST = 800;      // Minimum distance of checkpoint from racers
const MAX_CHECKPOINT_DIST = 4000;     // Maximum distance of checkpoint from racers
const CHECKPOINT_RADIUS   = 15.0;     // Radius for finish colshape

const COLORS = {
    RACE:    '!{FFD700}',  // Gold
    ERROR:   '!{FF0000}',
    SUCCESS: '!{00FF00}',
    INFO:    '!{00BFFF}'
};

// ── Predefined checkpoint locations (road-accessible spots across the map) ──
const CHECKPOINT_LOCATIONS = [
    // Los Santos City
    { x: -1037.0, y: -2739.0, z: 13.8,  name: 'LSIA Runway' },
    { x: 195.0,   y: -935.0,  z: 30.7,  name: 'Legion Square' },
    { x: -1827.0, y: -432.0,  z: 42.3,  name: 'Del Perro Pier' },
    { x: 1159.5,  y: -745.0,  z: 57.4,  name: 'Mirror Park' },
    { x: -538.0,  y: -677.0,  z: 33.5,  name: 'Maze Bank West' },
    { x: 809.0,   y: -2979.0, z: 6.0,   name: 'Elysian Island' },
    { x: -72.0,   y: -1761.0, z: 29.5,  name: 'Davis' },
    { x: -1614.0, y: -1050.0, z: 13.0,  name: 'Vespucci Beach' },
    { x: 298.0,   y: -590.0,  z: 43.3,  name: 'Pillbox Hill' },
    { x: -279.0,  y: -2043.0, z: 30.1,  name: 'Rancho' },

    // Highways / Outskirts
    { x: 2581.0,  y: 362.0,   z: 108.5, name: 'Palmer-Taylor Power' },
    { x: 1706.0,  y: 3300.0,  z: 41.2,  name: 'Sandy Shores Airstrip' },
    { x: 2683.0,  y: 1470.0,  z: 24.5,  name: 'Tataviam Mountains' },
    { x: 79.0,    y: 6338.0,  z: 31.2,  name: 'Paleto Bay' },
    { x: -2201.0, y: 4249.0,  z: 48.0,  name: 'North Chumash' },
    { x: 1688.0,  y: 4783.0,  z: 42.0,  name: 'Grapeseed' },
    { x: -1132.0, y: 2681.0,  z: 18.8,  name: 'Route 68' },
    { x: -477.0,  y: 5320.0,  z: 80.7,  name: 'Chiliad Mountain Trail' },
    { x: -1591.0, y: -270.0,  z: 54.5,  name: 'Richman Hotel' },
    { x: -2955.0, y: 390.0,   z: 15.0,  name: 'Fort Zancudo Approach' },

    // Vinewood Hills / Richman
    { x: -765.0,  y: 312.0,   z: 85.7,  name: 'Burton' },
    { x: -1520.0, y: 117.0,   z: 55.9,  name: 'Morningwood' },
    { x: 621.0,   y: 269.0,   z: 103.1, name: 'Vinewood Racetrack' },
    { x: -102.0,  y: 378.0,   z: 112.0, name: 'Vinewood Sign' },
    { x: 1227.5,  y: -474.0,  z: 66.2,  name: 'La Mesa' },
];

// ── Active state maps ───────────────────────────────────────────────────────
const pendingInvites = new Map(); // challengerID → { challenger, target, timer }
const activeRaces    = new Map(); // raceId → { challenger, target, checkpoint, colshape, raceId, startTime }
let raceIdCounter    = 0;

// ═══════════════════════════════════════════════════════════════════════════
//  1. INVITE  (from circleMenu → server event)
// ═══════════════════════════════════════════════════════════════════════════

mp.events.add('h2h:invite', (player, targetVehicleId) => {
    // Validate challenger is driving
    if (!player.vehicle) {
        return player.outputChatBox(`${COLORS.ERROR}You must be driving a vehicle.`);
    }
    if (player.seat !== -1 && player.seat !== 0) { 
        return player.outputChatBox(`${COLORS.ERROR}You must be the driver.`);
    }

    // Already in an invite or race?
    if (isPlayerBusy(player)) {
        return player.outputChatBox(`${COLORS.ERROR}You are already in a race or have a pending invite.`);
    }

    // Find target vehicle + driver
    const targetVeh = mp.vehicles.at(targetVehicleId);
    if (!targetVeh) {
        return player.outputChatBox(`${COLORS.ERROR}Vehicle not found.`);
    }

    // Find the driver of the target vehicle
    const targetDriver = findVehicleDriver(targetVeh);
    if (!targetDriver) {
        return player.outputChatBox(`${COLORS.ERROR}There is no driver in that vehicle.`);
    }
    if (targetDriver.id === player.id) {
        return player.outputChatBox(`${COLORS.ERROR}You can't race yourself.`);
    }
    if (isPlayerBusy(targetDriver)) {
        return player.outputChatBox(`${COLORS.ERROR}That player is already in a race or has a pending invite.`);
    }

    // Proximity check
    const dist = player.dist(targetDriver.position);
    if (dist > 50) {
        return player.outputChatBox(`${COLORS.ERROR}You are too far from that vehicle.`);
    }

    // Create invite
    const invite = {
        challenger: player,
        target: targetDriver,
        timer: setTimeout(() => {
            expireInvite(player.id);
        }, INVITE_TIMEOUT_MS)
    };

    pendingInvites.set(player.id, invite);

    player.outputChatBox(`${COLORS.RACE}🏁 Head-to-Head race invite sent to ${targetDriver.name}! Waiting for response...`);
    targetDriver.outputChatBox(`${COLORS.RACE}🏁 ${player.name} challenges you to a Head-to-Head race!`);
    targetDriver.outputChatBox(`${COLORS.INFO}Type /acceptrace to accept or wait 60s to decline.`);
    player.outputChatBox(`${COLORS.INFO}Type /cancelrace to cancel your invite.`);
});

// ═══════════════════════════════════════════════════════════════════════════
//  2. ACCEPT RACE  (/acceptrace)
// ═══════════════════════════════════════════════════════════════════════════

mp.events.addCommand('acceptrace', (player) => {
    // Find the invite where this player is the target
    const invite = findInviteForTarget(player);
    if (!invite) {
        return player.outputChatBox(`${COLORS.ERROR}You have no pending race invites.`);
    }

    const { challenger, target } = invite;

    // Validate both still driving
    if (!challenger.vehicle || !target.vehicle) {
        cleanupInvite(challenger.id);
        return player.outputChatBox(`${COLORS.ERROR}Both players must be in a vehicle to race.`);
    }
    if (!mp.players.exists(challenger)) {
        cleanupInvite(challenger.id);
        return player.outputChatBox(`${COLORS.ERROR}The challenger has disconnected.`);
    }

    // Proximity check
    const dist = challenger.dist(target.position);
    if (dist > MIN_DISTANCE * 10) { // generous at accept time
        cleanupInvite(challenger.id);
        return player.outputChatBox(`${COLORS.ERROR}You are too far from the challenger. Race cancelled.`);
    }

    // Clean invite & start
    cleanupInvite(challenger.id);
    startRace(challenger, target);
});

// ═══════════════════════════════════════════════════════════════════════════
//  3. CANCEL RACE  (/cancelrace)
// ═══════════════════════════════════════════════════════════════════════════

mp.events.addCommand('cancelrace', (player) => {
    // Check if player is the challenger
    if (pendingInvites.has(player.id)) {
        const invite = pendingInvites.get(player.id);
        if (mp.players.exists(invite.target)) {
            invite.target.outputChatBox(`${COLORS.ERROR}The race invite from ${player.name} was cancelled.`);
        }
        cleanupInvite(player.id);
        player.outputChatBox(`${COLORS.SUCCESS}Race invite cancelled.`);
        return;
    }

    // Check if player is the target
    const inviteAsTarget = findInviteForTarget(player);
    if (inviteAsTarget) {
        const { challenger } = inviteAsTarget;
        if (mp.players.exists(challenger)) {
            challenger.outputChatBox(`${COLORS.ERROR}${player.name} declined your race invite.`);
        }
        cleanupInvite(challenger.id);
        player.outputChatBox(`${COLORS.SUCCESS}Race invite declined.`);
        return;
    }

    // Check if player is in an active race (forfeit)
    const race = findActiveRace(player);
    if (race) {
        endRace(race.raceId, null, `${player.name} forfeited the race!`);
        return;
    }

    player.outputChatBox(`${COLORS.ERROR}You have no pending invites or active races.`);
});

// ═══════════════════════════════════════════════════════════════════════════
//  4. START RACE — Countdown & Cinematic
// ═══════════════════════════════════════════════════════════════════════════

function startRace(challenger, target) {
    const raceId = ++raceIdCounter;

    // Pick a checkpoint far from both players
    const midPos = {
        x: (challenger.position.x + target.position.x) / 2,
        y: (challenger.position.y + target.position.y) / 2,
        z: (challenger.position.z + target.position.z) / 2,
    };
    const checkpoint = pickCheckpoint(midPos);

    if (!checkpoint) {
        challenger.outputChatBox(`${COLORS.ERROR}Could not find a suitable checkpoint. Try again.`);
        target.outputChatBox(`${COLORS.ERROR}Could not find a suitable checkpoint. Try again.`);
        return;
    }

    // Store race
    const race = {
        raceId,
        challenger,
        target,
        checkpoint,
        colshape: null,
        startTime: null,
        finished: false,
    };
    activeRaces.set(raceId, race);

    // Tag players so we know they are in a race
    challenger.h2hRaceId = raceId;
    target.h2hRaceId = raceId;

    // ── Ensure both vehicles have fuel and engine on ──
    [challenger, target].forEach(p => {
        if (p.vehicle) {
            const currentFuel = p.vehicle.getVariable('fuel') || 0;
            if (currentFuel < 30) {
                p.vehicle.setVariable('fuel', 100); // Top up to full
            }
            p.vehicle.engine = true;
        }
    });

    // Freeze both & start cinematic on client
    challenger.call('h2h:countdown', [
        COUNTDOWN_SECONDS,
        target.vehicle.position.x, target.vehicle.position.y, target.vehicle.position.z,
        target.vehicle.getHeading !== undefined ? 0 : 0,
        checkpoint.x, checkpoint.y, checkpoint.z, checkpoint.name
    ]);
    target.call('h2h:countdown', [
        COUNTDOWN_SECONDS,
        challenger.vehicle.position.x, challenger.vehicle.position.y, challenger.vehicle.position.z,
        0,
        checkpoint.x, checkpoint.y, checkpoint.z, checkpoint.name
    ]);

    challenger.outputChatBox(`${COLORS.RACE}🏁 Race starting! Destination: ${checkpoint.name}`);
    target.outputChatBox(`${COLORS.RACE}🏁 Race starting! Destination: ${checkpoint.name}`);

    // After countdown completes, create checkpoint colshape
    setTimeout(() => {
        if (!activeRaces.has(raceId)) return; // cancelled during countdown

        race.startTime = Date.now();

        // Create a server-side colshape at the checkpoint
        race.colshape = mp.colshapes.newSphere(checkpoint.x, checkpoint.y, checkpoint.z, CHECKPOINT_RADIUS);
        race.colshape.h2hRaceId = raceId;

        // Tell clients to GO
        if (mp.players.exists(challenger)) challenger.call('h2h:go');
        if (mp.players.exists(target))     target.call('h2h:go');

    }, (COUNTDOWN_SECONDS + 1) * 1000); // +1 for the "GO!" display
}

// ═══════════════════════════════════════════════════════════════════════════
//  5. CHECKPOINT HIT — Winner Detection
// ═══════════════════════════════════════════════════════════════════════════

mp.events.add('playerEnterColshape', (player, colshape) => {
    if (colshape.h2hRaceId === undefined) return;

    const raceId = colshape.h2hRaceId;
    const race = activeRaces.get(raceId);
    if (!race || race.finished) return;

    // Must be one of the racers
    if (player.id !== race.challenger.id && player.id !== race.target.id) return;

    // Must be in a vehicle
    if (!player.vehicle) return;

    // WINNER!
    const elapsed = ((Date.now() - race.startTime) / 1000).toFixed(1);
    endRace(raceId, player, `${player.name} wins the Head-to-Head race in ${elapsed}s! 🏆`);
});

// ═══════════════════════════════════════════════════════════════════════════
//  6. END / CLEANUP
// ═══════════════════════════════════════════════════════════════════════════

function endRace(raceId, winner, message) {
    const race = activeRaces.get(raceId);
    if (!race) return;

    race.finished = true;

    // Destroy colshape
    if (race.colshape && mp.colshapes.exists(race.colshape)) {
        race.colshape.destroy();
    }

    // Notify players
    const players = [race.challenger, race.target];
    players.forEach(p => {
        if (p && mp.players.exists(p)) {
            p.outputChatBox(`${COLORS.RACE}🏁 ${message}`);
            p.call('h2h:end', [winner ? winner.id : -1]);
            delete p.h2hRaceId;
        }
    });

    // Fixed: Announce to nearby players securely in case one player disconnected
    let midPos = null;
    if (mp.players.exists(race.challenger) && mp.players.exists(race.target)) {
        midPos = {
            x: (race.challenger.position.x + race.target.position.x) / 2,
            y: (race.challenger.position.y + race.target.position.y) / 2,
            z: (race.challenger.position.z + race.target.position.z) / 2
        };
    } else if (mp.players.exists(race.challenger)) {
        midPos = race.challenger.position;
    } else if (mp.players.exists(race.target)) {
        midPos = race.target.position;
    }

    if (midPos) {
        mp.players.forEachInRange(new mp.Vector3(midPos.x, midPos.y, midPos.z), 100, (p) => {
            if (p.id !== race.challenger.id && p.id !== race.target.id) {
                p.outputChatBox(`${COLORS.RACE}🏁 ${message}`);
            }
        });
    }

    activeRaces.delete(raceId);
}

// ═══════════════════════════════════════════════════════════════════════════
//  7. HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function findVehicleDriver(vehicle) {
    let driver = null;
    mp.players.forEach(p => {
        if (p.vehicle && p.vehicle.id === vehicle.id && (p.seat === -1 || p.seat === 0)) {
            driver = p;
        }
    });
    return driver;
}

function isPlayerBusy(player) {
    // In pending invite (as challenger)?
    if (pendingInvites.has(player.id)) return true;
    // In pending invite (as target)?
    if (findInviteForTarget(player)) return true;
    // In active race?
    if (player.h2hRaceId !== undefined) return true;
    return false;
}

function findInviteForTarget(player) {
    for (const [id, invite] of pendingInvites) {
        if (invite.target.id === player.id) return invite;
    }
    return null;
}

function findActiveRace(player) {
    if (player.h2hRaceId === undefined) return null;
    return activeRaces.get(player.h2hRaceId) || null;
}

function cleanupInvite(challengerId) {
    const invite = pendingInvites.get(challengerId);
    if (invite) {
        clearTimeout(invite.timer);
        pendingInvites.delete(challengerId);
    }
}

function expireInvite(challengerId) {
    const invite = pendingInvites.get(challengerId);
    if (!invite) return;
    if (mp.players.exists(invite.challenger)) {
        invite.challenger.outputChatBox(`${COLORS.ERROR}Your race invite expired (60s).`);
    }
    if (mp.players.exists(invite.target)) {
        invite.target.outputChatBox(`${COLORS.ERROR}The race invite from ${invite.challenger.name} has expired.`);
    }
    pendingInvites.delete(challengerId);
}

function pickCheckpoint(midPos) {
    // Filter checkpoints that are within acceptable distance range
    const candidates = CHECKPOINT_LOCATIONS.filter(cp => {
        const dx = cp.x - midPos.x;
        const dy = cp.y - midPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist >= MIN_CHECKPOINT_DIST && dist <= MAX_CHECKPOINT_DIST;
    });

    if (candidates.length === 0) {
        // Fallback: pick the farthest one even if out of ideal range
        let farthest = null;
        let farthestDist = 0;
        CHECKPOINT_LOCATIONS.forEach(cp => {
            const dx = cp.x - midPos.x;
            const dy = cp.y - midPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > farthestDist) {
                farthestDist = dist;
                farthest = cp;
            }
        });
        return farthest;
    }

    // Random from candidates
    return candidates[Math.floor(Math.random() * candidates.length)];
}

// ── Handle disconnects ─────────────────────────────────────────────────────
mp.events.add('playerQuit', (player) => {
    // Clean pending invite as challenger
    if (pendingInvites.has(player.id)) {
        const invite = pendingInvites.get(player.id);
        if (mp.players.exists(invite.target)) {
            invite.target.outputChatBox(`${COLORS.ERROR}${player.name} disconnected. Race invite cancelled.`);
        }
        cleanupInvite(player.id);
    }

    // Clean pending invite as target
    const inviteAsTarget = findInviteForTarget(player);
    if (inviteAsTarget) {
        if (mp.players.exists(inviteAsTarget.challenger)) {
            inviteAsTarget.challenger.outputChatBox(`${COLORS.ERROR}${player.name} disconnected. Race invite cancelled.`);
        }
        cleanupInvite(inviteAsTarget.challenger.id);
    }

    // End active race
    if (player.h2hRaceId !== undefined) {
        endRace(player.h2hRaceId, null, `${player.name} disconnected. Race cancelled.`);
    }
});

// ── Handle leaving vehicle mid-race ─────────────────────────────────────────
mp.events.add('playerExitVehicle', (player, vehicle) => {
    if (player.h2hRaceId !== undefined) {
        const race = activeRaces.get(player.h2hRaceId);
        if (race && !race.finished) {
            endRace(race.raceId, null, `${player.name} left their vehicle! Race cancelled.`);
        }
    }
});

console.log('[H2H Race] Head-to-Head race system loaded.');