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

// Ensure directories exist on startup
if (!fs.existsSync(photosDir))   fs.mkdirSync(photosDir,   { recursive: true });

app.use('/photos', express.static(photosDir));

app.listen(PORT, () => {
    console.log(`[WebServer] Running at http://${IP}:${PORT}/photos/`);
});

module.exports = {
    photosDir,
    baseUrl: `http://${IP}:${PORT}/photos/`
};