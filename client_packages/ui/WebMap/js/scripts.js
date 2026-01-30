// client_packages/ui/WebMap/js/scripts.js

// 1. Configuration - Adjust these if your map is offset
const MAP_CONFIG = {
    minZoom: 2,
    maxZoom: 7,
    tileSize: 256, // Standard tile size
    center: [0, 0],
    zoom: 3
};

// 2. Define the GTA V Coordinate Reference System (Standard 8192x8192 map)
const center_x = 117.3;
const center_y = 172.8;
const scale_x = 0.02072;
const scale_y = 0.0205;

const GTA_CRS = L.extend({}, L.CRS.Simple, {
    projection: L.Projection.LonLat,
    scale: function(zoom) {
        return Math.pow(2, zoom);
    },
    zoom: function(sc) {
        return Math.log(sc) / 0.69314718056;
    },
    distance: function(pos1, pos2) {
        var x_diff = pos2.lng - pos1.lng;
        var y_diff = pos2.lat - pos1.lat;
        return Math.sqrt(x_diff * x_diff + y_diff * y_diff);
    },
    // This transformation maps Game Coords (x,y) to Map Pixels
    transformation: new L.Transformation(scale_x, center_x, -scale_y, center_y),
    infinite: true
});

// 3. Initialize Map
var map = L.map('map', {
    crs: GTA_CRS,
    minZoom: MAP_CONFIG.minZoom,
    maxZoom: MAP_CONFIG.maxZoom,
    zoom: MAP_CONFIG.zoom,
    center: MAP_CONFIG.center,
    zoomControl: false, // We'll add it manually or let CSS handle it
    attributionControl: false,
    preferCanvas: true
});

// 4. The Tile Layer (CRITICAL FIXES HERE)
L.tileLayer('images/map/{z}/{x}x{y}.png', {
    minZoom: MAP_CONFIG.minZoom,
    maxZoom: MAP_CONFIG.maxZoom,
    noWrap: true,
    tms: false, // <--- CHANGED TO FALSE. Try 'true' if map is upside down, but 'false' is standard.
    errorTileUrl: '', // Optional: path to a "missing tile" image
}).addTo(map).on('tileerror', function(e) {
    // This will print to console exactly which file is missing
    console.error("Missing Tile:", e.url);
    document.getElementById('debug-overlay').style.display = 'block';
    document.getElementById('debug-overlay').innerText = "Missing: " + e.url;
});

// 5. Blips and Player Layers
var layerGroups = {
    blips: L.layerGroup().addTo(map),
    player: L.layerGroup().addTo(map)
};

// 6. Blip Logic
function initializeMapData(blipsJson, playerJson) {
    // Safe parsing
    let blips = [], player = {};
    try {
        blips = JSON.parse(blipsJson);
        player = JSON.parse(playerJson);
    } catch(e) {
        console.error("JSON Parse Error:", e);
        return;
    }

    // Update Player
    layerGroups.player.clearLayers();
    if(player) {
        var playerIcon = L.divIcon({
            className: 'player-marker',
            html: `<img src="images/blips/job-1.png" style="transform: rotate(${player.angle}deg); width: 22px; height: 22px;">`,
            iconSize: [22, 22],
            iconAnchor: [11, 11] // Centers the icon
        });
        L.marker([player.y, player.x], {icon: playerIcon, zIndexOffset: 1000}).addTo(layerGroups.player);
        
        // Optional: Center map on player first time
        // map.setView([player.y, player.x], map.getZoom());
    }

    // Update Blips
    layerGroups.blips.clearLayers();
    var defaultBlipIcon = L.icon({
        iconUrl: 'images/blips/job-1.png',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10]
    });

    blips.forEach(blip => {
        L.marker([blip.y, blip.x], {icon: defaultBlipIcon})
         .bindPopup(`<b>${blip.name}</b>`)
         .addTo(layerGroups.blips);
    });
}

// Right click waypoint
map.on('contextmenu', function(e) {
    if('mp' in window) {
        mp.trigger('client:setMapWaypoint', e.latlng.lng, e.latlng.lat);
    }
});