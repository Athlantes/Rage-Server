// packages/factions/index.js

// 1. Load the core manager first
const factionsManager = require('./factionsManager');

// 2. Load wardrobe system (before factions so they can register uniforms)
require('./wardrobe/index');

// 3. Load all your factions here
require('./taxi/index');
require('./lspd/index');

// 4. Load dispatch system (after all factions are registered)
require('./dispatch/index');

console.log("[Factions] All factions loaded successfully.");