const CreatorClothes = {
    male: {
        tops: [
            // Casual T-Shirts
            { itemId: 'm_top_white_tee',        label: "White T-Shirt",        drawable: 15, texture: 0, torso: 15 },
            { itemId: 'm_top_black_tee',        label: "Black T-Shirt",        drawable: 15, texture: 1, torso: 15 },
            { itemId: 'm_top_gray_tee',         label: "Gray T-Shirt",         drawable: 15, texture: 2, torso: 15 },
            { itemId: 'm_top_blue_tee',         label: "Blue T-Shirt",         drawable: 15, texture: 3, torso: 15 },
            { itemId: 'm_top_red_tee',          label: "Red T-Shirt",          drawable: 15, texture: 4, torso: 15 },
            { itemId: 'm_top_green_tee',        label: "Green T-Shirt",        drawable: 15, texture: 5, torso: 15 },
            
            // Casual Shirts & Polos
            { itemId: 'm_top_white_polo',       label: "White Polo",           drawable: 29, texture: 0, torso: 15 },
            { itemId: 'm_top_blue_polo',        label: "Blue Polo",            drawable: 29, texture: 1, torso: 15 },
            { itemId: 'm_top_black_shirt',      label: "Black Button-Up",      drawable: 8,  texture: 0, torso: 11 },
            { itemId: 'm_top_white_shirt',      label: "White Button-Up",      drawable: 8,  texture: 1, torso: 11 },
            
            // Hoodies & Sweatshirts
            { itemId: 'm_top_gray_hoodie',      label: "Gray Hoodie",          drawable: 59, texture: 0, torso: 14 },
            { itemId: 'm_top_black_hoodie',     label: "Black Hoodie",         drawable: 59, texture: 1, torso: 14 },
            { itemId: 'm_top_blue_hoodie',      label: "Blue Hoodie",          drawable: 59, texture: 2, torso: 14 },
            { itemId: 'm_top_red_hoodie',       label: "Red Hoodie",           drawable: 59, texture: 3, torso: 14 },
            
            // Jackets & Outerwear
            { itemId: 'm_top_denim_jacket',     label: "Denim Jacket",         drawable: 14, texture: 0, torso: 12 },
            { itemId: 'm_top_leather_jacket',   label: "Black Leather",        drawable: 63, texture: 0, torso: 16 },
            { itemId: 'm_top_brown_jacket',     label: "Brown Jacket",         drawable: 14, texture: 1, torso: 12 },
            { itemId: 'm_top_military_jacket',  label: "Military Jacket",      drawable: 56, texture: 0, torso: 3 },
            { itemId: 'm_top_bomber_jacket',    label: "Bomber Jacket",        drawable: 61, texture: 0, torso: 17 },
            
            // Vests & Special
            { itemId: 'm_top_black_vest',       label: "Black Vest",           drawable: 71, texture: 0, torso: 11 },
            { itemId: 'm_top_sleeveless',       label: "Sleeveless Tank",      drawable: 131, texture: 0, torso: 15 }
        ],
        legs: [
            // Jeans
            { itemId: 'm_legs_blue_jeans',      label: "Blue Jeans",           drawable: 1,  texture: 0 },
            { itemId: 'm_legs_black_jeans',     label: "Black Jeans",          drawable: 1,  texture: 1 },
            { itemId: 'm_legs_dark_jeans',      label: "Dark Blue Jeans",      drawable: 1,  texture: 2 },
            { itemId: 'm_legs_light_jeans',     label: "Light Jeans",          drawable: 1,  texture: 3 },
            { itemId: 'm_legs_ripped_jeans',    label: "Ripped Jeans",         drawable: 1,  texture: 4 },
            
            // Pants & Chinos
            { itemId: 'm_legs_khakis',          label: "Khaki Chinos",         drawable: 4,  texture: 0 },
            { itemId: 'm_legs_black_pants',     label: "Black Pants",          drawable: 4,  texture: 1 },
            { itemId: 'm_legs_gray_pants',      label: "Gray Pants",           drawable: 4,  texture: 2 },
            { itemId: 'm_legs_navy_pants',      label: "Navy Pants",           drawable: 4,  texture: 3 },
            { itemId: 'm_legs_camo_pants',      label: "Camo Pants",           drawable: 88, texture: 0 },
            
            // Shorts
            { itemId: 'm_legs_cargo_shorts',    label: "Cargo Shorts",         drawable: 10, texture: 0 },
            { itemId: 'm_legs_beach_shorts',    label: "Beach Shorts",         drawable: 10, texture: 1 },
            { itemId: 'm_legs_blue_shorts',     label: "Blue Shorts",          drawable: 10, texture: 2 },
            { itemId: 'm_legs_black_shorts',    label: "Black Shorts",         drawable: 10, texture: 3 },
            
            // Track Pants
            { itemId: 'm_legs_track_grey',      label: "Gray Track Pants",     drawable: 114, texture: 0 },
            { itemId: 'm_legs_track_black',     label: "Black Track Pants",    drawable: 114, texture: 1 }
        ],
        shoes: [
            // Sneakers
            { itemId: 'm_shoes_white_sneakers', label: "White Sneakers",       drawable: 1,  texture: 0 },
            { itemId: 'm_shoes_black_sneakers', label: "Black Sneakers",       drawable: 1,  texture: 1 },
            { itemId: 'm_shoes_gray_sneakers',  label: "Gray Sneakers",        drawable: 1,  texture: 2 },
            { itemId: 'm_shoes_red_sneakers',   label: "Red Sneakers",         drawable: 1,  texture: 3 },
            
            // Athletic Shoes
            { itemId: 'm_shoes_blue_athletic',  label: "Blue Athletic",        drawable: 53, texture: 0 },
            { itemId: 'm_shoes_red_athletic',   label: "Red Athletic",         drawable: 53, texture: 1 },
            { itemId: 'm_shoes_black_athletic', label: "Black Athletic",       drawable: 53, texture: 2 },
            
            // Boots
            { itemId: 'm_shoes_work_boots',     label: "Work Boots",           drawable: 12, texture: 0 },
            { itemId: 'm_shoes_combat_boots',   label: "Combat Boots",         drawable: 12, texture: 1 },
            { itemId: 'm_shoes_brown_boots',    label: "Brown Boots",          drawable: 12, texture: 2 },
            
            // Casual Shoes
            { itemId: 'm_shoes_high_tops',      label: "High Tops",            drawable: 7,  texture: 0 },
            { itemId: 'm_shoes_casual',         label: "Casual Shoes",         drawable: 48, texture: 0 },
            { itemId: 'm_shoes_loafers',        label: "Loafers",              drawable: 35, texture: 0 },
            { itemId: 'm_shoes_dress_shoes',    label: "Dress Shoes",          drawable: 34, texture: 0 }
        ]
    },
    female: {
        tops: [
            // Casual Tops
            { itemId: 'f_top_white_tank',       label: "White Tank Top",       drawable: 2,  texture: 0, torso: 2 },
            { itemId: 'f_top_black_tank',       label: "Black Tank Top",       drawable: 2,  texture: 1, torso: 2 },
            { itemId: 'f_top_blue_tank',        label: "Blue Tank Top",        drawable: 2,  texture: 2, torso: 2 },
            { itemId: 'f_top_pink_tank',        label: "Pink Tank Top",        drawable: 2,  texture: 3, torso: 2 },
            
            // T-Shirts & Casual
            { itemId: 'f_top_white_tee',        label: "White T-Shirt",        drawable: 41, texture: 0, torso: 15 },
            { itemId: 'f_top_black_tee',        label: "Black T-Shirt",        drawable: 41, texture: 1, torso: 15 },
            { itemId: 'f_top_gray_tee',         label: "Gray T-Shirt",         drawable: 41, texture: 2, torso: 15 },
            { itemId: 'f_top_crop_top',         label: "Crop Top",             drawable: 122, texture: 0, torso: 6 },
            
            // Blouses & Shirts
            { itemId: 'f_top_blouse_white',     label: "White Blouse",         drawable: 39, texture: 0, torso: 5 },
            { itemId: 'f_top_blouse_pink',      label: "Pink Blouse",          drawable: 39, texture: 1, torso: 5 },
            { itemId: 'f_top_business_shirt',   label: "Business Shirt",       drawable: 101, texture: 0, torso: 11 },
            
            // Hoodies & Sweats
            { itemId: 'f_top_gray_hoodie',      label: "Gray Hoodie",          drawable: 59, texture: 0, torso: 14 },
            { itemId: 'f_top_black_hoodie',     label: "Black Hoodie",         drawable: 59, texture: 1, torso: 14 },
            { itemId: 'f_top_pink_hoodie',      label: "Pink Hoodie",          drawable: 59, texture: 2, torso: 14 },
            { itemId: 'f_top_purple_hoodie',    label: "Purple Hoodie",        drawable: 59, texture: 3, torso: 14 },
            
            // Jackets & Outerwear
            { itemId: 'f_top_leather_jacket',   label: "Leather Jacket",       drawable: 7,  texture: 0, torso: 7 },
            { itemId: 'f_top_brown_jacket',     label: "Brown Jacket",         drawable: 7,  texture: 1, torso: 7 },
            { itemId: 'f_top_bomber_jacket',    label: "Bomber Jacket",        drawable: 86, texture: 0, torso: 17 },
            { itemId: 'f_top_jean_jacket',      label: "Denim Jacket",         drawable: 85, texture: 0, torso: 12 },
            
            // Special Tops
            { itemId: 'f_top_dress_shirt',      label: "Dress Shirt",          drawable: 111, texture: 0, torso: 5 }
        ],
        legs: [
            // Jeans
            { itemId: 'f_legs_black_jeans',     label: "Black Jeans",          drawable: 1,  texture: 0 },
            { itemId: 'f_legs_blue_jeans',      label: "Blue Jeans",           drawable: 1,  texture: 1 },
            { itemId: 'f_legs_light_jeans',     label: "Light Jeans",          drawable: 1,  texture: 2 },
            { itemId: 'f_legs_ripped_jeans',    label: "Ripped Jeans",         drawable: 1,  texture: 3 },
            { itemId: 'f_legs_skinny_jeans',    label: "Skinny Jeans",         drawable: 1,  texture: 4 },
            
            // Pants & Leggings
            { itemId: 'f_legs_black_leggings',  label: "Black Leggings",       drawable: 4,  texture: 0 },
            { itemId: 'f_legs_gray_leggings',   label: "Gray Leggings",        drawable: 4,  texture: 1 },
            { itemId: 'f_legs_sports_leggings', label: "Sports Leggings",      drawable: 108, texture: 0 },
            { itemId: 'f_legs_black_pants',     label: "Black Pants",          drawable: 81, texture: 0 },
            { itemId: 'f_legs_yoga_pants',      label: "Yoga Pants",           drawable: 106, texture: 0 },
            
            // Shorts & Skirts
            { itemId: 'f_legs_denim_skirt',     label: "Denim Skirt",          drawable: 10, texture: 0 },
            { itemId: 'f_legs_short_skirt',     label: "Short Skirt",          drawable: 10, texture: 1 },
            { itemId: 'f_legs_black_shorts',    label: "Black Shorts",         drawable: 87, texture: 0 },
            { itemId: 'f_legs_athletic_shorts', label: "Athletic Shorts",      drawable: 93, texture: 0 },
            
            // Formal
            { itemId: 'f_legs_dress_pants',     label: "Dress Pants",          drawable: 102, texture: 0 }
        ],
        shoes: [
            // Sneakers
            { itemId: 'f_shoes_pink_sneakers',  label: "Pink Sneakers",        drawable: 2,  texture: 0 },
            { itemId: 'f_shoes_white_sneakers', label: "White Sneakers",       drawable: 2,  texture: 1 },
            { itemId: 'f_shoes_black_sneakers', label: "Black Sneakers",       drawable: 2,  texture: 2 },
            { itemId: 'f_shoes_gray_sneakers',  label: "Gray Sneakers",        drawable: 2,  texture: 3 },
            
            // Athletic Shoes
            { itemId: 'f_shoes_athletic_pink',  label: "Pink Athletic",        drawable: 68, texture: 0 },
            { itemId: 'f_shoes_athletic_white', label: "White Athletic",       drawable: 68, texture: 1 },
            { itemId: 'f_shoes_gym_shoes',      label: "Gym Shoes",            drawable: 119, texture: 0 },
            
            // Boots
            { itemId: 'f_shoes_ankle_boots',    label: "Ankle Boots",          drawable: 3,  texture: 0 },
            { itemId: 'f_shoes_tall_boots',     label: "Tall Boots",           drawable: 3,  texture: 1 },
            { itemId: 'f_shoes_combat_boots',   label: "Combat Boots",         drawable: 103, texture: 0 },
            
            // Casual & Formal
            { itemId: 'f_shoes_casual',         label: "Casual Shoes",         drawable: 54, texture: 0 },
            { itemId: 'f_shoes_heels',          label: "Black Heels",          drawable: 47, texture: 0 },
            { itemId: 'f_shoes_flats',          label: "Flats",                drawable: 69, texture: 0 },
            { itemId: 'f_shoes_sandals',        label: "Sandals",              drawable: 11, texture: 0 }
        ]
    }
};

if (typeof module !== 'undefined') {
    module.exports = CreatorClothes;
}