const CreatorClothes = {
    male: {
        tops: [
            // itemId: Must match packages/data/items.js keys exactly
            { itemId: 'm_top_white_tee', label: "White T-Shirt", drawable: 15, texture: 0, torso: 15 },
            { itemId: 'm_top_black_tee', label: "Black T-Shirt", drawable: 15, texture: 1, torso: 15 },
            { itemId: 'm_top_jacket',    label: "Denim Jacket",  drawable: 14, texture: 0, torso: 12 }
        ],
        legs: [
            { itemId: 'm_legs_blue_jeans',  label: "Blue Jeans",  drawable: 1, texture: 0 },
            { itemId: 'm_legs_black_jeans', label: "Black Jeans", drawable: 1, texture: 1 }
        ],
        shoes: [
            { itemId: 'm_shoes_sneakers', label: "White Sneakers", drawable: 1,  texture: 0 },
            { itemId: 'm_shoes_boots',    label: "Work Boots",     drawable: 12, texture: 0 }
        ]
    },
    female: {
        tops: [
            { itemId: 'f_top_white_tank', label: "White Tank Top", drawable: 2, texture: 0, torso: 2 },
            { itemId: 'f_top_jacket',     label: "Leather Jacket", drawable: 7, texture: 0, torso: 7 }
        ],
        legs: [
            { itemId: 'f_legs_leggings', label: "Black Leggings", drawable: 4, texture: 0 },
            { itemId: 'f_legs_jeans',    label: "Skinny Jeans",   drawable: 1, texture: 0 }
        ],
        shoes: [
            { itemId: 'f_shoes_sneakers', label: "Pink Sneakers", drawable: 2, texture: 0 }
        ]
    }
};

if (typeof module !== 'undefined') {
    module.exports = CreatorClothes;
}