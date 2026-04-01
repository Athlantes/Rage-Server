/**
 * Class Selector - Client-Side
 * Handles the character class selection UI after character creation
 */

let classSelectorBrowser = null;
let classSelectionActive = false;

// Import class definitions (client version - minimal definition for UI)
const CLIENT_CLASSES = {
    enforcer: {
        name: 'ENFORCER',
        icon: '🛡️',
        color: '#FF3333',
        description: 'Masters of combat and control. Enforcers are tough, intimidating, and built for conflict.',
        subclasses: ['Soldier', 'Enforcer', 'Warlord']
    },
    hustler: {
        name: 'HUSTLER',
        icon: '💰',
        color: '#FFB700',
        description: 'Money moves and business instincts. Hustlers always find a way to profit.',
        subclasses: ['Grinder', 'Entrepreneur', 'Tycoon']
    },
    craftsman: {
        name: 'CRAFTSMAN',
        icon: '🔧',
        color: '#8B4513',
        description: 'Masters of creation and engineering. Craftsmen build better, faster, cheaper.',
        subclasses: ['Apprentice', 'Master', 'Legendary']
    },
    racer: {
        name: 'RACER',
        icon: '🏎️',
        color: '#FF00FF',
        description: 'Speed demons and adrenaline junkies. Racers are the fastest on the road.',
        subclasses: ['Rookie', 'Pro', 'Legend']
    },
    medic: {
        name: 'MEDIC',
        icon: '🏥',
        color: '#00CC66',
        description: 'Healers and lifesavers. Medics keep their allies in the fight.',
        subclasses: ['Paramedic', 'Doctor', 'Surgeon']
    },
    infiltrator: {
        name: 'INFILTRATOR',
        icon: '👻',
        color: '#0099FF',
        description: 'Shadows and secrets. Infiltrators operate outside the law unseen.',
        subclasses: ['Scout', 'Operative', 'Ghost']
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. START CLASS SELECTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trigger the class selector after character creation
 */
mp.events.add('client:classSelector:start', () => {
    try {
        mp.events.callRemote('server:classSelector:eventReceived');
    } catch (e) {}
    
    if (classSelectionActive) {
        try {
            mp.events.callRemote('server:classSelector:alreadyActive');
        } catch (e) {}
        return;
    }

    classSelectionActive = true;

    try {
        mp.gui.cursor.show(true, true);
        mp.game.ui.displayRadar(false);
        mp.game.ui.displayHud(false);

        if (!classSelectorBrowser) {
            try {
                classSelectorBrowser = mp.browsers.new('package://ui/classSelector/index.html');
                
                if (!classSelectorBrowser) {
                    classSelectionActive = false;
                    mp.events.callRemote('server:classSelector:error', 'Browser creation returned null');
                    return;
                }
                
                mp.events.callRemote('server:classSelector:created');
            } catch (browserError) {
                console.error('[ClassSelector] Browser error:', browserError.message);
                classSelectionActive = false;
                mp.events.callRemote('server:classSelector:error', 'Browser creation failed: ' + browserError.message);
                return;
            }
        } else {
            mp.events.callRemote('server:classSelector:reused');
        }
    } catch (e) {
        console.error('[ClassSelector] Error:', e.message);
        classSelectionActive = false;
        mp.events.callRemote('server:classSelector:error', 'Fatal error: ' + e.message);
    }
});

// Debug test function for manual browser creation testing
mp.events.add('debugCreateClassBrowser', () => {
    try {
        const testBrowser = mp.browsers.new('package://ui/classSelector/index.html');
        if (testBrowser) {
            console.log('[ClassSelector] Browser creation test PASSED');
            testBrowser.destroy();
        } else {
            console.error('[ClassSelector] Browser creation test FAILED - null result');
        }
    } catch (e) {
        console.error('[ClassSelector] Browser creation test error:', e.message);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. RECEIVE CLASS DATA FROM UI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * User selected class and subclass - send to server
 */
mp.events.add('client:classSelector:confirm', (classId, subclassId) => {
    console.log(`[ClassSelector] Confirmed: ${classId} / ${subclassId}`);
    
    // Send to server
    mp.events.callRemote('server:class:save', classId, subclassId);
});

// Receive confirmation from server
mp.events.add('client:class:saved', (success) => {
    if (success) {
        console.log('[ClassSelector] Class saved successfully');
        
        // Close UI
        if (classSelectorBrowser) {
            classSelectorBrowser.destroy();
            classSelectorBrowser = null;
        }

        classSelectionActive = false;
        mp.gui.cursor.show(false, false);
        mp.game.ui.displayRadar(false);
        mp.game.ui.displayHud(true);

        // Optional: Show confirmation message
        mp.events.callLocal('client:classSelector:closed');
    } else {
        console.error('[ClassSelector] Failed to save class');
        // Show error and let player retry
        if (classSelectorBrowser) {
            classSelectorBrowser.execute('showError("Failed to save class. Please try again.");');
        }
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. CLOSE CLASS SELECTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Close the class selector (e.g., ESC key)
 */
mp.events.add('client:classSelector:close', () => {
    if (!classSelectionActive) return;

    if (classSelectorBrowser) {
        classSelectorBrowser.destroy();
        classSelectorBrowser = null;
    }

    classSelectionActive = false;
    mp.gui.cursor.show(false, false);
    mp.game.ui.displayRadar(false);
    mp.game.ui.displayHud(true);

    console.log('[ClassSelector] UI Closed');
});

// Handle ESC key during class selection
mp.keys.bind(0x1B, false, () => {
    if (classSelectionActive) {
        // Don't allow closing without selecting
        // mp.events.callLocal('client:classSelector:close');
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. EXPORTS (for UI access)
// ─────────────────────────────────────────────────────────────────────────────

// Make classes available globally for the UI
if (typeof window !== 'undefined') {
    window.CLASS_DATA = CLIENT_CLASSES;
}
