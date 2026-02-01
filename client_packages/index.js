require('./auth/index.js');

// 1. Core Utilities & Managers
require('./core/pauseMenu.js');
require('./core/jobMenu.js');
require('./core/questMenu.js');
require('./core/disableDefaults.js');
require('./core/interaction.js');
require('./core/keys.js');
require('./core/overlay.js');
require('./core/events.js');
require('./systems/questTracker.js');

// 2. Complex Subsystems (Phone)
require('./phone/index.js');

// 3. Game Systems
require('./systems/draw-zone.js');
require('./systems/zones.js');
require('./systems/inventory.js');
require('./systems/fuel.js');
require('./systems/dumpster.js');
require('./systems/returo.js');
require('./systems/atm.js');

// 4. Jobs
require('./jobs/manager.js');
require('./jobs/garbage.js');

require('./creator/index.js');