const QuickEatsApp = {
  name: 'QuickEatsApp',
  props: {
    qe: { type: Object, default: () => ({}) },
  },
  emits: ['back', 'toggle'],
  template: `
    <div id="view-quickeats" class="view">
      <div class="app-header">
        <button class="back-btn" @click="$emit('back')"><i class="fas fa-chevron-left"></i></button>
        <span style="font-family:'Poppins',sans-serif; font-weight:800; letter-spacing:0.5px; color:#00b09b;">QuickEats</span>
      </div>

      <div class="qe-app">
        <div class="qe-hero">
          <div class="qe-status-ring" :class="qe.active ? 'online' : 'offline'">
            <i :class="qe.active ? 'fas fa-hamburger' : 'fas fa-power-off'"></i>
          </div>
          <div class="qe-hero-title">{{ qe.statusText }}</div>
          <div class="qe-hero-sub">{{ qe.subText }}</div>
        </div>

        <div class="qe-body">
          <div v-if="qe.active" class="qe-stats-row">
            <div class="qe-stat-card">
              <div class="qe-stat-value">{{ qe.deliveries || 0 }}</div>
              <div class="qe-stat-label">Deliveries</div>
            </div>
            <div class="qe-stat-card">
              <div class="qe-stat-value">${{ qe.earnings || 0 }}</div>
              <div class="qe-stat-label">Earnings</div>
            </div>
          </div>

          <div v-if="qe.active && qe.locationName" class="qe-task-card">
            <div class="qe-task-label">Current Task</div>
            <div class="qe-task-name">{{ qe.statusText }}</div>
            <div class="qe-task-divider"></div>
            <div class="qe-task-location">
              <i class="fas fa-map-marker-alt"></i>
              <span>{{ qe.locationName }}</span>
            </div>
          </div>

          <button
            :class="['qe-toggle-btn', qe.active ? 'go-offline' : 'go-online']"
            :disabled="qe.processing"
            @click="$emit('toggle')"
          >
            {{ qe.processing ? 'Processing...' : (qe.active ? 'GO OFFLINE' : 'GO ONLINE') }}
          </button>
        </div>
      </div>
    </div>
  `,
}
