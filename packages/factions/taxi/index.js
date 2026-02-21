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

        this.garage = {
            menuPoint: new mp.Vector3(900.0, -170.0, 74.0),   
            spawnPoint: new mp.Vector3(905.0, -165.0, 74.0),  
            spawnHeading: 90.0
        };

        this.createWorldEntities();
    }

    createWorldEntities() {
        // 1. Entrance (Outside)
        mp.markers.new(1, new mp.Vector3(this.hq.exterior.x, this.hq.exterior.y, this.hq.exterior.z - 1.0), 1.0, { color: [255, 204, 0, 150], dimension: 0 });
        let enterCol = mp.colshapes.newSphere(this.hq.exterior.x, this.hq.exterior.y, this.hq.exterior.z, 1.5, 0);
        enterCol.setVariable('interaction', {
            title: "Downtown Cab Co.",
            text: "Enter HQ",
            event: "faction:taxi:enter",
            requireOnFoot: true
        });

        // 2. Exit (Inside)
        mp.markers.new(1, new mp.Vector3(this.hq.interior.x, this.hq.interior.y, this.hq.interior.z - 1.0), 1.0, { color: [255, 204, 0, 150], dimension: this.hq.dimension });
        let exitCol = mp.colshapes.newSphere(this.hq.interior.x, this.hq.interior.y, this.hq.interior.z, 1.5, this.hq.dimension);
        exitCol.setVariable('interaction', {
            title: "Downtown Cab Co.",
            text: "Exit HQ",
            event: "faction:taxi:exit",
            requireOnFoot: true
        });

        // 3. Duty Locker (Inside)
        mp.markers.new(1, new mp.Vector3(this.hq.dutyPoint.x, this.hq.dutyPoint.y, this.hq.dutyPoint.z - 1.0), 1.0, { color: [0, 255, 0, 150], dimension: this.hq.dimension });
        let dutyCol = mp.colshapes.newSphere(this.hq.dutyPoint.x, this.hq.dutyPoint.y, this.hq.dutyPoint.z, 1.5, this.hq.dimension);
        dutyCol.setVariable('interaction', {
            title: "Locker Room",
            text: "Toggle Duty",
            event: "faction:taxi:toggleDuty",
            requireOnFoot: true
        });

        // 4. Garage Marker (Outside)
        mp.markers.new(36, this.garage.menuPoint, 1.0, { color: [255, 204, 0, 200], dimension: 0 }); 
        let garageCol = mp.colshapes.newSphere(this.garage.menuPoint.x, this.garage.menuPoint.y, this.garage.menuPoint.z, 1.5, 0);
        garageCol.setVariable('interaction', {
            title: "Taxi Fleet",
            text: "Open Garage",
            event: "faction:taxi:garage",
            requireOnFoot: true
        });

        mp.blips.new(198, this.hq.exterior, { name: "Downtown Cab Co.", color: 66, shortRange: true });
    }
}

const instance = new TaxiFaction();
factionsManager.registerFaction(instance);

require('./events/duty')(instance);
require('./events/vehicleManager')(instance);

// --- Remote Events triggered by client interaction.js ---

mp.events.add("faction:taxi:enter", (player) => {
    player.position = instance.hq.interior;
    player.dimension = instance.hq.dimension;
});

mp.events.add("faction:taxi:exit", (player) => {
    player.position = instance.hq.exterior;
    player.dimension = 0;
});

mp.events.add("faction:taxi:garage", (player) => {
    // Calls the vehicle manager spawn logic
    mp.events.call("faction:spawnTaxi", player); 
});

module.exports = instance;