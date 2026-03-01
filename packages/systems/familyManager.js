// packages/systems/familyManager.js
// ─────────────────────────────────────────────────────────────────────────────
//  Families System — Core Manager
// ─────────────────────────────────────────────────────────────────────────────
const db            = require('../core/database');
const playerManager = require('../core/playerManager');
const HouseManager  = require('./houseManager');

const CREATION_COST  = 200000;
const UPGRADE_COST   = 75000;
const UPGRADE_AMOUNT = 10;
const MAX_TAG_LEN    = 4;
const INVITE_TTL_MS  = 60000; // 1 minute

// ── Colour helper ────────────────────────────────────────────────────────────
function hexToRgbArr(hex) {
    const h = hex.replace('#', '');
    return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
        255
    ];
}
function makeTag(name) {
    return name.replace(/\s+/g, '').substring(0, MAX_TAG_LEN).toUpperCase();
}

class FamilyManager {
    constructor() {
        this.families     = new Map(); // id  → family obj
        this.memberIndex  = new Map(); // userId → familyId
        this.pendingInvites = new Map(); // targetUserId → { familyId, inviterName, timer }
        this.loaded       = false;
    }

    // ── Boot ─────────────────────────────────────────────────────────────────
    async loadAll() {
        try {
            const [famRows] = await db.query('SELECT * FROM families');
            const [memRows] = await db.query('SELECT * FROM family_members');

            this.families.clear();
            this.memberIndex.clear();

            for (const row of famRows) {
                const family = this._rowToFamily(row);
                this.families.set(family.id, family);
                // Mark HQ on house object in-memory
                if (family.hqHouseId) {
                    const house = HouseManager.getHouseById(family.hqHouseId);
                    if (house) {
                        house.hqFamilyId = family.id;
                        if (house.label) house.label.text += '\n~y~[Family HQ]';
                    }
                }
            }

            for (const row of memRows) {
                const fam = this.families.get(row.family_id);
                if (!fam) continue;
                fam.members.push({ userId: row.user_id, username: row.username, rank: row.rank });
                this.memberIndex.set(row.user_id, row.family_id);
            }

            this.loaded = true;
            console.log(`[FamilyManager] Loaded ${this.families.size} families.`);
        } catch (err) {
            console.error('[FamilyManager] loadAll error:', err);
        }
    }

    _rowToFamily(row) {
        return {
            id:               row.id,
            name:             row.name,
            tag:              row.tag,
            color:            row.color,
            ownerId:          row.owner_id,
            bank:             row.bank,
            memberCap:        row.member_cap,
            hqHouseId:        row.hq_house_id || null,
            applicationsOpen: !!row.applications_open,
            invitesOpen:      !!row.invites_open,
            description:      row.description || '',
            ranks: [
                { rank: 1, name: row.rank1_name, color: row.rank1_color },
                { rank: 2, name: row.rank2_name, color: row.rank2_color },
                { rank: 3, name: row.rank3_name, color: row.rank3_color },
                { rank: 4, name: row.rank4_name, color: row.rank4_color },
                { rank: 5, name: row.rank5_name, color: row.rank5_color },
            ],
            members: []
        };
    }

    // ── On Login ─────────────────────────────────────────────────────────────
    async setupPlayerFamily(player, userId) {
        try {
            const famId = this.memberIndex.get(userId);
            if (!famId) {
                player.data.familyId   = null;
                player.data.familyRank = 0;
                player.setVariable('familyTag',          null);
                player.setVariable('familyChatColor',    null);
                player.setVariable('familyNametagColor', null);
                return;
            }
            const fam    = this.families.get(famId);
            const member = fam?.members.find(m => m.userId === userId);
            if (!fam || !member) return;
            this._applyPlayerVars(player, fam, member.rank);
        } catch (err) {
            console.error('[FamilyManager] setupPlayerFamily error:', err);
        }
    }

    _applyPlayerVars(player, family, rank) {
        player.data.familyId   = family.id;
        player.data.familyRank = rank;
        player.setVariable('familyTag',          family.tag);
        player.setVariable('familyName',         family.name);
        player.setVariable('familyChatColor',    family.color.replace('#', ''));
        player.setVariable('familyNametagColor', hexToRgbArr(family.color));
    }

    _clearPlayerVars(player) {
        player.data.familyId   = null;
        player.data.familyRank = 0;
        player.setVariable('familyTag',          null);
        player.setVariable('familyName',         null);
        player.setVariable('familyChatColor',    null);
        player.setVariable('familyNametagColor', null);
    }

    // ── Lookups ───────────────────────────────────────────────────────────────
    getFamilyById(id)       { return this.families.get(id) || null; }
    getFamilyByPlayer(p)    { return this.getFamilyByUserId(p.data.dbId); }
    getFamilyByUserId(uid)  {
        const fid = this.memberIndex.get(uid);
        return fid ? (this.families.get(fid) || null) : null;
    }
    getMemberData(family, userId) {
        return family.members.find(m => m.userId === userId) || null;
    }

    // ── Create Family ─────────────────────────────────────────────────────────
    async createFamily(player, { name, tag, color, description, ranks }) {
        if (this.getFamilyByPlayer(player)) return player.outputChatBox('!{FF0000}You are already in a family.');

        name = name.trim().substring(0, 50);
        if (!name || name.length < 3) return player.outputChatBox('!{FF0000}Family name must be at least 3 characters.');
        if (/[^a-zA-Z0-9\s_-]/.test(name)) return player.outputChatBox('!{FF0000}Invalid family name. Use letters, numbers, spaces, _ or -.');
        if (!/^#[0-9A-Fa-f]{6}$/.test(color)) color = '#FFFFFF';
        description = (description || '').trim().substring(0, 200);

        // Tag: use provided tag if valid, otherwise auto-generate from name
        let finalTag = '';
        if (tag && /^[A-Z0-9]{1,4}$/i.test(tag.trim())) {
            finalTag = tag.trim().toUpperCase().substring(0, 4);
        } else {
            finalTag = makeTag(name);
        }

        const [existing] = await db.query('SELECT id FROM families WHERE name = ?', [name]);
        if (existing.length) return player.outputChatBox(`!{FF0000}A family named "${name}" already exists.`);

        if (!(await playerManager.removeMoneyAndSave(player, CREATION_COST, 'Family Creation'))) {
            return player.outputChatBox(`!{FF0000}You need $${CREATION_COST.toLocaleString()} to create a family.`);
        }

        // Build rank data
        const safeRanks = this._sanitizeRanks(ranks);

        try {
            const [res] = await db.query(
                `INSERT INTO families (name, tag, color, owner_id, description,
                 rank1_name, rank2_name, rank3_name, rank4_name, rank5_name,
                 rank1_color, rank2_color, rank3_color, rank4_color, rank5_color)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
                    name, finalTag, color, player.data.dbId, description,
                    safeRanks[0].name, safeRanks[1].name, safeRanks[2].name, safeRanks[3].name, safeRanks[4].name,
                    safeRanks[0].color, safeRanks[1].color, safeRanks[2].color, safeRanks[3].color, safeRanks[4].color
                ]
            );
            const newFamilyId = res.insertId;

            await db.query(
                'INSERT INTO family_members (family_id, user_id, username, rank) VALUES (?,?,?,5)',
                [newFamilyId, player.data.dbId, player.name]
            );

            // Cache
            const family = {
                id: newFamilyId, name, tag: finalTag, color,
                ownerId: player.data.dbId, bank: 0,
                memberCap: 25, hqHouseId: null,
                applicationsOpen: false, invitesOpen: true,
                description,
                ranks: safeRanks.map((r, i) => ({ rank: i + 1, name: r.name, color: r.color })),
                members: [{ userId: player.data.dbId, username: player.name, rank: 5 }]
            };
            this.families.set(newFamilyId, family);
            this.memberIndex.set(player.data.dbId, newFamilyId);

            this._applyPlayerVars(player, family, 5);
            player.outputChatBox(`!{00FF00}Family "!{${color.replace('#','')}${name}!{00FF00}" created! You are the Leader.`);
            console.log(`[FamilyManager] ${player.name} created family "${name}" (ID: ${newFamilyId})`);
            
            // Refresh playerMenu UI
            mp.events.call('server:playerMenu:getData', player);
        } catch (err) {
            // Refund on DB failure
            await playerManager.addMoneyAndSave(player, CREATION_COST, 'Family Creation Refund');
            console.error('[FamilyManager] createFamily error:', err);
            player.outputChatBox('!{FF0000}Server error creating family. Refunded.');
        }
    }

    _sanitizeRanks(raw) {
        const defaults = [
            { name: 'Recruit',  color: '#AAAAAA' },
            { name: 'Member',   color: '#FFFFFF' },
            { name: 'Veteran',  color: '#00AAFF' },
            { name: 'Officer',  color: '#FFAA00' },
            { name: 'Leader',   color: '#FF4444' },
        ];
        if (!Array.isArray(raw) || raw.length < 5) return defaults;
        return raw.slice(0, 5).map((r, i) => ({
            name:  (r.name  || defaults[i].name).trim().substring(0, 30),
            color: /^#[0-9A-Fa-f]{6}$/.test(r.color) ? r.color : defaults[i].color
        }));
    }

    // ── Invite System ─────────────────────────────────────────────────────────
    sendInvite(inviter, targetPlayer) {
        const fam = this.getFamilyByPlayer(inviter);
        if (!fam) return inviter.outputChatBox('!{FF0000}You are not in a family.');

        const inviterMember = this.getMemberData(fam, inviter.data.dbId);
        if (!inviterMember || inviterMember.rank < 4)
            return inviter.outputChatBox('!{FF0000}Only Officers (Rank 4+) can invite players.');

        if (this.getFamilyByPlayer(targetPlayer))
            return inviter.outputChatBox('!{FF0000}That player is already in a family.');

        if (fam.members.length >= fam.memberCap)
            return inviter.outputChatBox(`!{FF0000}Family is full (${fam.memberCap} members max).`);

        if (this.pendingInvites.has(targetPlayer.data.dbId))
            return inviter.outputChatBox('!{FF0000}That player already has a pending invite.');

        const timer = setTimeout(() => {
            this.pendingInvites.delete(targetPlayer.data.dbId);
            if (mp.players.exists(targetPlayer)) {
                targetPlayer.outputChatBox(`!{FF4444}[Family] Invite from family "${fam.name}" expired.`);
            }
        }, INVITE_TTL_MS);

        this.pendingInvites.set(targetPlayer.data.dbId, { familyId: fam.id, inviterName: inviter.name, timer });

        const tagColor = fam.color.replace('#', '');
        inviter.outputChatBox(`!{00FF00}Invite sent to ${targetPlayer.name}.`);
        targetPlayer.outputChatBox(`!{${tagColor}}[Family Invite] !{FFFFFF}${inviter.name} invited you to join !{${tagColor}}${fam.name}!{FFFFFF}.`);
        targetPlayer.outputChatBox(`!{FFFF00}Type /faccept to join or /fdecline to refuse. Expires in 60s.`);
    }

    async acceptInvite(player) {
        const invite = this.pendingInvites.get(player.data.dbId);
        if (!invite) return player.outputChatBox('!{FF0000}You have no pending family invite.');

        clearTimeout(invite.timer);
        this.pendingInvites.delete(player.data.dbId);

        const fam = this.families.get(invite.familyId);
        if (!fam) return player.outputChatBox('!{FF0000}That family no longer exists.');
        if (this.getFamilyByPlayer(player)) return player.outputChatBox('!{FF0000}You are already in a family.');
        if (fam.members.length >= fam.memberCap) return player.outputChatBox('!{FF0000}Family is now full.');

        await this._addMember(player, fam, 1);
    }

    declineInvite(player) {
        const invite = this.pendingInvites.get(player.data.dbId);
        if (!invite) return player.outputChatBox('!{FF0000}You have no pending invite.');
        clearTimeout(invite.timer);
        this.pendingInvites.delete(player.data.dbId);
        player.outputChatBox('!{FF4444}Invite declined.');
    }

    // ── Direct Join (no-apply families) ──────────────────────────────────────
    async directJoin(player, familyId) {
        if (this.getFamilyByPlayer(player)) return player.outputChatBox('!{FF0000}You are already in a family.');
        const fam = this.families.get(familyId);
        if (!fam) return player.outputChatBox('!{FF0000}Family not found.');
        if (!fam.invitesOpen) return player.outputChatBox('!{FF0000}That family is not accepting members right now.');
        if (fam.members.length >= fam.memberCap) return player.outputChatBox('!{FF0000}Family is full.');
        await this._addMember(player, fam, 1);
    }

    // ── Applications ──────────────────────────────────────────────────────────
    async apply(player, familyId) {
        if (this.getFamilyByPlayer(player)) return player.outputChatBox('!{FF0000}You are already in a family.');
        const fam = this.families.get(familyId);
        if (!fam) return player.outputChatBox('!{FF0000}Family not found.');
        if (!fam.applicationsOpen) return player.outputChatBox('!{FF0000}That family is not accepting applications.');
        if (fam.members.length >= fam.memberCap) return player.outputChatBox('!{FF0000}Family is full.');

        try {
            await db.query(
                'INSERT IGNORE INTO family_applications (family_id, user_id, username) VALUES (?,?,?)',
                [familyId, player.data.dbId, player.name]
            );
            player.outputChatBox(`!{00FF00}Application sent to "${fam.name}". Wait for the leader to review it.`);
            // Notify online owner/officers
            mp.players.toArray().forEach(p => {
                if (p.data.familyId === familyId && p.data.familyRank >= 4) {
                    p.outputChatBox(`!{FFAA00}[Family] ${player.name} applied to join!`);
                }
            });
        } catch (err) {
            player.outputChatBox('!{FF0000}You already applied to this family.');
        }
    }

    async acceptApplication(owner, applicantUserId) {
        const fam = this.getFamilyByPlayer(owner);
        if (!fam || fam.ownerId !== owner.data.dbId) return owner.outputChatBox('!{FF0000}Only the family owner can manage applications.');
        if (fam.members.length >= fam.memberCap) return owner.outputChatBox('!{FF0000}Family is full. Upgrade member cap first.');

        const [rows] = await db.query(
            'SELECT user_id, username FROM family_applications WHERE family_id = ? AND user_id = ?',
            [fam.id, applicantUserId]
        );
        if (!rows.length) return owner.outputChatBox('!{FF0000}Application not found.');

        await db.query('DELETE FROM family_applications WHERE family_id = ? AND user_id = ?', [fam.id, applicantUserId]);

        const applicant = mp.players.toArray().find(p => p.data.dbId === applicantUserId);
        if (applicant && mp.players.exists(applicant)) {
            await this._addMember(applicant, fam, 1);
        } else {
            // Offline join
            try {
                await db.query(
                    'INSERT INTO family_members (family_id, user_id, username, rank) VALUES (?,?,?,1)',
                    [fam.id, applicantUserId, rows[0].username]
                );
                fam.members.push({ userId: applicantUserId, username: rows[0].username, rank: 1 });
                this.memberIndex.set(applicantUserId, fam.id);
                owner.outputChatBox(`!{00FF00}${rows[0].username} has been accepted into the family.`);
            } catch (err) { console.error(err); }
        }
        // Push fresh family data instantly to owner's browser
        try {
            const freshData = await this.getPlayerMenuData(owner);
            owner.call('client:family:pushData', [JSON.stringify(freshData)]);
        } catch(e) { mp.events.call('server:playerMenu:getData', owner); }
    }

    async rejectApplication(owner, applicantUserId) {
        const fam = this.getFamilyByPlayer(owner);
        if (!fam || fam.ownerId !== owner.data.dbId) return owner.outputChatBox('!{FF0000}Only the family owner can manage applications.');
        const [rows] = await db.query('SELECT username FROM family_applications WHERE family_id = ? AND user_id = ?', [fam.id, applicantUserId]);
        await db.query('DELETE FROM family_applications WHERE family_id = ? AND user_id = ?', [fam.id, applicantUserId]);
        const name = rows.length ? rows[0].username : 'Applicant';
        // Push fresh family data instantly to owner's browser
        try {
            const freshData = await this.getPlayerMenuData(owner);
            owner.call('client:family:pushData', [JSON.stringify(freshData)]);
        } catch(e) { mp.events.call('server:playerMenu:getData', owner); }
    }

    // ── Internal add member ───────────────────────────────────────────────────
    async _addMember(player, family, rank) {
        try {
            await db.query(
                'INSERT INTO family_members (family_id, user_id, username, rank) VALUES (?,?,?,?)',
                [family.id, player.data.dbId, player.name, rank]
            );
            family.members.push({ userId: player.data.dbId, username: player.name, rank });
            this.memberIndex.set(player.data.dbId, family.id);
            this._applyPlayerVars(player, family, rank);

            const tagColor = family.color.replace('#', '');
            player.outputChatBox(`!{00FF00}You joined family !{${tagColor}}${family.name}!{00FF00}!`);
            this._broadcastToFamily(family, `!{${tagColor}}[Family] !{FFFFFF}${player.name} joined the family!`, []);
            
            // Refresh playerMenu UI
            mp.events.call('server:playerMenu:getData', player);
        } catch (err) {
            console.error('[FamilyManager] _addMember error:', err);
            player.outputChatBox('!{FF0000}Failed to join family. Please try again.');
        }
    }

    // ── Leave / Kick ──────────────────────────────────────────────────────────
    async leaveFamily(player) {
        const fam = this.getFamilyByPlayer(player);
        if (!fam) return player.outputChatBox('!{FF0000}You are not in a family.');
        if (fam.ownerId === player.data.dbId)
            return player.outputChatBox('!{FF0000}You are the owner. Transfer ownership (/fpromote <id> 5) or disband (/fdisband).');
        await this._removeMember(player.data.dbId, fam);
        this._clearPlayerVars(player);
        player.outputChatBox('!{FFFF00}You left the family.');
        this._broadcastToFamily(fam, `!{FFAA00}[Family] ${player.name} left the family.`, []);
        mp.events.call('server:playerMenu:getData', player);
    }

    async kickMember(owner, targetUserId) {
        const fam = this.getFamilyByPlayer(owner);
        if (!fam || fam.ownerId !== owner.data.dbId) return owner.outputChatBox('!{FF0000}Only the family owner can kick members.');
        if (targetUserId === owner.data.dbId) return owner.outputChatBox('!{FF0000}You cannot kick yourself.');
        const mem = this.getMemberData(fam, targetUserId);
        if (!mem) return owner.outputChatBox('!{FF0000}That player is not in your family.');

        await this._removeMember(targetUserId, fam);
        owner.outputChatBox(`!{00FF00}${mem.username} was kicked from the family.`);
        this._broadcastToFamily(fam, `!{FF4444}[Family] ${mem.username} was kicked.`, []);

        const target = mp.players.toArray().find(p => p.data.dbId === targetUserId);
        if (target && mp.players.exists(target)) {
            this._clearPlayerVars(target);
            target.outputChatBox('!{FF4444}You were kicked from the family.');
        }
        await this._pushFreshData(owner);
    }

    async _removeMember(userId, family) {
        await db.query('DELETE FROM family_members WHERE family_id = ? AND user_id = ?', [family.id, userId]);
        family.members = family.members.filter(m => m.userId !== userId);
        this.memberIndex.delete(userId);
    }

    // ── Rank Management ───────────────────────────────────────────────────────
    async setMemberRank(owner, targetUserId, newRank) {
        const fam = this.getFamilyByPlayer(owner);
        if (!fam || fam.ownerId !== owner.data.dbId)
            return owner.outputChatBox('!{FF0000}Only the family owner can change ranks.');

        newRank = parseInt(newRank);
        if (isNaN(newRank) || newRank < 1 || newRank > 5)
            return owner.outputChatBox('!{FF0000}Invalid rank. Must be 1-5.');

        if (targetUserId === owner.data.dbId) {
            // Owner cannot self-promote past 5 or self-demote below 4 (they stay owner always)
            return owner.outputChatBox('!{FF0000}Use /fpromote <id> 5 to transfer ownership to another player.');
        }

        const mem = this.getMemberData(fam, targetUserId);
        if (!mem) return owner.outputChatBox('!{FF0000}Player not found in your family.');

        // Transfer ownership: promoting someone to rank 5
        if (newRank === 5) {
            // Demote current owner to rank 4
            const ownerMem = this.getMemberData(fam, owner.data.dbId);
            ownerMem.rank = 4;
            await db.query('UPDATE family_members SET rank = 4 WHERE family_id = ? AND user_id = ?', [fam.id, owner.data.dbId]);

            // Promote target to rank 5 + update owner_id
            mem.rank = 5;
            fam.ownerId = targetUserId;
            await db.query('UPDATE family_members SET rank = 5 WHERE family_id = ? AND user_id = ?', [fam.id, targetUserId]);
            await db.query('UPDATE families SET owner_id = ? WHERE id = ?', [targetUserId, fam.id]);

            this._applyPlayerVars(owner, fam, 4);
            owner.outputChatBox(`!{FFAA00}You transferred ownership to ${mem.username}. You are now Rank 4.`);

            const newOwner = mp.players.toArray().find(p => p.data.dbId === targetUserId);
            if (newOwner && mp.players.exists(newOwner)) {
                this._applyPlayerVars(newOwner, fam, 5);
                newOwner.outputChatBox(`!{00FF00}You are now the Leader of "${fam.name}"!`);
            }
            this._broadcastToFamily(fam, `!{FFAA00}[Family] ${mem.username} is the new Leader!`, []);
            return;
        }

        mem.rank = newRank;
        await db.query('UPDATE family_members SET rank = ? WHERE family_id = ? AND user_id = ?', [newRank, fam.id, targetUserId]);

        const rankInfo = fam.ranks[newRank - 1];
        owner.outputChatBox(`!{00FF00}${mem.username} is now ${rankInfo.name} (Rank ${newRank}).`);
        this._broadcastToFamily(fam, `!{FFAA00}[Family] ${mem.username} is now ${rankInfo.name}.`, []);

        const target = mp.players.toArray().find(p => p.data.dbId === targetUserId);
        if (target && mp.players.exists(target)) {
            this._applyPlayerVars(target, fam, newRank);
            target.outputChatBox(`!{FFAA00}Your family rank changed to ${rankInfo.name} (Rank ${newRank}).`);
        }
        await this._pushFreshData(owner);
    }

    // ── Family Bank ───────────────────────────────────────────────────────────
    async bankDeposit(player, amount) {
        const fam = this.getFamilyByPlayer(player);
        if (!fam) return player.outputChatBox('!{FF0000}You are not in a family.');
        
        amount = parseInt(amount);
        if (isNaN(amount) || amount <= 0) return player.outputChatBox('!{FF0000}Invalid amount.');
        if (player.data.money < amount) return player.outputChatBox('!{FF0000}Not enough cash.');
        
        await playerManager.removeMoneyAndSave(player, amount, 'Family Bank Deposit');
        fam.bank += amount;
        await db.query('UPDATE families SET bank = ? WHERE id = ?', [fam.bank, fam.id]);
        
        player.outputChatBox(`!{00FF00}Deposited $${amount.toLocaleString()} into the family bank. Balance: $${fam.bank.toLocaleString()}`);
        this._broadcastToFamily(fam, `!{FFAA00}[Family] ${player.name} deposited $${amount.toLocaleString()} to the bank.`, [player.data.dbId]);
        await this._pushFreshData(player);
    }

    // ── HQ ────────────────────────────────────────────────────────────────────
    async setHQ(owner) {
        const fam = this.getFamilyByPlayer(owner);
        if (!fam || fam.ownerId !== owner.data.dbId)
            return owner.outputChatBox('!{FF0000}Only the family owner can set the HQ.');
        const house = HouseManager.getHouseByOwner(owner.data.dbId);
        if (!house) return owner.outputChatBox('!{FF0000}You don\'t own a house. Buy one first.');

        // Clear old HQ
        if (fam.hqHouseId) {
            const old = HouseManager.getHouseById(fam.hqHouseId);
            if (old) { old.hqFamilyId = null; old.label.text = old.label.text.replace('\n~y~[Family HQ]', ''); }
        }

        fam.hqHouseId = house.id;
        house.hqFamilyId = fam.id;
        await db.query('UPDATE families SET hq_house_id = ? WHERE id = ?', [house.id, fam.id]);

        if (house.label) house.label.text += '\n~y~[Family HQ]';
        owner.outputChatBox(`!{00FF00}House #${house.id} is now the family HQ!`);
        owner.outputChatBox(`!{FFFF00}Members will be able to spawn here and non-members are locked out.`);
        this._broadcastToFamily(fam, `!{FFAA00}[Family] HQ has been set at House #${house.id}!`, [owner.data.dbId]);
        await this._pushFreshData(owner);
    }

    // ── Upgrade Cap ───────────────────────────────────────────────────────────
    async upgradeCap(owner) {
        const fam = this.getFamilyByPlayer(owner);
        if (!fam || fam.ownerId !== owner.data.dbId)
            return owner.outputChatBox('!{FF0000}Only the family owner can upgrade.');
        
        if (fam.bank < UPGRADE_COST) {
            return owner.outputChatBox(`!{FF0000}Insufficient family bank funds. Need $${UPGRADE_COST.toLocaleString()}, have $${fam.bank.toLocaleString()}.`);
        }
        
        fam.bank -= UPGRADE_COST;
        fam.memberCap += UPGRADE_AMOUNT;
        
        await db.query('UPDATE families SET member_cap = ?, bank = ? WHERE id = ?', [fam.memberCap, fam.bank, fam.id]);
        
        owner.outputChatBox(`!{00FF00}Member cap upgraded to ${fam.memberCap}! Cost: $${UPGRADE_COST.toLocaleString()} (from family bank)`);
        this._broadcastToFamily(fam, `!{FFAA00}[Family] Member capacity upgraded to ${fam.memberCap}!`, [owner.data.dbId]);
        await this._pushFreshData(owner);
    }

    // ── Toggle Settings ───────────────────────────────────────────────────────
    async toggleApplications(owner) {
        const fam = this.getFamilyByPlayer(owner);
        if (!fam || fam.ownerId !== owner.data.dbId) return;
        fam.applicationsOpen = !fam.applicationsOpen;
        await db.query('UPDATE families SET applications_open = ? WHERE id = ?', [fam.applicationsOpen ? 1 : 0, fam.id]);
        owner.outputChatBox(`!{FFAA00}Applications are now ${fam.applicationsOpen ? '!{00FF00}OPEN' : '!{FF0000}CLOSED'}.`);
        await this._pushFreshData(owner);
    }

    async toggleInvites(owner) {
        const fam = this.getFamilyByPlayer(owner);
        if (!fam || fam.ownerId !== owner.data.dbId) return;
        fam.invitesOpen = !fam.invitesOpen;
        await db.query('UPDATE families SET invites_open = ? WHERE id = ?', [fam.invitesOpen ? 1 : 0, fam.id]);
        owner.outputChatBox(`!{FFAA00}Direct joins are now ${fam.invitesOpen ? '!{00FF00}OPEN' : '!{FF0000}CLOSED'}.`);
        await this._pushFreshData(owner);
    }

    // ── Change Tag ────────────────────────────────────────────────────────────
    async setTag(owner, newTag) {
        const fam = this.getFamilyByPlayer(owner);
        if (!fam || fam.ownerId !== owner.data.dbId)
            return owner.outputChatBox('!{FF0000}Only the family owner can change the tag.');

        newTag = String(newTag).toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4);
        if (!newTag || newTag.length < 1)
            return owner.outputChatBox('!{FF0000}Invalid tag. Use 1-4 letters/numbers.');

        fam.tag = newTag;
        await db.query('UPDATE families SET tag = ? WHERE id = ?', [newTag, fam.id]);

        // Update all online members' synced variable
        mp.players.toArray().forEach(p => {
            if (p.data.familyId === fam.id) {
                p.setVariable('familyTag', newTag);
            }
        });

        const clr = fam.color.replace('#', '');
        owner.outputChatBox(`!{00FF00}Family tag updated to !{${clr}}[${newTag}]!{00FF00}.`);
        this._broadcastToFamily(fam, `!{${clr}}[Family] !{FFFFFF}Tag changed to !{${clr}}[${newTag}]!{FFFFFF}.`, [owner.data.dbId]);
        await this._pushFreshData(owner);
    }

    // ── Change Main Color ─────────────────────────────────────────────────────
    async setMainColor(owner, newColor) {
        const fam = this.getFamilyByPlayer(owner);
        if (!fam || fam.ownerId !== owner.data.dbId)
            return owner.outputChatBox('!{FF0000}Only the family owner can change colors.');

        if (!/^#[0-9A-Fa-f]{6}$/.test(newColor))
            return owner.outputChatBox('!{FF0000}Invalid color format. Use #RRGGBB.');

        fam.color = newColor.toUpperCase();
        await db.query('UPDATE families SET color = ? WHERE id = ?', [fam.color, fam.id]);

        // Update all online members' synced variables
        mp.players.toArray().forEach(p => {
            if (p.data.familyId === fam.id) {
                p.setVariable('familyChatColor', fam.color.replace('#', ''));
                p.setVariable('familyNametagColor', hexToRgbArr(fam.color));
            }
        });

        const clr = fam.color.replace('#', '');
        owner.outputChatBox(`!{00FF00}Family color updated to !{${clr}}${fam.color}!{00FF00}.`);
        this._broadcastToFamily(fam, `!{${clr}}[Family] !{FFFFFF}Main color changed to !{${clr}}${fam.color}!{FFFFFF}.`, [owner.data.dbId]);
        
        await this._pushFreshData(owner);
    }

    // ── Change Rank Color ─────────────────────────────────────────────────────
    async setRankColor(owner, rank, newColor) {
        const fam = this.getFamilyByPlayer(owner);
        if (!fam || fam.ownerId !== owner.data.dbId)
            return owner.outputChatBox('!{FF0000}Only the family owner can change rank colors.');

        rank = parseInt(rank);
        if (isNaN(rank) || rank < 1 || rank > 5)
            return owner.outputChatBox('!{FF0000}Invalid rank. Must be 1-5.');

        if (!/^#[0-9A-Fa-f]{6}$/.test(newColor))
            return owner.outputChatBox('!{FF0000}Invalid color format. Use #RRGGBB.');

        const rankObj = fam.ranks[rank - 1];
        rankObj.color = newColor.toUpperCase();

        const dbCol = `rank${rank}_color`;
        await db.query(`UPDATE families SET ${dbCol} = ? WHERE id = ?`, [rankObj.color, fam.id]);

        const clr = rankObj.color.replace('#', '');
        owner.outputChatBox(`!{00FF00}Rank ${rank} (${rankObj.name}) color updated to !{${clr}}${rankObj.color}!{00FF00}.`);
        
        await this._pushFreshData(owner);
    }

    // ── Disband ───────────────────────────────────────────────────────────────
    async disband(owner) {
        const fam = this.getFamilyByPlayer(owner);
        if (!fam || fam.ownerId !== owner.data.dbId)
            return owner.outputChatBox('!{FF0000}Only the family owner can disband.');

        // Clear HQ
        if (fam.hqHouseId) {
            const house = HouseManager.getHouseById(fam.hqHouseId);
            if (house) { house.hqFamilyId = null; }
        }

        // Notify all online members
        mp.players.toArray().forEach(p => {
            if (p.data.familyId === fam.id) {
                this._clearPlayerVars(p);
                if (p.data.dbId !== owner.data.dbId) {
                    p.outputChatBox(`!{FF4444}[Family] "${fam.name}" has been disbanded.`);
                }
            }
        });

        // Remove from cache
        fam.members.forEach(m => this.memberIndex.delete(m.userId));
        this.families.delete(fam.id);

        // DB (cascade deletes members & applications)
        await db.query('DELETE FROM families WHERE id = ?', [fam.id]);

        this._clearPlayerVars(owner);
        owner.outputChatBox(`!{FF4444}Family "${fam.name}" has been disbanded.`);
        console.log(`[FamilyManager] Family "${fam.name}" (ID: ${fam.id}) disbanded by ${owner.name}.`);
        mp.events.call('server:playerMenu:getData', owner);
    }

    // ── Family Chat ───────────────────────────────────────────────────────────
    familyChat(player, message) {
        const fam = this.getFamilyByPlayer(player);
        if (!fam) return player.outputChatBox('!{FF0000}You are not in a family.');
        const member  = this.getMemberData(fam, player.data.dbId);
        const rankClr = fam.ranks[member.rank - 1].color.replace('#', '');
        const famClr  = fam.color.replace('#', '');
        const formatted = `!{${famClr}}[${fam.tag}] !{${rankClr}}${player.name}!{FFFFFF}: ${message}`;
        this._broadcastToFamily(fam, formatted, []);
    }

    // ── PlayerMenu Data ───────────────────────────────────────────────────────

    async cancelApplication(player) {
        if (this.getFamilyByPlayer(player)) return;
        await db.query('DELETE FROM family_applications WHERE user_id = ?', [player.data.dbId]);
        mp.events.call('server:playerMenu:getData', player);
    }
    async getPlayerMenuData(player) {
        const fam = this.getFamilyByPlayer(player);

        if (!fam) {
            // Check if this player has a pending application
            let pendingApplicationFamilyId = null;
            try {
                const [pendRows] = await db.query(
                    'SELECT family_id FROM family_applications WHERE user_id = ? LIMIT 1',
                    [player.data.dbId]
                );
                if (pendRows.length) pendingApplicationFamilyId = pendRows[0].family_id;
            } catch(e) {}

            return {
                inFamily: false,
                pendingApplicationFamilyId,
                families: Array.from(this.families.values()).map(f => ({
                    id:               f.id,
                    name:             f.name,
                    tag:              f.tag,
                    color:            f.color,
                    memberCount:      f.members.length,
                    memberCap:        f.memberCap,
                    applicationsOpen: f.applicationsOpen,
                    invitesOpen:      f.invitesOpen,
                    description:      f.description
                }))
            };
        }

        const onlineIds    = new Set(mp.players.toArray().filter(p => p.data?.dbId).map(p => p.data.dbId));
        const memberData   = this.getMemberData(fam, player.data.dbId);
        const isOwner      = fam.ownerId === player.data.dbId;

        const result = {
            inFamily:         true,
            id:               fam.id,
            name:             fam.name,
            tag:              fam.tag,
            color:            fam.color,
            rank:             memberData.rank,
            rankName:         fam.ranks[memberData.rank - 1].name,
            rankColor:        fam.ranks[memberData.rank - 1].color,
            bank:             fam.bank,
            memberCap:        fam.memberCap,
            memberCount:      fam.members.length,
            hqHouseId:        fam.hqHouseId,
            applicationsOpen: fam.applicationsOpen,
            invitesOpen:      fam.invitesOpen,
            description:      fam.description,
            isOwner,
            upgradeCost:      UPGRADE_COST,
            upgradeAmount:    UPGRADE_AMOUNT,
            ranks:            fam.ranks,
            members:          fam.members.map(m => ({
                userId:    m.userId,
                username:  m.username,
                rank:      m.rank,
                rankName:  fam.ranks[m.rank - 1].name,
                rankColor: fam.ranks[m.rank - 1].color,
                online:    onlineIds.has(m.userId)
            })).sort((a, b) => b.rank - a.rank || a.username.localeCompare(b.username)),
            applications: []
        };

        if (isOwner) {
            try {
                const [apps] = await db.query(
                    'SELECT user_id, username, applied_at FROM family_applications WHERE family_id = ? ORDER BY applied_at ASC',
                    [fam.id]
                );
                result.applications = apps.map(a => ({
                    userId:    a.user_id,
                    username:  a.username,
                    appliedAt: a.applied_at
                }));
            } catch (e) { /* no-op */ }
        }

        return result;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    _broadcastToFamily(family, message, excludeUserIds) {
        mp.players.toArray().forEach(p => {
            if (p.data.familyId === family.id && !excludeUserIds.includes(p.data.dbId)) {
                p.outputChatBox(message);
            }
        });
    }

    async _pushFreshData(player) {
        try {
            const freshData = await this.getPlayerMenuData(player);
            player.call('client:family:pushData', [JSON.stringify(freshData)]);
        } catch(e) {
            mp.events.call('server:playerMenu:getData', player);
        }
    }
}

const instance = new FamilyManager();

// ── Server Events ─────────────────────────────────────────────────────────────

mp.events.add('server:family:create', async (player, jsonStr) => {
    if (!player.logged) return;
    try { await instance.createFamily(player, JSON.parse(jsonStr)); } catch (e) { console.error(e); }
});

mp.events.add('server:family:invite', (player, targetId) => {
    if (!player.logged) return;
    const target = mp.players.toArray().find(p => p.data.onlineId == targetId || p.name.toLowerCase().includes(String(targetId).toLowerCase()));
    if (!target) return player.outputChatBox('!{FF0000}Player not found.');
    instance.sendInvite(player, target);
});

mp.events.add('server:family:acceptInvite', async (player) => {
    if (!player.logged) return;
    await instance.acceptInvite(player);
});

mp.events.add('server:family:declineInvite', (player) => {
    if (!player.logged) return;
    instance.declineInvite(player);
});

mp.events.add('server:family:directJoin', async (player, familyId) => {
    if (!player.logged) return;
    await instance.directJoin(player, parseInt(familyId));
});

mp.events.add('server:family:apply', async (player, familyId) => {
    if (!player.logged) return;
    await instance.apply(player, parseInt(familyId));
});

mp.events.add('server:family:cancelApplication', async (player) => {
    if (!player.logged) return;
    await instance.cancelApplication(player);
});

mp.events.add('server:family:acceptApp', async (player, applicantUserId) => {
    if (!player.logged) return;
    await instance.acceptApplication(player, parseInt(applicantUserId));
});

mp.events.add('server:family:rejectApp', async (player, applicantUserId) => {
    if (!player.logged) return;
    await instance.rejectApplication(player, parseInt(applicantUserId));
});

mp.events.add('server:family:leave', async (player) => {
    if (!player.logged) return;
    await instance.leaveFamily(player);
});

mp.events.add('server:family:kick', async (player, targetUserId) => {
    if (!player.logged) return;
    await instance.kickMember(player, parseInt(targetUserId));
});

mp.events.add('server:family:setRank', async (player, targetUserId, newRank) => {
    if (!player.logged) return;
    await instance.setMemberRank(player, parseInt(targetUserId), parseInt(newRank));
});

mp.events.add('server:family:setHQ', async (player) => {
    if (!player.logged) return;
    await instance.setHQ(player);
});

mp.events.add('server:family:bankDeposit', async (player, amount) => {
    if (!player.logged) return;
    await instance.bankDeposit(player, amount);
});

mp.events.add('server:family:upgrade', async (player) => {
    if (!player.logged) return;
    await instance.upgradeCap(player);
});

mp.events.add('server:family:toggleApplications', async (player) => {
    if (!player.logged) return;
    await instance.toggleApplications(player);
});

mp.events.add('server:family:toggleInvites', async (player) => {
    if (!player.logged) return;
    await instance.toggleInvites(player);
});

mp.events.add('server:family:setTag', async (player, tag) => {
    if (!player.logged) return;
    await instance.setTag(player, tag);
});

mp.events.add('server:family:setMainColor', async (player, color) => {
    if (!player.logged) return;
    await instance.setMainColor(player, color);
});

mp.events.add('server:family:setRankColor', async (player, rank, color) => {
    if (!player.logged) return;
    await instance.setRankColor(player, rank, color);
});

mp.events.add('server:family:disband', async (player) => {
    if (!player.logged) return;
    await instance.disband(player);
});

mp.events.add('server:family:spawn', (player) => {
    if (!player.logged) return;
    const fam = instance.getFamilyByPlayer(player);
    if (!fam || !fam.hqHouseId) return player.outputChatBox('!{FF0000}Your family has no HQ set.');
    const house = HouseManager.getHouseById(fam.hqHouseId);
    if (!house) return player.outputChatBox('!{FF0000}HQ house not found.');
    const INTERIORS = { motel: { x: 151.45, y: -1007.57, z: -99.00 }, low_end: { x: 266.00, y: -1007.00, z: -101.00 }, medium: { x: 346.52, y: -1012.42, z: -99.20 }, modern: { x: -786.86, y: 315.76, z: 217.63 }, luxury: { x: -1459.17, y: -520.58, z: 56.92 } };
    const pos = INTERIORS[house.interior] || INTERIORS['motel'];
    player.position  = new mp.Vector3(pos.x, pos.y, pos.z);
    player.dimension = house.id;
    player.outputChatBox('!{00FF00}Spawned at Family HQ!');
});

module.exports = instance;