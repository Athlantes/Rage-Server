const db = require('../core/database');
const inventory = require('./inventory'); // Import Inventory System

// Helper to apply appearance (Features only, clothes handled by Inventory)
function applyAppearance(player, app) {
    if (!app) return;
    if (typeof app === 'string') app = JSON.parse(app);

    // 1. Parents
    if(app.parents) {
        player.setHeadBlend(
            app.parents.mother, app.parents.father, 0,
            app.parents.mother, app.parents.father, 0,
            app.shapeMix || 0.5, app.skinMix || 0.5, 0
        );
    }

    // 2. Features
    if(app.features) app.features.forEach((val, index) => player.setFaceFeature(index, parseFloat(val)));

    // 3. Overlays
    if(app.overlays) {
        app.overlays.forEach(ov => {
            player.setHeadOverlay(ov.index, [ov.overlay, ov.opacity, ov.color, ov.secColor]);
        });
    }

    // 4. Hair (Handled here because it's not an item usually, but a feature)
    if(app.hair) {
        player.setClothes(2, app.hair.style, 0, 0);
        player.hairColor = app.hair.color;
        player.hairHighlightColor = app.hair.highlight;
    }

    // 5. Eyes
    if(app.eyes !== undefined) player.eyeColor = app.eyes;
}

mp.events.add('server:creator:save', async (player, dataJson) => {
    if (!player.data.dbId) return;
    
    const data = JSON.parse(dataJson);
    const gender = data.gender;
    const appearance = JSON.stringify(data.appearance);

    // 1. Update Player Memory & Model
    player.data.appearance = data.appearance; 
    player.data.gender = gender;
    
    // Switch model to ensure clothes fit
    player.model = (gender === 0) ? mp.joaat('mp_m_freemode_01') : mp.joaat('mp_f_freemode_01');
    
    // Apply face/hair immediately
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
        // This calculates the Torso, Undershirt, and correct Components based on items.js
        inventory.refreshClothes(player);

        // 5. Finalize
        player.outputChatBox("!{00FF00}Character created successfully!");
        player.logged = true; 
        
        mp.events.call('server:auth:finalized', player);

    } catch (err) {
        console.error("Creator Save Error:", err);
        player.outputChatBox("!{FF0000}Error saving character data.");
    }
});

module.exports = { applyAppearance };

// Re-apply appearance on respawn
mp.events.add('playerSpawn', (player) => {
    if (player.logged && player.data.appearance) {
        applyAppearance(player, player.data.appearance);
        // Inventory load (onPlayerJoin) usually handles clothes, 
        // but we can force it here just in case:
        inventory.refreshClothes(player);
    }
});