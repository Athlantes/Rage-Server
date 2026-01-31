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
        overlays: []
    },
    clothes: { top: null, legs: null, shoes: null }
};

// Feature Names for the UI
const featureNames = [
    "Nose Width", "Nose Height", "Nose Length", "Nose Bridge", "Nose Tip", "Nose Shift",
    "Brow Height", "Brow Width", "Cheekbone Height", "Cheekbone Width", "Cheek Width",
    "Eyes", "Lips", "Jaw Width", "Jaw Height", "Chin Length", "Chin Position",
    "Chin Width", "Chin Shape", "Neck Width"
];

let currentIndexes = { tops: 0, legs: 0, shoes: 0 };

$(document).ready(() => {
    // Generate Face Sliders
    const container = $('#features-container');
    featureNames.forEach((name, index) => {
        const html = `
            <div class="control-group">
                <label>${name}</label>
                <input type="range" min="-1.0" max="1.0" step="0.1" value="0" 
                       oninput="updateFeature(${index}, this.value)">
            </div>
        `;
        container.append(html);
    });

    selectGender(0);
});

function setTab(name) {
    $('.panel').removeClass('active');
    $('#panel-' + name).addClass('active');
    
    $('.category-btn').removeClass('active');
    // Find the button that called this (simple way without passing 'this')
    $(`.category-btn[onclick="setTab('${name}')"]`).addClass('active');
}

function selectGender(g) {
    currentGender = g;
    characterData.gender = g;
    
    $('.gender-option').removeClass('active');
    if(g === 0) $('#btn-male').addClass('active');
    else $('#btn-female').addClass('active');

    // Reset clothes index
    currentIndexes = { tops: 0, legs: 0, shoes: 0 };
    
    mp.trigger('client:creator:updateGender', g);
    
    // Slight delay to ensure model loaded
    setTimeout(() => {
        updateClothing('tops', 0);
        updateClothing('legs', 0);
        updateClothing('shoes', 0);
    }, 200);
}

function updateHeritage() {
    const mom = parseInt($('#mom').val());
    const dad = parseInt($('#dad').val());
    
    // Get distinct values
    const shapeMix = parseFloat($('#shapeMix').val());
    const skinMix = parseFloat($('#skinMix').val());

    characterData.appearance.parents = { mother: mom, father: dad };
    characterData.appearance.shapeMix = shapeMix;
    characterData.appearance.skinMix = skinMix;

    // Trigger updated event
    mp.trigger('client:creator:updateHeadBlend', mom, dad, shapeMix, skinMix);
}

function updateFeature(index, value) {
    characterData.appearance.features[index] = parseFloat(value);
    mp.trigger('client:creator:updateFaceFeature', index, value);
}

function updateHair() {
    const style = parseInt($('#hairStyle').val());
    const color = parseInt($('#hairColor').val());
    characterData.appearance.hair.style = style;
    characterData.appearance.hair.color = color;
    mp.trigger('client:creator:updateHair', style, color);
}

function updateEyes() {
    const color = parseInt($('#eyeColor').val());
    characterData.appearance.eyes = color;
    mp.trigger('client:creator:updateEyeColor', color);
}

function updateClothing(part, direction) {
    // Requires clothingConfig.js to be loaded
    if (typeof CreatorClothes === 'undefined') return;

    const genderKey = currentGender === 0 ? 'male' : 'female';
    const list = CreatorClothes[genderKey][part]; 
    if(!list) return;

    currentIndexes[part] += direction;
    if (currentIndexes[part] < 0) currentIndexes[part] = list.length - 1;
    if (currentIndexes[part] >= list.length) currentIndexes[part] = 0;

    const selected = list[currentIndexes[part]];

    let componentId = 0;
    if (part === 'tops') componentId = 11;
    if (part === 'legs') componentId = 4;
    if (part === 'shoes') componentId = 6;

    mp.trigger('client:creator:updateClothes', componentId, selected.drawable, selected.texture);
    
    if (part === 'tops' && selected.torso !== undefined) {
        mp.trigger('client:creator:updateClothes', 3, selected.torso, 0);
    }

    const saveKey = (part === 'tops') ? 'top' : (part === 'legs' ? 'legs' : 'shoes');
    characterData.clothes[saveKey] = selected.itemId;

    $(`#label-${part}`).text(selected.label);
}

function saveCharacter() {
    mp.trigger('client:creator:finish', JSON.stringify(characterData));
}