// packages/factions/lspd/index.js
const Faction = require('../Faction');
const factionsManager = require('../factionsManager');
const wardrobeManager = require('../wardrobe/wardrobeManager');
const wantedManager = require('./wantedManager');
const jailManager = require('./jailManager');

// Load subsystems
require('./arrestManager');

class LSPDFaction extends Faction {
    constructor() {
        super(2, 'Los Santos Police Department', 'LEO',
            ['Cadet', 'Officer', 'Senior Officer', 'Sergeant', 'Lieutenant', 'Captain'],
            '#00a8ff'
        );

        this.hq = {
            exterior: new mp.Vector3(433.79, -981.88, 30.71),
            interior: new mp.Vector3(435.79, -981.97, 30.70),
            dutyPoint: new mp.Vector3(435.79, -981.97, 30.70),
            wardrobePoint: new mp.Vector3(451.42, -991.91, 30.69),
            dimension: 102,
        };

        this.garage = {
            menuPoint: new mp.Vector3(453.3, -1017.8, 28.5),
            spawnPoints: [
                { x: 449.4, y: -1026.4, z: 28.4, h: 0.0 },
                { x: 444.5, y: -1026.4, z: 28.4, h: 0.0 },
                { x: 439.5, y: -1026.4, z: 28.4, h: 0.0 },
                { x: 434.5, y: -1026.4, z: 28.4, h: 0.0 },
                { x: 429.5, y: -1026.4, z: 28.4, h: 0.0 },
                { x: 449.4, y: -1033.0, z: 28.4, h: 180.0 },
                { x: 444.5, y: -1033.0, z: 28.4, h: 180.0 },
                { x: 439.5, y: -1033.0, z: 28.4, h: 180.0 },
            ],
        };

        // Rank-gated vehicle categories
        // minRank: 0 = any member, 3 = Sergeant+, etc.
        this.vehicleCatalog = [
            { model: 'police',    label: 'Police Cruiser',     minRank: 0 },
            { model: 'police2',   label: 'Police Buffalo',     minRank: 0 },
            { model: 'police3',   label: 'Police Interceptor', minRank: 1 },
            { model: 'policeb',   label: 'Police Bike',        minRank: 2 },
            { model: 'policeold1',label: 'Unmarked Cruiser',   minRank: 3 },
            { model: 'fbi',       label: 'FBI Suburban',       minRank: 4 },
        ];

        this.registerWardrobe();
        this.createWorldEntities();
    }

    registerWardrobe() {
        wardrobeManager.registerUniforms(this.id, {
            name: 'LSPD Wardrobe',
            wardrobePoint: this.hq.wardrobePoint,
            wardrobeDimension: this.hq.dimension,
            uniforms: {
                male: [
                    {
                        name: 'Cadet Uniform',
                        description: 'Standard issue cadet outfit',
                        minRank: 0,
                        components: [
                            { id: 11, drawable: 55,  texture: 0 },
                            { id: 3,  drawable: 14,  texture: 0 },
                            { id: 8,  drawable: 15,  texture: 0 },
                            { id: 4,  drawable: 25,  texture: 0 },
                            { id: 6,  drawable: 24,  texture: 0 },
                        ],
                        props: [{ id: 0, drawable: 46, texture: 0 }], // officer cap
                    },
                    {
                        name: 'Officer Uniform',
                        description: 'Full patrol officer uniform',
                        minRank: 1,
                        components: [
                            { id: 11, drawable: 55,  texture: 0 },
                            { id: 3,  drawable: 14,  texture: 0 },
                            { id: 8,  drawable: 15,  texture: 0 },
                            { id: 4,  drawable: 25,  texture: 0 },
                            { id: 6,  drawable: 24,  texture: 0 },
                        ],
                        props: [{ id: 0, drawable: 46, texture: 0 }],
                    },
                    {
                        name: 'Tactical Uniform',
                        description: 'Vest and tactical gear — Sergeant+',
                        minRank: 3,
                        components: [
                            { id: 11, drawable: 55,  texture: 0 },
                            { id: 3,  drawable: 179, texture: 4 }, // tactical vest
                            { id: 8,  drawable: 15,  texture: 0 },
                            { id: 4,  drawable: 25,  texture: 0 },
                            { id: 6,  drawable: 24,  texture: 0 },
                        ],
                        props: [],
                    },
                ],
                female: [
                    {
                        name: 'Cadet Uniform',
                        description: 'Standard issue cadet outfit',
                        minRank: 0,
                        components: [
                            { id: 11, drawable: 48,  texture: 0 },
                            { id: 3,  drawable: 14,  texture: 0 },
                            { id: 8,  drawable: 15,  texture: 0 },
                            { id: 4,  drawable: 34,  texture: 0 },
                            { id: 6,  drawable: 24,  texture: 0 },
                        ],
                        props: [{ id: 0, drawable: 46, texture: 0 }],
                    },
                    {
                        name: 'Officer Uniform',
                        description: 'Full patrol officer uniform',
                        minRank: 1,
                        components: [
                            { id: 11, drawable: 48,  texture: 0 },
                            { id: 3,  drawable: 14,  texture: 0 },
                            { id: 8,  drawable: 15,  texture: 0 },
                            { id: 4,  drawable: 34,  texture: 0 },
                            { id: 6,  drawable: 24,  texture: 0 },
                        ],
                        props: [{ id: 0, drawable: 46, texture: 0 }],
                    },
                    {
                        name: 'Tactical Uniform',
                        description: 'Vest and tactical gear — Sergeant+',
                        minRank: 3,
                        components: [
                            { id: 11, drawable: 48,  texture: 0 },
                            { id: 3,  drawable: 179, texture: 4 },
                            { id: 8,  drawable: 15,  texture: 0 },
                            { id: 4,  drawable: 34,  texture: 0 },
                            { id: 6,  drawable: 24,  texture: 0 },
                        ],
                        props: [],
                    },
                ],
            },
        });
    }

    createWorldEntities() {
        const blue = [0, 168, 255, 180];
        const green = [0, 255, 100, 150];

        // Exterior entrance
        mp.markers.new(1, new mp.Vector3(this.hq.exterior.x, this.hq.exterior.y, this.hq.exterior.z - 1.0), 1.0,
            { color: blue, dimension: 0 });
        const enterCol = mp.colshapes.newSphere(this.hq.exterior.x, this.hq.exterior.y, this.hq.exterior.z, 1.5, 0);
        enterCol.setVariable('interaction', { title: 'LSPD Mission Row', text: 'Enter HQ', event: 'faction:lspd:enter', requireOnFoot: true });

        // Interior exit
        mp.markers.new(1, new mp.Vector3(this.hq.interior.x, this.hq.interior.y, this.hq.interior.z - 1.0), 1.0,
            { color: blue, dimension: this.hq.dimension });
        const exitCol = mp.colshapes.newSphere(this.hq.interior.x, this.hq.interior.y, this.hq.interior.z, 1.5, this.hq.dimension);
        exitCol.setVariable('interaction', { title: 'LSPD Mission Row', text: 'Exit HQ', event: 'faction:lspd:exit', requireOnFoot: true });

        // Duty marker
        mp.markers.new(1, new mp.Vector3(this.hq.dutyPoint.x, this.hq.dutyPoint.y, this.hq.dutyPoint.z - 1.0), 1.0,
            { color: green, dimension: this.hq.dimension });

        // Wardrobe
        mp.markers.new(1, new mp.Vector3(this.hq.wardrobePoint.x, this.hq.wardrobePoint.y, this.hq.wardrobePoint.z - 1.0), 1.0,
            { color: blue, dimension: this.hq.dimension });
        const wardrobeCol = mp.colshapes.newSphere(this.hq.wardrobePoint.x, this.hq.wardrobePoint.y, this.hq.wardrobePoint.z, 1.5, this.hq.dimension);
        wardrobeCol.setVariable('interaction', { title: 'Wardrobe', text: 'Select Uniform', event: 'faction:wardrobe:open', requireOnFoot: true });

        // Garage
        mp.markers.new(36, this.garage.menuPoint, 1.0, { color: [0, 168, 255, 200], dimension: 0 });
        const garageCol = mp.colshapes.newSphere(this.garage.menuPoint.x, this.garage.menuPoint.y, this.garage.menuPoint.z, 1.5, 0);
        garageCol.setVariable('interaction', { title: 'LSPD Fleet', text: 'Open Garage', event: 'faction:lspd:garage', requireOnFoot: true });

        // Blip
        mp.blips.new(60, this.hq.exterior, { name: 'LSPD Mission Row', color: 29, shortRange: true });
    }
}

const instance = new LSPDFaction();
factionsManager.registerFaction(instance);

require('./events/vehicleManager')(instance);

function countDutyOfficers() {
    let count = 0;
    mp.players.forEach(p => {
        if (p.logged && p.factionId === instance.id && p.getVariable('factionDuty')) count++;
    });
    return count;
}

function syncDutyCountToClients(targetPlayer) {
    const dutyCount = countDutyOfficers();

    if (targetPlayer) {
        if (mp.players.exists(targetPlayer) && targetPlayer.logged) {
            targetPlayer.setVariable('lspdDutyCount', dutyCount);
        }
        return;
    }

    mp.players.forEach(p => {
        if (!p.logged) return;
        p.setVariable('lspdDutyCount', dutyCount);
    });
}

function canUseAutoSurrender(player) {
    return !!wantedManager.getWantedType(player) && countDutyOfficers() === 0;
}

function getSurrenderSentenceMinutes(player) {
    const now = Date.now();
    const entries = wantedManager.getWanted(player);

    let maxMinutes = 0;
    entries.forEach(function(entry) {
        if (!entry || entry.expiresAt <= now) return;
        const remMinutes = Math.ceil((entry.expiresAt - now) / 60000);
        if (remMinutes > maxMinutes) maxMinutes = remMinutes;
    });

    if (maxMinutes > 0) return maxMinutes;
    return jailManager.getRecommendedSentenceMinutes(player, 10);
}

mp.events.add('faction:lspd:enter', (player) => {
    const wantedType = wantedManager.getWantedType(player);

    if (wantedType) {
        if (canUseAutoSurrender(player)) {
            const sentenceMinutes = getSurrenderSentenceMinutes(player);
            wantedManager.clearAllWanted(player, 'surrendered (no officers on duty)');
            jailManager.sendToPrison(player, {
                forceRespawn: false,
                durationMinutes: sentenceMinutes,
                keepLonger: true,
            });
            player.outputChatBox('!{#ff4757}[LSPD] !{#ffffff}No officers were on duty. You surrendered and were booked into Bolingbroke for ' + sentenceMinutes + ' minute(s).');
            return;
        }

        if (player.factionId && player.factionId === instance.id) {
            return player.outputChatBox('!{#ff4757}[LSPD] !{#ffffff}You cannot enter HQ while wanted. Surrender first.');
        }

        return player.outputChatBox('!{#ff4757}[LSPD] !{#ffffff}Officers are on duty. Surrender directly to an officer.');
    }

    if (player.factionId && player.factionId === instance.id) {
        player.position = instance.hq.interior;
        player.dimension = instance.hq.dimension;
        return;
    }

    return player.outputChatBox('!{#ff4757}You are not a member of the LSPD.');
});

mp.events.add('faction:lspd:exit', (player) => {
    player.position = instance.hq.exterior;
    player.dimension = 0;
});

mp.events.add('faction:lspd:garage', (player) => {
    mp.events.call('faction:spawnLSPD', player);
});

mp.events.add('factionDutyChanged', () => {
    syncDutyCountToClients();
});

mp.events.add('server:spawn:player', (player) => {
    syncDutyCountToClients(player);
});

mp.events.add('playerQuit', () => {
    setTimeout(() => syncDutyCountToClients(), 0);
});

setTimeout(() => syncDutyCountToClients(), 1500);

module.exports = instance;