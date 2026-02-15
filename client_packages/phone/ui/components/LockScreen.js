const LockScreen = {
  name: 'LockScreen',
  props: {
    clockTime:     String,
    clockDate:     String,
    notifications: { type: Array, default: () => [] },
  },
  emits: ['unlock', 'open-app', 'dismiss'],
  methods: {
    startDrag(e, notif) {
      const el     = e.currentTarget
      const startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX
      el._dragStart = startX

      const onMove = (ev) => {
        const x  = ev.type === 'mousemove' ? ev.clientX : ev.touches[0].clientX
        const dx = x - el._dragStart
        if (dx > 0) {
          el.style.transform = `translateX(${dx}px)`
          el.style.opacity   = Math.max(0, 1 - dx / 200)
        }
      }

      const onEnd = (ev) => {
        const x  = ev.type === 'mouseup'
          ? ev.clientX
          : (ev.changedTouches ? ev.changedTouches[0].clientX : el._dragStart)
        const dx = x - el._dragStart
        if (dx > 80) {
          el.style.transition = 'transform 0.2s, opacity 0.2s'
          el.style.transform  = 'translateX(300px)'
          el.style.opacity    = '0'
          setTimeout(() => this.$emit('dismiss', notif.id), 200)
        } else {
          el.style.transition = 'transform 0.2s, opacity 0.2s'
          el.style.transform  = 'translateX(0)'
          el.style.opacity    = '1'
          setTimeout(() => { el.style.transition = '' }, 200)
        }
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup',   onEnd)
        document.removeEventListener('touchmove', onMove)
        document.removeEventListener('touchend',  onEnd)
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup',   onEnd)
      document.addEventListener('touchmove', onMove, { passive: true })
      document.addEventListener('touchend',  onEnd)
    },

    tapNotif(notif) {
      this.$emit('dismiss', notif.id)
      this.$emit('open-app', notif.appId)
    },
  },
  template: `
    <div id="view-lock" class="view active" @click="$emit('unlock')">
      <div class="lock-content">
        <div class="lock-time-group">
          <div id="lock-clock">{{ clockTime }}</div>
          <div id="lock-date">{{ clockDate }}</div>
        </div>

        <div id="lock-notification-list">
          <div
            v-for="notif in notifications"
            :key="notif.id"
            class="lock-notif-item"
            @click.stop="tapNotif(notif)"
            @mousedown.stop="startDrag($event, notif)"
            @touchstart.stop="startDrag($event, notif)"
          >
            <div class="lock-notif-icon" :style="{ background: notif.config.color }">
              <i :class="notif.config.icon"></i>
            </div>
            <div class="lock-notif-content">
              <div class="lock-notif-title">{{ notif.title }}</div>
              <div class="lock-notif-msg">{{ notif.message }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="unlock-hint" @click.stop="$emit('unlock')">
        <div class="bar"></div>
        <span>Click to Unlock</span>
      </div>
    </div>
  `,
}
