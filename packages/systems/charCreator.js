const db = require('../core/database');
const inventory = require('./inventory');
const classManager = require('./classManager');

function applyAppearance(player, app) {
    if (!app) return;
    if (typeof app === 'string') {
        try { app = JSON.parse(app); } catch(e) { return; }
    }

    if (app.parents) {
        player.setHeadBlend(
            app.parents.mother, app.parents.father, 0,
            app.parents.mother, app.parents.father, 0,
            app.shapeMix || 0.5, app.skinMix || 0.5, 0
        );
    }

    if (app.features && Array.isArray(app.features)) {
        app.features.forEach((val, index) => {
            if (index < 20) player.setFaceFeature(index, parseFloat(val));
        });
    }

    if (app.overlays && Array.isArray(app.overlays)) {
        for (let i = 0; i < 12; i++) {
            player.setHeadOverlay(i, [255, 0.0, 0, 0]);
        }
        app.overlays.forEach(ov => {
            if (ov.overlay === 0) return;
            player.setHeadOverlay(ov.index, [ov.overlay, ov.opacity, ov.color || 0, ov.secColor || 0]);
        });
    }

    if (app.hair) {
        player.setClothes(2, app.hair.style, 0, 0);
        player.hairColor = app.hair.color;
        player.hairHighlightColor = app.hair.highlight || 0;
    }

    if (app.eyes !== undefined) player.eyeColor = app.eyes;
}

mp.events.add('server:creator:save', async (player, dataJson) => {
    if (!player.data.dbId) return;

    let data;
    try {
        data = JSON.parse(dataJson);
    } catch(e) {
        player.outputChatBox("!{FF0000}Error: Invalid character data.");
        return;
    }

    const gender = data.gender;
    const appearance = JSON.stringify(data.appearance);

    player.data.appearance = data.appearance;
    player.data.gender = gender;

    player.model = (gender === 0) ? mp.joaat('mp_m_freemode_01') : mp.joaat('mp_f_freemode_01');
    applyAppearance(player, data.appearance);

    try {
        await db.query("UPDATE users SET appearance = ?, gender = ? WHERE id = ?",
            [appearance, gender, player.data.dbId]);

        const clothes = data.clothes;

        if (!player.inventory) player.inventory = [];

        const giveStartingItem = async (itemId, slot) => {
            if (!itemId) return;
            const [result] = await db.query(
                "INSERT INTO character_inventory (character_id, item_id, count, slot, metadata) VALUES (?, ?, 1, ?, '{}')",
                [player.data.dbId, itemId, slot]
            );
            player.inventory.push({
                id: result.insertId,
                itemId: itemId,
                count: 1,
                slot: slot,
                data: {}
            });
        };

        if (clothes.top)   await giveStartingItem(clothes.top, -11);
        if (clothes.legs)  await giveStartingItem(clothes.legs, -4);
        if (clothes.shoes) await giveStartingItem(clothes.shoes, -6);

        inventory.refreshClothes(player);

        player.logged = true;

        // Trigger class selector on the client now that character is saved
        player.call('client:classSelector:start');

    } catch (err) {
        player.outputChatBox("!{FF0000}Error saving character data. Please try again.");
    }
});

module.exports = { applyAppearance };

mp.events.add('playerSpawn', (player) => {
    if (player.logged && player.data.appearance) {
        const expectedModel = (player.data.gender === 0) ? mp.joaat('mp_m_freemode_01') : mp.joaat('mp_f_freemode_01');
        if (player.model !== expectedModel) player.model = expectedModel;

        applyAppearance(player, player.data.appearance);
        inventory.refreshClothes(player);
    }
});