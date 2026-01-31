let currentGender = 0;
let characterData = {
    gender: 0,
    appearance: {
        parents: { mother: 21, father: 0 },
        mix: 0.5,
        features: new Array(20).fill(0),
        hair: { style: 0, color: 0, highlight: 0 },
        eyes: 0,
        overlays: []
    },
    clothes: {
        top: null, legs: null, shoes: null
    }
};

let currentIndexes = { tops: 0, legs: 0, shoes: 0 };

// Initialize
$(document).ready(() => {
    selectGender(0);
});

function selectGender(g) {
    currentGender = g;
    characterData.gender = g;
    
    // UI Update
    $('.gender-btn').removeClass('active');
    if(g === 0) $('#btn-male').addClass('active');
    else $('#btn-female').addClass('active');

    // Reset Clothing Indexes
    currentIndexes = { tops: 0, legs: 0, shoes: 0 };
    
    mp.trigger('client:creator:updateGender', g);
    
    // Apply default first clothes
    setTimeout(() => {
        updateClothing('tops', 0);
        updateClothing('legs', 0);
        updateClothing('shoes', 0);
    }, 200);
}

function updateHeritage() {
    const mom = parseInt($('#mom').val());
    const dad = parseInt($('#dad').val());
    const mix = parseFloat($('#mix').val());
    characterData.appearance.parents = { mother: mom, father: dad };
    characterData.appearance.mix = mix;
    mp.trigger('client:creator:updateHeadBlend', mom, dad, mix);
}

function updateHair() {
    const style = parseInt($('#hairStyle').val());
    const color = parseInt($('#hairColor').val());
    characterData.appearance.hair = { style: style, color: color };
    mp.trigger('client:creator:updateHair', style, color);
}

function updateClothing(part, direction) {
    const genderKey = currentGender === 0 ? 'male' : 'female';
    const list = CreatorClothes[genderKey][part]; 
    if(!list) return;

    // Update Index
    currentIndexes[part] += direction;
    if (currentIndexes[part] < 0) currentIndexes[part] = list.length - 1;
    if (currentIndexes[part] >= list.length) currentIndexes[part] = 0;

    const selected = list[currentIndexes[part]];

    // 1. Preview
    let componentId = 0;
    if (part === 'tops') componentId = 11;
    if (part === 'legs') componentId = 4;
    if (part === 'shoes') componentId = 6;

    mp.trigger('client:creator:updateClothes', componentId, selected.drawable, selected.texture);
    
    // Handle Torso for tops
    if (part === 'tops' && selected.torso !== undefined) {
        mp.trigger('client:creator:updateClothes', 3, selected.torso, 0);
    }

    // 2. Save Item ID
    // Map 'tops' -> 'top' for the save object
    const saveKey = (part === 'tops') ? 'top' : (part === 'legs' ? 'legs' : 'shoes');
    characterData.clothes[saveKey] = selected.itemId;

    // 3. UI Label
    $(`#label-${part}`).text(selected.label);
}

function saveCharacter() {
    mp.trigger('client:creator:finish', JSON.stringify(characterData));
}

function setTab(name) {
    $('.panel').hide();
    $('#'+name+'-panel').show();
    $('.tabs button').removeClass('active');
    $('#tab-'+name).addClass('active');
}