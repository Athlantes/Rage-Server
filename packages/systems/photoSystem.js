// packages/systems/photoSystem.js
const fs = require('fs');
const path = require('path');
const db = require('../core/database');

// Temp storage for upload chunks
const uploadCache = new Map();

mp.events.add('server:photo:init', (player, totalChunks) => {
    uploadCache.set(player.id, {
        chunks: new Array(totalChunks),
        total: totalChunks,
        received: 0
    });
});

mp.events.add('server:photo:chunk', (player, data, index) => {
    const upload = uploadCache.get(player.id);
    if (!upload) return;

    upload.chunks[index] = data;
    upload.received++;
});

mp.events.add('server:photo:finish', async (player) => {
    const upload = uploadCache.get(player.id);
    if (!upload || upload.received !== upload.total) {
        console.log(`[Photo] Upload failed for ${player.name}. Incomplete data.`);
        return;
    }

    // Combine chunks
    const base64Image = upload.chunks.join('');
    uploadCache.delete(player.id); // Clear memory

    // Define path
    // We save into client_packages/ui/auth/images/avatars/ so it can be loaded by the login screen
    // Make sure this folder exists!
    const folderPath = path.join(__dirname, '../../client_packages/ui/auth/images/avatars/');
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    const filename = `${player.name}_headshot.png`;
    const filePath = path.join(folderPath, filename);

    // Save to disk
    try {
        const buffer = Buffer.from(base64Image, 'base64');
        fs.writeFileSync(filePath, buffer);
        console.log(`[Photo] Saved headshot for ${player.name}`);

        // Update Database
        if (player.data.dbId) {
            // Relative path for HTML to load
            const relativePath = `images/avatars/${filename}`;
            await db.query("UPDATE users SET avatar_url = ? WHERE id = ?", [relativePath, player.data.dbId]);
            
            // Notify player
            player.outputChatBox("!{00FF00}Profile picture updated!");
        }
    } catch (err) {
        console.error("[Photo] Save error:", err);
    }
});