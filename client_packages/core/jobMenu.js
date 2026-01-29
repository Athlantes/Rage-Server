let jobMenuBrowser = null;

mp.events.add('client:openJobMenu', () => {
    if (jobMenuBrowser) return;

    // Create browser
    jobMenuBrowser = mp.browsers.new('package://ui/pauseMenu/jobs.html');
    mp.gui.cursor.show(true, true);
    
    // Request Data from Server
    mp.events.callRemote('server:requestJobMenuData');
});

mp.events.add('client:closeJobMenu', () => {
    if (jobMenuBrowser) {
        jobMenuBrowser.destroy();
        jobMenuBrowser = null;
    }
    mp.gui.cursor.show(false, false);

    mp.events.call('client:togglePauseMenu');
});

mp.events.add('client:receiveJobMenuData', (dataJson) => {
    if (jobMenuBrowser) {
        jobMenuBrowser.execute(`renderJobs('${dataJson}');`);
    }
});