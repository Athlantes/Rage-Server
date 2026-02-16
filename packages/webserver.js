// packages/webserver.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = 3008;
const IP = '26.170.61.66';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const photosDir   = path.join(__dirname, '../photos');
const mugshotsDir = path.join(photosDir, 'mugshots');

// Ensure directories exist on startup
if (!fs.existsSync(photosDir))   fs.mkdirSync(photosDir,   { recursive: true });
if (!fs.existsSync(mugshotsDir)) fs.mkdirSync(mugshotsDir, { recursive: true });

// Serve static photos (includes /photos/mugshots/*)
app.use('/photos', express.static(photosDir));

// --- Mugshot upload endpoint ---
// POST /photos/mugshots/upload
// Body JSON: { username: string, image: string }  (image = base64 data URI)
app.post('/photos/mugshots/upload', (req, res) => {
    const { username, image } = req.body;

    if (!username || !image) {
        return res.status(400).json({ error: 'Missing username or image.' });
    }

    // Strip any non-safe characters from the username before using as filename
    const safe = username.replace(/[^a-zA-Z0-9_\-]/g, '');
    if (!safe) return res.status(400).json({ error: 'Invalid username.' });

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const filename = `${safe}.jpg`;
    const filepath = path.join(mugshotsDir, filename);

    fs.writeFile(filepath, buffer, (err) => {
        if (err) {
            console.error('[WebServer] Failed to save mugshot:', err);
            return res.status(500).json({ error: 'Failed to save image.' });
        }
        const url = `http://${IP}:${PORT}/photos/mugshots/${filename}`;
        console.log(`[WebServer] Mugshot saved: ${url}`);
        res.json({ url, relativePath: `mugshots/${filename}` });
    });
});

app.listen(PORT, () => {
    console.log(`[WebServer] Running at http://${IP}:${PORT}/photos/`);
    console.log(`[WebServer] Mugshot upload: POST http://${IP}:${PORT}/photos/mugshots/upload`);
});

module.exports = {
    photosDir,
    mugshotsDir,
    baseUrl: `http://${IP}:${PORT}/photos/`
};