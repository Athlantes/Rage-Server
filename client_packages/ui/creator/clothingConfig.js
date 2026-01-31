const CreatorClothes = {
    male: {
        tops: [
            { itemId: 'mp_m_freemode_01', label: 'White T-Shirt', drawable: 11, texture: 1, torso: 15 },
            { itemId: 'mp_m_freemode_01', label: 'Black T-Shirt', drawable: 11, texture: 0, torso: 15 },
            { itemId: 'mp_m_freemode_01', label: 'Denim Jacket', drawable: 14, texture: 0, torso: 12 }
        ],
        legs: [
            { itemId: 'm_legs_blue_jeans', label: 'Blue Jeans', drawable: 1, texture: 0 },
            { itemId: 'm_legs_black_jeans', label: 'Black Jeans', drawable: 1, texture: 1 }
        ],
        shoes: [
            { itemId: 'm_shoes_sneakers', label: 'Sneakers', drawable: 1, texture: 0 },
            { itemId: 'm_shoes_boots', label: 'Work Boots', drawable: 12, texture: 0 }
        ]
    },
    female: {
        tops: [
            { itemId: 'f_top_white_tank', label: 'White Tank', drawable: 2, texture: 0, torso: 2 },
            { itemId: 'f_top_jacket', label: 'Leather Jacket', drawable: 7, texture: 0, torso: 7 }
        ],
        legs: [
            { itemId: 'f_legs_leggings', label: 'Leggings', drawable: 4, texture: 0 },
            { itemId: 'f_legs_jeans', label: 'Skinny Jeans', drawable: 1, texture: 0 }
        ],
        shoes: [
            { itemId: 'f_shoes_sneakers', label: 'Pink Sneakers', drawable: 2, texture: 0 }
        ]
    }
};

if (typeof module !== 'undefined') {
    module.exports = CreatorClothes;
}