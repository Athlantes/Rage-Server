// packages/systems/cityHall.js
// ─────────────────────────────────────────────────────────────────────────────
//  City Hall interaction zone — opens the Permit Board UI when a player
//  presses E at the City Hall entrance.
//  Also registers the /permits admin command.
// ─────────────────────────────────────────────────────────────────────────────

// City Hall entrance (Mission Row - default LS City Hall)
const CITY_HALL_POS = { x: -545.17, y: -204.10, z: 38.22, h: -153.52 };
const ZONE_RADIUS   = 3.0;

// 1. Create Map Blip
mp.blips.new(419, new mp.Vector3(CITY_HALL_POS.x, CITY_HALL_POS.y, CITY_HALL_POS.z), {
    name: 'City Hall',
    color: 4, // Default white color
    shortRange: true,
    dimension: 0
});

// 2. Create an NPC (Ped)
// 'a_m_y_business_01' is the model. We set the heading (rotation) to 0.0 and dimension to 0.
mp.peds.new(mp.joaat('a_m_y_business_01'), new mp.Vector3(CITY_HALL_POS.x, CITY_HALL_POS.y, CITY_HALL_POS.z), {
    heading: CITY_HALL_POS.h, // Adjust this angle so the NPC faces the right way
    dimension: 0,
    dynamic: false // Keeps the NPC from walking away
});

// 3. Create a visual Marker on the ground
mp.markers.new(1, new mp.Vector3(CITY_HALL_POS.x, CITY_HALL_POS.y, CITY_HALL_POS.z - 1.0), 1.0, {
    color: [255, 255, 0, 100], // Yellow semi-transparent
    visible_distance: 20,
    dimension: 0
});

// Create interaction colshape
const cityHallShape = mp.colshapes.newSphere(
    CITY_HALL_POS.x, CITY_HALL_POS.y, CITY_HALL_POS.z,
    ZONE_RADIUS, 0
);
cityHallShape.setVariable('interaction', {
    title: 'City Hall',
    text:  'Press E to view Business Permits',
    event: 'server:permit:openBoard',
});

mp.events.add('server:permit:openBoard', (player) => {
    if (!player.logged) return;
    player.call('client:permit:openBoard');
});

// ── Admin: /permits draw <businessId> ────────────────────────────────────────
mp.events.addCommand('permits', async (player, args) => {
    if (!player.logged)
        return player.outputChatBox('!{FF0000}Admins only.');

    const sub   = (args[0] || '').toLowerCase();
    const bizId = parseInt(args[1]);

    if (sub === 'draw') {
        if (isNaN(bizId)) return player.outputChatBox('!{FF0000}Usage: /permits draw <businessId>');
        const PermitManager = require('./permitManager');
        const result = await PermitManager.drawRaffle(bizId);
        if (result.success)
            player.outputChatBox(`!{00FF00}[Admin] Raffle drawn for "${result.bizName}". Winner family ID: ${result.winnerFamilyId}.`);
        else
            player.outputChatBox(`!{FF0000}[Admin] ${result.error}`);

    } else if (sub === 'list') {
        const PermitManager = require('./permitManager');
        const data = PermitManager.getPermitBoardData(player);
        player.outputChatBox('!{FFFF00}--- Business Permits ---');
        data.forEach(b => {
            const owner = b.isOwnedByMe ? '(YOURS)' : (b.ownerName ? b.ownerName : 'open raffle');
            player.outputChatBox(`!{FFFFFF}#${b.id} ${b.name} [T${b.tier}] — ${b.status} / ${owner}`);
        });

    } else {
        player.outputChatBox('!{FFFF00}Usage: /permits list | /permits draw <id>');
    }
});

console.log('[CityHall] Permit zone registered at Mission Row.');