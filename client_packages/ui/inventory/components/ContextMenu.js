/**
 * ContextMenu.js
 * Floating right-click context menu.
 * Each option is a { label, action } object built by the parent app.
 * Uses Vue <transition> for a smooth scale-in/out effect.
 */
const ContextMenu = {
  name: 'ContextMenu',

  props: {
    visible: { type: Boolean, required: true },
    x:       { type: Number,  default: 0 },
    y:       { type: Number,  default: 0 },
    options: { type: Array,   default: () => [] },
  },

  emits: ['close'],

  methods: {
    execute(option) {
      option.action()
      this.$emit('close')
    },
  },

  template: `
    <transition name="ctx">
      <div
        v-if="visible"
        id="context-menu"
        :style="{ left: x + 'px', top: y + 'px' }"
        @click.stop
      >
        <div
          v-for="(opt, i) in options"
          :key="i"
          class="ctx-item"
          @click="execute(opt)"
        >{{ opt.label }}</div>
      </div>
    </transition>
  `,
}
