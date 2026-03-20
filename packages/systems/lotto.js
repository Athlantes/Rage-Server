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
    // ── Subject line ──
    let title;
    if      (matches === 6) title = `🏆 JACKPOT! Draw #${weekId}`;
    else if (matches >= 3)  title = `🎉 ${matches} matches — Draw #${weekId}`;
    else                    title = `🎰 Draw #${weekId} Results`;

    // ── Determine outcome style ──
    const isJackpot = matches === 6;
    const isWin     = matches >= 3;

    const drawnSet = new Set(drawnNums);
    const pickedSet = new Set(pickedNums);

    // Build number pill HTML — highlight matching numbers
    function numPills(nums, highlight) {
        return nums.map(n => {
            const hit = highlight && drawnSet.has(n);
            const style = hit
                ? 'background:#FFD700;color:#1a1200;font-weight:700;'
                : 'background:#f0f0f0;color:#444;';
            return `<span style="display:inline-block;${style}border-radius:50%;width:30px;height:30px;line-height:30px;text-align:center;font-size:12px;font-family:monospace;margin:2px;">${n}</span>`;
        }).join('');
    }

    // Winning numbers — highlight ones that match player picks
    function drawnPills(nums) {
        return nums.map(n => {
            const hit = pickedSet.has(n);
            const style = hit
                ? 'background:#FFD700;color:#1a1200;font-weight:700;'
                : 'background:#f0f0f0;color:#444;';
            return `<span style="display:inline-block;${style}border-radius:50%;width:30px;height:30px;line-height:30px;text-align:center;font-size:12px;font-family:monospace;margin:2px;">${n}</span>`;
        }).join('');
    }

    // Result banner
    let resultBg, resultColor, resultIcon, resultText;
    if (isJackpot) {
        resultBg = '#1a1200'; resultColor = '#FFD700';
        resultIcon = '🏆';
        resultText = `JACKPOT! All 6 matched — <strong>$${prize.toLocaleString()}</strong> deposited to your account.`;
    } else if (matches === 5) {
        resultBg = '#0d2d0d'; resultColor = '#3dd68c';
        resultIcon = '🎉';
        resultText = `5 numbers matched — <strong>$${prize.toLocaleString()}</strong> deposited to your account.`;
    } else if (matches === 4) {
        resultBg = '#0d2018'; resultColor = '#3dd68c';
        resultIcon = '✅';
        resultText = `4 numbers matched — <strong>$${prize.toLocaleString()}</strong> deposited to your account.`;
    } else if (matches === 3) {
        resultBg = '#1a1400'; resultColor = '#c9a84c';
        resultIcon = '✅';
        resultText = `3 numbers matched — your bet of <strong>$${prize.toLocaleString()}</strong> returned.`;
    } else {
        resultBg = '#1a1a1a'; resultColor = '#888';
        resultIcon = '😔';
        resultText = `No significant matches this week — better luck next time!`;
    }

    const headerBg    = isJackpot ? '#1a1200' : '#0f1923';
    const headerColor = isJackpot ? '#FFD700'  : '#c9a84c';

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

async function loadState() {
    try {
        const [rows] = await db.query('SELECT * FROM lotto_state WHERE id = 1');
        if (rows.length === 0) return;
        state.weekId    = rows[0].week_id;
        state.jackpot   = rows[0].jackpot;
        state.nextDraw  = new Date(rows[0].next_draw);
        console.log(`[LOTTO] Loaded — week #${state.weekId}, jackpot $${state.jackpot}, next draw UTC: ${state.nextDraw}`);
        scheduleDrawTimer();
    } catch (err) { console.error('[LOTTO] Failed to load state:', err); }
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

    // Broadcast cinematic draw overlay to all connected players
    const drawPayload = {
        weekId: state.weekId,
        balls:  pool,
        jackpot: state.jackpot,
    };
    mp.players.forEach(p => {
        if (p.logged) p.call('client:lotto:drawStart', [JSON.stringify(drawPayload)]);
    });
    await delay(CONFIG.BALL_DELAY_MS * pool.length + 4000); // wait for the overlay animation

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
            } else if (matches === 4) {
                prize = bet * CONFIG.PRIZE_4_MULTIPLIER;
                await awardPrize(ticket.player_id, prize, `Lotto 4/6 win — week #${state.weekId}`);
            } else if (matches === 3) {
                prize = bet * CONFIG.PRIZE_3_MULTIPLIER;
                await awardPrize(ticket.player_id, prize, `Lotto 3/6 win — week #${state.weekId}`);
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
        }
        for (const r of ticketResults) { if (r.matches === 6) r.prize = jackpotShare; }
        state.jackpot = 0;
    }

    await db.query('INSERT INTO lotto_draws (week_id, drawn_numbers, jackpot, jackpot_won) VALUES (?, ?, ?, ?)',
        [state.weekId, drawnStr, state.jackpot, jackpotWon ? 1 : 0]
    );

    state.weekId  += 1;
    state.nextDraw = nextDrawDate();
    await db.query('UPDATE lotto_state SET week_id = ?, jackpot = ?, next_draw = ? WHERE id = 1',
        [state.weekId, state.jackpot, toMysqlDatetime(state.nextDraw)]
    );

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
        player.outputChatBox('!{FF0000}[LOTTO] Server error. Try again later.');
    }
});

mp.events.add('server:lotto:buyTicket', async (player, numbersJson, betRaw) => {
    if (!player.logged) return;
    if (isRateLimited(player, 'lotto:buy', 2, 5000)) return;

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
        const [countRow] = await db.query('SELECT COUNT(*) AS cnt FROM lotto_tickets WHERE week_id = ?', [state.weekId]);
        player.outputChatBox(`!{FFD700}[LOTTO] Week #${state.weekId} | Jackpot: $${state.jackpot.toLocaleString()} | Tickets: ${countRow[0].cnt} | Next UTC: ${state.nextDraw.toISOString().slice(0, 16)}`);
    } catch (err) {
        player.outputChatBox('!{FF0000}[LOTTO] Could not fetch status.');
    }
});

loadState();
console.log('[LOTTO] System loaded.');