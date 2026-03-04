// packages/factions/dispatch/dispatchConfig.js
// ─────────────────────────────────────────────────────────────────────────────
// Each faction that wants a dispatch system registers a config here.
// The dispatch UI is one generic HTML page — this config drives its columns,
// colors, header title, and what action buttons appear.
// ─────────────────────────────────────────────────────────────────────────────

const DISPATCH_CONFIGS = {

    // ── Taxi (factionId: 1) ──────────────────────────────────────────────────
    1: {
        factionId: 1,
        title: 'Taxi Dispatch',
        subtitle: 'Los Santos Transit',
        accentColor: '#ffc300',      // Yellow - matches taxi brand
        icon: 'fas fa-taxi',
        callLabel: 'Ride Request',
        
        // --- NEW FIELDS REQUIRED BY THE SYSTEM ---
        chatTag: '[TAXI]', 
        messages: {
            onWay: 'A taxi driver is on the way to you!',
            arrived: 'Your driver has arrived! Get in the yellow cab.',
            completed: 'You have arrived at your destination. Thanks for riding!',
        },
        // ------------------------------------------

        // Columns rendered in the dispatch table (in order)
        columns: [
            { key: 'callerName',   label: 'Caller',      width: '18%' },
            { key: 'location',     label: 'Pickup',      width: '20%' },
            { key: 'destLocation', label: 'Destination',  width: '20%' },
            { key: 'distance',     label: 'Distance',    width: '14%' },
            { key: 'waitTime',     label: 'Waiting',     width: '14%' },
            { key: 'action',       label: 'Action',      width: '14%' },
        ],

        // Action button that appears per row
        actionButton: {
            label: 'Accept',
            icon: 'fas fa-check',
            color: 'green',           // 'green' | 'blue' | 'yellow' | 'red'
            event: 'dispatch:accept', // client event to fire
        },

        // HUD strip shown to driver after accepting (bottom-left, above status)
        hud: {
            icon: 'fas fa-taxi',
            color: '#ffc300',
            label: 'Active Fare',
        },

        emptyMessage: 'No ride requests right now.',
        emptyIcon: 'fas fa-road',
    },

    // ── LSPD (factionId: 2) ──────────────────────────────────────────────────
    2: {
        factionId: 2,
        title: 'Police Dispatch',
        subtitle: 'Los Santos Police Dept.',
        accentColor: '#00a8ff',
        icon: 'fas fa-shield-halved',
        callLabel: 'Incident',
        chatTag: '[911]',
        messages: {
            onWay:     'An LSPD unit is responding to your location.',
            arrived:   'Police have arrived at your location.',
            completed: 'The incident has been resolved.',
        },
        columns: [
            { key: 'callerName', label: 'Caller',    width: '18%' },
            { key: 'location',   label: 'Location',  width: '24%' },
            { key: 'callType',   label: 'Type',      width: '18%' },
            { key: 'distance',   label: 'Distance',  width: '14%' },
            { key: 'waitTime',   label: 'Waiting',   width: '12%' },
            { key: 'action',     label: 'Respond',   width: '14%' },
        ],
        actionButton: { label: 'Respond', icon: 'fas fa-shield-halved', color: 'blue', event: 'dispatch:accept' },
        hud: { icon: 'fas fa-shield-halved', color: '#00a8ff', label: 'Active Call' },
        emptyMessage: 'No active incidents.',
        emptyIcon: 'fas fa-shield-halved',
    },

};

module.exports = DISPATCH_CONFIGS;