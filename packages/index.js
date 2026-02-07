require('./webserver');             // Starts the image hosting
require('./core/phone/phoneManager');

require('./chat');

// 1. Core Managers (Database, Auth, Player, Vehicles)
require('./core');

// 2. Game Systems (Inventory, Dumpster, Fuel)
require('./systems');

// 3. Jobs
require('./jobs');

// 4. Zones
require('./zones');



console.log("[Server] Packages loaded successfully.");