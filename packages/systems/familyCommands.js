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

// ── Commands moved to Player Menu (O key → Families tab) ────────────────────
// /fpromote, /fdemote, /fhq, /fspawn, /fbank, /fdeposit, /fupgrade, /ftag,
// /fdisband, /finfo, /fmembers — all accessible as buttons in the Families menu.

// ── /finfo ────────────────────────────────────────────────────────────────────
// Kept as a quick chat shortcut for convenience
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
    player.outputChatBox(`${C.FAM}── Use /fhelp or press O → Families for full menu`);
    player.outputChatBox(`${C.FAM}────────────────────────`);
});

// ── /fhelp ────────────────────────────────────────────────────────────────────
mp.events.addCommand('fhelp', (player) => {
    if (!player.logged) return;
    player.outputChatBox(`${C.FAM}────── Family Commands ──────`);
    player.outputChatBox(`!{FFFFFF}/fc [msg] !{AAAAAA}- Family chat`);
    player.outputChatBox(`!{FFFFFF}/finvite [id] !{AAAAAA}- Invite a player (Rank 4+)`);
    player.outputChatBox(`!{FFFFFF}/faccept !{AAAAAA}- Accept a family invite`);
    player.outputChatBox(`!{FFFFFF}/fdecline !{AAAAAA}- Decline a family invite`);
    player.outputChatBox(`!{FFFFFF}/fkick [id] !{AAAAAA}- Kick a member`);
    player.outputChatBox(`!{FFFFFF}/fleave !{AAAAAA}- Leave your family`);
    player.outputChatBox(`!{FFFFFF}/finfo !{AAAAAA}- Quick family info in chat`);
    player.outputChatBox(`${C.FAM}── Everything else → Press O, open Families tab`);
    player.outputChatBox(`${C.FAM}────────────────────────`);
});