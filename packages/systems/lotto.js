// ============================================================
//  packages/systems/lotto.js
//  6/49 Lotto System — Server Side (v2.0)
// ============================================================

const db            = require('../core/database');
const playerManager = require('../core/playerManager');
const { isRateLimited } = require('../core/rateLimit');

// ────────────────────────────────────────────────────────────
//  CONFIG
// ────────────────────────────────────────────────────────────
const CONFIG = {
    MIN_BET:          100,
    MAX_BET:          10_000,
    NUMBERS_POOL:     49,
    PICK_COUNT:       6,
    MAX_TICKETS:      3,             // [IMPROVEMENT] Max 3 tickets per week

    PRIZE_3_MULTIPLIER: 1,           
    PRIZE_4_MULTIPLIER: 5,           
    PRIZE_5_MULTIPLIER: 20,          

    ADMIN_DRAW_LEVEL: 3,

    // [IMPROVEMENT] Using UTC Timezone to prevent host migration bugs
    DRAW_DAY_OF_WEEK: 6,             // Saturday = 6
    DRAW_HOUR_UTC:    18,            // 18:00 UTC = 20:00 Romania Time
    DRAW_MINUTE:      0,
    
    BALL_DELAY_MS:    3000           // [IMPROVEMENT] 3 seconds suspense between balls
};

let state = {
    weekId:   1,
    jackpot:  0,
    nextDraw: null,
};

let stateLoadPromise = null;

// ────────────────────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────────────────────

function parseNumbers(str) { return str.split(',').map(Number); }
function serializeNumbers(arr) { return [...arr].sort((a, b) => a - b).join(','); }
function countMatches(ticket, drawn) {
    const drawnSet = new Set(drawn);
    return ticket.filter(n => drawnSet.has(n)).length;
}
const delay = (ms) => new Promise(res => setTimeout(res, ms));

// [IMPROVEMENT] Secure UTC Time calculation
function nextDrawDate() {
    const now = new Date();
    const day = now.getUTCDay();
    let daysUntil = (CONFIG.DRAW_DAY_OF_WEEK - day + 7) % 7;
    
    if (daysUntil === 0 && (now.getUTCHours() >= CONFIG.DRAW_HOUR_UTC && now.getUTCMinutes() >= CONFIG.DRAW_MINUTE)) {
        daysUntil = 7;
    }
    
    const target = new Date(now);
    target.setUTCDate(now.getUTCDate() + daysUntil);
    target.setUTCHours(CONFIG.DRAW_HOUR_UTC, CONFIG.DRAW_MINUTE, 0, 0);
    return target;
}

function toMysqlDatetime(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

function isValidDate(date) {
    return date instanceof Date && !Number.isNaN(date.getTime());
}

function broadcast(msg) {
    mp.players.forEach(p => p.outputChatBox(msg));
}

async function awardPrize(playerId, amount, reason) {
    const online = mp.players.toArray().find(p => p.logged && p.data.dbId === playerId);
    if (online) {
        await playerManager.addMoneyAndSave(online, amount, reason);
        online.call('client:lotto:prizeNotification', [amount, reason]);
    } else {
        await db.query('UPDATE users SET money = money + ? WHERE id = ?', [amount, playerId]);
    }
}

function sendLottoMail(playerId, pickedNums, drawnNums, matches, bet, prize, weekId, nextJackpot) {
    let title = matches >= 3 ? `🎉 You matched ${matches} numbers! Draw #${weekId}` : `🎰 Lotto Draw #${weekId} Results`;
    if (matches === 6) title = `🏆 JACKPOT! Lotto Draw #${weekId} Results`;

    const pickedStr = pickedNums.join('  ·  ');
    const drawnStr  = drawnNums.join('  ·  ');

    let resultLine = matches >= 3 
        ? `✅ You matched ${matches} out of 6 numbers.\nPrize awarded: $${prize.toLocaleString()}`
        : `No significant matches this week — better luck next time!`;
    
    if (matches === 6) resultLine = `✅ JACKPOT! You matched all 6 numbers!\nPrize awarded: $${prize.toLocaleString()}`;

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
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    mp.events.call('server:phone:sendMail', playerId, 'Lotto 6/49', title, message);
}

async function loadState() {
    try {
        const [rows] = await db.query('SELECT * FROM lotto_state WHERE id = 1');
        if (rows.length === 0) {
            state.weekId = 1;
            state.jackpot = 0;
            state.nextDraw = nextDrawDate();

            await db.query(
                'INSERT INTO lotto_state (id, week_id, jackpot, next_draw) VALUES (1, ?, ?, ?)',
                [state.weekId, state.jackpot, toMysqlDatetime(state.nextDraw)]
            );

            console.log(`[LOTTO] State initialized — week #${state.weekId}, jackpot $${state.jackpot}, next draw UTC: ${state.nextDraw}`);
            scheduleDrawTimer();
            return;
        }

        state.weekId = Number(rows[0].week_id) || 1;
        state.jackpot = Number(rows[0].jackpot) || 0;

        const parsedNextDraw = rows[0].next_draw ? new Date(rows[0].next_draw) : null;
        if (isValidDate(parsedNextDraw)) {
            state.nextDraw = parsedNextDraw;
        } else {
            state.nextDraw = nextDrawDate();
            await db.query('UPDATE lotto_state SET next_draw = ? WHERE id = 1', [toMysqlDatetime(state.nextDraw)]);
        }

        console.log(`[LOTTO] Loaded — week #${state.weekId}, jackpot $${state.jackpot}, next draw UTC: ${state.nextDraw}`);
        scheduleDrawTimer();
    } catch (err) { console.error('[LOTTO] Failed to load state:', err); }
}

async function ensureStateLoaded() {
    if (isValidDate(state.nextDraw)) return;

    if (!stateLoadPromise) {
        stateLoadPromise = loadState().finally(() => {
            stateLoadPromise = null;
        });
    }

    await stateLoadPromise;

    if (!isValidDate(state.nextDraw)) {
        state.nextDraw = nextDrawDate();
    }
}

let drawTimer = null;
function scheduleDrawTimer() {
    if (drawTimer) clearInterval(drawTimer);
    drawTimer = setInterval(() => {
        if (new Date() >= state.nextDraw) {
            clearInterval(drawTimer);
            drawTimer = null;
            executeDraw();
        }
    }, 60_000);
}

// ────────────────────────────────────────────────────────────
//  CORE: Execute Draw
// ────────────────────────────────────────────────────────────
async function executeDraw(forcedBy = null) {
    console.log(`[LOTTO] Draw starting for week #${state.weekId}...`);

    const pool = [];
    while (pool.length < CONFIG.PICK_COUNT) {
        const n = Math.floor(Math.random() * CONFIG.NUMBERS_POOL) + 1;
        if (!pool.includes(n)) pool.push(n);
    }
    pool.sort((a, b) => a - b);
    const drawnStr = serializeNumbers(pool);

    // [IMPROVEMENT] Suspenseful Chat Reveal
    broadcast(`!{FFD700}╔══════════════════════════════╗`);
    broadcast(`!{FFD700}║   🎰  LOTTO 6/49 — DRAW #${state.weekId}  ║`);
    broadcast(`!{FFD700}╚══════════════════════════════╝`);
    broadcast(`!{AAAAAA}The draw machine is mixing the balls...`);

    for (let i = 0; i < pool.length; i++) {
        await delay(CONFIG.BALL_DELAY_MS);
        broadcast(`!{FFFFFF}Ball #${i + 1} is... !{FFD700}[ ${pool[i]} ]`);
    }
    
    await delay(2000);
    broadcast(`!{FFFFFF}Winning numbers: !{FFD700}${pool.join('  -  ')}`);
    broadcast(`!{AAAAAA}Jackpot pool: !{00FF88}$${state.jackpot.toLocaleString()}`);

    const [tickets] = await db.query(
        'SELECT t.*, u.username FROM lotto_tickets t JOIN users u ON u.id = t.player_id WHERE t.week_id = ?',
        [state.weekId]
    );

    let jackpotWinners = [];
    const ticketResults = [];

    // [IMPROVEMENT] Batch Processing (Yielding to event loop to prevent server lag)
    const BATCH_SIZE = 500;
    for (let i = 0; i < tickets.length; i += BATCH_SIZE) {
        const batch = tickets.slice(i, i + BATCH_SIZE);

        for (const ticket of batch) {
            const picked  = parseNumbers(ticket.numbers);
            const matches = countMatches(picked, pool);
            const bet     = ticket.bet;
            let   prize   = 0;

            if (matches === 6) {
                jackpotWinners.push(ticket);
            } else if (matches === 5) {
                prize = bet * CONFIG.PRIZE_5_MULTIPLIER;
                await awardPrize(ticket.player_id, prize, `Lotto 5/6 win — week #${state.weekId}`);
                broadcast(`!{00FF88}🎉 ${ticket.username} matched 5 numbers and won !{FFD700}$${prize.toLocaleString()}!`);
            } else if (matches === 4) {
                prize = bet * CONFIG.PRIZE_4_MULTIPLIER;
                await awardPrize(ticket.player_id, prize, `Lotto 4/6 win — week #${state.weekId}`);
                broadcast(`!{88FF88}🎉 ${ticket.username} matched 4 numbers and won !{FFD700}$${prize.toLocaleString()}!`);
            } else if (matches === 3) {
                prize = bet * CONFIG.PRIZE_3_MULTIPLIER;
                await awardPrize(ticket.player_id, prize, `Lotto 3/6 win — week #${state.weekId}`);
                broadcast(`!{AAAAAA}🎉 ${ticket.username} matched 3 numbers and won back their ticket (!{FFD700}$${prize.toLocaleString()}!{AAAAAA})!`);
            }
            ticketResults.push({ ticket, picked, matches, prize });
        }
        await new Promise(res => setImmediate(res)); // Yield to Node.js Event Loop
    }

    // Handle Jackpot
    let jackpotWon = false;
    let jackpotShare = 0;

    if (jackpotWinners.length > 0) {
        jackpotWon = true;
        jackpotShare = Math.floor(state.jackpot / jackpotWinners.length);
        for (const w of jackpotWinners) {
            await awardPrize(w.player_id, jackpotShare, `Lotto JACKPOT — week #${state.weekId}`);
            broadcast(`!{FFD700}🏆🏆 JACKPOT! ${w.username} matched ALL 6 numbers and won !{00FF88}$${jackpotShare.toLocaleString()}! 🏆🏆`);
        }
        for (const r of ticketResults) { if (r.matches === 6) r.prize = jackpotShare; }
        state.jackpot = 0;
    } else {
        broadcast(`!{FF8844}No jackpot winner this week. The pool of !{FFD700}$${state.jackpot.toLocaleString()} !{FF8844}rolls over to next week!`);
    }

    await db.query('INSERT INTO lotto_draws (week_id, drawn_numbers, jackpot, jackpot_won) VALUES (?, ?, ?, ?)',
        [state.weekId, drawnStr, state.jackpot, jackpotWon ? 1 : 0]
    );

    state.weekId  += 1;
    state.nextDraw = nextDrawDate();
    await db.query('UPDATE lotto_state SET week_id = ?, jackpot = ?, next_draw = ? WHERE id = 1',
        [state.weekId, state.jackpot, toMysqlDatetime(state.nextDraw)]
    );

    broadcast(`!{AAAAAA}Next draw: !{FFFFFF}Saturday at 20:00. Good luck!`);
    broadcast(`!{FFD700}══════════════════════════════════`);

    for (const r of ticketResults) {
        sendLottoMail(r.ticket.player_id, r.picked, pool, r.matches, r.ticket.bet, r.prize, state.weekId - 1, state.jackpot);
    }

    if (forcedBy) forcedBy.outputChatBox(`!{00FF00}[LOTTO] Draw executed successfully.`);
    scheduleDrawTimer();
}

// ────────────────────────────────────────────────────────────
//  EVENTS
// ────────────────────────────────────────────────────────────
mp.events.add('server:lotto:requestOpen', async (player) => {
    if (!player.logged) return;
    if (isRateLimited(player, 'lotto:open', 3, 3000)) return;

    try {
        await ensureStateLoaded();

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
            maxTickets:    CONFIG.MAX_TICKETS,
            nextDraw:      state.nextDraw.toISOString(),
            playerCash:    player.data.money || 0,
            ticketsBought: rows.length,
            existingTickets: rows // array of {numbers, bet}
        };

        player.call('client:lotto:openUI', [JSON.stringify(payload)]);
    } catch (err) {
        console.error(`[LOTTO] requestOpen error for ${player.name} (${player.data?.dbId || 'n/a'}):`, err);
        player.outputChatBox('!{FF0000}[LOTTO] Server error. Try again later.');
    }
});

mp.events.add('server:lotto:buyTicket', async (player, numbersJson, betRaw) => {
    if (!player.logged) return;
    if (isRateLimited(player, 'lotto:buy', 2, 5000)) return;

    try {
        await ensureStateLoaded();
    } catch (err) {
        console.error(`[LOTTO] buyTicket state load error for ${player.name} (${player.data?.dbId || 'n/a'}):`, err);
        return player.call('client:lotto:error', ['Server sync error. Please try again.']);
    }

    const bet = parseInt(betRaw);
    if (isNaN(bet) || bet < CONFIG.MIN_BET || bet > CONFIG.MAX_BET) {
        return player.call('client:lotto:error', ['Invalid bet amount.']);
    }

    let numbers;
    try { numbers = JSON.parse(numbersJson); } 
    catch { return player.call('client:lotto:error', ['Invalid numbers data.']); }

    if (!Array.isArray(numbers) || numbers.length !== CONFIG.PICK_COUNT || new Set(numbers).size !== CONFIG.PICK_COUNT || numbers.some(n => !Number.isInteger(n) || n < 1 || n > CONFIG.NUMBERS_POOL)) {
        return player.call('client:lotto:error', ['Invalid number selection.']);
    }

    if ((player.data.money || 0) < bet) {
        return player.call('client:lotto:error', ['Not enough cash.']);
    }

    // [IMPROVEMENT] SQL Transaction for safe database insertions
    let conn;
    try {
        const [existing] = await db.query('SELECT id FROM lotto_tickets WHERE player_id = ? AND week_id = ?', [player.data.dbId, state.weekId]);
        if (existing.length >= CONFIG.MAX_TICKETS) {
            return player.call('client:lotto:error', [`You reached the maximum of ${CONFIG.MAX_TICKETS} tickets this week.`]);
        }

        conn = await db.getConnection(); // Assuming your db module exposes connection pool
        await conn.beginTransaction();

        // 1. Deduct money safely directly in DB
        const [updateRes] = await conn.query('UPDATE users SET money = money - ? WHERE id = ? AND money >= ?', [bet, player.data.dbId, bet]);
        if (updateRes.affectedRows === 0) {
            await conn.rollback();
            return player.call('client:lotto:error', ['Payment failed or insufficient funds.']);
        }

        // 2. Add to Jackpot
        state.jackpot += bet;
        await conn.query('UPDATE lotto_state SET jackpot = ? WHERE id = 1', [state.jackpot]);

        // 3. Save Ticket
        const sorted = serializeNumbers(numbers);
        await conn.query('INSERT INTO lotto_tickets (player_id, week_id, numbers, bet) VALUES (?, ?, ?, ?)', [player.data.dbId, state.weekId, sorted, bet]);

        await conn.commit();
        
        // Update in-memory player money
        player.data.money -= bet;

        player.call('client:lotto:ticketConfirmed', [sorted, bet, state.jackpot]);
        console.log(`[LOTTO] ${player.name} bought ticket [${sorted}] for $${bet} (week #${state.weekId})`);

    } catch (err) {
        if (conn) await conn.rollback();
        console.error('[LOTTO] buyTicket error:', err);
        player.call('client:lotto:error', ['Transaction error. Please try again.']);
    } finally {
        if (conn) conn.release();
    }
});

// Admin Commands
mp.events.addCommand('lottodraw', (player) => {
    if (!player.logged || (player.data.adminLevel || 0) < CONFIG.ADMIN_DRAW_LEVEL) return player.outputChatBox('!{FF0000}[LOTTO] No permission.');
    player.outputChatBox('!{FFD700}[LOTTO] Forcing draw now...');
    executeDraw(player);
});

mp.events.addCommand('lottostatus', async (player) => {
    if (!player.logged || (player.data.adminLevel || 0) < CONFIG.ADMIN_DRAW_LEVEL) return;
    try {
        await ensureStateLoaded();
        const [countRow] = await db.query('SELECT COUNT(*) AS cnt FROM lotto_tickets WHERE week_id = ?', [state.weekId]);
        player.outputChatBox(`!{FFD700}[LOTTO] Week #${state.weekId} | Jackpot: $${state.jackpot.toLocaleString()} | Tickets: ${countRow[0].cnt} | Next UTC: ${state.nextDraw.toISOString().slice(0, 16)}`);
    } catch (err) {
        player.outputChatBox('!{FF0000}[LOTTO] Could not fetch status.');
    }
});

ensureStateLoaded().catch((err) => {
    console.error('[LOTTO] Initial state bootstrap failed:', err);
});
console.log('[LOTTO] System loaded.');