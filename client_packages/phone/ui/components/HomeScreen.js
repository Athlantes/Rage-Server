const HomeScreen = {
  name: 'HomeScreen',
  props: {
    mailBadge:  { type: Number, default: 0 },
    phoneBadge: { type: Number, default: 0 },
  },
  emits: ['open'],
  template: `
    <div id="view-home" class="view">
      <div class="app-grid">

        <div class="app-icon" @click="$emit('open', 'mail')">
          <div class="icon-box color-blue">
            <i class="fas fa-envelope"></i>
            <div v-if="mailBadge > 0" class="app-badge">{{ mailBadge > 9 ? '9+' : mailBadge }}</div>
          </div>
          <span class="app-name">Mail</span>
        </div>

        <div class="app-icon" @click="$emit('open', 'vehicles')">
          <div class="icon-box color-yellow">
            <i class="fas fa-truck-moving"></i>
          </div>
          <span class="app-name">My Cars</span>
        </div>

        <div class="app-icon" @click="$emit('open', 'settings')">
          <div class="icon-box color-gray">
            <i class="fas fa-cog"></i>
          </div>
          <span class="app-name">Settings</span>
        </div>

        <div class="app-icon" @click="$emit('open', 'bank')">
          <div class="icon-box" style="background: linear-gradient(135deg,#1abc9c,#16a085);">
            <i class="fas fa-university"></i>
          </div>
          <span class="app-name">Bank</span>
        </div>

        <div class="app-icon" @click="$emit('open', 'quickeats')">
          <div class="icon-box" style="background: linear-gradient(135deg,#00b09b,#96c93d);">
            <i class="fas fa-hamburger"></i>
          </div>
          <span class="app-name">QuickEats</span>
        </div>

        <div class="app-icon" @click="$emit('open', 'escootr')">
          <div class="icon-box" style="background: linear-gradient(135deg,#56ab2f,#a8e063);">
            <i class="fas fa-bolt"></i>
          </div>
          <span class="app-name">eScootr</span>
        </div>

        <div class="app-icon" @click="$emit('open', 'gallery')">
          <div class="icon-box" style="background: linear-gradient(135deg,#ff9a9e,#fecfef);">
            <i class="fas fa-images"></i>
          </div>
          <span class="app-name">Gallery</span>
        </div>

        <div class="app-icon" @click="$emit('open', 'camera')">
          <div class="icon-box" style="background: linear-gradient(135deg,#757F9A,#D7DDE8);">
            <i class="fas fa-camera"></i>
          </div>
          <span class="app-name">Camera</span>
        </div>

        <div class="app-icon" @click="$emit('open', 'phone-app')">
          <div class="icon-box" style="background: linear-gradient(135deg,#4cd964,#2ecc71);">
            <i class="fas fa-phone-alt"></i>
            <div v-if="phoneBadge > 0" class="app-badge">{{ phoneBadge > 9 ? '9+' : phoneBadge }}</div>
          </div>
          <span class="app-name">Phone</span>
        </div>

      </div>
    </div>
  `,
}
