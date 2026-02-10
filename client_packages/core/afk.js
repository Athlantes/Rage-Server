// client_packages/core/afk.js

let lastAfkState = false;

// Check status every 1 second
setInterval(() => {
    // 1. Check if Pause Menu is open
    const isPaused = mp.game.ui.isPauseMenuActive();

    // 2. Check if window is out of focus (Alt-Tabbed)
    const isOutOfFocus = !mp.system.isFocused;

    const isAfk = isPaused || isOutOfFocus;

    // Only send to server if state CHANGED (save bandwidth)
    if (isAfk !== lastAfkState) {
        lastAfkState = isAfk;
        mp.events.callRemote('server:setAfkState', isAfk);
    }
}, 1000);