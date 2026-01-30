// client_packages/ui/WebMap/js/scripts.js

var map;
var layerGroups = {
    blips: L.layerGroup(),
    player: L.layerGroup()
};

// GTA V Coordinates Calibration (Standard 8192px map)
const center_x = 117.3;
const center_y = 172.8;
const scale_x = 0.02072;
const scale_y = 0.0205;

var CUSTOM_CRS = L.extend({}, L.CRS.Simple, {
    projection: L.Projection.LonLat,
    scale: function(zoom) { return Math.pow(2, zoom); },
    zoom: function(sc) { return Math.log(sc) / 0.69314718056; },
    distance: function(pos1, pos2) {
        var x_diff = pos2.lng - pos1.lng;
        var y_diff = pos2.lat - pos1.lat;
        return Math.sqrt(x_diff * x_diff + y_diff * y_diff);
    },
    transformation: new L.Transformation(scale_x, center_x, -scale_y, center_y),
    infinite: true
});

$(document).ready(function() {
    // Initialize map with your specific zoom levels (2 through 7)
    map = L.map('map', {
        crs: CUSTOM_CRS,
        minZoom: 2,   // Matches your lowest folder "2"
        maxZoom: 7,   // Matches your highest folder "7"
        zoom: 3,
        preferCanvas: true,
        center: [0, 0],
        zoomControl: true, // Styled by your newstyle.css
        attributionControl: false
    });

    // Point to your folder: images/map/{zoom}/{x}/{y}.png
    L.tileLayer('images/map/{z}/{x}x{y}.png', {
        minZoom: 2,
        maxZoom: 7,
        noWrap: true,
        tms: true // GTA V tiles often use inverted Y-axis numbering
    }).addTo(map);

    layerGroups.blips.addTo(map);
    layerGroups.player.addTo(map);

    // Right-click to set GPS waypoint in-game
    map.on('contextmenu', function(e) {
        if('mp' in window) {
            mp.trigger('client:setMapWaypoint', e.latlng.lng, e.latlng.lat);
        }
    });
});

// Called from client-side RageMP script
function initializeMapData(blipsJson, playerJson) {
    const blips = JSON.parse(blipsJson);
    const player = JSON.parse(playerJson);

    // 1. Update Player Position & Direction
    layerGroups.player.clearLayers();
    var playerIcon = L.divIcon({
        className: 'player-marker',
        html: `<img src="images/blips/job-1.png" style="transform: rotate(${player.angle}deg); width: 22px;">`,
        iconSize: [22, 22]
    });
    L.marker([player.y, player.x], {icon: playerIcon, zIndexOffset: 1000}).addTo(layerGroups.player);

    // 2. Update Dynamic Game Blips (Using your single image)
    layerGroups.blips.clearLayers();
    var defaultBlip = L.icon({
        iconUrl: 'images/blips/job-1.png', // Uses your available blip image
        iconSize: [20, 20],
        popupAnchor: [0, -10]
    });

    blips.forEach(blip => {
        L.marker([blip.y, blip.x], {icon: defaultBlip})
         .bindPopup(`<b>${blip.name}</b>`)
         .addTo(layerGroups.blips);
    });
}