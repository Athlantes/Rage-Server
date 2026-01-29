// client_packages/systems/atm.js

// 1. Configuration
const ATM_BLIP_ID = 108;       // Dollar Sign
const ATM_BLIP_COLOR = 3;      // Light Blue
const ATM_BLIP_SCALE = 0.8;
const ATM_BLIP_NAME = "ATM";

// 2. Prop Detection List
const ATM_HASHES = [
    'prop_atm_01', 'prop_atm_02', 'prop_atm_03', 'prop_fleeca_atm'
].map(s => mp.game.joaat(s));

// 3. State Variables
let nearbyAtm = null;          // The object handle for interaction
let activeAtmBlip = null;      // The blip object
let lastInteractionState = false;
let atmBrowser = null;

// 4. Detection Loop (Runs every 300ms)
setInterval(() => {
    // Stop check if menu is open
    if (mp.gui.cursor.visible && !atmBrowser) return; 

    const player = mp.players.local;
    let foundHandle = null;

    // Scan for closest ATM prop
    for (const hash of ATM_HASHES) {
        const handle = mp.game.object.getClosestObjectOfType(
            player.position.x, player.position.y, player.position.z,
            250.0, // Radius to see the BLIP (Increased to 20m so you see it on map before you can touch it)
            hash, 
            false, false, false
        );

        if (handle && handle !== 0) {
            foundHandle = handle;
            break;
        }
    }

    if (foundHandle) {
        const propPos = mp.game.entity.getCoords(foundHandle, true);

        // --- BLIP LOGIC ---
        // If we don't have a blip yet, create one at the prop's location
        if (!activeAtmBlip) {
            activeAtmBlip = mp.blips.new(ATM_BLIP_ID, propPos, {
                name: ATM_BLIP_NAME,
                scale: ATM_BLIP_SCALE,
                color: ATM_BLIP_COLOR,
                shortRange: true
            });
        } 
        // Optional: Update position in case it's a dynamic object (usually not needed for static ATMs)
        // else { activeAtmBlip.setCoords(propPos); }

        // --- INTERACTION LOGIC ---
        // Distance check for "Press E" (must be very close, e.g. 1.5m)
        const dist = mp.game.system.vdist(player.position.x, player.position.y, player.position.z, propPos.x, propPos.y, propPos.z);
        
        if (dist < 1.5) {
            nearbyAtm = foundHandle;
            if (!lastInteractionState) {
                mp.events.call('showInteraction', 'ATM', 'Press E to Access Bank');
                lastInteractionState = true;
            }
        } else {
            // Found the prop (so Blip stays), but too far to touch
            nearbyAtm = null;
            if (lastInteractionState) {
                mp.events.call('hideInteraction');
                lastInteractionState = false;
            }
        }

    } else {
        // --- CLEANUP ---
        // No ATM found nearby at all
        nearbyAtm = null;

        if (activeAtmBlip) {
            activeAtmBlip.destroy();
            activeAtmBlip = null;
        }

        if (lastInteractionState) {
            mp.events.call('hideInteraction');
            lastInteractionState = false;
        }
    }
}, 300);

// 5. Key Handler (E)
mp.keys.bind(0x45, true, () => {
    if (mp.gui.cursor.visible && !atmBrowser) return;
    if (!nearbyAtm) return;
    
    mp.events.callRemote('server:atm:open');
});

// 6. UI Events (Same as before)
mp.events.add('client:atm:openUI', (dataJson) => {
    if (atmBrowser) return;
    atmBrowser = mp.browsers.new('package://ui/atm.html');
    mp.gui.cursor.show(true, true);
    
    setTimeout(() => {
        if(atmBrowser) atmBrowser.execute(`loadData('${dataJson}')`);
    }, 100);
});

mp.events.add('client:atm:updateUI', (dataJson) => {
    if (atmBrowser) atmBrowser.execute(`loadData('${dataJson}')`);
});

mp.events.add('client:proxyATM', (type, amount) => {
    mp.events.callRemote('server:atm:process', type, amount);
});

mp.events.add('client:closeATM', () => {
    if (atmBrowser) {
        atmBrowser.destroy();
        atmBrowser = null;
    }
    mp.gui.cursor.show(false, false);
});