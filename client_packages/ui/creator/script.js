// ============================================================
//  CHARACTER CREATOR - Script (Overhauled)
// ============================================================

// --- STATE ---
let currentGender = 0;
let characterData = {
    gender: 0,
    appearance: {
        parents: { mother: 21, father: 0 },
        shapeMix: 0.5,
        skinMix: 0.5,
        features: new Array(20).fill(0),
        hair: { style: 0, color: 0, highlight: 0 },
        eyes: 0,
        overlays: {
            eyebrows:   { style: 0, opacity: 0.0, color: 0 },
            facialHair: { style: 0, opacity: 0.0, color: 0 },
            blemishes:  { style: 0, opacity: 0.0 },
            ageing:     { style: 0, opacity: 0.0 },
            complexion: { style: 0, opacity: 0.0 },
            makeup:     { style: 0, opacity: 0.0 },
            blush:      { style: 0, opacity: 0.0 },
            lipstick:   { style: 0, opacity: 0.0 }
        }
    },
    clothes: { top: null, legs: null, shoes: null }
};

// --- PARENT NAME TABLES ---
// GTA V mother face IDs: 21-45 (25 mothers)
const motherNames = [
    "Hannah",    "Audrey",    "Jasmine",   "Giselle",   "Amelia",
    "Isabella",  "Zoe",       "Ava",       "Camilla",   "Violet",
    "Sophia",    "Evelyn",    "Nicole",    "Ashley",    "Grace",
    "Brianna",   "Natalie",   "Olivia",    "Emily",     "Alexandra",
    "Charlotte", "Nora",      "Anna",      "Misty",     "Elizabeth"
];

// GTA V father face IDs: 0-20 (21 fathers)
const fatherNames = [
    "Benjamin", "Daniel",  "Joshua",   "Noah",      "Andrew",
    "Juan",     "Alex",    "Isaac",    "Evan",      "Ethan",
    "Vincent",  "Angel",   "Diego",    "Adrian",    "Gabriel",
    "Michael",  "Santiago", "Kevin",   "Louis",     "Samuel",
    "Anthony"
];

// --- FACE FEATURE DEFINITIONS (grouped) ---
const featureGroups = [
    {
        title: "Nose",
        features: [
            { index: 0,  name: "Width" },
            { index: 1,  name: "Height" },
            { index: 2,  name: "Length" },
            { index: 3,  name: "Bridge" },
            { index: 4,  name: "Tip" },
            { index: 5,  name: "Shift" }
        ]
    },
    {
        title: "Brow",
        features: [
            { index: 6,  name: "Height" },
            { index: 7,  name: "Width" }
        ]
    },
    {
        title: "Cheeks",
        features: [
            { index: 8,  name: "Bone Height" },
            { index: 9,  name: "Bone Width" },
            { index: 10, name: "Cheek Width" }
        ]
    },
    {
        title: "Eyes & Lips",
        features: [
            { index: 11, name: "Eyes" },
            { index: 12, name: "Lips" }
        ]
    },
    {
        title: "Jaw & Chin",
        features: [
            { index: 13, name: "Jaw Width" },
            { index: 14, name: "Jaw Height" },
            { index: 15, name: "Chin Length" },
            { index: 16, name: "Chin Position" },
            { index: 17, name: "Chin Width" },
            { index: 18, name: "Chin Shape" }
        ]
    },
    {
        title: "Neck",
        features: [
            { index: 19, name: "Width" }
        ]
    }
];

// --- HAIR LIMITS (per gender) ---
const hairLimits = { male: 73, female: 77 };

// --- EYE COLOR NAMES ---
const eyeColorNames = [
    "Green",       "Emerald",      "Light Blue",   "Ocean Blue",   "Light Brown",
    "Dark Brown",  "Hazel",        "Dark Gray",    "Light Gray",   "Pink",
    "Yellow",      "Purple",       "Blackout",     "Shiny Blue",   "Light Green",
    "Honey",       "Dark Green",   "Cardinal",     "Amber",        "Dark Amber",
    "Pale",        "Steel",        "Charcoal",     "Ghost",        "Wine",
    "Ice",         "Sapphire",     "Violet",       "Copper",       "Slate",
    "Titanium",    "Onyx"
];

// --- OVERLAY CONFIGURATION ---
// overlayId maps to GTA V head overlay indexes:
//   0=Blemishes, 1=FacialHair, 2=Eyebrows, 3=Ageing, 4=Makeup,
//   5=Blush, 6=Complexion, 7=SunDamage, 8=Lipstick, 9=Moles, 10=ChestHair, 11=BodyBlemishes
const overlayConfig = {
    eyebrows:   { overlayId: 2,  maxStyle: 33, hasColor: true,  label: "Eyebrows" },
    facialHair: { overlayId: 1,  maxStyle: 28, hasColor: true,  label: "Facial Hair", maleOnly: true },
    blemishes:  { overlayId: 0,  maxStyle: 23, hasColor: false, label: "Blemishes" },
    ageing:     { overlayId: 3,  maxStyle: 14, hasColor: false, label: "Ageing" },
    complexion: { overlayId: 6,  maxStyle: 11, hasColor: false, label: "Complexion" },
    makeup:     { overlayId: 4,  maxStyle: 74, hasColor: false, label: "Makeup",   femaleOnly: true },
    blush:      { overlayId: 5,  maxStyle: 6,  hasColor: false, label: "Blush",    femaleOnly: true },
    lipstick:   { overlayId: 8,  maxStyle: 9,  hasColor: false, label: "Lipstick", femaleOnly: true }
};

// --- TRACKING ---
let currentIndexes = { tops: 0, legs: 0, shoes: 0 };
let currentMotherIndex = 0;
let currentFatherIndex = 0;

// ============================================================
//  INITIALIZATION
// ============================================================
$(document).ready(() => {
    buildFaceFeatures();
    buildOverlays();
    selectGender(0);
});

// ============================================================
//  TAB NAVIGATION
// ============================================================
function setTab(name) {
    $('.panel').removeClass('active');
    $('#panel-' + name).addClass('active');
    $('.category-btn').removeClass('active');
    $(`.category-btn[data-tab="${name}"]`).addClass('active');
}

// ============================================================
//  GENDER SELECTION
// ============================================================
function selectGender(g) {
    currentGender = g;
    characterData.gender = g;

    $('.gender-option').removeClass('active');
    if (g === 0) $('#btn-male').addClass('active');
    else $('#btn-female').addClass('active');

    // Reset clothing indexes
    currentIndexes = { tops: 0, legs: 0, shoes: 0 };

    // Update hair style range for gender
    const maxHair = hairLimits[g === 0 ? 'male' : 'female'];
    $('#hairStyle').attr('max', maxHair);
    if (parseInt($('#hairStyle').val()) > maxHair) {
        $('#hairStyle').val(0);
        characterData.appearance.hair.style = 0;
    }

    // Rebuild overlays (filters gender-specific options)
    buildOverlays();

    // Tell client to switch model
    mp.trigger('client:creator:updateGender', g);

    // Re-apply everything after model loads
    setTimeout(() => {
        updateHeritage();
        updateHair();
        updateEyes();
        applyAllOverlays();
        updateClothing('tops', 0);
        updateClothing('legs', 0);
        updateClothing('shoes', 0);
        // Re-apply all face features
        characterData.appearance.features.forEach((val, idx) => {
            mp.trigger('client:creator:updateFaceFeature', idx, val);
        });
    }, 400);
}

// ============================================================
//  HERITAGE
// ============================================================
function changeParent(type, direction) {
    if (type === 'mother') {
        currentMotherIndex += direction;
        if (currentMotherIndex < 0) currentMotherIndex = motherNames.length - 1;
        if (currentMotherIndex >= motherNames.length) currentMotherIndex = 0;
        characterData.appearance.parents.mother = 21 + currentMotherIndex;
        $('#motherName').text(motherNames[currentMotherIndex]);
    } else {
        currentFatherIndex += direction;
        if (currentFatherIndex < 0) currentFatherIndex = fatherNames.length - 1;
        if (currentFatherIndex >= fatherNames.length) currentFatherIndex = 0;
        characterData.appearance.parents.father = currentFatherIndex;
        $('#fatherName').text(fatherNames[currentFatherIndex]);
    }
    updateHeritage();
}

function updateHeritage() {
    const mom = characterData.appearance.parents.mother;
    const dad = characterData.appearance.parents.father;
    const shapeMix = parseFloat($('#shapeMix').val());
    const skinMix = parseFloat($('#skinMix').val());

    characterData.appearance.shapeMix = shapeMix;
    characterData.appearance.skinMix = skinMix;

    mp.trigger('client:creator:updateHeadBlend', mom, dad, shapeMix, skinMix);
}

// ============================================================
//  FACE FEATURES
// ============================================================
function buildFaceFeatures() {
    const container = $('#features-container');
    container.empty();

    featureGroups.forEach(group => {
        container.append(`<div class="feature-group-title">${group.title}</div>`);
        group.features.forEach(f => {
            container.append(`
                <div class="control-group">
                    <label>${f.name}</label>
                    <div class="slider-row">
                        <input type="range" min="-1.0" max="1.0" step="0.05" value="0"
                               id="feature-${f.index}"
                               oninput="updateFeature(${f.index}, this.value)">
                        <span class="slider-value" id="fval-${f.index}">0.00</span>
                    </div>
                </div>
            `);
        });
    });
}

function updateFeature(index, value) {
    const val = parseFloat(value);
    characterData.appearance.features[index] = val;
    $(`#fval-${index}`).text(val.toFixed(2));
    mp.trigger('client:creator:updateFaceFeature', index, value);
}

// ============================================================
//  HAIR & EYES
// ============================================================
function updateHair() {
    const style = parseInt($('#hairStyle').val());
    const color = parseInt($('#hairColor').val());
    characterData.appearance.hair.style = style;
    characterData.appearance.hair.color = color;
    $('#hairStyleLabel').text(`Style ${style}`);
    $('#hairColorLabel').text(`Color ${color}`);
    mp.trigger('client:creator:updateHair', style, color);
}

function updateEyes() {
    const color = parseInt($('#eyeColor').val());
    characterData.appearance.eyes = color;
    const name = eyeColorNames[color] || `Color ${color}`;
    $('#eyeColorLabel').text(name);
    mp.trigger('client:creator:updateEyeColor', color);
}

// ============================================================
//  FACE OVERLAYS
// ============================================================
function buildOverlays() {
    const container = $('#overlays-container');
    container.empty();

    Object.entries(overlayConfig).forEach(([key, cfg]) => {
        // Filter gender-specific overlays
        if (cfg.maleOnly && currentGender !== 0) return;
        if (cfg.femaleOnly && currentGender !== 1) return;

        // Initialize overlay data if missing
        if (!characterData.appearance.overlays[key]) {
            characterData.appearance.overlays[key] = { style: 0, opacity: 0.0, color: 0 };
        }
        const overlayData = characterData.appearance.overlays[key];

        let html = `
            <div class="control-group overlay-group" data-key="${key}">
                <label>${cfg.label}</label>
                <div class="selector">
                    <button onclick="changeOverlay('${key}', -1)"><i class="fas fa-chevron-left"></i></button>
                    <span id="overlay-${key}-label">${overlayData.style === 0 ? 'None' : 'Style ' + overlayData.style}</span>
                    <button onclick="changeOverlay('${key}', 1)"><i class="fas fa-chevron-right"></i></button>
                </div>
                <div class="slider-row" style="margin-top: 8px;">
                    <span class="slider-label-sm">Opacity</span>
                    <input type="range" min="0" max="1.0" step="0.1" value="${overlayData.opacity}"
                           id="overlay-${key}-opacity" oninput="updateOverlayOpacity('${key}', this.value)">
                </div>`;

        if (cfg.hasColor) {
            const colorVal = overlayData.color || 0;
            html += `
                <div class="slider-row" style="margin-top: 5px;">
                    <span class="slider-label-sm">Color</span>
                    <input type="range" min="0" max="63" value="${colorVal}"
                           id="overlay-${key}-color" oninput="updateOverlayColor('${key}', this.value)">
                </div>`;
        }

        html += `</div>`;
        container.append(html);
    });
}

function changeOverlay(key, direction) {
    const cfg = overlayConfig[key];
    if (!cfg) return;

    let data = characterData.appearance.overlays[key];
    if (!data) data = characterData.appearance.overlays[key] = { style: 0, opacity: 0.0, color: 0 };

    data.style += direction;
    if (data.style < 0) data.style = cfg.maxStyle;
    if (data.style > cfg.maxStyle) data.style = 0;

    $(`#overlay-${key}-label`).text(data.style === 0 ? 'None' : `Style ${data.style}`);

    // Auto-enable opacity when style is selected
    if (data.style > 0 && data.opacity <= 0) {
        data.opacity = 1.0;
        $(`#overlay-${key}-opacity`).val(1.0);
    }
    // Reset opacity when set to None
    if (data.style === 0) {
        data.opacity = 0.0;
        $(`#overlay-${key}-opacity`).val(0.0);
    }

    sendOverlay(key);
}

function updateOverlayOpacity(key, value) {
    let data = characterData.appearance.overlays[key];
    if (!data) return;
    data.opacity = parseFloat(value);
    sendOverlay(key);
}

function updateOverlayColor(key, value) {
    let data = characterData.appearance.overlays[key];
    if (!data) return;
    data.color = parseInt(value);
    sendOverlay(key);
}

function sendOverlay(key) {
    const cfg = overlayConfig[key];
    const data = characterData.appearance.overlays[key];
    if (!cfg || !data) return;

    mp.trigger('client:creator:updateOverlay', cfg.overlayId, data.style, data.opacity, data.color || 0, 0);
}

function applyAllOverlays() {
    Object.keys(overlayConfig).forEach(key => {
        const cfg = overlayConfig[key];
        if (cfg.maleOnly && currentGender !== 0) return;
        if (cfg.femaleOnly && currentGender !== 1) return;
        sendOverlay(key);
    });
}

// ============================================================
//  CLOTHING
// ============================================================
function updateClothing(part, direction) {
    if (typeof CreatorClothes === 'undefined') {
        console.error("CreatorClothes is undefined! Check clothingConfig.js");
        $(`#label-${part}`).text("Error");
        return;
    }

    const genderKey = currentGender === 0 ? 'male' : 'female';
    const list = CreatorClothes[genderKey][part];
    if (!list || list.length === 0) {
        $(`#label-${part}`).text("None Available");
        return;
    }

    currentIndexes[part] += direction;
    if (currentIndexes[part] < 0) currentIndexes[part] = list.length - 1;
    if (currentIndexes[part] >= list.length) currentIndexes[part] = 0;

    const selected = list[currentIndexes[part]];

    // Map part name to GTA V component ID
    let componentId = 0;
    if (part === 'tops')  componentId = 11;
    if (part === 'legs')  componentId = 4;
    if (part === 'shoes') componentId = 6;

    mp.trigger('client:creator:updateClothes', componentId, selected.drawable, selected.texture);

    // Always set torso when changing tops (default to 15 if not specified)
    if (part === 'tops') {
        const torso = (selected.torso !== undefined) ? selected.torso : 15;
        mp.trigger('client:creator:updateClothes', 3, torso, 0);
    }

    // Save clothing choice by itemId
    const saveKey = (part === 'tops') ? 'top' : (part === 'legs' ? 'legs' : 'shoes');
    characterData.clothes[saveKey] = selected.itemId;

    $(`#label-${part}`).text(selected.label);
}

// ============================================================
//  RANDOMIZE
// ============================================================
function randomize() {
    // Random parents
    currentMotherIndex = Math.floor(Math.random() * motherNames.length);
    currentFatherIndex = Math.floor(Math.random() * fatherNames.length);
    characterData.appearance.parents.mother = 21 + currentMotherIndex;
    characterData.appearance.parents.father = currentFatherIndex;
    $('#motherName').text(motherNames[currentMotherIndex]);
    $('#fatherName').text(fatherNames[currentFatherIndex]);

    // Random mix values
    const shapeMix = Math.round(Math.random() * 20) / 20; // steps of 0.05
    const skinMix  = Math.round(Math.random() * 20) / 20;
    $('#shapeMix').val(shapeMix);
    $('#skinMix').val(skinMix);
    updateHeritage();

    // Random face features
    featureGroups.forEach(group => {
        group.features.forEach(f => {
            const val = parseFloat((Math.random() * 2 - 1).toFixed(2));
            characterData.appearance.features[f.index] = val;
            $(`#feature-${f.index}`).val(val);
            $(`#fval-${f.index}`).text(val.toFixed(2));
            mp.trigger('client:creator:updateFaceFeature', f.index, val);
        });
    });

    // Random hair
    const maxHair = hairLimits[currentGender === 0 ? 'male' : 'female'];
    const randomHair = Math.floor(Math.random() * (maxHair + 1));
    const randomColor = Math.floor(Math.random() * 64);
    $('#hairStyle').val(randomHair);
    $('#hairColor').val(randomColor);
    updateHair();

    // Random eyes
    const randomEyes = Math.floor(Math.random() * 32);
    $('#eyeColor').val(randomEyes);
    updateEyes();

    // Random eyebrows
    const ebData = characterData.appearance.overlays.eyebrows;
    ebData.style = Math.floor(Math.random() * overlayConfig.eyebrows.maxStyle) + 1;
    ebData.opacity = 0.8 + Math.random() * 0.2;
    ebData.color = randomColor;
    $(`#overlay-eyebrows-label`).text(`Style ${ebData.style}`);
    if ($(`#overlay-eyebrows-opacity`).length) $(`#overlay-eyebrows-opacity`).val(ebData.opacity);
    if ($(`#overlay-eyebrows-color`).length)   $(`#overlay-eyebrows-color`).val(ebData.color);
    sendOverlay('eyebrows');

    // Random facial hair (male only)
    if (currentGender === 0) {
        const fhData = characterData.appearance.overlays.facialHair;
        // 50% chance of having facial hair
        if (Math.random() > 0.5) {
            fhData.style = Math.floor(Math.random() * overlayConfig.facialHair.maxStyle) + 1;
            fhData.opacity = 0.6 + Math.random() * 0.4;
            fhData.color = randomColor;
        } else {
            fhData.style = 0;
            fhData.opacity = 0.0;
        }
        if ($(`#overlay-facialHair-label`).length)   $(`#overlay-facialHair-label`).text(fhData.style === 0 ? 'None' : `Style ${fhData.style}`);
        if ($(`#overlay-facialHair-opacity`).length)  $(`#overlay-facialHair-opacity`).val(fhData.opacity);
        if ($(`#overlay-facialHair-color`).length)    $(`#overlay-facialHair-color`).val(fhData.color);
        sendOverlay('facialHair');
    }

    // Random clothing
    const genderKey = currentGender === 0 ? 'male' : 'female';
    if (typeof CreatorClothes !== 'undefined') {
        ['tops', 'legs', 'shoes'].forEach(part => {
            const list = CreatorClothes[genderKey][part];
            if (list && list.length > 0) {
                currentIndexes[part] = Math.floor(Math.random() * list.length);
                updateClothing(part, 0);
            }
        });
    }
}

// ============================================================
//  SAVE CHARACTER
// ============================================================
function saveCharacter() {
    // Convert overlays from object to array format for server storage
    const overlayArray = [];
    Object.entries(characterData.appearance.overlays).forEach(([key, data]) => {
        const cfg = overlayConfig[key];
        if (!cfg) return;
        // Skip gender-mismatched overlays
        if (cfg.maleOnly && currentGender !== 0) return;
        if (cfg.femaleOnly && currentGender !== 1) return;
        // Only save non-empty overlays
        if (data.style > 0 && data.opacity > 0) {
            overlayArray.push({
                index: cfg.overlayId,
                overlay: data.style,
                opacity: parseFloat(data.opacity.toFixed(2)),
                color: data.color || 0,
                secColor: 0
            });
        }
    });

    const saveData = {
        gender: characterData.gender,
        appearance: {
            parents: characterData.appearance.parents,
            shapeMix: characterData.appearance.shapeMix,
            skinMix: characterData.appearance.skinMix,
            features: characterData.appearance.features,
            hair: characterData.appearance.hair,
            eyes: characterData.appearance.eyes,
            overlays: overlayArray
        },
        clothes: characterData.clothes
    };

    mp.trigger('client:creator:finish', JSON.stringify(saveData));
}
