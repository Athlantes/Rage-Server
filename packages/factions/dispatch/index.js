// packages/factions/dispatch/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Entry point for the dispatch system.
// Load this AFTER all faction modules are loaded (factions/index.js does this).
// ─────────────────────────────────────────────────────────────────────────────

require('./dispatchManager');  // Registers server:dispatch:* events
require('../taxi/taxiCommand');       // Registers /calltaxi command
// require('./policeCommand');  // Future: /callcops, /911, etc.

console.log('[Dispatch] Dispatch system loaded.');
