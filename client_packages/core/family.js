// client_packages/core/family.js
// ─────────────────────────────────────────────────────────────────────────────
//  Families System — Client Bridge
//  Bridges playerMenu UI → client events → server remote calls
// ─────────────────────────────────────────────────────────────────────────────

// ── playerMenu triggers (fired from HTML via mp.trigger) ─────────────────────

mp.events.add('client:family:create', (jsonStr) => {
    mp.events.callRemote('server:family:create', jsonStr);
});

mp.events.add('client:family:apply', (familyId) => {
    mp.events.callRemote('server:family:apply', familyId);
});

mp.events.add('client:family:directJoin', (familyId) => {
    mp.events.callRemote('server:family:directJoin', familyId);
});

mp.events.add('client:family:leave', () => {
    mp.events.callRemote('server:family:leave');
});

mp.events.add('client:family:kick', (userId) => {
    mp.events.callRemote('server:family:kick', userId);
});

mp.events.add('client:family:setRank', (userId, rank) => {
    mp.events.callRemote('server:family:setRank', userId, rank);
});

mp.events.add('client:family:acceptApp', (userId) => {
    mp.events.callRemote('server:family:acceptApp', userId);
});

mp.events.add('client:family:rejectApp', (userId) => {
    mp.events.callRemote('server:family:rejectApp', userId);
});

mp.events.add('client:family:bankDeposit', (amount) => {
    mp.events.callRemote('server:family:bankDeposit', amount);
});

mp.events.add('client:family:depositPP', (amount) => {
    mp.events.callRemote('server:family:ppDeposit', amount);
});

mp.events.add('client:family:upgrade', () => {
    mp.events.callRemote('server:family:upgrade');
});

mp.events.add('client:family:upgradeVehicleSlots', () => {
    mp.events.callRemote('server:family:upgradeVehicleSlots');
});

mp.events.add('client:family:garageAction', (action, vehicleId) => {
    mp.events.callRemote('server:family:garageAction', action, vehicleId);
});

mp.events.add('client:family:toggleApplications', () => {
    mp.events.callRemote('server:family:toggleApplications');
});

mp.events.add('client:family:toggleInvites', () => {
    mp.events.callRemote('server:family:toggleInvites');
});

mp.events.add('client:family:setHQ', () => {
    mp.events.callRemote('server:family:setHQ');
});

mp.events.add('client:family:disband', () => {
    mp.events.callRemote('server:family:disband');
});

mp.events.add('client:family:spawn', () => {
    mp.events.callRemote('server:family:spawn');
});

mp.events.add('client:family:setTag', (tag) => {
    mp.events.callRemote('server:family:setTag', tag);
});

mp.events.add('client:family:setMainColor', (color) => {
    mp.events.callRemote('server:family:setMainColor', color);
});

mp.events.add('client:family:setRankColor', (rank, color) => {
    mp.events.callRemote('server:family:setRankColor', rank, color);
});
mp.events.add('client:family:cancelApplication', () => {
    mp.events.callRemote('server:family:cancelApplication');
});

// Server-triggered refresh: re-request full playerMenu data
mp.events.add('client:family:refresh', () => {
    mp.events.callRemote('server:playerMenu:getData');
});

// Server → client: show a toast inside the playerMenu
mp.events.add('client:family:notify', (jsonStr) => {
    const browser = mp.browsers.toArray().find(b => b.url && b.url.includes('playerMenu'));
    if (browser) browser.execute(`famNotify(${JSON.stringify(jsonStr)})`);
});

// Server → client: push fresh family data without full reload
mp.events.add('client:family:pushData', (jsonStr) => {
    const browser = mp.browsers.toArray().find(b => b.url && b.url.includes('playerMenu'));
    if (browser) browser.execute(`famRefresh(${JSON.stringify(jsonStr)})`);
});