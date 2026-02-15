const ChatThread = {
  name: 'ChatThread',
  props: {
    activeChat:      { type: Object, default: () => ({}) },
    messages:        { type: Array,  default: () => [] },
    mediaBaseUrl:    { type: String, default: '' },
    showAttachMenu:  Boolean,
    chatInput:       String,
  },
  emits: [
    'back', 'send', 'toggle-attach',
    'req-location', 'req-photo', 'req-camera',
    'set-waypoint', 'view-photo',
    'update:chatInput',
  ],
  updated() {
    this.$nextTick(() => {
      const el = this.$refs.bubbles
      if (el) el.scrollTop = el.scrollHeight
    })
  },
  methods: {
    handleKeyup(e) {
      if (e.key === 'Enter') this.$emit('send')
    },
  },
  template: `
    <div id="view-chat-thread" class="view" style="background:#f5f5f8;">
      <div class="app-header">
        <button class="back-btn" @click="$emit('back')"><i class="fas fa-chevron-left"></i></button>
        <span>{{ activeChat.name || activeChat.number }}</span>
      </div>

      <div ref="bubbles" class="scrollable-content chat-container">
        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="chat-bubble"
          :class="[
            msg.isMine ? 'mine' : 'theirs',
            msg.type === 'location' ? 'location-bubble' : '',
            msg.type === 'photo'    ? 'photo-bubble'    : '',
          ]"
          @click="msg.type === 'location' ? $emit('set-waypoint', msg.body)
                : msg.type === 'photo'    ? $emit('view-photo', { image_path: msg.body, created_at: msg.time })
                : null"
        >
          <!-- Location bubble -->
          <template v-if="msg.type === 'location'">
            <i class="fas fa-map-marker-alt"></i>
            <span>Location</span>
          </template>

          <!-- Photo bubble -->
          <template v-else-if="msg.type === 'photo'">
            <img :src="mediaBaseUrl + msg.body" alt="Photo">
          </template>

          <!-- Text bubble -->
          <template v-else>{{ msg.body }}</template>
        </div>
      </div>

      <!-- Attachment menu -->
      <div v-if="showAttachMenu" class="attachment-menu">
        <div class="attach-item" @click="$emit('req-location')">
          <div class="attach-icon color-red"><i class="fas fa-map-marker-alt"></i></div>
          <span>Location</span>
        </div>
        <div class="attach-item" @click="$emit('req-photo')">
          <div class="attach-icon color-yellow"><i class="fas fa-image"></i></div>
          <span>Photo</span>
        </div>
        <div class="attach-item" @click="$emit('req-camera')">
          <div class="attach-icon color-gray"><i class="fas fa-camera"></i></div>
          <span>Camera</span>
        </div>
      </div>

      <div class="chat-input-area">
        <button class="btn-attach" @click="$emit('toggle-attach')">
          <i class="fas fa-plus"></i>
        </button>
        <input
          type="text"
          placeholder="Type a message..."
          :value="chatInput"
          @input="$emit('update:chatInput', $event.target.value)"
          @keyup="handleKeyup"
        >
        <button @click="$emit('send')"><i class="fas fa-arrow-up"></i></button>
      </div>
    </div>
  `,
}
