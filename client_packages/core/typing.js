// client_packages/core/typing.js

let lastTypingState = false;

// Received from the HTML UI
mp.events.add('client:chatTyping', (state) => {
    // Only send to server if state actually changed (optimization)
    if (state !== lastTypingState) {
        lastTypingState = state;
        
        // Tell server to update our status
        mp.events.callRemote('server:setTypingState', state);
    }
});