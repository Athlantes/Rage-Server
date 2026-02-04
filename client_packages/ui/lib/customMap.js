// client_packages/ui/lib/customMap.js

class GameMap {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.map = null;
        this.layerGroup = null;

        // GTA V Map Coordinate Constants
        this.config = {
            centerX: 59.5028,
            centerY: 119.3981,
            scaleX: 0.01443,
            scaleY: 0.01424,
            minZoom: options.minZoom || 2,
            maxZoom: options.maxZoom || 5,
            initialZoom: options.initialZoom || 3
        };

        this.init();
    }

    init() {
        if (this.map) return;

        // 1. Define Coordinate System
        const CustomCRS = L.extend({}, L.CRS.Simple, {
            transformation: new L.Transformation(
                this.config.scaleX, this.config.centerX, 
                -this.config.scaleY, this.config.centerY
            )
        });

        // 2. Initialize Map
        this.map = L.map(this.containerId, {
            crs: CustomCRS,
            minZoom: this.config.minZoom,
            maxZoom: this.config.maxZoom,
            zoomControl: false,
            attributionControl: false,
            center: [0, 0],
            zoom: this.config.initialZoom,
            // Default interactions (can be overridden by css or options if needed)
            dragging: true,
            zoomControl: false
        });

        // 3. Define Tile Layer
        // Note: Ensure this path is correct for all files importing this script
        const tilePath = 'package://ui/WebMap/images/map/{z}/{x}x{y}.png'; 
        
        L.tileLayer(tilePath, {
            minZoom: this.config.minZoom,
            maxZoom: this.config.maxZoom,
            tileSize: 256,
            noWrap: true,
            tms: false
        }).addTo(this.map);

        this.layerGroup = L.layerGroup().addTo(this.map);
    }

    /**
     * Disables map interaction (for static views like the Garbage Job)
     */
    disableInteraction() {
        if (!this.map) return;
        this.map.dragging.disable();
        this.map.touchZoom.disable();
        this.map.doubleClickZoom.disable();
        this.map.scrollWheelZoom.disable();
        this.map.boxZoom.disable();
        this.map.keyboard.disable();
        if (this.map.tap) this.map.tap.disable();
    }

    /**
     * Enable interaction (for selectors)
     */
    enableInteraction() {
        if (!this.map) return;
        this.map.dragging.enable();
        this.map.scrollWheelZoom.enable();
        // Add other enables if necessary
    }

    /**
     * Adds markers to the map.
     * @param {Array} points - Array of objects containing {x, y} or arrays [x, y]
     * @param {Object} iconOptions - Leaflet icon options (iconUrl, iconSize, etc.)
     */
    setMarkers(points, iconOptions) {
        this.clearMarkers();

        if (!points || points.length === 0) return;

        const icon = L.icon(iconOptions);
        const markers = [];
        const latLngs = [];

        points.forEach(p => {
            // Handle both {x,y} objects and [x,y] arrays if necessary. 
            // Your garbage script sends {x, y}.
            const lat = p.y; 
            const lng = p.x;
            
            markers.push(L.marker([lat, lng], { icon: icon }));
            latLngs.push([lat, lng]);
        });

        this.layerGroup = L.layerGroup(markers).addTo(this.map);

        // Auto-fit bounds
        if (latLngs.length > 0) {
            this.map.fitBounds(L.latLngBounds(latLngs), { padding: [100, 100] });
        }
    }

    clearMarkers() {
        if (this.layerGroup) {
            this.layerGroup.clearLayers();
        }
    }

    /**
     * Returns the Leaflet map instance if you need direct access
     */
    getInstance() {
        return this.map;
    }
}