const SettingsApp = {
  name: 'SettingsApp',
  props: {
    settings: { type: Object, default: () => ({}) },
  },
  emits: ['back', 'toggle-dnd', 'toggle-flight', 'set-zoom', 'open-wallpapers'],
  template: `
    <div id="view-settings" class="view">
      <div class="app-header" style="background:#ffffff; color:#1a1a2e; border-bottom:1px solid rgba(0,0,0,0.06);">
        <button class="back-btn" style="color:#00a8ff;" @click="$emit('back')"><i class="fas fa-chevron-left"></i></button>
        <span style="font-weight:700;">Settings</span>
      </div>

      <div class="scrollable-content" style="background:#f5f5f8; padding-top:20px;">

        <!-- Phone number -->
        <div class="settings-group">
          <div class="settings-item" style="height:80px;">
            <div class="settings-avatar"><i class="fas fa-user"></i></div>
            <div class="settings-info">
              <div class="settings-label">My Number</div>
              <div class="settings-value">{{ settings.phoneNumber }}</div>
            </div>
          </div>
        </div>

        <!-- Toggles -->
        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-icon" style="background:#ff9500;"><i class="fas fa-plane"></i></div>
            <div class="settings-label">Airplane Mode</div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="settings.isFlightMode"
                @change="$emit('toggle-flight', $event.target.checked)"
              >
              <span class="slider round"></span>
            </label>
          </div>
          <div class="settings-item">
            <div class="settings-icon" style="background:#5856d6;"><i class="fas fa-moon"></i></div>
            <div class="settings-label">Do Not Disturb</div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="settings.isDnd"
                @change="$emit('toggle-dnd', $event.target.checked)"
              >
              <span class="slider round"></span>
            </label>
          </div>
        </div>

        <!-- Wallpaper + Zoom -->
        <div class="settings-group">
          <div class="settings-item" @click="$emit('open-wallpapers')">
            <div class="settings-icon" style="background:#2ecc71;"><i class="fas fa-image"></i></div>
            <div class="settings-label">Wallpaper</div>
            <div class="settings-chevron"><i class="fas fa-chevron-right"></i></div>
          </div>

          <div class="settings-item-col">
            <div style="display:flex; justify-content:space-between; width:100%; margin-bottom:5px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div class="settings-icon" style="background:#00a8ff;"><i class="fas fa-search-plus"></i></div>
                <div class="settings-label">Zoom</div>
              </div>
              <span style="color:#888; font-size:13px;">{{ settings.zoomLevel }}%</span>
            </div>
            <input
              type="range" min="70" max="130"
              :value="settings.zoomLevel"
              class="zoom-slider"
              @input="$emit('set-zoom', $event.target.value)"
            >
          </div>
        </div>

      </div>
    </div>
  `,
}
