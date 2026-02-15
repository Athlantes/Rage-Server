const ToastShell = {
  name: 'ToastShell',
  props: {
    visible: Boolean,
    config:  { type: Object, default: () => ({}) },
    title:   String,
    message: String,
    clock:   String,
    isDnd:   Boolean,
  },
  template: `
    <div id="toast-shell" :class="{ active: visible }">
      <div class="toast-screen">
        <div class="status-bar">
          <span>{{ clock }}</span>
          <div class="status-icons">
            <i v-if="isDnd" class="fas fa-moon" style="font-size:11px; margin-right:4px;"></i>
            <i class="fas fa-signal"></i>
            <i class="fas fa-wifi"></i>
            <i class="fas fa-battery-full"></i>
          </div>
        </div>
        <div id="toast-content-area">
          <div class="toast-card">
            <div class="toast-icon-box" :style="{ background: config.color }">
              <i :class="config.icon"></i>
            </div>
            <div class="toast-text-group">
              <div class="toast-header">
                <span id="toast-sender">{{ config.title }}</span>
                <span class="toast-time">Now</span>
              </div>
              <div id="toast-message">{{ title }}: {{ message }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
}
