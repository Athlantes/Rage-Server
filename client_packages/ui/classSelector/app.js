const CLASSES = {
    enforcer: {
        name: 'ENFORCER',
        icon: '🛡️',
        color: '#FF3333',
        description: 'Masters of combat and control. Enforcers are tough, intimidating, and built for conflict.',
        story: 'You\'ve learned to fight hard and survive harder. The streets respect power.',
        subclasses: {
            soldier:  { name: 'Soldier',  description: 'Trained operative' },
            enforcer: { name: 'Enforcer', description: 'Seasoned veteran' },
            warlord:  { name: 'Warlord',  description: 'Feared commander' }
        },
        bonuses: {
            soldier:  '+15% Combat Damage',
            enforcer: '+25% Combat Damage',
            warlord:  '+40% Combat Damage'
        }
    },
    hustler: {
        name: 'HUSTLER',
        icon: '💰',
        color: '#FFB700',
        description: 'Money moves and business instincts. Hustlers always find a way to profit.',
        story: 'Every interaction is an opportunity. The only currency that matters is cash.',
        subclasses: {
            grinder:      { name: 'Grinder',      description: 'Rising entrepreneur' },
            entrepreneur: { name: 'Entrepreneur', description: 'Seasoned dealer' },
            tycoon:       { name: 'Tycoon',       description: 'Business magnate' }
        },
        bonuses: {
            grinder:      '+15% Job Pay, +5% Crafting Speed',
            entrepreneur: '+25% Job Pay, +10% Crafting Speed',
            tycoon:       '+40% Job Pay, +15% Crafting Speed'
        }
    },
    craftsman: {
        name: 'CRAFTSMAN',
        icon: '🔧',
        color: '#8B4513',
        description: 'Masters of creation and engineering. Craftsmen build better, faster, cheaper.',
        story: 'Your hands know how to build anything. Every creation is a masterpiece.',
        subclasses: {
            apprentice: { name: 'Apprentice', description: 'Learning the trade' },
            master:     { name: 'Master',     description: 'Skilled builder' },
            legendary:  { name: 'Legendary',  description: 'Perfect craftsman' }
        },
        bonuses: {
            apprentice: '+15% Crafting Speed, -10% Material Cost',
            master:     '+25% Crafting Speed, -20% Material Cost',
            legendary:  '+40% Crafting Speed, -30% Material Cost'
        }
    },
    racer: {
        name: 'RACER',
        icon: '🏎️',
        color: '#FF00FF',
        description: 'Speed demons and adrenaline junkies. Racers are the fastest on the road.',
        story: 'Pedal to the metal. Nothing compares to the rush of velocity.',
        subclasses: {
            rookie: { name: 'Rookie', description: 'Young speedster' },
            pro:    { name: 'Pro',    description: 'Seasoned racer' },
            legend: { name: 'Legend', description: 'Champion driver' }
        },
        bonuses: {
            rookie: '+15% Movement Speed, +5% Vehicle Control',
            pro:    '+25% Movement Speed, +10% Vehicle Control',
            legend: '+40% Movement Speed, +15% Vehicle Control'
        }
    },
    medic: {
        name: 'MEDIC',
        icon: '🏥',
        color: '#00CC66',
        description: 'Healers and lifesavers. Medics keep their allies in the fight.',
        story: 'Saving lives is your calling. You\'re a second chance at survival.',
        subclasses: {
            paramedic: { name: 'Paramedic', description: 'First responder' },
            doctor:    { name: 'Doctor',    description: 'Professional healer' },
            surgeon:   { name: 'Surgeon',   description: 'Master of life' }
        },
        bonuses: {
            paramedic: '+20% Healing Power, +10% Revive Speed',
            doctor:    '+35% Healing Power, +20% Revive Speed',
            surgeon:   '+50% Healing Power, +30% Revive Speed'
        }
    },
    infiltrator: {
        name: 'INFILTRATOR',
        icon: '👻',
        color: '#0099FF',
        description: 'Shadows and secrets. Infiltrators operate outside the law unseen.',
        story: 'Invisibility is an art. You slip through the cracks everyone else misses.',
        subclasses: {
            scout:     { name: 'Scout',     description: 'Sneaky operator' },
            operative: { name: 'Operative', description: 'Professional spy' },
            ghost:     { name: 'Ghost',     description: 'Master phantom' }
        },
        bonuses: {
            scout:     '+15% Stealth Avoidance, -10% Hacking Cooldown',
            operative: '+25% Stealth Avoidance, -20% Hacking Cooldown',
            ghost:     '+40% Stealth Avoidance, -30% Hacking Cooldown'
        }
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────

let state = {
    step: 1,
    selectedClass: null,
    selectedSubclass: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
    renderStep1();
    setupEventListeners();

    // Notify the client script that the page is fully ready
    if (typeof mp !== 'undefined' && mp.trigger) {
        mp.trigger('client:classSelector:pageReady');
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: CLASS CARDS
// ─────────────────────────────────────────────────────────────────────────────

function renderStep1() {
    const container = document.getElementById('classCards');
    container.innerHTML = '';

    Object.entries(CLASSES).forEach(([classId, classData]) => {
        const card = document.createElement('div');
        card.className = 'class-card';
        card.setAttribute('data-class', classId);
        card.style.setProperty('--color', classData.color);

        card.innerHTML = `
            <div class="card-bg"></div>
            <div class="card-overlay"></div>
            <div class="card-content">
                <div class="card-header">
                    <div class="card-icon">${classData.icon}</div>
                    <div class="card-title">${classData.name}</div>
                </div>
                <div class="card-description">${classData.description}</div>
                <div class="card-footer">Click to select</div>
            </div>
        `;

        card.addEventListener('click', () => selectClass(classId));
        container.appendChild(card);
    });
}

function selectClass(classId) {
    document.querySelectorAll('.class-card').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-class="${classId}"]`).classList.add('active');

    state.selectedClass = classId;
    state.selectedSubclass = null;

    document.getElementById('btnNext').disabled = false;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: SUBCLASS DETAILS
// ─────────────────────────────────────────────────────────────────────────────

function goToStep2() {
    if (!state.selectedClass) return;

    document.getElementById('step1').classList.remove('active');
    renderStep2();
    document.getElementById('step2').classList.add('active');

    document.getElementById('btnNext').innerHTML = 'Confirm →';
    document.getElementById('btnNext').disabled = true;
    document.getElementById('btnBack').style.display = 'block';
    document.getElementById('step-indicator').textContent = 'Step 2 of 2';

    state.step = 2;
}

function renderStep2() {
    const classData = CLASSES[state.selectedClass];

    document.getElementById('selectedClassName').textContent = classData.name;
    document.getElementById('classStory').textContent = classData.story;
    document.getElementById('avatarIcon').textContent = classData.icon;
    document.documentElement.style.setProperty('--color', classData.color);

    const container = document.getElementById('subclassesContainer');
    container.innerHTML = '';

    Object.entries(classData.subclasses).forEach(([subclassId, subclassData]) => {
        const card = document.createElement('div');
        card.className = 'subclass-card';
        card.setAttribute('data-subclass', subclassId);
        card.style.setProperty('--color', classData.color);

        card.innerHTML = `
            <div class="subclass-name">${subclassData.name}</div>
            <div class="subclass-desc">${subclassData.description}</div>
        `;

        card.addEventListener('click', () => selectSubclass(subclassId));
        container.appendChild(card);
    });

    const firstSubclass = Object.keys(classData.subclasses)[0];
    renderBonuses(firstSubclass);
}

function selectSubclass(subclassId) {
    document.querySelectorAll('.subclass-card').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-subclass="${subclassId}"]`).classList.add('active');

    state.selectedSubclass = subclassId;
    renderBonuses(subclassId);

    document.getElementById('btnNext').disabled = false;
}

function renderBonuses(subclassId) {
    const classData = CLASSES[state.selectedClass];
    const bonus = classData.bonuses[subclassId];
    const list = document.getElementById('bonusesList');
    list.innerHTML = '';

    bonus.split(',').map(b => b.trim()).forEach(bon => {
        const item = document.createElement('div');
        item.className = 'bonus-item';
        item.innerHTML = `<span class="bonus-icon">✓</span><span>${bon}</span>`;
        list.appendChild(item);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// BACK
// ─────────────────────────────────────────────────────────────────────────────

function goBack() {
    document.getElementById('step2').classList.remove('active');
    document.getElementById('step1').classList.add('active');

    document.getElementById('btnNext').innerHTML = 'Next →';
    document.getElementById('btnNext').disabled = false;
    document.getElementById('btnBack').style.display = 'none';
    document.getElementById('step-indicator').textContent = 'Step 1 of 2';

    state.step = 1;
    state.selectedSubclass = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM
// ─────────────────────────────────────────────────────────────────────────────

function confirmSelection() {
    if (!state.selectedClass || !state.selectedSubclass) return;

    if (typeof mp === 'undefined' || !mp.trigger) return;

    mp.trigger('client:classSelector:confirm', state.selectedClass, state.selectedSubclass);
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────────────────────────────────────────

function setupEventListeners() {
    document.getElementById('btnNext').addEventListener('click', () => {
        if (state.step === 1) goToStep2();
        else if (state.step === 2) confirmSelection();
    });

    const btnBack = document.getElementById('btnBack');
    if (btnBack) btnBack.addEventListener('click', goBack);
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR DISPLAY
// ─────────────────────────────────────────────────────────────────────────────

function showError(message) {
    alert(message);
}