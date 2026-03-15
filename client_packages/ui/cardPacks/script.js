/**
 * script.js — Lag-Free, Tearing Card Pack Unboxing UI
 */

'use strict';

const trigger = (event, ...args) => {
    if (typeof mp !== 'undefined') { mp.trigger(event, ...args); } 
    else { console.log('[trigger]', event, ...args); }
};

let state = {
    packId: null, theme: 'bronze', cardCount: 5, rewards: [], rerollCosts: [],
    currentReward: null, rerollIndex: 0, currentPickedIndex: -1, phase: 'idle', itemSlot: null,
    ppBalance: 0,
};

let cardEls = [];

const nextFrame = () => new Promise(r => requestAnimationFrame(r));
const wait = ms => new Promise(r => setTimeout(r, ms));
const onAnimEnd = (el, eventName = 'animationend') => new Promise(r => el.addEventListener(eventName, r, { once: true }));
const onTransEnd = el => new Promise(r => el.addEventListener('transitionend', r, { once: true }));

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (id) document.getElementById(id)?.classList.add('active');
}

function setPhaseLabel(text, visible = true) {
    const el = document.getElementById('phase-label');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('visible', visible);
}

const rarityClass = r => `rarity-${r}`;

function setPPBalance(pp) {
    state.ppBalance = pp;
    const el = document.getElementById('pp-amount');
    if (el) el.textContent = pp.toLocaleString();
    document.getElementById('pp-balance')?.classList.add('visible');
}

function getRarityColor(rarity) {
    const map = { common: '#9E9E9E', uncommon: '#4CAF50', rare: '#2196F3', epic: '#B388FF', legendary: '#FF9100' };
    return map[rarity] ?? '#9E9E9E';
}

function createCard(index, reward) {
    const el = document.createElement('div');
    el.className = `card stacked ${reward?.rarity ?? 'common'}`;
    el.dataset.index = index;

    const rarityColor = getRarityColor(reward?.rarity ?? 'common');

    el.style.cssText = `--rarity-color: ${rarityColor}; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: ${10 - index};`;

    el.innerHTML = `
        <div class="card-inner">
            <div class="card-back">
                <img src="./assets/logo.png" class="logo" alt="Logo" onerror="this.style.display='none'">
            </div>
            <div class="card-face">
                <img src="./assets/${reward?.icon ?? 'default'}.png" class="reward-img" onerror="this.src='./assets/default.png'">
                <div class="reward-title">${reward?.name ?? 'Mystery'}</div>
                <div class="reward-rarity-badge">${reward?.rarity ?? 'common'}</div>
            </div>
        </div>
    `;
    return el;
}

function getSpreadPositions(count) {
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    const spread = Math.min(600, window.innerWidth * 0.65);
    const positions = [];
    for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : (i / (count - 1)) - 0.5;
        const angle = t * 14;
        const x = cx + t * spread;
        const y = cy + Math.abs(t) * 30;
        positions.push({ x, y, angle });
    }
    return positions;
}

// ─── SCREEN: PREVIEW ─────────────────────────────────────────────────────────
window.onPreviewData = function(data) {
    state.phase = 'preview'; state.packId = data.packId; state.theme = data.theme; state.rerollCosts = data.rerollCosts ?? [50, 100, 250, 500];
    if (data.ppBalance !== undefined) setPPBalance(data.ppBalance);

    document.getElementById('overlay').setAttribute('data-theme', state.theme);
    document.getElementById('preview-pack-name').textContent = data.packName;
    document.getElementById('preview-pack-desc').textContent = data.description;
    
    // Theme the dummy pack textures
    const packColor = state.theme === 'gold' ? '#f0c060' : '#c89b3c';
    document.querySelectorAll('.dummy-texture').forEach(el => {
        el.style.borderColor = packColor;
        el.style.color = packColor;
    });

    const tbody = document.getElementById('preview-table-body');
    tbody.innerHTML = '';
    const sorted = [...data.rewards].sort((a, b) => parseFloat(b.chance) - parseFloat(a.chance));

    for (const r of sorted) {
        const row = document.createElement('div');
        row.className = 'preview-row';
        row.innerHTML = `
            <img src="./assets/${r.icon}.png" class="reward-img" onerror="this.src='./assets/default.png'">
            <div class="reward-info">
                <div class="reward-name">${r.name}</div>
                <div class="reward-desc">${r.description}</div>
            </div>
            <span class="reward-rarity ${rarityClass(r.rarity)}">${r.rarity}</span>
            <span class="reward-chance">${r.chance}%</span>
        `;
        tbody.appendChild(row);
    }
    state.itemSlot = data.itemSlot ?? null;
    
    // Reset UI visibility states
    document.querySelectorAll('.preview-fade').forEach(el => el.classList.remove('hidden'));
    
    const packStage = document.getElementById('shared-pack-stage');
    packStage.className = 'state-preview'; // Set pack to hover position

    showScreen('screen-preview');
    document.getElementById('overlay').classList.add('visible');
};

document.getElementById('btn-open')?.addEventListener('click', () => {
    if (state.phase !== 'preview') return;
    state.phase = 'confirming';
    document.getElementById('btn-open').disabled = true;
    trigger('client:cardPack:cef:confirmOpen', state.itemSlot);
});

document.getElementById('btn-cancel')?.addEventListener('click', () => {
    if (state.phase !== 'preview') return;
    trigger('client:cardPack:cef:cancel');
    document.getElementById('overlay').classList.remove('visible');
});

// ─── SCREEN: UNBOXING ─────────────────────────────────────────────────────────
window.onStartUnboxing = async function(data) {
    state.phase = 'unboxing'; state.rewards = data.rewards; state.cardCount = data.cardCount ?? 5; state.rerollCosts = data.rerollCosts ?? [50, 100, 250, 500];
    if (data.ppBalance !== undefined) setPPBalance(data.ppBalance);
    
    // 1. Fade out the text and table
    document.querySelectorAll('.preview-fade').forEach(el => el.classList.add('hidden'));

    const table = document.getElementById('card-table');
    table.innerHTML = '';
    cardEls = [];

    for (let i = 0; i < state.rewards.length; i++) {
        const card = createCard(i, state.rewards[i]);
        table.appendChild(card);
        cardEls.push(card);
    }

    const packStage = document.getElementById('shared-pack-stage');
    
    // 2. Move pack to the absolute center cleanly
    packStage.className = 'state-center';
    
    await wait(700); // Wait for the pack to finish moving

    // Switch screens silently underneath
    showScreen('screen-unboxing');
    setPhaseLabel('');

    // 3. Shake the Pack
    const wrapper = document.getElementById('pack-wrapper');
    wrapper.classList.add('shaking');
    await wait(600);
    wrapper.classList.remove('shaking');
    
    // 4. Rip Pack open
    packStage.classList.add('state-tear');
    await wait(200);

    // 5. Burst Face Up
    setPhaseLabel('REVEALING CARDS...');
    const spreadPos = getSpreadPositions(state.cardCount);
    
    const burstPromises = cardEls.map(async (card, i) => {
        const pos = spreadPos[i];
        await wait(i * 60);

        card.style.opacity = '1';
        card.style.setProperty('--burst-origin', `translate(-50%, -50%)`);
        card.style.setProperty('--burst-final', `translate(${pos.x - window.innerWidth/2}px, ${pos.y - window.innerHeight/2}px) rotate(${pos.angle}deg)`);
        
        card.classList.remove('stacked');
        card.classList.add('bursting', 'flipped');

        await onAnimEnd(card);
        card.classList.remove('bursting');
        card.style.left = pos.x + 'px'; card.style.top = pos.y + 'px';
        card.style.transform = `translate(-50%, -50%) rotate(${pos.angle}deg)`;
    });

    await Promise.all(burstPromises);

    // 6. Countdown
    const bar = document.getElementById('countdown-bar');
    bar?.classList.add('visible');
    const fill = document.getElementById('countdown-fill');
    fill?.classList.add('running');
    await wait(5000);
    bar?.classList.remove('visible');
    fill?.classList.remove('running');

    // 7. Shuffle & Pick
    setPhaseLabel('SHUFFLING...');
    const flipDownPromises = cardEls.map(async (card, i) => {
        await wait(i * 40); card.classList.remove('flipped');
        await onTransEnd(card.querySelector('.card-inner'));
    });
    await Promise.all(flipDownPromises);

    const stackPromises = cardEls.map(async (card, i) => {
        await wait(i * 30);
        card.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        card.style.left = '50%'; card.style.top = '50%';
        card.style.transform = `translate(-50%, -50%) rotate(${(i - 2) * 2}deg)`;
        card.style.zIndex = 10 - i;
    });
    await Promise.all(stackPromises);
    await wait(300);

    for (let round = 0; round < 3; round++) {
        const shufflePromises = cardEls.map((card, i) => {
            card.classList.remove('shuffle-left', 'shuffle-right');
            void card.offsetWidth; 
            card.classList.add(i % 2 === 0 ? 'shuffle-left' : 'shuffle-right');
            return onAnimEnd(card);
        });
        await Promise.all(shufflePromises);
        await wait(40);
    }
    cardEls.forEach(c => c.classList.remove('shuffle-left', 'shuffle-right'));

    setPhaseLabel('CHOOSE YOUR CARD');
    await wait(100);

    const reSpreadPromises = cardEls.map(async (card, i) => {
        const pos = spreadPos[i];
        await wait(i * 50);
        card.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        card.style.left = pos.x + 'px'; card.style.top = pos.y + 'px';
        card.style.transform = `translate(-50%, -50%) rotate(${pos.angle}deg)`;
        card.style.zIndex = 10;
    });
    await Promise.all(reSpreadPromises);

    state.phase = 'picking';
    cardEls.forEach((card, i) => {
        card.classList.add('selectable');
        card.addEventListener('click', () => onCardClicked(i), { once: true });
    });
};

// ─── CARD LOGIC ─────────────────────────────────────────────────────────────
async function onCardClicked(visualIndex) {
    if (state.phase !== 'picking') return;
    state.phase = 'waiting_reveal'; state.currentPickedIndex = visualIndex;

    cardEls.forEach(c => c.classList.remove('selectable'));
    const picked = cardEls[visualIndex];
    picked.classList.add('picked');

    await nextFrame();
    picked.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
    picked.style.left = '50%'; picked.style.top = '50%';
    picked.style.transform = 'translate(-50%, -50%) rotate(0deg) scale(1.15)';
    picked.style.zIndex = 20;

    cardEls.forEach((c, i) => { if (i !== visualIndex) c.classList.add('dimmed'); });
    setPhaseLabel('');
    trigger('client:cardPack:cef:pickCard', visualIndex);
}

window.onCardRevealed = async function(payload) {
    const { visualIndex, reward, rerollCost, canReroll, ppBalance } = payload;
    if (ppBalance !== undefined) setPPBalance(ppBalance);
    
    state.currentReward = reward;
    const picked = cardEls[visualIndex];
    if (!picked) return;

    picked.className = `card picked ${reward.rarity}`;
    picked.style.setProperty('--rarity-color', getRarityColor(reward.rarity));

    const face = picked.querySelector('.card-face');
    if (face) {
        face.querySelector('.reward-img').src = `./assets/${reward.icon}.png`;
        face.querySelector('.reward-title').textContent = reward.name;
        face.querySelector('.reward-rarity-badge').textContent = reward.rarity;
    }

    picked.classList.add('flipped');
    await wait(300);

    state.rerollIndex = state.rerollCosts.indexOf(rerollCost);
    if (state.rerollIndex < 0) state.rerollIndex = state.rerollCosts.length;

    const panel = document.getElementById('action-panel');
    document.getElementById('action-reward-label').textContent = reward.name;
    document.getElementById('action-reward-label').className = `action-reward-label ${rarityClass(reward.rarity)}`;
    document.getElementById('action-reward-sub').textContent = reward.description ?? '';

    const rerollBtn = document.getElementById('btn-reroll');
    if (canReroll && rerollCost) {
        rerollBtn.style.display = 'block';
        if (state.ppBalance >= rerollCost) {
            rerollBtn.disabled = false;
            document.getElementById('reroll-cost-badge').innerHTML = `RE-ROLL: <span>${rerollCost} PP</span>`;
        } else {
            rerollBtn.disabled = true;
            document.getElementById('reroll-cost-badge').innerHTML = `RE-ROLL: <span>${rerollCost} PP</span> <span style="color:#ff5252; margin-left:6px; font-weight:600;">(Not enough PP)</span>`;
        }
    } else {
        rerollBtn.style.display = 'none';
        document.getElementById('reroll-cost-badge').textContent = '';
    }

    state.phase = 'awaiting_claim';
    panel.classList.add('visible');
};

document.getElementById('btn-claim')?.addEventListener('click', async () => {
    if (state.phase !== 'awaiting_claim') return;
    state.phase = 'claiming';
    document.getElementById('action-panel').classList.remove('visible');
    trigger('client:cardPack:cef:claimReward');
    await wait(200);
    showResultScreen(state.currentReward);
});

document.getElementById('btn-reroll')?.addEventListener('click', async (e) => {
    if (state.phase !== 'awaiting_claim' || e.target.disabled) return;
    state.phase = 'rerolling';
    document.getElementById('action-panel').classList.remove('visible');

    const picked = cardEls[state.currentPickedIndex];
    if (picked) {
        picked.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
        picked.style.transform = 'translate(-50%, -50%) scale(0.8) translateY(100px)';
        picked.style.opacity = '0';
        await wait(400);
        picked.style.visibility = 'hidden';
    }
    trigger('client:cardPack:cef:reRoll');
});

window.onRerollReady = async function(payload) {
    if (payload.ppBalance !== undefined) setPPBalance(payload.ppBalance);
    setPhaseLabel('CHOOSE YOUR NEXT CARD');
    state.phase = 'picking';
    cardEls.forEach((card, i) => {
        if (i === state.currentPickedIndex || card.style.visibility === 'hidden') return;
        card.classList.remove('dimmed');
        card.classList.add('selectable');
        card.addEventListener('click', () => onCardClicked(i), { once: true });
    });
};

function showResultScreen(reward) {
    document.getElementById('result-image').src = `./assets/${reward.icon}.png`;
    document.getElementById('result-title').textContent = reward.name;
    document.getElementById('result-desc').textContent = reward.description ?? '';
    document.getElementById('result-title').className = `rarity-${reward.rarity}`;
    showScreen('screen-result');
}

window.onSessionEnd = function() {};
window.onServerError = function(error) { setPhaseLabel('ERROR: ' + (error.msg ?? 'UNKNOWN ERROR')); };