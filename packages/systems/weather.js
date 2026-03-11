// ============================================================
// packages/systems/weather.js  — Dynamic Weather System
// ============================================================

// --------------- STATE DEFINITIONS -------------------------
const WEATHER_STATES = {
    CLEAR:         { gta: 'CLEAR',    label: 'Clear',         emoji: '☀️',  minMin: 90,  maxMin: 300 },
    PARTLY_CLOUDY: { gta: 'CLOUDS',   label: 'Partly Cloudy', emoji: '⛅',  minMin: 60,  maxMin: 150 },
    CLOUDY:        { gta: 'OVERCAST', label: 'Cloudy',        emoji: '☁️',  minMin: 45,  maxMin: 120 },
    RAIN:          { gta: 'RAIN',     label: 'Rain',          emoji: '🌧',  minMin: 30,  maxMin: 90  },
    THUNDER:       { gta: 'THUNDER',  label: 'Thunderstorm',  emoji: '⛈',  minMin: 15,  maxMin: 45  },
};

// Weighted transitions: from state → [[nextState, weight], ...]
// Designed so rain occurs roughly once every ~48 real hours.
// Path to rain requires: CLEAR → PARTLY_CLOUDY → CLOUDY → RAIN
// Each step has a 15% chance, so rain is rare and feels earned.
const TRANSITIONS = {
    CLEAR:         [['CLEAR', 70], ['PARTLY_CLOUDY', 30]],
    PARTLY_CLOUDY: [['CLEAR', 50], ['PARTLY_CLOUDY', 35], ['CLOUDY', 15]],
    CLOUDY:        [['PARTLY_CLOUDY', 55], ['CLOUDY', 30], ['RAIN', 15]],
    RAIN:          [['CLOUDY', 70], ['RAIN', 20], ['THUNDER', 10]],
    THUNDER:       [['RAIN', 80], ['CLOUDY', 20]],
};

// States that trigger a phone notification when they start
const NOTIFY_ON_START = {
    RAIN:    { title: 'Rain Alert',        msg: "It's starting to rain in Los Santos." },
    THUNDER: { title: 'Thunderstorm',      msg: 'A thunderstorm is rolling in. Stay safe.' },
    CLEAR:   { title: 'Weather Clearing',  msg: 'The skies are clearing up.' },
};

// --------------- INTERNAL STATE ----------------------------
let currentState = 'CLEAR';
let weatherEndTime = 0;     // ms timestamp when current state expires
let forecast = [];          // Array of { state, startTime, endTime, label, emoji }
let isInitialized = false;

// --------------- HELPERS ------------------------------------
function weightedRandom(options) {
    const total = options.reduce((sum, [, w]) => sum + w, 0);
    let r = Math.random() * total;
    for (const [state, w] of options) {
        r -= w;
        if (r <= 0) return state;
    }
    return options[options.length - 1][0];
}

function randMs(minMin, maxMin) {
    const minutes = minMin + Math.random() * (maxMin - minMin);
    return Math.floor(minutes * 60 * 1000);
}

// Keep the forecast buffer topped up to 6 future entries
function rebuildForecast() {
    while (forecast.length < 6) {
        const prevState    = forecast.length > 0 ? forecast[forecast.length - 1].state   : currentState;
        const prevEndTime  = forecast.length > 0 ? forecast[forecast.length - 1].endTime : weatherEndTime;

        const nextState = weightedRandom(TRANSITIONS[prevState]);
        const data      = WEATHER_STATES[nextState];
        const duration  = randMs(data.minMin, data.maxMin);

        forecast.push({
            state:     nextState,
            startTime: prevEndTime,
            endTime:   prevEndTime + duration,
            label:     data.label,
            emoji:     data.emoji,
        });
    }
}

function buildSyncPayload() {
    return JSON.stringify({
        state:        currentState,
        gta:          WEATHER_STATES[currentState].gta,
        label:        WEATHER_STATES[currentState].label,
        emoji:        WEATHER_STATES[currentState].emoji,
        endTime:      weatherEndTime,
        forecast:     forecast.slice(0, 5).map(f => ({
            state:     f.state,
            startTime: f.startTime,
            label:     f.label,
            emoji:     f.emoji,
        })),
    });
}

function broadcastWeather(notifyChange) {
    const payload = buildSyncPayload();
    mp.players.forEach(player => {
        if (!player.logged) return;
        player.call('client:weather:sync', [payload]);

        if (notifyChange && NOTIFY_ON_START[currentState]) {
            const n = NOTIFY_ON_START[currentState];
            player.call('client:weather:phoneNotify', [
                WEATHER_STATES[currentState].emoji,
                n.title,
                n.msg,
            ]);
        }
    });
}

// --------------- ADVANCE LOGIC ------------------------------
function advanceWeather() {
    const prevState = currentState;

    // Consume first forecast entry as the new current state
    if (forecast.length > 0) {
        const next = forecast.shift();
        currentState    = next.state;
        weatherEndTime  = next.endTime;
    } else {
        // Fallback (shouldn't normally happen)
        const nextState = weightedRandom(TRANSITIONS[currentState]);
        const data      = WEATHER_STATES[nextState];
        currentState    = nextState;
        weatherEndTime  = Date.now() + randMs(data.minMin, data.maxMin);
    }

    rebuildForecast();

    const changed = prevState !== currentState;
    console.log(`[Weather] Changed: ${prevState} → ${currentState} | Next change in ${Math.round((weatherEndTime - Date.now()) / 60000)}m`);
    broadcastWeather(changed);
}

// --------------- INIT & TICK --------------------------------
function init() {
    const initData     = WEATHER_STATES['CLEAR'];
    currentState       = 'CLEAR';
    weatherEndTime     = Date.now() + randMs(initData.minMin, initData.maxMin);
    forecast           = [];
    rebuildForecast();
    isInitialized      = true;

    console.log(`[Weather] Initialized with CLEAR. First change in ${Math.round((weatherEndTime - Date.now()) / 60000)}m`);

    // Tick every 30 seconds to check if we should advance
    setInterval(() => {
        if (Date.now() >= weatherEndTime) {
            advanceWeather();
        }
    }, 30 * 1000);
}

init();

// --------------- PUBLIC EXPORTS -----------------------------
module.exports = {
    getCurrentState: () => currentState,
    getCurrentGta:   () => WEATHER_STATES[currentState].gta,
    isRaining:       () => currentState === 'RAIN' || currentState === 'THUNDER',
    isThunder:       () => currentState === 'THUNDER',
};

// --------------- SERVER EVENTS ------------------------------

// Player joins → send current weather immediately
mp.events.add('playerReady', (player) => {
    if (!isInitialized) return;
    setTimeout(() => {
        if (mp.players.exists(player)) {
            player.call('client:weather:sync', [buildSyncPayload()]);
        }
    }, 2000);
});

// Player opens weather phone app → send fresh data
mp.events.add('server:weather:request', (player) => {
    if (!player.logged || !isInitialized) return;
    player.call('client:weather:sync', [buildSyncPayload()]);
});