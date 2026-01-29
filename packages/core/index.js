require('./database');
require('./playerManager');
require('./auth');
require('./vehicles/vehicleSystem'); 
require('./commands');   
require('./phone/phoneManager');
require('./questManager');

const vehicleManager = require('./vehicles/vehicleManager');

// Load cars immediately
vehicleManager.loadAll();

// Add a test command so you can buy a car right now
mp.events.addCommand('buycar', (player, model) => {
    if(!player.logged) return player.outputChatBox("Login first!");
    if(!model) return player.outputChatBox("Usage: /buycar [modelname]");
    
    vehicleManager.create(player, model);
});

// Save cars when players leave them (Optional safety)
mp.events.add('playerExitVehicle', (player, vehicle) => {
    vehicleManager.save(vehicle);
});
// -----------------------