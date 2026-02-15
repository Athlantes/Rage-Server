const PhotoDetail = {
  name: 'PhotoDetail',
  props: {
    photo:        { type: Object, default: () => ({}) },
    mediaBaseUrl: { type: String, default: '' },
  },
  emits: ['back', 'delete'],
  computed: {
    formattedDate() {
      if (!this.photo || !this.photo.created_at) return ''
      const d = new Date(this.photo.created_at)
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    },
    src() {
      if (!this.photo) return ''
      return this.mediaBaseUrl + this.photo.image_path
    },
  },
  template: `
    <div id="view-photo-detail" class="view" style="background:#0a0a0a;">
      <div class="app-header" style="background:rgba(10,10,10,0.8); backdrop-filter:blur(10px); color:white; border:none; position:absolute; top:0; width:100%; z-index:10;">
        <button class="back-btn" style="color:white;" @click="$emit('back')">
          <i class="fas fa-chevron-left"></i>
        </button>
        <span style="font-size:13px; font-weight:500; font-family:'Poppins',sans-serif; opacity:0.7;">{{ formattedDate }}</span>
        <button
          @click="$emit('delete')"
          style="margin-left:auto; background:none; border:none; color:#ff4757; font-size:16px; cursor:pointer;"
        ><i class="fas fa-trash"></i></button>
      </div>

      <div class="photo-full-container">
        <img :src="src" alt="Photo">
      </div>
    </div>
  `,
}
