let garbageBrowser = null;

mp.events.add('client:garbage:openMenu', (routesJson) => {
    if (garbageBrowser) return;

    // Create Browser
    garbageBrowser = mp.browsers.new("package://ui/garbage/index.html");
    
    // Show Cursor
    mp.gui.cursor.show(true, true);
    
    // FIX: Increased timeout to 300ms to allow slower PCs to load HTML first
    setTimeout(() => {
        if(garbageBrowser) {
            garbageBrowser.execute(`loadRoutes('${routesJson}');`);
        }
    }, 300);
});

mp.events.add('client:garbage:close', () => {
    if (garbageBrowser) {
        garbageBrowser.destroy();
        garbageBrowser = null;
    }
    mp.gui.cursor.show(false, false);
});

// Forward selection to server
mp.events.add('client:garbage:select', (routeId) => {
    mp.events.call('client:garbage:close'); // Close UI
    mp.events.callRemote('server:garbage:startRoute', routeId); // Tell Server
});