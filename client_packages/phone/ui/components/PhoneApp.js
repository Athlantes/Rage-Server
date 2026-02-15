const PhoneApp = {
  name: 'PhoneApp',
  props: {
    tab:          { type: String, default: 'keypad' },
    dialBuffer:   { type: String, default: '' },
    contacts:     { type: Array,  default: () => [] },
    messages:     { type: Array,  default: () => [] },
    allContacts:  { type: Array,  default: () => [] },
    mediaBaseUrl: { type: String, default: '' },
  },
  emits: [
    'switch-tab', 'press-key', 'press-del', 'start-call',
    'add-number', 'open-chat', 'open-contact-edit', 'filter-contacts',
  ],
  computed: {
    conversations() {
      const groups = {}
      this.messages.forEach(msg => {
        if (!groups[msg.number]) groups[msg.number] = []
        groups[msg.number].push(msg)
      })
      const keys = Object.keys(groups)
      keys.sort((a, b) => {
        const lastA = groups[a][groups[a].length - 1]
        const lastB = groups[b][groups[b].length - 1]
        return new Date(lastB.time) - new Date(lastA.time)
      })
      return keys.map(num => {
        const thread  = groups[num]
        const last    = thread[thread.length - 1]
        const contact = this.allContacts.find(c => c.number == num)
        const name    = contact ? contact.name : num
        const hasUnread = thread.some(m => !m.isMine && !m.is_read)
        let preview = last.body
        if (last.type === 'location') preview = '📍 Location Shared'
        if (last.type === 'photo')    preview = '📷 Photo Sent'
        return { num, name, last, hasUnread, preview, isMine: last.isMine }
      })
    },
  },
  methods: {
    getRelativeTime(ds) {
      if (!ds) return 'now'
      const s = Math.floor((Date.now() - new Date(ds)) / 1000)
      if (s < 60) return 'now'
      const m = Math.floor(s / 60)
      if (m < 60) return `${m}m ago`
      const h = Math.floor(m / 60)
      if (h < 24) return `${h}h ago`
      return `${Math.floor(h / 24)}d ago`
    },
    avatarColor(name) {
      return '#' + Math.floor(name.charCodeAt(0) * 123456).toString(16).slice(0, 6)
    },
    dialFromContact(number) {
      // fill dial buffer then switch to keypad
      for (const ch of number) this.$emit('press-key', ch)
      this.$emit('switch-tab', 'keypad')
    },
  },
  template: `
    <div id="view-phone-app" class="view" style="background:#f5f5f8;">

      <!-- Keypad Tab -->
      <div v-show="tab === 'keypad'" class="phone-tab-content">
        <div class="keypad-display">
          <div class="keypad-input">{{ dialBuffer }}</div>
          <div
            v-if="dialBuffer.length > 0"
            class="keypad-sub"
            @click="$emit('add-number')"
          >+ Add to Contacts</div>
        </div>

        <div class="keypad-grid">
          <div class="key-btn" @click="$emit('press-key', '1')">1</div>
          <div class="key-btn" @click="$emit('press-key', '2')">2<span>ABC</span></div>
          <div class="key-btn" @click="$emit('press-key', '3')">3<span>DEF</span></div>
          <div class="key-btn" @click="$emit('press-key', '4')">4<span>GHI</span></div>
          <div class="key-btn" @click="$emit('press-key', '5')">5<span>JKL</span></div>
          <div class="key-btn" @click="$emit('press-key', '6')">6<span>MNO</span></div>
          <div class="key-btn" @click="$emit('press-key', '7')">7<span>PQRS</span></div>
          <div class="key-btn" @click="$emit('press-key', '8')">8<span>TUV</span></div>
          <div class="key-btn" @click="$emit('press-key', '9')">9<span>WXYZ</span></div>
          <div class="key-btn" @click="$emit('press-key', '*')">*</div>
          <div class="key-btn" @click="$emit('press-key', '0')">0<span>+</span></div>
          <div class="key-btn" @click="$emit('press-key', '#')">#</div>
        </div>

        <div class="keypad-actions">
          <button class="btn-call" @click="$emit('start-call')">
            <i class="fas fa-phone-alt"></i>
          </button>
          <button
            v-if="dialBuffer.length > 0"
            class="btn-del"
            @click="$emit('press-del')"
          ><i class="fas fa-backspace"></i></button>
        </div>
      </div>

      <!-- Messages Tab -->
      <div v-show="tab === 'recent'" class="phone-tab-content">
        <div class="app-header"><span>Messages</span></div>
        <div class="scrollable-content">
          <div v-if="conversations.length === 0" style="text-align:center; padding:30px; color:#aaa; font-size:14px;">No messages</div>
          <div
            v-for="conv in conversations"
            :key="conv.num"
            class="msg-row"
            :style="conv.hasUnread ? 'background:rgba(0,168,255,0.06);' : ''"
            @click="$emit('open-chat', conv.num, conv.name)"
          >
            <div class="msg-header">
              <span class="msg-sender" :style="conv.hasUnread ? 'font-weight:800;color:#00a8ff;' : ''">
                {{ conv.name }} <span v-if="conv.hasUnread">●</span>
              </span>
              <span class="msg-date">{{ getRelativeTime(conv.last.time) }}</span>
            </div>
            <div class="msg-preview" :style="conv.hasUnread ? 'font-weight:600;color:#1a1a2e;' : ''">
              <span v-if="conv.isMine">You: </span>{{ conv.preview }}
            </div>
          </div>
        </div>
      </div>

      <!-- Contacts Tab -->
      <div v-show="tab === 'contacts'" class="phone-tab-content">
        <div class="app-header">
          <span>Contacts</span>
          <i
            class="fas fa-plus"
            style="color:#00a8ff; margin-left:auto; cursor:pointer;"
            @click="$emit('open-contact-edit', '')"
          ></i>
        </div>
        <div class="search-bar-container">
          <input type="text" placeholder="Search" @input="$emit('filter-contacts', $event.target.value)">
        </div>
        <div class="scrollable-content contact-list-group">
          <div
            v-for="c in contacts"
            :key="c.number"
            class="contact-row"
            @click="dialFromContact(c.number)"
          >
            <div class="contact-avatar" :style="{ background: avatarColor(c.name) }">
              {{ c.name[0] }}
            </div>
            <div class="contact-name">{{ c.name }}</div>
            <div class="contact-actions">
              <div class="c-act-btn" @click.stop="$emit('open-chat', c.number, c.name)">
                <i class="fas fa-comment"></i>
              </div>
              <div class="c-act-btn" @click.stop="$emit('press-key', c.number); $emit('start-call')">
                <i class="fas fa-phone"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab Bar -->
      <div class="phone-tab-bar">
        <div class="tab-item" :class="{ active: tab === 'keypad' }"  @click="$emit('switch-tab', 'keypad')">
          <i class="fas fa-th"></i><span>Keypad</span>
        </div>
        <div class="tab-item" :class="{ active: tab === 'recent' }"  @click="$emit('switch-tab', 'recent')">
          <i class="fas fa-comment"></i><span>Messages</span>
        </div>
        <div class="tab-item" :class="{ active: tab === 'contacts' }" @click="$emit('switch-tab', 'contacts')">
          <i class="fas fa-user-friends"></i><span>Contacts</span>
        </div>
      </div>
    </div>
  `,
}
