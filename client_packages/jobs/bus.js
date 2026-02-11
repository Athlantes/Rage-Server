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