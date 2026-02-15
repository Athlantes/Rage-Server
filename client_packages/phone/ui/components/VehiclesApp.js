const VehiclesApp = {
  name: 'VehiclesApp',
  props: {
    vehicles:    { type: Array,  default: () => [] },
    gradeColors: { type: Object, default: () => ({}) },
  },
  emits: ['back', 'open-vehicle'],
  methods: {
    gc(grade) { return this.gradeColors[grade] || '#888' },
  },
  template: `
    <div id="view-vehicles" class="view">
      <div class="app-header">
        <button class="back-btn" @click="$emit('back')"><i class="fas fa-chevron-left"></i></button>
        <span>My Cars</span>
        <span class="slots-badge">{{ vehicles.length }} vehicles</span>
      </div>

      <div class="scrollable-content">
        <div v-if="vehicles.length === 0" class="veh-empty-state">
          <div class="veh-empty-icon"><i class="fas fa-car"></i></div>
          <div class="veh-empty-title">No Vehicles</div>
          <div class="veh-empty-sub">Visit a dealership to purchase your first car</div>
        </div>

        <div
          v-for="car in vehicles"
          :key="car.id"
          class="vehicle-item"
          @click="$emit('open-vehicle', car)"
        >
          <div
            class="veh-icon-new"
            :style="{ borderColor: gc(car.grade) + '33', background: gc(car.grade) + '11' }"
          >
            <i class="fas fa-car" :style="{ color: gc(car.grade) }"></i>
            <span class="veh-grade-pip" :style="{ background: gc(car.grade) }">{{ car.grade }}</span>
          </div>
          <div class="veh-info">
            <div class="veh-model">{{ car.displayName || car.model }}</div>
            <div class="veh-plate">{{ car.plate }} · {{ car.type || 'Unknown' }}</div>
          </div>
          <div class="veh-right">
            <div class="veh-status-pill" :class="{ active: car.spawned }">
              {{ car.spawned ? 'Active' : 'Parked' }}
            </div>
            <div class="veh-fuel-mini"><i class="fas fa-gas-pump"></i> {{ Math.floor(car.fuel) }}%</div>
          </div>
        </div>
      </div>
    </div>
  `,
}
