// packages/factions/index.js

// 1. Load the core manager first
const factionsManager = require('./factionsManager');

// 2. Load all your factions here
require('./taxi/index');

// 3. Load dispatch system (after all factions are registered)
require('./dispatch/index');

console.log("[Factions] All factions loaded successfully.");