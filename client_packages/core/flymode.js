let flyEnabled = false;
let flySpeed = 1.0;

mp.events.add('client:toggleFlyMode', (toggle) => {
    flyEnabled = toggle;
    const player = mp.players.local;
    
    if (toggle) {
        player.setInvincible(true);
        player.setCollision(false, false);
    } else {
        player.setInvincible(false);
        player.setCollision(true, true);
        
        // Place them on the ground properly to prevent falling under the map
        const pos = player.position;
        player.position = new mp.Vector3(pos.x, pos.y, pos.z);
    }
});

function getCameraDirection() {
    const rot = mp.game.cam.getGameplayCamRot(2);
    const z = rot.z * (Math.PI / 180.0);
    const x = rot.x * (Math.PI / 180.0);
    const num = Math.abs(Math.cos(x));
    return new mp.Vector3(
        -Math.sin(z) * num,
        Math.cos(z) * num,
        Math.sin(x)
    );
}

mp.events.add('render', () => {
    if (!flyEnabled) return;

    const player = mp.players.local;
    let pos = player.position;
    let direction = getCameraDirection();
    
    // Get camera yaw (Z rotation) in radians for Left/Right movement
    const camRot = mp.game.cam.getGameplayCamRot(2);
    const zRad = camRot.z * (Math.PI / 180.0);
    
    // --- UI & CHAT CHECK ---
    // Only register key presses if the cursor is hidden and the pause menu is closed
    if (!mp.gui.cursor.visible && !mp.game.ui.isPauseMenuActive()) {
        
        // --- SPEED CALCULATION ---
        let currentSpeed = flySpeed;
        if (mp.keys.isDown(16)) {
            currentSpeed = flySpeed * 3.0; // Shift = Fast
        } else if (mp.keys.isDown(18)) {
            currentSpeed = flySpeed * 0.2; // Left Alt = Slow
        }

        // W key (Forward)
        if (mp.keys.isDown(87)) { 
            pos.x += direction.x * currentSpeed;
            pos.y += direction.y * currentSpeed;
            pos.z += direction.z * currentSpeed;
        }
        // S key (Backward)
        if (mp.keys.isDown(83)) { 
            pos.x -= direction.x * currentSpeed;
            pos.y -= direction.y * currentSpeed;
            pos.z -= direction.z * currentSpeed;
        }

        // D key (Right)
        if (mp.keys.isDown(68)) {
            pos.x += Math.cos(zRad) * currentSpeed;
            pos.y += Math.sin(zRad) * currentSpeed;
        }
        // A key (Left)
        if (mp.keys.isDown(65)) {
            pos.x -= Math.cos(zRad) * currentSpeed;
            pos.y -= Math.sin(zRad) * currentSpeed;
        }
        
        // Space key (Go Up)
        if (mp.keys.isDown(32)) { 
            pos.z += currentSpeed;
        }
        // Ctrl key (Go Down)
        if (mp.keys.isDown(17)) { 
            pos.z -= currentSpeed;
        }
    }
    
    player.position = pos;
    player.setHeading(camRot.z);
});