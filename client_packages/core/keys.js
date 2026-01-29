// Key: '2' (Engine)
mp.keys.bind(0x32, true, () => { // Key: 2
    if (mp.gui.cursor.visible) return; // Ignore if UI is open
    
    const player = mp.players.local;
    const vehicle = player.vehicle;

    // Check if player is in a vehicle and is the driver (seat -1)
    if (vehicle && vehicle.getPedInSeat(-1) === player.handle) {
        // Call server to toggle engine state
        mp.events.callRemote('vehicle:toggleEngine');
    }
});

// Key: 'L' (Lock)
mp.keys.bind(0x4C, true, function() {
    if (mp.gui.cursor.visible) return;
    if (global.isReturoOpen) return;
    mp.events.callRemote('vehicle:toggleLock');
});

mp.keys.bind(0x50, true, () => {
    if (mp.gui.cursor.visible) return; 
    if (mp.gui.chat.visible) return; 

    mp.game.ui.activateFrontendMenu(mp.game.joaat("FE_MENU_VERSION_MP_PAUSE"), false, -1);
});

mp.events.add('render', () => {
    const player = mp.players.local;
    if (player.vehicle && player.vehicle.getVariable('fuel') !== undefined) {
        // You would draw your UI text here.
        // For now, let's just print to console to prove it works
        // mp.game.graphics.drawText(`Fuel: ${player.vehicle.getVariable('fuel').toFixed(1)}%`, [0.5, 0.95]); 
    }
});