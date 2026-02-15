const MailApp = {
  name: 'MailApp',
  props: {
    mails:   { type: Array,    default: () => [] },
    getTime: { type: Function, default: () => 'now' },
  },
  emits: ['back', 'read-all', 'open-mail'],
  template: `
    <div id="view-mail" class="view">
      <div class="app-header" style="justify-content:space-between;">
        <div style="display:flex; align-items:center;">
          <button class="back-btn" @click="$emit('back')"><i class="fas fa-chevron-left"></i></button>
          <span>Inbox</span>
        </div>
        <button
          @click="$emit('read-all')"
          style="background:none; border:none; color:#00a8ff; font-size:13px; font-weight:700;
                 cursor:pointer; font-family:'Poppins',sans-serif; text-transform:uppercase; letter-spacing:0.5px;"
        >Read All</button>
      </div>

      <div class="scrollable-content" style="background:#f5f5f8; padding:10px;">
        <div
          v-if="mails.length === 0"
          style="padding:20px; text-align:center; color:#999;"
        >No Mail</div>

        <div
          v-for="mail in mails"
          :key="mail.id"
          class="mail-item"
          :class="{ read: mail.is_read }"
          @click="$emit('open-mail', mail)"
        >
          <div class="mail-header-row" style="display:flex; justify-content:space-between; align-items:baseline;">
            <div class="mail-sender">{{ mail.sender }}</div>
            <div class="mail-time" style="font-size:11px; color:rgba(0,0,0,0.35);">{{ getTime(mail.created_at) }}</div>
          </div>
          <div class="mail-title">{{ mail.title }}</div>
          <div class="mail-msg">{{ mail.message }}</div>
        </div>
      </div>
    </div>
  `,
}
