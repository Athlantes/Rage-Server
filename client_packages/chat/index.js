let chatBrowser = null;
let isChatOpen = false;

mp.events.add('playerReady', () => {
    chatBrowser = mp.browsers.new('package://ui/chat/index.html');
    
    // Disable default RAGE chat
    mp.gui.chat.show(false); 
    mp.gui.chat.activate(false);
});

// FIX: When UI is ready, ask server for commands
mp.events.add('chat:browserReady', () => {
    mp.events.callRemote('chat:fetchCommands');
});

mp.events.add('chat:toggleVisibility', (visible) => {
    if (chatBrowser) chatBrowser.active = visible;
});

// Key T
mp.keys.bind(0x54, true, () => {
    if (isChatOpen || mp.gui.cursor.visible) return;
    
    isChatOpen = true;
    mp.gui.cursor.visible = true;
    chatBrowser.execute('app.openInput()');
    mp.game.controls.disableAllControlActions(0);
});

mp.events.add('chat:close', () => {
    isChatOpen = false;
    mp.gui.cursor.visible = false;
    mp.game.controls.enableAllControlActions(0);
});

mp.events.add('chat:submit', (text) => {
    if (text.length > 0) {
        mp.events.callRemote('chat:say', text);
    }
});

mp.events.add('chat:push', (username, message, type) => {
    if (chatBrowser) {
        const cleanName = username ? username.replace(/'/g, "\\'") : null;
        const cleanMsg = message.replace(/'/g, "\\'");
        chatBrowser.execute(`app.addMessage('${cleanName}', '${cleanMsg}', '${type}')`);
    }
});

mp.events.add('chat:updateCommands', (commands) => {
    if (chatBrowser) {
        chatBrowser.execute(`app.setCommands(${JSON.stringify(commands)})`);
    }
});