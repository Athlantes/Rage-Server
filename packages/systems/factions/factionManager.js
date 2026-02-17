// packages/systems/factions/factionManager.js
// ─────────────────────────────────────────────────────────────────────────────
//  Factions — Core Manager
//  Definition-based: factions are declared in code (like jobs), not created in-game.
//  Players apply via playerMenu → Factions tab.
//  Leaders manage via playerMenu → Factions tab (manage sub-tab).
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const db = require('../../core/database');

// ── Colour helper ─────────────────────────────────────────────────────────────
function hexToRgb(hex) {
    const h = (hex || '#FFFFFF').replace('#', '');
    return [parseInt(h.slice(0,2),16)||255, parseInt(h.slice(2,4),16)||255, parseInt(h.slice(4,6),16)||255, 255];
}

// ═════════════════════════════════════════════════════════════════════════════
class FactionManager {
    constructor() {
        this._definitions = new Map(); // key → definition object (static, from code)
        this._members     = new Map(); // key → [{ userId, username, rank }]
        this._memberIndex = new Map(); // userId → faction key
        this._apps        = new Map(); // key → [{ userId, username, message, appliedAt }]
        this.cuffed       = new Set(); // userId of cuffed players
        this.loaded       = false;
    }

    // ── Register a definition (called by each definition file) ───────────────
    register(key, definition) {
        if (this._definitions.has(key)) throw new Error(`[Factions] Duplicate key: ${key}`);
        this._definitions.set(key, { key, ...definition, members: [] });
        this._members.set(key, []);
        this._apps.set(key, []);
        // console.log(`[Factions] Registered: ${definition.name} (${key})`);
    }

    // ── Boot: load all DB rows into memory ───────────────────────────────────
    async loadAll() {
        try {
            const [memRows] = await db.query('SELECT * FROM faction_members ORDER BY rank DESC');
            const [appRows] = await db.query('SELECT * FROM faction_applications ORDER BY applied_at ASC');

            for (const row of memRows) {
                if (!this._definitions.has(row.faction_key)) continue;
                this._members.get(row.faction_key).push({ userId: row.user_id, username: row.username, rank: row.rank });
                this._memberIndex.set(row.user_id, row.faction_key);
            }

            for (const row of appRows) {
                if (!this._definitions.has(row.faction_key)) continue;
                this._apps.get(row.faction_key).push({ userId: row.user_id, username: row.username, message: row.message || '', appliedAt: row.applied_at });
            }

            this.loaded = true;
            console.log(`[FactionManager] Loaded ${this._definitions.size} factions, ${memRows.length} members.`);
        } catch (err) {
            console.error('[FactionManager] loadAll error:', err);
        }
    }

    // ── On Login ──────────────────────────────────────────────────────────────
    async setupPlayerFaction(player, userId) {
        const key = this._memberIndex.get(userId);
        if (!key) { this._clearVars(player); return; }
        const def    = this._definitions.get(key);
        const member = this._members.get(key)?.find(m => m.userId === userId);
        if (!def || !member) { this._clearVars(player); return; }
        this._applyVars(player, def, member.rank);
    }

    _applyVars(player, def, rank) {
        const rankObj = def.ranks[rank - 1] || def.ranks[0];
        player.data.factionKey   = def.key;
        player.data.factionRank  = rank;
        player.data.factionType  = def.type;
        player.setVariable('factionKey',          def.key);
        player.setVariable('factionTag',          def.tag);
        player.setVariable('factionColor',        def.color.replace('#',''));
        player.setVariable('factionNametagColor', hexToRgb(def.color));
        player.setVariable('factionRank',         rank);
        player.setVariable('factionRankName',     rankObj.name);
        player.setVariable('factionType',         def.type);
    }

    _clearVars(player) {
        player.data.factionKey   = null;
        player.data.factionRank  = 0;
        player.data.factionType  = null;
        ['factionKey','factionTag','factionColor','factionNametagColor','factionRank','factionRankName','factionType']
            .forEach(v => player.setVariable(v, null));
    }

    // ── Lookups ───────────────────────────────────────────────────────────────
    getDefinition(key)       { return this._definitions.get(key) || null; }
    getDefinitions()         { return this._definitions; }
    getMembersByKey(key)     { return this._members.get(key) || []; }
    getApplicationsByKey(key){ return this._apps.get(key) || []; }
    getFactionKeyByUser(uid) { return this._memberIndex.get(uid) || null; }
    getFactionByPlayer(p)    { return this.getDefinition(this.getFactionKeyByUser(p?.data?.dbId)); }
    getMemberData(key, uid)  { return this._members.get(key)?.find(m => m.userId === uid) || null; }
    isMember(uid)            { return this._memberIndex.has(uid); }

    // ── Permission check ──────────────────────────────────────────────────────
    // Each action in a definition has a minRank. Returns bool.
    can(player, action) {
        const key = player.data.factionKey;
        if (!key) return false;
        const def  = this._definitions.get(key);
        if (!def)  return false;
        const rank  = player.data.factionRank || 0;
        const minR  = def.permissions?.[action] ?? 99;
        return rank >= minR;
    }

    // ── Apply to faction ──────────────────────────────────────────────────────
    async applyToFaction(player, factionKey, message) {
        const def = this._definitions.get(factionKey);
        if (!def) return player.outputChatBox('!{FF0000}Faction not found.');
        if (!def.applicationsOpen) return player.outputChatBox('!{FF0000}This faction is not accepting applications.');
        if (this.isMember(player.data.dbId)) return player.outputChatBox('!{FF0000}You are already in a faction. Leave first.');

        const apps = this._apps.get(factionKey);
        if (apps.find(a => a.userId === player.data.dbId))
            return player.outputChatBox(`!{FF0000}You already have a pending application to ${def.name}.`);

        message = (message || '').trim().substring(0, 300);

        await db.query(
            'INSERT IGNORE INTO faction_applications (faction_key, user_id, username, message) VALUES (?,?,?,?)',
            [factionKey, player.data.dbId, player.name, message]
        );
        apps.push({ userId: player.data.dbId, username: player.name, message, appliedAt: new Date() });

        player.outputChatBox(`!{00FF00}[Factions] Application sent to ${def.name}!`);

        // Notify online leaders
        this._notifyFaction(factionKey, `!{FFAA00}[Factions] ${player.name} applied to join. Check the faction panel.`, 4);
    }

    // ── Accept application ─────────────────────────────────────────────────────
    async acceptApplication(leader, targetUserId) {
        const def = this.getFactionByPlayer(leader);
        if (!def) return leader.outputChatBox('!{FF0000}You are not in a faction.');
        if (!this.can(leader, 'MANAGE_MEMBERS')) return leader.outputChatBox('!{FF0000}Rank 4+ required.');

        const apps = this._apps.get(def.key);
        const app  = apps.find(a => a.userId === targetUserId);
        if (!app) return leader.outputChatBox('!{FF0000}Application not found.');

        if (this.isMember(targetUserId)) {
            apps.splice(apps.indexOf(app), 1);
            await db.query('DELETE FROM faction_applications WHERE faction_key=? AND user_id=?', [def.key, targetUserId]);
            return leader.outputChatBox('!{FF0000}That player already joined another faction.');
        }

        const members = this._members.get(def.key);
        if (members.length >= (def.memberCap || 50))
            return leader.outputChatBox('!{FF0000}Faction is full.');

        // Enlist
        await db.query(
            'INSERT INTO faction_members (faction_key, user_id, username, rank) VALUES (?,?,?,1)',
            [def.key, targetUserId, app.username]
        );
        members.push({ userId: targetUserId, username: app.username, rank: 1 });
        this._memberIndex.set(targetUserId, def.key);

        // Remove application
        apps.splice(apps.indexOf(app), 1);
        await db.query('DELETE FROM faction_applications WHERE faction_key=? AND user_id=?', [def.key, targetUserId]);

        // Tell the player if online
        const online = mp.players.toArray().find(p => p.data?.dbId === targetUserId);
        if (online) {
            this._applyVars(online, def, 1);
            online.outputChatBox(`!{00FF00}[Factions] Your application to ${def.name} was accepted! Welcome, ${def.ranks[0].name}.`);
        }

        leader.outputChatBox(`!{00FF00}[Factions] ${app.username} accepted into ${def.name}.`);
    }

    // ── Reject application ────────────────────────────────────────────────────
    async rejectApplication(leader, targetUserId) {
        const def = this.getFactionByPlayer(leader);
        if (!def || !this.can(leader, 'MANAGE_MEMBERS'))
            return leader.outputChatBox('!{FF0000}Not allowed.');

        const apps = this._apps.get(def.key);
        const app  = apps.find(a => a.userId === targetUserId);
        if (!app) return leader.outputChatBox('!{FF0000}Application not found.');

        apps.splice(apps.indexOf(app), 1);
        await db.query('DELETE FROM faction_applications WHERE faction_key=? AND user_id=?', [def.key, targetUserId]);

        const online = mp.players.toArray().find(p => p.data?.dbId === targetUserId);
        if (online) online.outputChatBox(`!{FF4444}[Factions] Your application to ${def.name} was declined.`);

        leader.outputChatBox(`!{FFAA00}[Factions] Rejected ${app.username}'s application.`);
    }

    // ── Kick member ───────────────────────────────────────────────────────────
    async kickMember(leader, targetUserId) {
        const def = this.getFactionByPlayer(leader);
        if (!def || !this.can(leader, 'MANAGE_MEMBERS'))
            return leader.outputChatBox('!{FF0000}Rank 4+ required.');

        const members = this._members.get(def.key);
        const mem = members.find(m => m.userId === targetUserId);
        if (!mem) return leader.outputChatBox('!{FF0000}That player is not in your faction.');
        if (mem.rank >= leader.data.factionRank) return leader.outputChatBox('!{FF0000}You cannot kick someone of equal or higher rank.');

        members.splice(members.indexOf(mem), 1);
        this._memberIndex.delete(targetUserId);
        await db.query('DELETE FROM faction_members WHERE user_id=?', [targetUserId]);

        const online = mp.players.toArray().find(p => p.data?.dbId === targetUserId);
        if (online) { this._clearVars(online); online.outputChatBox(`!{FF4444}[Factions] You were kicked from ${def.name}.`); }

        leader.outputChatBox(`!{00FF00}[Factions] Kicked ${mem.username}.`);
    }

    // ── Set member rank ───────────────────────────────────────────────────────
    async setMemberRank(leader, targetUserId, newRank) {
        const def = this.getFactionByPlayer(leader);
        if (!def || !this.can(leader, 'MANAGE_MEMBERS'))
            return leader.outputChatBox('!{FF0000}Rank 4+ required.');

        newRank = Math.min(5, Math.max(1, parseInt(newRank)));
        if (newRank >= leader.data.factionRank)
            return leader.outputChatBox('!{FF0000}Cannot promote to your own rank or higher.');

        const mem = this.getMemberData(def.key, targetUserId);
        if (!mem) return leader.outputChatBox('!{FF0000}Member not found.');
        mem.rank = newRank;

        await db.query('UPDATE faction_members SET rank=? WHERE faction_key=? AND user_id=?', [newRank, def.key, targetUserId]);

        const online = mp.players.toArray().find(p => p.data?.dbId === targetUserId);
        if (online) {
            online.data.factionRank = newRank;
            online.setVariable('factionRank', newRank);
            online.setVariable('factionRankName', def.ranks[newRank - 1].name);
            online.outputChatBox(`!{FFAA00}[Factions] Your rank is now: ${def.ranks[newRank - 1].name}.`);
        }
        leader.outputChatBox(`!{00FF00}[Factions] ${mem.username} → ${def.ranks[newRank - 1].name}.`);
    }

    // ── Leave faction (player-initiated) ─────────────────────────────────────
    async leaveFaction(player) {
        const key = player.data.factionKey;
        const def = this._definitions.get(key);
        if (!def) return player.outputChatBox('!{FF0000}You are not in a faction.');

        const members = this._members.get(key);
        const idx = members.findIndex(m => m.userId === player.data.dbId);
        if (idx === -1) return;

        members.splice(idx, 1);
        this._memberIndex.delete(player.data.dbId);
        await db.query('DELETE FROM faction_members WHERE user_id=?', [player.data.dbId]);
        this._clearVars(player);

        player.outputChatBox(`!{FFAA00}[Factions] You left ${def.name}.`);
        this._notifyFaction(key, `!{FFAA00}[Factions] ${player.name} left the faction.`, 1);
    }

    // ── Radio chat (/f) ───────────────────────────────────────────────────────
    factionChat(player, message) {
        const def = this.getFactionByPlayer(player);
        if (!def) return player.outputChatBox('!{FF0000}You are not in a faction.');
        const rank    = player.data.factionRank || 1;
        const rankName = def.ranks[rank - 1].name;
        const hex     = def.color.replace('#','');
        const line    = `!{${hex}}[${def.tag}] !{FFFFFF}(${rankName}) ${player.name}: !{CCCCCC}${message}`;
        this._notifyFaction(def.key, line, 1);
        console.log(`[FactionChat][${def.name}] ${player.name}: ${message}`);
    }

    // ── Payday salary ─────────────────────────────────────────────────────────
    async payPlayerSalary(player) {
        const def = this.getFactionByPlayer(player);
        if (!def) return;
        const rank   = player.data.factionRank || 1;
        const salary = def.ranks[rank - 1]?.salary || 0;
        if (salary <= 0) return;
        const pm = require('../../core/playerManager');
        await pm.addMoneyAndSave(player, salary, `${def.name} Salary`);
        player.outputChatBox(`!{00FF00}[Faction Payday] +$${salary.toLocaleString()} — ${def.ranks[rank-1].name} salary.`);
    }

    // ── Admin: forcibly enlist a player ──────────────────────────────────────
    async adminEnlist(adminPlayer, targetPlayer, factionKey, rank = 1) {
        const def = this._definitions.get(factionKey);
        if (!def) return adminPlayer.outputChatBox('!{FF0000}Faction key not found.');

        const uid = targetPlayer.data.dbId;
        if (this._memberIndex.has(uid)) await this._rawRemove(uid);

        rank = Math.min(5, Math.max(1, parseInt(rank) || 1));
        const members = this._members.get(factionKey);

        await db.query('REPLACE INTO faction_members (faction_key, user_id, username, rank) VALUES (?,?,?,?)', [factionKey, uid, targetPlayer.name, rank]);
        members.push({ userId: uid, username: targetPlayer.name, rank });
        this._memberIndex.set(uid, factionKey);
        this._applyVars(targetPlayer, def, rank);

        targetPlayer.outputChatBox(`!{00FF00}[Factions] Admin enlisted you in ${def.name} as ${def.ranks[rank-1].name}.`);
        adminPlayer.outputChatBox(`!{00FF00}[Factions] Enlisted ${targetPlayer.name} in ${def.name} rank ${rank}.`);
    }

    // ── Admin: force remove ───────────────────────────────────────────────────
    async adminRemove(adminPlayer, targetUserId) {
        const key = this._memberIndex.get(targetUserId);
        if (!key) return adminPlayer.outputChatBox('!{FF0000}That user is not in any faction.');
        await this._rawRemove(targetUserId);
        const online = mp.players.toArray().find(p => p.data?.dbId === targetUserId);
        if (online) { this._clearVars(online); online.outputChatBox('!{FF4444}[Factions] You were removed from your faction by an admin.'); }
        adminPlayer.outputChatBox(`!{00FF00}[Factions] User ${targetUserId} removed from ${key}.`);
    }

    // ── PlayerMenu data ───────────────────────────────────────────────────────
    async getPlayerMenuData(player) {
        const uid = player.data.dbId;
        const myKey = this._memberIndex.get(uid);
        const myDef = myKey ? this._definitions.get(myKey) : null;
        const myMem = myKey ? this.getMemberData(myKey, uid) : null;

        // Build public listing of all factions
        const allFactions = [];
        for (const [key, def] of this._definitions) {
            const members = this._members.get(key) || [];
            const myApp   = this._apps.get(key)?.find(a => a.userId === uid);
            allFactions.push({
                key,
                name:             def.name,
                tag:              def.tag,
                type:             def.type,
                color:            def.color,
                description:      def.description || '',
                memberCount:      members.length,
                memberCap:        def.memberCap || 50,
                applicationsOpen: !!def.applicationsOpen,
                hasApplied:       !!myApp,
                ranks:            def.ranks,
            });
        }

        if (!myDef || !myMem) {
            return { inFaction: false, allFactions };
        }

        // My faction full data
        const onlineIds = new Set(mp.players.toArray().filter(p => p.data?.dbId).map(p => p.data.dbId));
        const members   = (this._members.get(myKey) || []).map(m => ({
            userId:   m.userId,
            username: m.username,
            rank:     m.rank,
            rankName: myDef.ranks[m.rank - 1]?.name || '?',
            rankColor:myDef.ranks[m.rank - 1]?.color || '#fff',
            online:   onlineIds.has(m.userId),
        })).sort((a,b) => b.rank - a.rank || a.username.localeCompare(b.username));

        const isLeader   = myMem.rank >= 4;
        const applications = isLeader ? (this._apps.get(myKey) || []).map(a => ({
            userId:    a.userId,
            username:  a.username,
            message:   a.message,
            appliedAt: a.appliedAt,
        })) : [];

        return {
            inFaction:    true,
            key:          myKey,
            name:         myDef.name,
            tag:          myDef.tag,
            type:         myDef.type,
            color:        myDef.color,
            description:  myDef.description || '',
            memberCount:  members.length,
            memberCap:    myDef.memberCap || 50,
            rank:         myMem.rank,
            rankName:     myDef.ranks[myMem.rank - 1]?.name || '?',
            rankColor:    myDef.ranks[myMem.rank - 1]?.color || '#fff',
            salary:       myDef.ranks[myMem.rank - 1]?.salary || 0,
            ranks:        myDef.ranks,
            members,
            isLeader,
            applications,
            allFactions,
        };
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    _notifyFaction(key, message, minRank = 1) {
        mp.players.toArray().forEach(p => {
            if (p.data?.factionKey === key && (p.data?.factionRank || 0) >= minRank)
                p.outputChatBox(message);
        });
    }

    async _rawRemove(userId) {
        const key = this._memberIndex.get(userId);
        if (!key) return;
        const members = this._members.get(key);
        if (members) {
            const i = members.findIndex(m => m.userId === userId);
            if (i !== -1) members.splice(i, 1);
        }
        this._memberIndex.delete(userId);
        await db.query('DELETE FROM faction_members WHERE user_id=?', [userId]);
    }
}

// ── Singleton ─────────────────────────────────────────────────────────────────
const instance = new FactionManager();
module.exports = instance;
