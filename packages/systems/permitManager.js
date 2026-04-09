// packages/systems/permitManager.js
// ─────────────────────────────────────────────────────────────────────────────
//  Family Business Permit System
//  • 30-day cycles per business
//  • Weighted raffle with PP (Premium Points) tickets
//  • Full refund for losers
//  • 5% passive commission on player transactions
//  • One delivery mission per member per cycle (50/50 split with family safe)
//  • Anti-monopoly: one permit per family, per tier ticket caps
// ─────────────────────────────────────────────────────────────────────────────

const db            = require('../core/database');
const playerManager = require('../core/playerManager');
const FamilyManager = require('./familyManager');

// ── Config ────────────────────────────────────────────────────────────────────
const PP_PER_TICKET   = 100;          // Premium Points cost per raffle ticket
const CYCLE_DAYS      = 30;           // Lease duration in days
const RAFFLE_DAYS     = 7;            // Raffle duration in days
const TICK_INTERVAL   = 60 * 1000;    // How often to check for expired cycles (60s)

// ── Modular Delivery Missions ───────────────────────────────────────────────
const MISSIONS = {
    convenience: {
        missionType: 'van',
        spawn: { x: 12.8, y: -2478.4, z: 6.0, heading: 0 }, // Docks/Port
        dropoffs: [
            { x: 373.87, y: 325.85, z: 103.56 }, // Clinton Ave 24/7
            { x: 25.49, y: -1345.73, z: 29.49 }, // Innocence Blvd 24/7
            { x: -707.67, y: -914.22, z: 19.21 },// Little Seoul 24/7
            { x: 1135.80, y: -982.28, z: 46.41 } // El Rancho Blvd 24/7
        ],
        model: 'rumpo3' // A delivery van
    },
    default: {
        missionType: 'checkpoint',
        pickup: { x: 47.83, y: -1761.50, z: 29.42 }, // default point
        dropoff: { x: -49.93, y: -1747.13, z: 29.42 } // default point
    }
};

// ── In-memory state ───────────────────────────────────────────────────────────
//  businesses   : Map<businessId, businessRow>
//  activeCycles : Map<businessId, cycleRow>  — status='active' cycles
//  openCycles   : Map<businessId, cycleRow>  — status='open' (raffle not drawn yet)

class PermitManager {
    constructor() {
        this.businesses   = new Map();
        this.activeCycles = new Map();  // businessId → cycle (winner set)
        this.openCycles   = new Map();  // businessId → cycle (open raffle)
        this._tick        = null;
    }

    // ── Boot ──────────────────────────────────────────────────────────────────
    async loadAll() {
        try {
            await db.query(`ALTER TABLE permit_cycles MODIFY expires_at TIMESTAMP NULL DEFAULT NULL`);
        } catch (err) {}

        try {
            const [bizRows] = await db.query(
                'SELECT * FROM businesses WHERE active = 1 ORDER BY tier ASC, id ASC'
            );
            for (const b of bizRows) this.businesses.set(b.id, b);

            // Load all non-expired cycles
            const [cycleRows] = await db.query(
                `SELECT * FROM permit_cycles WHERE status IN ('open','active') ORDER BY id ASC`
            );
            for (const c of cycleRows) {
                if (c.status === 'active') this.activeCycles.set(c.business_id, c);
                else                       this.openCycles.set(c.business_id, c);
            }

            // Ensure every active business has an open cycle
            for (const [bizId] of this.businesses) {
                if (!this.activeCycles.has(bizId) && !this.openCycles.has(bizId)) {
                    await this._openNewCycle(bizId);
                }
            }

            console.log(`[PermitManager] Loaded ${this.businesses.size} businesses, ` +
                        `${this.activeCycles.size} active leases, ${this.openCycles.size} open raffles.`);

            this._tick = setInterval(() => this._checkExpirations(), TICK_INTERVAL);
        } catch (err) {
            console.error('[PermitManager] loadAll error:', err);
        }
    }

    // ── Cycle helpers ─────────────────────────────────────────────────────────
    async _openNewCycle(bizId) {
        // Starts with NULL expires_at to indicate timer hasn't started
        const [res] = await db.query(
            `INSERT INTO permit_cycles (business_id, family_id, expires_at, status)
             VALUES (?, NULL, NULL, 'open')`,
            [bizId]
        );
        const cycle = { id: res.insertId, business_id: bizId, family_id: null, expires_at: null, status: 'open' };
        this.openCycles.set(bizId, cycle);
        return cycle;
    }

    async _checkExpirations() {
        const now = Date.now();

        // Check active cycles
        for (const [bizId, cycle] of this.activeCycles) {
            const expireTime = new Date(cycle.expires_at).getTime();
            
            // Check if within 7 days of expiration, and open a new raffle if one doesn't exist
            if (expireTime - now <= RAFFLE_DAYS * 24 * 60 * 60 * 1000) {
                if (!this.openCycles.has(bizId)) {
                    await this._openNewCycle(bizId);
                    const biz = this.businesses.get(bizId);
                    mp.players.forEach(p => {
                        if (p.logged) p.outputChatBox(`!{FFFF00}[City Hall] Raffle for !{FFFFFF}${biz.name}!{FFFF00} is now open! It will remain open for 7 days once first entry is placed.`);
                    });
                }
            }

            // Check if lease expired
            if (expireTime <= now) {
                await this._expireCycle(bizId, cycle);
            }
        }

        // Check open cycles that somehow passed the draw window (safety net)
        for (const [bizId, cycle] of this.openCycles) {
            if (cycle.expires_at && new Date(cycle.expires_at).getTime() <= now) {
                
                // Attempt to draw the raffle automatically
                const drawResult = await this.drawRaffle(bizId);
                
                if (!drawResult.success) {
                    // If it failed because NOBODY entered, clear the timer
                    if (drawResult.error === 'No entries in this raffle.') {
                        await db.query(`UPDATE permit_cycles SET expires_at=NULL WHERE id=?`, [cycle.id]);
                        cycle.expires_at = null;
                        console.log(`[PermitManager] Raffle timer for biz ${bizId} paused due to zero entries.`);
                    } else {
                        console.error(`[PermitManager] Failed to draw raffle for biz ${bizId}: ${drawResult.error}`);
                    }
                }
            }
        }
    }

    async _expireCycle(bizId, cycle) {
        try {
            const biz = this.businesses.get(bizId);
            if (!biz) return;

            // Mark expired
            await db.query(`UPDATE permit_cycles SET status='expired' WHERE id=?`, [cycle.id]);
            this.activeCycles.delete(bizId);

            // Notify online family members
            if (cycle.family_id) {
                this._notifyFamily(cycle.family_id,
                    `!{FFAA00}[Permit] Your permit for !{FFFFFF}${biz.name}!{FFAA00} has expired. The city has reclaimed the lease.`
                );
            }

            console.log(`[PermitManager] Permit for "${biz.name}" (cycle ${cycle.id}) expired.`);

            // Open a fresh raffle immediately if none exists
            if (!this.openCycles.has(bizId)) {
                await this._openNewCycle(bizId);
            }
        } catch (err) {
            console.error('[PermitManager] _expireCycle error:', err);
        }
    }

    // ── Draw Raffle ───────────────────────────────────────────────────────────
    async drawRaffle(bizId) {
        const cycle = this.openCycles.get(bizId);
        if (!cycle) return { success: false, error: 'No open cycle for this business.' };

        const [entries] = await db.query(
            'SELECT * FROM permit_entries WHERE cycle_id = ?', [cycle.id]
        );
        if (!entries.length) return { success: false, error: 'No entries in this raffle.' };

        // Filter out monopolies
        const validEntries = [];
        for (const entry of entries) {
            let hasMonopoly = false;
            for (const [, actCycle] of this.activeCycles) {
                if (actCycle.family_id === entry.family_id) {
                    hasMonopoly = true; break;
                }
            }
            if (hasMonopoly) {
                // Refund them now since they can't win
                if (!entry.refunded) await this._refundEntry(entry);
                continue;
            } else {
                validEntries.push(entry);
            }
        }

        if (!validEntries.length) return { success: false, error: 'No entries in this raffle.' };

        // Build weighted pool
        const pool = [];
        for (const entry of validEntries) {
            for (let t = 0; t < entry.tickets; t++) pool.push(entry.family_id);
        }
        const winnerFamilyId = pool[Math.floor(Math.random() * pool.length)];

        const expiresAt = new Date(Date.now() + CYCLE_DAYS * 24 * 60 * 60 * 1000);

        // Update cycle → active with winner
        await db.query(
            `UPDATE permit_cycles SET family_id=?, status='active', started_at=NOW(), expires_at=? WHERE id=?`,
            [winnerFamilyId, expiresAt, cycle.id]
        );
        cycle.family_id  = winnerFamilyId;
        cycle.status     = 'active';
        cycle.expires_at = expiresAt;
        this.openCycles.delete(bizId);
        this.activeCycles.set(bizId, cycle);

        // Refund losers
        for (const entry of entries) {
            if (entry.family_id !== winnerFamilyId && !entry.refunded) {
                await this._refundEntry(entry);
            }
        }

        const biz    = this.businesses.get(bizId);
        const winner = FamilyManager.getFamilyById(winnerFamilyId);

        // Notify winner family
        if (winner) {
            this._notifyFamily(winnerFamilyId,
                `!{00FF00}[City Hall] Your family won the permit for !{FFFFFF}${biz.name}!{00FF00}! ` +
                `Lease runs for ${CYCLE_DAYS} days. Earn PP delivering goods and passive commissions.`
            );
        }

        // Notify losers
        for (const entry of entries) {
            if (entry.family_id !== winnerFamilyId) {
                this._notifyFamily(entry.family_id,
                    `!{FF8800}[City Hall] Raffle for !{FFFFFF}${biz.name}!{FF8800} was won by ` +
                    `!{FFFF00}${winner ? winner.name : 'another family'}!{FF8800}. Your PP has been refunded.`
                );
            }
        }

        console.log(`[PermitManager] Raffle for "${biz.name}" drawn. Winner: family ${winnerFamilyId}.`);
        return { success: true, winnerFamilyId, bizName: biz.name };
    }

    async _refundEntry(entry) {
        try {
            // Credit PP back to family bank
            const fam = FamilyManager.getFamilyById(entry.family_id);
            if (fam) {
                fam.premiumPoints += entry.pp_spent;
                await db.query('UPDATE families SET premium_points = ? WHERE id = ?', [fam.premiumPoints, entry.family_id]);
            }
            await db.query('UPDATE permit_entries SET refunded = 1 WHERE id = ?', [entry.id]);
        } catch (err) {
            console.error('[PermitManager] _refundEntry error:', err);
        }
    }

    _notifyFamily(familyId, msg) {
        mp.players.forEach(p => {
            if (p.logged && p.data.familyId === familyId) p.outputChatBox(msg);
        });
    }

    // ── Enter Raffle ──────────────────────────────────────────────────────────
    async enterRaffle(player, bizId, ticketCount) {
        if (!player.logged) return;
        bizId       = parseInt(bizId);
        ticketCount = parseInt(ticketCount);

        const biz = this.businesses.get(bizId);
        if (!biz) return player.outputChatBox('!{FF0000}[Permits] Business not found.');

        const cycle = this.openCycles.get(bizId);
        if (!cycle) return player.outputChatBox('!{FF0000}[Permits] This business has no open raffle right now.');

        const family = FamilyManager.getFamilyByPlayer(player);
        if (!family) return player.outputChatBox('!{FF0000}[Permits] You must be in a family to enter a raffle.');

        const memberData = FamilyManager.getMemberData(family, player.data.dbId);
        if (!memberData || memberData.rank < 4)
            return player.outputChatBox('!{FF0000}[Permits] Only Officers (Rank 4+) can enter raffles on behalf of the family.');

        // One permit per family check
        for (const [, actCycle] of this.activeCycles) {
            if (actCycle.family_id === family.id) {
                const ownedBiz = this.businesses.get(actCycle.business_id);
                return player.outputChatBox(`!{FF0000}[Permits] Your family already holds a permit for "${ownedBiz?.name}". ` +
                    `Only one permit allowed per cycle.`);
            }
        }

        // Ticket cap
        if (ticketCount < 1 || ticketCount > biz.max_tickets)
            return player.outputChatBox(`!{FF0000}[Permits] You must buy between 1 and ${biz.max_tickets} tickets.`);

        // Check if already entered
        const [existing] = await db.query(
            'SELECT * FROM permit_entries WHERE cycle_id = ? AND family_id = ?',
            [cycle.id, family.id]
        );
        if (existing.length)
            return player.outputChatBox(`!{FF0000}[Permits] Your family already entered this raffle (${existing[0].tickets} tickets).`);

        const ppCost = ticketCount * PP_PER_TICKET;

        // Deduct PP from family bank
        if (family.premiumPoints < ppCost)
            return player.outputChatBox(`!{FF0000}[Permits] Not enough PP in the family safe. Need ${ppCost} PP (${ticketCount} × ${PP_PER_TICKET}).`);

        family.premiumPoints -= ppCost;
        await db.query('UPDATE families SET premium_points = ? WHERE id = ?', [family.premiumPoints, family.id]);

        await db.query(
            'INSERT INTO permit_entries (cycle_id, family_id, tickets, pp_spent) VALUES (?,?,?,?)',
            [cycle.id, family.id, ticketCount, ppCost]
        );

        player.outputChatBox(`!{00FF00}[Permits] Entered raffle for "${biz.name}" with ${ticketCount} ticket(s). ` +
            `${ppCost} PP locked in (fully refunded if you don't win).`);
        this._notifyFamily(family.id,
            `!{FFAA00}[Permit] ${player.name} entered the raffle for !{FFFFFF}${biz.name}!{FFAA00} ` +
            `with ${ticketCount} ticket(s) (${ppCost} PP).`
        );

        // Start timer if this is the first entry
        if (!cycle.expires_at) {
            const expireDate = new Date(Date.now() + RAFFLE_DAYS * 24 * 60 * 60 * 1000);
            cycle.expires_at = expireDate;
            await db.query('UPDATE permit_cycles SET expires_at = ? WHERE id = ?', [expireDate, cycle.id]);
            mp.players.forEach(p => {
                if (p.logged) p.outputChatBox(`!{FFFF00}[City Hall] The countdown for the "${biz.name}" permit has started! Raffle draws in 7 days.`);
            });
        }
    }

    // ── Passive Commission ────────────────────────────────────────────────────
    //  Call this from any business transaction (e.g., fuel purchase)
    //  businessId  : number   — which business the transaction is at
    //  triggerPlayer : player — the customer spending money
    //  transactionAmt : number — how much they spent (in-game $)
    async handlePassiveCommission(businessId, triggerPlayer, transactionAmt) {
        try {
            const cycle = this.activeCycles.get(businessId);
            if (!cycle || !cycle.family_id) return;

            const biz = this.businesses.get(businessId);
            if (!biz) return;

            const commission = Math.floor(transactionAmt * (biz.passive_pct / 100));
            if (commission <= 0) return;

            const fam = FamilyManager.getFamilyById(cycle.family_id);
            if (!fam) return;

            fam.bank += commission;
            await db.query('UPDATE families SET bank = ? WHERE id = ?', [fam.bank, fam.id]);

            // Log for audit
            await db.query(
                `INSERT INTO permit_passive_log (cycle_id, business_id, trigger_user_id, transaction_amt, commission_amt)
                 VALUES (?,?,?,?,?)`,
                [cycle.id, businessId, triggerPlayer?.data?.dbId || 0, transactionAmt, commission]
            );
        } catch (err) {
            console.error('[PermitManager] handlePassiveCommission error:', err);
        }
    }

    // ── Delivery Mission ──────────────────────────────────────────────────────
    async startDelivery(player, bizId) {
        bizId = parseInt(bizId);
        const biz = this.businesses.get(bizId);
        if (!biz) return player.outputChatBox('!{FF0000}[Permits] Business not found.');

        const cycle = this.activeCycles.get(bizId);
        if (!cycle) return player.outputChatBox('!{FF0000}[Permits] No active permit for this business.');

        const family = FamilyManager.getFamilyByPlayer(player);
        if (!family || family.id !== cycle.family_id)
            return player.outputChatBox('!{FF0000}[Permits] Your family does not own this permit.');

        // Check cooldown (one delivery per member per cycle)
        const [done] = await db.query(
            'SELECT id FROM permit_deliveries WHERE cycle_id = ? AND user_id = ?',
            [cycle.id, player.data.dbId]
        );
        if (done.length)
            return player.outputChatBox('!{FF0000}[Permits] You already completed a delivery for this permit cycle.');

        if (player.data.activePermitDelivery)
            return player.outputChatBox('!{FF0000}[Permits] You are already on a delivery run.');

        const missionDef = MISSIONS[biz.type] || MISSIONS.default;

        let deliveryPayload = {
            bizId,
            bizName:      biz.name,
            bizType:      biz.type,
            missionType:  missionDef.missionType,
            playerPayout: Math.floor(biz.delivery_payout / 2),
            safePayout:   Math.floor(biz.delivery_payout / 2),
        };

        if (missionDef.missionType === 'van') {
            const dropoffArr = missionDef.dropoffs;
            const dropoff = dropoffArr[Math.floor(Math.random() * dropoffArr.length)];

            // Spawn the mission vehicle
            const van = mp.vehicles.new(mp.joaat(missionDef.model), new mp.Vector3(missionDef.spawn.x, missionDef.spawn.y, missionDef.spawn.z), {
                heading: missionDef.spawn.heading || 0,
                dimension: player.dimension
            });
            van.numberPlate = "DELIVERY";
            van.locked = false;

            player.data.activePermitDelivery = {
                type: 'van',
                vehicle: van,
                dropoff: dropoff,
                bizId: bizId
            };

            deliveryPayload.pickup = missionDef.spawn;
            deliveryPayload.dropoff = dropoff;

            player.outputChatBox('!{00FF00}[Mission] A delivery van has been spawned for you at the port. Go get it!');
        } else {
            // Default checkpoint behavior
            player.data.activePermitDelivery = {
                type: 'checkpoint',
                dropoff: missionDef.dropoff,
                bizId: bizId
            };

            deliveryPayload.pickup = missionDef.pickup;
            deliveryPayload.dropoff = missionDef.dropoff;
        }

        // Kick off client-side delivery job
        player.call('client:permit:startDelivery', [JSON.stringify(deliveryPayload)]);
    }

    async completeDelivery(player, bizId) {
        bizId = parseInt(bizId);
        const biz = this.businesses.get(bizId);
        if (!biz) return;

        const cycle = this.activeCycles.get(bizId);
        if (!cycle) return;

        const family = FamilyManager.getFamilyByPlayer(player);
        if (!family || family.id !== cycle.family_id) return;

        const activeDeets = player.data.activePermitDelivery;
        if (!activeDeets || activeDeets.bizId !== bizId) {
            return player.outputChatBox('!{FF0000}[Permits] Invalid delivery payload context.');
        }

        // Guard against double-complete exploits
        const [done] = await db.query(
            'SELECT id FROM permit_deliveries WHERE cycle_id = ? AND user_id = ?',
            [cycle.id, player.data.dbId]
        );
        if (done.length) {
            this._cleanupDelivery(player);
            return;
        }

        const dropoff = activeDeets.dropoff;
        // Anti-Cheat: Verify distance to drop-off point
        const dist = Math.sqrt(
            Math.pow(player.position.x - dropoff.x, 2) +
            Math.pow(player.position.y - dropoff.y, 2) +
            Math.pow(player.position.z - dropoff.z, 2)
        );

        // A van check may be further compared, allow a wider radius due to vehicle footprint
        if (dist > 35.0) {
            console.log(`[Anti-Cheat] Player ${player.name} tried to complete delivery from far away.`);
            return player.outputChatBox('!{FF0000}[Anti-Cheat] You must be at the physical drop-off location.');
        }

        // Validate vehicle for van missions
        if (activeDeets.type === 'van') {
            if (!player.vehicle || player.vehicle.id !== activeDeets.vehicle.id) {
                return player.outputChatBox('!{FF0000}[Anti-Cheat] You must be in your designated delivery van to finish this.');
            }
        }

        const playerPayout = Math.floor(biz.delivery_payout / 2);
        const safePayout   = biz.delivery_payout - playerPayout;

        // Pay player
        await playerManager.addMoneyAndSave(player, playerPayout, 'Permit Delivery');

        // Pay family safe
        family.bank += safePayout;
        await db.query('UPDATE families SET bank = ? WHERE id = ?', [family.bank, family.id]);

        // Log
        await db.query(
            `INSERT INTO permit_deliveries (cycle_id, user_id, family_id, payout_player, payout_safe)
             VALUES (?,?,?,?,?)`,
            [cycle.id, player.data.dbId, family.id, playerPayout, safePayout]
        );

        player.outputChatBox(
            `!{00FF00}[Permit] Delivery complete! You received !{FFFF00}$${playerPayout.toLocaleString()}!{00FF00} ` +
            `and !{FFFF00}$${safePayout.toLocaleString()}!{00FF00} was deposited to the family safe.`
        );
        this._notifyFamily(family.id,
            `!{FFAA00}[Permit] ${player.name} completed a delivery for !{FFFFFF}${biz.name}!{FFAA00}! ` +
            `$${safePayout.toLocaleString()} added to the safe.`
        );

        this._cleanupDelivery(player);
    }

    _cleanupDelivery(player) {
        if (player.data.activePermitDelivery) {
            if (player.data.activePermitDelivery.vehicle && mp.vehicles.exists(player.data.activePermitDelivery.vehicle)) {
                player.data.activePermitDelivery.vehicle.destroy();
            }
            player.data.activePermitDelivery = null;
        }
    }

    // ── Data getters (for UI) ─────────────────────────────────────────────────
    getPermitBoardData(player) {
        const family = FamilyManager.getFamilyByPlayer(player);
        
        // --- ADD THESE TWO LINES ---
        const memberData = family ? FamilyManager.getMemberData(family, player.data.dbId) : null;
        const canEnter   = memberData ? memberData.rank >= 4 : false;
        // ---------------------------

        const result = [];

        for (const [bizId, biz] of this.businesses) {
            const activeCycle = this.activeCycles.get(bizId);
            const openCycle   = this.openCycles.get(bizId);

            let ownerName   = null;
            let isOwnedByMe = false;
            if (activeCycle?.family_id) {
                const ownerFam = FamilyManager.getFamilyById(activeCycle.family_id);
                ownerName   = ownerFam?.name || 'Unknown';
                isOwnedByMe = family?.id === activeCycle.family_id;
            }

            result.push({
                id:             biz.id,
                name:           biz.name,
                tier:           biz.tier,
                type:           biz.type,
                description:    biz.description,
                passivePct:     biz.passive_pct,
                deliveryPayout: biz.delivery_payout,
                maxTickets:     biz.max_tickets,
                ppPerTicket:    PP_PER_TICKET,

                status:         activeCycle ? 'leased' : (openCycle ? 'open_raffle' : 'no_cycle'),
                ownerName,
                isOwnedByMe,
                cycleId:        openCycle?.id || activeCycle?.id || null,
                expiresAt:      activeCycle?.expires_at || null,
                raffleExpiresAt: openCycle?.expires_at || null,
                hasActiveRaffle: !!openCycle,
                canEnter:       canEnter // <-- SEND TO UI
            });
        }

        return result;
    }

    async getRaffleEntries(cycleId) {
        const [rows] = await db.query(
            'SELECT pe.*, f.name AS family_name FROM permit_entries pe ' +
            'LEFT JOIN families f ON f.id = pe.family_id ' +
            'WHERE pe.cycle_id = ?',
            [cycleId]
        );
        return rows;
    }

    getBusinessOwner(bizId) {
        const cycle = this.activeCycles.get(bizId);
        if (!cycle) return null;
        return cycle.family_id;
    }
}

const instance = new PermitManager();

// ── Server Events ─────────────────────────────────────────────────────────────

mp.events.add('server:permit:enterRaffle', async (player, bizId, tickets) => {
    if (!player.logged) return;
    await instance.enterRaffle(player, parseInt(bizId), parseInt(tickets));
});

mp.events.add('server:permit:startDelivery', async (player, bizId) => {
    if (!player.logged) return;
    await instance.startDelivery(player, bizId);
});

mp.events.add('server:permit:completeDelivery', async (player, bizId) => {
    if (!player.logged) return;
    await instance.completeDelivery(player, bizId);
});

mp.events.add('server:permit:getBoardData', (player) => {
    if (!player.logged) return;
    const data = instance.getPermitBoardData(player);
    player.call('client:permit:boardData', [JSON.stringify(data)]);
});

mp.events.add('server:permit:getRaffleEntries', async (player, cycleId) => {
    if (!player.logged) return;
    cycleId = parseInt(cycleId);
    const entries = await instance.getRaffleEntries(cycleId);
    // Always include cycleId so the client can identify the response even when entries is empty
    player.call('client:permit:raffleEntries', [JSON.stringify({ cycleId, entries })]);
});

// Admin-only: manually trigger the raffle draw
mp.events.add('server:permit:adminDraw', async (player, bizId) => {
    if (!player.logged) return;
    // TODO: replace with your server's admin permission check
    if (!player.data.isAdmin) return player.outputChatBox('!{FF0000}Admins only.');
    const result = await instance.drawRaffle(parseInt(bizId));
    if (result.success) {
        player.outputChatBox(`!{00FF00}[Admin] Raffle drawn for "${result.bizName}". Winner family ID: ${result.winnerFamilyId}.`);
    } else {
        player.outputChatBox(`!{FF0000}[Admin] Draw failed: ${result.error}`);
    }
});

instance.loadAll();

module.exports = instance;
