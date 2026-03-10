/**
 * app.js — ui/spawn/
 * Vue 3 root app for the spawn-selector CEF.
 * Logic is unchanged from original; only the template (UI layout) is new.
 */

const { createApp, ref, computed } = Vue

/** Safe mp.trigger — no-ops when opened in a browser for testing */
function mpTrigger(event, ...args) {
  if ('mp' in window) mp.trigger(event, ...args)
}

// ── Spawn definitions ─────────────────────────────────────────────────────────
const SPAWNS = [
  { name: 'LS Airport',    desc: 'Travel Hub',      icon: 'fa-plane',  x:-1037.76, y: -2737.67 },
]

// ── Per-card accent colours (footer icon + active top border) ─────────────────
const ACCENTS = {
  last:   '#e67e22',
  home:   '#2ecc71',
  family: '#3498db',
  org:    '#f1c40f',
  std:   ['#e74c3c', '#9b59b6', '#1abc9c', '#e67e22', '#3498db'],
}

const app = createApp({

  template: `
    <div id="header">
      <div class="hdr-left">
        <h1>Spawn Selector</h1>
        <p>Select a spawn point on the state map</p>
      </div>
    </div>

    <div id="cards-area">
      <div class="cards-wrap">

        <!-- Last Location -->
        <div
          v-if="lastLocation"
          class="spawn-card"
          :class="{ active: selectedIndex === -1 }"
          :style="{ '--accent': accents.last }"
          @click="selectLocation(-1, lastLocation.x, lastLocation.y)"
        >
          <div class="card-bg" style="background-image: url('img/last.jpg')"></div>
          <div class="card-overlay last"></div>
          <div class="card-vignette"></div>
          <div class="card-body">
            <div class="card-title">Last Coord</div>
            <div class="card-desc">By clicking here, you can spawn again at the place you last exited.</div>
          </div>
        </div>

        <!-- Your Home -->
        <div
          v-if="houseLocation"
          class="spawn-card"
          :class="{ active: selectedIndex === -2 }"
          :style="{ '--accent': accents.home }"
          @click="selectLocation(-2, houseLocation.x, houseLocation.y)"
        >
          <div class="card-bg" style="background-image: url('img/home.jpg')"></div>
          <div class="card-overlay home"></div>
          <div class="card-vignette"></div>
          <div class="card-body">
            <div class="card-title">Your Home</div>
            <div class="card-desc">By clicking here, you can spawn at your personal residence.</div>
          </div>
        </div>

        <!-- Your Family -->
        <div
          v-if="familyHQLocation"
          class="spawn-card"
          :class="{ active: selectedIndex === -3 }"
          :style="{ '--accent': accents.family }"
          @click="selectLocation(-3, familyHQLocation.x, familyHQLocation.y)"
        >
          <div class="card-bg" style="background-image: url('img/family.jpg')"></div>
          <div class="card-overlay family"></div>
          <div class="card-vignette"></div>
          <div class="card-body">
            <div class="card-title">Your Family</div>
            <div class="card-desc">By clicking here, you can spawn at your family headquarters.</div>
          </div>
        </div>

        <!-- Your Organization -->
        <div
          v-if="factionHQLocation"
          class="spawn-card"
          :class="{ active: selectedIndex === -4 }"
          :style="{ '--accent': accents.org }"
          @click="selectLocation(-4, factionHQLocation.x, factionHQLocation.y)"
        >
          <div class="card-bg" style="background-image: url('img/org.jpg')"></div>
          <div class="card-overlay org"></div>
          <div class="card-vignette"></div>
          <div class="card-body">
            <div class="card-title">Your Organization</div>
            <div class="card-desc">By clicking here, you can spawn at your organization's location.</div>
          </div>
        </div>

        <!-- Standard spawns -->
        <div
          v-for="(spawn, i) in spawns"
          :key="i"
          class="spawn-card"
          :class="{ active: selectedIndex === i }"
          :style="{ '--accent': accents.std[i % accents.std.length] }"
          @click="selectLocation(i, spawn.x, spawn.y)"
        >
          <div class="card-bg" :style="{ backgroundImage: 'url(' + (spawn.img || 'img/airport.jpg') + ')' }"></div>
          <div class="card-overlay" :class="'std-' + (i % 5)"></div>
          <div class="card-vignette"></div>
          <div class="card-body">
            <div class="card-title">{{ spawn.name }}</div>
            <div class="card-desc">{{ spawn.desc }}</div>
          </div>
        </div>

      </div>
    </div>

    <div id="footer">
      <div class="footer-info">
        <transition name="slide" mode="out-in">
          <div v-if="selectedIndex !== null" :key="'icon-' + selectedIndex"
               class="footer-icon-box" :style="{ '--accent': currentAccent }">
            <i :class="'fas ' + currentIcon"></i>
          </div>
        </transition>
        <transition name="slide" mode="out-in">
          <div v-if="selectedIndex !== null" :key="'txt-' + selectedIndex" class="footer-text">
            <div class="sel-name">{{ currentName }}</div>
            <div class="sel-desc">{{ currentDesc }}</div>
          </div>
          <div v-else class="footer-hint">Select a spawn location</div>
        </transition>
      </div>

      <button v-if="selectedIndex !== null" class="btn-spawn" @click="confirmSpawn">
        <i class="fas fa-sign-in-alt"></i> Spawn
      </button>
    </div>
  `,

  setup() {
    // ── State (identical to original) ─────────────────────────────────────────
    const spawns            = ref(SPAWNS)
    const selectedIndex     = ref(null)
    const lastLocation      = ref(null)
    const houseLocation     = ref(null)
    const familyHQLocation  = ref(null)
    const factionHQLocation = ref(null)

    const accents = ACCENTS

    // ── Footer computed helpers ───────────────────────────────────────────────
    const currentAccent = computed(() => {
      const i = selectedIndex.value
      if (i === -1) return accents.last
      if (i === -2) return accents.home
      if (i === -3) return accents.family
      if (i === -4) return accents.org
      if (i >= 0)   return accents.std[i % accents.std.length]
      return '#555'
    })

    const currentIcon = computed(() => {
      const i = selectedIndex.value
      if (i === -1) return 'fa-history'
      if (i === -2) return 'fa-home'
      if (i === -3) return 'fa-users'
      if (i === -4) return 'fa-shield-alt'
      if (i >= 0)   return spawns.value[i]?.icon || 'fa-map-marker-alt'
      return 'fa-map-marker-alt'
    })

    const currentName = computed(() => {
      const i = selectedIndex.value
      if (i === -1) return 'Last Coord'
      if (i === -2) return 'Your Home'
      if (i === -3) return 'Your Family'
      if (i === -4) return 'Your Organization'
      if (i >= 0)   return spawns.value[i]?.name || ''
      return ''
    })

    const currentDesc = computed(() => {
      const i = selectedIndex.value
      if (i === -1) return 'Spawn at your previous location.'
      if (i === -2) return 'Spawn at your personal residence.'
      if (i === -3) return 'Spawn at your family headquarters.'
      if (i === -4) return "Spawn at your organization's location."
      if (i >= 0)   return spawns.value[i]?.desc || ''
      return ''
    })

    // ── Methods (identical to original) ──────────────────────────────────────
    function selectLocation(index, x, y) {
      selectedIndex.value = index
    }

    function confirmSpawn() {
      if (selectedIndex.value === null) return
      mpTrigger('client:spawn:select', selectedIndex.value)
    }

    // ── Window Bridge (identical to original) ─────────────────────────────────
    function addLastLocation(pos) {
      lastLocation.value = typeof pos === 'string' ? JSON.parse(pos) : pos
    }
    function addHouseLocation(pos) {
      houseLocation.value = typeof pos === 'string' ? JSON.parse(pos) : pos
    }
    function addFamilyHQLocation(pos) {
      familyHQLocation.value = typeof pos === 'string' ? JSON.parse(pos) : pos
    }
    function addFactionHQLocation(pos) {
      factionHQLocation.value = typeof pos === 'string' ? JSON.parse(pos) : pos
    }

    window.addLastLocation      = addLastLocation
    window.addHouseLocation     = addHouseLocation
    window.addFamilyHQLocation  = addFamilyHQLocation
    window.addFactionHQLocation = addFactionHQLocation

    return {
      spawns, selectedIndex, lastLocation, houseLocation,
      familyHQLocation, factionHQLocation,
      accents, currentAccent, currentIcon, currentName, currentDesc,
      selectLocation, confirmSpawn,
    }
  },
})

app.mount('#app')