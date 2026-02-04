require('./database');
require('./playerManager');
require('./auth');
require('./vehicles/vehicleSystem'); 
require('./commands');   
require('./phone/index');
require('./questManager');
require('./banking');
require('./playerMenu');

const vehicleManager = require('./vehicles/vehicleManager');

// Load cars immediately
vehicleManager.loadAll();

// Save cars when players leave them (Optional safety)
mp.events.add('playerExitVehicle', (player, vehicle) => {
    vehicleManager.save(vehicle);
});
// -----------------------