const ItemRegistry = require('../data/items');
const db = require('../core/database');
const QuestEvents = require('../core/questEvents');

class InventorySystem {
    
    constructor() {
        this.groundItems = new Map();

        this.loadGroundItems();
        setInterval(() => this.cleanupGroundItems(), 60000);

        mp.events.add('server:loadAccount', (player) => this.onPlayerJoin(player));
        mp.events.add('playerQuit', (player) => this.onPlayerQuit(player));

        // --- REAL-TIME SHOT UPDATE ---
        mp.events.add('playerWeaponShot', (player, target, position) => {
            this.handleWeaponShot(player);
        });

        mp.events.add('server:moveItem', (player, fromSlot, toSlot) => {
            if (toSlot === 'GROUND') {
                this.dropItem(player, fromSlot);
                return;
            } 
            
            if (typeof fromSlot === 'string' && fromSlot.startsWith('ground_')) {
                const groundId = fromSlot.replace('ground_', '');
                this.pickupItem(player, groundId, toSlot);
                return;
            } 

            if (!player.inventory) return;

            const item = player.inventory.find(i => i.slot === fromSlot);
            if (!item) return;

            const def = ItemRegistry[item.itemId];
            if (!def) return;

            // Weapon Reload by Dragging Ammo
            const targetItem = player.inventory.find(i => i.slot === toSlot);
            if (targetItem) {
                const targetDef = ItemRegistry[targetItem.itemId];
                if (targetDef && targetDef.type === 'weapon' && def.type === 'ammo') {
                    if (targetDef.ammoItem === item.itemId) {
                        this.reloadWeapon(player, targetItem, item);
                        return; 
                    }
                }
            }

            // Slot Validation
            const isHotbar = (toSlot <= -51 && toSlot >= -55);
            const isClothing = (toSlot < 0 && !isHotbar);

            if (isHotbar && def.isEquippable === false) {
                return player.call('showNotification', ['Inventory', 'You cannot equip this item in the hotbar!']);
            }

            if (isClothing) {
                if (def.type !== 'clothing') return player.call('showNotification', ['Item Error', 'Not clothing!']);
                if (def.sex !== undefined && player.data.gender !== undefined && def.sex !== player.data.gender) {
                    return player.call('showNotification', ['Item Error', 'Wrong gender!']);
                }
                if (def.data.componentId !== Math.abs(toSlot)) return player.call('showNotification', ['Item Error', 'Wrong slot!']);
            }
            
            this.moveItem(player, fromSlot, toSlot);
        });

        mp.events.add('server:useItem', (player, slotIndex) => {
            this.useItem(player, slotIndex);
        });

        mp.events.add('server:useFastSlot', (player, slotIndex) => {
            const realSlot = -51 - slotIndex;
            this.handleFastSwitch(player, realSlot);
        });

        mp.events.add('server:unloadWeapon', (player, slot) => {
            const item = player.inventory.find(i => i.slot === slot);
            if (!item) return;
            const def = ItemRegistry[item.itemId];
            if (!def || def.type !== 'weapon') return;

            const currentAmmo = (item.data.ammo || 0);
            if (currentAmmo <= 0) return player.call('showNotification', ['Weapon', 'Weapon is already empty.']);

            // If equipped, strip ammo
            const weaponHash = mp.joaat(def.data.hash);
            if (player.activeWeaponSlot === item.slot) {
                player.setWeaponAmmo(weaponHash, 0);
            }

            // Return Ammo Item
            if (def.ammoItem) {
                this.addItem(player, def.ammoItem, currentAmmo);
            }

            item.data.ammo = 0;
            db.query('UPDATE character_inventory SET metadata = ? WHERE id = ?', [JSON.stringify(item.data), item.id]);
            
            player.call('showNotification', ['Weapon', `Unloaded ${currentAmmo} rounds.`]);
            this.syncClient(player);
        });

        mp.events.add('server:loadWeapon', (player, slot) => {
            const weaponItem = player.inventory.find(i => i.slot === slot);
            if (!weaponItem) return;
            const def = ItemRegistry[weaponItem.itemId];
            if (!def || !def.ammoItem) return;

            const ammoItem = player.inventory.find(i => i.itemId === def.ammoItem && i.slot >= 0);
            if (!ammoItem) return player.call('showNotification', ['Weapon', 'No compatible ammo found.']);

            this.reloadWeapon(player, weaponItem, ammoItem);
        });

        mp.events.add('server:equipItem', (player, slot) => {
            const item = player.inventory.find(i => i.slot === slot);
            if (!item) return;
            const def = ItemRegistry[item.itemId];
            if (!def || def.type !== 'clothing' || !def.data.componentId) return;
            this.moveItem(player, slot, -1 * def.data.componentId);
        });

        // Split/Stack/Sort Events...
        mp.events.add('server:splitItem', async (player, slot, amount) => {
            amount = parseInt(amount);
            if (amount <= 0) return;
            const item = player.inventory.find(i => i.slot === slot);
            if (!item || item.count <= amount) return;
            let freeSlot = 0;
            while (player.inventory.find(i => i.slot === freeSlot)) { freeSlot++; }
            item.count -= amount;
            await db.query('UPDATE character_inventory SET count = ? WHERE id = ?', [item.count, item.id]);
            try {
                const [result] = await db.query('INSERT INTO character_inventory (character_id, item_id, count, slot, metadata) VALUES (?, ?, ?, ?, ?)', [player.data.dbId, item.itemId, amount, freeSlot, JSON.stringify(item.data)]);
                player.inventory.push({ id: result.insertId, itemId: item.itemId, count: amount, slot: freeSlot, data: item.data });
                this.syncClient(player);
            } catch (err) { console.error(err); }
        });

        mp.events.add('server:stackItem', async (player, targetSlot) => {
            const targetItem = player.inventory.find(i => i.slot === targetSlot);
            if (!targetItem) return;
            const def = ItemRegistry[targetItem.itemId];
            if (!def || def.maxStack <= 1) return; 
            const targetMeta = JSON.stringify(targetItem.data);
            const siblingItems = player.inventory.filter(i => i.itemId === targetItem.itemId && i.slot >= 0 && JSON.stringify(i.data) === targetMeta);
            if (siblingItems.length < 2) return player.call('showNotification', ['Inventory', 'Nothing to stack.']);
            let totalCount = siblingItems.reduce((sum, item) => sum + item.count, 0);
            siblingItems.sort((a, b) => { if (a.slot === targetSlot) return -1; if (b.slot === targetSlot) return 1; return a.slot - b.slot; });
            let updates = []; let deletes = [];
            for (let item of siblingItems) {
                if (totalCount > 0) {
                    const countToSet = Math.min(totalCount, def.maxStack);
                    item.count = countToSet;
                    updates.push(db.query('UPDATE character_inventory SET count = ? WHERE id = ?', [countToSet, item.id]));
                    totalCount -= countToSet;
                } else {
                    const idx = player.inventory.indexOf(item);
                    if (idx > -1) player.inventory.splice(idx, 1);
                    deletes.push(db.query('DELETE FROM character_inventory WHERE id = ?', [item.id]));
                }
            }
            try { await Promise.all([...updates, ...deletes]); this.syncClient(player); player.call('showNotification', ['Inventory', 'Items consolidated.']); } catch (err) { console.error("Stacking error:", err); }
        });

        mp.events.add('server:sortInventory', async (player) => {
            if (!player.inventory) return;
            let mainItems = player.inventory.filter(i => i.slot >= 0);
            if (mainItems.length === 0) return;
            mainItems.sort((a, b) => {
                const defA = ItemRegistry[a.itemId]; const defB = ItemRegistry[b.itemId];
                const nameA = defA ? (defA.name || a.itemId) : a.itemId; const nameB = defB ? (defB.name || b.itemId) : b.itemId;
                const nameCompare = nameA.localeCompare(nameB); if (nameCompare !== 0) return nameCompare;
                return b.count - a.count;
            });
            const updates = [];
            for (let i = 0; i < mainItems.length; i++) {
                const item = mainItems[i];
                if (item.slot !== i) {
                    item.slot = i;
                    updates.push(db.query('UPDATE character_inventory SET slot = ? WHERE id = ?', [i, item.id]));
                }
            }
            try { if (updates.length > 0) await Promise.all(updates); this.syncClient(player); player.call('showNotification', ['Inventory', 'Sorted items alphabetically.']); } catch (err) { console.error("Sort Error:", err); }
        });

        mp.events.add('playerRequestInventory', (player) => this.syncClient(player));
    }

    async onPlayerJoin(player) {
        player.inventory = []; 
        player.activeWeaponSlot = undefined; 
        const charId = player.data.dbId; 
        if (!charId) return;

        try {
            const [rows] = await db.query('SELECT * FROM character_inventory WHERE character_id = ?', [charId]);
            rows.forEach(row => {
                player.inventory.push({
                    id: row.id, itemId: row.item_id, count: row.count, slot: row.slot,
                    data: row.metadata ? JSON.parse(row.metadata) : {}
                });
            });
            this.refreshClothes(player);
            this.syncClient(player);
        } catch (err) { console.error(err); }
    }

    async onPlayerQuit(player) {
        if (player.inventory && player.activeWeaponSlot !== undefined) {
            const item = player.inventory.find(i => i.slot === player.activeWeaponSlot);
            if (item) {
                try {
                    const def = ItemRegistry[item.itemId];
                    if (def && def.type === 'weapon') {
                        const weaponHash = mp.joaat(def.data.hash);
                        const currentAmmo = player.getWeaponAmmo(weaponHash);
                        if (typeof currentAmmo === 'number') {
                            item.data.ammo = currentAmmo;
                            await db.query('UPDATE character_inventory SET metadata = ? WHERE id = ?', [JSON.stringify(item.data), item.id]);
                            console.log(`[Inventory] Saved ${currentAmmo} rounds for ${player.name} on quit.`);
                        }
                    }
                } catch(e) {}
            }
        }
        player.inventory = null;
    }

    // --- UPDATED: Handle Weapon Shot with Immediate Sync ---
    handleWeaponShot(player) {
        if (!player.inventory || player.activeWeaponSlot === undefined) return;

        const item = player.inventory.find(i => i.slot === player.activeWeaponSlot);
        if (item) {
            const def = ItemRegistry[item.itemId];
            if (def && def.type === 'weapon') {
                const weaponHash = mp.joaat(def.data.hash);
                
                // 1. Get accurate ammo from engine using the Item Hash
                const currentAmmo = player.getWeaponAmmo(weaponHash);
                
                // 2. Update the in-memory item data immediately if valid
                if (typeof currentAmmo === 'number') {
                    item.data.ammo = currentAmmo;
                    
                    // 3. Force Sync UI so ammo count updates on screen
                    this.syncClient(player);
                }
            }
        }
    }

    async handleFastSwitch(player, targetSlot) {
        const targetItem = player.inventory.find(i => i.slot === targetSlot);
        const currentSlot = player.activeWeaponSlot;

        if (targetItem && currentSlot === targetItem.slot) return; 
        if (currentSlot !== undefined) await this.unequipCurrentWeapon(player);
        if (targetItem) this.useItem(player, targetItem.slot);
    }

    async unequipCurrentWeapon(player) {
        if (player.activeWeaponSlot === undefined) return;
        
        const item = player.inventory.find(i => i.slot === player.activeWeaponSlot);
        if (item) {
             const def = ItemRegistry[item.itemId];
             if (def && def.type === 'weapon') {
                 const weaponHash = mp.joaat(def.data.hash);
                 
                 const currentAmmo = player.getWeaponAmmo(weaponHash);
                 if (typeof currentAmmo === 'number') item.data.ammo = currentAmmo;
                 
                 await db.query('UPDATE character_inventory SET metadata = ? WHERE id = ?', [JSON.stringify(item.data), item.id]);
                 
                 player.setWeaponAmmo(weaponHash, 0);
                 player.removeWeapon(weaponHash);
                 
                 player.call('showNotification', ['Weapons', `Holstered ${def.name}`]);
             }
        } else {
             player.removeWeapon(player.weapon);
        }
        
        player.activeWeaponSlot = undefined;
        this.syncClient(player);
    }

    async useItem(player, slot) {
        const item = player.inventory.find(i => i.slot === slot);
        if (!item) return;

        const def = ItemRegistry[item.itemId];
        if (!def) return;

        if (def.type === 'seed') {
            player.call('client:inventory:forceClose');
            mp.events.call('server:farmer:tryPlant', player, item.itemId, item.slot);
            return;
        }

        if (def.type === 'weapon') {
            if (player.activeWeaponSlot === item.slot) {
                await this.unequipCurrentWeapon(player);
            } else {
                if (player.activeWeaponSlot !== undefined) {
                    await this.unequipCurrentWeapon(player);
                }

                const weaponHash = mp.joaat(def.data.hash);
                const savedAmmo = (item.data.ammo !== undefined) ? parseInt(item.data.ammo) : 0;
                
                player.giveWeapon(weaponHash, 0); 
                player.setWeaponAmmo(weaponHash, savedAmmo);
                
                player.activeWeaponSlot = item.slot; 
                player.call('showNotification', ['Weapons', `Equipped ${def.name}`]);
            }
            this.syncClient(player);
        } 
        else if (def.type === 'food' || def.type === 'drink') {
            if (player.activeWeaponSlot !== undefined) {
                await this.unequipCurrentWeapon(player);
            }

            player.call('showNotification', ['Consumable', `Used ${def.name}`]);
            QuestEvents.emit(player, 'consume_item', { itemId: item.itemId, type: def.type });

            if (item.count > 1) {
                item.count--;
                db.query('UPDATE character_inventory SET count = ? WHERE id = ?', [item.count, item.id]);
            } else {
                await this.removeItem(player, item);
            }
            this.syncClient(player);
        }
    }

    async reloadWeapon(player, weaponItem, ammoItem) {
        const ammoCount = ammoItem.count;
        if (ammoCount <= 0) return;

        if (!weaponItem.data.ammo) weaponItem.data.ammo = 0;
        weaponItem.data.ammo += ammoCount;

        await this.removeItem(player, ammoItem);
        await db.query('UPDATE character_inventory SET metadata = ? WHERE id = ?', [JSON.stringify(weaponItem.data), weaponItem.id]);

        const def = ItemRegistry[weaponItem.itemId];
        const weaponHash = mp.joaat(def.data.hash);
        
        if (player.activeWeaponSlot === weaponItem.slot) {
            player.setWeaponAmmo(weaponHash, weaponItem.data.ammo);
        }

        player.call('showNotification', ['Weapon', `Loaded ${ammoCount} rounds.`]);
        this.syncClient(player);
    }

    async moveItem(player, fromSlot, toSlot) {
        if (!player.inventory) return;
        const getItem = (s) => player.inventory.find(i => i.slot === s);
        const itemFrom = getItem(fromSlot);
        const itemTo = getItem(toSlot);

        if (!itemFrom) return;

        // Auto-Unequip if moving active weapon out of hotbar
        const def = ItemRegistry[itemFrom.itemId];
        if (def && def.type === 'weapon') {
            if (player.activeWeaponSlot === itemFrom.slot) {
                const wasInHotbar = (fromSlot <= -51 && fromSlot >= -55);
                const goingToHotbar = (toSlot <= -51 && toSlot >= -55);
                if (wasInHotbar && !goingToHotbar) {
                    await this.unequipCurrentWeapon(player);
                }
            }
        }
        
        if (!itemTo) {
            itemFrom.slot = toSlot;
            await db.query('UPDATE character_inventory SET slot = ? WHERE id = ?', [toSlot, itemFrom.id]);
        } else {
            itemFrom.slot = toSlot;
            itemTo.slot = fromSlot;
            await db.query('UPDATE character_inventory SET slot = ? WHERE id = ?', [toSlot, itemFrom.id]);
            await db.query('UPDATE character_inventory SET slot = ? WHERE id = ?', [fromSlot, itemTo.id]);
        }

        if (player.activeWeaponSlot === fromSlot) player.activeWeaponSlot = toSlot;
        else if (player.activeWeaponSlot === toSlot) player.activeWeaponSlot = fromSlot;

        if (fromSlot < 0 || toSlot < 0) this.refreshClothes(player);
        this.syncClient(player);
    }
    
    getWeight(player) {
        let total = 0.0;
        if (player.inventory) {
            player.inventory.forEach(item => {
                const def = ItemRegistry[item.itemId];
                if (def) total += (def.weight * item.count);
            });
        }
        return total.toFixed(2);
    }

    async addItem(player, itemId, amount) {
        const itemDef = ItemRegistry[itemId];
        if (!itemDef) return false;
        if (!player.inventory) player.inventory = [];
        if (parseFloat(this.getWeight(player)) + (itemDef.weight * amount) > 40.0) {
            player.call('showNotification', ['Inventory', 'Pockets are too full!']);
            return false;
        }

        if (itemDef.maxStack > 1) {
            const stacks = player.inventory.filter(i => i.itemId === itemId && i.count < itemDef.maxStack && i.slot >= 0);
            for (const stackItem of stacks) {
                if (amount <= 0) break; 
                const space = itemDef.maxStack - stackItem.count;
                const toAdd = Math.min(amount, space);
                stackItem.count += toAdd;
                amount -= toAdd;
                await db.query('UPDATE character_inventory SET count = ? WHERE id = ?', [stackItem.count, stackItem.id]);
            }
        }
        const maxStack = itemDef.maxStack || 1; 
        if (amount > 0) {
            try {
                while (amount > 0) {
                    const countToAdd = Math.min(amount, maxStack);
                    let freeSlot = 0;
                    while (player.inventory.find(item => item.slot === freeSlot)) { freeSlot++; }
                    const [result] = await db.query('INSERT INTO character_inventory (character_id, item_id, count, slot, metadata) VALUES (?, ?, ?, ?, ?)', [player.data.dbId, itemId, countToAdd, freeSlot, '{}']);
                    player.inventory.push({ id: result.insertId, itemId: itemId, count: countToAdd, slot: freeSlot, data: {} });
                    amount -= countToAdd;
                }
            } catch (err) { console.error(err); return false; }
        }
        this.syncClient(player);
        return true;
    }
    
    async removeItem(player, item) {
        if (player.activeWeaponSlot === item.slot) {
            player.removeWeapon(player.weapon);
            player.activeWeaponSlot = undefined;
        }
        await db.query('DELETE FROM character_inventory WHERE id = ?', [item.id]);
        player.inventory = player.inventory.filter(i => i !== item);
    }

    async loadGroundItems() {
        try {
            const [rows] = await db.query('SELECT * FROM ground_items');
            rows.forEach(row => {
                const groundObj = mp.objects.new('v_serv_abox_02', new mp.Vector3(row.pos_x, row.pos_y, row.pos_z - 0.95), { dimension: row.dimension });
                this.groundItems.set(row.id.toString(), { id: row.id.toString(), itemId: row.item_id, count: row.count, position: new mp.Vector3(row.pos_x, row.pos_y, row.pos_z), dimension: row.dimension, object: groundObj, data: row.metadata ? JSON.parse(row.metadata) : {} });
            });
            console.log(`[Inventory] Loaded ${rows.length} ground items.`);
        } catch (err) { console.error(err); }
    }

    async cleanupGroundItems() {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        try {
            const [rows] = await db.query('SELECT id FROM ground_items WHERE created_at < ?', [tenMinutesAgo]);
            for (const row of rows) {
                const groundId = row.id.toString();
                const gItem = this.groundItems.get(groundId);
                if (gItem) { if (mp.objects.exists(gItem.object)) gItem.object.destroy(); this.groundItems.delete(groundId); }
            }
            if (rows.length > 0) { await db.query('DELETE FROM ground_items WHERE created_at < ?', [tenMinutesAgo]); mp.players.forEach(p => { if(p.logged) this.syncClient(p); }); }
        } catch (err) { console.error(err); }
    }

    async dropItem(player, fromSlot) {
        const item = player.inventory.find(i => i.slot === fromSlot);
        if (!item) return;

        if (player.activeWeaponSlot === item.slot) {
             const def = ItemRegistry[item.itemId];
             if (def && def.type === 'weapon') {
                 const weaponHash = mp.joaat(def.data.hash);
                 const currentAmmo = player.getWeaponAmmo(weaponHash);
                 if(typeof currentAmmo === 'number') item.data.ammo = currentAmmo;
                 
                 player.setWeaponAmmo(weaponHash, 0);
                 player.removeWeapon(weaponHash);
                 player.activeWeaponSlot = undefined;
             }
        }

        try {
            const [result] = await db.query('INSERT INTO ground_items (item_id, count, pos_x, pos_y, pos_z, dimension, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)', [item.itemId, item.count, player.position.x, player.position.y, player.position.z, player.dimension, JSON.stringify(item.data)]);
            const groundId = result.insertId.toString();
            const groundObj = mp.objects.new('v_serv_abox_02', new mp.Vector3(player.position.x, player.position.y, player.position.z - 0.95), { dimension: player.dimension });
            this.groundItems.set(groundId, { id: groundId, itemId: item.itemId, count: item.count, position: player.position, dimension: player.dimension, object: groundObj, data: item.data });
            await this.removeItem(player, item);
            if (fromSlot < 0) this.refreshClothes(player);
            this.refreshNearby(player.position, player.dimension);
        } catch (err) { console.error(err); }
    }
    
    async pickupItem(player, groundId, targetSlot) {
        const groundItem = this.groundItems.get(groundId);
        if (!groundItem) return player.call('showNotification', ['Vicinity', 'Item invalid.']);
        if (player.dist(groundItem.position) > 5) return player.call('showNotification', ['Vicinity', 'Too far away!']);
        const def = ItemRegistry[groundItem.itemId];
        if (parseFloat(this.getWeight(player)) + (def.weight * groundItem.count) > 40.0) return player.call('showNotification', ['Inventory', 'Too heavy!']);
        if (player.inventory.find(i => i.slot === targetSlot)) { targetSlot = 0; while (player.inventory.find(i => i.slot === targetSlot)) { targetSlot++; } }
        try {
            const [result] = await db.query('INSERT INTO character_inventory (character_id, item_id, count, slot, metadata) VALUES (?, ?, ?, ?, ?)', [player.data.dbId, groundItem.itemId, groundItem.count, targetSlot, JSON.stringify(groundItem.data)]);
            player.inventory.push({ id: result.insertId, itemId: groundItem.itemId, count: groundItem.count, slot: targetSlot, data: groundItem.data });
            await db.query('DELETE FROM ground_items WHERE id = ?', [parseInt(groundId)]);
            if (mp.objects.exists(groundItem.object)) groundItem.object.destroy();
            this.groundItems.delete(groundId);
            this.refreshNearby(player.position, player.dimension);
        } catch (err) { console.error(err); }
    }

    refreshNearby(position, dimension) {
        mp.players.forEachInRange(position, 10, (nearbyPlayer) => { if (nearbyPlayer.logged) this.syncClient(nearbyPlayer); });
    }
    
    refreshClothes(player) {
        const equipment = player.inventory.filter(i => i.slot < 0 && i.slot > -50); 
        const isMale = (player.data.gender === 0);
        const defaults = { mask: { id: 1, drawable: 0, texture: 0 }, torso: { id: 3, drawable: 15, texture: 0 }, legs: { id: 4, drawable: isMale ? 14 : 15, texture: 0 }, shoes: { id: 6, drawable: isMale ? 34 : 35, texture: 0 }, top: { id: 11, drawable: 15, texture: 0 }, undershirt: { id: 8, drawable: 15, texture: 0 } };
        player.setClothes(defaults.mask.id, defaults.mask.drawable, defaults.mask.texture, 0); player.setClothes(defaults.torso.id, defaults.torso.drawable, defaults.torso.texture, 0); player.setClothes(defaults.legs.id, defaults.legs.drawable, defaults.legs.texture, 0); player.setClothes(defaults.shoes.id, defaults.shoes.drawable, defaults.shoes.texture, 0); player.setClothes(defaults.top.id, defaults.top.drawable, defaults.top.texture, 0); player.setClothes(defaults.undershirt.id, defaults.undershirt.drawable, defaults.undershirt.texture, 0);
        equipment.forEach(equip => { const def = ItemRegistry[equip.itemId]; if (def && def.data) { player.setClothes(def.data.componentId, def.data.drawable, def.data.texture, 0); if (def.data.componentId === 11 && def.data.torso !== undefined) { player.setClothes(3, def.data.torso, 0, 0); } } });
    }

    // --- UPDATED: Backup Sync with Safer Ammo Check ---
    syncClient(player) {
        if (!player.inventory) player.inventory = [];
        const nearbyItems = [];
        this.groundItems.forEach((gItem) => { if (gItem.dimension === player.dimension && player.dist(gItem.position) < 5.0) nearbyItems.push({ id: gItem.id, itemId: gItem.itemId, count: gItem.count }); });

        if (player.activeWeaponSlot !== undefined) {
             const item = player.inventory.find(i => i.slot === player.activeWeaponSlot);
             if (item) {
                 const def = ItemRegistry[item.itemId];
                 if (def && def.type === 'weapon') {
                     // Check Ammo using Hash from ITEM (Safer than player.weapon)
                     const weaponHash = mp.joaat(def.data.hash);
                     const currentAmmo = player.getWeaponAmmo(weaponHash);
                     
                     if (typeof currentAmmo === 'number' && item.data.ammo !== currentAmmo) {
                         item.data.ammo = currentAmmo;
                         // Async Save
                         db.query('UPDATE character_inventory SET metadata = ? WHERE id = ?', [JSON.stringify(item.data), item.id]).catch(e => console.error(e));
                     }
                 }
             }
        }

        const clientInventory = player.inventory.map(item => { const def = ItemRegistry[item.itemId]; return { ...item, type: def ? def.type : 'misc', maxStack: def ? def.maxStack : 1, name: def ? def.name : item.itemId, ammoItem: def ? def.ammoItem : null }; });
        const payload = { inventory: clientInventory, vicinity: nearbyItems, weight: this.getWeight(player), maxWeight: 40.0 };
        player.call('client:updateInventory', [JSON.stringify(payload)]);
    }
}
module.exports = new InventorySystem();