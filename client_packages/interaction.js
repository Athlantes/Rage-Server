// --- INTERACTION SYSTEM ---
// Listens for 'E' key and ColShapes to trigger your UI

let activeInteraction = null; // Stores the event to call when E is pressed

// 1. Listen for Server ColShapes
// The server should setVariable('interaction', {title: "Job", text: "Press E", event: "startJob"})
mp.events.add("playerEnterColshape", (shape) => {
    // Check if this shape has interaction data
    const data = shape.getVariable('interaction');
    
    if (data) {
        // Show UI
        mp.events.call('showInteraction', data.title, data.text);
        activeInteraction = data;
    }
});

mp.events.add("playerExitColshape", (shape) => {
    const data = shape.getVariable('interaction');
    if (data) {
        // Hide UI
        mp.events.call('hideInteraction');
        activeInteraction = null;
    }
});

// 2. Key Handler (E)
mp.keys.bind(0x45, true, function() { // 0x45 is 'E'
    if (mp.gui.cursor.visible) return; // Ignore if typing
    
    if (activeInteraction) {
        // Trigger the event defined in the interaction data
        // We call it on the SERVER
        mp.events.callRemote(activeInteraction.event);
    }
});