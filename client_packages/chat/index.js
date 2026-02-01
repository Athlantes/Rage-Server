let chatBrowser = null;
let isChatOpen = false;

mp.events.add('playerReady', () => {
    chatBrowser = mp.browsers.new('package://ui/chat/index.html');
    mp.gui.chat.show(false); 
    mp.gui.chat.activate(false);
});

mp.events.add('chat:browserReady', () => {
    mp.events.callRemote('chat:fetchCommands');
});

mp.events.add('chat:updateCommands', (commands) => {
    if (chatBrowser) {
        chatBrowser.execute(`app.setCommands(${JSON.stringify(commands)})`);
    }
});

mp.events.add('chat:toggleVisibility', (visible) => {
    if (chatBrowser) chatBrowser.active = visible;
});

// Key T (0x54)
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
    mp.events.callRemote('chat:say', text);
});

// The main event that receives messages from Server
mp.events.add('chat:push', (username, message, type) => {
    if (chatBrowser) {
        // Escape quotes to prevent JS errors in execute
        const safeName = username ? username.replace(/'/g, "\\'") : null;
        const safeMsg = message.replace(/'/g, "\\'").replace(/\n/g, ""); // Remove newlines
        chatBrowser.execute(`app.addMessage('${safeName}', '${safeMsg}', '${type}')`);
    }
});