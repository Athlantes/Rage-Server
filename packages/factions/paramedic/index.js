// packages/factions/paramedic/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Paramedic Faction (factionId: 3)
// HQ: Pillbox Hill Medical Center
// Ranks: Trainee, EMT, Paramedic, Senior Paramedic, EMS Captain, Chief
// ─────────────────────────────────────────────────────────────────────────────

require('./paramedicDispatch');

const Faction       = require('../Faction');
const factionsManager = require('../factionsManager');
const wardrobeManager = require('../wardrobe/wardrobeManager');
const { HOSPITALS }   = require('../../data/hospitals');

class ParamedicFaction extends Faction {
    constructor() {
        super(
            3,
            'Los Santos EMS',
            'PEACEFUL',
            ['Trainee', 'EMT', 'Paramedic', 'Senior Paramedic', 'EMS Captain', 'Chief'],
            '#ff4757'
        );

        this.hq = {
            exterior:     new mp.Vector3(297.7,   -591.8,  43.3),
            interior:     new mp.Vector3(311.4,   -607.2,  43.3),
            dutyPoint:    new mp.Vector3(313.5,   -605.8,  43.3),
            wardrobePoint: new mp.Vector3(309.5,  -603.9,  43.3),
            dimension:    103,
        };

        this.garage = {
            menuPoint:  new mp.Vector3(292.5, -605.0, 43.3),
            spawnPoints: [
                { x: 281.9, y: -604.7, z: 43.3, h: 90.0  },
                { x: 281.9, y: -600.5, z: 43.3, h: 90.0  },
                { x: 281.9, y: -596.5, z: 43.3, h: 90.0  },
                { x: 281.9, y: -592.5, z: 43.3, h: 90.0  },
            ],
        };

        this.registerWardrobe();
        this.createWorldEntities();
        this.createHospitalBlips();
    }

    // ── Wardrobe ─────────────────────────────────────────────────────────────
    registerWardrobe() {
        wardrobeManager.registerUniforms(this.id, {
            name: 'EMS Wardrobe',
            wardrobePoint:     this.hq.wardrobePoint,
            wardrobeDimension: this.hq.dimension,
            uniforms: {
                male: [
                    {
                        name: 'Paramedic Uniform',
                        description: 'Standard high-vis paramedic jumpsuit',
                        components: [
                            { id: 11, drawable: 252, texture: 0 }, // Top: EMS uniform
                            { id: 3,  drawable: 11,  texture: 0 }, // Torso
                            { id: 8,  drawable: 15,  texture: 0 }, // Undershirt
                            { id: 4,  drawable: 96,  texture: 0 }, // Legs: cargo pants
                            { id: 6,  drawable: 24,  texture: 0 }, // Shoes: boots
                        ],
                        props: [],
                    },
                    {
                        name: 'Senior Paramedic',
                        description: 'Dark blue senior EMS uniform',
                        components: [
                            { id: 11, drawable: 252, texture: 1 },
                            { id: 3,  drawable: 11,  texture: 0 },
                            { id: 8,  drawable: 15,  texture: 0 },
                            { id: 4,  drawable: 96,  texture: 1 },
                            { id: 6,  drawable: 24,  texture: 0 },
                        ],
                        props: [],
                    },
                    {
                        name: 'EMS Captain',
                        description: 'White captain uniform with rank insignia',
                        components: [
                            { id: 11, drawable: 252, texture: 2 },
                            { id: 3,  drawable: 4,   texture: 0 },
                            { id: 8,  drawable: 58,  texture: 0 },
                            { id: 4,  drawable: 28,  texture: 0 },
                            { id: 6,  drawable: 24,  texture: 0 },
                        ],
                        props: [],
                    },
                ],
                female: [
                    {
                        name: 'Paramedic Uniform',
                        description: 'Standard high-vis paramedic jumpsuit',
                        components: [
                            { id: 11, drawable: 252, texture: 0 },
                            { id: 3,  drawable: 7,   texture: 0 },
                            { id: 8,  drawable: 15,  texture: 0 },
                            { id: 4,  drawable: 96,  texture: 0 },
                            { id: 6,  drawable: 52,  texture: 0 },
                        ],
                        props: [],
                    },
                    {
                        name: 'Senior Paramedic',
                        description: 'Dark blue senior EMS uniform',
                        components: [
                            { id: 11, drawable: 252, texture: 1 },
                            { id: 3,  drawable: 7,   texture: 0 },
                            { id: 8,  drawable: 15,  texture: 0 },
                            { id: 4,  drawable: 96,  texture: 1 },
                            { id: 6,  drawable: 52,  texture: 0 },
                        ],
                        props: [],
                    },
                    {
                        name: 'EMS Captain',
                        description: 'White captain uniform with rank insignia',
                        components: [
                            { id: 11, drawable: 252, texture: 2 },
                            { id: 3,  drawable: 3,   texture: 0 },
                            { id: 8,  drawable: 15,  texture: 0 },
                            { id: 4,  drawable: 34,  texture: 0 },
                            { id: 6,  drawable: 52,  texture: 0 },
                        ],
                        props: [],
                    },
                ],
            },
        });
    }

    // ── World entities ────────────────────────────────────────────────────────
    createWorldEntities() {
        const red = [255, 71, 87, 180];
        const grn = [0,   200, 100, 180];
        const blu = [0,   150, 255, 180];

        // ── HQ exterior marker + colshape ────────────────────────────────────
        mp.markers.new(1, new mp.Vector3(this.hq.exterior.x, this.hq.exterior.y, this.hq.exterior.z - 1.0), 1.0, { color: red, dimension: 0 });
        const enterCol = mp.colshapes.newSphere(this.hq.exterior.x, this.hq.exterior.y, this.hq.exterior.z, 1.5, 0);
        enterCol.setVariable('interaction', { title: 'Los Santos EMS', text: 'Enter HQ', event: 'faction:ems:enter', requireOnFoot: true });

        // ── HQ interior exit ─────────────────────────────────────────────────
        mp.markers.new(1, new mp.Vector3(this.hq.interior.x, this.hq.interior.y, this.hq.interior.z - 1.0), 1.0, { color: red, dimension: this.hq.dimension });
        const exitCol = mp.colshapes.newSphere(this.hq.interior.x, this.hq.interior.y, this.hq.interior.z, 1.5, this.hq.dimension);
        exitCol.setVariable('interaction', { title: 'Los Santos EMS', text: 'Exit HQ', event: 'faction:ems:exit', requireOnFoot: true });

        // ── Duty marker ──────────────────────────────────────────────────────
        mp.markers.new(1, new mp.Vector3(this.hq.dutyPoint.x, this.hq.dutyPoint.y, this.hq.dutyPoint.z - 1.0), 1.0, { color: grn, dimension: this.hq.dimension });

        // ── Wardrobe marker & colshape ───────────────────────────────────────
        mp.markers.new(1, new mp.Vector3(this.hq.wardrobePoint.x, this.hq.wardrobePoint.y, this.hq.wardrobePoint.z - 1.0), 1.0, { color: blu, dimension: this.hq.dimension });
        const wardCol = mp.colshapes.newSphere(this.hq.wardrobePoint.x, this.hq.wardrobePoint.y, this.hq.wardrobePoint.z, 1.5, this.hq.dimension);
        wardCol.setVariable('interaction', { title: 'Wardrobe', text: 'Select Uniform', event: 'faction:wardrobe:open', requireOnFoot: true });

        // ── Garage marker & colshape ─────────────────────────────────────────
        mp.markers.new(36, this.garage.menuPoint, 1.0, { color: [255, 71, 87, 220], dimension: 0 });
        const garageCol = mp.colshapes.newSphere(this.garage.menuPoint.x, this.garage.menuPoint.y, this.garage.menuPoint.z, 1.5, 0);
        garageCol.setVariable('interaction', { title: 'EMS Fleet', text: 'Open Garage', event: 'faction:ems:garage', requireOnFoot: true });

        // ── HQ blip ──────────────────────────────────────────────────────────
        mp.blips.new(61, this.hq.exterior, { name: 'Los Santos EMS HQ', color: 1, shortRange: true, scale: 1.0 });
    }

    // ── Hospital blips (visible for all players) ──────────────────────────────
    createHospitalBlips() {
        for (const hospital of HOSPITALS) {
            mp.blips.new(61,
                new mp.Vector3(hospital.coords.x, hospital.coords.y, hospital.coords.z),
                {
                    name:       hospital.blipName,
                    color:      1,     // Red
                    shortRange: true,
                    scale:      0.9,
                }
            );
        }
    }
}

const instance = new ParamedicFaction();
factionsManager.registerFaction(instance);

// ── Faction events ───────────────────────────────────────────────────────────

mp.events.add('faction:ems:enter', (player) => {
    if (!player.factionId || player.factionId !== instance.id) {
        return player.outputChatBox('!{#ff4757}You are not a member of Los Santos EMS.');
    }
    player.position = instance.hq.interior;
    player.dimension = instance.hq.dimension;
});

mp.events.add('faction:ems:exit', (player) => {
    player.position = instance.hq.exterior;
    player.dimension = 0;
});

mp.events.add('faction:ems:garage', (player) => {
    mp.events.call('faction:spawnAmbulance', player);
});

// ── Vehicle spawn handler ─────────────────────────────────────────────────────
mp.events.add('faction:spawnAmbulance', (player) => {
    if (!player.factionId || player.factionId !== instance.id) {
        return player.outputChatBox('!{#ff4757}You are not a member of Los Santos EMS.');
    }
    if (!player.getVariable('factionDuty')) {
        return player.outputChatBox('!{#ff4757}You must be on duty to spawn a vehicle.');
    }

    const spawnPoints = instance.garage.spawnPoints;
    const sp = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    const veh = mp.vehicles.new('ambulance', new mp.Vector3(sp.x, sp.y, sp.z), {
        heading:   sp.h,
        dimension: 0,
        numberPlate: 'EMS ' + Math.floor(Math.random() * 900 + 100),
    });
    veh.setVariable('factionId', instance.id);

    player.call('client:warpIntoVehicle', [veh.id, -1]);
    player.outputChatBox('!{#ff4757}[EMS] !{#ffffff}Ambulance deployed.');
});

// ── Duty change event — update down state medic count ────────────────────────
mp.events.add('factionDutyChanged', (player) => {
    if (player.factionId === instance.id) {
        // Sync duty state to client so it can show/hide downed blips
        const onDuty = player.getVariable('factionDuty') ? true : false;
        player.call('client:faction:dutyState', [3, onDuty]);
        mp.events.call('paramedic:dutyChanged', player);
    }
});

module.exports = instance;
