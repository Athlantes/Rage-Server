// ─────────────────────────────────────────────────────────────────────────────
//  Discord Bot — packages/discord/config.js
//  All Discord-related configuration in one place.
//  Replace placeholder values with your actual Discord application credentials.
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    // ── Discord Application (from https://discord.com/developers/applications) ──
    BOT_TOKEN:        'MTMzNTcyMzg3NjQ5MDk0MDQxNg.Gxhc2a.bq1iKANAMfe8-rlLa9cyfDmRf1nJm4acXQcQi8',
    CLIENT_ID:        '1335723876490940416',
    CLIENT_SECRET:    'pPE7mTsffNiGpKoDZ_lfCFs8M9KrPXj-',

    // ── Your Discord Server (Guild) ──
    GUILD_ID:         '1424705128543289367',

    // ── Channel IDs ──
    ADMIN_LOG_CHANNEL_ID: '1478516834838909050',  // Channel for admin/mod notifications
    LINK_LOG_CHANNEL_ID:  '1478529101177290897',   // Channel for account link logs

    // ── Role IDs (assigned when a player links their Discord) ──
    LINKED_ROLE_ID:   '1478517014518562846',            // Role given to linked players

    // ── Channel where a permanent "Link to Rage" message will be posted
    LINK_RAGE_CHANNEL_ID: '1478529383827247174',

    // ── OAuth2 (for RAGE:MP mp.discord.requestOAuth2) ──
    OAUTH2_REDIRECT:  'http://localhost:3008/api/discord/callback',  // Must match in Discord Developer Portal

    // ── Server info for embeds ──
    SERVER_NAME:      'Central Online',
    SERVER_IP:        'rage.mp',             // Direct connect address
    SERVER_ICON_URL:  '',                    // URL to server logo (for embed thumbnails)
    EMBED_COLOR:      0x00A8FF,              // Blue accent color

    // ── Update intervals ──
    PRESENCE_UPDATE_INTERVAL: 60000,         // Update bot presence text every 60 seconds

    // ── Family System ──
    // Category position offset for new family categories (higher = lower in channel list)
    FAMILY_CATEGORY_POSITION: 10,
    // Default channels created for every family (order matters)
    FAMILY_CHANNELS: [
        { name: 'chat',         type: 'text',  topic: 'Family general chat' },
        { name: 'media',        type: 'text',  topic: 'Share screenshots, clips & media' },
        { name: 'announcements',type: 'text',  topic: 'Family announcements & news' },
        { name: 'voice',        type: 'voice', topic: '' },
    ],
    // Family log channel — set to a real channel ID if you want family create/disband logs
    FAMILY_LOG_CHANNEL_ID: '',
};