// ════════════════════════════════════════════════════════════════════════
//  H2H RACE UI — Script (CEF side)
//  Communicates with client_packages/systems/h2hRace.js via mp.trigger
// ════════════════════════════════════════════════════════════════════════

const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber  = document.getElementById('countdown-number');
const countdownSub     = document.getElementById('countdown-sub');
const goOverlay        = document.getElementById('go-overlay');
const raceHud          = document.getElementById('race-hud');
const hudDistance       = document.getElementById('hud-distance');
const hudTime          = document.getElementById('hud-time');
const hudDestName      = document.getElementById('hud-dest-name');
const hudProgressBar   = document.getElementById('hud-progress-bar');
const resultOverlay    = document.getElementById('result-overlay');
const resultText       = document.getElementById('result-text');
const resultTime       = document.getElementById('result-time');
const resultContainer  = document.getElementById('result-container');

let countdownInterval = null;

// ══════════════════════════════════════════════════════════════════════
//  COUNTDOWN
// ══════════════════════════════════════════════════════════════════════

function showCountdown(seconds) {
    hideAll();
    countdownOverlay.classList.remove('hidden');
    let remaining = seconds;

    // Show first number immediately
    setCountdownNumber(remaining);

    countdownInterval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            setCountdownNumber(remaining);
        } else if (remaining === 0) {
            // Hide countdown, show GO
            countdownOverlay.classList.add('hidden');
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }, 1000);
}

function setCountdownNumber(num) {
    countdownNumber.textContent = num;
    countdownNumber.classList.remove('pop-in');
    // Force reflow to restart animation
    void countdownNumber.offsetWidth;
    countdownNumber.classList.add('pop-in');

    // Update subtitle
    if (num === 1) {
        countdownSub.textContent = 'SET';
    } else {
        countdownSub.textContent = 'GET READY';
    }
}

// ══════════════════════════════════════════════════════════════════════
//  GO!
// ══════════════════════════════════════════════════════════════════════

function showGo() {
    countdownOverlay.classList.add('hidden');
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    goOverlay.classList.remove('hidden');
    setTimeout(() => {
        goOverlay.classList.add('hidden');
    }, 1200);
}

// ══════════════════════════════════════════════════════════════════════
//  RACE HUD
// ══════════════════════════════════════════════════════════════════════

function showHud(destName) {
    raceHud.classList.remove('hidden', 'hud-exit');
    hudDestName.textContent = destName || '---';
    hudDistance.textContent = '0 m';
    hudTime.textContent = '0.0s';
    hudProgressBar.style.width = '0%';
}

function updateHud(distance, time, progress) {
    if (raceHud.classList.contains('hidden')) return;

    // Format distance
    if (distance > 1000) {
        hudDistance.textContent = (distance / 1000).toFixed(1) + ' km';
    } else {
        hudDistance.textContent = Math.round(distance) + ' m';
    }

    // Format time
    hudTime.textContent = time.toFixed(1) + 's';

    // Progress bar (0-100)
    const pct = Math.min(Math.max(progress, 0), 100);
    hudProgressBar.style.width = pct + '%';
}

function hideHud() {
    if (raceHud.classList.contains('hidden')) return;
    raceHud.classList.add('hud-exit');
    setTimeout(() => {
        raceHud.classList.add('hidden');
        raceHud.classList.remove('hud-exit');
    }, 400);
}

// ══════════════════════════════════════════════════════════════════════
//  RESULT
// ══════════════════════════════════════════════════════════════════════

function showResult(isWin, timeStr) {
    hideHud();

    resultOverlay.classList.remove('hidden');
    resultContainer.classList.remove('result-exit');

    if (isWin) {
        resultText.textContent = 'YOU WIN!';
        resultText.className = 'win';
    } else {
        resultText.textContent = 'YOU LOSE!';
        resultText.className = 'lose';
    }

    resultTime.textContent = timeStr || '';

    // Auto-hide after 4.5 seconds
    setTimeout(() => {
        resultContainer.classList.add('result-exit');
        setTimeout(() => {
            resultOverlay.classList.add('hidden');
        }, 500);
    }, 4500);
}

// ══════════════════════════════════════════════════════════════════════
//  CLEANUP
// ══════════════════════════════════════════════════════════════════════

function hideAll() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    countdownOverlay.classList.add('hidden');
    goOverlay.classList.add('hidden');
    raceHud.classList.add('hidden');
    raceHud.classList.remove('hud-exit');
    resultOverlay.classList.add('hidden');
    resultContainer.classList.remove('result-exit');
}
