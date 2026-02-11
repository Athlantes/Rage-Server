let busBrowser = null;

mp.events.add('client:bus:openMenu', (routesJson) => {
    if (busBrowser) return;

    // Load the new UI file
    busBrowser = mp.browsers.new("package://ui/bus/index.html");
    
    mp.gui.cursor.show(true, true);
    
    // Tiny delay to ensure DOM is ready before injecting JSON
    setTimeout(() => {
        if(busBrowser) {
            busBrowser.execute(`loadBusRoutes('${routesJson}');`);
        }
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

mp.events.add('client:bus:controlDoors', (vehId, open) => {
    const veh = mp.vehicles.atRemoteId(vehId);
    
    if (veh && mp.vehicles.exists(veh)) {
        // Doors: 0 = Front Left, 1 = Front Right, 2 = Back Left, 3 = Back Right
        // We toggle all main doors for the bus effect
        const doors = [0, 1, 2, 3];
        
        doors.forEach(doorIdx => {
            if (open) {
                // setDoorOpen(doorIndex, loose, instant)
                veh.setDoorOpen(doorIdx, false, false);
            } else {
                // setDoorShut(doorIndex, instant)
                veh.setDoorShut(doorIdx, false);
            }
        });
    }
});