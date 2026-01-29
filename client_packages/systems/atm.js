// client_packages/systems/atm.js

// 1. Configuration
const ATM_BLIP_ID = 500;       // Dollar Sign
const ATM_BLIP_COLOR = 18;      // Light Blue
const ATM_BLIP_SCALE = 0.7;
const ATM_BLIP_NAME = "ATM";

// 2. ATM Coordinates (Extracted from your map files)
const ATM_LOCATIONS = [
    // prop_atm_01
    {x: 228.03, y: 337.85, z: 104.50},
    {x: 158.79, y: 234.74, z: 105.64},
    {x: -57.17, y: -92.37, z: 56.75},
    {x: 357.12, y: 174.08, z: 102.05},
    {x: -1044.46, y: -2739.64, z: 8.12},
    {x: -1415.48, y: -212.33, z: 45.49},
    {x: -1430.66, y: -211.35, z: 45.47},
    {x: -1282.09, y: -210.55, z: 41.43},
    {x: -1286.70, y: -213.78, z: 41.43},
    {x: -1289.74, y: -227.16, z: 41.43},
    {x: -1285.13, y: -223.94, z: 41.43},
    {x: -1110.22, y: -1691.15, z: 3.37},
    {x: -1091.88, y: 2709.05, z: 17.91},
    {x: -3144.88, y: 1127.81, z: 19.83},
    {x: 2563.99, y: 2584.55, z: 37.06},
    {x: 1687.39, y: 4815.9, z: 41.00},
    {x: 1700.69, y: 6426.76, z: 31.63},
    {x: 1822.97, y: 3682.57, z: 33.26},
    {x: 1171.52, y: 2703.13, z: 37.14},
    {x: 1172.45, y: 2703.13, z: 37.14},

    // prop_atm_02
    {x: 24.59, y: -945.54, z: 28.33},
    {x: 5.68, y: -919.95, z: 28.48},
    {x: 296.17, y: -896.23, z: 28.29},
    {x: 296.87, y: -894.31, z: 28.26},
    {x: 527.77, y: -160.66, z: 56.13},
    {x: 285.34, y: 142.97, z: 103.16},
    {x: 1137.81, y: -468.86, z: 65.69},
    {x: 1167.06, y: -455.65, z: 65.81},
    {x: 1077.77, y: -776.96, z: 57.25},
    {x: 289.52, y: -1256.78, z: 28.44},
    {x: 289.26, y: -1282.32, z: 28.65},
    {x: -846.65, y: -341.50, z: 37.66},
    {x: -847.20, y: -340.42, z: 37.67},
    {x: -720.62, y: -415.52, z: 33.97},
    {x: -1410.73, y: -98.92, z: 51.39},
    {x: -1410.18, y: -100.64, z: 51.39},
    {x: -712.93, y: -818.48, z: 22.74},
    {x: -710.08, y: -818.47, z: 22.73},
    {x: -660.67, y: -854.48, z: 23.45},
    {x: -594.61, y: -1160.85, z: 21.33},
    {x: -596.12, y: -1160.85, z: 21.33},
    {x: -1569.83, y: -547.03, z: 33.93},
    {x: -1570.76, y: -547.70, z: 33.93},
    {x: -1305.70, y: -706.68, z: 24.31},
    {x: -2071.92, y: -317.28, z: 12.31},
    {x: -821.89, y: -1081.55, z: 10.13},
    {x: -2295.85, y: 357.93, z: 173.60},
    {x: -2295.06, y: 356.25, z: 173.60},
    {x: -2294.29, y: 354.60, z: 173.60},
    {x: 2558.32, y: 350.98, z: 107.59},
    {x: 156.18, y: 6643.2, z: 30.59},
    {x: 173.82, y: 6638.21, z: 30.59},
    {x: -282.71, y: 6226.43, z: 30.49},
    {x: -95.87, y: 6457.46, z: 30.47},
    {x: -97.63, y: 6455.73, z: 30.46},
    {x: -132.66, y: 6366.87, z: 30.47},
    {x: -386.45, y: 6046.41, z: 30.47},

    // prop_atm_03
    {x: -301.65, y: -829.58, z: 31.41},
    {x: -303.22, y: -829.31, z: 31.41},
    {x: -204.01, y: -861.00, z: 29.27},
    {x: 118.64, y: -883.56, z: 30.13},
    {x: 112.47, y: -819.80, z: 30.33},
    {x: 111.38, y: -774.84, z: 30.43},
    {x: 114.54, y: -775.97, z: 30.41},
    {x: -256.63, y: -715.88, z: 32.78},
    {x: -259.27, y: -723.26, z: 32.70},
    {x: -254.52, y: -692.88, z: 32.57},
    {x: -27.89, y: -724.10, z: 43.22},
    {x: -30.09, y: -723.28, z: 43.22},
    {x: 89.81, y: 2.88, z: 67.35},
    {x: -165.58, y: 234.76, z: 93.92},
    {x: -165.58, y: 232.69, z: 93.92},
    {x: -867.01, y: -187.99, z: 36.88},
    {x: -867.97, y: -186.34, z: 36.88},
    {x: -617.80, y: -708.85, z: 29.04},
    {x: -617.80, y: -706.85, z: 29.04},
    {x: -614.51, y: -705.59, z: 30.22},
    {x: -611.85, y: -705.59, z: 30.22},
    {x: -537.80, y: -854.93, z: 28.27},
    {x: -526.77, y: -1223.37, z: 17.45},
    {x: -1315.41, y: -834.43, z: 15.95},
    {x: -1314.46, y: -835.69, z: 15.95},
    {x: -2956.84, y: 487.21, z: 14.47},
    {x: -2958.97, y: 487.30, z: 14.47},
    {x: -2974.58, y: 380.12, z: 14.00},
    {x: -3043.83, y: 594.16, z: 6.73},
    {x: -3241.45, y: 997.90, z: 11.54},

    // prop_fleeca_atm
    {x: 147.47, y: -1036.21, z: 28.36},
    {x: 145.83, y: -1035.62, z: 28.36},
    {x: -1205.37, y: -326.52, z: 36.85},
    {x: -1206.14, y: -325.03, z: 36.85}
];

// 3. Prop Hashes (For Interaction)
const ATM_HASHES = [
    'prop_atm_01', 'prop_atm_02', 'prop_atm_03', 'prop_fleeca_atm'
].map(s => mp.game.joaat(s));

// 4. Variables
let nearbyAtm = null;
let lastInteractionState = false;
let atmBrowser = null;
let createdBlips = false;

// 5. Create Persistent Blips
mp.events.add('playerReady', () => {
    if (createdBlips) return;
    
    ATM_LOCATIONS.forEach(loc => {
        mp.blips.new(ATM_BLIP_ID, new mp.Vector3(loc.x, loc.y, loc.z), {
            name: ATM_BLIP_NAME,
            scale: ATM_BLIP_SCALE,
            color: ATM_BLIP_COLOR,
            shortRange: true // Visible on minimap only when close, always on pause map
        });
    });

    createdBlips = true;
});

// 6. Interaction Loop (Still uses props for accuracy)
setInterval(() => {
    if (mp.gui.cursor.visible && !atmBrowser) return; 

    const player = mp.players.local;
    let foundHandle = null;

    // Scan for closest ATM prop (Physical interaction)
    for (const hash of ATM_HASHES) {
        const handle = mp.game.object.getClosestObjectOfType(
            player.position.x, player.position.y, player.position.z,
            1.2, // Must be very close to interact
            hash, 
            false, false, false
        );

        if (handle && handle !== 0) {
            foundHandle = handle;
            break;
        }
    }

    if (foundHandle) {
        nearbyAtm = foundHandle;
        if (!lastInteractionState) {
            mp.events.call('showInteraction', 'ATM', 'Press E to Access Bank');
            lastInteractionState = true;
        }
    } else {
        nearbyAtm = null;
        if (lastInteractionState) {
            mp.events.call('hideInteraction');
            lastInteractionState = false;
        }
    }
}, 300);

// 7. Key Handler (E)
mp.keys.bind(0x45, true, () => {
    if (mp.gui.cursor.visible && !atmBrowser) return;
    if (!nearbyAtm) return;
    
    mp.events.callRemote('server:atm:open');
});

// 8. UI Events
mp.events.add('client:atm:openUI', (dataJson) => {
    if (atmBrowser) return;
    atmBrowser = mp.browsers.new('package://ui/atm.html');
    mp.gui.cursor.show(true, true);
    
    setTimeout(() => {
        if(atmBrowser) atmBrowser.execute(`loadData('${dataJson}')`);
    }, 100);
});

mp.events.add('client:atm:updateUI', (dataJson) => {
    if (atmBrowser) atmBrowser.execute(`loadData('${dataJson}')`);
});

mp.events.add('client:proxyATM', (type, amount) => {
    mp.events.callRemote('server:atm:process', type, amount);
});

mp.events.add('client:closeATM', () => {
    if (atmBrowser) {
        atmBrowser.destroy();
        atmBrowser = null;
    }
    mp.gui.cursor.show(false, false);
});