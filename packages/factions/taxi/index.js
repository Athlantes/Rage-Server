// packages/factions/taxi/index.js
require('./taxiDispatch');

const Faction = require('../Faction');
const factionsManager = require('../factionsManager');
const wardrobeManager = require('../wardrobe/wardrobeManager');

class TaxiFaction extends Faction {
    constructor() {
        super(1, "Los Santos Transit", "PEACEFUL", ["Trainee", "Cabbie", "Dispatcher", "Manager", "Owner"], '#ffc300');

        this.hq = {
            exterior: new mp.Vector3(895.0, -179.0, 74.7),     
            interior: new mp.Vector3(266.1, -1007.6, -101.0),  
            dutyPoint: new mp.Vector3(268.0, -1007.0, -101.0),
            wardrobePoint: new mp.Vector3(264.49, -996.82, -99.01),
            dimension: 101 
        };

        // NEW: Array of spawn spots
        this.garage = {
            menuPoint: new mp.Vector3(903.22, -173.49, 73.42),   
            spawnPoints: [
                { x: 916.25, y: -170.71, z: 74.04, h: 98.30 },
                { x: 918.33, y: -167.23, z: 74.21, h: 102.62 },
                { x: 920.82, y: -163.56, z: 74.43, h: 99.81 },
                { x: 913.71, y: -159.65, z: 74.39, h: -164.08 },
                { x: 911.41, y: -163.59, z: 73.96, h: -162.49 },
                { x: 899.38, y: -180.70, z: 73.44, h: -122.39 },
                { x: 897.42, y: -183.63, z: 73.37, h: -122.71 },
                { x: 908.76, y: -183.32, z: 73.77, h: 57.58 },
                { x: 906.70, y: -186.10, z: 73.63, h: 58.73 },
                { x: 904.98, y: -188.96, z: 73.44, h: 58.37 },
                { x: 903.37, y: -191.63, z: 73.41, h: 58.51 }
            ]
        };

        this.registerWardrobe();
        this.createWorldEntities();
    }

    // ── Wardrobe: Register taxi uniform options ───────────────────────────────
    registerWardrobe() {
        wardrobeManager.registerUniforms(this.id, {
            name: 'Taxi Wardrobe',
            wardrobePoint: this.hq.wardrobePoint,
            wardrobeDimension: this.hq.dimension,
            uniforms: {
                // ── Male Uniforms (4) ─────────────────────────────────────────
                male: [
                    {
                        name: 'Classic Cabbie',
                        description: 'Yellow polo shirt with dark trousers',
                        components: [
                            { id: 11, drawable: 230, texture: 5 },  // Top: polo yellow
                            { id: 3,  drawable: 11,  texture: 0 },  // Torso
                            { id: 8,  drawable: 15,  texture: 0 },  // Undershirt: none
                            { id: 4,  drawable: 35,  texture: 0 },  // Legs: dark trousers
                            { id: 6,  drawable: 10,  texture: 0 },  // Shoes: black shoes
                        ],
                        props: []
                    },
                    {
                        name: 'Professional Driver',
                        description: 'White dress shirt with black pants',
                        components: [
                            { id: 11, drawable: 31,  texture: 0 },  // Top: dress shirt
                            { id: 3,  drawable: 4,   texture: 0 },  // Torso
                            { id: 8,  drawable: 15,  texture: 0 },  // Undershirt
                            { id: 4,  drawable: 28,  texture: 0 },  // Legs: black pants
                            { id: 6,  drawable: 10,  texture: 0 },  // Shoes: loafers
                        ],
                        props: []
                    },
                    {
                        name: 'Casual Transit',
                        description: 'Branded t-shirt with jeans',
                        components: [
                            { id: 11, drawable: 15,  texture: 0 },  // Top: t-shirt
                            { id: 3,  drawable: 15,  texture: 0 },  // Torso
                            { id: 8,  drawable: 15,  texture: 0 },  // Undershirt
                            { id: 4,  drawable: 0,   texture: 5 },  // Legs: jeans
                            { id: 6,  drawable: 1,   texture: 0 },  // Shoes: sneakers
                        ],
                        props: []
                    },
                    {
                        name: 'Formal Chauffeur',
                        description: 'Full suit with tie — executive look',
                        components: [
                            { id: 11, drawable: 29,  texture: 0 },  // Top: suit jacket
                            { id: 3,  drawable: 4,   texture: 0 },  // Torso
                            { id: 8,  drawable: 31,  texture: 0 },  // Undershirt: shirt + tie
                            { id: 4,  drawable: 28,  texture: 0 },  // Legs: suit trousers
                            { id: 6,  drawable: 10,  texture: 0 },  // Shoes: dress shoes
                        ],
                        props: []
                    },
                ],
                // ── Female Uniforms (4) ───────────────────────────────────────
                female: [
                    {
                        name: 'Classic Cabbie',
                        description: 'Yellow polo shirt with dark trousers',
                        components: [
                            { id: 11, drawable: 230, texture: 5 },  // Top: polo yellow
                            { id: 3,  drawable: 7,   texture: 0 },  // Torso
                            { id: 8,  drawable: 15,  texture: 0 },  // Undershirt
                            { id: 4,  drawable: 34,  texture: 0 },  // Legs: dark trousers
                            { id: 6,  drawable: 29,  texture: 0 },  // Shoes: black shoes
                        ],
                        props: []
                    },
                    {
                        name: 'Professional Driver',
                        description: 'White blouse with black pants',
                        components: [
                            { id: 11, drawable: 7,   texture: 0 },  // Top: blouse
                            { id: 3,  drawable: 3,   texture: 0 },  // Torso
                            { id: 8,  drawable: 15,  texture: 0 },  // Undershirt
                            { id: 4,  drawable: 34,  texture: 0 },  // Legs: black pants
                            { id: 6,  drawable: 29,  texture: 0 },  // Shoes: heels
                        ],
                        props: []
                    },
                    {
                        name: 'Casual Transit',
                        description: 'Branded t-shirt with jeans',
                        components: [
                            { id: 11, drawable: 15,  texture: 0 },  // Top: t-shirt
                            { id: 3,  drawable: 15,  texture: 0 },  // Torso
                            { id: 8,  drawable: 15,  texture: 0 },  // Undershirt
                            { id: 4,  drawable: 1,   texture: 5 },  // Legs: jeans
                            { id: 6,  drawable: 3,   texture: 0 },  // Shoes: sneakers
                        ],
                        props: []
                    },
                    {
                        name: 'Formal Chauffeur',
                        description: 'Business suit — executive look',
                        components: [
                            { id: 11, drawable: 7,   texture: 2 },  // Top: suit jacket
                            { id: 3,  drawable: 3,   texture: 0 },  // Torso
                            { id: 8,  drawable: 31,  texture: 0 },  // Undershirt: blouse
                            { id: 4,  drawable: 34,  texture: 0 },  // Legs: suit trousers
                            { id: 6,  drawable: 29,  texture: 0 },  // Shoes: dress shoes
                        ],
                        props: []
                    },
                ],
            }
        });
    }

    createWorldEntities() {
        mp.markers.new(1, new mp.Vector3(this.hq.exterior.x, this.hq.exterior.y, this.hq.exterior.z - 1.0), 1.0, { color: [255, 204, 0, 150], dimension: 0 });
        let enterCol = mp.colshapes.newSphere(this.hq.exterior.x, this.hq.exterior.y, this.hq.exterior.z, 1.5, 0);
        enterCol.setVariable('interaction', { title: "Downtown Cab Co.", text: "Enter HQ", event: "faction:taxi:enter", requireOnFoot: true });

        mp.markers.new(1, new mp.Vector3(this.hq.interior.x, this.hq.interior.y, this.hq.interior.z - 1.0), 1.0, { color: [255, 204, 0, 150], dimension: this.hq.dimension });
        let exitCol = mp.colshapes.newSphere(this.hq.interior.x, this.hq.interior.y, this.hq.interior.z, 1.5, this.hq.dimension);
        exitCol.setVariable('interaction', { title: "Downtown Cab Co.", text: "Exit HQ", event: "faction:taxi:exit", requireOnFoot: true });

        mp.markers.new(1, new mp.Vector3(this.hq.dutyPoint.x, this.hq.dutyPoint.y, this.hq.dutyPoint.z - 1.0), 1.0, { color: [0, 255, 0, 150], dimension: this.hq.dimension });

        // Wardrobe marker & colshape
        mp.markers.new(1, new mp.Vector3(this.hq.wardrobePoint.x, this.hq.wardrobePoint.y, this.hq.wardrobePoint.z - 1.0), 1.0, { color: [0, 150, 255, 150], dimension: this.hq.dimension });
        let wardrobeCol = mp.colshapes.newSphere(this.hq.wardrobePoint.x, this.hq.wardrobePoint.y, this.hq.wardrobePoint.z, 1.5, this.hq.dimension);
        wardrobeCol.setVariable('interaction', { title: "Wardrobe", text: "Select Uniform", event: "faction:wardrobe:open", requireOnFoot: true });

        mp.markers.new(36, this.garage.menuPoint, 1.0, { color: [255, 204, 0, 200], dimension: 0 }); 
        let garageCol = mp.colshapes.newSphere(this.garage.menuPoint.x, this.garage.menuPoint.y, this.garage.menuPoint.z, 1.5, 0);
        garageCol.setVariable('interaction', { title: "Taxi Fleet", text: "Open Garage", event: "faction:taxi:garage", requireOnFoot: true });

        mp.blips.new(198, this.hq.exterior, { name: "Downtown Cab Co.", color: 66, shortRange: true });
    }
}

const instance = new TaxiFaction();
factionsManager.registerFaction(instance);

require('./events/vehicleManager')(instance);

mp.events.add("faction:taxi:enter", (player) => {
    if (!player.factionId || player.factionId !== instance.id) {
        return player.outputChatBox('!{#ff4757}You are not a member of this faction.');
    }
    player.position = instance.hq.interior;
    player.dimension = instance.hq.dimension;
});

mp.events.add("faction:taxi:exit", (player) => {
    player.position = instance.hq.exterior;
    player.dimension = 0;
});

mp.events.add("faction:taxi:garage", (player) => {
    mp.events.call("faction:spawnTaxi", player); 
});

module.exports = instance;