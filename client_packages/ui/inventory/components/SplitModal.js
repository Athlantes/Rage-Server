/**
 * SplitModal.js
 * Modal dialog for splitting item stacks.
 * Uses v-model:amount so the parent controls the input value.
 * Auto-focuses the input when it becomes visible via a watcher.
 */
const SplitModal = {
  name: 'SplitModal',

  props: {
    visible: { type: Boolean, required: true },
    max:     { type: Number,  default: 0 },
    amount:  { type: String,  default: '' },
  },

  emits: ['update:amount', 'confirm', 'cancel'],

  watch: {
    visible(val) {
      if (val) {
        this.$nextTick(() => this.$refs.input?.focus())
      }
    },
  },

  methods: {
    onInput(e) {
      this.$emit('update:amount', e.target.value)
    },
    onKey(e) {
      if (e.key === 'Enter')  this.$emit('confirm')
      if (e.key === 'Escape') this.$emit('cancel')
    },
  },

  template: `
    <transition name="modal">
      <div
        v-if="visible"
        id="split-modal"
        @click.self="$emit('cancel')"
      >
        <div class="modal-box">
          <div class="modal-title">Split Item</div>
          <input
            ref="input"
            type="number"
            class="modal-input"
            placeholder="Amount"
            :value="amount"
            :max="max - 1"
            min="1"
            @input="onInput"
            @keydown="onKey"
          />
          <div class="modal-actions">
            <button class="btn btn-cancel" @click="$emit('cancel')">Cancel</button>
            <button class="btn btn-confirm" @click="$emit('confirm')">Split</button>
          </div>
        </div>
      </div>
    </transition>
  `,
}
