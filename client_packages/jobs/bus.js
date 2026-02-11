let busBrowser = null;

mp.events.add('client:bus:openMenu', (routesJson) => {
    if (busBrowser) return;

    busBrowser = mp.browsers.new("package://ui/bus/index.html");
    mp.gui.cursor.show(true, true);

    setTimeout(() => {
        if(busBrowser) {
            busBrowser.execute(`loadBusRoutes('${routesJson}');`);
        }
    }, 200);
});

mp.events.add('client:bus:closeMenu', () => {
    if (busBrowser) {
        busBrowser.destroy();
        busBrowser = null;
    }
    mp.gui.cursor.show(false, false);
});

mp.events.add('client:bus:select', (index) => {
    mp.events.callRemote('server:bus:selectRoute', index);
});