let questBrowser = null;
let isQuestMenuOpen = false;
let cachedQuestData = "[]";

mp.events.add('client:toggleQuestMenu', () => {
    if (mp.gui.cursor.visible && !isQuestMenuOpen) return;

    isQuestMenuOpen = !isQuestMenuOpen;

    if (isQuestMenuOpen) {
        if (!questBrowser) {
            questBrowser = mp.browsers.new("package://ui/pauseMenu/quests.html");
        }
        questBrowser.execute(`updateQuests('${cachedQuestData}')`);
        questBrowser.active = true;
        mp.gui.cursor.show(true, true);
    } else {
        if (questBrowser) {
            questBrowser.active = false;
            questBrowser.destroy(); 
            questBrowser = null;
        }
        mp.gui.cursor.show(false, false);
    }
});

mp.events.add('client:updateQuestUI', (questJson) => {
    cachedQuestData = questJson;
    if (questBrowser && isQuestMenuOpen) {
        questBrowser.execute(`updateQuests('${cachedQuestData}')`);
    }
});

mp.keys.bind(0x1B, true, () => {
    if (isQuestMenuOpen) {
        mp.events.call('client:toggleQuestMenu');
        
        mp.events.call('client:togglePauseMenu', true);
    }
});