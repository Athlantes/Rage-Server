const VehicleDetail = {
  name: 'VehicleDetail',
  props: {
    vehicle:     { type: Object, default: () => ({}) },
    gradeColors: { type: Object, default: () => ({}) },
  },
  emits: ['back', 'vehicle-action', 'sell'],
  computed: {
    gc()      { return this.gradeColors[this.vehicle.grade] || '#888' },
    fuel()    { return Math.floor(this.vehicle.fuel || 0) },
    fuelBar() {
      const f = this.fuel
      return f > 50 ? '#2ecc71' : f > 20 ? '#f39c12' : '#ff4757'
    },
    isOut()   { return !!this.vehicle.spawned },
  },
  template: `
    <div id="view-vehicle-details" class="view">
      <div class="app-header">
        <button class="back-btn" @click="$emit('back')"><i class="fas fa-chevron-left"></i></button>
        <span>{{ vehicle.displayName || vehicle.model }}</span>
      </div>

      <div class="scrollable-content detail-container veh-detail-new">
        <div class="veh-detail-top">
          <div class="veh-detail-icon-wrap">
            <i class="fas fa-car"></i>
            <span class="veh-detail-grade" :style="{ background: gc }">{{ vehicle.grade || '?' }}</span>
          </div>
          <h2 style="margin:0; font-size:20px; color:#1a1a2e; font-family:'Poppins',sans-serif;">
            {{ vehicle.displayName || vehicle.model }}
          </h2>
          <p style="margin:5px 0 8px 0; color:rgba(0,0,0,0.4); font-family:monospace; font-size:14px; background:#f0f0f5; padding:2px 8px; border-radius:4px;">
            {{ vehicle.plate }}
          </p>
          <span class="veh-detail-type">{{ vehicle.type || 'Unknown' }}</span>
        </div>

        <div class="stat-box">
          <div class="stat-row">
            <span>Status</span>
            <span :class="['status-tag', isOut ? 'tag-out' : '']">
              {{ isOut ? 'Active (On Map)' : 'In Garage' }}
            </span>
          </div>
          <div class="stat-row">
            <span>Fuel</span>
            <div class="fuel-bar-wrap">
              <div class="fuel-bar" :style="{ width: fuel + '%', background: fuelBar }"></div>
            </div>
            <span class="fuel-pct">{{ fuel }}%</span>
          </div>
        </div>

        <div class="action-buttons">
          <button
            class="action-btn btn-green"
            :class="{ 'btn-disabled': isOut }"
            @click="!isOut && $emit('vehicle-action', 'spawn')"
          ><i class="fas fa-key"></i> Spawn</button>

          <button
            class="action-btn btn-blue"
            :class="{ 'btn-disabled': !isOut }"
            @click="isOut && $emit('vehicle-action', 'locate')"
          ><i class="fas fa-map-marker-alt"></i> Locate</button>

          <button
            class="action-btn btn-red"
            :class="{ 'btn-disabled': !isOut }"
            @click="isOut && $emit('vehicle-action', 'despawn')"
          ><i class="fas fa-warehouse"></i> Park (Tow)</button>
        </div>

        <div class="veh-sell-section">
          <div class="sell-info">
            <span class="sell-label">Sell Value</span>
            <span class="sell-price">${{ (vehicle.sellPrice || 0).toLocaleString() }}</span>
          </div>
          <button class="sell-btn" @click="$emit('sell')">
            <i class="fas fa-dollar-sign"></i> Sell
          </button>
        </div>
      </div>
    </div>
  `,
}
