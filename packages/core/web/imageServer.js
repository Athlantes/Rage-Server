const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000; // You can change this port if needed
const SAVE_DIR = path.join(__dirname, '../../../client_packages/phone/ui/photos/'); // Saves directly to client_packages so players can see it

// Ensure the directory exists
if (!fs.existsSync(SAVE_DIR)) {
    fs.mkdirSync(SAVE_DIR, { recursive: true });
}

// Middleware
app.use(cors()); // Allow all connections (needed for CEF)
app.use(bodyParser.raw({ type: 'image/png', limit: '10mb' })); // Accept raw PNG data

// Upload Endpoint
app.post('/upload', (req, res) => {
    // 1. Generate a safe filename
    const filename = `photo_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
    const filePath = path.join(SAVE_DIR, filename);

    // 2. Write the binary data to disk
    fs.writeFile(filePath, req.body, (err) => {
        if (err) {
            console.error('Upload Error:', err);
            return res.status(500).json({ error: 'Failed to save image' });
        }

        console.log(`[Phone] Saved new photo: ${filename}`);

        // 3. Return the local URL
        // Since we saved it in client_packages/phone/ui/photos, it is accessible via the "package://" protocol in-game
        // BUT for the database, we might want a relative path or a full URL if you plan to show these on a website later.
        // For now, we return the relative path used by the phone UI.
        const PUBLIC_IP = "26.170.61.66"; 
        res.json({ 
            success: true, 
            url: `http://${PUBLIC_IP}:${PORT}/photos/${filename}` 
        });
    });
});

app.use('/photos', express.static(SAVE_DIR));

// Start the Web Server
app.listen(PORT, () => {
    console.log(`[Phone] Image Upload Server running on port ${PORT}`);
});