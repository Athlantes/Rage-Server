const WallpaperPicker = {
  name: 'WallpaperPicker',
  props: {
    wallpapers: { type: Array,  default: () => [] },
    current:    { type: String, default: '' },
    customUrl:  { type: String, default: '' },
  },
  emits: ['back', 'select', 'apply-custom', 'update:customUrl'],
  methods: {
    wallPath(wall) {
      return `package://phone/ui/images/wallpapers/${wall}`
    },
  },
  template: `
    <div id="view-settings-wallpapers" class="view">
      <div class="app-header">
        <button class="back-btn" @click="$emit('back')"><i class="fas fa-chevron-left"></i></button>
        <span>Wallpapers</span>
      </div>

      <div class="scrollable-content" style="background:#f5f5f8;">
        <div class="wallpaper-section-title">Choose a Wallpaper</div>
        <div class="wallpaper-grid">
          <div
            v-for="wall in wallpapers"
            :key="wall"
            class="wallpaper-item"
            :class="{ selected: current === wall }"
            :style="{ backgroundImage: 'url(' + wallPath(wall) + ')' }"
            @click="$emit('select', wall)"
          ></div>
        </div>

        <div class="custom-wall-card">
          <div class="custom-wall-header">
            <i class="fas fa-link"></i>
            <span>Custom Image</span>
          </div>
          <div class="custom-wall-body">
            <input
              type="text"
              placeholder="https://imgur.com/..."
              autocomplete="off"
              :value="customUrl"
              @input="$emit('update:customUrl', $event.target.value)"
            >
            <button class="btn-primary-blue" @click="$emit('apply-custom', customUrl)">
              Set Wallpaper
            </button>
          </div>
          <div class="custom-wall-hint">Supported links: Imgur, Discord, Direct Links</div>
        </div>

        <div style="height:40px;"></div>
      </div>
    </div>
  `,
}
