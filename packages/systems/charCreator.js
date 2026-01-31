const db = require('../core/database');

// Helper to apply appearance
function applyAppearance(player, app) {
    if (!app) return;
    if (typeof app === 'string') app = JSON.parse(app);

    // 1. Gender Model is handled by spawn, but we ensure features here
    // 2. Parents
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
        player.setHairColor(app.hair.color, app.hair.highlight);
    }

    // 6. Eyes
    if(app.eyes !== undefined) player.setEyeColor(app.eyes);
}

mp.events.add('server:creator:save', async (player, dataJson) => {
    if (!player.data.dbId) return;
    
    const data = JSON.parse(dataJson);
    const gender = data.gender;
    const appearance = JSON.stringify(data.appearance);

    try {
        // 1. Save Appearance & Gender
        await db.query("UPDATE users SET appearance = ?, gender = ? WHERE id = ?", 
            [appearance, gender, player.data.dbId]);

        // 2. Give Selected Clothing Items directly to equipped slots
        // -11: Top, -4: Legs, -6: Shoes
        const clothes = data.clothes; 

        const addEquippedItem = async (itemId, slot) => {
            if (!itemId) return;
            // Insert item into DB at the specific equipment slot. 
            // We use empty metadata because the look is defined in items.js
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