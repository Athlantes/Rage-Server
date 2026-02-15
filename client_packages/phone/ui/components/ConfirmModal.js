const ConfirmModal = {
  name: 'ConfirmModal',
  props: {
    title:    { type: String, default: 'Confirmation' },
    text:     { type: String, default: 'Are you sure?' },
    btnLabel: { type: String, default: 'Confirm' },
    btnColor: { type: String, default: '#00a8ff' },
  },
  emits: ['confirm', 'cancel'],
  template: `
    <div class="modal-overlay">
      <div class="modal-box">
        <h3>{{ title }}</h3>
        <p style="color:#666; margin-bottom:20px;">{{ text }}</p>
        <div class="modal-buttons">
          <button class="btn-cancel"  @click="$emit('cancel')">Cancel</button>
          <button class="btn-confirm" :style="{ background: btnColor }" @click="$emit('confirm')">{{ btnLabel }}</button>
        </div>
      </div>
    </div>
  `,
}
