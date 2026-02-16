// packages/mugshot.js
const db = require('./core/database');
const { mugshotsDir } = require('./webserver');
const fs   = require('fs');
const path = require('path');

// Temporary storage for uploads in progress
const uploadQueue = new Map();

mp.events.add('server:mugshot:initUpload', (player, totalChunks) => {
    uploadQueue.set(player.id, {
        chunks: [],
        total: totalChunks,
        count: 0
    });
});

mp.events.add('server:mugshot:receiveChunk', (player, chunk, index) => {
    const upload = uploadQueue.get(player.id);
    if (!upload) return;

    // Store chunk
    upload.chunks[index] = chunk;
    upload.count++;

    // Check if complete
    if (upload.count >= upload.total) {
        const fullBase64 = upload.chunks.join('');
        uploadQueue.delete(player.id); // Clear memory
        processMugshotSave(player, fullBase64);
    }
});

function processMugshotSave(player, imageBase64) {
    if (!player.data || !player.data.dbId || !player.data.username) return;

    const safe     = player.data.username.replace(/[^a-zA-Z0-9_\-]/g, '');
    const filename = `${safe}.jpg`;
    const filepath = path.join(mugshotsDir, filename);
    const buffer   = Buffer.from(imageBase64, 'base64');

    fs.writeFile(filepath, buffer, async (err) => {
        if (err) {
            console.error(`[Mugshot] Write Error:`, err);
            return;
        }

        const relativePath = `mugshots/${filename}`;
        try {
            await db.query('UPDATE users SET mugshot = ? WHERE id = ?', [relativePath, player.data.dbId]);
            player.data.mugshot = relativePath;
            console.log(`[Mugshot] Saved for ${player.data.username}`);
            player.call('client:mugshot:saved');
        } catch (dbErr) {
            console.error(`[Mugshot] DB Error:`, dbErr);
        }
    });
}