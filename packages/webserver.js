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

const mugshotsDir = path.join(photosDir, 'mugshots');
if (!fs.existsSync(mugshotsDir)) fs.mkdirSync(mugshotsDir, { recursive: true });

app.use('/photos', express.static(photosDir));

// ── Mugshot upload endpoint ───────────────────────────────────────────────────
app.post('/api/mugshot', (req, res) => {
    try {
        const { base64, filename, dbId } = req.body;
        if (!base64) return res.status(400).json({ error: 'No image data' });

        const safeName = path.basename(filename || `mugshot_${Date.now()}.jpg`);
        const filePath = path.join(mugshotsDir, safeName);

        fs.writeFile(filePath, base64, 'base64', async (err) => {
            if (err) {
                console.error(`[Mugshot] Write Error: ${err.message}`);
                return res.status(500).json({ error: 'Write failed' });
            }
            console.log(`[Mugshot] Saved via HTTP: ${safeName}`);

            // Save to DB directly if dbId was provided
            if (dbId) {
                try {
                    const db = require('./core/database');
                    await db.query('UPDATE users SET mugshot = ? WHERE id = ?', [safeName, dbId]);
                    console.log(`[Mugshot] DB updated for dbId ${dbId}: ${safeName}`);
                    // Also update in-memory data for the online player
                    mp.players.forEach(p => {
                        if (p.data && p.data.dbId === dbId) p.data.mugshot = safeName;
                    });
                } catch (dbErr) {
                    console.error('[Mugshot] DB save error:', dbErr);
                }
            }

            res.json({ success: true, filename: safeName });
        });
    } catch (err) {
        console.error('[Mugshot] POST Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

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
    mugshotsDir,
    baseUrl: `http://${IP}:${PORT}/photos/`,
    mugshotsUrl: `http://${IP}:${PORT}/photos/mugshots/`,
    mugshotUploadUrl: `http://${IP}:${PORT}/api/mugshot`
};