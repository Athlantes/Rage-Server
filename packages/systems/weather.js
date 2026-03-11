// ============================================================
// packages/systems/weather.js  — Dynamic Weather System
// ============================================================

const db = require('../core/database'); // Import your database pool

// --------------- STATE DEFINITIONS -------------------------
const WEATHER_STATES = {
    CLEAR:         { gta: 'CLEAR',    label: 'Clear',         emoji: '☀️',  minMin: 90,  maxMin: 300 },
    PARTLY_CLOUDY: { gta: 'CLOUDS',   label: 'Partly Cloudy', emoji: '⛅',  minMin: 60,  maxMin: 150 },
    CLOUDY:        { gta: 'OVERCAST', label: 'Cloudy',        emoji: '☁️',  minMin: 45,  maxMin: 120 },
    RAIN:          { gta: 'RAIN',     label: 'Rain',          emoji: '🌧',  minMin: 30,  maxMin: 90  },
    THUNDER:       { gta: 'THUNDER',  label: 'Thunderstorm',  emoji: '⛈',  minMin: 15,  maxMin: 45  },
};

const TRANSITIONS = {
    CLEAR:         [['CLEAR', 70], ['PARTLY_CLOUDY', 30]],
    PARTLY_CLOUDY: [['CLEAR', 50], ['PARTLY_CLOUDY', 35], ['CLOUDY', 15]],
    CLOUDY:        [['PARTLY_CLOUDY', 55], ['CLOUDY', 30], ['RAIN', 15]],
    RAIN:          [['CLOUDY', 70], ['RAIN', 20], ['THUNDER', 10]],
    THUNDER:       [['RAIN', 80], ['CLOUDY', 20]],
};

const NOTIFY_ON_START = {
    RAIN:    { title: 'Rain Alert',        msg: "It's starting to rain in Los Santos." },
    THUNDER: { title: 'Thunderstorm',      msg: 'A thunderstorm is rolling in. Stay safe.' },
    CLEAR:   { title: 'Weather Clearing',  msg: 'The skies are clearing up.' },
};

// --------------- INTERNAL STATE ----------------------------
let currentState = 'CLEAR';
let weatherEndTime = 0;     
let forecast = [];          
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

// --------------- DATABASE SYNC ------------------------------
async function saveWeatherToDB() {
    try {
        const forecastJson = JSON.stringify(forecast);
        // Using UPSERT so it creates row 1 if it doesn't exist, or updates it if it does
        await db.query(
            `INSERT INTO server_weather (id, current_state, end_time, forecast_json) 
             VALUES (1, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE current_state = ?, end_time = ?, forecast_json = ?`,
            [currentState, weatherEndTime, forecastJson, currentState, weatherEndTime, forecastJson]
        );
    } catch (err) {
        console.error('[Weather] Failed to save weather to DB:', err);
    }
}

// --------------- ADVANCE LOGIC ------------------------------
function advanceWeather() {
    const prevState = currentState;

    if (forecast.length > 0) {
        const next = forecast.shift();
        currentState    = next.state;
        weatherEndTime  = next.endTime;
    } else {
        const nextState = weightedRandom(TRANSITIONS[currentState]);
        const data      = WEATHER_STATES[nextState];
        currentState    = nextState;
        weatherEndTime  = Date.now() + randMs(data.minMin, data.maxMin);
    }

    rebuildForecast();

    const changed = prevState !== currentState;
    console.log(`[Weather] Changed: ${prevState} → ${currentState} | Next change in ${Math.round((weatherEndTime - Date.now()) / 60000)}m`);
    
    // Save to DB and broadcast to players
    saveWeatherToDB();
    broadcastWeather(changed);
}

// ============================================================
// REAL-TIME CLOCK SYNC
// ============================================================

function syncServerTime() {
    const now = new Date();
    
    // Grab the actual hours, minutes, and seconds from the OS
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();

    // Force the RAGE Multiplayer world to match
    mp.world.time.set(hour, minute, second);
}

// Run it once immediately when the server boots
syncServerTime();

// Then update it every 60 seconds so it never drifts out of sync
setInterval(syncServerTime, 60000);

// --------------- INIT & TICK --------------------------------
async function init() {
    try {
        const [rows] = await db.query('SELECT * FROM server_weather WHERE id = 1');
        
        if (rows.length > 0) {
            const dbData = rows[0];
            currentState = dbData.current_state;
            weatherEndTime = Number(dbData.end_time);
            forecast = JSON.parse(dbData.forecast_json);

            // --- CATCH UP LOGIC ---
            let missedCount = 0;
            // Fast-forward if the server was offline and missed scheduled changes
            while (Date.now() >= weatherEndTime && forecast.length > 0) {
                const missed = forecast.shift();
                currentState = missed.state;
                weatherEndTime = missed.endTime;
                missedCount++;
            }

            rebuildForecast(); // Fill up the forecast array to 6 items again
            isInitialized = true;

            console.log(`[Weather] DB Loaded. Fast-forwarded ${missedCount} missed changes.`);
            console.log(`[Weather] Current: ${currentState}. Next change in ${Math.max(0, Math.round((weatherEndTime - Date.now()) / 60000))}m`);
            
            // Save the newly adjusted timeline back to the DB immediately
            if (missedCount > 0) saveWeatherToDB(); 
            
        } else {
            // First time server startup fallback
            const initData     = WEATHER_STATES['CLEAR'];
            currentState       = 'CLEAR';
            weatherEndTime     = Date.now() + randMs(initData.minMin, initData.maxMin);
            forecast           = [];
            rebuildForecast();
            isInitialized      = true;
            
            console.log(`[Weather] Initialized with CLEAR. First change in ${Math.round((weatherEndTime - Date.now()) / 60000)}m`);
            saveWeatherToDB(); // Save first state to DB
        }

        // Tick every 30 seconds to check if we should advance
        setInterval(() => {
            if (Date.now() >= weatherEndTime) {
                advanceWeather();
            }
        }, 30 * 1000);

    } catch (err) {
        console.error('[Weather] Initialization error:', err);
    }
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
mp.events.add('playerReady', (player) => {
    if (!isInitialized) return;
    setTimeout(() => {
        if (mp.players.exists(player)) {
            player.call('client:weather:sync', [buildSyncPayload()]);
        }
    }, 2000);
});

mp.events.add('server:weather:request', (player) => {
    if (!player.logged || !isInitialized) return;
    player.call('client:weather:sync', [buildSyncPayload()]);
});