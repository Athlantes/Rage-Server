// packages/mugshot.js
const db = require('./core/database');
const { mugshotsDir } = require('./webserver');
const fs   = require('fs');
const path = require('path');

// Temporary storage for uploads in progress
const uploadQueue = new Map();

mp.events.add('server:mugshot:initUpload', (player, totalChunks) => {
    // If there's already an in-progress upload for this player, clear it
    if (uploadQueue.has(player.id)) {
        console.log(`[Mugshot] Reinitialising upload for player ${player.id} (${totalChunks} chunks)`);
    } else {
        console.log(`[Mugshot] Starting upload for player ${player.id} (${totalChunks} chunks)`);
    }

    uploadQueue.set(player.id, {
        chunks:    new Array(totalChunks),
        total:     totalChunks,
        received:  new Set(), // track which indexes arrived so duplicates are ignored
        done:      false
    });
});

mp.events.add('server:mugshot:receiveChunk', (player, chunk, index) => {
    const upload = uploadQueue.get(player.id);
    if (!upload) {
        console.log(`[Mugshot] WARN: receiveChunk from player ${player.id} but no upload in queue (index=${index})`);
        return;
    }
    if (upload.done) {
        console.log(`[Mugshot] WARN: receiveChunk index=${index} from player ${player.id} but upload already done — ignoring`);
        return;
    }

    // Ignore duplicate chunks
    if (upload.received.has(index)) {
        console.log(`[Mugshot] WARN: Duplicate chunk #${index} from player ${player.id} — ignoring`);
        return;
    }

    upload.chunks[index] = chunk;
    upload.received.add(index);

    // Log every 10th chunk so we can see progress without flooding
    if (index % 10 === 0) {
        console.log(`[Mugshot] Chunk #${index} received for player ${player.id} (${upload.received.size}/${upload.total})`);
    }

    // Check if all chunks have arrived
    if (upload.received.size >= upload.total) {
        upload.done = true;
        uploadQueue.delete(player.id);

        const fullBase64 = upload.chunks.join('');
        console.log(`[Mugshot] All ${upload.total} chunks received for player ${player.id}. Base64 length=${fullBase64.length}. Processing...`);
        processMugshotSave(player, fullBase64);
    }
});

function processMugshotSave(player, imageBase64) {
    if (!player || !player.data || !player.data.dbId || !player.data.username) {
        console.error('[Mugshot] processMugshotSave called with invalid player data');
        return;
    }

    // Validate base64 is not empty
    if (!imageBase64 || imageBase64.length === 0) {
        console.error(`[Mugshot] Empty base64 data for player ${player.data.username}`);
        return;
    }

    const safe     = player.data.username.replace(/[^a-zA-Z0-9_\-]/g, '');
    const filename = `${safe}.jpg`;
    const filepath = path.join(mugshotsDir, filename);

    let buffer;
    try {
        buffer = Buffer.from(imageBase64, 'base64');
    } catch (e) {
        console.error(`[Mugshot] Failed to decode base64 for ${player.data.username}:`, e);
        return;
    }

    console.log(`[Mugshot] Writing ${buffer.length} bytes to ${filepath}`);

    if (!fs.existsSync(mugshotsDir)){
        fs.mkdirSync(mugshotsDir, { recursive: true });
    }

    fs.writeFile(filepath, buffer, async (err) => {
        if (err) {
            console.error(`[Mugshot] Write Error for ${player.data.username}:`, err);
            return;
        }

        const relativePath = `mugshots/${filename}`;
        try {
            await db.query('UPDATE users SET mugshot = ? WHERE id = ?', [relativePath, player.data.dbId]);
            player.data.mugshot = relativePath;
            console.log(`[Mugshot] Saved for ${player.data.username} → ${relativePath}`);
            player.call('client:mugshot:saved');
        } catch (dbErr) {
            console.error(`[Mugshot] DB Error for ${player.data.username}:`, dbErr);
        }
    });
}