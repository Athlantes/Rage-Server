const db = require('../core/database');
const inventory = require('./inventory');
const classManager = require('./classManager');

// Helper to apply appearance (Features, overlays, hair, eyes - clothes handled by Inventory)
function applyAppearance(player, app) {
    if (!app) return;
    if (typeof app === 'string') {
        try { app = JSON.parse(app); } catch(e) { console.error('[Creator] Invalid appearance JSON:', e); return; }
    }

    // 1. Parents / Head Blend
    if (app.parents) {
        player.setHeadBlend(
            app.parents.mother, app.parents.father, 0,
            app.parents.mother, app.parents.father, 0,
            app.shapeMix || 0.5, app.skinMix || 0.5, 0
        );
    }

    // 2. Face Features (20 features, index 0-19)
    if (app.features && Array.isArray(app.features)) {
        app.features.forEach((val, index) => {
            if (index < 20) player.setFaceFeature(index, parseFloat(val));
        });
    }

    // 3. Overlays (Eyebrows, Facial Hair, Blemishes, Ageing, Makeup, etc.)
    if (app.overlays && Array.isArray(app.overlays)) {
        // First clear all overlay slots to prevent stale data
        for (let i = 0; i < 12; i++) {
            player.setHeadOverlay(i, [255, 0.0, 0, 0]);
        }
        // Then apply saved overlays
        app.overlays.forEach(ov => {
            if (ov.overlay === 0) return; // Skip cleared overlays
            player.setHeadOverlay(ov.index, [ov.overlay, ov.opacity, ov.color || 0, ov.secColor || 0]);
        });
    }

    // 4. Hair (component 2)
    if (app.hair) {
        player.setClothes(2, app.hair.style, 0, 0);
        player.hairColor = app.hair.color;
        player.hairHighlightColor = app.hair.highlight || 0;
    }

    // 5. Eyes
    if (app.eyes !== undefined) player.eyeColor = app.eyes;
}

mp.events.add('server:creator:save', async (player, dataJson) => {
    if (!player.data.dbId) return;

    let data;
    try {
        data = JSON.parse(dataJson);
    } catch(e) {
        console.error('[Creator] Invalid save data:', e);
        player.outputChatBox("!{FF0000}Error: Invalid character data.");
        return;
    }

    const gender = data.gender;
    const appearance = JSON.stringify(data.appearance);

    // 1. Update Player Memory & Model
    player.data.appearance = data.appearance;
    player.data.gender = gender;

    player.model = (gender === 0) ? mp.joaat('mp_m_freemode_01') : mp.joaat('mp_f_freemode_01');

    // Apply face/hair/overlays immediately
    applyAppearance(player, data.appearance);

    try {
        // 2. Save User Appearance Data
        await db.query("UPDATE users SET appearance = ?, gender = ? WHERE id = ?", 
            [appearance, gender, player.data.dbId]);

        // 3. Process Clothing Items
        // We use the Inventory System logic to give items into Equipment Slots.
        // Slots: -11 (Top), -4 (Legs), -6 (Shoes)
        const clothes = data.clothes; 
        
        // Initialize inventory array if missing
        if (!player.inventory) player.inventory = [];

        const giveStartingItem = async (itemId, slot) => {
            if (!itemId) return;

            // Insert into Database
            const [result] = await db.query(
                "INSERT INTO character_inventory (character_id, item_id, count, slot, metadata) VALUES (?, ?, 1, ?, '{}')",
                [player.data.dbId, itemId, slot]
            );

            // Add to Live Inventory (Memory)
            // This ensures we don't need to relog to see the items
            player.inventory.push({
                id: result.insertId,
                itemId: itemId,
                count: 1,
                slot: slot,
                data: {} // No custom data needed, items.js handles the look
            });
        };

        // Add items sequentially
        if (clothes.top) await giveStartingItem(clothes.top, -11);
        if (clothes.legs) await giveStartingItem(clothes.legs, -4);
        if (clothes.shoes) await giveStartingItem(clothes.shoes, -6);

        // 4. Apply Visuals via Inventory System
        inventory.refreshClothes(player);

        // 5. Finalize
        player.outputChatBox("!{00FF00}Character created successfully!");
        player.logged = true;

        // 6. Always show class selector for new characters
        // (They won't have classData yet)
        setTimeout(() => {
            if (mp.players.exists(player)) {
                console.log('[Creator] ========== SENDING CLASS SELECTOR START ==========');
                console.log('[Creator] About to call client:classSelector:start for ' + player.name);
                player.call('client:classSelector:start');
                console.log('[Creator] Called client:classSelector:start for ' + player.name);
                console.log('[Creator] ========== CLASS SELECTOR START SENT ==========');
            } else {
                console.log('[Creator] ERROR: Player no longer exists when trying to show class selector');
            }
        }, 1000);

        // Signal client to capture mugshot once the player spawns.
        // Delay to let the character model fully render after creator finishes.
        const webServer = require('../webserver');
        setTimeout(() => {
            if (mp.players.exists(player)) {
                player.call('prepareScreenshot', [webServer.mugshotUploadUrl, player.data.dbId]);
            }
        }, 5000);

        // DO NOT call auth:finalized here - it will be called after class selection
        // mp.events.call('server:auth:finalized', player);

    } catch (err) {
        console.error("[Creator] Save Error:", err);
        player.outputChatBox("!{FF0000}Error saving character data. Please try again.");
    }
});

module.exports = { applyAppearance };

// Re-apply appearance on respawn
mp.events.add('playerSpawn', (player) => {
    if (player.logged && player.data.appearance) {
        // Restore model first
        const expectedModel = (player.data.gender === 0) ? mp.joaat('mp_m_freemode_01') : mp.joaat('mp_f_freemode_01');
        if (player.model !== expectedModel) player.model = expectedModel;

        applyAppearance(player, player.data.appearance);
        inventory.refreshClothes(player);
    }
});