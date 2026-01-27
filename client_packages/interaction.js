// --- INTERACTION SYSTEM ---
let activeInteraction = null; 

// 1. Listen for Server ColShapes
mp.events.add("playerEnterColshape", (shape) => {
    const data = shape.getVariable('interaction');
    
    if (data) {
        // NEW: Check if this interaction requires being on foot
        if (data.requireOnFoot && mp.players.local.vehicle) {
            return; // Don't show UI if in a car
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
        // NEW: Double check before sending (in case they got in a car while standing there)
        if (activeInteraction.requireOnFoot && mp.players.local.vehicle) {
            return;
        }

        mp.events.callRemote(activeInteraction.event);
    }
});