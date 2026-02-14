/**
 * InventorySlot.js
 * Reusable slot tile used in the main inventory grid.
 * Handles drag-and-drop, context menu, and search highlighting.
 */
const InventorySlot = {
  name: 'InventorySlot',

  props: {
    slotId:       { type: Number,  required: true },
    item:         { type: Object,  default: null  },
    searchActive: { type: Boolean, default: false },
    isMatch:      { type: Boolean, default: false },
    isFocused:    { type: Boolean, default: false },
  },

  emits: ['dragstart', 'drop', 'context'],

  computed: {
    slotClass() {
      return {
        'slot': true,
        'dimmed':       this.searchActive && !this.isMatch && !this.isFocused,
        'search-match': this.isMatch && !this.isFocused,
        'search-focus': this.isFocused,
      }
    },

    countLabel() {
      if (!this.item) return null
      if (this.item.type === 'weapon' && this.item.data && this.item.data.ammo > 0) {
        return { text: this.item.data.ammo, weapon: true }
      }
      if (this.item.count > 1) {
        return { text: 'x' + this.item.count, weapon: false }
      }
      return null
    },
  },

  template: `
    <div
      :class="slotClass"
      :data-slot="slotId"
      @dragover.prevent
      @drop.prevent="$emit('drop', slotId)"
      @contextmenu.prevent="item && $emit('context', $event, item)"
    >
      <template v-if="item">
        <img
          :src="'../items/' + item.itemId + '.png'"
          class="item-img"
          draggable="true"
          @error="$event.target.src = '../items/default.png'"
          @dragstart.stop="$emit('dragstart', slotId)"
        />
        <span
          v-if="countLabel"
          class="item-count"
          :class="{ 'item-count--ammo': countLabel.weapon }"
        >{{ countLabel.text }}</span>
      </template>
    </div>
  `,
}
