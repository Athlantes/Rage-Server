const BankApp = {
  name: 'BankApp',
  props: {
    balance: { type: Number, default: 0 },
    history: { type: Array,  default: () => [] },
    modal:   { type: Object, default: () => ({ visible: false, step: 1, target: '', amount: '' }) },
    getTime: { type: Function, default: () => 'now' },
  },
  emits: ['back', 'open-transfer', 'close-transfer', 'verify-transfer', 'submit-transfer', 'reset-modal'],
  data() {
    return { localTarget: '', localAmount: '' }
  },
  computed: {
    recentHistory() {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 2)
      return this.history.filter(tx => new Date(tx.created_at) >= cutoff)
    },
  },
  methods: {
    verify() {
      this.$emit('verify-transfer', { target: this.localTarget, amount: this.localAmount })
    },
    submit() {
      this.$emit('submit-transfer')
      this.localTarget = ''
      this.localAmount = ''
    },
    txColor(tx) {
      return ['deposit','transfer_in','salary'].includes(tx.type) ? '#34c759' : '#ff3b30'
    },
    txSign(tx) {
      return ['deposit','transfer_in','salary'].includes(tx.type) ? '+' : '-'
    },
  },
  template: `
    <div id="view-bank" class="view">
      <div class="app-header bank-header" style="background:transparent; color:#333; border:none; flex-shrink:0;">
        <button class="back-btn" style="color:#333;" @click="$emit('back')"><i class="fas fa-chevron-left"></i></button>
        <span style="font-weight:800; font-size:18px;">Fleeca</span>
        <div style="width:20px;"></div>
      </div>

      <div class="app-content bank-content">
        <div class="bank-fixed-top">
          <div class="bank-card">
            <div class="card-top">
              <div class="card-chip"></div>
              <i class="fas fa-wifi card-contactless"></i>
            </div>
            <div class="card-balance-group">
              <span class="currency">$</span>
              <span>{{ balance.toLocaleString() }}</span>
            </div>
            <div class="card-details">
              <div class="card-holder">PERSONAL ACCOUNT</div>
              <div class="card-logo">FLEECA</div>
            </div>
          </div>

          <div class="bank-actions-grid">
            <div class="bank-action-btn" @click="$emit('open-transfer')">
              <div class="action-icon-box" style="background:#00a8ff;"><i class="fas fa-paper-plane"></i></div>
              <span>Transfer</span>
            </div>
            <div class="bank-action-btn">
              <div class="action-icon-box" style="background:#ff9500;"><i class="fas fa-file-invoice-dollar"></i></div>
              <span>Bills</span>
            </div>
            <div class="bank-action-btn">
              <div class="action-icon-box" style="background:#34c759;"><i class="fas fa-arrow-down"></i></div>
              <span>Request</span>
            </div>
            <div class="bank-action-btn">
              <div class="action-icon-box" style="background:#8e8e93;"><i class="fas fa-ellipsis-h"></i></div>
              <span>More</span>
            </div>
          </div>
        </div>

        <div class="bank-section-title">
          <span style="font-weight:bold; font-size:16px;">Recent Activity</span>
          <span style="font-size:12px; color:#888;">Last 48h</span>
        </div>

        <div class="bank-history-list">
          <div
            v-if="recentHistory.length === 0"
            style="text-align:center; padding:20px; color:#aaa;"
          >No recent activity</div>
          <div v-for="(tx, i) in recentHistory" :key="i" class="bank-item">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:600; font-size:14px;">{{ tx.description || 'Transaction' }}</span>
              <span :style="{ color: txColor(tx), fontWeight: 'bold', fontSize: '14px' }">
                {{ txSign(tx) }}${{ (tx.amount || 0).toLocaleString() }}
              </span>
            </div>
            <div style="font-size:11px; color:rgba(0,0,0,0.35); text-align:right;">{{ getTime(tx.created_at) }}</div>
          </div>
        </div>
      </div>

      <!-- Transfer Modal -->
      <div v-if="modal.visible" class="modal-overlay">
        <div class="modal-box">
          <h3>{{ modal.step === 1 ? 'Send Money' : 'Confirm Transfer' }}</h3>

          <div v-if="modal.step === 1">
            <div class="input-group">
              <label>Recipient Name or ID</label>
              <input v-model="localTarget" type="text" placeholder="John Doe">
            </div>
            <div class="input-group">
              <label>Amount</label>
              <input v-model="localAmount" type="number" placeholder="0">
            </div>
            <div class="modal-buttons">
              <button class="btn-cancel"  @click="$emit('close-transfer')">Cancel</button>
              <button class="btn-confirm" @click="verify">Next</button>
            </div>
          </div>

          <div v-else>
            <p style="color:#666; margin-bottom:20px;">
              Are you sure you want to send
              <strong>${{ parseFloat(modal.amount).toLocaleString() }}</strong>
              to <strong>{{ modal.target }}</strong>?
            </p>
            <div class="modal-buttons">
              <button class="btn-cancel"  @click="$emit('reset-modal')">Back</button>
              <button class="btn-confirm" @click="submit">Confirm</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
}
