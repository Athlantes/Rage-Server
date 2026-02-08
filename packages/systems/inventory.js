const ItemRegistry = require('../data/items');
const db = require('../core/database');
const QuestEvents = require('../core/questEvents');

class InventorySystem {
    
    constructor() {
        this.groundItems = new Map();

        this.loadGroundItems();
        setInterval(() => this.cleanupGroundItems(), 60000);

        mp.events.add('server:loadAccount', (player) => this.onPlayerJoin(player));

        mp.events.add('server:moveItem', (player, fromSlot, toSlot) => {
            // 1. DROP ITEM
            if (toSlot === 'GROUND') {
                this.dropItem(player, fromSlot);
                return;
            } 
            
            // 2. PICKUP ITEM
            if (typeof fromSlot === 'string' && fromSlot.startsWith('ground_')) {
                const groundId = fromSlot.replace('ground_', '');
                this.pickupItem(player, groundId, toSlot);
                return;
            } 

            // 3. MOVE / EQUIP ITEM
            if (!player.inventory) return;

            // Find the item being moved
            const item = player.inventory.find(i => i.slot === fromSlot);
            if (!item) return;

            // Check if target is Special Slot
            const isHotbar = (toSlot <= -51 && toSlot >= -55);
            const isClothing = (toSlot < 0 && !isHotbar);

            const def = ItemRegistry[item.itemId];
            if (!def) return;

            // --- A. HOTBAR CHECK ---
            if (isHotbar) {
                if (def.isEquippable === false) {
                    return player.call('showNotification', ['Inventory', 'You cannot equip this item in the hotbar!']);
                }
            }

            // --- B. CLOTHING CHECK ---
            if (isClothing) {
                if (def.type !== 'clothing') {
                    return player.call('showNotification', ['Item Error', 'This is not clothing!']);
                }
                if (def.sex !== undefined && player.data.gender !== undefined) {
                    if (def.sex !== player.data.gender) {
                        return player.call('showNotification', ['Item Error', 'This item does not fit your gender!']);
                    }
                }
                if (def.data.componentId !== Math.abs(toSlot)) {
                    return player.call('showNotification', ['Item Error', 'Wrong clothing slot!']);
                }
            }

            // If all checks pass, perform the move
            this.moveItem(player, fromSlot, toSlot);
        });

        mp.events.add('server:useItem', (player, slotIndex) => {
            this.useItem(player, slotIndex);
        });

        mp.events.add('server:useFastSlot', (player, slotIndex) => {
            const realSlot = -51 - slotIndex;
            this.useItem(player, realSlot);
        });

        mp.events.add('server:equipItem', (player, slot) => {
            const item = player.inventory.find(i => i.slot === slot);
            if (!item) return;

            const def = ItemRegistry[item.itemId];
            if (!def || def.type !== 'clothing' || !def.data.componentId) return;

            const targetSlot = -1 * def.data.componentId;
            this.moveItem(player, slot, targetSlot);
        });

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
                const [result] = await db.query(
                    'INSERT INTO character_inventory (character_id, item_id, count, slot, metadata) VALUES (?, ?, ?, ?, ?)',
                    [player.data.dbId, item.itemId, amount, freeSlot, JSON.stringify(item.data)]
                );
                player.inventory.push({
                    id: result.insertId, itemId: item.itemId, count: amount, slot: freeSlot, data: item.data
                });
                this.syncClient(player);
            } catch (err) { console.error(err); }
        });

        mp.events.add('server:stackItem', async (player, targetSlot) => {
            const targetItem = player.inventory.find(i => i.slot === targetSlot);
            if (!targetItem) return;

            const def = ItemRegistry[targetItem.itemId];
            if (!def || def.maxStack <= 1) return; 

            const targetMeta = JSON.stringify(targetItem.data);
            
            const siblingItems = player.inventory.filter(i => 
                i.itemId === targetItem.itemId && 
                i.slot >= 0 && 
                JSON.stringify(i.data) === targetMeta
            );

            if (siblingItems.length < 2) return player.call('showNotification', ['Inventory', 'Nothing to stack.']);

            let totalCount = siblingItems.reduce((sum, item) => sum + item.count, 0);
            
            siblingItems.sort((a, b) => {
                if (a.slot === targetSlot) return -1;
                if (b.slot === targetSlot) return 1;
                return a.slot - b.slot;
            });

            let updates = [];
            let deletes = [];

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

            try {
                await Promise.all([...updates, ...deletes]);
                this.syncClient(player);
                player.call('showNotification', ['Inventory', 'Items consolidated.']);
            } catch (err) {
                console.error("Stacking error:", err);
            }
        });

        mp.events.add('server:sortInventory', async (player) => {
            if (!player.inventory) return;

            let mainItems = player.inventory.filter(i => i.slot >= 0);
            if (mainItems.length === 0) return;

            mainItems.sort((a, b) => {
                const defA = ItemRegistry[a.itemId];
                const defB = ItemRegistry[b.itemId];
                const nameA = defA ? (defA.name || a.itemId) : a.itemId;
                const nameB = defB ? (defB.name || b.itemId) : b.itemId;

                const nameCompare = nameA.localeCompare(nameB);
                if (nameCompare !== 0) return nameCompare;

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

            try {
                if (updates.length > 0) await Promise.all(updates);
                this.syncClient(player);
                player.call('showNotification', ['Inventory', 'Sorted items alphabetically.']);
            } catch (err) {
                console.error("Sort Error:", err);
            }
        });

        mp.events.add('server:stackAllItems', async (player) => {
            if (!player.inventory) return;

            const groups = {};
            player.inventory.forEach(item => {
                if (item.slot < 0) return;
                const signature = item.itemId + "|" + JSON.stringify(item.data);
                if (!groups[signature]) groups[signature] = [];
                groups[signature].push(item);
            });

            let updates = [];
            let deletes = [];
            let changed = false;

            for (const signature in groups) {
                const items = groups[signature];
                if (items.length < 2) continue;

                const firstItem = items[0];
                const def = ItemRegistry[firstItem.itemId];
                if (!def || def.maxStack <= 1) continue;

                let totalCount = items.reduce((sum, i) => sum + i.count, 0);
                items.sort((a, b) => a.slot - b.slot);

                for (const item of items) {
                    if (totalCount > 0) {
                        const newCount = Math.min(totalCount, def.maxStack);
                        if (item.count !== newCount) {
                            item.count = newCount;
                            updates.push(db.query('UPDATE character_inventory SET count = ? WHERE id = ?', [newCount, item.id]));
                            changed = true;
                        }
                        totalCount -= newCount;
                    } else {
                        const idx = player.inventory.indexOf(item);
                        if (idx > -1) player.inventory.splice(idx, 1);
                        deletes.push(db.query('DELETE FROM character_inventory WHERE id = ?', [item.id]));
                        changed = true;
                    }
                }
            }

            if (changed) {
                try {
                    await Promise.all([...updates, ...deletes]);
                    this.syncClient(player);
                    player.call('showNotification', ['Inventory', 'All items stacked.']);
                } catch (err) {
                    console.error("Stack All Error:", err);
                }
            } else {
                player.call('showNotification', ['Inventory', 'Nothing to stack.']);
            }
        });

        mp.events.add('playerRequestInventory', (player) => this.syncClient(player));
        
        mp.events.add('playerQuit', (player) => {
            player.inventory = null;
        });
    }

    async onPlayerJoin(player) {
        player.inventory = []; 
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

        // 1. Check Weight Limit
        if (parseFloat(this.getWeight(player)) + (itemDef.weight * amount) > 40.0) {
            player.call('showNotification', ['Inventory', 'Pockets are too full!']);
            return false;
        }

        // 2. Try to fill EXISTING stacks first
        if (itemDef.maxStack > 1) {
            // Find all stacks of this item that aren't full
            const stacks = player.inventory.filter(i => i.itemId === itemId && i.count < itemDef.maxStack && i.slot >= 0);
            
            for (const stackItem of stacks) {
                if (amount <= 0) break; 

                const space = itemDef.maxStack - stackItem.count;
                const toAdd = Math.min(amount, space);
                
                stackItem.count += toAdd;
                amount -= toAdd;

                // Update DB for this stack
                await db.query('UPDATE character_inventory SET count = ? WHERE id = ?', [stackItem.count, stackItem.id]);
            }
        }

        const maxStack = itemDef.maxStack || 1; 

        if (amount > 0) {
            try {
                while (amount > 0) {
                    const countToAdd = Math.min(amount, maxStack);
                    
                    // Find the first available free slot
                    let freeSlot = 0;
                    while (player.inventory.find(item => item.slot === freeSlot)) { freeSlot++; }

                    // Insert into Database
                    const [result] = await db.query(
                        'INSERT INTO character_inventory (character_id, item_id, count, slot, metadata) VALUES (?, ?, ?, ?, ?)',
                        [player.data.dbId, itemId, countToAdd, freeSlot, '{}']
                    );
                    
                    // Add to live inventory array
                    player.inventory.push({
                        id: result.insertId, itemId: itemId, count: countToAdd, slot: freeSlot, data: {}
                    });

                    amount -= countToAdd;
                }
            } catch (err) { 
                console.error(err); 
                return false; 
            }
        }

        this.syncClient(player);
        return true;
    }

    async moveItem(player, fromSlot, toSlot) {
        if (!player.inventory) return;
        const getItem = (s) => player.inventory.find(i => i.slot === s);
        const itemFrom = getItem(fromSlot);
        const itemTo = getItem(toSlot);

        if (!itemFrom) return;

        const isHotbar = (toSlot <= -51 && toSlot >= -55);
        const isClothing = (toSlot < 0 && !isHotbar); 

        if (isClothing) {
            const def = ItemRegistry[itemFrom.itemId];
            if (!def || def.type !== 'clothing') return player.call('showNotification', ['Item Error', 'Not clothing!']);
            if (def.data.componentId !== Math.abs(toSlot)) return player.call('showNotification', ['Item Error', 'Wrong slot!']);
        }

        if (isHotbar) {
            const def = ItemRegistry[itemFrom.itemId];
            if (!def || !def.isEquippable) {
                return player.call('showNotification', ['Inventory', 'You cannot equip this item!']);
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

        if (fromSlot < 0 || toSlot < 0) this.refreshClothes(player);
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
            const weaponHash = mp.joaat(def.data.hash);
            if (player.weapon === weaponHash) {
                player.weapon = 2725352035; 
                player.call('showNotification', ['Weapons', `Holstered ${def.name}`]);
            } else {
                player.weapon = weaponHash;
                player.setWeaponAmmo(weaponHash, 200); 
                player.call('showNotification', ['Weapons', `Equipped ${def.name}`]);
            }
        } 
        else if (def.type === 'food' || def.type === 'drink') {
            player.call('showNotification', ['Consumable', `Used ${def.name}`]);

            QuestEvents.emit(player, 'consume_item', { 
                itemId: item.itemId, 
                type: def.type 
            });

            if (item.count > 1) {
                item.count--;
                db.query('UPDATE character_inventory SET count = ? WHERE id = ?', [item.count, item.id]);
            } else {
                await this.removeItem(player, item);
            }
            this.syncClient(player);
        }
    }

    async removeItem(player, item) {
        await db.query('DELETE FROM character_inventory WHERE id = ?', [item.id]);
        player.inventory = player.inventory.filter(i => i !== item);
    }

    async loadGroundItems() {
        try {
            const [rows] = await db.query('SELECT * FROM ground_items');
            rows.forEach(row => {
                const groundObj = mp.objects.new('v_serv_abox_02', 
                    new mp.Vector3(row.pos_x, row.pos_y, row.pos_z - 0.95),
                    { dimension: row.dimension }
                );

                this.groundItems.set(row.id.toString(), {
                    id: row.id.toString(), 
                    itemId: row.item_id, 
                    count: row.count,
                    position: new mp.Vector3(row.pos_x, row.pos_y, row.pos_z), 
                    dimension: row.dimension,
                    object: groundObj, 
                    data: row.metadata ? JSON.parse(row.metadata) : {}
                });
            });
            console.log(`[Inventory] Loaded ${rows.length} ground items from database.`);
        } catch (err) { console.error("[Inventory] Load Error:", err); }
    }

    // New: Cleanup routine for 10-minute despawn
    async cleanupGroundItems() {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        try {
            const [rows] = await db.query('SELECT id FROM ground_items WHERE created_at < ?', [tenMinutesAgo]);
            for (const row of rows) {
                const groundId = row.id.toString();
                const gItem = this.groundItems.get(groundId);
                if (gItem) {
                    if (mp.objects.exists(gItem.object)) gItem.object.destroy();
                    this.groundItems.delete(groundId);
                }
            }
            if (rows.length > 0) {
                await db.query('DELETE FROM ground_items WHERE created_at < ?', [tenMinutesAgo]);
                // Refresh nearby players so the items disappear from their UI
                mp.players.forEach(p => { if(p.logged) this.syncClient(p); });
            }
        } catch (err) { console.error("[Inventory] Cleanup Error:", err); }
    }

    async dropItem(player, fromSlot) {
        const item = player.inventory.find(i => i.slot === fromSlot);
        if (!item) return;

        try {
            // Save to Database first
            const [result] = await db.query(
                'INSERT INTO ground_items (item_id, count, pos_x, pos_y, pos_z, dimension, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [item.itemId, item.count, player.position.x, player.position.y, player.position.z, player.dimension, JSON.stringify(item.data)]
            );

            const groundId = result.insertId.toString();
            const groundObj = mp.objects.new('v_serv_abox_02', 
                new mp.Vector3(player.position.x, player.position.y, player.position.z - 0.95),
                { dimension: player.dimension }
            );

            this.groundItems.set(groundId, {
                id: groundId, itemId: item.itemId, count: item.count,
                position: player.position, dimension: player.dimension,
                object: groundObj, data: item.data
            });

            await this.removeItem(player, item);
            if (fromSlot < 0) this.refreshClothes(player);
            
            // Sync everyone nearby so it appears in their vicinity immediately
            this.refreshNearby(player.position, player.dimension);
        } catch (err) { console.error(err); }
    }
    
    async pickupItem(player, groundId, targetSlot) {
        const groundItem = this.groundItems.get(groundId);
        if (!groundItem) return player.call('showNotification', ['Vicinity', 'Item invalid.']);
        if (player.dist(groundItem.position) > 5) return player.call('showNotification', ['Vicinity', 'Too far away!']);

        const def = ItemRegistry[groundItem.itemId];
        if (parseFloat(this.getWeight(player)) + (def.weight * groundItem.count) > 40.0) {
            return player.call('showNotification', ['Inventory', 'Too heavy!']);
        }

        if (player.inventory.find(i => i.slot === targetSlot)) {
            // Find first free slot instead of erroring
            targetSlot = 0;
            while (player.inventory.find(i => i.slot === targetSlot)) { targetSlot++; }
        }

        try {
            const [result] = await db.query(
                'INSERT INTO character_inventory (character_id, item_id, count, slot, metadata) VALUES (?, ?, ?, ?, ?)',
                [player.data.dbId, groundItem.itemId, groundItem.count, targetSlot, JSON.stringify(groundItem.data)]
            );
            
            player.inventory.push({
                id: result.insertId, itemId: groundItem.itemId, count: groundItem.count, slot: targetSlot, data: groundItem.data
            });

            // Delete from ground database
            await db.query('DELETE FROM ground_items WHERE id = ?', [parseInt(groundId)]);

            if (mp.objects.exists(groundItem.object)) groundItem.object.destroy();
            this.groundItems.delete(groundId);
            
            this.refreshNearby(player.position, player.dimension);
        } catch (err) { console.error(err); }
    }

    refreshNearby(position, dimension) {
        mp.players.forEachInRange(position, 10, (nearbyPlayer) => {
            if (nearbyPlayer.logged) this.syncClient(nearbyPlayer);
        });
    }
    
    refreshClothes(player) {
        // 1. Get Equipped Items
        const equipment = player.inventory.filter(i => i.slot < 0 && i.slot > -50); 
        
        // 2. Determine Gender for Defaults
        // Assuming player.data.gender is set (0=Male, 1=Female)
        const isMale = (player.data.gender === 0);
        
        const defaults = {
            mask: { id: 1, drawable: 0, texture: 0 },
            torso: { id: 3, drawable: 15, texture: 0 },
            legs: { id: 4, drawable: isMale ? 14 : 15, texture: 0 }, // Underwear
            shoes: { id: 6, drawable: isMale ? 34 : 35, texture: 0 }, // Basic feet
            top: { id: 11, drawable: 15, texture: 0 },
            undershirt: { id: 8, drawable: 15, texture: 0 }
        };

        // Reset to Naked/Underwear
        player.setClothes(defaults.mask.id, defaults.mask.drawable, defaults.mask.texture, 0);
        player.setClothes(defaults.torso.id, defaults.torso.drawable, defaults.torso.texture, 0);
        player.setClothes(defaults.legs.id, defaults.legs.drawable, defaults.legs.texture, 0);
        player.setClothes(defaults.shoes.id, defaults.shoes.drawable, defaults.shoes.texture, 0);
        player.setClothes(defaults.top.id, defaults.top.drawable, defaults.top.texture, 0);
        player.setClothes(defaults.undershirt.id, defaults.undershirt.drawable, defaults.undershirt.texture, 0);

        // 3. Apply Items based on items.js Definition
        equipment.forEach(equip => {
            const def = ItemRegistry[equip.itemId];
            
            if (def && def.data) {
                // Apply the static look defined in items.js
                player.setClothes(def.data.componentId, def.data.drawable, def.data.texture, 0);

                // Handle Torso logic (essential for tops)
                if (def.data.componentId === 11 && def.data.torso !== undefined) {
                    player.setClothes(3, def.data.torso, 0, 0);
                }
            }
        });
    }

    syncClient(player) {
        if (!player.inventory) player.inventory = [];
        
        const nearbyItems = [];
        this.groundItems.forEach((gItem) => {
            if (gItem.dimension === player.dimension && player.dist(gItem.position) < 5.0) {
                nearbyItems.push({ id: gItem.id, itemId: gItem.itemId, count: gItem.count });
            }
        });

        // === UPDATED: Send Name property for Search System ===
        const clientInventory = player.inventory.map(item => {
            const def = ItemRegistry[item.itemId];
            return {
                ...item,
                type: def ? def.type : 'misc',
                maxStack: def ? def.maxStack : 1,
                name: def ? def.name : item.itemId // Fallback to ID if no name
            };
        });

        const payload = {
            inventory: clientInventory, 
            vicinity: nearbyItems,
            weight: this.getWeight(player), 
            maxWeight: 40.0
        };
        player.call('client:updateInventory', [JSON.stringify(payload)]);
    }
}
module.exports = new InventorySystem();