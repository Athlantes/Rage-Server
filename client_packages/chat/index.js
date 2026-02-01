let chatBrowser = null;
let isChatOpen = false;

mp.events.add('playerReady', () => {
    chatBrowser = mp.browsers.new('package://ui/chat/index.html');
    mp.gui.chat.show(false); // Hide default RAGE chat
    mp.gui.chat.activate(false);
});

// 1. Initialize Autocomplete
mp.events.add('client:chat:init', (commands) => {
    if (chatBrowser) {
        // Pass the array to the browser
        chatBrowser.execute(`window.chatAPI.setCommands(${JSON.stringify(commands)});`);
    }
});

// 2. Toggle Chat (Key T)
mp.keys.bind(0x54, true, () => {
    if (isChatOpen || mp.gui.cursor.visible) return;
    isChatOpen = true;
    mp.gui.cursor.visible = true;
    
    chatBrowser.execute('window.chatAPI.showInput(true);');
    mp.game.controls.disableAllControlActions(0);
});

// 3. Events from UI (Close & Send)
mp.events.add('chat:client:close', () => {
    isChatOpen = false;
    mp.gui.cursor.visible = false;
    mp.game.controls.enableAllControlActions(0);
    chatBrowser.execute('window.chatAPI.showInput(false);');
});

mp.events.add('chat:client:send', (text) => {
    mp.events.callRemote('chat:say', text);
});

// 4. Incoming Messages
mp.events.add('chat:push', (name, text, type) => {
    if (chatBrowser) {
        // Sanitize strings to prevent JS errors
        const safeName = name ? name.replace(/'/g, "\\'") : "";
        const safeText = text ? text.replace(/'/g, "\\'").replace(/\n/g, "") : "";
        chatBrowser.execute(`window.chatAPI.push('${safeName}', '${safeText}', '${type}')`);
    }
});