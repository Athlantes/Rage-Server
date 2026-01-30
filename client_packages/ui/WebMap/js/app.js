// client_packages/ui/WebMap/js/app.js

// --- Configuration ---
const MapConfig = {
    minZoom: 2,
    maxZoom: 7,
    initialZoom: 3,
    tileSize: 256,
    centerOffset: { x: 0, y: 0 } // Adjust if map is slightly off-center
};

// --- GTA V Coordinate Reference System (CRS) ---
// Maps GTA V game coordinates (roughly -4000 to 4000) to Leaflet map points.
const center = [0, 0]; 
const RealmMap = L.extend({}, L.CRS.Simple, {
    projection: L.Projection.LonLat,
    transformation: new L.Transformation(0.02072, 0, -0.02072, 0), // Standard GTA V Scale
    scale: function(zoom) {
        return Math.pow(2, zoom);
    },
    zoom: function(scale) {
        return Math.log(scale) / 0.69314718056;
    },
    distance: function(latlng1, latlng2) {
        const dx = latlng2.lng - latlng1.lng;
        const dy = latlng2.lat - latlng1.lat;
        return Math.sqrt(dx * dx + dy * dy);
    },
    infinite: true
});

// --- Initialize Map ---
const map = L.map('map', {
    crs: RealmMap,
    minZoom: MapConfig.minZoom,
    maxZoom: MapConfig.maxZoom,
    zoomControl: false, // We hide default controls for a cleaner look
    attributionControl: false,
    preferCanvas: true
});

map.setView(center, MapConfig.initialZoom);

// --- Tile Layer ---
// Loads tiles from images/map/{z}/{x}x{y}.png
L.tileLayer('images/map/{z}/{x}x{y}.png', {
    minZoom: MapConfig.minZoom,
    maxZoom: MapConfig.maxZoom,
    noWrap: true,
    tms: true, // Set to true if Y-axis is inverted in your tiles (Standard for GTA V generators)
    tileSize: MapConfig.tileSize
}).addTo(map);

// --- Layers & Icons ---
const layers = {
    blips: L.layerGroup().addTo(map),
    player: L.layerGroup().addTo(map)
};

const Icons = {
    Player: L.divIcon({
        className: 'player-marker-container',
        html: '<img src="images/blips/job-1.png" class="player-icon" />', // Ensure you have an arrow icon
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    }),
    Standard: L.icon({
        iconUrl: 'images/blips/job-1.png', // Default blip icon
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10]
    })
};

// --- External API (Called by RageMP Client) ---

// 1. Update Map Data (Blips & Player)
// Usage in C#/JS: browser.execute(`updateMapData('${blipsJson}', '${playerJson}')`);
window.updateMapData = function(blipsJson, playerJson) {
    try {
        const blips = JSON.parse(blipsJson);
        const player = JSON.parse(playerJson);

        updatePlayerMarker(player);
        updateBlips(blips);
    } catch (e) {
        console.error("Map Data Parse Error:", e);
    }
};

// 2. Helper to update just the player (for smoother movement)
let playerMarker = null;
function updatePlayerMarker(playerData) {
    if (!playerData) return;

    // Invert Y for Leaflet if needed (GTA V Y is usually Up, Leaflet Lat is Up)
    const latLng = [playerData.y, playerData.x];

    if (!playerMarker) {
        playerMarker = L.marker(latLng, { icon: Icons.Player, zIndexOffset: 1000 }).addTo(layers.player);
    } else {
        playerMarker.setLatLng(latLng);
        
        // Rotate the icon using CSS transform
        const iconElement = document.querySelector('.player-icon');
        if (iconElement) {
            iconElement.style.transform = `rotate(${playerData.heading || 0}deg)`;
        }
    }
}

// 3. Helper to update blips
function updateBlips(blipData) {
    layers.blips.clearLayers();
    
    if (!Array.isArray(blipData)) return;

    blipData.forEach(blip => {
        // You can switch icons based on blip.type here if you have multiple images
        L.marker([blip.y, blip.x], { icon: Icons.Standard })
            .bindPopup(`<b>${blip.name}</b>`)
            .addTo(layers.blips);
    });
}

// 4. Center Map Helper
window.centerOnPlayer = function() {
    if (playerMarker) {
        map.setView(playerMarker.getLatLng(), 5); // Zoom level 5
    }
};

// --- Interaction ---
// Right-click to set waypoint in game
map.on('contextmenu', function(e) {
    if ('mp' in window) {
        // e.latlng.lng = x, e.latlng.lat = y
        mp.trigger('client:setMapWaypoint', e.latlng.lng, e.latlng.lat);
        
        // Optional: Show a temporary visual marker
        L.popup()
            .setLatLng(e.latlng)
            .setContent("Waypoint Set")
            .openOn(map);
    }
});