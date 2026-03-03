const browser = mp.browsers.new("package://circleMenu/index.html");
let isMenuOpen = false;

// --- Interaction Mode State ---
let isInteractionMode = false;
let hoveredEntity = null; // The entity currently under the mouse

// --- Configuration ---
const KEY_INTERACTION_MODE = 0xA5; // 'R-Alt' Key
const MAX_INTERACTION_DIST = 8.0;  // Max distance
const SELECTION_RADIUS_PIXELS = 100; // Max pixels from center of object

// --- Outline System Setup (RageMP 1.1+) ---
mp.game.graphics.setEntityOverlayPassEnabled(true);
const outlineBatch = mp.game.graphics.createEntityOverlayBatch({
    enableDepth: true,
    deleteWhenUnused: false,
    keepNonBlurred: true,
    processAttachments: true,
    fill: { enable: false, color: 0xFFFFFFFF },
    noise: { enable: false, size: 0.0, speed: 0.0, intensity: 0.0 },
    outline: { enable: true, color: 0xFFFFFFFF, width: 2.0, blurRadius: 1.0, blurIntensity: 1.0 }
});

// Hide browser initially
browser.active = false;

// ----------------------------------------------------------------------------
// 1. Keybinds & Toggles
// ----------------------------------------------------------------------------

mp.keys.bind(KEY_INTERACTION_MODE, true, () => {
    if (mp.gui.cursor.visible && !isInteractionMode && !isMenuOpen) return;
    if (mp.players.local.isTypingInTextChat) return;

    if (isMenuOpen) {
        closeMenu();
        setIsInteractionMode(false);
    } else {
        setIsInteractionMode(!isInteractionMode);
    }
});

mp.events.add('click', (x, y, upOrDown, leftOrRight, relativeX, relativeY, worldX, worldY, hitEntity, hitType) => {
    if (leftOrRight !== 'left' || upOrDown !== 'down') return;
    if (!isInteractionMode || isMenuOpen) return;

    if (hoveredEntity) {
        openMenu(hoveredEntity);
    }
});

function setIsInteractionMode(state) {
    isInteractionMode = state;
    mp.gui.cursor.show(state, state);
    if (!state) hoveredEntity = null;
}

// ----------------------------------------------------------------------------
// 2. The Render Loop
// ----------------------------------------------------------------------------

mp.events.add('render', () => {
    if (!isInteractionMode || isMenuOpen) return;

    // 1. Find entity under mouse cursor
    const result = getEntityUnderMouse();

    // 2. Handle Outline
    if (result && result.handle) {
        hoveredEntity = result;
        outlineBatch.addThisFrame(result);
    } else {
        hoveredEntity = null;
    }
});

// ----------------------------------------------------------------------------
// 3. Menu Logic
// ----------------------------------------------------------------------------

function openMenu(entity) {
    setIsInteractionMode(false); 

    let menuItems = [];
    const entityType = entity.type;

    // --- CARS ---
    if (entityType === 'vehicle') {
        if (mp.players.local.vehicle) {
            // Player is driving — show race options for other vehicles
            menuItems = getDriverVehicleOptions(entity);
        } else {
            menuItems = getExternalVehicleOptions(entity);
        }
    } 
    // --- PLAYERS ---
    else if (entityType === 'player') {
        if (entity === mp.players.local) {
            // YOU CLICKED YOURSELF
            menuItems = getSelfOptions();
        } else {
            // YOU CLICKED SOMEONE ELSE
            menuItems = getPlayerOptions(entity);
        }
    }
    else {
        return;
    }

    browser.active = true;
    mp.gui.cursor.show(true, true);
    browser.execute(`updateMenu('${JSON.stringify(menuItems)}')`);
    isMenuOpen = true;
    global.circleMenuTarget = entity;
}

function closeMenu() {
    browser.active = false;
    mp.gui.cursor.show(false, false);
    isMenuOpen = false;
    global.circleMenuTarget = null;
}

mp.events.add('circleMenu:onSelect', (ident) => {
    const target = global.circleMenuTarget;

    switch(ident) {
        // Vehicle
        case 'lock':
            if(target && target.type === 'vehicle') mp.events.callRemote('vehicle:toggleLock', target);
            break;
        case 'trunk':
            // Handle trunk
            break;
            
        // Other Player
        case 'give_money':
            // Handle money
            break;
            
        // Self
        case 'inventory':
            // Open Inventory UI
            break;
        case 'dance':
            mp.events.callRemote('playAnimation', 'dance'); // Example
            break;
            
        case 'h2h_race':
            if (target && target.type === 'vehicle') {
                mp.events.callRemote('h2h:invite', target.remoteId);
            }
            break;
        case 'honk':
            // Small honk feedback
            break;
        case 'close':
            break;
    }
    closeMenu();
});

// ----------------------------------------------------------------------------
// 4. Helper Functions
// ----------------------------------------------------------------------------

function getEntityUnderMouse() {
    const mousePos = mp.gui.cursor.position; 
    if (!mousePos) return null;

    const resolution = mp.game.graphics.getScreenActiveResolution(0, 0);
    const maxDist3D = MAX_INTERACTION_DIST; 
    let closestEntity = null;
    let closestDist2D = 99999; 

    // Helper to process an entity
    const checkEntity = (entity) => {
        if (shouldIgnoreEntity(entity)) return;
        
        const pos = entity.position;
        const dist3D = mp.game.system.vdist(pos.x, pos.y, pos.z, mp.players.local.position.x, mp.players.local.position.y, mp.players.local.position.z);
        
        if (dist3D < maxDist3D) {
            const screenRatio = mp.game.graphics.world3dToScreen2d(pos.x, pos.y, pos.z);
            if (screenRatio) {
                const screenX = screenRatio.x * resolution.x;
                const screenY = screenRatio.y * resolution.y;
                const dx = Math.abs(screenX - mousePos[0]);
                const dy = Math.abs(screenY - mousePos[1]);
                const dist2D = Math.sqrt(dx*dx + dy*dy);

                if (dist2D < SELECTION_RADIUS_PIXELS && dist2D < closestDist2D) {
                    closestDist2D = dist2D;
                    closestEntity = entity;
                }
            }
        }
    };

    // 1. Check Vehicles
    mp.vehicles.forEachInStreamRange(checkEntity);

    // 2. Check Streamed Players (Others)
    mp.players.forEachInStreamRange(checkEntity);

    // 3. Check Self (Local Player)
    checkEntity(mp.players.local);

    return closestEntity;
}

function shouldIgnoreEntity(entity) {
    if (!entity.handle) return true;
    if (entity.getAlpha() < 255) return true; 
    return false;
}

// ----------------------------------------------------------------------------
// 5. Menu Options
// ----------------------------------------------------------------------------

function getExternalVehicleOptions(veh) {
    return [
        { title: 'Lock/Unlock', description: 'Toggle vehicle lock', icon: 'fa-lock', ident: 'lock' },
        { title: 'Trunk', description: 'Access storage', icon: 'fa-box-open', ident: 'trunk' },
        { title: 'Info', description: 'Inspect plate', icon: 'fa-info-circle', ident: 'veh_info' },
        { title: 'Close', description: 'Close Menu', icon: 'fa-times', ident: 'close' }
    ];
}

function getDriverVehicleOptions(veh) {
    // Options when YOU are driving and click on ANOTHER vehicle
    const items = [
        { title: 'Head to Head', description: 'Challenge driver to a race!', icon: 'fa-flag-checkered', ident: 'h2h_race' },
        { title: 'Honk', description: 'Honk at vehicle', icon: 'fa-bullhorn', ident: 'honk' },
        { title: 'Close', description: 'Close Menu', icon: 'fa-times', ident: 'close' }
    ];
    return items;
}

function getPlayerOptions(ply) {
    return [
        { title: 'Give Money', description: 'Hand over cash', icon: 'fa-money-bill-wave', ident: 'give_money' },
        { title: 'Show ID', description: 'Show passport', icon: 'fa-id-card', ident: 'show_id' },
        { title: 'Frisk', description: 'Search person', icon: 'fa-search', ident: 'frisk' },
        { title: 'Close', description: 'Close Menu', icon: 'fa-times', ident: 'close' }
    ];
}

function getSelfOptions() {
    return [
        { title: 'Inventory', description: 'Open your bag', icon: 'fa-backpack', ident: 'inventory' },
        { title: 'Phone', description: 'Open mobile', icon: 'fa-mobile-alt', ident: 'phone' },
        { title: 'Dance', description: 'Bust a move', icon: 'fa-music', ident: 'dance' },
        { title: 'Documents', description: 'Check your ID', icon: 'fa-id-card', ident: 'docs' },
        { title: 'Close', description: 'Close Menu', icon: 'fa-times', ident: 'close' }
    ];
}