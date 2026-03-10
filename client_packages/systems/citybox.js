// client_packages/systems/citybox.js
let cityboxUI = null;
const cityBoxLocations = [
    new mp.Vector3(49.94, -1743.90, 29.30),
    new mp.Vector3(-483.12, -738.55, 33.21),
    new mp.Vector3(138.19, 152.90, 104.62),
    new mp.Vector3(-2208.51, -369.83, 13.31),
    new mp.Vector3(1869.87, 3744.84, 32.88),
    new mp.Vector3(1694.97, 4766.48, 42.00),
    new mp.Vector3(-431.75, 6139.91, 31.48),
];

// Spawn Blips, Markers, and Colshapes
cityBoxLocations.forEach((pos, index) => {
    
    // Map Blip
    mp.blips.new(478, new mp.Vector3(pos.x, pos.y, pos.z), {
        name: 'CityBox Locker',
        color: 47, 
        shortRange: true, 
        scale: 0.8
    });

    // Visual Marker
    mp.markers.new(1, new mp.Vector3(pos.x, pos.y, pos.z - 1.0), 1.0, {
        color: [255, 165, 0, 150], 
        visible: true,
        dimension: 0
    });

    // Interaction Colshape
    const colshape = mp.colshapes.newSphere(pos.x, pos.y, pos.z, 1.5);
    
    // Let core/interaction.js handle the logic automatically!
    colshape.interaction = {
        title: [
            { key: 'E', label: 'Access CityBox' } // Passed to your showInteraction array
        ],
        text: null,
        requireOnFoot: true, // Forces the player to get out of their car
        event: 'server:citybox:requestOpen', // The event called when they press 'E'
        data: index // Optional: Sends the locker index to the server
    };
});

// Event to open the CEF UI (Triggered by the server after pressing E)
mp.events.add('client:citybox:openUI', (boxItemsJson, invItemsJson) => {
    if (cityboxUI) return;
    
    cityboxUI = mp.browsers.new("package://ui/citybox/index.html");
    mp.gui.cursor.show(true, true);
    mp.gui.chat.activate(false);
    
    // Wait slightly for HTML to load, then send data
    setTimeout(() => {
        if(cityboxUI) {
            cityboxUI.execute(`loadData('${boxItemsJson}', '${invItemsJson}')`);
        }
    }, 150);
});

mp.events.add('client:citybox:takeItem', (boxItemId) => {
    mp.events.callRemote('server:citybox:takeItem', boxItemId);
});

// Fired by the HTML close button
mp.events.add('client:citybox:close', () => {
    if (cityboxUI) {
        cityboxUI.destroy();
        cityboxUI = null;
        mp.gui.cursor.show(false, false);
        mp.gui.chat.activate(true);
        // Call your custom interaction restore event!
        mp.events.call('interaction:restore');
    }
});