/**
 * script.js — Card Packs Unboxing UI
 * ─────────────────────────────────────────────────────────────────────────────
 * All UI choreography is controlled with async/await + Promises over CSS
 * animation events. No raw setTimeouts for sequencing (only for frame timing).
 *
 * FLOW SUMMARY:
 *   onPreviewData()      → preview screen
 *   onStartUnboxing()    → pack tear → face-up burst → countdown → shuffle → pick mode
 *   onCardRevealed()     → flip selected card → show action panel
 *   onRerollReady()      → dissolve card → reset pick mode
 *   onClaimReward()      → result screen → session end
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// ─── RAGE:MP bridge ───────────────────────────────────────────────────────────
// In RAGE:MP CEF, we call back to the game client via mp.trigger.
const trigger = (event, ...args) => {
    if (typeof mp !== 'undefined') {
        mp.trigger(event, ...args);
    } else {
        // Dev fallback — log for testing outside of RAGE
        console.log('[trigger]', event, ...args);
    }
};

// ─── STATE ────────────────────────────────────────────────────────────────────
let state = {
    packId:       null,
    theme:        'bronze',
    cardCount:    5,
    rewards:      [],       // all 5 reward objects (face-up phase)
    rerollCosts:  [],
    currentReward: null,    // the last revealed reward
    rerollIndex:  0,        // which reroll cost we're on
    currentPickedIndex: -1, // visual index of the currently picked card
    phase: 'idle',          // idle | preview | unboxing | picking | awaiting_claim
    itemSlot: null,
};

let cardEls = [];           // array of .card DOM elements
let particleCtx = null;
let particles   = [];

// ─── UTILITY ──────────────────────────────────────────────────────────────────

/** Wraps requestAnimationFrame in a Promise for precise 1-frame waits */
const nextFrame = () => new Promise(r => requestAnimationFrame(r));

/** Returns a Promise that resolves after `ms` milliseconds */
const wait = ms => new Promise(r => setTimeout(r, ms));

/** Returns a Promise that resolves when a CSS animation ends on `el` */
const onAnimEnd = (el, eventName = 'animationend') =>
    new Promise(r => el.addEventListener(eventName, r, { once: true }));

/** Returns a Promise that resolves when a CSS transition ends on `el` */
const onTransEnd = el =>
    new Promise(r => el.addEventListener('transitionend', r, { once: true }));

/** Switch the active screen */
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (id) document.getElementById(id)?.classList.add('active');
}

/** Set the phase hint label */
function setPhaseLabel(text, visible = true) {
    const el = document.getElementById('phase-label');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('visible', visible);
}

/** Build a rarity CSS class from a rarity string */
const rarityClass = r => `rarity-${r}`;

/** Update PP balance display */
function setPPBalance(pp) {
    const el = document.getElementById('pp-amount');
    if (el) el.textContent = pp.toLocaleString();
    document.getElementById('pp-balance')?.classList.add('visible');
}

// ─── PARTICLE SYSTEM ─────────────────────────────────────────────────────────

function initParticles() {
    const canvas = document.getElementById('particles');
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    particleCtx   = canvas.getContext('2d');

    for (let i = 0; i < 60; i++) spawnParticle();
    requestAnimationFrame(drawParticles);
}

function spawnParticle(burst = false, x, y, color) {
    particles.push({
        x:    x ?? Math.random() * window.innerWidth,
        y:    y ?? Math.random() * window.innerHeight,
        r:    Math.random() * 2 + 0.5,
        vx:   (Math.random() - 0.5) * (burst ? 4 : 0.3),
        vy:   burst ? -(Math.random() * 5 + 2) : -Math.random() * 0.5 - 0.1,
        alpha: burst ? 1 : Math.random() * 0.5 + 0.1,
        color: color ?? `hsl(${40 + Math.random() * 30}, 80%, 60%)`,
        life:  1,
        decay: burst ? Math.random() * 0.015 + 0.01 : Math.random() * 0.003 + 0.001,
    });
}

function drawParticles() {
    if (!particleCtx) return;
    particleCtx.clearRect(0, 0, particleCtx.canvas.width, particleCtx.canvas.height);

    particles = particles.filter(p => p.life > 0);

    for (const p of particles) {
        particleCtx.save();
        particleCtx.globalAlpha = p.alpha * p.life;
        particleCtx.fillStyle   = p.color;
        particleCtx.beginPath();
        particleCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        particleCtx.fill();
        particleCtx.restore();

        p.x    += p.vx;
        p.y    += p.vy;
        p.life -= p.decay;

        // wrap ambient particles
        if (!p.decay || p.decay < 0.005) {
            if (p.y < 0)                       p.y = window.innerHeight;
            if (p.x < 0)                       p.x = window.innerWidth;
            if (p.x > window.innerWidth)       p.x = 0;
            if (p.life < 0.1)                  p.life = 1;
        }
    }

    requestAnimationFrame(drawParticles);
}

function burstParticles(x, y, count = 30, color) {
    for (let i = 0; i < count; i++) {
        spawnParticle(true, x + (Math.random() - 0.5) * 40,
                            y + (Math.random() - 0.5) * 40, color);
    }
}

// ─── CARD FACTORY ─────────────────────────────────────────────────────────────

function createCard(index, reward) {
    const el = document.createElement('div');
    el.className = 'card stacked';
    el.dataset.index = index;

    const rarityColor = getRarityColor(reward?.rarity ?? 'common');
    const rarityGlow  = getRarityGlow(reward?.rarity ?? 'common');

    el.style.cssText = `
        --rarity-color: ${rarityColor};
        --rarity-glow:  ${rarityGlow};
        left: 50%; top: 50%;
        transform: translate(-50%, -50%);
        z-index: ${10 - index};
    `;

    el.innerHTML = `
        <div class="card-inner">
            <div class="card-back">
                <span class="card-back-logo">🃏</span>
            </div>
            <div class="card-face">
                <div class="reward-emoji">${reward?.icon ?? '❓'}</div>
                <div class="reward-title">${reward?.name ?? 'Mystery'}</div>
                <div class="reward-rarity-badge ${rarityClass(reward?.rarity ?? 'common')}">
                    ${reward?.rarity ?? 'common'}
                </div>
            </div>
        </div>
    `;

    return el;
}

function getRarityColor(rarity) {
    const map = {
        common:    '#9E9E9E', uncommon: '#4CAF50',
        rare:      '#2196F3', epic:     '#9C27B0',
        legendary: '#FF6B35'
    };
    return map[rarity] ?? '#9E9E9E';
}
function getRarityGlow(rarity) {
    const map = {
        common:    'rgba(158,158,158,0.5)', uncommon: 'rgba(76,175,80,0.6)',
        rare:      'rgba(33,150,243,0.65)', epic:     'rgba(156,39,176,0.7)',
        legendary: 'rgba(255,107,53,0.85)'
    };
    return map[rarity] ?? 'rgba(158,158,158,0.5)';
}

/** Calculates spread positions for N cards in a fan across the table */
function getSpreadPositions(count) {
    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;
    const spread = Math.min(480, window.innerWidth * 0.55);
    const positions = [];

    for (let i = 0; i < count; i++) {
        const t      = count === 1 ? 0 : (i / (count - 1)) - 0.5;
        const angle  = t * 18; // degrees of fan tilt
        const x      = cx + t * spread;
        const y      = cy + Math.abs(t) * 24; // slight arc
        positions.push({ x, y, angle });
    }
    return positions;
}

// ─── SCREEN: PREVIEW ─────────────────────────────────────────────────────────

window.onPreviewData = function(data) {
    state.phase   = 'preview';
    state.packId  = data.packId;
    state.theme   = data.theme;
    state.rerollCosts = data.rerollCosts ?? [50, 100, 250, 500];

    document.getElementById('overlay').setAttribute('data-theme', state.theme);

    // Populate header
    document.getElementById('preview-pack-name').textContent = data.packName;
    document.getElementById('preview-pack-desc').textContent = data.description;

    // Populate pack emoji (theme-driven)
    document.getElementById('preview-pack-emoji').textContent =
        state.theme === 'gold' ? '📦' : '📦';

    // Build drop table
    const tbody = document.getElementById('preview-table-body');
    tbody.innerHTML = '';

    // Sort by chance descending for readability
    const sorted = [...data.rewards].sort((a, b) => parseFloat(b.chance) - parseFloat(a.chance));

    for (const r of sorted) {
        const row = document.createElement('div');
        row.className = 'preview-row';
        row.innerHTML = `
            <span class="reward-icon">${r.icon}</span>
            <div class="reward-info">
                <div class="reward-name">${r.name}</div>
                <div class="reward-desc">${r.description}</div>
            </div>
            <span class="reward-rarity ${rarityClass(r.rarity)}">${r.rarity}</span>
            <span class="reward-chance">${r.chance}%</span>
        `;
        tbody.appendChild(row);
    }

    // Store slot for confirm call
    state.itemSlot = data.itemSlot ?? null;

    showScreen('screen-preview');
    document.getElementById('overlay').classList.add('visible');
};

// OPEN button
document.getElementById('btn-open')?.addEventListener('click', () => {
    if (state.phase !== 'preview') return;
    state.phase = 'confirming';
    // Disable button to prevent double-click
    document.getElementById('btn-open').disabled = true;
    trigger('client:cardPack:cef:confirmOpen', state.itemSlot);
});

// CANCEL button
document.getElementById('btn-cancel')?.addEventListener('click', () => {
    if (state.phase !== 'preview') return;
    trigger('client:cardPack:cef:cancel');
    hideOverlay();
});

// ESC key (handled by client bridge)
window.onEscapePressed = function() {
    if (state.phase === 'preview') {
        trigger('client:cardPack:cef:cancel');
        hideOverlay();
    }
};

function hideOverlay() {
    document.getElementById('overlay').classList.remove('visible');
}

// ─── SCREEN: UNBOXING ─────────────────────────────────────────────────────────

window.onStartUnboxing = async function(data) {
    state.phase      = 'unboxing';
    state.rewards    = data.rewards;
    state.cardCount  = data.cardCount ?? 5;
    state.rerollCosts = data.rerollCosts ?? [50, 100, 250, 500];

    showScreen('screen-unboxing');
    setPhaseLabel('');

    // Build and inject card elements into #card-table
    const table = document.getElementById('card-table');
    table.innerHTML = '';
    cardEls = [];

    for (let i = 0; i < state.rewards.length; i++) {
        const card = createCard(i, state.rewards[i]);
        table.appendChild(card);
        cardEls.push(card);
    }

    // ── STEP 1: Pack Shake ────────────────────────────────────────────────────
    await wait(300);
    const sandwich = document.getElementById('pack-sandwich');
    sandwich.classList.add('shaking');
    await wait(950);

    // ── STEP 2: Pack Tear ─────────────────────────────────────────────────────
    sandwich.classList.remove('shaking');
    sandwich.classList.add('tearing');
    await wait(450);

    document.getElementById('pack-stage').style.display = 'none'; // ← ADD THIS

    // Burst particles at center
    burstParticles(window.innerWidth / 2, window.innerHeight / 2, 50, '#c89b3c');

    // ── STEP 3: Cards burst out FACE UP ───────────────────────────────────────
    setPhaseLabel('Revealing your cards…');
    await wait(100);

    const spreadPos = getSpreadPositions(state.cardCount);
    const burstPromises = cardEls.map(async (card, i) => {
        const pos   = spreadPos[i];
        const delay = i * 100;
        await wait(delay);

        // Set the CSS vars for burst keyframe
        card.style.setProperty('--burst-origin', `translate(-50%, -50%)`);
        card.style.setProperty('--burst-target',
            `translate(${pos.x - window.innerWidth/2}px, ${pos.y - window.innerHeight/2}px) rotate(${pos.angle}deg) scale(1.08)`);
        card.style.setProperty('--burst-final',
            `translate(${pos.x - window.innerWidth/2}px, ${pos.y - window.innerHeight/2}px) rotate(${pos.angle}deg)`);
        card.style.setProperty('--card-spread-transform',
            `translate(${pos.x - window.innerWidth/2}px, ${pos.y - window.innerHeight/2}px) rotate(${pos.angle}deg)`);

        card.classList.remove('stacked');
        card.classList.add('bursting');

        // Flip face-up instantly (already face-up since .flipped is default for burst)
        card.classList.add('flipped');

        // Particles at card destination
        burstParticles(pos.x, pos.y, 15, getRarityColor(state.rewards[i]?.rarity));

        await onAnimEnd(card);
        card.classList.remove('bursting');
        // Keep at spread position via inline style
        card.style.left   = pos.x + 'px';
        card.style.top    = pos.y + 'px';
        card.style.transform = `translate(-50%, -50%) rotate(${pos.angle}deg)`;
    });

    await Promise.all(burstPromises);

    // ── STEP 4: Hold face-up for 5 seconds (countdown bar) ───────────────────
    const bar = document.getElementById('countdown-bar');
    bar?.classList.add('visible');
    const fill = document.getElementById('countdown-fill');
    fill?.classList.add('running');

    await wait(5000);

    bar?.classList.remove('visible');
    fill?.classList.remove('running');

    // ── STEP 5: Flip all cards face-DOWN ─────────────────────────────────────
    setPhaseLabel('Cards are being shuffled…');

    const flipDownPromises = cardEls.map(async (card, i) => {
        await wait(i * 60);
        card.classList.remove('flipped');
        await onTransEnd(card.querySelector('.card-inner'));
    });
    await Promise.all(flipDownPromises);

    // ── STEP 6: Stack to center ───────────────────────────────────────────────
    const stackPromises = cardEls.map(async (card, i) => {
        await wait(i * 40);
        card.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        card.style.left      = '50%';
        card.style.top       = '50%';
        card.style.transform = `translate(-50%, -50%) rotate(${(i - 2) * 3}deg)`;
        card.style.zIndex    = 10 - i;
    });
    await Promise.all(stackPromises);
    await wait(500);

    // ── STEP 7: Shuffle ───────────────────────────────────────────────────────
    for (let round = 0; round < 3; round++) {
        const shufflePromises = cardEls.map((card, i) => {
            card.classList.remove('shuffle-left', 'shuffle-right');
            void card.offsetWidth; // reflow
            card.classList.add(i % 2 === 0 ? 'shuffle-left' : 'shuffle-right');
            return onAnimEnd(card);
        });
        await Promise.all(shufflePromises);
        await wait(60);
    }

    cardEls.forEach(c => c.classList.remove('shuffle-left', 'shuffle-right'));

    // ── STEP 8: Spread face-down (re-spread) ─────────────────────────────────
    setPhaseLabel('Choose your card');
    await wait(80);

    const reSpreadPromises = cardEls.map(async (card, i) => {
        const pos = spreadPos[i];
        await wait(i * 80);
        card.style.transition = 'all 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)';
        card.style.left      = pos.x + 'px';
        card.style.top       = pos.y + 'px';
        card.style.transform = `translate(-50%, -50%) rotate(${pos.angle}deg)`;
        card.style.zIndex    = 10;
        // Store spread transform for dissolve animation
        card.style.setProperty('--card-spread-transform',
            `translate(${pos.x - window.innerWidth/2}px, ${pos.y - window.innerHeight/2}px) rotate(${pos.angle}deg)`);
    });
    await Promise.all(reSpreadPromises);
    await wait(200);

    // ── STEP 9: Enable picking ─────────────────────────────────────────────────
    state.phase = 'picking';
    cardEls.forEach((card, i) => {
        card.classList.add('selectable');
        card.addEventListener('click', () => onCardClicked(i), { once: true });
    });
};

// ─── CARD PICK ────────────────────────────────────────────────────────────────

async function onCardClicked(visualIndex) {
    if (state.phase !== 'picking') return;
    state.phase = 'waiting_reveal';
    state.currentPickedIndex = visualIndex;

    // Disable all cards immediately
    cardEls.forEach(c => c.classList.remove('selectable'));

    // Move picked card to center
    const picked = cardEls[visualIndex];
    picked.classList.add('picked');

    await nextFrame();
    picked.style.transition = 'all 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
    picked.style.left      = '50%';
    picked.style.top       = '50%';
    picked.style.transform = 'translate(-50%, -50%) rotate(0deg) scale(1.1)';
    picked.style.zIndex    = 20;

    // Dim the others
    cardEls.forEach((c, i) => {
        if (i !== visualIndex) c.classList.add('dimmed');
    });

    setPhaseLabel('');

    // Tell the server which visual card was picked
    // (server will return a RANDOM reward, not correlated to index)
    trigger('client:cardPack:cef:pickCard', visualIndex);
}

// ─── CARD REVEAL ─────────────────────────────────────────────────────────────

window.onCardRevealed = async function(payload) {
    const { visualIndex, reward, rerollCost, canReroll } = payload;
    state.currentReward = reward;

    const picked = cardEls[visualIndex];
    if (!picked) return;

    // Update the face with the actual server-returned reward
    const rarityColor = getRarityColor(reward.rarity);
    const rarityGlow  = getRarityGlow(reward.rarity);

    picked.style.setProperty('--rarity-color', rarityColor);
    picked.style.setProperty('--rarity-glow', rarityGlow);

    const face = picked.querySelector('.card-face');
    if (face) {
        face.querySelector('.reward-emoji').textContent   = reward.icon;
        face.querySelector('.reward-title').textContent   = reward.name;
        const badge = face.querySelector('.reward-rarity-badge');
        badge.textContent  = reward.rarity;
        badge.className    = `reward-rarity-badge ${rarityClass(reward.rarity)}`;
    }

    // Flip
    picked.classList.add('flipped');
    if (reward.rarity === 'legendary') picked.classList.add('legendary-pulse');

    // Burst particles on flip
    const rect = picked.getBoundingClientRect();
    const cx   = rect.left + rect.width  / 2;
    const cy   = rect.top  + rect.height / 2;
    burstParticles(cx, cy, 40, rarityColor);

    await wait(300);

    // Show action panel
    state.rerollIndex = state.rerollCosts.indexOf(rerollCost);
    if (state.rerollIndex < 0) state.rerollIndex = state.rerollCosts.length;

    const panel   = document.getElementById('action-panel');
    const label   = document.getElementById('action-reward-label');
    const subLbl  = document.getElementById('action-reward-sub');
    const rerollBtn = document.getElementById('btn-reroll');
    const costBadge = document.getElementById('reroll-cost-badge');

    label.textContent = reward.name;
    label.className   = `action-reward-label ${rarityClass(reward.rarity)}`;
    subLbl.textContent = reward.description ?? '';

    if (canReroll && rerollCost) {
        rerollBtn.style.display = 'block';
        costBadge.innerHTML = `Re-roll costs <span>${rerollCost} PP</span>`;
    } else {
        rerollBtn.style.display = 'none';
        costBadge.textContent = '';
    }

    state.phase = 'awaiting_claim';
    panel.classList.add('visible');
};

// ─── CLAIM BUTTON ─────────────────────────────────────────────────────────────

document.getElementById('btn-claim')?.addEventListener('click', async () => {
    if (state.phase !== 'awaiting_claim') return;
    state.phase = 'claiming';

    document.getElementById('action-panel')?.classList.remove('visible');
    trigger('client:cardPack:cef:claimReward');

    // Show result screen
    await wait(200);
    showResultScreen(state.currentReward);
});

// ─── RE-ROLL BUTTON ───────────────────────────────────────────────────────────

document.getElementById('btn-reroll')?.addEventListener('click', async () => {
    if (state.phase !== 'awaiting_claim') return;
    state.phase = 'rerolling';

    document.getElementById('action-panel')?.classList.remove('visible');

    // Dissolve from current center position using inline transition
    // (The CSS keyframe snaps the card back to spread position — wrong)
    const picked = cardEls[state.currentPickedIndex];
    if (picked) {
        picked.classList.remove('flipped', 'legendary-pulse', 'picked');
        await nextFrame();
        picked.style.transition = 'transform 0.5s ease, opacity 0.5s ease, filter 0.5s ease';
        picked.style.transform  = 'translate(-50%, -50%) rotate(20deg) scale(0.2) translateY(-100px)';
        picked.style.opacity    = '0';
        picked.style.filter     = 'brightness(4) blur(6px)';
        await wait(520);
        picked.style.visibility = 'hidden';
    }

    trigger('client:cardPack:cef:reRoll');
});

// ─── REROLL READY (server accepted reroll) ────────────────────────────────────

window.onRerollReady = async function(payload) {
    const { nextRerollCost, remaining, ppBalance } = payload;

    if (ppBalance !== undefined) setPPBalance(ppBalance);

    setPhaseLabel('Choose your next card');

    // Un-dim and re-enable all cards except the dissolved one
    state.phase = 'picking';

    cardEls.forEach((card, i) => {
        if (i === state.currentPickedIndex) return; // skip the dissolved card
        if (card.style.visibility === 'hidden') return; // skip any earlier dissolved cards
        card.classList.remove('dimmed');
        card.classList.add('selectable');
        card.addEventListener('click', () => onCardClicked(i), { once: true });
    });
};

// ─── RESULT SCREEN ───────────────────────────────────────────────────────────

function showResultScreen(reward) {
    document.getElementById('result-emoji').textContent  = reward.icon;
    document.getElementById('result-title').textContent  = reward.name;
    document.getElementById('result-desc').textContent   = reward.description ?? '';
    document.getElementById('result-title').className    = `rarity-${reward.rarity}`;

    showScreen('screen-result');
}

// ─── SESSION END ──────────────────────────────────────────────────────────────

window.onSessionEnd = function() {
    // Client bridge will close the browser after 2.4s
};

// ─── SERVER ERROR ─────────────────────────────────────────────────────────────

window.onServerError = function(error) {
    console.error('[CardPack] Server error:', error.msg);
    setPhaseLabel('Error: ' + (error.msg ?? 'Something went wrong.'));
};

// ─── INIT ─────────────────────────────────────────────────────────────────────

(function init() {
    initParticles();

    // Apply theme on overlay element
    document.getElementById('overlay').addEventListener('transitionend', () => {}, { once: true });
})();
