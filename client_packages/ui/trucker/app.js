/**
 * ============================================================================
 * TRUCKER CONTRACT BOARD - CEF LOGIC
 * Handles route rendering, map preview, and user interaction
 * ============================================================================
 */

let gameMap = null;
let currentData = null;
let selectedRoute = null;

/**
 * Initialize the board with data from server
 * Called by client.js after CEF loads
 */
function initBoard(data) {
    currentData = data;
    
    // Show the container
    const container = document.getElementById('trucker-container');
    container.classList.remove('trucker-hidden');

    // Populate player info
    document.getElementById('player-level').textContent = data.level;
    document.getElementById('player-tier').textContent = data.tierName;

    // Populate route list
    renderRoutes(data.routes);

    // Initialize the map
    if (!gameMap) {
        gameMap = new GameMap('route-map', {
            minZoom: 2,
            maxZoom: 5,
            initialZoom: 3
        });
    }
}

/**
 * Render the list of available routes
 */
function renderRoutes(routes) {
    const container = document.getElementById('route-container');
    container.innerHTML = ''; // Clear placeholder

    if (!routes || routes.length === 0) {
        container.innerHTML = `
            <div class="route-item-placeholder">
                <p>No contracts available</p>
            </div>
        `;
        return;
    }

    routes.forEach(route => {
        const item = createRouteItem(route);
        container.appendChild(item);
    });
}

/**
 * Create a single route item element
 */
function createRouteItem(route) {
    const div = document.createElement('div');
    div.className = 'route-item';
    div.setAttribute('data-route-id', route.id);

    // Calculate estimated distance in km
    const distanceKm = (route.distance / 1000).toFixed(1);

    // Calculate estimated pay (including level bonus from server data)
    const estimatedPay = route.basePay + Math.floor(currentData.level * 1.5);

    div.innerHTML = `
        <div class="route-header">
            <h4 class="route-name">${route.name}</h4>
            <span class="route-pay">$${estimatedPay}</span>
        </div>
        <div class="route-meta">
            <div class="meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>${distanceKm} km</span>
            </div>
            <div class="meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Lvl ${route.minLevel}+</span>
            </div>
        </div>
        ${route.minLevel > currentData.level ? 
            '<div class="route-locked"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Locked</div>' 
            : ''
        }
    `;

    // Add click handler (only if unlocked)
    if (route.minLevel <= currentData.level) {
        div.addEventListener('click', () => selectRoute(route));
    } else {
        div.classList.add('route-locked-item');
    }

    return div;
}

/**
 * Handle route selection
 * Shows route on map and displays details
 */
function selectRoute(route) {
    selectedRoute = route;

    // Update UI to show selection
    document.querySelectorAll('.route-item').forEach(item => {
        item.classList.remove('route-selected');
    });
    
    const selectedItem = document.querySelector(`[data-route-id="${route.id}"]`);
    if (selectedItem) {
        selectedItem.classList.add('route-selected');
    }

    // Update map subtitle
    document.getElementById('map-subtitle').textContent = route.name;

    // Show route on map
    showRouteOnMap(route);

    // Populate route details panel
    const distanceKm = (route.distance / 1000).toFixed(1);
    const estimatedPay = route.basePay + Math.floor(currentData.level * 1.5);

    document.getElementById('detail-distance').textContent = `${distanceKm} km`;
    document.getElementById('detail-pay').textContent = `$${estimatedPay}`;
    document.getElementById('detail-level').textContent = route.minLevel;

    // Show details panel
    document.getElementById('route-details').style.display = 'block';
}

/**
 * Display the route on the Leaflet map
 * Shows pickup and dropoff markers with a connecting line
 */
function showRouteOnMap(route) {
    if (!gameMap) return;

    const map = gameMap.getInstance();
    
    // Clear previous markers and layers
    gameMap.clearMarkers();

    // Create marker icon for pickup (orange)
    const pickupIcon = L.icon({
        iconUrl: 'package://ui/lib/leaflet/images/marker-icon.png',
        shadowUrl: 'package://ui/lib/leaflet/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    // Create marker icon for dropoff (green)
    const dropoffIcon = L.icon({
        iconUrl: 'package://ui/lib/leaflet/images/marker-icon-2x.png',
        shadowUrl: 'package://ui/lib/leaflet/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    // Convert GTA coordinates to Leaflet coordinates
    // GameMap uses: lat = y, lng = x
    const pickupLatLng = [route.pickup.y, route.pickup.x];
    const dropoffLatLng = [route.dropoff.y, route.dropoff.x];

    // Create markers
    const pickupMarker = L.marker(pickupLatLng, { 
        icon: pickupIcon,
        title: 'Pickup Zone'
    }).bindPopup('<b>Pickup Zone</b><br>Hook up your trailer here');

    const dropoffMarker = L.marker(dropoffLatLng, { 
        icon: dropoffIcon,
        title: 'Drop-off Zone'
    }).bindPopup('<b>Drop-off Zone</b><br>Deliver cargo here');

    // Create a line connecting pickup and dropoff
    const routeLine = L.polyline([pickupLatLng, dropoffLatLng], {
        color: '#FFA500',
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 10'
    });

    // Add all to a layer group
    const routeLayer = L.layerGroup([pickupMarker, dropoffMarker, routeLine]);
    routeLayer.addTo(map);

    // Fit map bounds to show both points
    const bounds = L.latLngBounds([pickupLatLng, dropoffLatLng]);
    map.fitBounds(bounds, { 
        padding: [80, 80],
        maxZoom: 4
    });
}

/**
 * Accept the selected contract
 */
function acceptContract() {
    if (!selectedRoute) return;

    // Send to client.js, which will relay to server
    if (typeof mp !== 'undefined') {
        mp.trigger('cef:trucker:selectContract', selectedRoute.id);
    }
}

/**
 * Close the board
 */
function closeBoard() {
    const container = document.getElementById('trucker-container');
    container.classList.add('trucker-hidden');
    
    // Tell client.js
    if (typeof mp !== 'undefined') {
        mp.trigger('cef:trucker:closeBoard');
    }

    // Reset state
    selectedRoute = null;
    document.getElementById('route-details').style.display = 'none';
    
    // Clear map
    if (gameMap) {
        gameMap.clearMarkers();
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format distance for display
 */
function formatDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format money for display
 */
function formatMoney(amount) {
    return `$${amount.toLocaleString()}`;
}