let questBrowser = null;
let isQuestMenuOpen = false;
let cachedQuestData = "[]";

// 1. Toggle Logic
mp.events.add('client:toggleQuestMenu', () => {
    // Don't open if Pause Menu or other heavy UI is open
    if (mp.gui.cursor.visible && !isQuestMenuOpen) return;

    isQuestMenuOpen = !isQuestMenuOpen;

    if (isQuestMenuOpen) {
        if (!questBrowser) {
            questBrowser = mp.browsers.new("package://ui/pauseMenu/quests.html");
        }
        // Inject latest data immediately upon opening
        questBrowser.execute(`updateQuests('${cachedQuestData}')`);
        questBrowser.active = true;
        mp.gui.cursor.show(true, true);
    } else {
        if (questBrowser) {
            questBrowser.active = false;
            questBrowser.destroy(); // Optional: destroy to save RAM, or keep active=false
            questBrowser = null;
        }
        mp.gui.cursor.show(false, false);
    }
});

// 2. Receive Data from Server
mp.events.add('client:updateQuestUI', (questJson) => {
    cachedQuestData = questJson;
    
    // If open, update live
    if (questBrowser && isQuestMenuOpen) {
        questBrowser.execute(`updateQuests('${cachedQuestData}')`);
    }
});