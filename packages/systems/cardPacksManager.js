'use strict';

/**
 * cardPacksManager.js  (server-side)
 *
 * SECURITY MODEL:
 *   - All rewards are stored server-side in a Map keyed by player.id.
 *   - The client/CEF never learns which face-down card hides which reward.
 *   - When a card is picked, the server draws RANDOMLY from the pool —
 *     visual card position is irrelevant. Memory-reading the CEF is useless.
 *
 * SESSION STORAGE:
 *   Sessions are kept in a module-level Map<playerId, session> instead of
 *   player.data, which avoids RAGE:MP entity-property snapshot issues that
 *   cause mutations made across async gaps to be lost.
 */

const config       = require('../data/cardPacksConfig');
const ItemRegistry = require('../data/items');
const db           = require('../core/database');

let inventorySystem = null;
const getInventory = () => {
    if (!inventorySystem) inventorySystem = require('./inventory');
    return inventorySystem;
};

// ─── SESSION STORE ────────────────────────────────────────────────────────────
const sessions = new Map();

function getSession(player)          { return sessions.get(player.id) || null; }
function setSession(player, session) { sessions.set(player.id, session); }
function clearSession(player)        { sessions.delete(player.id); }
function hasSession(player)          { return sessions.has(player.id); }

// ─── PURE HELPERS ─────────────────────────────────────────────────────────────

function weightedRandom(rewards) {
    const total = rewards.reduce((s, r) => s + r.weight, 0);
    let roll = Math.random() * total;
    for (const r of rewards) {
        roll -= r.weight;
        if (roll <= 0) return r;
    }
    return rewards[rewards.length - 1];
}

function findWorstReward(rewards) {
    return rewards.reduce((worst, r) => {
        const wRank = config.rarityRank[r.rarity]     ?? 99;
        const cRank = config.rarityRank[worst.rarity] ?? 99;
        return wRank > cRank ? r : worst;
    }, rewards[0]);
}

function buildClientReward(r) {
    return {
        id:          r.id,
        type:        r.type,
        name:        r.name,
        icon:        r.icon,
        rarity:      r.rarity,
        description: r.description,
        value:       r.value  || 0,
        itemId:      r.itemId || null,
        count:       r.count  || 0,
    };
}

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

// ─── ECONOMY HELPERS ──────────────────────────────────────────────────────────

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

async function applyReward(player, reward) {
    const inv = getInventory();
    if (reward.type === 'cash') {
        player.data.money = (player.data.money || 0) + reward.value;
        await db.query('UPDATE characters SET money = ? WHERE id = ?',
            [player.data.money, player.data.dbId]);
        player.call('showNotification', ['Card Pack', `~g~Received $${reward.value.toLocaleString()}!`]);
    } else if (reward.type === 'pp') {
        player.data.premiumPoints = (player.data.premiumPoints || 0) + reward.value;
        await db.query('UPDATE characters SET premium_points = ? WHERE id = ?',
            [player.data.premiumPoints, player.data.dbId]);
        player.call('showNotification', ['Card Pack', `~y~Received ${reward.value} Premium Points!`]);
    } else if (reward.type === 'item') {
        await inv.addItem(player, reward.itemId, reward.count || 1);
    }
}

// ─── MANAGER ─────────────────────────────────────────────────────────────────

class CardPacksManager {

    constructor() {

        mp.events.add('server:cardPack:triggerOpen', (player, item) => {
            this.onTriggerOpen(player, item);
        });

        mp.events.add('server:cardPack:confirmOpen', async (player) => {
            await this.onConfirmOpen(player);
        });

        mp.events.add('server:cardPack:cancel', (player) => {
            clearSession(player);
        });

        mp.events.add('server:cardPack:pickCard', async (player, visualIndex) => {
            await this.onPickCard(player, visualIndex);
        });

        mp.events.add('server:cardPack:claimReward', async (player) => {
            await this.onClaimReward(player);
        });

        mp.events.add('server:cardPack:reRoll', async (player) => {
            await this.onReRoll(player);
        });

        mp.events.add('playerQuit', (player) => {
            this.onPlayerQuit(player);
        });

        console.log('[CardPacks] System initialized.');
    }

    onTriggerOpen(player, item) {
        if (hasSession(player)) {
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

        setSession(player, {
            status:    'preview',
            packId:    def.data.packId,
            itemSlot:  item.slot,
            rewards:   null,
            pending:   null,
            rerollIdx: 0,
        });

        const preview = { ...buildPreviewData(packDef), itemSlot: item.slot };
        player.call('client:cardPack:openPreview', [JSON.stringify(preview)]);
    }

    async onConfirmOpen(player) {
        const session = getSession(player);

        if (!session || session.status !== 'preview') {
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'No active preview session.' })]);
            clearSession(player);
            return;
        }

        // Lock immediately to block double-confirm
        session.status = 'opening';
        setSession(player, session);

        const inv  = getInventory();
        const item = player.inventory && player.inventory.find(i => i.slot === session.itemSlot);

        if (!item) {
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'Pack item not found.' })]);
            clearSession(player);
            return;
        }

        const def = ItemRegistry[item.itemId];
        if (!def || !def.data || def.data.packId !== session.packId) {
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'Pack mismatch.' })]);
            clearSession(player);
            return;
        }

        const packDef = config.packs[session.packId];
        if (!packDef) {
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'Pack config not found.' })]);
            clearSession(player);
            return;
        }

        // Consume item before animation
        try {
            await inv.removeItem(player, item);
            inv.syncClient(player);
        } catch (err) {
            console.error('[CardPacks] removeItem failed:', err);
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'Could not consume pack.' })]);
            clearSession(player);
            return;
        }

        // Generate rewards
        const generatedRewards = [];
        for (let i = 0; i < packDef.cardCount; i++) {
            generatedRewards.push(weightedRandom(packDef.rewards));
        }

        // Write the fully updated session back to the Map atomically
        setSession(player, {
            status:    'active',
            packId:    session.packId,
            itemSlot:  session.itemSlot,
            rewards:   generatedRewards.slice(),
            pending:   null,
            rerollIdx: 0,
        });

        const clientRewards = generatedRewards.map(buildClientReward);
        player.call('client:cardPack:startUnboxing', [JSON.stringify({
            packId:      session.packId,
            theme:       packDef.theme,
            cardCount:   packDef.cardCount,
            rewards:     clientRewards,
            rerollCosts: config.rerollCosts,
        })]);
    }

    async onPickCard(player, visualIndex) {
        const session = getSession(player);

        if (!session) {
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'No active session.' })]);
            return;
        }
        if (session.status !== 'active') {
            player.call('client:cardPack:error', [JSON.stringify({ msg: `Session not ready (${session.status}).` })]);
            clearSession(player);
            return;
        }
        if (!session.rewards || session.rewards.length === 0) {
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'Reward pool is empty.' })]);
            clearSession(player);
            return;
        }

        const randomIdx    = Math.floor(Math.random() * session.rewards.length);
        const chosenReward = session.rewards.splice(randomIdx, 1)[0];

        session.pending = chosenReward;
        session.status  = 'awaiting_claim';
        setSession(player, session);

        player.call('client:cardPack:revealCard', [JSON.stringify({
            visualIndex,
            reward:     buildClientReward(chosenReward),
            rerollCost: config.rerollCosts[session.rerollIdx] || null,
            canReroll:  session.rewards.length > 0,
        })]);
    }

    async onClaimReward(player) {
        const session = getSession(player);

        if (!session || session.status !== 'awaiting_claim' || !session.pending) {
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'Nothing to claim.' })]);
            clearSession(player);
            return;
        }

        const reward = session.pending;
        clearSession(player); // clear first — prevents double-claim

        try {
            await applyReward(player, reward);
        } catch (err) {
            console.error('[CardPacks] applyReward failed:', err);
        }

        player.call('client:cardPack:sessionEnd', [JSON.stringify({ success: true })]);
    }

    async onReRoll(player) {
        const session = getSession(player);

        if (!session || session.status !== 'awaiting_claim') {
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'Cannot re-roll right now.' })]);
            clearSession(player);
            return;
        }
        if (session.rewards.length === 0) {
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'No cards left to re-roll into.' })]);
            clearSession(player);
            return;
        }

        const cost = config.rerollCosts[session.rerollIdx];
        if (!cost) {
            player.call('client:cardPack:error', [JSON.stringify({ msg: 'Maximum re-rolls reached.' })]);
            return;
        }

        const ok = await deductPP(player, cost);
        if (!ok) return;

        session.pending   = null;
        session.rerollIdx = Math.min(session.rerollIdx + 1, config.rerollCosts.length - 1);
        session.status    = 'active';
        setSession(player, session);

        player.call('client:cardPack:rerollReady', [JSON.stringify({
            ppBalance:      player.data.premiumPoints,
            nextRerollCost: config.rerollCosts[session.rerollIdx] || null,
            remaining:      session.rewards.length,
        })]);
    }

    async onPlayerQuit(player) {
        const session = getSession(player);
        if (!session) return;

        const userId = player.data && player.data.dbId;
        if (!userId) { clearSession(player); return; }

        const unclaimed = [];
        if (session.pending)                               unclaimed.push(session.pending);
        if (session.rewards && session.rewards.length > 0) unclaimed.push(...session.rewards);

        clearSession(player);
        if (unclaimed.length === 0) return;

        const worst = findWorstReward(unclaimed);
        console.log(`[CardPacks] Disconnect: ${player.name} (${userId}) — delivering "${worst.name}" to CityBox.`);

        try {
            const inv = getInventory();
            if (worst.type === 'cash') {
                await db.query('UPDATE characters SET money = money + ? WHERE id = ?', [worst.value, userId]);
            } else if (worst.type === 'pp') {
                await db.query('UPDATE characters SET premium_points = premium_points + ? WHERE id = ?', [worst.value, userId]);
            } else if (worst.type === 'item') {
                await inv.addItemToBox(userId, worst.itemId, worst.count || 1);
            }
        } catch (err) {
            console.error('[CardPacks] Disconnect delivery failed:', err);
        }
    }
}

module.exports = new CardPacksManager();
