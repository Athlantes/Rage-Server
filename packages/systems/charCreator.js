const db = require('../core/database');

// Helper to apply appearance
function applyAppearance(player, app) {
    if (!app) return;
    if (typeof app === 'string') app = JSON.parse(app);

    if(app.parents) {
        player.setHeadBlend(
            app.parents.mother, app.parents.father, 0,
            app.parents.mother, app.parents.father, 0,
            app.shapeMix || 0.5, app.skinMix || 0.5, 0
        );
    }

    // 3. Features
    if(app.features) app.features.forEach((val, index) => player.setFaceFeature(index, parseFloat(val)));

    // 4. Overlays
    if(app.overlays) {
        app.overlays.forEach(ov => {
            player.setHeadOverlay(ov.index, [ov.overlay, ov.opacity, ov.color, ov.secColor]);
        });
    }

    // 5. Hair
    if(app.hair) {
        player.setClothes(2, app.hair.style, 0, 0);
        player.hairColor = app.hair.color;
        player.hairHighlightColor = app.hair.highlight;
    }

    // 6. Eyes
    if(app.eyes !== undefined) player.eyeColor = app.eyes;
}

mp.events.add('server:creator:save', async (player, dataJson) => {
    if (!player.data.dbId) return;
    
    const data = JSON.parse(dataJson);
    const gender = data.gender;
    const appearance = JSON.stringify(data.appearance);

    // --- FIX: Update Player Memory Immediatey ---
    player.data.appearance = data.appearance; // Save to memory so playerSpawn can read it
    player.data.gender = gender;
    
    // Set the model now to ensure they are the correct gender before clothes apply
    player.model = (gender === 0) ? mp.joaat('mp_m_freemode_01') : mp.joaat('mp_f_freemode_01');
    
    // Apply the appearance immediately so they look right before the spawn animation starts
    applyAppearance(player, data.appearance);
    // --------------------------------------------

    try {
        // 1. Save Appearance & Gender
        await db.query("UPDATE users SET appearance = ?, gender = ? WHERE id = ?", 
            [appearance, gender, player.data.dbId]);

        // 2. Give Selected Clothing Items
        const clothes = data.clothes; 

        const addEquippedItem = async (itemId, slot) => {
            if (!itemId) return;
            // Note: We use the itemId string (e.g. 'm_top_white_tee')
            // The inventory system will look up the texture/drawable from items.js
            await db.query(
                "INSERT INTO character_inventory (character_id, item_id, count, slot, metadata) VALUES (?, ?, 1, ?, '{}')",
                [player.data.dbId, itemId, slot]
            );
        };

        if (clothes.top) await addEquippedItem(clothes.top, -11);
        if (clothes.legs) await addEquippedItem(clothes.legs, -4);
        if (clothes.shoes) await addEquippedItem(clothes.shoes, -6);

        // 3. Finalize
        player.outputChatBox("!{00FF00}Character created successfully!");
        
        // Ensure logged status is true if not already
        player.logged = true; 
        
        mp.events.call('server:auth:finalized', player);

    } catch (err) {
        console.error("Creator Save Error:", err);
    }
});

module.exports = { applyAppearance };

// Re-apply appearance on respawn
mp.events.add('playerSpawn', (player) => {
    if (player.logged && player.data.appearance) {
        applyAppearance(player, player.data.appearance);
    }
});