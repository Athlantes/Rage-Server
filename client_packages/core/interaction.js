// --- INTERACTION SYSTEM ---
let activeInteraction = null; 

// 1. Listen for Server ColShapes
mp.events.add("playerEnterColshape", (shape) => {
    const data = shape.getVariable('interaction');
    
    if (data) {
        const localPlayer = mp.players.local;
        const veh = localPlayer.vehicle;

        // --- DEBUG LOG (Remove later if spammy) ---
        // mp.gui.chat.push(`[DEBUG] Enter Shape. Veh: ${!!veh}, ReqVeh: ${data.requireVehicle}`);

        // 1. Check: Must be on foot?
        if (data.requireOnFoot && veh) return;

        // 2. Check: Must be in vehicle?
        if (data.requireVehicle && !veh) return;
        
        // 3. Check: Must be driver? (FIXED)
        if (data.requireDriver && veh) {
            // Check if the ped in seat -1 (Driver) is the local player
            // If the driver seat is empty OR another player is driving, return.
            if (veh.getPedInSeat(-1) !== localPlayer.handle) return;
        }

        mp.events.call('showInteraction', data.title, data.text);
        activeInteraction = data;
    }
});

mp.events.add("playerExitColshape", (shape) => {
    // We only hide it if we were actually seeing it (activeInteraction is set)
    // checking data exists to be safe
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

        // Re-verify conditions
        if (activeInteraction.requireOnFoot && veh) return;
        if (activeInteraction.requireVehicle && !veh) return;
        
        // FIXED DRIVER CHECK
        if (activeInteraction.requireDriver && veh) {
            if (veh.getPedInSeat(-1) !== localPlayer.handle) return;
        }

        mp.events.callRemote(activeInteraction.event);
    }
});