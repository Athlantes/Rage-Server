/**
 * app.js
 * Root Vue 3 application for the RageMP inventory CEF.
 *
 * mp bridge — server calls these on the window object:
 *   window.loadInventory(data)        — called by client:updateInventory
 *   window.showNotification(t, msg)   — called by showNotification
 *
 * All mp.trigger() calls to server are wrapped in mpTrigger() so the
 * UI still works when opened in a browser for testing (no crash).
 */

const { createApp, ref, computed, reactive, nextTick } = Vue

// ─── Constants ────────────────────────────────────────────────────────────────

const EQUIP_SLOTS = [
  { label: 'Mask',  slotId: -1  },
  { label: 'Torso', slotId: -11 },
  { label: 'Legs',  slotId: -4  },
  { label: 'Shoes', slotId: -6  },
]

// ─── Root App ─────────────────────────────────────────────────────────────────

const app = createApp({

  components: { InventorySlot, ContextMenu, SplitModal, NotifStack },

  // ── Template ──────────────────────────────────────────────────────────────
  template: `
    <div class="inventory-wrapper" @click="hideContextMenu">

      <!-- ════ LEFT: Equipment ════ -->
      <div class="col col-left">
        <h2>Character</h2>
        <div class="equip-list">
          <div v-for="es in equipItems" :key="es.slotId" class="equip-slot">
            <span class="equip-label">{{ es.label }}</span>
            <div
              class="equip-box"
              @dragover.prevent
              @drop.prevent="onDrop(es.slotId)"
              @contextmenu.prevent="es.item && showContextMenu($event, es.item)"
            >
              <template v-if="es.item">
                <img
                  :src="'../items/' + es.item.itemId + '.png'"
                  class="item-img equip-img"
                  draggable="true"
                  @error="$event.target.src = '../items/default.png'"
                  @dragstart.stop="onDragStart(es.item.slot)"
                />
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- ════ MIDDLE: Inventory ════ -->
      <div class="col col-mid">

        <!-- Header row: title + search + action buttons -->
        <div class="header-row">
          <h2>Inventory</h2>
          <div class="header-actions">

            <div class="search-container" :class="{ 'search-container--active': searchQuery.length > 0 }">
              <div class="search-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
              <input
                type="text"
                class="search-input"
                placeholder="Search..."
                :value="searchQuery"
                @input="onSearchInput($event.target.value)"
                @keydown="onSearchKey($event)"
                @focus="setSearchFocus(true)"
                @blur="setSearchFocus(false)"
              />
              <div class="search-nav">
                <button class="nav-btn" @click.stop="prevMatch">▲</button>
                <button class="nav-btn" @click.stop="nextMatch">▼</button>
              </div>
            </div>

            <button class="btn-action" @click="requestStack">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              STACK
            </button>

            <button class="btn-action" @click="requestSort">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <polyline points="19 12 12 19 5 12"/>
              </svg>
              SORT
            </button>

          </div>
        </div>

        <!-- Main inventory grid -->
        <div class="grid" id="inventory-grid">
          <inventory-slot
            v-for="s in gridSlots"
            :key="s.slotId"
            :slot-id="s.slotId"
            :item="s.item"
            :search-active="searchQuery.length > 0"
            :is-match="searchMatchSlots.includes(s.slotId)"
            :is-focused="focusedSlot === s.slotId"
            @dragstart="onDragStart"
            @drop="onDrop"
            @context="showContextMenu"
          />
        </div>

        <!-- Hotbar -->
        <div class="hotbar-container">
          <div class="hotbar-label">Fast Access</div>
          <div class="hotbar-grid">
            <div
              v-for="hs in hotbarSlots"
              :key="hs.slotId"
              class="hotbar-slot"
              @dragover.prevent
              @drop.prevent="onDrop(hs.slotId)"
              @contextmenu.prevent="hs.item && showContextMenu($event, hs.item)"
            >
              <span class="key-number">{{ hs.keyNum }}</span>
              <template v-if="hs.item">
                <img
                  :src="'../items/' + hs.item.itemId + '.png'"
                  class="item-img"
                  draggable="true"
                  @error="$event.target.src = '../items/default.png'"
                  @dragstart.stop="onDragStart(hs.item.slot)"
                />
                <span
                  v-if="hs.item.type === 'weapon' && hs.item.data && hs.item.data.ammo > 0"
                  class="item-count item-count--ammo"
                >{{ hs.item.data.ammo }}</span>
                <span v-else-if="hs.item.count > 1" class="item-count">x{{ hs.item.count }}</span>
              </template>
            </div>
          </div>
        </div>

        <!-- Weight bar -->
        <div class="weight-container">
          <div class="weight-text">
            <span>Total Weight</span>
            <span>{{ weight.toFixed(2) }}kg / {{ maxWeight }}kg</span>
          </div>
          <div class="weight-bar-bg">
            <div
              class="weight-bar-fill"
              :class="weightBarClass"
              :style="{ width: weightPercent + '%' }"
            ></div>
          </div>
        </div>

      </div>

      <!-- ════ RIGHT: Vicinity (ground) ════ -->
      <div class="col col-right" @dragover.prevent @drop.prevent="onDropToGround">
        <h2>Vicinity</h2>
        <div class="grid">
          <div
            v-for="gItem in vicinity"
            :key="gItem.id"
            class="slot"
            draggable="true"
            @dragstart="onDragStart('ground_' + gItem.id)"
            @dragover.prevent
          >
            <img
              :src="'../items/' + gItem.itemId + '.png'"
              class="item-img"
              @error="$event.target.src = '../items/default.png'"
            />
            <span class="item-count">x{{ gItem.count }}</span>
          </div>
        </div>
      </div>

      <!-- ════ Overlays ════ -->
      <context-menu
        :visible="ctxMenu.visible"
        :x="ctxMenu.x"
        :y="ctxMenu.y"
        :options="ctxMenu.options"
        @close="hideContextMenu"
      />

      <split-modal
        :visible="splitModal.visible"
        :max="splitModal.max"
        v-model:amount="splitModal.amount"
        @confirm="confirmSplit"
        @cancel="closeSplit"
      />

      <notif-stack :notifications="notifications" />

    </div>
  `,

  // ── Setup ─────────────────────────────────────────────────────────────────
  setup() {

    // ── State ──────────────────────────────────────────────────────────────

    const inventory  = ref([])
    const vicinity   = ref([])
    const weight     = ref(0)
    const maxWeight  = ref(40)
    const draggedSlot = ref(null)

    const searchQuery       = ref('')
    const currentMatchIndex = ref(-1)

    const ctxMenu = reactive({
      visible: false,
      x: 0,
      y: 0,
      options: [],
    })

    const splitModal = reactive({
      visible: false,
      slot: null,
      max: 0,
      amount: '',
    })

    const notifications = ref([])
    let _notifId = 0

    // ── Computed ───────────────────────────────────────────────────────────

    const weightPercent = computed(() =>
      Math.min(100, (weight.value / maxWeight.value) * 100)
    )

    const weightBarClass = computed(() => {
      const p = weightPercent.value
      if (p >= 95) return 'weight-bar-fill--critical'
      if (p >= 80) return 'weight-bar-fill--heavy'
      return ''
    })

    const gridSize = computed(() => {
      const maxUsed = inventory.value
        .filter(i => i.slot >= 0)
        .reduce((max, i) => Math.max(max, i.slot), -1)
      return Math.max(48, maxUsed + 12)
    })

    const gridSlots = computed(() => {
      const slots = []
      for (let i = 0; i < gridSize.value; i++) {
        slots.push({
          slotId: i,
          item: inventory.value.find(inv => inv.slot === i) || null,
        })
      }
      return slots
    })

    const hotbarSlots = computed(() =>
      Array.from({ length: 5 }, (_, i) => {
        const realSlotId = -51 - i
        return {
          slotId: realSlotId,
          keyNum: i + 1,
          item: inventory.value.find(inv => inv.slot === realSlotId) || null,
        }
      })
    )

    const equipItems = computed(() =>
      EQUIP_SLOTS.map(es => ({
        ...es,
        item: inventory.value.find(i => i.slot === es.slotId) || null,
      }))
    )

    const searchMatchSlots = computed(() => {
      const q = searchQuery.value.toLowerCase().trim()
      if (!q) return []
      return inventory.value
        .filter(i =>
          i.slot >= 0 && (
            i.itemId.toLowerCase().includes(q) ||
            (i.name && i.name.toLowerCase().includes(q))
          )
        )
        .map(i => i.slot)
    })

    const focusedSlot = computed(() => {
      if (currentMatchIndex.value < 0) return null
      return searchMatchSlots.value[currentMatchIndex.value] ?? null
    })

    // ── Helpers ────────────────────────────────────────────────────────────

    /** Safe mp.trigger wrapper — no-ops outside RageMP CEF */
    function mpTrigger(event, ...args) {
      if ('mp' in window) mp.trigger(event, ...args)
    }

    function scrollToFocused() {
      nextTick(() => {
        const el = document.querySelector('.slot.search-focus')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }

    // ── Search ─────────────────────────────────────────────────────────────

    function setSearchFocus(state) {
      mpTrigger('client:setSearchFocus', state)
    }

    function onSearchInput(val) {
      searchQuery.value = val
      // Reset to first match whenever query changes
      nextTick(() => {
        currentMatchIndex.value = searchMatchSlots.value.length > 0 ? 0 : -1
        if (currentMatchIndex.value >= 0) scrollToFocused()
      })
    }

    function onSearchKey(e) {
      if      (e.key === 'Enter' && e.shiftKey) prevMatch()
      else if (e.key === 'Enter')               nextMatch()
      else if (e.key === 'ArrowDown')           nextMatch()
      else if (e.key === 'ArrowUp')             prevMatch()
    }

    function nextMatch() {
      if (!searchMatchSlots.value.length) return
      const len = searchMatchSlots.value.length
      currentMatchIndex.value = (currentMatchIndex.value + 1) % len
      scrollToFocused()
    }

    function prevMatch() {
      if (!searchMatchSlots.value.length) return
      const len = searchMatchSlots.value.length
      currentMatchIndex.value = (currentMatchIndex.value - 1 + len) % len
      scrollToFocused()
    }

    // ── Drag & Drop ────────────────────────────────────────────────────────

    function onDragStart(slotId) {
      draggedSlot.value = slotId
    }

    function onDrop(targetSlotId) {
      if (draggedSlot.value === null || draggedSlot.value === targetSlotId) return
      mpTrigger('gui:moveItem', draggedSlot.value, targetSlotId)
      draggedSlot.value = null
    }

    function onDropToGround() {
      if (draggedSlot.value !== null) {
        mpTrigger('gui:moveItem', draggedSlot.value, 'GROUND')
        draggedSlot.value = null
      }
    }

    // ── Context Menu ───────────────────────────────────────────────────────

    function buildOptions(item) {
      const opts = []

      // Primary use action (label varies by type)
      let useLabel  = 'Use'
      let useAction = 'use'
      if      (item.type === 'food')     useLabel = 'Eat'
      else if (item.type === 'drink')    useLabel = 'Drink'
      else if (item.type === 'clothing') { useLabel = 'Wear'; useAction = 'equip' }
      else if (item.type === 'weapon')   useLabel = 'Equip'

      if (item.slot >= 0 || item.slot < -50) {
        opts.push({
          label: useLabel,
          action: () => {
            if (useAction === 'equip') mpTrigger('client:equipItem', item.slot)
            else                       mpTrigger('client:useItem',   item.slot)
          },
        })

        // Weapon-specific options
        if (item.type === 'weapon') {
          if (item.data && item.data.ammo > 0) {
            opts.push({ label: 'Unload Ammo', action: () => mpTrigger('server:unloadWeapon', item.slot) })
          }
          if (item.ammoItem && inventory.value.find(i => i.itemId === item.ammoItem)) {
            opts.push({ label: 'Load Ammo', action: () => mpTrigger('server:loadWeapon', item.slot) })
          }
        }
      }

      if (item.maxStack > 1 && item.count < item.maxStack) {
        opts.push({ label: 'Stack', action: () => mpTrigger('client:stackItem', item.slot) })
      }

      if (item.count > 1) {
        opts.push({ label: 'Split', action: () => openSplitModal(item) })
      }

      opts.push({ label: 'Drop', action: () => mpTrigger('client:dropItem', item.slot) })

      return opts
    }

    function showContextMenu(e, item) {
      ctxMenu.options = buildOptions(item)
      ctxMenu.x       = e.pageX
      ctxMenu.y       = e.pageY
      ctxMenu.visible = true
    }

    function hideContextMenu() {
      ctxMenu.visible = false
    }

    // ── Split Modal ────────────────────────────────────────────────────────

    function openSplitModal(item) {
      splitModal.slot    = item.slot
      splitModal.max     = item.count
      splitModal.amount  = ''
      splitModal.visible = true
    }

    function confirmSplit() {
      const amt = parseInt(splitModal.amount)
      if (amt > 0 && amt < splitModal.max && splitModal.slot !== null) {
        mpTrigger('client:splitItem', splitModal.slot, String(amt))
      }
      closeSplit()
    }

    function closeSplit() {
      splitModal.visible = false
      splitModal.slot    = null
    }

    // ── Notifications ──────────────────────────────────────────────────────

    function showNotification(title, message) {
      const id = _notifId++
      notifications.value.push({ id, title, message })
      setTimeout(() => {
        notifications.value = notifications.value.filter(n => n.id !== id)
      }, 5000)
    }

    // ── Server sync ────────────────────────────────────────────────────────

    function loadInventory(data) {
      inventory.value = data.inventory || []
      vicinity.value  = data.vicinity  || []
      weight.value    = parseFloat(data.weight)    || 0
      maxWeight.value = parseFloat(data.maxWeight) || 40

      // Re-run search if a query is active
      if (searchQuery.value.trim()) {
        nextTick(() => {
          if (searchMatchSlots.value.length === 0) {
            currentMatchIndex.value = -1
          } else if (currentMatchIndex.value >= searchMatchSlots.value.length) {
            currentMatchIndex.value = 0
          }
        })
      }
    }

    // ── Actions ────────────────────────────────────────────────────────────

    function requestSort()  { mpTrigger('client:reqSort')  }
    function requestStack() { mpTrigger('client:reqStack') }

    // ── mp Window Bridge ───────────────────────────────────────────────────
    //
    // The server calls: player.call('client:updateInventory', [jsonString])
    // The client-side mp handler parses the JSON and calls window.loadInventory.
    //
    // window.resetSearch() is called by the client-side whenever the inventory
    // is opened, so any previous search state is cleared cleanly through Vue
    // instead of reaching into the DOM directly.

    function resetSearch() {
      searchQuery.value       = ''
      currentMatchIndex.value = -1
    }

    window.loadInventory    = loadInventory
    window.showNotification = showNotification
    window.resetSearch      = resetSearch

    // ── Expose ─────────────────────────────────────────────────────────────

    return {
      // State
      inventory, vicinity, weight, maxWeight, searchQuery, notifications,
      // Computed
      weightPercent, weightBarClass, gridSlots, hotbarSlots, equipItems,
      searchMatchSlots, focusedSlot, ctxMenu, splitModal,
      // Methods
      setSearchFocus, onSearchInput, onSearchKey, nextMatch, prevMatch,
      resetSearch,
      onDragStart, onDrop, onDropToGround,
      showContextMenu, hideContextMenu,
      confirmSplit, closeSplit,
      requestSort, requestStack,
    }
  },
})

app.mount('#app')
