/**
 * CHARACTER CLASS SYSTEM - UI DOCUMENTATION
 * 
 * Guide to the Class Selector UI and how to customize it
 */

// ═════════════════════════════════════════════════════════════════════════════
// UI FLOW
// ═════════════════════════════════════════════════════════════════════════════

/*
USER FLOW:
──────────────────────────────────────────────────────────────────────────────

1. Player completes character creation
   └─ Server: charCreator.js saves character
   
2. Server checks if player has class (classManager.hasClass)
   └─ If NO: continue to step 3
   └─ If YES: skip to finalization
   
3. Server triggers client UI
   └─ player.call('client:classSelector:start')
   
4. Client-Side Event Handler
   └─ classSelector.js receives event
   └─ Creates browser window
   └─ Shows UI at classSelector/index.html
   
5. UI Step 1: Class Selection
   └─ Displays 6 class cards (like spawn selector)
   └─ Player hovers/clicks to select
   └─ "Next" button becomes enabled
   
6. UI Step 2: Subclass + Details
   └─ Shows selected class info and story
   └─ Shows 3 subclass cards on the right
   └─ Shows bonuses for each subclass
   └─ Player selects subclass
   └─ "Confirm" button becomes enabled
   
7. Player confirms selection
   └─ Client sends: client:classSelector:confirm(classId, subclassId)
   └─ Server receives and saves to database
   └─ Server applies bonuses to player.data.classData
   
8. UI closes, game continues
   └─ Player spawns with class bonuses active
*/

// ═════════════════════════════════════════════════════════════════════════════
// FILE STRUCTURE
// ═════════════════════════════════════════════════════════════════════════════

/*
client_packages/ui/classSelector/
│
├── index.html
│   └─ Contains:
│      - Header (title "Select Your Class")
│      - Main content area (two steps)
│      - Footer (Back/Confirm buttons)
│      - Divs for class cards and subclass cards
│
├── styles.css
│   └─ Styles for:
│      - Dark theme matching spawn selector
│      - Class cards with hover effects
│      - Smooth transitions between steps
│      - Responsive layout
│      - Color scheme per class
│
└── app.js
    └─ Contains:
       - CLASSES data object
       - State management
       - Event listeners
       - Card rendering logic
       - Step transitions
*/

// ═════════════════════════════════════════════════════════════════════════════
// CUSTOMIZATION GUIDE
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE CLASS COLORS
// ─────────────────────────────────────────────────────────────────────────────

/*
File: client_packages/ui/classSelector/app.js

Find CLASSES object and modify the color hex codes:

enforcer: {
    ...
    color: '#FF3333',  ← Change this color
    ...
}

Color format: hexadecimal (#RRGGBB)
Examples: #FF0000 (red), #00FF00 (green), #0000FF (blue)
*/

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE CLASS ICONS (EMOJIS)
// ─────────────────────────────────────────────────────────────────────────────

/*
File: client_packages/ui/classSelector/app.js

Find CLASSES object and modify the icon emoji:

enforcer: {
    ...
    icon: '🛡️',  ← Change this emoji
    ...
}

Other emoji options:
💻 Hacker, 🎯 Target, ⚡ Thunder, 🔥 Fire, 💪 Strength, 
🚀 Rocket, 👁️ Eye, 🎪 Circus, 🏆 Trophy, 🎨 Palette
*/

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE CLASS NAMES
// ─────────────────────────────────────────────────────────────────────────────

/*
IMPORTANT: Class names must be changed in TWO places:

1. Server-side (packages/systems/classDefinitions.js):
   ENFORCER: {
       id: 'enforcer',
       name: 'ENFORCER',  ← Change here
       ...
   }

2. Client-side (client_packages/ui/classSelector/app.js):
   enforcer: {
       name: 'ENFORCER',  ← Change here
       ...
   }

Keep the 'id' and key name same (lowercase) - they're used in database!
*/

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE SUBCLASS NAMES
// ─────────────────────────────────────────────────────────────────────────────

/*
IMPORTANT: Subclass IDs must be lowercase and match everywhere

Server (packages/systems/classDefinitions.js):
subclasses: {
    soldier: {           ← 'soldier' is the ID (use in commands)
        name: 'Soldier',  ← Display name
        description: '...',
        bonuses: {...}
    }
}

Client (client_packages/ui/classSelector/app.js):
subclasses: {
    soldier: {
        name: 'Soldier',
        description: 'Trained operative'
    }
}

Database: Uses the ID exactly as defined
*/

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE CLASS DESCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────────

/*
File: client_packages/ui/classSelector/app.js

enforcer: {
    ...
    description: 'Masters of combat and control. Enforcers are tough, intimidating, and built for conflict.',
    story: 'You\'ve learned to fight hard and survive harder. The streets respect power.',
    ...
}

- description: Shown on class card (brief)
- story: Shown in step 2 detail view (longer narrative)
- Both appear on UI
*/

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE BONUS DESCRIPTIONS (shown to player)
// ─────────────────────────────────────────────────────────────────────────────

/*
File: client_packages/ui/classSelector/app.js

In the CLASSES object, bonuses property:

enforcer: {
    ...
    bonuses: {
        soldier: '+15% Combat Damage',      ← User-facing text
        enforcer: '+25% Combat Damage',
        warlord: '+40% Combat Damage'
    }
}

These are just display text for the UI.
Actual bonuses are in packages/systems/classDefinitions.js
*/

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE BONUS VALUES
// ─────────────────────────────────────────────────────────────────────────────

/*
File: packages/systems/classDefinitions.js

soldier: {
    name: 'Soldier',
    description: 'Trained operative',
    bonuses: {
        combatDamage: { type: 'percentModifier', value: 1.15 },  ← Change 1.15
        movementSpeed: { type: 'percentModifier', value: 0.95 }  ← Change 0.95
    }
}

percentModifier: 1.15 = 15% increase, 0.95 = 5% decrease
cooldownReduction: 0.90 = 10% faster, 0.75 = 25% faster
flatBonus: 10 = +10, 100 = +100

REMEMBER: Must also update the UI text in classSelector/app.js bonuses!
*/

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE UI STYLING
// ─────────────────────────────────────────────────────────────────────────────

/*
File: client_packages/ui/classSelector/styles.css

Main color scheme (body background):
body {
    background: #0a0a0a;  ← Very dark background
}

Header styling:
#header {
    ..background: linear-gradient(135deg, rgba(20, 20, 30, 0.9), rgba(30, 20, 40, 0.8));
}

Button colors:
.btn-primary {
    background: #00CC66;  ← Green button
}

Card styling:
.class-card {
    border-color: rgba(255, 255, 255, 0.15);
}

To make theme brighter:
- Increase background RGB values (e.g., 0a0a0a → 2a2a2a)
- Increase text opacity (0.15 → 0.3)
- Change button colors
*/

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE HEADER TEXT
// ─────────────────────────────────────────────────────────────────────────────

/*
File: client_packages/ui/classSelector/index.html

<h1>Select Your Class</h1>
<p>Choose your path and unlock unique abilities</p>

Modify the text to your preference.
*/

// ═════════════════════════════════════════════════════════════════════════════
// HIDING OR SHOWING THE CLASS SELECTOR
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Force show class selector (debug)
// ─────────────────────────────────────────────────────────────────────────────

/*
In client-side code (test):

mp.events.callLocal('client:classSelector:start');

This manually triggers the class selector UI.
*/

// ─────────────────────────────────────────────────────────────────────────────
// Skip class selector for existing players
// ─────────────────────────────────────────────────────────────────────────────

/*
This already happens automatically in classManager.loadPlayerClass()
When player joins:
1. Server loads their saved class from database
2. If class exists, bonuses are applied automatically
3. Class selector is NOT shown (already selected)

New code path:
- New character: NO class in database → Show selector
- Returning player: Class in database → Load bonuses, no selector
*/

// ═════════════════════════════════════════════════════════════════════════════
// TESTING THE UI
// ═════════════════════════════════════════════════════════════════════════════

/*
Testing class selector in browser (local development):

1. Open: client_packages/ui/classSelector/index.html directly in browser
   Note: Won't work without RAGE MP backend, but you can see styling

2. Test with DevTools:
   - Inspect class cards
   - Check responsiveness
   - Change CSS and refresh

3. In-game test:
   - Create new character
   - Should see UI after creation
   - Test clicking cards and selecting
   - Verify selections save to database

Debugging console output:
[ClassSelector] UI Started
[ClassSelector] Confirmed: classId / subclassId
[ClassManager] Applied bonuses for CLASS/SUBCLASS
[ClassManager] Saved class for player dbId: CLASS/SUBCLASS
*/

// ═════════════════════════════════════════════════════════════════════════════
// MAKING UI OPTIONAL
// ═════════────────────────────────────────────────────────────────────────────

/*
If you want to DISABLE the class selector (give everyone Hustler by default):

Option 1: Skip check in charCreator.js
File: packages/systems/charCreator.js
Change:
    if (!hasClass) {
        player.call('client:classSelector:start');
    }
To:
    if (false) { // Never show selector
        player.call('client:classSelector:start');
    }

Option 2: Assign default class in charCreator.js
Add after character save:
    await classManager.savePlayerClass(player, 'HUSTLER', 'grinder');

Option 3: Make it optional per character
In charCreator.js:
    if (!hasClass && data.selectClass) { // Only if data.selectClass = true
        player.call('client:classSelector:start');
    }
*/

// ═════════════════════════════════════════════════════════════════════════════
// ADDING A CLASS SELECTOR COMMAND
// ═════════════════════════════════════════════════════════════════════════════

/*
If you want players to re-select their class:

Add to packages/core/commands.js (or create new file):

mp.events.add('server:class:selector', (player) => {
    if (!player.logged) return;
    
    // Server-side trigger
    player.call('client:classSelector:start');
    
    player.outputChatBox('Select your class to change it.');
});

Then in-game:
/classselect (or whatever command you create)
*/

// ═════════════════════════════════════════════════════════════════════════════
// TROUBLESHOOTING UI ISSUES
// ═════════════════════════════════════════════════════════════════════════════

/*
Q: UI doesn't appear after character creation
A1: Check browser is loading: client_packages/ui/classSelector/index.html
A2: Check charCreator.js: player.call('client:classSelector:start') is there
A3: Check client_packages/index.js requires classSelector.js
A4: Check server logs for errors

Q: Cards don't respond to clicks
A1: Check app.js event listeners are attached
A2: Check selectClass() function exists (should be in app.js)
A3: Check browser console for JavaScript errors

Q: Wrong colors/fonts
A1: Check styles.css loaded (network tab)
A2: Check color hex codes are valid (#RRGGBB format)
A3: Check font-awesome CDN loaded (icons)
A4: Check Google Fonts CDN loaded (Barlow font)

Q: Buttons don't work
A1: Check app.js button event listeners
A2: Check mp.trigger() calls are correct (from UI to game)
A3: Check server event handlers (server:class:save)
A4: Check browser console for mp.trigger errors

Q: Step 2 won't load
A1: Check renderStep2() function in app.js
A2: Check bonuses display code (map through bonuses)
A3: Check subclass card creation loop
A4: Check color variable set correctly
*/

module.exports = { uiDocumentation: true };
