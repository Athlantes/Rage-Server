let busBrowser = null;

// --- MENU EVENTS ---
mp.events.add('client:bus:openMenu', (routesJson) => {
    if (busBrowser) return;
    busBrowser = mp.browsers.new("package://ui/bus/index.html");
    mp.gui.cursor.show(true, true);
    setTimeout(() => {
        if(busBrowser) busBrowser.execute(`loadBusRoutes('${routesJson}');`);
    }, 250);
});

mp.events.add('client:bus:closeMenu', () => {
    if (busBrowser) {
        busBrowser.destroy();
        busBrowser = null;
    }
    mp.gui.cursor.show(false, false);
});

mp.events.add('client:bus:select', (index) => {
    mp.events.call('client:bus:closeMenu');
    mp.events.callRemote('server:bus:selectRoute', index);
});

// --- DOOR CONTROL ---
mp.events.add('client:bus:controlDoors', (vehId, open) => {
    const veh = mp.vehicles.atRemoteId(vehId);
    if (veh && mp.vehicles.exists(veh)) {
        if (open) {
            // Open front and passenger doors
            veh.setDoorOpen(0, false, false);
            veh.setDoorOpen(1, false, false);
        } else {
            veh.setDoorShut(0, false);
            veh.setDoorShut(1, false);
        }
    }
});