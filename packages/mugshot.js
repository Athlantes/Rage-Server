// Mugshot system — upload handled via HTTP POST to webserver /api/mugshot endpoint.
const db = require('./core/database');
const fs = require('fs');

mp.events.add('server:mugshot:saveToDb', async (player, filename) => {
    if (!player.logged || !player.data.dbId) return;
    try {
        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
        await db.query('UPDATE users SET mugshot = ? WHERE id = ?', [safeName, player.data.dbId]);
        player.data.mugshot = safeName;
        console.log(`[Mugshot] DB updated for ${player.name}: ${safeName}`);
    } catch (err) {
        console.error('[Mugshot] DB save error:', err);
    }
});

mp.events.add('server:mugshot:reset', async (player) => {
    if (!player.logged || !player.data.dbId) return;
    try {
        const oldMugshot = player.data.mugshot;
        // Clear in DB
        await db.query('UPDATE users SET mugshot = NULL WHERE id = ?', [player.data.dbId]);
        player.data.mugshot = null;

        // Delete file from disk
        if (oldMugshot) {
            const webServer = require('./webserver');
            const path = require('path');
            const filePath = path.join(webServer.mugshotsDir, oldMugshot);
            try {
                fs.unlinkSync(filePath);
                console.log(`[Mugshot] Deleted file: ${oldMugshot}`);
            } catch (e) {
                console.warn(`[Mugshot] Could not delete file ${oldMugshot}:`, e.message);
            }
        }

        player.call('client:mugshot:resetDone');
        player.outputChatBox('!{FFFF00}Mugshot reset. Rejoin the server to take a new one.');
        console.log(`[Mugshot] Reset for ${player.name}`);
    } catch (err) {
        console.error('[Mugshot] Reset error:', err);
    }
});
// Client CEF crops the headshot and POSTs directly to the webserver.
// See: webserver.js (POST /api/mugshot), client_packages/mugshot.js, client_packages/mugshot/index.html
