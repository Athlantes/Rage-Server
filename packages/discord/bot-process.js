// ─────────────────────────────────────────────────────────────────────────────
//  Discord Bot — Standalone Process (packages/discord/bot-process.js)
//  Runs with system Node.js (spawned by RAGE:MP via child_process).
//  Receives events from RAGE:MP via stdin (line-delimited JSON).
// ─────────────────────────────────────────────────────────────────────────────

const { 
    Client, GatewayIntentBits, EmbedBuilder, ActivityType, REST, Routes, 
    SlashCommandBuilder, ChannelType, ModalBuilder, TextInputBuilder, 
    TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle 
} = require('discord.js');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs'); // Nu mai este strict necesar pentru /link, dar îl păstrăm dacă vrei pe viitor
const path = require('path');

// ── Load config (same file used by RAGE:MP side) ─────────────────────────────
const config = require('./config');

// ── Database connection (direct — not through RAGE:MP) ───────────────────────
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
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
        // Button click to start link flow
        if (interaction.isButton() && interaction.customId === 'rage_link_button') {
            const usernameModal = new ModalBuilder()
                .setCustomId('link_username_modal')
                .setTitle('Link In-Game Account');

            const usernameInput = new TextInputBuilder()
                .setCustomId('link_username_input')
                .setLabel('Enter your in-game username')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(usernameInput);
            usernameModal.addComponents(row);
            try {
                await interaction.showModal(usernameModal);
                console.log('[Discord] Opened username modal for', interaction.user.tag);
            } catch (e) {
                console.error('[Discord] Failed to open username modal:', e);
                await interaction.reply({ content: '❌ Could not open modal. Please try again or use `/link`.', ephemeral: true }).catch(() => {});
            }
            return;
        }

        // Modal submit for username -> send PIN and then prompt for PIN entry
        if (interaction.isModalSubmit() && interaction.customId === 'link_username_modal') {
            const username = interaction.fields.getTextInputValue('link_username_input');
            const [rows] = await pool.query('SELECT id, username, discord_id FROM users WHERE username = ?', [username]);
            if (rows.length === 0) {
                return interaction.reply({ content: '❌ This in-game account does not exist on the server.', ephemeral: true });
            }

            const user = rows[0];
            if (user.discord_id && user.discord_id !== interaction.user.id) {
                return interaction.reply({ content: '❌ This in-game account is already linked to another Discord account.', ephemeral: true });
            }

            // Verify player is online
            const isOnline = onlinePlayers.find(p => p.name.toLowerCase() === username.toLowerCase());
            if (!isOnline) {
                return interaction.reply({ content: `❌ The player **${username}** is not online. You must be online in-game to receive the verification code! If you just connected, please wait a few seconds and try again.`, ephemeral: true });
            }

            // Generate PIN and store pending link
            const pin = Math.floor(100000 + Math.random() * 900000).toString();
            pendingLinks.set(interaction.user.id, {
                userId: user.id,
                username: user.username,
                pin: pin,
                expires: Date.now() + 5 * 60 * 1000
            });

            // Send PIN to RAGE:MP server to be delivered in-game
            sendToRageMP({ type: 'sendLinkPin', username: user.username, pin: pin });

            // Provide an ephemeral button to open the PIN modal (can't open a modal from a modal submit)
            const enterPinButton = new ButtonBuilder()
                .setCustomId('rage_enter_pin')
                .setLabel('Enter verification code')
                .setStyle(ButtonStyle.Primary);

            const rowPin = new ActionRowBuilder().addComponents(enterPinButton);
            await interaction.reply({ content: `✅ A verification code was sent to **${user.username}** in-game. Click the button below to enter it.`, components: [rowPin], ephemeral: true }).catch(() => {});
            return;
        }

        if (interaction.isChatInputCommand()) {
            switch (interaction.commandName) {
                case 'status':  return await handleStatus(interaction);
                case 'link':    return await handleLink(interaction);
                case 'unlink':  return await handleUnlink(interaction);
                case 'profile': return await handleProfile(interaction);

                // Button click to open PIN modal (triggered after username modal flows)
                if (interaction.isButton() && interaction.customId === 'rage_enter_pin') {
                    console.log('[Discord] rage_enter_pin clicked by', interaction.user.tag);

                    // Ensure there is a pending link request for this user
                    const pending = pendingLinks.get(interaction.user.id);
                    if (!pending) {
                        await interaction.reply({ content: '❌ No pending verification found. Click the Link button again or use `/link`.', ephemeral: true }).catch(() => {});
                        return;
                    }

                    const pinModal = new ModalBuilder()
                        .setCustomId('link_modal')
                        .setTitle('Enter verification code');
                    const pinInput = new TextInputBuilder()
                        .setCustomId('pin_input')
                        .setLabel('6-digit code received in-game')
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(6)
                        .setMaxLength(6)
                        .setRequired(true);
                    pinModal.addComponents(new ActionRowBuilder().addComponents(pinInput));
                    try {
                        await interaction.showModal(pinModal);
                        console.log('[Discord] Opened PIN modal via button for', interaction.user.tag);
                    } catch (e) {
                        console.error('[Discord] Failed to open PIN modal via button:', e.stack || e);
                        await interaction.reply({ content: '❌ Could not open verification modal. Try `/link`.', ephemeral: true }).catch(() => {});
                    }
                    return;
                }
            }
        } else if (interaction.isModalSubmit()) {
            if (interaction.customId === 'link_modal') {
                return await handleLinkModal(interaction);
            }
        }
    } catch (err) {
        console.error(`[Discord] Interaction error:`, err);
        const reply = { content: '❌ An error occurred. Please try again.', ephemeral: true };
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
//  /link — Initiază procesul și trimite PIN-ul în joc
// ─────────────────────────────────────────────────────────────────────────────
async function handleLink(interaction) {
    const username  = interaction.options.getString('username');
    const discordId = interaction.user.id;

    // 1. Verificăm dacă Discord-ul e deja conectat
    const [existing] = await pool.query('SELECT id, username FROM users WHERE discord_id = ?', [discordId]);
    if (existing.length > 0) {
        return interaction.reply({ content: `⚠️ Your Discord account is already linked to **${existing[0].username}**. Use \`/unlink\` first to unlink it.`, ephemeral: true });
    }

    // 2. Verificăm dacă username-ul există și dacă nu e deja legat
    const [rows] = await pool.query('SELECT id, username, discord_id FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
        return interaction.reply({ content: '❌ This in-game account does not exist on the server.', ephemeral: true });
    }

    const user = rows[0];
    if (user.discord_id && user.discord_id !== discordId) {
        return interaction.reply({ content: '❌ This in-game account is already linked to another Discord account.', ephemeral: true });
    }

    // 3. Verificăm dacă jucătorul este ONLINE acum
    const isOnline = onlinePlayers.find(p => p.name.toLowerCase() === username.toLowerCase());
    if (!isOnline) {
        return interaction.reply({ content: `❌ The player **${username}** is not online. You must be online in-game to receive the verification code on your phone!`, ephemeral: true });
    }

    // 4. Generăm un PIN de 6 cifre și îl stocăm temporar
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    pendingLinks.set(discordId, {
        userId: user.id,
        username: user.username,
        pin: pin,
        expires: Date.now() + 5 * 60 * 1000 // Expiră în 5 minute
    });

    // 5. Trimitem comanda spre serverul de RageMP să îi trimită email-ul în joc
    sendToRageMP({ type: 'sendLinkPin', username: user.username, pin: pin });

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
        return interaction.reply({ content: '❌ The session expired or you don\'t have a pending link request.', ephemeral: true });
    }

    if (Date.now() > pending.expires) {
        pendingLinks.delete(discordId);
        return interaction.reply({ content: '❌ The code expired. Please use `/link` again.', ephemeral: true });
    }

    if (submittedPin !== pending.pin) {
        return interaction.reply({ content: '❌ Wrong code. Try again!', ephemeral: true });
    }

    // Codul este corect! Legăm conturile.
    await interaction.deferReply({ ephemeral: true });

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
    
    pendingLinks.delete(discordId); // Ștergem cererea din memorie
    await interaction.editReply(`✅ Ready! Your discord account is now linked to **${pending.username}**.`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  /unlink
// ─────────────────────────────────────────────────────────────────────────────
async function handleUnlink(interaction) {
    await interaction.deferReply({ ephemeral: true });

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
    await interaction.deferReply({ ephemeral: true });

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
        embed.setThumbnail(`http://26.170.61.66:3008/photos/mugshots/${u.mugshot}`);
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
//  START
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