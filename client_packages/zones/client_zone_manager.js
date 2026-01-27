// client_packages/client_zone_manager.js

// State variables to track what is currently active
const ActiveEffects = {
    no_collision: false,
    safe_zone: false
};

// --- 1. RECEIVE SERVER COMMAND ---
mp.events.add("Client:ZoneManager", (enable, type) => {
    // 1. Logic Handler
    if (ActiveEffects.hasOwnProperty(type)) {
        ActiveEffects[type] = enable;
        
        // Immediate Actions
        if (type === 'no_collision') updateGhostVisuals(enable);
    }

    // 2. UI Handler (NEW)
    // If enabling, show the UI. If disabling, hide it.
    if (enable) {
        mp.events.call('updateZoneOverlay', true, type);
    } else {
        // Only hide if the type matches (prevents hiding safezone if you leave noclip but are still in safezone)
        // For simple setups, just hiding is fine:
        mp.events.call('updateZoneOverlay', false, type);
    }
});

// --- 2. GAME LOOP (Runs every frame) ---
mp.events.add("render", () => {
    // LOGIC: No Collision (Ghost Mode)
    if (ActiveEffects.no_collision) {
        const localVeh = mp.players.local.vehicle;
        if (localVeh) {
            mp.vehicles.forEachInStreamRange((otherVehicle) => {
                if (otherVehicle.handle !== localVeh.handle) {
                    mp.game.entity.setNoCollisionEntity(localVeh.handle, otherVehicle.handle, false);
                    mp.game.entity.setNoCollisionEntity(otherVehicle.handle, localVeh.handle, false);
                }
            });
        }
    }

    // LOGIC: Safe Zone (Disable Weapons + Godmode)
    if (ActiveEffects.safe_zone) {
        // Disable firing
        mp.game.controls.disableControlAction(0, 24, true); // Attack
        mp.game.controls.disableControlAction(0, 69, true); // Attack
        mp.game.controls.disableControlAction(0, 70, true); // Attack
        mp.game.controls.disableControlAction(0, 92, true); // Attack
        
        // Disable weapon wheel
        mp.game.controls.disableControlAction(0, 37, true); 
        
        // Set player invincible
        mp.players.local.setInvincible(true);
    } else {
        // Ensure invincibility is turned off when leaving
        // (Note: This runs every frame when FALSE, which is inefficient. 
        // ideally, reset this only once in the toggle function below)
    }
});

// --- 3. HELPER FUNCTIONS ---
function updateGhostVisuals(enable) {
    const localVeh = mp.players.local.vehicle;
    if (localVeh) {
        // Set transparency: 150 is transparent, 255 is solid
        localVeh.setAlpha(enable ? 150 : 255);
    }
}