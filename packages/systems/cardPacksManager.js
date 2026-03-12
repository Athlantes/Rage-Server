/**
 * cardPacksManager.js  (server-side)
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles all server-side logic for the Card Packs unboxing system.
 *
 * SECURITY MODEL:
 *   - The client/CEF never learns which reward is behind which face-down card.
 *   - All rewards are stored in player.data.packSession (server memory only).
 *   - When the player picks a card (by visual index), the server pops a
 *     RANDOM reward from the session pool — positional index is irrelevant.
 *   - This means memory-reading the CEF page yields zero useful information.
 *
 * INTEGRATION NOTES:
 *   ⚠  You must add the following to InventorySystem.useItem() in inventory.js
 *      inside the main type-switch, after the 'drink' block:
 *
 *      else if (def.type === 'cardpack') {
 *          player.call('client:inventory:forceClose');
 *          mp.events.call('server:cardPack:triggerOpen', player, item);
 *          return;
 *      }
 *
 *   ⚠  You must add pack items to packages/data/items.js. Example:
 *
 *      "bronze_pack": {
 *          name: "Bronze Starter Pack",
 *          type: "cardpack",
 *          weight: 0.1,
 *          maxStack: 10,
 *          icon: "bronze_pack.png",
 *          data: { packId: "bronze_pack" }
 *      },
 *      "gold_pack": {
 *          name: "Gold Premium Pack",
 *          type: "cardpack",
 *          weight: 0.1,
 *          maxStack: 10,
 *          icon: "gold_pack.png",
 *          data: { packId: "gold_pack" }
 *      },
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const config       = require('../data/cardPacksConfig');
const ItemRegistry = require('../data/items');
const db           = require('../core/database');

// Lazily resolved to avoid circular-require issues at startup
let inventorySystem = null;
const getInventory = () => {
    if (!inventorySystem) inventorySystem = require('./inventory');
    return inventorySystem;
};

// ─────────────────────────────────────────────────────────────────────────────
//  PURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Weighted random selection from an array of reward objects.
 * Each reward must have a numeric `weight` property.
 * Returns one reward (does NOT mutate the source array).
 */
function weightedRandom(rewards) {
    const totalWeight = rewards.reduce((sum, r) => sum + r.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const reward of rewards) {
        roll -= reward.weight;
        if (roll <= 0) return reward;
    }
    return rewards[rewards.length - 1]; // fallback safety
}

/**
 * Given an array of reward objects, find the one with the highest rarity rank
 * value (i.e., the weakest / cheapest item). Used for disconnect protection.
 */
function findWorstReward(rewards) {
    return rewards.reduce((worst, r) => {
        const wRank = config.rarityRank[r.rarity] ?? 99;
        const cRank = config.rarityRank[worst.rarity] ?? 99;
        return wRank > cRank ? r : worst;
    }, rewards[0]);
}

/**
 * Build the "safe" reward payload that can be sent to the CEF without
 * leaking positional information. Just the reward details, no session index.
 */
function buildClientReward(reward) {
    return {
        id:          reward.id,
        type:        reward.type,
        name:        reward.name,
        icon:        reward.icon,
        rarity:      reward.rarity,
        description: reward.description,
        // Safe to send value/itemId — player will see these in the reveal anyway
        value:       reward.value  || 0,
        itemId:      reward.itemId || null,
        count:       reward.count  || 0,
    };
}

/**
 * Build the drop-table preview data for the preview UI screen.
 * Shows all possible rewards with their calculated percentages.
 */
function buildPreviewData(packDef) {
    const totalWeight = packDef.rewards.reduce((s, r) => s + r.weight, 0);
    return {
        packId:      packDef.id,
        packName:    packDef.name,
        description: packDef.description,
        theme:       packDef.theme,
        cardCount:   packDef.cardCount,
        rerollCosts: config.rerollCosts,
        rewards: packDef.rewards.map(r => ({
            id:          r.id,
            name:        r.name,
            icon:        r.icon,
            rarity:      r.rarity,
            description: r.description,
            chance:      ((r.weight / totalWeight) * 100).toFixed(2),
            rarityMeta:  config.rarities[r.rarity],
        })),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  ECONOMY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deduct Premium Points from a player. Returns false and notifies if insufficient.
 */
async function deductPP(player, amount) {
    if ((player.data.premiumPoints || 0) < amount) {
        player.call('showNotification', ['Card Pack', `~r~Not enough Premium Points! Need ${amount} PP.`]);
        return false;
    }
    player.data.premiumPoints -= amount;
    await db.query('UPDATE characters SET premium_points = ? WHERE id = ?',
        [player.data.premiumPoints, player.data.dbId]);
    return true;
}

/**
 * Apply a reward to a player. Handles cash, PP, and item types.
 */
async function applyReward(player, reward) {
    const inv = getInventory();

    if (reward.type === 'cash') {
        player.data.money = (player.data.money || 0) + reward.value;
        await db.query('UPDATE characters SET money = ? WHERE id = ?',
            [player.data.money, player.data.dbId]);
        player.call('showNotification', ['Card Pack', `~g~Received $${reward.value.toLocaleString()}!`]);
    }
    else if (reward.type === 'pp') {
        player.data.premiumPoints = (player.data.premiumPoints || 0) + reward.value;
        await db.query('UPDATE characters SET premium_points = ? WHERE id = ?',
            [player.data.premiumPoints, player.data.dbId]);
        player.call('showNotification', ['Card Pack', `~y~Received ${reward.value} Premium Points!`]);
    }
    else if (reward.type === 'item') {
        await inv.addItem(player, reward.itemId, reward.count || 1);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SESSION MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

function clearSession(player) {
    if (player.data) player.data.packSession = null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  EVENT HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

class CardPacksManager {

    constructor() {
        // ── Step 0: Inventory hook ────────────────────────────────────────────
        // Triggered from inventory.js useItem when def.type === 'cardpack'
        mp.events.add('server:cardPack:triggerOpen', (player, item) => {
            this.onTriggerOpen(player, item);
        });

        // ── Step 1: Player confirmed OPEN (pack item consumed here) ───────────
        mp.events.add('server:cardPack:confirmOpen', async (player, itemSlot) => {
            await this.onConfirmOpen(player, itemSlot);
        });

        // ── Step 2: Player cancelled preview ─────────────────────────────────
        mp.events.add('server:cardPack:cancel', (player) => {
            clearSession(player);
        });

        // ── Step 3: Player picks a face-down card ─────────────────────────────
        mp.events.add('server:cardPack:pickCard', async (player, visualIndex) => {
            await this.onPickCard(player, visualIndex);
        });

        // ── Step 4a: Player claims the revealed reward ────────────────────────
        mp.events.add('server:cardPack:claimReward', async (player) => {
            await this.onClaimReward(player);
        });

        // ── Step 4b: Player re-rolls (burns current card, picks again) ─────────
        mp.events.add('server:cardPack:reRoll', async (player) => {
            await this.onReRoll(player);
        });

        // ── ANTI-EXPLOIT: Disconnect protection ───────────────────────────────
        // If a player disconnects mid-session, forcibly deliver the worst
        // remaining reward to their CityBox offline storage.
        mp.events.add('playerQuit', (player) => {
            this.onPlayerQuit(player);
        });

        console.log('[CardPacks] System initialized.');
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  HANDLER: triggerOpen — sends preview data to CEF without consuming item
    // ─────────────────────────────────────────────────────────────────────────
    onTriggerOpen(player, item) {
        if (!player.data) return;

        // Prevent opening multiple packs simultaneously
        if (player.data.packSession) {
            player.call('showNotification', ['Card Pack', '~r~You already have a pack open!']);
            return;
        }

        const def = ItemRegistry[item.itemId];
        if (!def || def.type !== 'cardpack' || !def.data || !def.data.packId) return;

        const packDef = config.packs[def.data.packId];
        if (!packDef) {
            console.error(`[CardPacks] Unknown pack ID: ${def.data.packId}`);
            return;
        }

        // Store the slot so confirmOpen can find and remove it
        player.data.packSession = {
            status:    'preview',
            packId:    def.data.packId,
            itemSlot:  item.slot,
            rewards:   null,   // generated on confirm
            pending:   null,   // the revealed-but-not-yet-claimed reward
            rerollIdx: 0,      // index into rerollCosts
        };

        const preview = buildPreviewData(packDef);
        player.call('client:cardPack:openPreview', [JSON.stringify(preview)]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  HANDLER: confirmOpen — consumes item, generates session, starts spectacle
    // ─────────────────────────────────────────────────────────────────────────
    async onConfirmOpen(player, itemSlot) {
        const session = player.data && player.data.packSession;
        if (!session || session.status !== 'preview') {
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'No active preview session.' })]);
            return;
        }

        const inv = getInventory();
        const item = player.inventory && player.inventory.find(i => i.slot === session.itemSlot);

        if (!item || item.slot !== itemSlot) {
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'Pack item not found.' })]);
            clearSession(player);
            return;
        }

        const def = ItemRegistry[item.itemId];
        if (!def || def.data.packId !== session.packId) {
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'Pack mismatch.' })]);
            clearSession(player);
            return;
        }

        const packDef = config.packs[session.packId];
        if (!packDef) return;

        // ── Consume the item BEFORE the animation starts (anti-exploit) ───────
        try {
            await inv.removeItem(player, item);
            inv.syncClient(player);
        } catch (err) {
            console.error('[CardPacks] Failed to remove item:', err);
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'Could not consume pack.' })]);
            clearSession(player);
            return;
        }

        // ── Generate all 5 rewards (server-side only) ─────────────────────────
        const generatedRewards = [];
        for (let i = 0; i < packDef.cardCount; i++) {
            generatedRewards.push(weightedRandom(packDef.rewards));
        }

        // Update session to 'active'
        session.status  = 'active';
        session.rewards = [...generatedRewards]; // mutable pool for picks
        session.pending = null;
        session.rerollIdx = 0;

        // Send ALL reward details to CEF for the face-up spectacle.
        // Position ≠ reward (server randomises at pick-time), so this is safe.
        const clientRewards = generatedRewards.map(buildClientReward);

        player.call('client:cardPack:startUnboxing', [JSON.stringify({
            packId:      session.packId,
            theme:       packDef.theme,
            cardCount:   packDef.cardCount,
            rewards:     clientRewards,    // shown face-up for 5 seconds
            rerollCosts: config.rerollCosts,
        })]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  HANDLER: pickCard — draws a RANDOM reward from the remaining pool
    //  The visualIndex param is ignored for reward assignment (anti-cheat).
    // ─────────────────────────────────────────────────────────────────────────
    async onPickCard(player, visualIndex) {
        const session = player.data && player.data.packSession;
        if (!session || session.status !== 'active' || !session.rewards || session.rewards.length === 0) {
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'No active session or pool empty.' })]);
            return;
        }

        // Pop a RANDOM reward from the pool (index not correlated to visualIndex)
        const poolSize = session.rewards.length;
        const randomPoolIdx = Math.floor(Math.random() * poolSize);
        const [chosenReward] = session.rewards.splice(randomPoolIdx, 1);

        session.pending = chosenReward;
        session.status  = 'awaiting_claim';

        player.call('client:cardPack:revealCard', [JSON.stringify({
            visualIndex,
            reward:       buildClientReward(chosenReward),
            rerollCost:   config.rerollCosts[session.rerollIdx] || null,
            canReroll:    session.rewards.length > 0,
        })]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  HANDLER: claimReward — applies the pending reward and ends the session
    // ─────────────────────────────────────────────────────────────────────────
    async onClaimReward(player) {
        const session = player.data && player.data.packSession;
        if (!session || session.status !== 'awaiting_claim' || !session.pending) {
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'Nothing to claim.' })]);
            return;
        }

        const reward = session.pending;

        try {
            await applyReward(player, reward);
        } catch (err) {
            console.error('[CardPacks] Failed to apply reward:', err);
        }

        clearSession(player);
        player.call('client:cardPack:sessionEnd', [JSON.stringify({ success: true })]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  HANDLER: reRoll — deducts PP, discards pending reward, allows another pick
    // ─────────────────────────────────────────────────────────────────────────
    async onReRoll(player) {
        const session = player.data && player.data.packSession;
        if (!session || session.status !== 'awaiting_claim') {
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'Cannot re-roll right now.' })]);
            return;
        }

        if (session.rewards.length === 0) {
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'No cards remaining to re-roll into.' })]);
            return;
        }

        const cost = config.rerollCosts[session.rerollIdx];
        if (!cost) {
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'Maximum re-rolls reached.' })]);
            return;
        }

        const ok = await deductPP(player, cost);
        if (!ok) return; // deductPP sends its own notification

        // Discard pending, allow the player to pick again
        session.pending   = null;
        session.rerollIdx = Math.min(session.rerollIdx + 1, config.rerollCosts.length - 1);
        session.status    = 'active';

        const nextCost = config.rerollCosts[session.rerollIdx] || null;

        player.call('client:cardPack:rerollReady', [JSON.stringify({
            ppBalance:     player.data.premiumPoints,
            nextRerollCost: nextCost,
            remaining:     session.rewards.length,
        })]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  HANDLER: playerQuit — ANTI-EXPLOIT disconnect protection
    //
    //  If a player disconnects with an open pack session (to avoid spending PP
    //  on a re-roll by simply alt+F4ing), we forcibly deliver the WORST
    //  remaining reward to their CityBox offline storage.
    // ─────────────────────────────────────────────────────────────────────────
    async onPlayerQuit(player) {
        if (!player.data || !player.data.packSession) return;

        const session = player.data.packSession;
        const userId  = player.data.dbId;

        if (!userId) return;

        // Collect all unclaimed rewards
        const unclaimed = [];

        if (session.pending)             unclaimed.push(session.pending);
        if (session.rewards && session.rewards.length > 0) unclaimed.push(...session.rewards);

        if (unclaimed.length === 0) return;

        const worstReward = findWorstReward(unclaimed);

        console.log(`[CardPacks] Disconnect protection: player ${player.name} (id:${userId}) ` +
                    `quit with active session. Delivering "${worstReward.name}" to CityBox.`);

        try {
            const inv = getInventory();

            if (worstReward.type === 'cash') {
                // Can't send cash to citybox (no physical form), so send a note item or
                // just credit money directly since they disconnected with the pack consumed.
                // We insert a DB row directly here since player is already offline.
                await db.query('UPDATE characters SET money = money + ? WHERE id = ?',
                    [worstReward.value, userId]);
                console.log(`[CardPacks] Credited $${worstReward.value} directly to offline character.`);
            }
            else if (worstReward.type === 'pp') {
                await db.query('UPDATE characters SET premium_points = premium_points + ? WHERE id = ?',
                    [worstReward.value, userId]);
                console.log(`[CardPacks] Credited ${worstReward.value} PP to offline character.`);
            }
            else if (worstReward.type === 'item') {
                // addItemToBox works with just a userId — perfect for offline delivery
                await inv.addItemToBox(userId, worstReward.itemId, worstReward.count || 1);
                console.log(`[CardPacks] Delivered ${worstReward.count}x ${worstReward.itemId} to CityBox.`);
            }
        } catch (err) {
            console.error('[CardPacks] Disconnect protection delivery failed:', err);
        }

        // Clean up session
        player.data.packSession = null;
    }
}

module.exports = new CardPacksManager();
