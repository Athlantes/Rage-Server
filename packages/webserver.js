// packages/webserver.js
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3008; // You can change this port
const IP = '26.170.61.66';

// Enable CORS so the in-game phone (CEF) can load images
app.use(cors());

// Define where photos are stored on your hard drive
// This creates a folder named "photos" in the root of your server directory (next to rage-server.exe)
const photosDir = path.join(__dirname, '../photos');

// Serve the folder as static files
app.use('/photos', express.static(photosDir));

app.listen(PORT, () => {
    console.log(`[WebServer] Image hosting running at http://${IP}:${PORT}/photos/`);
});

// Export the path so other scripts know where to save files
module.exports = {
    photosDir: photosDir,
    baseUrl: `http://${IP}:${PORT}/photos/`
};