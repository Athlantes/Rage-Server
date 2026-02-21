// packages/factions/taxi/index.js
const Faction = require('../Faction');
const factionsManager = require('../factionsManager');

class TaxiFaction extends Faction {
    constructor() {
        super(1, "Los Santos Transit", "PEACEFUL", ["Trainee", "Cabbie", "Dispatcher", "Manager", "Owner"]);

        this.hq = {
            exterior: new mp.Vector3(895.0, -179.0, 74.7),     
            interior: new mp.Vector3(266.1, -1007.6, -101.0),  
            dutyPoint: new mp.Vector3(268.0, -1007.0, -101.0), 
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

        this.createWorldEntities();
    }

    createWorldEntities() {
        mp.markers.new(1, new mp.Vector3(this.hq.exterior.x, this.hq.exterior.y, this.hq.exterior.z - 1.0), 1.0, { color: [255, 204, 0, 150], dimension: 0 });
        let enterCol = mp.colshapes.newSphere(this.hq.exterior.x, this.hq.exterior.y, this.hq.exterior.z, 1.5, 0);
        enterCol.setVariable('interaction', { title: "Downtown Cab Co.", text: "Enter HQ", event: "faction:taxi:enter", requireOnFoot: true });

        mp.markers.new(1, new mp.Vector3(this.hq.interior.x, this.hq.interior.y, this.hq.interior.z - 1.0), 1.0, { color: [255, 204, 0, 150], dimension: this.hq.dimension });
        let exitCol = mp.colshapes.newSphere(this.hq.interior.x, this.hq.interior.y, this.hq.interior.z, 1.5, this.hq.dimension);
        exitCol.setVariable('interaction', { title: "Downtown Cab Co.", text: "Exit HQ", event: "faction:taxi:exit", requireOnFoot: true });

        mp.markers.new(1, new mp.Vector3(this.hq.dutyPoint.x, this.hq.dutyPoint.y, this.hq.dutyPoint.z - 1.0), 1.0, { color: [0, 255, 0, 150], dimension: this.hq.dimension });

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