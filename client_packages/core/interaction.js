// client_packages/core/interaction.js
let activeInteraction = null; 

// 1. Listen for ColShapes (Server Synced OR Client Local)
mp.events.add("playerEnterColshape", (shape) => {
    // MODIFIED: Check for server-synced variable OR local property
    const data = shape.getVariable('interaction') || shape.interaction;
    
    if (data) {
        const localPlayer = mp.players.local;
        const veh = localPlayer.vehicle;

        // 1. Check: Must be on foot?
        if (data.requireOnFoot && veh) return;

        // 2. Check: Must be in vehicle?
        if (data.requireVehicle && !veh) return;
        
        // 3. Check: Must be driver?
        if (data.requireDriver && veh) {
            if (veh.getPedInSeat(-1) !== localPlayer.handle) return;
        }

        mp.events.call('showInteraction', data.title, data.text);
        activeInteraction = data;
    }
});

mp.events.add("playerExitColshape", (shape) => {
    // MODIFIED: Check for server-synced variable OR local property
    const data = shape.getVariable('interaction') || shape.interaction;
    if (data) {
        mp.events.call('hideInteraction');
        activeInteraction = null;
    }
});

// Event to restore interaction (called when menus close)
mp.events.add('interaction:restore', () => {
    if (activeInteraction) {
        const localPlayer = mp.players.local;
        const veh = localPlayer.vehicle;

        // Re-check conditions
        if (activeInteraction.requireOnFoot && veh) return;
        if (activeInteraction.requireVehicle && !veh) return;

        mp.events.call('showInteraction', activeInteraction.title, activeInteraction.text);
    }
});

// 2. Key Handler (E)
mp.keys.bind(0x45, true, function() {
    if (mp.gui.cursor.visible) return;
    
    if (activeInteraction) {
        const localPlayer = mp.players.local;
        const veh = localPlayer.vehicle;

        // Re-verify conditions
        if (activeInteraction.requireOnFoot && veh) return;
        if (activeInteraction.requireVehicle && !veh) return;
        if (activeInteraction.requireDriver && veh) {
            if (veh.getPedInSeat(-1) !== localPlayer.handle) return;
        }

        // Trigger Event
        mp.events.callRemote(activeInteraction.event, activeInteraction.data);
        return;
    }

    // No colshape interaction — let job-specific handlers try
    mp.events.call('interaction:keypress');
});