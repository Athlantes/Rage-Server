// tracker/app.js — Repo Tracker CEF Logic
// ============================================================
// Called by repoClient.js via:
//   trackerBrowser.execute(`updateDistance(${Math.round(d)});`);
//
// Thresholds (metres):
//   > 500   → 0 bars, cold signal
//   300-500 → 1 bar
//   150-300 → 2 bars
//   75-150  → 3 bars (yellow)
//   30-75   → 4 bars (orange)
//   0-30    → 5 bars (red), pulsing container, fast beep
// ============================================================

'use strict';

// ──────────────────────────────────────────────────────────────
// RADAR SWEEP ANIMATION
// ──────────────────────────────────────────────────────────────

const canvas  = document.getElementById('radar-canvas');
const ctx     = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const cx = W / 2, cy = H / 2;
const R  = (W / 2) - 4; // outer radius

let sweepAngle   = 0;
let blipAngle    = Math.random() * Math.PI * 2; // "target direction" dot
let blipFade     = 0;    // 0 = invisible, 1 = fully bright
let lastSweepHit = 0;    // timestamp of last sweep pass over blip
let currentDist  = 9999; // kept in sync with updateDistance()

// Colour states
const GREEN  = '#00ff88';
const YELLOW = '#ffdd00';
const ORANGE = '#ff8800';
const RED    = '#ff3333';

function getSignalColor(dist) {
    if (dist < 30)  return RED;
    if (dist < 75)  return ORANGE;
    if (dist < 150) return YELLOW;
    return GREEN;
}

function drawRadar(ts) {
    ctx.clearRect(0, 0, W, H);

    const color = getSignalColor(currentDist);

    // ── background circle ──
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fill();

    // ── concentric rings ──
    [0.33, 0.55, 0.78, 1.0].forEach(pct => {
        ctx.beginPath();
        ctx.arc(cx, cy, R * pct, 0, Math.PI * 2);
        ctx.strokeStyle = color + '22';
        ctx.lineWidth = 1;
        ctx.stroke();
    });

    // ── crosshair lines ──
    ctx.strokeStyle = color + '22';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();

    // ── sweep trail (cone) ──
    const TRAIL_ARC = Math.PI * 0.6;
    const gradient = ctx.createConicalGradient
        ? ctx.createConicalGradient(sweepAngle - TRAIL_ARC, sweepAngle, cx, cy) // non-standard
        : null;

    // Fallback: draw arc sectors
    const steps = 30;
    for (let i = 0; i < steps; i++) {
        const frac  = i / steps;
        const angle = sweepAngle - TRAIL_ARC * (1 - frac);
        const alpha = frac * 0.35;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, angle, angle + (TRAIL_ARC / steps) + 0.01);
        ctx.closePath();
        ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.fill();
    }

    // ── sweep line ──
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAngle) * R, cy + Math.sin(sweepAngle) * R);
    ctx.strokeStyle = color + 'cc';
    ctx.lineWidth   = 2;
    ctx.stroke();

    // ── blip (target dot) ──
    // Blip brightens when the sweep line passes over it
    const angleDiff = ((sweepAngle - blipAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    if (angleDiff < 0.15) {
        blipFade    = 1.0;
        lastSweepHit = ts;
    } else {
        // Fade out over 2 seconds
        const age = (ts - lastSweepHit) / 2000;
        blipFade = Math.max(0, 1.0 - age);
    }

    if (blipFade > 0) {
        // Blip position: scaled by distance (closer = nearer center)
        const maxDist = 600;
        const normDist = Math.min(currentDist / maxDist, 1.0);
        const blipR = normDist * (R - 10) + 5;
        const bx = cx + Math.cos(blipAngle) * blipR;
        const by = cy + Math.sin(blipAngle) * blipR;

        ctx.beginPath();
        ctx.arc(bx, by, 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${blipFade})`;
        ctx.fill();

        // glow ring
        ctx.beginPath();
        ctx.arc(bx, by, 9, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${blipFade * 0.4})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // ── advance sweep ──
    // Speed increases as distance decreases
    const speedMult = currentDist < 30 ? 3.5 : currentDist < 75 ? 2.5 : currentDist < 150 ? 1.8 : 1.0;
    sweepAngle += 0.025 * speedMult;
    if (sweepAngle >= Math.PI * 2) sweepAngle -= Math.PI * 2;

    requestAnimationFrame(drawRadar);
}

requestAnimationFrame(drawRadar);

// ──────────────────────────────────────────────────────────────
// SIGNAL BARS UPDATE
// ──────────────────────────────────────────────────────────────

const bars = [
    document.getElementById('bar-1'),
    document.getElementById('bar-2'),
    document.getElementById('bar-3'),
    document.getElementById('bar-4'),
    document.getElementById('bar-5')
];

const distanceEl  = document.getElementById('distance-value');
const statusEl    = document.getElementById('status-text');
const container   = document.getElementById('tracker-container');
const signalDot   = document.getElementById('signal-dot');

// Beep audio — generated programmatically (no external assets needed)
let audioCtx = null;
let lastBeepTime = 0;

function createBeep(freq, duration, volume) {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return; }
    }
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
}

// ──────────────────────────────────────────────────────────────
// MAIN UPDATE — called from repoClient.js
// ──────────────────────────────────────────────────────────────

/**
 * updateDistance(dist)
 * Called by the RAGE:MP client via browser.execute()
 * @param {number} dist — distance in metres to wanted car
 */
function updateDistance(dist) {
    currentDist = dist;

    // ── Distance readout ──
    distanceEl.textContent = dist > 9999 ? '---' : String(dist);

    // ── Colour theme based on distance ──
    if (dist < 30) {
        distanceEl.style.color = '#ff3333';
    } else if (dist < 75) {
        distanceEl.style.color = '#ff8800';
    } else if (dist < 150) {
        distanceEl.style.color = '#ffdd00';
    } else {
        distanceEl.style.color = '#ffffff';
    }

    // ── Signal bars ──
    let activeBars = 0;
    if (dist <= 600) activeBars = 1;
    if (dist <= 400) activeBars = 2;
    if (dist <= 200) activeBars = 3;
    if (dist <= 100) activeBars = 4;
    if (dist <= 40)  activeBars = 5;

    bars.forEach((bar, i) => {
        bar.classList.remove('active', 'warn', 'danger');
        if (i < activeBars) {
            bar.classList.add('active');
            if (dist < 40)  bar.classList.add('danger');
            else if (dist < 100) bar.classList.add('warn');
        }
    });

    // ── Container pulse (danger close) ──
    if (dist < 40) {
        container.classList.add('pulsing');
    } else {
        container.classList.remove('pulsing');
    }

    // ── Status text ──
    if (dist < 30) {
        statusEl.textContent = 'TARGET NEARBY';
        statusEl.style.color = '#ff3333';
    } else if (dist < 100) {
        statusEl.textContent = 'SIGNAL STRONG';
        statusEl.style.color = '#ffdd00';
    } else if (dist < 300) {
        statusEl.textContent = 'SIGNAL DETECTED';
        statusEl.style.color = '#00ff88';
    } else {
        statusEl.textContent = 'TRACKING TARGET';
        statusEl.style.color = '#00ff8888';
    }

    // ── Beep ──
    const now = Date.now();
    let beepInterval = 2500; // ms between beeps
    let beepFreq     = 880;
    let beepVol      = 0.08;

    if (dist < 30)  { beepInterval = 250;  beepFreq = 1400; beepVol = 0.15; }
    else if (dist < 75)  { beepInterval = 500;  beepFreq = 1200; beepVol = 0.12; }
    else if (dist < 150) { beepInterval = 900;  beepFreq = 1000; beepVol = 0.10; }
    else if (dist < 300) { beepInterval = 1500; beepFreq = 900;  beepVol = 0.08; }
    else if (dist < 500) { beepInterval = 2200; beepFreq = 860;  beepVol = 0.06; }

    if (now - lastBeepTime >= beepInterval) {
        createBeep(beepFreq, 0.08, beepVol);
        lastBeepTime = now;
    }
}

// Signal to client that the browser is ready
// repoClient.js uses a timeout fallback, but this allows instant start
if (window.mp) {
    try { window.mp.trigger('client:tracker:ready'); } catch (_) {}
}

console.log('[Tracker] CEF app.js loaded.');
