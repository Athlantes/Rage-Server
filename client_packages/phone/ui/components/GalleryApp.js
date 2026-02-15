const GalleryApp = {
  name: 'GalleryApp',
  props: {
    photos:       { type: Array,  default: () => [] },
    mediaBaseUrl: { type: String, default: '' },
    mode:         { type: String, default: 'view' },
  },
  emits: ['back', 'open-photo', 'pick-photo'],
  template: `
    <div id="view-gallery" class="view">
      <div class="app-header">
        <button id="btn-gallery-back" class="back-btn" @click="$emit('back')">
          <i class="fas fa-chevron-left"></i>
        </button>
        <span>{{ mode === 'pick' ? 'Select Photo' : 'Gallery' }}</span>
        <span class="gallery-count">{{ photos.length > 0 ? photos.length : '' }}</span>
      </div>

      <div class="scrollable-content gallery-grid">
        <div v-if="photos.length === 0" class="gallery-empty">
          <i class="fas fa-camera"></i>
          <span>No photos yet</span>
        </div>

        <div
          v-for="photo in photos"
          :key="photo.id"
          class="gallery-item"
          @click="mode === 'pick' ? $emit('pick-photo', photo) : $emit('open-photo', photo)"
        >
          <img :src="mediaBaseUrl + photo.image_path" loading="lazy">
        </div>
      </div>
    </div>
  `,
}
