// Key: '2' (Engine)
mp.keys.bind(0x32, true, function() {
    if (mp.gui.cursor.visible) return; // Don't trigger if typing in chat
    mp.events.callRemote('vehicle:toggleEngine');
});

// Key: 'L' (Lock)
mp.keys.bind(0x4C, true, function() {
    if (mp.gui.cursor.visible) return;
    mp.events.callRemote('vehicle:toggleLock');
});

mp.events.add('render', () => {
    const player = mp.players.local;
    if (player.vehicle && player.vehicle.getVariable('fuel') !== undefined) {
        // You would draw your UI text here.
        // For now, let's just print to console to prove it works
        // mp.game.graphics.drawText(`Fuel: ${player.vehicle.getVariable('fuel').toFixed(1)}%`, [0.5, 0.95]); 
    }
});