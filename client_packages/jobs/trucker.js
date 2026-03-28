let truckerBrowser = null;
let currentObjective = null; // { marker, blip, colshape, type }
let currentContract = null;

mp.events.add('client:trucker:spawnNPC', () => {
    mp.peds.new(
        mp.game.joaat('s_m_m_trucker_01'), 
        new mp.Vector3(814.36, -2982.50, 6.02),
        -87.83, // Your new heading
        0 // Dimension
    );
});

mp.events.call('client:trucker:spawnNPC');

// Opens the UI
mp.events.add('client:trucker:showMenu', (routesJson) => {
    if (!truckerBrowser) {
        truckerBrowser = mp.browsers.new('package://ui/trucker/index.html');
        mp.gui.cursor.show(true, true);
    }
    // Small delay to ensure browser loaded
    setTimeout(() => {
        truckerBrowser.execute(`loadRoutes('${routesJson}')`);
    }, 150);
});

// UI Callback when player clicks a job
mp.events.add('client:trucker:selectJob', (contractJson) => {
    if (truckerBrowser) {
        truckerBrowser.destroy();
        truckerBrowser = null;
        mp.gui.cursor.show(false, false);
    }
    mp.events.callRemote('server:trucker:selectContract', contractJson);
});

// UI Callback when player closes menu
mp.events.add('client:trucker:closeMenu', () => {
    if (truckerBrowser) {
        truckerBrowser.destroy();
        truckerBrowser = null;
        mp.gui.cursor.show(false, false);
    }
    
    mp.events.callRemote('server:trucker:quitJob');
});

// Server tells client to start driving to the pickup bay
mp.events.add('client:trucker:startJob', (contractJson) => {
    currentContract = JSON.parse(contractJson);
    setObjective(currentContract.pickup, 'Pickup Cargo', 1); // 1 = Yellow blip
});

// Set GPS Marker & Blip
function setObjective(pos, name, blipColor) {
    clearObjective();

    const blip = mp.blips.new(1, new mp.Vector3(pos.x, pos.y, pos.z), {
        name: name, color: blipColor, scale: 1, route: true
    });

    const marker = mp.markers.new(1, new mp.Vector3(pos.x, pos.y, pos.z - 1.0), 4.0, {
        color: [255, 165, 0, 150], visible: true
    });

    const colshape = mp.colshapes.newSphere(pos.x, pos.y, pos.z, 4.0);

    currentObjective = { blip, marker, colshape, pos };
}

function clearObjective() {
    if (!currentObjective) return;
    if (currentObjective.blip) currentObjective.blip.destroy();
    if (currentObjective.marker) currentObjective.marker.destroy();
    if (currentObjective.colshape) currentObjective.colshape.destroy();
    currentObjective = null;
}

// Detect when player arrives at a marker
mp.events.add('playerEnterColshape', (shape) => {
    if (currentObjective && shape === currentObjective.colshape) {
        
        // Are we at the PICKUP phase?
        if (currentObjective.pos.x === currentContract.pickup.x) {
            mp.game.graphics.notify("~g~Cargo Loaded!~w~ Drive to the drop-off point.");
            // Change objective to the Dropoff
            setObjective(currentContract.dropoff, 'Dropoff Location', 5); // 5 = Yellow/Orange
        } 
        // Are we at the DROPOFF phase?
        else if (currentObjective.pos.x === currentContract.dropoff.x) {
            clearObjective();
            mp.events.callRemote('server:trucker:finishJob');
            currentContract = null;
        }
    }
});

// Interaction key (E) to open menu at Main Depot (Add a colshape at your depot coords for this to trigger)
mp.keys.bind(0x45, true, function() { // 'E' Key
    if (mp.gui.cursor.visible) return;
    
    // Check if near the new NPC location
    const dist = mp.players.local.position.subtract(new mp.Vector3(814.36, -2982.50, 6.02)).length();
    if (dist < 5.0) {
        mp.events.callRemote('server:trucker:requestMenu');
    }
});