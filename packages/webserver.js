// packages/webserver.js
// ─────────────────────────────────────────────────────────────────────────────
//  Web Server — Photo hosting + UCP Presence API
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const path    = require('path');
const cors    = require('cors');
const fs      = require('fs');

const app  = express();
const PORT = 3008;
const IP   = '26.170.61.66';

// ── Secret token so only your UCP can call these endpoints ───────────────────
// Set this same value in your UCP .env.local as RAGEMP_API_SECRET
const API_SECRET = process.env.UCP_API_SECRET || 'change-me-strong-secret';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Middleware: simple token auth for /api/* routes ──────────────────────────
function requireSecret(req, res, next) {
    const token = req.headers['x-api-secret'];
    if (token !== API_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// ── Photo static hosting ─────────────────────────────────────────────────────
const photosDir = path.join(__dirname, '../photos');
if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });
app.use('/photos', express.static(photosDir));

// ── /api/online — returns list of currently logged-in players ────────────────
app.get('/api/online', requireSecret, (req, res) => {
    try {
        const online = [];
        mp.players.forEach((player) => {
            if (!player.logged) return;
            online.push({
                id:        player.data?.dbId   ?? null,
                username:  player.name,
                level:     player.data?.level  ?? 1,
                ping:      player.ping,
                adminLevel: player.data?.adminLevel ?? 0,
            });
        });
        res.json({ count: online.length, players: online, timestamp: Date.now() });
    } catch (err) {
        console.error('[WebServer] /api/online error:', err);
        res.status(500).json({ error: 'Internal error' });
    }
});

app.listen(PORT, () => {
    console.log(`[WebServer] Running at http://${IP}:${PORT}`);
    console.log(`[WebServer] UCP presence API: http://${IP}:${PORT}/api/online`);
});

module.exports = {
    photosDir,
    baseUrl: `http://${IP}:${PORT}/photos/`
};