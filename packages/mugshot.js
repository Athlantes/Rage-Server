// packages/mugshot.js
const db = require('./core/database');
const { mugshotsDir, baseUrl } = require('./webserver');
const fs   = require('fs');
const path = require('path');

mp.events.add('uploadPlayerHeadshot', (player, image) => {
    if (!player.data || !player.data.dbId || !player.data.username) {
        console.warn('[Mugshot] Player missing data, skipping save.');
        return;
    }

    if (!image) {
        console.warn(`[Mugshot] No image data received from ${player.data.username}.`);
        return;
    }

    const safe     = player.data.username.replace(/[^a-zA-Z0-9_\-]/g, '');
    const filename = `${safe}.jpg`;
    const filepath = path.join(mugshotsDir, filename);

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer     = Buffer.from(base64Data, 'base64');

    fs.writeFile(filepath, buffer, async (err) => {
        if (err) {
            console.error(`[Mugshot] Failed to write file for ${player.data.username}:`, err);
            return;
        }

        const relativePath = `mugshots/${filename}`;

        try {
            await db.query('UPDATE users SET mugshot = ? WHERE id = ?', [relativePath, player.data.dbId]);
            player.data.mugshot = relativePath;
            console.log(`[Mugshot] Saved for ${player.data.username}: ${relativePath}`);

            // Confirm to client (silent — just cleans up any loading state)
            player.call('client:mugshot:saved', []);
        } catch (dbErr) {
            console.error(`[Mugshot] DB update failed for ${player.data.username}:`, dbErr);
        }
    });
});
