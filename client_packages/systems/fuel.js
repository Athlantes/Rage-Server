let fuelBrowser = null;
global.isFuelOpen = false;

const FuelStations = require('./data/fuelLocations.js').FuelStations;

// 1. Create Blips
FuelStations.forEach((station) => {
    mp.blips.new(361, new mp.Vector3(station.blip.x, station.blip.y, station.blip.z), {
        name: station.name,
        color: 35,
        shortRange: true,
        scale: 0.8,
        dimension: 0
    });
});

// 2. Render Markers (No X-RAY)
mp.events.add('render', () => {
    if (mp.gui.cursor.visible && !global.isFuelOpen) return;
    
    const localPos = mp.players.local.position;
    
    // Iterate through all stations
    FuelStations.forEach(station => {
        // Optimization: First check if player is near the general station (e.g., 60m)
        if (mp.game.system.vdist(localPos.x, localPos.y, localPos.z, station.blip.x, station.blip.y, station.blip.z) < 60) {
            
            // If near station, loop through that station's pumps
            station.pumps.forEach(pump => {
                if (mp.game.system.vdist(localPos.x, localPos.y, localPos.z, pump.x, pump.y, pump.z) < 20) {
                     mp.game.graphics.drawMarker(
                        1, 
                        pump.x, pump.y, pump.z - 1.0, 
                        0, 0, 0, 0, 0, 0, 
                        1.0, 1.0, 1.0, 
                        255, 50, 50, 100,
                        false, false, 2, false, null, null, false
                    );
                }
            });
        }
    });
});

// --- EXISTING UI LOGIC ---
mp.events.add('client:openFuelBrowser', (currentFuel, maxRefuel, price) => {
    if (fuelBrowser) return;
    global.isFuelOpen = true;
    mp.gui.chat.activate(false);
    mp.gui.chat.show(false);
    mp.gui.cursor.show(true, true);
    fuelBrowser = mp.browsers.new('package://ui/fuel.html');
    mp.events.add('browserDomReady', (browser) => {
        if (browser === fuelBrowser) {
            fuelBrowser.execute(`updateInfo(${currentFuel.toFixed(1)}, ${maxRefuel}, ${price})`);
        }
    });
});

mp.events.add('client:closeFuelBrowser', () => {
    if (fuelBrowser) {
        fuelBrowser.destroy();
        fuelBrowser = null;
    }
    global.isFuelOpen = false;
    mp.gui.chat.activate(true);
    mp.gui.chat.show(false);
    mp.gui.cursor.show(false, false);
});

mp.events.add('client:submitRefuel', (amount) => {
    mp.events.callRemote('server:processRefuel', amount);
});