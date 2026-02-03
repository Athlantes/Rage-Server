// client_packages/chat/index.js
let chatBrowser = null;
let isChatOpen = false;

mp.events.add('playerReady', () => {
    // Create browser but keep it invisible for now
    chatBrowser = mp.browsers.new('package://ui/chat/index.html');
    
    // ⚠️ DISABLE DEFAULT RAGE CHAT
    mp.gui.chat.show(false); 
    mp.gui.chat.activate(false);
});

// 1. Initialize Autocomplete from Server
mp.events.add('client:chat:init', (commands) => {
    if (chatBrowser) {
        chatBrowser.execute(`window.chatAPI.setCommands(${JSON.stringify(commands)});`);
    }
});

// 2. Open Chat (Key: T)
mp.keys.bind(0x54, true, () => {
    if (isChatOpen || mp.gui.cursor.visible) return;
    
    // BLOCK IF CAMERA IS ACTIVE
    if (global.isCameraActive) return;
    
    isChatOpen = true;
    mp.gui.cursor.visible = true;
    chatBrowser.execute('window.chatAPI.showInput(true);');
    
    // Disable game controls while typing
    mp.game.controls.disableAllControlActions(0);
});

// 3. Receive Message (Called by server)
mp.events.add('chat:push', (name, text, type) => {
    if (chatBrowser) {
        // Safe string escape to prevent JS breaking
        const safeName = name ? name.replace(/'/g, "\\'") : "";
        const safeText = text ? text.replace(/'/g, "\\'").replace(/\n/g, "") : "";
        chatBrowser.execute(`window.chatAPI.push('${safeName}', '${safeText}', '${type}')`);
    }
});

// 4. Events sent FROM the UI
mp.events.add('chat:client:close', () => {
    isChatOpen = false;
    mp.gui.cursor.visible = false;
    mp.game.controls.enableAllControlActions(0);
    chatBrowser.execute('window.chatAPI.showInput(false);');
});

mp.events.add('chat:client:send', (text) => {
    // Determine if it is a command or a normal message
    if (text.startsWith('/')) {
        // Send to server as a command event (remove the slash)
        mp.events.callRemote('command', text.substring(1)); 
    } else {
        // Send as a chat message
        mp.events.callRemote('chat:say', text);
    }
});