// ─────────────────────────────────────────────────────────────────────────────
//  Discord Bot — Standalone Process (packages/discord/bot-process.js)
//  Runs with system Node.js (spawned by RAGE:MP via child_process).
//  Receives events from RAGE:MP via stdin (line-delimited JSON).
// ─────────────────────────────────────────────────────────────────────────────

const { 
    Client, GatewayIntentBits, EmbedBuilder, ActivityType, REST, Routes, 
    SlashCommandBuilder, ChannelType, ModalBuilder, TextInputBuilder, 
    TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags 
} = require('discord.js');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// ── Load config (same file used by RAGE:MP side) ─────────────────────────────
const config = require('./config');

// ── Database connection (direct — not through RAGE:MP) ───────────────────────
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Athlantes2004',
    database: 'central_db',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
}).promise();

// ── Create Discord client ────────────────────────────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
    ]
});

let statusMessage = null;
let onlinePlayers = []; // Updated via IPC from RAGE:MP
const pendingLinks = new Map(); // Va stoca temporar cererile de link active (PIN-urile)

// ── Family Discord state ──────────────────────────────────────────────────────
// familyId → { categoryId, channelIds: { chat, media, announcements, voice }, roleIds: { 1..5 } }
const familyDiscord = new Map();

// ─────────────────────────────────────────────────────────────────────────────
//  IPC: Receive events from RAGE:MP via stdin
// ─────────────────────────────────────────────────────────────────────────────
let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete line in buffer

    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            const msg = JSON.parse(line);
            handleIPC(msg);
        } catch (e) {
            console.error('[Discord-IPC] Invalid JSON:', line);
        }
    }
});

async function handleIPC(msg) {
    switch (msg.type) {
        case 'playerList':
            onlinePlayers = msg.players || [];
            // Immediately refresh the status embed and channel name when player list is pushed
            try {
                updateStatusEmbed();
            } catch (e) {
                console.warn('[Discord] Failed to update status on playerList IPC:', e.message);
            }
            break;
        case 'adminLog':
            sendLogEmbed('admin', msg.message, msg.fields || []);
            break;
        case 'banLog':
            sendLogEmbed('ban', msg.message, msg.fields || []);
            break;
        case 'kickLog':
            sendLogEmbed('kick', msg.message, msg.fields || []);
            break;

        // ── Family events ──
        case 'familyCreated':
            familyCreated(msg).catch(e => console.error('[Discord/Family] familyCreated error:', e));
            break;
        case 'familyDisbanded':
            familyDisbanded(msg).catch(e => console.error('[Discord/Family] familyDisbanded error:', e));
            break;
        case 'familyMemberJoined':
            familyMemberJoined(msg).catch(e => console.error('[Discord/Family] memberJoined error:', e));
            break;
        case 'familyMemberLeft':
            familyMemberLeft(msg).catch(e => console.error('[Discord/Family] memberLeft error:', e));
            break;
        case 'familyRankChanged':
            familyRankChanged(msg).catch(e => console.error('[Discord/Family] rankChanged error:', e));
            break;
        case 'familyColorChanged':
            familyColorChanged(msg).catch(e => console.error('[Discord/Family] colorChanged error:', e));
            break;
    }
}

// Send a message back to RAGE:MP via stdout
function sendToRageMP(data) {
    process.stdout.write(JSON.stringify(data) + '\n');
}

// ─────────────────────────────────────────────────────────────────────────────
//  BOT READY
// ─────────────────────────────────────────────────────────────────────────────
client.once('ready', async () => {
    console.log(`[Discord] Bot logged in as ${client.user.tag}`);
    sendToRageMP({ type: 'ready', tag: client.user.tag });

    client.user.setActivity(`${config.SERVER_NAME}`, { type: ActivityType.Watching });

    await registerCommands();

    // Ensure the permanent "Link to Rage" message exists in the configured channel
    try {
        await ensureLinkMessage();
    } catch (e) {
        console.warn('[Discord] Could not ensure link message:', e.message);
    }

    updateStatusEmbed();
    setInterval(updateStatusEmbed, config.STATUS_UPDATE_INTERVAL);

    // Restore family Discord state from disk (survives bot restarts)
    loadFamilyMap();
});

// ─────────────────────────────────────────────────────────────────────────────
//  SLASH COMMANDS REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────
async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('status')
            .setDescription('Show current server status and online players'),
        new SlashCommandBuilder()
            .setName('link')
            .setDescription('Link your Discord account to your in-game account')
            .addStringOption(opt =>
                opt.setName('username')
                    .setDescription('Your in-game username')
                    .setRequired(true)
            ),
        new SlashCommandBuilder()
            .setName('unlink')
            .setDescription('Unlink your Discord account from your in-game account'),
        new SlashCommandBuilder()
            .setName('profile')
            .setDescription('View your linked in-game profile'),
    ].map(cmd => cmd.toJSON());

    try {
        const rest = new REST({ version: '10' }).setToken(config.BOT_TOKEN);
        await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID), { body: commands });
        console.log('[Discord] Slash commands registered.');
    } catch (err) {
        console.error('[Discord] Failed to register commands:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  INTERACTION HANDLER (Commands & Modals)
// ─────────────────────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            switch (interaction.commandName) {
                case 'status':  return await handleStatus(interaction);
                case 'link':    return await handleLink(interaction);
                case 'unlink':  return await handleUnlink(interaction);
                case 'profile': return await handleProfile(interaction);
            }
        } 
        else if (interaction.isModalSubmit()) {
            // Când introduce codul PIN
            if (interaction.customId === 'link_modal') {
                return await handleLinkModal(interaction);
            }
            // Când introduce numele din joc (din buton)
            if (interaction.customId === 'ask_username_modal') {
                return await handleUsernameModal(interaction);
            }
        } 
        else if (interaction.isButton()) {
            // 1. Când apasă pe butonul mare pus pe canal
            if (interaction.customId === 'rage_link_button') {
                const modal = new ModalBuilder()
                    .setCustomId('ask_username_modal')
                    .setTitle('Link In-Game Account');

                const usernameInput = new TextInputBuilder()
                    .setCustomId('username_input')
                    .setLabel('Your in-game name (e.g. John_Doe)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const actionRow = new ActionRowBuilder().addComponents(usernameInput);
                modal.addComponents(actionRow);

                await interaction.showModal(modal);
            }

            // 2. Când apasă pe butonul intermediar să bage PIN-ul
            if (interaction.customId === 'rage_enter_pin') {
                const modal = new ModalBuilder()
                    .setCustomId('link_modal')
                    .setTitle('Verify In-Game Account');

                const pinInput = new TextInputBuilder()
                    .setCustomId('pin_input')
                    .setLabel('The 6-digit code received on your phone')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(6)
                    .setMaxLength(6)
                    .setRequired(true);

                const firstActionRow = new ActionRowBuilder().addComponents(pinInput);
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);
            }
        }
    } catch (err) {
        console.error(`[Discord] Interaction error:`, err);
        const reply = { content: '❌ An error occurred. Please try again.', flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply).catch(() => {});
        } else {
            await interaction.reply(reply).catch(() => {});
        }
    }
});

// ─────────────────────────────────────────────────────────────────────────────
//  /status
// ─────────────────────────────────────────────────────────────────────────────
async function handleStatus(interaction) {
    const embed = buildStatusEmbed(onlinePlayers);
    await interaction.reply({ embeds: [embed] });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Procesare Nume din Buton (înlocuiește parțial comanda /link)
// ─────────────────────────────────────────────────────────────────────────────
async function handleUsernameModal(interaction) {
    const username  = interaction.fields.getTextInputValue('username_input');
    const discordId = interaction.user.id;

    // 1. Verificăm dacă Discord-ul e deja conectat
    const [existing] = await pool.query('SELECT id, username FROM users WHERE discord_id = ?', [discordId]);
    if (existing.length > 0) {
        return interaction.reply({ content: `⚠️ Your Discord account is already linked to **${existing[0].username}**. Use \`/unlink\` first to unlink it.`, flags: MessageFlags.Ephemeral });
    }

    // 2. Verificăm dacă username-ul există și dacă nu e deja legat
    const [rows] = await pool.query('SELECT id, username, discord_id FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
        return interaction.reply({ content: '❌ This in-game account does not exist on the server.', flags: MessageFlags.Ephemeral });
    }

    const user = rows[0];
    if (user.discord_id && user.discord_id !== discordId) {
        return interaction.reply({ content: '❌ This in-game account is already linked to another Discord account.', flags: MessageFlags.Ephemeral });
    }

    // 3. Verificăm dacă jucătorul este ONLINE acum
    const isOnline = onlinePlayers.find(p => p.name.toLowerCase() === username.toLowerCase());
    if (!isOnline) {
        return interaction.reply({ content: `❌ The player **${username}** is not online. You must be online in-game to receive the verification code on your phone!`, flags: MessageFlags.Ephemeral });
    }

    // 4. Generăm un PIN de 6 cifre și îl stocăm temporar
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    pendingLinks.set(discordId, {
        userId: user.id,
        username: user.username,
        pin: pin,
        expires: Date.now() + 5 * 60 * 1000 // Expiră în 5 minute
    });

    // 5. Trimitem comanda spre serverul de RageMP să îi trimită email-ul în joc (include DB id)
    sendToRageMP({ type: 'sendLinkPin', userId: user.id, username: user.username, pin: pin });

    // 6. Îi oferim butonul pentru a introduce PIN-ul
    const enterPinButton = new ButtonBuilder()
        .setCustomId('rage_enter_pin')
        .setLabel('Enter verification code')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(enterPinButton);

    await interaction.reply({ 
        content: `✅ An email with a 6-digit code has been sent to your in-game phone for **${user.username}**.\nClick the button below to enter it.`, 
        components: [row],
        flags: MessageFlags.Ephemeral // Mesajul îl vede doar el
    });
}

// ─────────────────────────────────────────────────────────────────────────────
//  /link — Initiază procesul și trimite PIN-ul în joc
// ─────────────────────────────────────────────────────────────────────────────
async function handleLink(interaction) {
    const username  = interaction.options.getString('username');
    const discordId = interaction.user.id;

    // 1. Verificăm dacă Discord-ul e deja conectat
    const [existing] = await pool.query('SELECT id, username FROM users WHERE discord_id = ?', [discordId]);
    if (existing.length > 0) {
        return interaction.reply({ content: `⚠️ Your Discord account is already linked to **${existing[0].username}**. Use \`/unlink\` first to unlink it.`, flags: MessageFlags.Ephemeral });
    }

    // 2. Verificăm dacă username-ul există și dacă nu e deja legat
    const [rows] = await pool.query('SELECT id, username, discord_id FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
        return interaction.reply({ content: '❌ This in-game account does not exist on the server.', flags: MessageFlags.Ephemeral });
    }

    const user = rows[0];
    if (user.discord_id && user.discord_id !== discordId) {
        return interaction.reply({ content: '❌ This in-game account is already linked to another Discord account.', flags: MessageFlags.Ephemeral });
    }

    // 3. Verificăm dacă jucătorul este ONLINE acum
    const isOnline = onlinePlayers.find(p => p.name.toLowerCase() === username.toLowerCase());
    if (!isOnline) {
        return interaction.reply({ content: `❌ The player **${username}** is not online. You must be online in-game to receive the verification code on your phone!`, flags: MessageFlags.Ephemeral });
    }

    // 4. Generăm un PIN de 6 cifre și îl stocăm temporar
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    pendingLinks.set(discordId, {
        userId: user.id,
        username: user.username,
        pin: pin,
        expires: Date.now() + 5 * 60 * 1000 // Expiră în 5 minute
    });

    // 5. Trimitem comanda spre serverul de RageMP să îi trimită email-ul în joc (include DB id)
    sendToRageMP({ type: 'sendLinkPin', userId: user.id, username: user.username, pin: pin });

    // 6. Afișăm fereastra (Modal) utilizatorului pe Discord
    const modal = new ModalBuilder()
        .setCustomId('link_modal')
        .setTitle('Verify In-Game Account');

    const pinInput = new TextInputBuilder()
        .setCustomId('pin_input')
        .setLabel('6-digit code received on your in-game phone')
        .setStyle(TextInputStyle.Short)
        .setMinLength(6)
        .setMaxLength(6)
        .setRequired(true);

    const firstActionRow = new ActionRowBuilder().addComponents(pinInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Modal Submit — Procesează PIN-ul introdus
// ─────────────────────────────────────────────────────────────────────────────
async function handleLinkModal(interaction) {
    const discordId = interaction.user.id;
    const submittedPin = interaction.fields.getTextInputValue('pin_input');
    const pending = pendingLinks.get(discordId);
    
    if (!pending) {
        return interaction.reply({ content: '❌ The session expired or you don\'t have a pending link request.', flags: MessageFlags.Ephemeral });
    }

    if (Date.now() > pending.expires) {
        pendingLinks.delete(discordId);
        return interaction.reply({ content: '❌ The code expired. Please use `/link` again.', flags: MessageFlags.Ephemeral });
    }

    if (submittedPin !== pending.pin) {
        return interaction.reply({ content: '❌ Wrong code. Try again!', flags: MessageFlags.Ephemeral });
    }

    // Codul este corect! Legăm conturile.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    await pool.query('UPDATE users SET discord_id = ? WHERE id = ?', [discordId, pending.userId]);

    try {
        const guild = await client.guilds.fetch(config.GUILD_ID);
        const member = await guild.members.fetch(discordId);
        if (config.LINKED_ROLE_ID && !config.LINKED_ROLE_ID.startsWith('PASTE_')) {
            await member.roles.add(config.LINKED_ROLE_ID);
        }
    } catch (e) {
        console.warn('[Discord] Could not assign linked role:', e.message);
    }

    sendLogEmbed('link', `🔗 **${interaction.user.tag}** linked to in-game account **${pending.username}**`);
    
    // Auto-assign family Discord role if player is in a family
    onPlayerLinked({ userId: pending.userId, discordId }).catch(() => {});

    pendingLinks.delete(discordId); // Ștergem cererea din memorie
    await interaction.editReply(`✅ Ready! Your discord account is now linked to **${pending.username}**.`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  /unlink
// ─────────────────────────────────────────────────────────────────────────────
async function handleUnlink(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const discordId = interaction.user.id;
    const [rows] = await pool.query('SELECT id, username FROM users WHERE discord_id = ?', [discordId]);

    if (rows.length === 0) {
        return interaction.editReply('⚠️ Your Discord is not linked to any account.');
    }

    await pool.query('UPDATE users SET discord_id = NULL WHERE discord_id = ?', [discordId]);

    try {
        const guild = await client.guilds.fetch(config.GUILD_ID);
        const member = await guild.members.fetch(discordId);
        if (config.LINKED_ROLE_ID && !config.LINKED_ROLE_ID.startsWith('PASTE_')) {
            await member.roles.remove(config.LINKED_ROLE_ID);
        }
    } catch (e) {
        console.warn('[Discord] Could not remove linked role:', e.message);
    }

    sendLogEmbed('link', `🔓 **${interaction.user.tag}** unlinked from in-game account **${rows[0].username}**`);
    await interaction.editReply(`✅ Unlinked from **${rows[0].username}**.`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  /profile
// ─────────────────────────────────────────────────────────────────────────────
async function handleProfile(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const discordId = interaction.user.id;
    const [rows] = await pool.query(
        'SELECT username, level, money, bank_money, total_playtime, created_at, mugshot FROM users WHERE discord_id = ?',
        [discordId]
    );

    if (rows.length === 0) {
        return interaction.editReply('⚠️ No linked account. Use `/link` to connect your in-game account.');
    }

    const u = rows[0];
    const hours = Math.floor((u.total_playtime || 0) / 60);
    const regDate = u.created_at
        ? new Date(u.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : 'Unknown';

    const embed = new EmbedBuilder()
        .setColor(config.EMBED_COLOR)
        .setTitle(`🎮 ${u.username}`)
        .addFields(
            { name: '📊 Level',      value: `${u.level || 1}`,                          inline: true },
            { name: '💵 Cash',       value: `$${(u.money || 0).toLocaleString()}`,       inline: true },
            { name: '🏦 Bank',       value: `$${(u.bank_money || 0).toLocaleString()}`,  inline: true },
            { name: '⏱️ Playtime',  value: `${hours}h`,                                 inline: true },
            { name: '📅 Registered', value: regDate,                                     inline: true },
        )
        .setFooter({ text: config.SERVER_NAME })
        .setTimestamp();

    if (u.mugshot) {
        embed.setThumbnail(`http://26.118.189.124:3008/photos/mugshots/${u.mugshot}`);
    }

    await interaction.editReply({ embeds: [embed] });
}

// ─────────────────────────────────────────────────────────────────────────────
//  STATUS CHANNEL — Auto-updating embed
// ─────────────────────────────────────────────────────────────────────────────
async function updateStatusEmbed() {
    if (!config.STATUS_CHANNEL_ID || config.STATUS_CHANNEL_ID.startsWith('PASTE_')) return;

    try {
        const channel = await client.channels.fetch(config.STATUS_CHANNEL_ID);
        if (!channel) return;

        const embed = buildStatusEmbed(onlinePlayers);

        if (statusMessage) {
            try {
                await statusMessage.edit({ embeds: [embed] });
            } catch (e) {
                statusMessage = await channel.send({ embeds: [embed] });
            }
        } else {
            const messages = await channel.messages.fetch({ limit: 10 });
            const existingMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);
            if (existingMsg) {
                statusMessage = existingMsg;
                await statusMessage.edit({ embeds: [embed] });
            } else {
                statusMessage = await channel.send({ embeds: [embed] });
            }
        }
        
        const count = (onlinePlayers && onlinePlayers.length) || 0;
        const safeName = `${count} Online In-Game`;

        try {
            const guild = await client.guilds.fetch(config.GUILD_ID);
            const statusChannel = await guild.channels.fetch(config.STATUS_CHANNEL_ID);
            if (statusChannel && typeof statusChannel.setName === 'function') {
                const isVoice = statusChannel.type === ChannelType.GuildVoice || statusChannel.type === ChannelType.GuildStageVoice;
                if (isVoice) {
                    if (statusChannel.name !== safeName) {
                        await statusChannel.setName(safeName);
                    }
                } else {
                    const altName = `${count}-online-in-game`;
                    if (statusChannel.name !== altName) {
                        await statusChannel.setName(altName);
                    }
                }
            }
        } catch (e) {
            console.warn('[Discord] Could not rename status channel:', e.message);
        }

    } catch (err) {
        console.error('[Discord] Status embed update failed:', err.message);
    }
}

function buildStatusEmbed(players) {
    const playerList = players.length > 0
        ? players.map(p => `\`${p.id}\` **${p.name}** — Lvl ${p.level}`).join('\n')
        : '*No players online*';

    const truncated = playerList.length > 1024
        ? playerList.substring(0, 1000) + `\n... and ${players.length - 20} more`
        : playerList;

    const embed = new EmbedBuilder()
        .setColor(config.EMBED_COLOR)
        .setTitle(`🌆 ${config.SERVER_NAME} — Server Status`)
        .addFields(
            { name: '👥 Online Players', value: `**${players.length}** / 100`, inline: true },
            { name: '🟢 Status',         value: '**Online**',                  inline: true },
        )
        .addFields({ name: '📋 Player List', value: truncated })
        .setFooter({ text: 'Last updated' })
        .setTimestamp();

    if (config.SERVER_ICON_URL) embed.setThumbnail(config.SERVER_ICON_URL);
    return embed;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN LOG — Send events to Discord channels
// ─────────────────────────────────────────────────────────────────────────────
const LOG_COLORS = {
    join:  0x2ECC71, leave: 0xE74C3C, ban: 0xFF0000,
    kick:  0xFFA500, admin: 0xFFFF00, link: 0x00A8FF, info: 0xAAAAAA,
};

function sendLogEmbed(type, message, fields = []) {
    const channelId = type === 'link' ? config.LINK_LOG_CHANNEL_ID : config.ADMIN_LOG_CHANNEL_ID;
    if (!channelId || channelId.startsWith('PASTE_')) return;

    client.channels.fetch(channelId).then(channel => {
        if (!channel) return;
        const embed = new EmbedBuilder()
            .setColor(LOG_COLORS[type] || LOG_COLORS.info)
            .setDescription(message)
            .setTimestamp();
        if (fields.length > 0) embed.addFields(fields);
        channel.send({ embeds: [embed] }).catch(console.error);
    }).catch(() => {});
}

// Ensure a permanent "Link to Rage" message exists in the configured channel
async function ensureLinkMessage() {
    if (!config.LINK_RAGE_CHANNEL_ID || config.LINK_RAGE_CHANNEL_ID.startsWith('PASTE_')) return;
    try {
        const channel = await client.channels.fetch(config.LINK_RAGE_CHANNEL_ID);
        if (!channel) return;

        // Search recent messages for one with our button
        const messages = await channel.messages.fetch({ limit: 50 });
        const existing = messages.find(m => m.author && m.author.id === client.user.id && m.components && m.components.length);
        if (existing) return; // already have a message

        const embed = new EmbedBuilder()
            .setTitle('🔗 Link your Discord to your in-game account')
            .setDescription('Click the button below and follow the steps to securely link your Discord account to your in-game profile. You must be online in-game to receive the verification code.')
            .setColor(config.EMBED_COLOR)
            .setFooter({ text: config.SERVER_NAME });

        const button = new ButtonBuilder()
            .setCustomId('rage_link_button')
            .setLabel('Link Discord ↔ Rage')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);
        const sent = await channel.send({ embeds: [embed], components: [row] });
        try { await sent.pin(); } catch (e) { /* ignore if can't pin */ }
    } catch (e) {
        console.warn('[Discord] ensureLinkMessage failed:', e.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  FAMILY SYSTEM — Discord Integration
// ─────────────────────────────────────────────────────────────────────────────

const FAMILY_MAP_PATH = path.join(__dirname, 'family_discord_map.json');

function saveFamilyMap() {
    try {
        const obj = {};
        for (const [id, data] of familyDiscord.entries()) obj[id] = data;
        fs.writeFileSync(FAMILY_MAP_PATH, JSON.stringify(obj, null, 2));
    } catch (e) {
        console.warn('[Discord/Family] Could not save family map:', e.message);
    }
}

function loadFamilyMap() {
    try {
        if (!fs.existsSync(FAMILY_MAP_PATH)) return;
        const obj = JSON.parse(fs.readFileSync(FAMILY_MAP_PATH, 'utf8'));
        for (const [id, data] of Object.entries(obj)) {
            familyDiscord.set(parseInt(id), data);
        }
        console.log(`[Discord/Family] Loaded ${familyDiscord.size} family entries from disk.`);
    } catch (e) {
        console.warn('[Discord/Family] Could not load family map:', e.message);
    }
}

/**
 * Convert a #RRGGBB hex string to a Discord-compatible integer color.
 */
function hexToInt(hex) {
    if (!hex || typeof hex !== 'string') return 0xAAAAAA;
    const cleaned = hex.replace('#', '').trim();
    const val = parseInt(cleaned, 16);
    return isNaN(val) ? 0xAAAAAA : val;
}

/**
 * Sanitize a string to be usable as a Discord channel/category name.
 */
function toDiscordName(str) {
    return str.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim().substring(0, 90) || 'family';
}

/**
 * Fetch the guild.
 */
async function getGuild() {
    return await client.guilds.fetch(config.GUILD_ID);
}

/**
 * Resolve a Discord member by their in-game DB user id.
 */
async function getMemberByDbId(guild, dbUserId) {
    try {
        const [rows] = await pool.query('SELECT discord_id FROM users WHERE id = ?', [dbUserId]);
        if (!rows.length || !rows[0].discord_id) return null;
        return await guild.members.fetch(rows[0].discord_id).catch(() => null);
    } catch (e) {
        return null;
    }
}

/**
 * Called when a family is first created.
 * msg: { familyId, familyName, familyColor, ownerId (DB), ownerName, ranks: [{rank,name}x5] }
 */
async function familyCreated(msg) {
    const { familyId, familyName, familyTag, familyColor, ownerId, ownerName, ranks } = msg;
    const guild = await getGuild();
    const color = hexToInt(familyColor || '#AAAAAA');
    const safeName = toDiscordName(familyName);

    console.log(`[Discord/Family] Creating Discord structure for family "${familyName}" (ID: ${familyId})`);

    // ── 1. Create the category with minimal perms first (roles don't exist yet)
    const category = await guild.channels.create({
        name: `╔ ${safeName}`,
        type: ChannelType.GuildCategory,
        position: config.FAMILY_CATEGORY_POSITION,
        permissionOverwrites: [
            { id: guild.roles.everyone, deny: ['ViewChannel'] },
            { id: client.user.id,       allow: ['ViewChannel', 'SendMessages', 'ManageChannels', 'ManageMessages', 'ReadMessageHistory'] },
        ],
    });

    // ── 2. Create rank roles (1=lowest .. 5=owner) ───────────────────────────
    const roleIds = {};
    for (const rankDef of (ranks || [])) {
        const role = await guild.roles.create({
            name: `[${familyTag}] ${rankDef.name} R${rankDef.rank}`,
            color: color,
            mentionable: false,
            reason: `Family "${familyName}" rank role`,
        });
        roleIds[rankDef.rank] = role.id;
    }

    // ── 3. Build category permission overwrites ──────────────────────────────
    // All rank roles get view access on the category; channels will inherit.
    // Bot gets explicit full access so it can always manage what it creates.
    const categoryPerms = [
        { id: guild.roles.everyone, deny: ['ViewChannel'] },
        { id: client.user.id,       allow: ['ViewChannel', 'SendMessages', 'ManageChannels', 'ManageMessages', 'ReadMessageHistory'] },
    ];
    for (const [rank, roleId] of Object.entries(roleIds)) {
        const allow = ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AddReactions', 'AttachFiles', 'EmbedLinks'];
        if (parseInt(rank) >= 5) allow.push('ManageMessages');
        categoryPerms.push({ id: roleId, allow });
    }

    // Update the category with the full permission set now that roles exist
    await category.permissionOverwrites.set(categoryPerms);

    // ── 4. Create text/voice channels inside the category (inherit perms) ────
    const channelIds = {};
    for (const chDef of config.FAMILY_CHANNELS) {
        const chType = chDef.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
        const createOptions = {
            name: chDef.name,
            type: chType,
            parent: category.id,
            // No permissionOverwrites here — inherits from category
        };
        if (chType === ChannelType.GuildText && chDef.topic) {
            createOptions.topic = chDef.topic;
        }
        const ch = await guild.channels.create(createOptions);
        channelIds[chDef.name] = ch.id;
    }

    // ── 5. Store in memory + persist to disk ────────────────────────────────
    familyDiscord.set(familyId, { categoryId: category.id, channelIds, roleIds });
    saveFamilyMap();

    // ── 6. Assign owner their rank 5 role ────────────────────────────────────
    const ownerMember = await getMemberByDbId(guild, ownerId);
    if (ownerMember) {
        if (roleIds[5]) await ownerMember.roles.add(roleIds[5]).catch(() => {});
    }

    // ── 7. Post a welcome message in #chat ───────────────────────────────────
    const chatChannelId = channelIds['chat'];
    if (chatChannelId) {
        const chatChannel = await guild.channels.fetch(chatChannelId).catch(() => null);
        if (chatChannel) {
            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(`🏠 Welcome to ${familyName}!`)
                .setDescription(`This is the private Discord space for **${familyName}**.\n\n> Family members who have linked their Discord account will automatically get access here.`)
                .addFields(
                    { name: '👑 Founded by', value: ownerName, inline: true },
                    { name: '💬 Channels', value: config.FAMILY_CHANNELS.map(c => `\`${c.name}\``).join(' · '), inline: false },
                )
                .setFooter({ text: 'Central Online — Family System' })
                .setTimestamp();
            await chatChannel.send({ embeds: [embed] }).catch(() => {});
        }
    }

    // ── 8. Log ───────────────────────────────────────────────────────────────
    if (config.FAMILY_LOG_CHANNEL_ID) {
        sendLogEmbed('info', `🏠 **${ownerName}** created family **${familyName}** — Discord category created.`, []);
    }

    console.log(`[Discord/Family] Structure ready for "${familyName}": category ${category.id}, ${Object.keys(roleIds).length} roles, ${Object.keys(channelIds).length} channels.`);
}

/**
 * Called when a family is disbanded.
 */
async function familyDisbanded(msg) {
    const { familyId, familyName } = msg;
    const data = familyDiscord.get(familyId);
    if (!data) return;

    const guild = await getGuild();

    try {
        if (data.categoryId) {
            const category = await guild.channels.fetch(data.categoryId).catch(() => null);
            if (category) {
                const children = guild.channels.cache.filter(c => c.parentId === category.id);
                for (const [, ch] of children) {
                    await ch.delete(`Family "${familyName}" disbanded`).catch(() => {});
                }
                await category.delete(`Family "${familyName}" disbanded`).catch(() => {});
            }
        }
    } catch (e) {
        console.warn('[Discord/Family] Error deleting category:', e.message);
    }

    for (const roleId of Object.values(data.roleIds || {})) {
        try {
            const role = await guild.roles.fetch(roleId).catch(() => null);
            if (role) await role.delete(`Family "${familyName}" disbanded`).catch(() => {});
        } catch (e) { /* ignore */ }
    }

    familyDiscord.delete(familyId);
    saveFamilyMap();

    if (config.FAMILY_LOG_CHANNEL_ID) {
        sendLogEmbed('info', `💀 Family **${familyName}** was disbanded — Discord category & roles removed.`, []);
    }

    console.log(`[Discord/Family] Cleaned up Discord for disbanded family "${familyName}" (ID: ${familyId}).`);
}

/**
 * Called when a player joins a family.
 */
async function familyMemberJoined(msg) {
    const { familyId, familyName, userId, username, rank } = msg;
    const data = familyDiscord.get(familyId);
    if (!data) return;

    const guild = await getGuild();
    const member = await getMemberByDbId(guild, userId);
    if (!member) return;

    const roleId = data.roleIds[rank] || data.roleIds[1];
    if (roleId) {
        await member.roles.add(roleId, `Joined family "${familyName}"`).catch(() => {});
    }

    const chatId = data.channelIds['chat'];
    if (chatId) {
        const ch = await guild.channels.fetch(chatId).catch(() => null);
        if (ch) {
            await ch.send(`👋 Welcome to **${familyName}**, ${member}!`).catch(() => {});
        }
    }

    console.log(`[Discord/Family] ${username} (rank ${rank}) joined family "${familyName}" — Discord role assigned.`);
}

/**
 * Called when a player leaves or is kicked from a family.
 */
async function familyMemberLeft(msg) {
    const { familyId, familyName, userId, username } = msg;
    const data = familyDiscord.get(familyId);
    if (!data) return;

    const guild = await getGuild();
    const member = await getMemberByDbId(guild, userId);
    if (!member) return;

    for (const roleId of Object.values(data.roleIds || {})) {
        await member.roles.remove(roleId, `Left/kicked from family "${familyName}"`).catch(() => {});
    }
    if (data.categoryId) {
        const category = await guild.channels.fetch(data.categoryId).catch(() => null);
        if (category) {
            await category.permissionOverwrites.delete(member, 'Left family').catch(() => {});
        }
    }

    console.log(`[Discord/Family] ${username} left family "${familyName}" — Discord roles removed.`);
}

/**
 * Called when a member's rank changes.
 */
async function familyRankChanged(msg) {
    const { familyId, familyName, userId, username, oldRank, newRank } = msg;
    const data = familyDiscord.get(familyId);
    if (!data) return;

    const guild = await getGuild();
    const member = await getMemberByDbId(guild, userId);
    if (!member) return;

    const oldRoleId = data.roleIds[oldRank];
    const newRoleId = data.roleIds[newRank];

    if (oldRoleId) await member.roles.remove(oldRoleId, `Rank change in "${familyName}"`).catch(() => {});
    if (newRoleId) await member.roles.add(newRoleId, `Rank change in "${familyName}"`).catch(() => {});

    if (data.categoryId) {
        const category = await guild.channels.fetch(data.categoryId).catch(() => null);
        if (category) {
            if (newRank >= 5) {
                await category.permissionOverwrites.edit(member, {
                    ManageChannels: true,
                    ManageMessages: true,
                }).catch(() => {});
            } else if (oldRank >= 5) {
                await category.permissionOverwrites.delete(member, 'Ownership transferred').catch(() => {});
            }
        }
    }

    console.log(`[Discord/Family] ${username} rank changed ${oldRank} → ${newRank} in family "${familyName}".`);
}

/**
 * Called when the family's main color changes.
 */
async function familyColorChanged(msg) {
    const { familyId, familyName, newColor } = msg;
    const data = familyDiscord.get(familyId);
    if (!data) return;

    const guild = await getGuild();
    const color = hexToInt(newColor);

    for (const roleId of Object.values(data.roleIds || {})) {
        try {
            const role = await guild.roles.fetch(roleId).catch(() => null);
            if (role) await role.edit({ color: color }, `Family "${familyName}" color changed`).catch(() => {});
        } catch (e) { /* ignore */ }
    }

    console.log(`[Discord/Family] Updated role colors for family "${familyName}" to ${newColor}.`);
}

/**
 * Called when a player links their Discord — auto-assigns family role if they're in one.
 */
async function onPlayerLinked(msg) {
    const { userId, discordId } = msg;
    try {
        const [rows] = await pool.query(
            'SELECT fm.family_id, fm.rank FROM family_members fm WHERE fm.user_id = ?',
            [userId]
        );
        if (!rows.length) return;

        const { family_id: familyId, rank } = rows[0];
        const data = familyDiscord.get(familyId);
        if (!data) return;

        const guild = await getGuild();
        const member = await guild.members.fetch(discordId).catch(() => null);
        if (!member) return;

        const roleId = data.roleIds[rank] || data.roleIds[1];
        if (roleId) await member.roles.add(roleId, 'Auto-assign on Discord link').catch(() => {});

        const chatId = data.channelIds['chat'];
        if (chatId) {
            const ch = await guild.channels.fetch(chatId).catch(() => null);
            if (ch) {
                const [famRows] = await pool.query('SELECT name FROM families WHERE id = ?', [familyId]);
                const famName = famRows.length ? famRows[0].name : 'the family';
                await ch.send(`👋 ${member} just linked their Discord — welcome to the **${famName}** Discord space!`).catch(() => {});
            }
        }
    } catch (e) {
        console.warn('[Discord/Family] onPlayerLinked error:', e.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  AUTO-ASSIGN FAMILY ROLE ON SERVER JOIN
//  If a player is already linked + in a family when they join the Discord
//  server, give them their role immediately without needing to re-link.
// ─────────────────────────────────────────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
    try {
        // Check if this Discord account is linked to an in-game account
        const [userRows] = await pool.query(
            'SELECT id FROM users WHERE discord_id = ?',
            [member.user.id]
        );
        if (!userRows.length) return; // Not linked yet — they'll get the role when they /link

        const userId = userRows[0].id;

        // Check if they're in a family
        const [famRows] = await pool.query(
            'SELECT family_id, rank FROM family_members WHERE user_id = ?',
            [userId]
        );
        if (!famRows.length) return; // Not in a family

        const { family_id: familyId, rank } = famRows[0];
        const data = familyDiscord.get(familyId);
        if (!data) return; // Family has no Discord structure yet

        const roleId = data.roleIds[rank] || data.roleIds[1];
        if (roleId) {
            await member.roles.add(roleId, 'Auto-assign on server join (already linked + in family)').catch(() => {});
            console.log(`[Discord/Family] ${member.user.tag} joined the server — auto-assigned family role (rank ${rank}).`);
        }

        // Welcome them in the family chat
        const chatId = data.channelIds['chat'];
        if (chatId) {
            const ch = await member.guild.channels.fetch(chatId).catch(() => null);
            if (ch) {
                const [nameRows] = await pool.query('SELECT name FROM families WHERE id = ?', [familyId]);
                const famName = nameRows.length ? nameRows[0].name : 'your family';
                await ch.send(`👋 ${member} just joined the server — welcome to the **${famName}** Discord space!`).catch(() => {});
            }
        }
    } catch (e) {
        console.warn('[Discord/Family] guildMemberAdd error:', e.message);
    }
});


// ─────────────────────────────────────────────────────────────────────────────
if (!config.BOT_TOKEN || config.BOT_TOKEN.startsWith('PASTE_')) {
    console.log('[Discord] Bot token not configured. Edit packages/discord/config.js');
    process.exit(0);
}

console.log('[Discord] Starting bot process...');
client.login(config.BOT_TOKEN).catch(err => {
    console.error('[Discord] Login failed:', err.message);
    process.exit(1);
});