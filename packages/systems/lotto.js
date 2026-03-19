// ============================================================
//  packages/systems/lotto.js
//  6/49 Lotto System — Server Side
// ============================================================

const db            = require('../core/database');
const playerManager = require('../core/playerManager');
const { isRateLimited } = require('../core/rateLimit');

// ────────────────────────────────────────────────────────────
//  CONFIG  —  edit these freely
// ────────────────────────────────────────────────────────────
const CONFIG = {
    MIN_BET:          100,           // minimum ticket price ($)
    MAX_BET:          10_000,        // maximum ticket price ($)
    NUMBERS_POOL:     49,            // 1–49
    PICK_COUNT:       6,             // player picks 6 numbers

    // Prize multipliers for sub-jackpot tiers (applied to ticket bet)
    // These amounts are ALSO deducted from the weekly pool before the jackpot
    PRIZE_4_MULTIPLIER: 5,           // 4 matched → 5× ticket bet
    PRIZE_5_MULTIPLIER: 20,          // 5 matched → 20× ticket bet

    // Admin level required to use /lottodraw
    ADMIN_DRAW_LEVEL: 3,

    // Draw schedule: Saturday = 6 (0=Sun … 6=Sat), hour 20 (server local time)
    DRAW_DAY_OF_WEEK: 6,
    DRAW_HOUR:        20,
    DRAW_MINUTE:      0,
};

// ────────────────────────────────────────────────────────────
//  In-memory state (loaded from DB on boot)
// ────────────────────────────────────────────────────────────
let state = {
    weekId:   1,
    jackpot:  0,
    nextDraw: null,   // Date object
};

// ────────────────────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────────────────────

/** Parse "5,12,23" → [5, 12, 23] */
function parseNumbers(str) {
    return str.split(',').map(Number);
}

/** [5, 12, 23] → "5,12,23" (always sorted ascending) */
function serializeNumbers(arr) {
    return [...arr].sort((a, b) => a - b).join(',');
}

/** Count how many numbers from `ticket` appear in `drawn` */
function countMatches(ticket, drawn) {
    const drawnSet = new Set(drawn);
    return ticket.filter(n => drawnSet.has(n)).length;
}

/** Return next Saturday 20:00 as a Date (server local time) */
function nextDrawDate() {
    const now  = new Date();
    const day  = now.getDay();   // 0=Sun … 6=Sat
    let   daysUntil = (CONFIG.DRAW_DAY_OF_WEEK - day + 7) % 7;
    if (daysUntil === 0) {
        // If it's already Saturday, check if the draw time has passed
        if (now.getHours() >= CONFIG.DRAW_HOUR && now.getMinutes() >= CONFIG.DRAW_MINUTE) {
            daysUntil = 7; // schedule for NEXT Saturday
        }
    }
    const target = new Date(now);
    target.setDate(now.getDate() + daysUntil);
    target.setHours(CONFIG.DRAW_HOUR, CONFIG.DRAW_MINUTE, 0, 0);
    return target;
}

/** Format a Date → MySQL DATETIME string */
function toMysqlDatetime(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

/** Broadcast a styled chat message to all online players */
function broadcast(msg) {
    mp.players.forEach(p => p.outputChatBox(msg));
}

/** Give prize to a player — online immediately, offline via DB */
async function awardPrize(playerId, amount, reason) {
    const online = mp.players.toArray().find(p => p.logged && p.data.dbId === playerId);
    if (online) {
        await playerManager.addMoneyAndSave(online, amount, reason);
        online.call('client:lotto:prizeNotification', [amount, reason]);
    } else {
        await db.query('UPDATE users SET money = money + ? WHERE id = ?', [amount, playerId]);
    }
}

/**
 * Send a lotto result mail to a ticket holder via the phone mail system.
 * @param {number}   playerId     - users.id
 * @param {number[]} pickedNums   - the numbers on the player's ticket
 * @param {number[]} drawnNums    - the 6 winning numbers
 * @param {number}   matches      - how many they matched
 * @param {number}   bet          - their ticket bet amount
 * @param {number}   prize        - prize awarded (0 if lost)
 * @param {number}   weekId       - draw week number
 * @param {number}   nextJackpot  - jackpot pool for the next week
 */
function sendLottoMail(playerId, pickedNums, drawnNums, matches, bet, prize, weekId, nextJackpot) {
    // ── Subject line ──────────────────────────────────────────
    let title;
    if (matches === 6)      title = `🏆 JACKPOT! Lotto Draw #${weekId} Results`;
    else if (matches === 5) title = `🎉 You matched 5 numbers! Draw #${weekId}`;
    else if (matches === 4) title = `🎉 You matched 4 numbers! Draw #${weekId}`;
    else                    title = `🎰 Lotto Draw #${weekId} Results`;

    // ── Format number lists ───────────────────────────────────
    const pickedStr = pickedNums.join('  ·  ');
    const drawnStr  = drawnNums.join('  ·  ');

    // ── Result line ───────────────────────────────────────────
    let resultLine;
    if (matches === 6) {
        resultLine = `✅ JACKPOT! You matched all 6 numbers!\nPrize awarded: $${prize.toLocaleString()}`;
    } else if (matches === 5) {
        resultLine = `✅ You matched 5 out of 6 numbers.\nPrize awarded: $${prize.toLocaleString()}`;
    } else if (matches === 4) {
        resultLine = `✅ You matched 4 out of 6 numbers.\nPrize awarded: $${prize.toLocaleString()}`;
    } else if (matches === 3) {
        resultLine = `You matched 3 numbers — no prize this time.`;
    } else if (matches === 2) {
        resultLine = `You matched 2 numbers — no prize this time.`;
    } else if (matches === 1) {
        resultLine = `You matched 1 number — no prize this time.`;
    } else {
        resultLine = `No matches this week — better luck next time!`;
    }

    // ── Full message body ─────────────────────────────────────
    const message =
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `  LOTTO 6/49 — DRAW #${weekId}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Your numbers:\n  ${pickedStr}\n\n` +
        `Winning numbers:\n  ${drawnStr}\n\n` +
        `Matched: ${matches} / 6\n` +
        `Your bet: $${bet.toLocaleString()}\n\n` +
        `${resultLine}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Next week's jackpot pool:\n  $${nextJackpot.toLocaleString()}\n` +
        `Next draw: Saturday at 20:00\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    mp.events.call('server:phone:sendMail', playerId, 'Lotto 6/49', title, message);
}

// ────────────────────────────────────────────────────────────
//  Load state from DB on boot
// ────────────────────────────────────────────────────────────
async function loadState() {
    try {
        const [rows] = await db.query('SELECT * FROM lotto_state WHERE id = 1');
        if (rows.length === 0) {
            console.error('[LOTTO] lotto_state row missing — did you run lotto_schema.sql?');
            return;
        }
        const row       = rows[0];
        state.weekId    = row.week_id;
        state.jackpot   = row.jackpot;
        state.nextDraw  = new Date(row.next_draw);
        console.log(`[LOTTO] Loaded — week #${state.weekId}, jackpot $${state.jackpot}, next draw: ${state.nextDraw}`);
        scheduleDrawTimer();
    } catch (err) {
        console.error('[LOTTO] Failed to load state:', err);
    }
}

// ────────────────────────────────────────────────────────────
//  Draw scheduler — checks every minute
// ────────────────────────────────────────────────────────────
let drawTimer = null;

function scheduleDrawTimer() {
    if (drawTimer) clearInterval(drawTimer);
    drawTimer = setInterval(() => {
        if (new Date() >= state.nextDraw) {
            clearInterval(drawTimer);
            drawTimer = null;
            executeDraw();
        }
    }, 60_000); // check every minute
}

// ────────────────────────────────────────────────────────────
//  CORE: Execute the weekly draw
// ────────────────────────────────────────────────────────────
async function executeDraw(forcedBy = null) {
    console.log(`[LOTTO] Draw starting for week #${state.weekId}...`);

    // 1. Generate 6 unique random numbers
    const pool = [];
    while (pool.length < CONFIG.PICK_COUNT) {
        const n = Math.floor(Math.random() * CONFIG.NUMBERS_POOL) + 1;
        if (!pool.includes(n)) pool.push(n);
    }
    pool.sort((a, b) => a - b);
    const drawnStr = serializeNumbers(pool);

    broadcast(`!{FFD700}╔══════════════════════════════╗`);
    broadcast(`!{FFD700}║   🎰  LOTTO 6/49 — DRAW #${state.weekId}  ║`);
    broadcast(`!{FFD700}╚══════════════════════════════╝`);
    broadcast(`!{FFFFFF}Winning numbers: !{FFD700}${pool.join('  -  ')}`);
    broadcast(`!{AAAAAA}Jackpot pool: !{00FF88}$${state.jackpot.toLocaleString()}`);

    // 2. Fetch all tickets for this week
    const [tickets] = await db.query(
        'SELECT t.*, u.username FROM lotto_tickets t JOIN users u ON u.id = t.player_id WHERE t.week_id = ?',
        [state.weekId]
    );

    let jackpotWinners = [];

    // ticketResults holds { ticket, picked, matches, prize } — used for mails at the end
    const ticketResults = [];

    // 3. First pass — evaluate and award non-jackpot prizes
    for (const ticket of tickets) {
        const picked  = parseNumbers(ticket.numbers);
        const matches = countMatches(picked, pool);
        const bet     = ticket.bet;
        let   prize   = 0;

        if (matches === 6) {
            jackpotWinners.push(ticket);
            // prize is filled in after jackpot split below
        } else if (matches === 5) {
            prize = bet * CONFIG.PRIZE_5_MULTIPLIER;
            await awardPrize(ticket.player_id, prize, `Lotto 5/6 win — week #${state.weekId}`);
            broadcast(`!{00FF88}🎉 ${ticket.username} matched 5 numbers and won !{FFD700}$${prize.toLocaleString()}!`);
        } else if (matches === 4) {
            prize = bet * CONFIG.PRIZE_4_MULTIPLIER;
            await awardPrize(ticket.player_id, prize, `Lotto 4/6 win — week #${state.weekId}`);
            broadcast(`!{88FF88}🎉 ${ticket.username} matched 4 numbers and won !{FFD700}$${prize.toLocaleString()}!`);
        }

        ticketResults.push({ ticket, picked, matches, prize });
    }

    // 4. Handle jackpot
    let jackpotWon   = false;
    let jackpotShare = 0;

    if (jackpotWinners.length > 0) {
        jackpotWon   = true;
        jackpotShare = Math.floor(state.jackpot / jackpotWinners.length);
        for (const w of jackpotWinners) {
            await awardPrize(w.player_id, jackpotShare, `Lotto JACKPOT — week #${state.weekId}`);
            broadcast(`!{FFD700}🏆🏆 JACKPOT! ${w.username} matched ALL 6 numbers and won !{00FF88}$${jackpotShare.toLocaleString()}! 🏆🏆`);
        }
        // Patch jackpot prize into ticketResults for the mail
        for (const r of ticketResults) {
            if (r.matches === 6) r.prize = jackpotShare;
        }
        state.jackpot = 0;
    } else {
        broadcast(`!{FF8844}No jackpot winner this week. The pool of !{FFD700}$${state.jackpot.toLocaleString()} !{FF8844}rolls over to next week!`);
    }

    // 5. Log the draw
    await db.query(
        'INSERT INTO lotto_draws (week_id, drawn_numbers, jackpot, jackpot_won) VALUES (?, ?, ?, ?)',
        [state.weekId, drawnStr, state.jackpot + (jackpotWon ? 0 : 0), jackpotWon ? 1 : 0]
    );

    // 6. Advance week, set next draw date
    state.weekId  += 1;
    state.nextDraw = nextDrawDate();

    await db.query(
        'UPDATE lotto_state SET week_id = ?, jackpot = ?, next_draw = ? WHERE id = 1',
        [state.weekId, state.jackpot, toMysqlDatetime(state.nextDraw)]
    );

    broadcast(`!{AAAAAA}Next draw: !{FFFFFF}Saturday at 20:00. Good luck!`);
    broadcast(`!{FFD700}══════════════════════════════════`);

    // 7. Send result mail to every ticket holder
    const drawnForMail = pool; // already sorted array
    for (const r of ticketResults) {
        sendLottoMail(
            r.ticket.player_id,
            r.picked,
            drawnForMail,
            r.matches,
            r.ticket.bet,
            r.prize,
            state.weekId - 1,   // weekId was already incremented above, so use -1
            state.jackpot       // this is the NEXT week's starting pool
        );
    }

    if (forcedBy) {
        forcedBy.outputChatBox(`!{00FF00}[LOTTO] Draw executed successfully.`);
    }

    // Re-schedule timer
    scheduleDrawTimer();
}

// ────────────────────────────────────────────────────────────
//  EVENT: Player approaches machine → send open data
// ────────────────────────────────────────────────────────────
mp.events.add('server:lotto:requestOpen', async (player) => {
    if (!player.logged) return;
    if (isRateLimited(player, 'lotto:open', 3, 3000)) return;

    try {
        // Check if player already has a ticket this week
        const [rows] = await db.query(
            'SELECT numbers, bet FROM lotto_tickets WHERE player_id = ? AND week_id = ?',
            [player.data.dbId, state.weekId]
        );

        const payload = {
            jackpot:       state.jackpot,
            weekId:        state.weekId,
            minBet:        CONFIG.MIN_BET,
            maxBet:        CONFIG.MAX_BET,
            numbersPool:   CONFIG.NUMBERS_POOL,
            pickCount:     CONFIG.PICK_COUNT,
            nextDraw:      state.nextDraw.toISOString(),
            playerCash:    player.data.money || 0,
            existingTicket: rows.length > 0 ? { numbers: rows[0].numbers, bet: rows[0].bet } : null,
        };

        player.call('client:lotto:openUI', [JSON.stringify(payload)]);
    } catch (err) {
        console.error('[LOTTO] requestOpen error:', err);
        player.outputChatBox('!{FF0000}[LOTTO] Server error. Try again later.');
    }
});

// ────────────────────────────────────────────────────────────
//  EVENT: Player buys a ticket
// ────────────────────────────────────────────────────────────
mp.events.add('server:lotto:buyTicket', async (player, numbersJson, betRaw) => {
    if (!player.logged) return;
    if (isRateLimited(player, 'lotto:buy', 2, 5000)) return;

    const bet = parseInt(betRaw);
    if (isNaN(bet) || bet < CONFIG.MIN_BET || bet > CONFIG.MAX_BET) {
        player.call('client:lotto:error', ['Invalid bet amount.']);
        return;
    }

    let numbers;
    try {
        numbers = JSON.parse(numbersJson);
    } catch {
        player.call('client:lotto:error', ['Invalid numbers data.']);
        return;
    }

    // Validate numbers
    if (
        !Array.isArray(numbers) ||
        numbers.length !== CONFIG.PICK_COUNT ||
        new Set(numbers).size !== CONFIG.PICK_COUNT ||
        numbers.some(n => !Number.isInteger(n) || n < 1 || n > CONFIG.NUMBERS_POOL)
    ) {
        player.call('client:lotto:error', ['Invalid number selection.']);
        return;
    }

    // Check player has enough cash
    if ((player.data.money || 0) < bet) {
        player.call('client:lotto:error', ['Not enough cash.']);
        return;
    }

    try {
        // Double-check: no existing ticket this week (race condition guard)
        const [existing] = await db.query(
            'SELECT id FROM lotto_tickets WHERE player_id = ? AND week_id = ?',
            [player.data.dbId, state.weekId]
        );
        if (existing.length > 0) {
            player.call('client:lotto:error', ['You already have a ticket this week.']);
            return;
        }

        // Deduct cash
        const removed = await playerManager.removeMoneyAndSave(player, bet, `Lotto ticket — week #${state.weekId}`);
        if (!removed) {
            player.call('client:lotto:error', ['Failed to process payment.']);
            return;
        }

        // Add bet to jackpot pool
        state.jackpot += bet;
        await db.query(
            'UPDATE lotto_state SET jackpot = ? WHERE id = 1',
            [state.jackpot]
        );

        // Save ticket
        const sorted = serializeNumbers(numbers);
        await db.query(
            'INSERT INTO lotto_tickets (player_id, week_id, numbers, bet) VALUES (?, ?, ?, ?)',
            [player.data.dbId, state.weekId, sorted, bet]
        );

        // Confirm to client
        player.call('client:lotto:ticketConfirmed', [sorted, bet, state.jackpot]);
        console.log(`[LOTTO] ${player.name} bought ticket [${sorted}] for $${bet} (week #${state.weekId})`);

    } catch (err) {
        console.error('[LOTTO] buyTicket error:', err);
        player.call('client:lotto:error', ['Server error. Please try again.']);
    }
});

// ────────────────────────────────────────────────────────────
//  ADMIN COMMAND: /lottodraw — force a draw immediately
// ────────────────────────────────────────────────────────────
mp.events.addCommand('lottodraw', (player) => {
    if (!player.logged) return;
    if ((player.data.adminLevel || 0) < CONFIG.ADMIN_DRAW_LEVEL) {
        player.outputChatBox('!{FF0000}[LOTTO] You do not have permission to use this command.');
        return;
    }
    player.outputChatBox('!{FFD700}[LOTTO] Forcing draw now...');
    executeDraw(player);
});

// ────────────────────────────────────────────────────────────
//  ADMIN COMMAND: /lottostatus — show current state
// ────────────────────────────────────────────────────────────
mp.events.addCommand('lottostatus', async (player) => {
    if (!player.logged) return;
    if ((player.data.adminLevel || 0) < CONFIG.ADMIN_DRAW_LEVEL) return;

    try {
        const [countRow] = await db.query(
            'SELECT COUNT(*) AS cnt FROM lotto_tickets WHERE week_id = ?',
            [state.weekId]
        );
        const tickets = countRow[0].cnt;
        player.outputChatBox(`!{FFD700}[LOTTO] Week #${state.weekId} | Jackpot: $${state.jackpot.toLocaleString()} | Tickets sold: ${tickets} | Next draw: ${state.nextDraw}`);
    } catch (err) {
        player.outputChatBox('!{FF0000}[LOTTO] Could not fetch status.');
    }
});

// ────────────────────────────────────────────────────────────
//  Boot
// ────────────────────────────────────────────────────────────
loadState();
console.log('[LOTTO] System loaded.');