// ============================================================
// client_packages/systems/weather.js — Weather & Time Client
// ============================================================

// --------------- STATE ----------------------------------------
let currentWeatherGta   = 'CLEAR';
let currentWeatherLabel = 'Clear';
let currentWeatherEmoji = '☀️';
let weatherForecast     = [];
let weatherEndTime      = 0;
let isWeatherReady      = false;

// --------------- GTA CLOCK SYNC (1:1 real time) ---------------
// Update GTA clock from real system time every 10 seconds
setInterval(() => {
    try {
        const now = new Date();
        mp.game.clock.setDateTime(
            now.getDate(),
            now.getMonth() + 1,
            now.getFullYear(),
            now.getHours(),
            now.getMinutes(),
            now.getSeconds()
        );
    } catch (e) { /* safe fail */ }
}, 10 * 1000);

// Also set immediately on load
mp.events.add('playerReady', () => {
    try {
        const now = new Date();
        mp.game.clock.setDateTime(
            now.getDate(),
            now.getMonth() + 1,
            now.getFullYear(),
            now.getHours(),
            now.getMinutes(),
            now.getSeconds()
        );
    } catch (e) {}
});

// --------------- APPLY WEATHER --------------------------------
function applyWeather(gtaType) {
    try {
        mp.game.misc.setWeatherTypePersist(gtaType);
        mp.game.misc.setWeatherTypeNowPersist(gtaType);
        mp.game.misc.setWeatherTypeNow(gtaType);
    } catch (e) { /* safe fail */ }
}

// --------------- WEATHER SYNC ---------------------------------
// Received from server on join, on each weather change, and on phone app open
mp.events.add('client:weather:sync', (payloadJson) => {
    try {
        const data = JSON.parse(payloadJson);

        const changed = data.gta !== currentWeatherGta;

        currentWeatherGta   = data.gta;
        currentWeatherLabel = data.label;
        currentWeatherEmoji = data.emoji;
        weatherEndTime      = data.endTime;
        weatherForecast     = data.forecast || [];
        isWeatherReady      = true;

        applyWeather(currentWeatherGta);

        // If the phone weather app is open, refresh it
        mp.events.call('client:weather:refreshPhoneApp');

    } catch (e) {
        console.error('[Weather Client] Sync error:', e);
    }
});

// --------------- PHONE NOTIFICATION ----------------------------
// Handled in phone/index.js — this event is the bridge
mp.events.add('client:weather:phoneNotify', (emoji, title, message) => {
    // Pass to phone browser via bridge event
    mp.events.call('client:weather:triggerPhoneNotify', emoji, title, message);
    // Also show overlay notification
    mp.events.call('showNotification', `${emoji} ${title}`, message);
});

// --------------- EXPOSE DATA FOR PHONE APP --------------------
mp.events.add('client:weather:getData', (callback) => {
    // Used by phone/index.js to pull current state
    mp.events.call('client:weather:dataReady', {
        gta:      currentWeatherGta,
        label:    currentWeatherLabel,
        emoji:    currentWeatherEmoji,
        endTime:  weatherEndTime,
        forecast: weatherForecast,
    });
});