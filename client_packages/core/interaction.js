// --- INTERACTION SYSTEM ---
let activeInteraction = null; 

// 1. Listen for Server ColShapes
mp.events.add("playerEnterColshape", (shape) => {
    const data = shape.getVariable('interaction');
    
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
    const data = shape.getVariable('interaction');
    if (data) {
        mp.events.call('hideInteraction');
        activeInteraction = null;
    }
});

// 2. Key Handler (E)
mp.keys.bind(0x45, true, function() {
    if (mp.gui.cursor.visible) return;
    
    if (activeInteraction) {
        const localPlayer = mp.players.local;
        const veh = localPlayer.vehicle;

        // Re-verify conditions before triggering
        if (activeInteraction.requireOnFoot && veh) return;
        if (activeInteraction.requireVehicle && !veh) return;
        if (activeInteraction.requireDriver && veh) {
            if (veh.getPedInSeat(-1) !== localPlayer.handle) return;
        }

        // --- FIX: Pass the 'data' (treeId) to the server ---
        mp.events.callRemote(activeInteraction.event, activeInteraction.data);
    }
});