const ContactEdit = {
  name: 'ContactEdit',
  props: {
    prefillNumber: { type: String, default: '' },
  },
  emits: ['save', 'cancel'],
  data() {
    return { name: '', number: this.prefillNumber }
  },
  watch: {
    prefillNumber(val) { this.number = val }
  },
  methods: {
    save() { this.$emit('save', { name: this.name, number: this.number }) },
  },
  template: `
    <div id="view-contact-edit" class="view" style="background:#f5f5f8;">
      <div class="app-header">
        <button class="back-btn" @click="$emit('cancel')">Cancel</button>
        <span style="font-weight:700;">New Contact</span>
        <button
          class="text-btn"
          style="color:#00a8ff; border:none; background:none; font-weight:bold; margin-left:auto;"
          @click="save"
        >Done</button>
      </div>

      <div style="padding-top:30px; display:flex; flex-direction:column; align-items:center;">
        <div class="contact-avatar-large"><i class="fas fa-user"></i></div>
        <div class="edit-group">
          <input v-model="name"   type="text" placeholder="First Name">
          <div class="divider"></div>
          <input v-model="number" type="text" placeholder="Phone Number">
        </div>
      </div>
    </div>
  `,
}
