// packages/systems/familyCommands.js
// ─────────────────────────────────────────────────────────────────────────────
//  Families System — Commands
// ─────────────────────────────────────────────────────────────────────────────
const FM = require('./familyManager');

const C = {
    ERR:  '!{FF0000}',
    OK:   '!{00FF00}',
    INFO: '!{FFFF00}',
    FAM:  '!{FFAA00}'
};

function findPlayer(idOrName) {
    if (!idOrName) return null;
    const num = parseInt(idOrName);
    if (!isNaN(num)) {
        const byId = mp.players.toArray().find(p => p.data.onlineId === num);
        if (byId) return byId;
    }
    const lower = String(idOrName).toLowerCase();
    return mp.players.toArray().find(p => p.name.toLowerCase().includes(lower)) || null;
}

// ── /fc <message> ─────────────────────────────────────────────────────────────
mp.events.addCommand('fc', (player, fullText) => {
    if (!player.logged) return;
    if (!fullText || !fullText.trim()) return player.outputChatBox(`${C.ERR}Usage: /fc [message]`);
    FM.familyChat(player, fullText.trim());
});

// ── /finvite <id|name> ────────────────────────────────────────────────────────
mp.events.addCommand('finvite', (player, _, id) => {
    if (!player.logged) return;
    if (!id) return player.outputChatBox(`${C.ERR}Usage: /finvite [id or name]`);
    const target = findPlayer(id);
    if (!target) return player.outputChatBox(`${C.ERR}Player not found.`);
    FM.sendInvite(player, target);
});

// ── /faccept ──────────────────────────────────────────────────────────────────
mp.events.addCommand('faccept', async (player) => {
    if (!player.logged) return;
    await FM.acceptInvite(player);
});

// ── /fdecline ─────────────────────────────────────────────────────────────────
mp.events.addCommand('fdecline', (player) => {
    if (!player.logged) return;
    FM.declineInvite(player);
});

// ── /fleave ───────────────────────────────────────────────────────────────────
mp.events.addCommand('fleave', async (player) => {
    if (!player.logged) return;
    await FM.leaveFamily(player);
});

// ── /fkick <id|name> ──────────────────────────────────────────────────────────
mp.events.addCommand('fkick', async (player, _, id) => {
    if (!player.logged) return;
    if (!id) return player.outputChatBox(`${C.ERR}Usage: /fkick [id or name]`);
    const target = findPlayer(id);
    if (target) {
        await FM.kickMember(player, target.data.dbId);
    } else {
        // Try offline kick by username search
        const fam = FM.getFamilyByPlayer(player);
        if (!fam) return player.outputChatBox(`${C.ERR}You are not in a family.`);
        const mem = fam.members.find(m => m.username.toLowerCase().includes(String(id).toLowerCase()));
        if (!mem) return player.outputChatBox(`${C.ERR}Player "${id}" not found in your family.`);
        await FM.kickMember(player, mem.userId);
    }
});

// ── /fpromote <id|name> <rank 1-5> ───────────────────────────────────────────
mp.events.addCommand('fpromote', async (player, _, id, rank) => {
    if (!player.logged) return;
    if (!id || !rank) return player.outputChatBox(`${C.ERR}Usage: /fpromote [id or name] [1-5]`);

    const fam = FM.getFamilyByPlayer(player);
    if (!fam) return player.outputChatBox(`${C.ERR}You are not in a family.`);

    let targetUserId;
    const online = findPlayer(id);
    if (online) {
        targetUserId = online.data.dbId;
    } else {
        const mem = fam.members.find(m => m.username.toLowerCase().includes(String(id).toLowerCase()));
        if (!mem) return player.outputChatBox(`${C.ERR}Player "${id}" not found in your family.`);
        targetUserId = mem.userId;
    }
    await FM.setMemberRank(player, targetUserId, parseInt(rank));
});

// ── /fdemote <id|name> ────────────────────────────────────────────────────────
mp.events.addCommand('fdemote', async (player, _, id) => {
    if (!player.logged) return;
    if (!id) return player.outputChatBox(`${C.ERR}Usage: /fdemote [id or name]`);

    const fam = FM.getFamilyByPlayer(player);
    if (!fam || fam.ownerId !== player.data.dbId)
        return player.outputChatBox(`${C.ERR}Only the family owner can demote.`);

    let mem;
    const online = findPlayer(id);
    if (online) {
        mem = fam.members.find(m => m.userId === online.data.dbId);
    } else {
        mem = fam.members.find(m => m.username.toLowerCase().includes(String(id).toLowerCase()));
    }
    if (!mem) return player.outputChatBox(`${C.ERR}Player "${id}" not found in your family.`);
    if (mem.userId === player.data.dbId) return player.outputChatBox(`${C.ERR}You cannot demote yourself.`);
    if (mem.rank <= 1) return player.outputChatBox(`${C.ERR}That player is already at the lowest rank.`);

    await FM.setMemberRank(player, mem.userId, mem.rank - 1);
});

// ── /fhq ──────────────────────────────────────────────────────────────────────
mp.events.addCommand('fhq', async (player) => {
    if (!player.logged) return;
    await FM.setHQ(player);
});

// ── /fspawn ───────────────────────────────────────────────────────────────────
mp.events.addCommand('fspawn', (player) => {
    if (!player.logged) return;
    mp.events.call('server:family:spawn', player);
});

// ── /fbank deposit <amount> / withdraw <amount> ───────────────────────────────
mp.events.addCommand('fbank', async (player, _, action, amount) => {
    if (!player.logged) return;
    if (!action || !amount) return player.outputChatBox(`${C.ERR}Usage: /fbank [deposit|withdraw] [amount]`);
    if (action === 'deposit') await FM.bankDeposit(player, amount);
    else if (action === 'withdraw') await FM.bankWithdraw(player, amount);
    else player.outputChatBox(`${C.ERR}Usage: /fbank [deposit|withdraw] [amount]`);
});

// ── /fupgrade ─────────────────────────────────────────────────────────────────
mp.events.addCommand('fupgrade', async (player) => {
    if (!player.logged) return;
    await FM.upgradeCap(player);
});

// ── /ftag <tag> ───────────────────────────────────────────────────────────────
mp.events.addCommand('ftag', async (player, _, tag) => {
    if (!player.logged) return;
    if (!tag) return player.outputChatBox(`${C.ERR}Usage: /ftag [1-4 letters/numbers]`);
    await FM.setTag(player, tag);
});

// ── /fdisband ─────────────────────────────────────────────────────────────────
const disbandConfirm = new Set();
mp.events.addCommand('fdisband', async (player) => {
    if (!player.logged) return;
    if (!disbandConfirm.has(player.data.dbId)) {
        disbandConfirm.add(player.data.dbId);
        setTimeout(() => disbandConfirm.delete(player.data.dbId), 10000);
        return player.outputChatBox(`${C.INFO}Are you sure? Type /fdisband again within 10 seconds to confirm.`);
    }
    disbandConfirm.delete(player.data.dbId);
    await FM.disband(player);
});

// ── /finfo ────────────────────────────────────────────────────────────────────
mp.events.addCommand('finfo', (player) => {
    if (!player.logged) return;
    const fam = FM.getFamilyByPlayer(player);
    if (!fam) return player.outputChatBox(`${C.ERR}You are not in a family.`);
    const mem = FM.getMemberData(fam, player.data.dbId);
    const tagColor = fam.color.replace('#', '');
    player.outputChatBox(`${C.FAM}────── Family Info ──────`);
    player.outputChatBox(`!{FFFFFF}Name: !{${tagColor}}[${fam.tag}] ${fam.name}`);
    player.outputChatBox(`!{FFFFFF}Members: ${fam.members.length}/${fam.memberCap} | Bank: $${fam.bank.toLocaleString()}`);
    player.outputChatBox(`!{FFFFFF}Your Rank: !{${fam.ranks[mem.rank-1].color.replace('#','')}}${fam.ranks[mem.rank-1].name} (${mem.rank})`);
    player.outputChatBox(`!{FFFFFF}Applications: ${fam.applicationsOpen ? '!{00FF00}Open' : '!{FF0000}Closed'} !{FFFFFF}| Direct Join: ${fam.invitesOpen ? '!{00FF00}Open' : '!{FF0000}Closed'}`);
    player.outputChatBox(`!{FFFFFF}HQ: ${fam.hqHouseId ? `House #${fam.hqHouseId}` : 'Not set'}`);
    player.outputChatBox(`${C.FAM}────────────────────────`);
});

// ── /fmembers ─────────────────────────────────────────────────────────────────
mp.events.addCommand('fmembers', (player) => {
    if (!player.logged) return;
    const fam = FM.getFamilyByPlayer(player);
    if (!fam) return player.outputChatBox(`${C.ERR}You are not in a family.`);
    const onlineIds = new Set(mp.players.toArray().filter(p => p.data?.dbId).map(p => p.data.dbId));
    const tagColor  = fam.color.replace('#', '');
    player.outputChatBox(`!{${tagColor}}── ${fam.name} Members (${fam.members.length}/${fam.memberCap}) ──`);
    const sorted = [...fam.members].sort((a, b) => b.rank - a.rank);
    sorted.forEach(m => {
        const rankInfo = fam.ranks[m.rank - 1];
        const status   = onlineIds.has(m.userId) ? '!{00FF00}●' : '!{777777}●';
        player.outputChatBox(`${status} !{${rankInfo.color.replace('#','')}}[${rankInfo.name}] !{FFFFFF}${m.username}`);
    });
});

// ── /fhelp ────────────────────────────────────────────────────────────────────
mp.events.addCommand('fhelp', (player) => {
    if (!player.logged) return;
    player.outputChatBox(`${C.FAM}────── Family Commands ──────`);
    player.outputChatBox(`!{FFFFFF}/fc [msg] !{AAAAAA}- Family chat`);
    player.outputChatBox(`!{FFFFFF}/finvite [id] !{AAAAAA}- Invite player (Rank 4+)`);
    player.outputChatBox(`!{FFFFFF}/faccept / /fdecline !{AAAAAA}- Accept/decline invite`);
    player.outputChatBox(`!{FFFFFF}/fleave !{AAAAAA}- Leave family`);
    player.outputChatBox(`!{FFFFFF}/finfo !{AAAAAA}- Show family info`);
    player.outputChatBox(`!{FFFFFF}/fmembers !{AAAAAA}- List members`);
    player.outputChatBox(`!{FFFFFF}/fspawn !{AAAAAA}- Spawn at family HQ`);
    player.outputChatBox(`${C.FAM}── Owner Commands ──`);
    player.outputChatBox(`!{FFFFFF}/fpromote [id] [1-5] !{AAAAAA}- Set member rank`);
    player.outputChatBox(`!{FFFFFF}/fdemote [id] !{AAAAAA}- Demote member`);
    player.outputChatBox(`!{FFFFFF}/fkick [id] !{AAAAAA}- Kick member`);
    player.outputChatBox(`!{FFFFFF}/ftag [tag] !{AAAAAA}- Change family tag (1-4 chars)`);
    player.outputChatBox(`!{FFFFFF}/fhq !{AAAAAA}- Set your house as HQ`);
    player.outputChatBox(`!{FFFFFF}/fbank [deposit|withdraw] [amount]`);
    player.outputChatBox(`!{FFFFFF}/fupgrade !{AAAAAA}- Upgrade member cap ($75,000)`);
    player.outputChatBox(`!{FFFFFF}/fdisband !{AAAAAA}- Disband family`);
    player.outputChatBox(`${C.FAM}────────────────────────`);
});