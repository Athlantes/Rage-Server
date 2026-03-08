require('./auth/index.js');
require('./chat/index.js');
require('./ui/spawn/index.js');
require('./core/voice.js');
require('./camera.js');
require('./mugshot.js');
require('./core/cayo/heistisland.js');

// 1. Core Utilities & Managers
require('./core/nametags.js');
require('./core/afk.js');
require('./core/typing.js');
require('./core/playerMenu.js');
require('./core/family.js');
require('./core/disableDefaults.js');
require('./core/interaction.js');
require('./core/keys.js');
require('./core/overlay.js');
require('./core/events.js');
require('./core/discord.js');
require('./systems/questTracker.js');

// 2. Complex Subsystems (Phone)
require('./phone/index.js');

// 3. Game Systems
require('./circleMenu/main.js');
require('./systems/draw-zone.js');
require('./systems/zones.js');
require('./systems/inventory.js');
require('./systems/fuel.js');
require('./systems/dumpster.js');
require('./systems/returo.js');
require('./systems/atm.js');
require('./systems/photoHunt.js');
require('./systems/cablecar.js');
require('./systems/carCrafting.js');

// 5. Head-to-Head Race
require('./systems/h2hRace.js');
require('./systems/atmSkimmer.js');

// 4. Jobs
require('./jobs/manager.js');
require('./jobs/garbage.js');
require('./jobs/farmer.js');
require('./jobs/preview.js');

require('./creator/index.js');
require('./core/dealership.js');
require('./core/tuning.js');

// Factions — Wardrobe system
require('./factions/wardrobe/index.js');

require('./factions/lspd/index.js');

// Factions — Dispatch system
require('./factions/dispatch/index.js');