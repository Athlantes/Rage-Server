// packages/data/landmarks.js
// pos    = base/center coordinate of the landmark
// height = how tall the landmark is in meters (samples base, mid, top)
// radius = horizontal spread in meters (samples 4 cardinal sides)
// maxDist= max distance the player can be to photograph it (default: 150m)
module.exports = [

    // --- Entries from saved_landmarks.txt ---
    {
        id: 1,
        name: "Vagos Grafitti",
        pos: { x: 1117.20, y: -2590.57, z: 18.63 },
        height: 5,     // flat wall, low height
        radius: 8,
        maxDist: 60,
        reward: 250
    },
    {
        id: 2,
        name: "Chilliad Church",
        pos: { x: 382.00, y: 5316.65, z: 665.57 },
        height: 15,
        radius: 12,
        maxDist: 120,
        reward: 300
    },
    {
        id: 3,
        name: "Chilliad Lake",
        pos: { x: 158.68, y: 5423.68, z: 604.69 },
        height: 2,     // flat water
        radius: 30,
        maxDist: 150,
        reward: 350
    },

    {
        id: 4,
        name: "Maze Bank Tower",
        pos: { x: -75.02, y: -818.22, z: 44.23 },  // base of tower
        height: 230,   // very tall — system samples base, mid (115m), top (230m)
        radius: 25,    // building footprint
        maxDist: 500,  // skyscraper visible from far, generous distance
        reward: 500
    },

    {
        id: 5,
        name: "Vinewood Sign",
        pos: { x: 719.68, y: 1195.52, z: 329.25},
        height: 10,
        radius: 10,
        maxDist: 100,
        reward: 200
    }
];