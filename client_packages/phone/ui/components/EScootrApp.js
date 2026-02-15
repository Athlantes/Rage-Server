const EScootrApp = {
  name: 'EScootrApp',
  props: {
    scooter: { type: Object, default: () => ({}) },
  },
  emits: ['back', 'scan', 'end-ride'],
  computed: {
    isScanning() { return this.scooter.state === 'scanning' },
    isFound()    { return this.scooter.state === 'found'    },
    isActive()   { return this.scooter.state === 'active'   },
    scanBtnText() {
      if (this.isScanning) return 'SEARCHING...'
      if (this.isFound)    return `UNLOCK ($${this.scooter.unlockCost})`
      return 'SCAN AREA'
    },
  },
  template: `
    <div id="view-escootr" class="view">
      <div class="app-header">
        <button class="back-btn" @click="$emit('back')"><i class="fas fa-chevron-left"></i></button>
        <span style="color:#32cd32; letter-spacing:1.5px; font-family:'Poppins',sans-serif; font-weight:800; font-size:16px;">eScootr</span>
      </div>

      <div class="scootr-app">

        <!-- Scan / Found UI -->
        <div v-if="!isActive" id="escootr-scan-ui">
          <div class="scootr-hero">
            <div class="scootr-scan-ring" :class="{ pulsing: isScanning }">
              <i class="fas fa-bolt"></i>
            </div>
            <div class="scootr-hero-msg">
              <template v-if="isScanning">Triangulating nearby scooters...</template>
              <template v-else-if="isFound">Signal acquired.</template>
              <template v-else>Tap below to find a ride</template>
            </div>
          </div>

          <div class="scootr-body">
            <div v-if="isFound" class="scootr-found-card">
              <div class="scootr-found-title">
                <i class="fas fa-check-circle" style="color:#32cd32; margin-right:6px;"></i>Scooter Found
              </div>
              <div class="scootr-found-meta">
                <span><i class="fas fa-walking"></i> {{ scooter.dist }}m away</span>
                <span class="batt"><i class="fas fa-battery-three-quarters"></i> {{ scooter.battery }}%</span>
              </div>
            </div>

            <button
              class="scootr-scan-btn"
              :class="{ unlock: isFound }"
              :disabled="isScanning"
              @click="$emit('scan')"
            >{{ scanBtnText }}</button>

            <div class="scootr-pricing">$5.00 Unlock • $1.00/min</div>
          </div>
        </div>

        <!-- Active Ride UI -->
        <div v-else id="escootr-active-ui" class="scootr-ride-active">
          <div class="scootr-ride-hero">
            <div class="scootr-timer">{{ scooter.timerStr }}</div>
            <div class="scootr-ride-badge">Active Ride</div>
          </div>
          <div class="scootr-ride-body">
            <div class="scootr-ride-stats">
              <div class="scootr-ride-stat">
                <div class="scootr-ride-stat-val">{{ scooter.cost }}</div>
                <div class="scootr-ride-stat-label">Cost</div>
              </div>
              <div class="scootr-ride-stat">
                <div class="scootr-ride-stat-val green">{{ scooter.liveBattery }}%</div>
                <div class="scootr-ride-stat-label">Battery</div>
              </div>
            </div>
            <button class="scootr-end-btn" @click="$emit('end-ride')">END RIDE & LOCK</button>
          </div>
        </div>

      </div>
    </div>
  `,
}
