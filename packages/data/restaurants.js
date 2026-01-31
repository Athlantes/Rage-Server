const RESTAURANTS = [
    // --- Davis & Strawberry ---
    { name: "Taco Bomb", x: 12.39, y: -1606.09, z: 29.40 },
    { name: "Lucky Plucker (Davis)", x: 132.57, y: -1462.34, z: 29.36 },
    { name: "Grocery Store (Strawberry)", x: 86.55, y: -1670.27, z: 29.16 },
    { name: "Bishop's Chicken (Davis)", x: 168.73, y: -1633.18, z: 29.29 },
    { name: "Liquor Store (Davis)", x: 129.66, y: -1642.51, z: 29.29 },
    { name: "Gabriela's Market (Strawberry)", x: 52.92, y: -1478.84, z: 29.29 },
    { name: "Aguila Burrito (Strawberry)", x: 99.40, y: -1419.25, z: 29.42 },
    { name: "Liquor Store (Strawberry)", x: -20.84, y: -1471.68, z: 30.73 },
    { name: "On The Bone (Strawberry)", x: -42.87, y: -1473.59, z: 31.83 },
    { name: "Brewer's Drop (Strawberry)", x: 97.76, y: -1308.97, z: 29.28 },
    { name: "Beer & Wine (Strawberry)", x: 170.73, y: -1337.66, z: 29.30 },
    { name: "Ring Of Fire Chilli (Davis)", x: 176.71, y: -1438.02, z: 29.24 },
    { name: "Fowl Mouthed (Strawberry)", x: 225.28, y: -1511.64, z: 29.29 },
    { name: "La Vaca Loco (Davis)", x: 125.49, y: -1538.17, z: 29.19 },
    { name: "Attack-A-Taco (Strawberry)", x: 446.00, y: -1242.38, z: 30.29 },
    { name: "Long Pig (Strawberry)", x: -297.49, y: -1332.33, z: 31.30 },

    // --- Rancho & Mission Row ---
    { name: "Hearty Taco (Rancho)", x: 438.11, y: -1465.61, z: 29.29 },
    { name: "Downtown Liquor (Mission Row)", x: 382.57, y: -1076.67, z: 29.42 },
    { name: "Rusty Browns (Mission Row)", x: 354.10, y: -1028.43, z: 29.33 },
    { name: "Limey's (Mission Row)", x: 249.97, y: -1027.14, z: 29.27 },

    // --- Pillbox Hill & Little Seoul ---
    { name: "Bar Fes (Pillbox)", x: -3.51, y: -981.48, z: 29.36 },
    { name: "Chihuahua Hot Dogs (Pillbox)", x: 43.77, y: -997.82, z: 29.34 },
    { name: "Bean Machine (Pillbox)", x: 128.13, y: -1028.00, z: 29.36 },
    { name: "Crucial Fix (Pillbox)", x: 273.96, y: -833.83, z: 29.26 },
    { name: "Wook Noodle House (Little Seoul)", x: -654.30, y: -879.95, z: 24.56 },
    { name: "Park Jung Restaurant (Little Seoul)", x: -653.93, y: -885.49, z: 24.69 },
    { name: "Bean Machine (Little Seoul)", x: -659.11, y: -814.50, z: 24.54 },
    { name: "Korean Noodle House (Little Seoul)", x: -701.23, y: -883.83, z: 23.79 },
    { name: "Snr. Buns (Little Seoul)", x: -512.49, y: -682.63, z: 33.18 },
    { name: "Hit & Run (Little Seoul)", x: -575.87, y: -677.98, z: 32.36 },

    // --- Vespucci & Del Perro ---
    { name: "Wingman (Vespucci)", x: -860.79, y: -1141.48, z: 7.00 },
    { name: "Burger Shot (Vespucci)", x: -1182.67, y: -883.50, z: 13.77 },
    { name: "Lettuce Be (Del Perro)", x: -1221.81, y: -806.52, z: 16.62 },
    { name: "Taco Urban (Del Perro)", x: -1197.66, y: -791.96, z: 16.34 },
    { name: "Al Dente's (Del Perro)", x: -1258.23, y: -760.64, z: 20.32 },
    { name: "Del Perro Food Court A", x: -1534.60, y: -453.49, z: 35.92 },
    { name: "Del Perro Food Court B", x: -1539.07, y: -427.46, z: 35.59 },
    { name: "Del Perro Food Court C", x: -1534.61, y: -422.30, z: 35.59 },
    { name: "Del Perro Food Court D", x: -1549.10, y: -436.03, z: 35.89 },
    { name: "Del Perro Food Court E", x: -1552.60, y: -440.27, z: 40.52 },
    { name: "Del Perro Food Court F", x: -1540.72, y: -454.63, z: 40.52 },

    // --- Burton & Vinewood ---
    { name: "Cluckin' Bell (Burton)", x: -137.99, y: -256.90, z: 43.59 },
    { name: "Cafe (Burton)", x: -132.24, y: -246.97, z: 44.26 },
    { name: "Byte (Burton)", x: 89.08, y: -221.91, z: 54.64 },
    { name: "Trey Baker (Burton)", x: 50.95, y: -135.33, z: 55.20 },
    { name: "Liquor Store (Burton)", x: -58.76, y: -92.10, z: 57.77 },
    { name: "Al Dente's (Burton)", x: -212.51, y: -40.27, z: 50.07 },
    { name: "Cockatoos (Burton)", x: -430.65, y: -24.08, z: 46.23 },
    { name: "Byte (Burton Mall)", x: 229.72, y: -22.86, z: 74.99 },
    { name: "Pizza Things (Burton Mall)", x: 215.40, y: -17.34, z: 74.99 },
    { name: "Singleton's (Vinewood)", x: 219.75, y: 304.88, z: 105.58 },
    { name: "Up-n-Atom (Vinewood)", x: 81.18, y: 274.21, z: 110.21 },
    { name: "Vinewood Liquor", x: 456.13, y: 130.16, z: 99.29 },

    // --- Mirror Park & Murrieta ---
    { name: "Gabriela's Market (Mirror Park)", x: 1169.21, y: -291.30, z: 69.02 },
    { name: "Hearty Taco (Mirror Park)", x: 1093.24, y: -363.49, z: 67.05 },
    { name: "Cool Bean (Mirror Park)", x: 1173.11, y: -397.84, z: 67.73 },
    { name: "Byte (Mirror Park)", x: 1139.78, y: -464.06, z: 66.86 },
    { name: "Squeeze Me Nut (Mirror Park)", x: 1199.39, y: -501.63, z: 65.19 },
    { name: "Mexican & American (Murrieta)", x: 1139.15, y: -961.65, z: 47.53 }
];

module.exports = RESTAURANTS;