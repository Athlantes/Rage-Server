// 1. Core Utilities & Managers
require('./core/disableDefaults.js');
require('./core/interaction.js');
require('./core/keys.js');
require('./core/overlay.js');
require('./core/events.js');

// 2. Complex Subsystems (Phone)
require('./phone/index.js');

// 3. Game Systems
require('./systems/draw-zone.js');
require('./systems/zones.js');
require('./systems/inventory.js');
require('./systems/fuel.js');
require('./systems/dumpster.js');
require('./systems/returo.js');

// 4. Jobs
require('./jobs/manager.js');
require('./jobs/garbage.js');
