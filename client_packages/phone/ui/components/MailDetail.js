const MailDetail = {
  name: 'MailDetail',
  props: {
    mail: { type: Object, default: () => ({}) },
  },
  emits: ['back'],
  template: `
    <div id="view-mail-detail" class="view">
      <div class="app-header">
        <button class="back-btn" @click="$emit('back')"><i class="fas fa-chevron-left"></i></button>
        <span>From: {{ mail && mail.sender }}</span>
      </div>
      <div class="scrollable-content detail-container">
        <div class="stat-box">
          <h3 style="margin-top:0; color:#1a1a2e;">{{ mail && mail.title }}</h3>
          <p style="color:#555; line-height:1.4; white-space:pre-wrap;">{{ mail && mail.message }}</p>
        </div>
      </div>
    </div>
  `,
}
