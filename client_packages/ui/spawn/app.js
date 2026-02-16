/**
 * app.js — ui/spawn/
 * Vue 3 root app for the spawn-selector CEF.
 */

const { createApp, ref, onMounted } = Vue

/** Safe mp.trigger — no-ops when opened in a browser for testing */
function mpTrigger(event, ...args) {
  if ('mp' in window) mp.trigger(event, ...args)
}

// ── Spawn definitions ────────────────────────────────────────────────────────
const SPAWNS = [
  { name: 'LS Airport',    desc: 'Travel Hub',      icon: 'fa-plane',  x:-1037.76, y: -2737.67 },
]

const MARKER_ICON = {
  iconUrl:    '../lib/leaflet/images/marker-icon.png',
  iconSize:   [25, 41],
  iconAnchor: [12, 41],
}

const app = createApp({

  template: `
    <div class="ui-layer">

      <div class="header-title">
        <h1>Welcome Back</h1>
        <p>Where does your story continue today?</p>
      </div>

      <div class="spawn-selector-container">
        <div class="spawn-row">

          <div
            v-if="lastLocation"
            class="spawn-card special"
            :class="{ active: selectedIndex === -1 }"
            @click="selectLocation(-1, lastLocation.x, lastLocation.y)"
          >
            <i class="fas fa-history"></i>
            <h3>Last Location</h3>
            <span>Resume previous position</span>
          </div>

          <div
            v-if="houseLocation"
            class="spawn-card special-house"
            :class="{ active: selectedIndex === -2 }"
            @click="selectLocation(-2, houseLocation.x, houseLocation.y)"
          >
            <i class="fas fa-home"></i>
            <h3>My House</h3>
            <span>Spawn at home</span>
          </div>

          <div
            v-if="familyHQLocation"
            class="spawn-card special-family"
            :class="{ active: selectedIndex === -3 }"
            @click="selectLocation(-3, familyHQLocation.x, familyHQLocation.y)"
          >
            <i class="fas fa-users"></i>
            <h3>Family HQ</h3>
            <span>Spawn at family headquarters</span>
          </div>

          <div
            v-for="(spawn, i) in spawns"
            :key="i"
            class="spawn-card"
            :class="{ active: selectedIndex === i }"
            @click="selectLocation(i, spawn.x, spawn.y)"
          >
            <i :class="'fas ' + spawn.icon"></i>
            <h3>{{ spawn.name }}</h3>
            <span>{{ spawn.desc }}</span>
          </div>

        </div>

        <transition name="btn-fade">
          <button
            v-if="selectedIndex !== null"
            class="btn-spawn"
            @click="confirmSpawn"
          >
            <i class="fas fa-sign-in-alt"></i> Wake Up
          </button>
        </transition>

      </div>
    </div>
  `,

  setup() {
    // ── State ────────────────────────────────────────────────────────────────

    const spawns          = ref(SPAWNS)
    const selectedIndex   = ref(null)   // null | -1 (last) | -2 (house) | -3 (family HQ) | 0–4 (std)
    const lastLocation    = ref(null)   // null | { x, y }
    const houseLocation   = ref(null)   // null | { x, y }
    const familyHQLocation = ref(null)  // null | { x, y }

    let spawnMap = null

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    onMounted(() => {
      spawnMap = new GameMap('map', {
        initialZoom: 3,
        minZoom: 2,
        maxZoom: 5,
      })
      spawnMap.disableInteraction()
    })

    // ── Methods ───────────────────────────────────────────────────────────────

    function selectLocation(index, x, y) {
      selectedIndex.value = index

      if (!spawnMap) return

      spawnMap.getInstance().flyTo([y, x], 5, { animate: true, duration: 1.5 })
      spawnMap.setMarkers([{ x, y }], MARKER_ICON)
    }

    function confirmSpawn() {
      if (selectedIndex.value === null) return
      mpTrigger('client:spawn:select', selectedIndex.value)
    }

    // ── Window Bridge ─────────────────────────────────────────────────────────

    function addLastLocation(pos) {
      lastLocation.value = typeof pos === 'string' ? JSON.parse(pos) : pos
    }

    function addHouseLocation(pos) {
      houseLocation.value = typeof pos === 'string' ? JSON.parse(pos) : pos
    }

    function addFamilyHQLocation(pos) {
      familyHQLocation.value = typeof pos === 'string' ? JSON.parse(pos) : pos
    }

    window.addLastLocation = addLastLocation
    window.addHouseLocation = addHouseLocation
    window.addFamilyHQLocation = addFamilyHQLocation

    // ── Expose ────────────────────────────────────────────────────────────────

    return {
      spawns, selectedIndex, lastLocation, houseLocation, familyHQLocation,
      selectLocation, confirmSpawn,
    }
  },
})

app.mount('#app')