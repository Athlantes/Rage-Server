// ─────────────────────────────────────────────────────────────────────────────
//  Discord Module Entry — packages/discord/index.js
//  Spawns the Discord bot as a separate process using the system Node.js
//  (RAGE:MP's embedded Node is too old for discord.js v14).
//  Communication via stdin/stdout line-delimited JSON.
// ─────────────────────────────────────────────────────────────────────────────

const { spawn } = require('child_process');
const path = require('path');

let botProcess = null;
let botReady = false;

// ── Spawn the bot process ────────────────────────────────────────────────────
function startBot() {
    const botScript = path.join(__dirname, 'bot-process.js');

    // Use the system Node.js (modern — supports discord.js v14)
    botProcess = spawn('node', [botScript], {
        stdio: ['pipe', 'pipe', 'inherit'], // stdin=pipe, stdout=pipe, stderr=inherit
        cwd: path.resolve(__dirname, '../../'),  // Rage Server root (for node_modules)
        env: Object.assign({}, process.env),
    });

    console.log('[Discord] Bot process spawned (PID: ' + botProcess.pid + ')');

    // Read messages from bot
    let outBuffer = '';
    botProcess.stdout.on('data', (chunk) => {
        outBuffer += chunk.toString();
        const lines = outBuffer.split('\n');
        outBuffer = lines.pop();
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const msg = JSON.parse(line);
                handleBotMessage(msg);
            } catch (e) {
                // Not JSON — regular console output, print it
                console.log('[Discord] ' + line);
            }
        }
    });

    botProcess.on('exit', (code) => {
        botReady = false;
        console.log('[Discord] Bot process exited with code ' + code);
        // Auto-restart after 10 seconds if it crashed
        if (code !== 0) {
            console.log('[Discord] Restarting in 10 seconds...');
            setTimeout(startBot, 10000);
        }
    });

    botProcess.on('error', (err) => {
        console.error('[Discord] Failed to spawn bot process:', err.message);
        console.error('[Discord] Make sure Node.js is installed and in your system PATH.');
    });
}

function handleBotMessage(msg) {
    if (msg.type === 'ready') {
        botReady = true;
        console.log('[Discord] Bot ready: ' + msg.tag);
    }
    else if (msg.type === 'sendLinkPin') {
        // Prefer to find the target by DB id (safer), fall back to username
        let targetPlayer = null;
        if (msg.userId !== undefined && msg.userId !== null) {
            const uid = Number(msg.userId);
            targetPlayer = mp.players.toArray().find(p => p.data && p.data.dbId === uid && p.logged);
        }
        if (!targetPlayer && msg.username) {
            targetPlayer = mp.players.toArray().find(p => p.name === msg.username && p.logged);
        }

        if (targetPlayer) {
            // 1. Short chat hint
            targetPlayer.outputChatBox(`!{00A8FF}[Discord] !{FFFFFF}You received a verification code via email on your phone!`);

            // 2. Use phone system to deliver mail
            mp.events.call('server:phone:sendMail', 
                targetPlayer.data.dbId,               // targetDbId
                'Discord',                            // sender
                'Verify Account',                     // title
                `Hello,\n\nYour verification code is: ${msg.pin}\n\nPlease enter this code in the Discord window to verify your account.\n\nThank you` // message
            );
        } else {
            console.warn('[Discord] sendLinkPin: target player not found (userId:', msg.userId, 'username:', msg.username, ')');
        }
    }
}

// ── Send messages to bot via stdin ───────────────────────────────────────────
function sendToBot(data) {
    if (!botProcess || !botProcess.stdin || botProcess.killed) return;
    try {
        botProcess.stdin.write(JSON.stringify(data) + '\n');
    } catch (e) {
        console.error('[Discord] Failed to send to bot:', e.message);
    }
}

// ── Periodic player list sync ────────────────────────────────────────────────
function syncPlayerList() {
    const players = [];
    mp.players.forEach(p => {
        // FIX: Folosim p.logged conform sistemului tău de Auth
        if (p.logged) {
            players.push({
                id: p.id,
                name: p.name,
                level: (p.data && p.data.level) ? p.data.level : 1,
            });
        }
    });
    sendToBot({ type: 'playerList', players: players });
}

// ── RAGE:MP Events ──────────────────────────────────────────────────────────
mp.events.add('playerJoin', (player) => {
    // Note: playerJoin fires on connection, before login.
    // We log it for early visibility; detailed info comes via admin logs.
    sendToBot({ type: 'playerJoin', name: player.name });
    // Sync player list shortly after join to ensure logged-in state is reflected
    setTimeout(syncPlayerList, 1000);
});

mp.events.add('playerQuit', (player) => {
    sendToBot({
        type: 'playerQuit',
        name: player.name,
        level: (player.data && player.data.level) || 0,
    });
    // Immediate sync on quit
    syncPlayerList();
});

// ── Public API (for other server modules) ────────────────────────────────────
function logAdmin(message, fields) {
    sendToBot({ type: 'adminLog', message: message, fields: fields || [] });
}

function logBan(message, fields) {
    sendToBot({ type: 'banLog', message: message, fields: fields || [] });
}

function logKick(message, fields) {
    sendToBot({ type: 'kickLog', message: message, fields: fields || [] });
}

// ── Start ────────────────────────────────────────────────────────────────────
startBot();

// Sync player list every 30 seconds
setInterval(syncPlayerList, 30000);
// Initial sync after 5 seconds (let players load)
setTimeout(syncPlayerList, 5000);

module.exports = {
    logAdmin: logAdmin,
    logBan: logBan,
    logKick: logKick,
    sendToBot: sendToBot,
    syncPlayerList: syncPlayerList, // Permite actualizarea instantă a jucătorilor (ex: direct la login)
    isReady: function() { return botReady; },
};