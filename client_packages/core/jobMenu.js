let jobMenuBrowser = null;

mp.events.add('client:openJobMenu', () => {
    if (jobMenuBrowser) return;

    jobMenuBrowser = mp.browsers.new('package://ui/pauseMenu/jobs.html');
    mp.gui.cursor.show(true, true);
    
    mp.events.callRemote('server:requestJobMenuData');
});

mp.events.add('client:closeJobMenu', () => {
    if (jobMenuBrowser) {
        jobMenuBrowser.destroy();
        jobMenuBrowser = null;
    }
    
    // [Fix] Added 'true' to force the menu to open regardless of cooldowns
    mp.events.call('client:togglePauseMenu', true);
});

mp.events.add('client:receiveJobMenuData', (dataJson) => {
    if (jobMenuBrowser) {
        jobMenuBrowser.execute(`renderJobs('${dataJson}');`);
    }
});

mp.keys.bind(0x1B, true, () => {
    if (jobMenuBrowser) {
        mp.events.call('client:closeJobMenu');
    }
});