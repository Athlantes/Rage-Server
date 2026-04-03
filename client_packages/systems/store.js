// client_packages/systems/store.js
// Client-side 24/7 Store System

'use strict';

// ---------------------------------------------------------------------------
// Config – must match stores.js on the server
// ---------------------------------------------------------------------------
const STORE_LOCATIONS = [
    { x: 24.46, y: -1347.42, z: 29.50  },
];

const BLIP_SPRITE    = 52;
const BLIP_COLOR     = 4;
const BLIP_SCALE     = 0.75;
const BLIP_NAME      = '24/7 Store';
const NPC_HASH       = mp.game.joaat('mp_m_shopkeep_01');
const INTERACT_RANGE = 2.0; // metres – distance to trigger UI hint

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let storeBrowser       = null;
let nearNpcHandle      = null;
let lastInteractState  = false;
let blipsCreated       = false;

// ---------------------------------------------------------------------------
// Blip Creation
// ---------------------------------------------------------------------------
mp.events.add('playerReady', () => {
    if (blipsCreated) return;

    STORE_LOCATIONS.forEach(loc => {
        mp.blips.new(
            BLIP_SPRITE,
            new mp.Vector3(loc.x, loc.y, loc.z),
            {
                name:       BLIP_NAME,
                scale:      BLIP_SCALE,
                color:      BLIP_COLOR,
                shortRange: true,
            }
        );
    });

    blipsCreated = true;
    console.log('[Store] Blips created.');
});

// ---------------------------------------------------------------------------
// Proximity Detection Loop (300 ms – matches ATM pattern)
// ---------------------------------------------------------------------------
setInterval(() => {
    // Don't scan while UI is open
    if (storeBrowser) return;

    const player = mp.players.local;
    const pos    = player.position;

    // Iterate all server-streamed peds and find the closest clerk
    // within range. This avoids the broken getClosestPed native API.
    let foundPed  = null;
    let closestDist = INTERACT_RANGE;

    mp.peds.forEach(ped => {
        if (mp.game.entity.getEntityModel(ped.handle) !== NPC_HASH) return;

        const pedPos = ped.position;
        const dx = pos.x - pedPos.x;
        const dy = pos.y - pedPos.y;
        const dz = pos.z - pedPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < closestDist) {
            closestDist = dist;
            foundPed    = ped;
        }
    });

    if (foundPed) {
        nearNpcHandle = foundPed.handle;
        if (!lastInteractState) {
            mp.events.call('showInteraction', BLIP_NAME, 'Press E to Browse');
            lastInteractState = true;
        }
    } else {
        nearNpcHandle = null;
        if (lastInteractState) {
            mp.events.call('hideInteraction');
            lastInteractState = false;
        }
    }
}, 300);

// ---------------------------------------------------------------------------
// Key: E – Open Store
// ---------------------------------------------------------------------------
mp.keys.bind(0x45, true, () => {
    if (mp.gui.cursor.visible) return;
    if (!nearNpcHandle)        return;

    mp.events.callRemote('server:store:open');
});

// ---------------------------------------------------------------------------
// Key: ESC – Close Store
// ---------------------------------------------------------------------------
mp.keys.bind(0x1B, false, () => {
    if (storeBrowser) {
        closeStoreUI();
    }
});

// ---------------------------------------------------------------------------
// UI Events (Server → Client)
// ---------------------------------------------------------------------------
mp.events.add('client:store:openUI', (catalogJson) => {
    if (storeBrowser) return;

    storeBrowser = mp.browsers.new('package://ui/store/index.html');
    mp.gui.cursor.show(true, true);

    // Small delay so the browser can finish loading before we push data
    setTimeout(() => {
        if (storeBrowser) {
            storeBrowser.execute(`window.loadCatalog(${catalogJson})`);
        }
    }, 120);
});

mp.events.add('client:store:purchaseOK', () => {
    if (storeBrowser) {
        storeBrowser.execute(`window.onPurchaseSuccess()`);
    }
});

// ---------------------------------------------------------------------------
// Proxy calls from the CEF page → server
// ---------------------------------------------------------------------------
mp.events.add('client:store:purchase', (itemId, qty) => {
    mp.events.callRemote('server:store:purchase', itemId, qty);
});

mp.events.add('client:store:close', () => {
    closeStoreUI();
    mp.events.callRemote('server:store:close');
});

// Hot-add a blip when an admin uses /addstore at runtime (no reconnect needed)
mp.events.add('client:store:addBlip', (x, y, z) => {
    mp.blips.new(
        BLIP_SPRITE,
        new mp.Vector3(x, y, z),
        {
            name:       BLIP_NAME,
            scale:      BLIP_SCALE,
            color:      BLIP_COLOR,
            shortRange: true,
        }
    );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function closeStoreUI() {
    if (storeBrowser) {
        storeBrowser.destroy();
        storeBrowser = null;
    }
    mp.gui.cursor.show(false, false);

    // Restore any active colshape interaction prompt
    mp.events.call('interaction:restore');
}
