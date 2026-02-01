let chatBrowser = null;
let isChatOpen = false;

mp.events.add('playerReady', () => {
    chatBrowser = mp.browsers.new('package://ui/chat/index.html');
    mp.gui.chat.show(false); 
    mp.gui.chat.activate(false);
});

// FIX: Wait for the UI to tell us "I am ready!"
mp.events.add('chat:browserReady', () => {
    mp.events.callRemote('chat:fetchCommands');
});

mp.events.add('chat:toggleVisibility', (visible) => {
    if (chatBrowser) chatBrowser.active = visible;
});

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

mp.events.add('chat:push', (username, message, type) => {
    if (chatBrowser) {
        const cleanName = username ? username.replace(/'/g, "\\'") : null;
        const cleanMsg = message.replace(/'/g, "\\'");
        chatBrowser.execute(`app.addMessage('${cleanName}', '${cleanMsg}', '${type}')`);
    }
});

mp.events.add('chat:updateCommands', (commands) => {
    if (chatBrowser) {
        // Pass the commands to the Vue app
        chatBrowser.execute(`app.setCommands(${JSON.stringify(commands)})`);
    }
});