'use strict';

// ── RADAR SWEEP ANIMATION ──
const canvas  = document.getElementById('radar-canvas');
const ctx     = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const cx = W / 2, cy = H / 2;
const R  = (W / 2) - 4; // outer radius

let sweepAngle   = 0;
let blipAngle    = Math.random() * Math.PI * 2; 
let blipFade     = 0;    
let lastSweepHit = 0;    
let currentDist  = 9999; 

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

    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fill();

    [0.33, 0.55, 0.78, 1.0].forEach(pct => {
        ctx.beginPath();
        ctx.arc(cx, cy, R * pct, 0, Math.PI * 2);
        ctx.strokeStyle = color + '22';
        ctx.lineWidth = 1;
        ctx.stroke();
    });

    ctx.strokeStyle = color + '22';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();

    const TRAIL_ARC = Math.PI * 0.6;
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

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAngle) * R, cy + Math.sin(sweepAngle) * R);
    ctx.strokeStyle = color + 'cc';
    ctx.lineWidth   = 2;
    ctx.stroke();

    const angleDiff = ((sweepAngle - blipAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    if (angleDiff < 0.15) {
        blipFade    = 1.0;
        lastSweepHit = ts;
    } else {
        const age = (ts - lastSweepHit) / 2000;
        blipFade = Math.max(0, 1.0 - age);
    }

    if (blipFade > 0) {
        const maxDist = 600;
        const normDist = Math.min(currentDist / maxDist, 1.0);
        const blipR = normDist * (R - 10) + 5;
        const bx = cx + Math.cos(blipAngle) * blipR;
        const by = cy + Math.sin(blipAngle) * blipR;

        ctx.beginPath();
        ctx.arc(bx, by, 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${blipFade})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(bx, by, 9, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${blipFade * 0.4})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    const speedMult = currentDist < 30 ? 3.5 : currentDist < 75 ? 2.5 : currentDist < 150 ? 1.8 : 1.0;
    sweepAngle += 0.025 * speedMult;
    if (sweepAngle >= Math.PI * 2) sweepAngle -= Math.PI * 2;

    requestAnimationFrame(drawRadar);
}

requestAnimationFrame(drawRadar);

// ── SIGNAL UPDATE LOGIC ──
const bars = [ document.getElementById('bar-1'), document.getElementById('bar-2'), document.getElementById('bar-3'), document.getElementById('bar-4'), document.getElementById('bar-5') ];
const distanceEl  = document.getElementById('distance-value');
const statusEl    = document.getElementById('status-text');
const container   = document.getElementById('tracker-container');

let audioCtx = null;
let lastBeepTime = 0;

function createBeep(freq, duration, volume) {
    if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return; } }
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

function updateDistance(dist) {
    currentDist = dist;

    distanceEl.textContent = dist > 9999 ? '---' : String(dist);
    distanceEl.style.color = dist < 30 ? '#ff3333' : dist < 75 ? '#ff8800' : dist < 150 ? '#ffdd00' : '#ffffff';

    let activeBars = dist <= 40 ? 5 : dist <= 100 ? 4 : dist <= 200 ? 3 : dist <= 400 ? 2 : dist <= 600 ? 1 : 0;
    bars.forEach((bar, i) => {
        bar.classList.remove('active', 'warn', 'danger');
        if (i < activeBars) {
            bar.classList.add('active');
            if (dist < 40) bar.classList.add('danger');
            else if (dist < 100) bar.classList.add('warn');
        }
    });

    if (dist < 40) container.classList.add('pulsing'); else container.classList.remove('pulsing');

    if (dist < 30) { statusEl.textContent = 'TARGET NEARBY'; statusEl.style.color = '#ff3333'; }
    else if (dist < 100) { statusEl.textContent = 'SIGNAL STRONG'; statusEl.style.color = '#ffdd00'; }
    else if (dist < 300) { statusEl.textContent = 'SIGNAL DETECTED'; statusEl.style.color = '#00ff88'; }
    else { statusEl.textContent = 'TRACKING TARGET'; statusEl.style.color = '#00ff8888'; }

    const now = Date.now();
    let beepInterval = dist < 30 ? 250 : dist < 75 ? 500 : dist < 150 ? 900 : dist < 300 ? 1500 : 2200;
    let beepFreq     = dist < 30 ? 1400 : dist < 75 ? 1200 : dist < 150 ? 1000 : dist < 300 ? 900 : 860;
    let beepVol      = dist < 30 ? 0.15 : dist < 75 ? 0.12 : dist < 150 ? 0.10 : dist < 300 ? 0.08 : 0.06;

    if (now - lastBeepTime >= beepInterval) {
        createBeep(beepFreq, 0.08, beepVol);
        lastBeepTime = now;
    }
}

if (window.mp) { try { window.mp.trigger('client:tracker:ready'); } catch (_) {} }