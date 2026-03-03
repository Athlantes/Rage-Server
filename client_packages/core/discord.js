// ─────────────────────────────────────────────────────────────────────────────
//  Discord Rich Presence — client_packages/core/discord.js
//  Uses RAGE:MP's built-in mp.discord API
//  Wiki: https://wiki.rage.mp/wiki/Discord::update
// ─────────────────────────────────────────────────────────────────────────────

const APPLICATION_ID = '1335723876490940416'; // Discord Developer Application ID

let currentDetails = 'In the menu';
let currentState   = '';
let playerName     = '';

// ── Initial setup on join ──
mp.events.add('playerReady', () => {
    mp.discord.update(APPLICATION_ID, {
        details: 'Loading...',
        state:   'Connecting to Central Online',
        largeImageKey:  'logo_large',     // Upload in Discord Developer > Rich Presence > Art Assets
        largeImageText: 'Central Online',
        smallImageKey:  'icon_idle',
        smallImageText: 'In Menu',
        startTimestamp: Date.now(),
        buttons: [
            { label: '🎮 Join Server', url: 'https://rage.mp' },
            { label: '🌐 Website',     url: 'https://your-website.com' }
        ]
    });
});

// ── After successful login ──
mp.events.add('client:discord:setLoggedIn', (name, level) => {
    playerName = name;
    currentDetails = `Playing as ${name}`;
    currentState   = `Level ${level}`;

    mp.discord.update(APPLICATION_ID, {
        details: currentDetails,
        state:   currentState,
        largeImageKey:  'logo_large',
        largeImageText: 'Central Online',
        smallImageKey:  'icon_playing',
        smallImageText: `${name} — Lvl ${level}`,
        startTimestamp: Date.now(),
        buttons: [
            { label: '🎮 Join Server', url: 'https://rage.mp' },
            { label: '🌐 Website',     url: 'https://your-website.com' }
        ]
    });
});

// ── Generic presence update (called from server for activities) ──
mp.events.add('client:discord:update', (details, state, smallKey, smallText) => {
    currentDetails = details || currentDetails;
    currentState   = state   || currentState;

    mp.discord.update(APPLICATION_ID, {
        details: currentDetails,
        state:   currentState,
        largeImageKey:  'logo_large',
        largeImageText: 'Central Online',
        smallImageKey:  smallKey  || 'icon_playing',
        smallImageText: smallText || playerName,
        startTimestamp: Date.now(),
        buttons: [
            { label: '🎮 Join Server', url: 'https://rage.mp' },
            { label: '🌐 Website',     url: 'https://your-website.com' }
        ]
    });
});

// ── Job activity updates ──
mp.events.add('client:discord:setJob', (jobName) => {
    currentDetails = `Working: ${jobName}`;
    currentState   = playerName ? `Playing as ${playerName}` : '';

    mp.discord.update(APPLICATION_ID, {
        details: currentDetails,
        state:   currentState,
        largeImageKey:  'logo_large',
        largeImageText: 'Central Online',
        smallImageKey:  'icon_job',
        smallImageText: jobName,
        startTimestamp: Date.now(),
        buttons: [
            { label: '🎮 Join Server', url: 'https://rage.mp' },
            { label: '🌐 Website',     url: 'https://your-website.com' }
        ]
    });
});

// ── Clear job / back to idle ──
mp.events.add('client:discord:clearJob', () => {
    currentDetails = playerName ? `Playing as ${playerName}` : 'Exploring';
    currentState   = 'Free Roaming';

    mp.discord.update(APPLICATION_ID, {
        details: currentDetails,
        state:   currentState,
        largeImageKey:  'logo_large',
        largeImageText: 'Central Online',
        smallImageKey:  'icon_playing',
        smallImageText: playerName || 'Player',
        startTimestamp: Date.now(),
        buttons: [
            { label: '🎮 Join Server', url: 'https://rage.mp' },
            { label: '🌐 Website',     url: 'https://your-website.com' }
        ]
    });
});
