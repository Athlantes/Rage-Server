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
    STATUS_CHANNEL_ID:    '1478516481670119526',     // Channel for auto-updating player count embed
    ADMIN_LOG_CHANNEL_ID: '1478516834838909050',  // Channel for admin/mod notifications
    LINK_LOG_CHANNEL_ID:  '1478516926111027442',   // Channel for account link logs

    // ── Role IDs (assigned when a player links their Discord) ──
    LINKED_ROLE_ID:   '1478517014518562846',            // Role given to linked players

    // ── OAuth2 (for RAGE:MP mp.discord.requestOAuth2) ──
    OAUTH2_REDIRECT:  'http://localhost:3008/api/discord/callback',  // Must match in Discord Developer Portal

    // ── Server info for embeds ──
    SERVER_NAME:      'Central Online',
    SERVER_IP:        'rage.mp',             // Direct connect address
    SERVER_ICON_URL:  '',                    // URL to server logo (for embed thumbnails)
    EMBED_COLOR:      0x00A8FF,              // Blue accent color

    // ── Update intervals ──
    STATUS_UPDATE_INTERVAL: 60000,           // Update status channel every 60 seconds
};
