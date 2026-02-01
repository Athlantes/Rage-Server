let chatBrowser = null;
let isChatOpen = false;

mp.events.add('playerReady', () => {
    // 1. Create the browser
    chatBrowser = mp.browsers.new('package://ui/chat/index.html');
    
    // 2. Disable default RAGE chat
    mp.gui.chat.show(false); 
    mp.gui.chat.activate(false);
});

// Toggle Chat Visibility (Helper)
mp.events.add('chat:toggleVisibility', (visible) => {
    if (chatBrowser) chatBrowser.active = visible;
});

// Open Chat Key (T)
mp.keys.bind(0x54, true, () => {
    if (isChatOpen || mp.gui.cursor.visible) return;
    
    isChatOpen = true;
    mp.gui.cursor.visible = true;
    chatBrowser.execute('app.openInput()');
    mp.game.controls.disableAllControlActions(0);
});

// Close Chat
mp.events.add('chat:close', () => {
    isChatOpen = false;
    mp.gui.cursor.visible = false;
    mp.game.controls.enableAllControlActions(0);
});

// Send Message
mp.events.add('chat:submit', (text) => {
    if (text.length > 0) {
        if (text.startsWith('/')) {
            mp.events.callRemote('playerCommand', text.substring(1));
            mp.events.callRemote('chat:say', text);
        } else {
            mp.events.callRemote('chat:say', text);
        }
    }
});

// Incoming Message from Server
mp.events.add('chat:push', (username, message, type) => {
    if (chatBrowser) {
        // Safe encode to prevent breaking JS
        const cleanName = username ? username.replace(/'/g, "\\'") : null;
        const cleanMsg = message.replace(/'/g, "\\'");
        chatBrowser.execute(`app.addMessage('${cleanName}', '${cleanMsg}', '${type}')`);
    }
});

// Receive Commands
mp.events.add('chat:updateCommands', (commands) => {
    if (chatBrowser) {
        chatBrowser.execute(`app.setCommands(${JSON.stringify(commands)})`);
    }
});