/**
 * NotifStack.js
 * Renders a stack of toast notifications using <transition-group>.
 * Each notification auto-removes itself after 5 seconds (managed by the app).
 * The enter/leave animations are defined in index.html CSS (.notif-* classes).
 */
const NotifStack = {
  name: 'NotifStack',

  props: {
    notifications: { type: Array, default: () => [] },
  },

  template: `
    <div id="notif-stack">
      <transition-group name="notif" tag="div" class="notif-inner">
        <div
          v-for="n in notifications"
          :key="n.id"
          class="notif-card"
        >
          <div class="notif-title">{{ n.title }}</div>
          <div class="notif-msg">{{ n.message }}</div>
        </div>
      </transition-group>
    </div>
  `,
}
