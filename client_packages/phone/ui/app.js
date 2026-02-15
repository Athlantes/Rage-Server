/**
 * app.js — client_packages/phone/ui/
 * Vue 3 root for the phone CEF.
 *
 * Global window bridge (called by client_packages/phone/index.js):
 *   openPhone()
 *   closePhone()
 *   + all per-feature bridges defined in setup()
 */

const { createApp, ref, reactive, computed, watch, onMounted, nextTick } = Vue

// ── App / notification config ──────────────────────────────────────────────────
const NOTIFICATION_APPS = {
  mail:      { color: '#00a8ff', icon: 'fas fa-envelope',    title: 'Mail'      },
  phone:     { color: '#34c759', icon: 'fas fa-phone-alt',   title: 'Phone'     },
  bank:      { color: '#1abc9c', icon: 'fas fa-university',  title: 'Fleeca'    },
  scooter:   { color: '#56ab2f', icon: 'fas fa-bolt',        title: 'eScootr'   },
  quickeats: { color: '#ff9500', icon: 'fas fa-hamburger',   title: 'QuickEats' },
  vehicles:  { color: '#f1c40f', icon: 'fas fa-car',         title: 'Vehicles'  },
  system:    { color: '#636366', icon: 'fas fa-cog',         title: 'System'    },
}

const WALLPAPERS = ['wall1.jpg','wall2.jpg','wall3.jpg','wall4.jpg','wall5.jpg','wall6.jpg']
const GRADE_COLORS = { S:'#ff4757', A:'#ff6b35', B:'#f39c12', C:'#2ecc71', D:'#00a8ff', E:'#8a8fa6', F:'#555' }

function mpTrigger(event, ...args) {
  if ('mp' in window) mp.trigger(event, ...args)
}

function getRelativeTime(dateString) {
  if (!dateString) return 'now'
  const now  = new Date()
  const past = new Date(dateString)
  if (isNaN(past.getTime())) return 'recently'
  const s = Math.floor((now - past) / 1000)
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Root component ─────────────────────────────────────────────────────────────
const App = {
  components: {
    LockScreen, HomeScreen, ToastShell, ConfirmModal,
    PhoneApp, ChatThread, ContactEdit,
    MailApp, MailDetail, VehiclesApp, VehicleDetail,
    BankApp, SettingsApp, WallpaperPicker,
    GalleryApp, PhotoDetail, QuickEatsApp, EScootrApp,
  },

  template: `
    <!-- Toast shell — always rendered, slides in/out via CSS class -->
    <toast-shell
      :visible="toast.visible"
      :config="toast.config"
      :title="toast.title"
      :message="toast.message"
      :clock="clockTime"
      :is-dnd="settings.isDnd"
    />

    <!-- Phone shell -->
    <div v-show="isPhoneVisible" id="phone-shell" :style="phoneShellStyle">
      <div class="screen-content" :style="wallpaperStyle">

        <!-- Status bar visible on every screen -->
        <div class="status-bar">
          <span>{{ clockTime }}</span>
          <div class="status-icons">
            <i v-if="settings.isDnd" class="fas fa-moon" style="font-size:11px; margin-right:4px;"></i>
            <i :class="settings.isFlightMode ? 'fas fa-plane' : 'fas fa-signal'"></i>
            <i class="fas fa-wifi"></i>
            <i class="fas fa-battery-full"></i>
          </div>
        </div>

        <!-- Lock Screen -->
        <lock-screen
          v-if="view === 'lock'"
          :clock-time="clockTime"
          :clock-date="clockDate"
          :notifications="lockNotifications"
          @unlock="unlock"
          @open-app="openFromLock"
          @dismiss="dismissLockNotif"
        />

        <!-- Home Screen -->
        <home-screen
          v-else-if="view === 'home'"
          :mail-badge="badges.mail"
          :phone-badge="badges.phone"
          @open="open"
        />

        <!-- Phone App (keypad / messages / contacts tabs) -->
        <phone-app
          v-else-if="view === 'phone-app'"
          :tab="phoneTab"
          :dial-buffer="dialBuffer"
          :contacts="filteredContacts"
          :messages="messages"
          :all-contacts="contacts"
          :media-base-url="mediaBaseUrl"
          @switch-tab="switchPhoneTab"
          @press-key="pressKey"
          @press-del="pressDel"
          @start-call="startCall"
          @add-number="openContactEdit(dialBuffer)"
          @open-chat="openChat"
          @open-contact-edit="openContactEdit"
          @filter-contacts="contactSearch = $event"
        />

        <!-- Chat Thread -->
        <chat-thread
          v-else-if="view === 'chat-thread'"
          :active-chat="activeChat"
          :messages="activeChatMessages"
          :media-base-url="mediaBaseUrl"
          :show-attach-menu="showAttachMenu"
          v-model:chat-input="chatInput"
          @back="closeChat"
          @send="sendSMS"
          @toggle-attach="showAttachMenu = !showAttachMenu"
          @req-location="reqLocationShare"
          @req-photo="reqPhotoShare"
          @req-camera="reqCamera"
          @set-waypoint="mpTrigger('client:proxyAction', 'setWaypoint', $event)"
          @view-photo="openPhotoDetail($event, 'chat-thread')"
        />

        <!-- Contact Edit -->
        <contact-edit
          v-else-if="view === 'contact-edit'"
          :prefill-number="contactEditPrefill"
          @save="saveContact"
          @cancel="closeContactEdit"
        />

        <!-- Mail -->
        <mail-app
          v-else-if="view === 'mail'"
          :mails="mails"
          :get-time="getRelativeTime"
          @back="goHome"
          @read-all="readAllMails"
          @open-mail="openMailDetail"
        />

        <mail-detail
          v-else-if="view === 'mail-detail'"
          :mail="currentMail"
          @back="open('mail')"
        />

        <!-- Vehicles -->
        <vehicles-app
          v-else-if="view === 'vehicles'"
          :vehicles="vehicles"
          :grade-colors="GRADE_COLORS"
          @back="goHome"
          @open-vehicle="openVehicleDetails"
        />

        <vehicle-detail
          v-else-if="view === 'vehicle-details'"
          :vehicle="currentVehicle"
          :grade-colors="GRADE_COLORS"
          @back="open('vehicles')"
          @vehicle-action="doVehicleAction"
          @sell="sellVehicle"
        />

        <!-- Bank -->
        <bank-app
          v-else-if="view === 'bank'"
          :balance="bankData.balance"
          :history="bankData.history"
          :modal="bankModal"
          :get-time="getRelativeTime"
          @back="goHome"
          @open-transfer="bankModal.visible = true; resetBankModal()"
          @close-transfer="bankModal.visible = false"
          @verify-transfer="verifyTransfer"
          @submit-transfer="submitTransfer"
          @reset-modal="resetBankModal"
        />

        <!-- Settings -->
        <settings-app
          v-else-if="view === 'settings'"
          :settings="settings"
          @back="goHome"
          @toggle-dnd="toggleDND"
          @toggle-flight="toggleFlight"
          @set-zoom="setZoom"
          @open-wallpapers="open('settings-wallpapers')"
        />

        <wallpaper-picker
          v-else-if="view === 'settings-wallpapers'"
          :wallpapers="WALLPAPERS"
          :current="settings.wallpaper"
          :custom-url="customWallUrl"
          @back="open('settings')"
          @select="setWallpaper"
          @apply-custom="applyCustomWallpaper"
          @update:custom-url="customWallUrl = $event"
        />

        <!-- Gallery -->
        <gallery-app
          v-else-if="view === 'gallery'"
          :photos="photos"
          :media-base-url="mediaBaseUrl"
          :mode="galleryMode"
          @back="galleryBack"
          @open-photo="openPhotoDetail($event, 'gallery')"
          @pick-photo="pickPhoto"
        />

        <photo-detail
          v-else-if="view === 'photo-detail'"
          :photo="currentPhoto"
          :media-base-url="mediaBaseUrl"
          @back="photoDetailBack"
          @delete="deleteCurrentPhoto"
        />

        <!-- QuickEats -->
        <quick-eats-app
          v-else-if="view === 'quickeats'"
          :qe="qe"
          @back="goHome"
          @toggle="toggleQuickEats"
        />

        <!-- eScootr -->
        <e-scootr-app
          v-else-if="view === 'escootr'"
          :scooter="scooter"
          @back="goHome"
          @scan="scooterScan"
          @end-ride="scooterEndRide"
        />

        <!-- Home bar (always shown when unlocked) -->
        <div v-if="view !== 'lock'" class="home-bar-area" @click="goHome">
          <div class="home-bar"></div>
        </div>

        <!-- Global confirm modal -->
        <confirm-modal
          v-if="confirmModal.visible"
          :title="confirmModal.title"
          :text="confirmModal.text"
          :btn-label="confirmModal.btnLabel"
          :btn-color="confirmModal.btnColor"
          @confirm="confirmModal.callback && confirmModal.callback(); closeConfirmModal()"
          @cancel="closeConfirmModal"
        />

      </div>
    </div>
  `,

  setup() {
    // ── Core ──────────────────────────────────────────────────────────────────
    const isPhoneVisible = ref(false)
    const view           = ref('lock')
    const isLocked       = ref(true)
    const clockTime      = ref('00:00')
    const clockDate      = ref('')

    // ── Toast ─────────────────────────────────────────────────────────────────
    const toast = reactive({ visible: false, config: {}, title: '', message: '' })
    let toastTimeout = null

    // ── Lock notifications ────────────────────────────────────────────────────
    const lockNotifications = ref([])
    let lockNotifId = 0

    // ── Badges ────────────────────────────────────────────────────────────────
    const badges = reactive({ mail: 0, phone: 0 })

    // ── Mail ──────────────────────────────────────────────────────────────────
    const mails       = ref([])
    const currentMail = ref(null)

    // ── Vehicles ──────────────────────────────────────────────────────────────
    const vehicles       = ref([])
    const currentVehicle = ref(null)

    // ── Bank ──────────────────────────────────────────────────────────────────
    const bankData  = reactive({ balance: 0, history: [] })
    const bankModal = reactive({ visible: false, step: 1, target: '', amount: '' })

    // ── Phone App ─────────────────────────────────────────────────────────────
    const phoneTab         = ref('keypad')
    const dialBuffer       = ref('')
    const contacts         = ref([])
    const messages         = ref([])
    const activeChat       = reactive({ number: null, name: null })
    const contactSearch    = ref('')
    const chatInput        = ref('')
    const showAttachMenu   = ref(false)
    const contactEditPrefill = ref('')

    const filteredContacts = computed(() => {
      const q = contactSearch.value.toLowerCase()
      const sorted = [...contacts.value].sort((a, b) => a.name.localeCompare(b.name))
      return q ? sorted.filter(c => c.name.toLowerCase().includes(q)) : sorted
    })

    const activeChatMessages = computed(() =>
      messages.value
        .filter(m => m.number == activeChat.number)
        .sort((a, b) => new Date(a.time) - new Date(b.time))
    )

    // ── Media / Gallery ───────────────────────────────────────────────────────
    const photos       = ref([])
    const mediaBaseUrl = ref('')
    const currentPhoto = ref(null)
    const galleryMode  = ref('view')
    const photoDetailReturnView = ref('gallery')

    // ── Settings ──────────────────────────────────────────────────────────────
    const settings = reactive({
      phoneNumber: 'Unknown',
      wallpaper:   'wall1.jpg',
      isDnd:       false,
      isFlightMode:false,
      zoomLevel:   100,
    })
    const customWallUrl = ref('')

    // ── QuickEats ─────────────────────────────────────────────────────────────
    const qe = reactive({
      active: false, processing: false,
      statusText: 'Offline', subText: 'Go online to start receiving orders',
      locationName: null, deliveries: 0, earnings: 0,
    })

    // ── eScootr ───────────────────────────────────────────────────────────────
    const scooter = reactive({
      state: 'idle', // idle | scanning | found | active
      dist: 15, battery: 0, liveBattery: 0,
      timerStr: '00:00', cost: '$5.00',
      unlockCost: 5, costPerMin: 1,
    })
    let scooterTimer   = null
    let scooterStart   = null
    let scooterBattery = 0

    // ── Confirm Modal ─────────────────────────────────────────────────────────
    const confirmModal = reactive({
      visible: false, title: '', text: '',
      btnLabel: 'Confirm', btnColor: '#00a8ff', callback: null,
    })

    // ── Computed styles ───────────────────────────────────────────────────────
    const wallpaperStyle = computed(() => {
      const src = settings.wallpaper.startsWith('http')
        ? settings.wallpaper
        : `package://phone/ui/images/wallpapers/${settings.wallpaper}`
      return {
        backgroundImage:    `url('${src}')`,
        backgroundSize:     'cover',
        backgroundPosition: 'center',
      }
    })

    const phoneShellStyle = computed(() => ({
      transform:       `scale(${settings.zoomLevel / 100})`,
      transformOrigin: 'bottom right',
    }))

    // ── Clock ─────────────────────────────────────────────────────────────────
    function updateClock() {
      const now  = new Date()
      const h    = now.getHours().toString().padStart(2, '0')
      const m    = now.getMinutes().toString().padStart(2, '0')
      clockTime.value = `${h}:${m}`
      const opts = { weekday: 'long', month: 'long', day: 'numeric' }
      clockDate.value = now.toLocaleDateString('en-US', opts)
    }

    onMounted(() => {
      updateClock()
      setInterval(updateClock, 1000)
    })

    // ── Navigation ────────────────────────────────────────────────────────────
    const ONLINE_APPS  = ['bank', 'quickeats', 'mail', 'escootr']

    function open(appName) {
      if (isLocked.value) return

      if (settings.isFlightMode && ONLINE_APPS.includes(appName)) {
        notify('system', 'No Connection', 'Turn off Airplane Mode to use this app.')
        return
      }

      if (appName === 'camera') {
        mpTrigger('client:phone:appCallback', 'camera', 'open')
        return
      }

      if (appName === 'bank') {
        mpTrigger('client:proxyAction', 'requestBankData', 0)
      }

      view.value = appName
    }

    function goHome() {
      if (isLocked.value) return
      galleryMode.value = 'view'
      view.value = 'home'
    }

    function unlock() {
      isLocked.value = false
      lockNotifications.value = []
      view.value = 'home'
    }

    function lock() {
      isLocked.value = true
      view.value = 'lock'
    }

    function openFromLock(appId) {
      unlock()
      const targetView = appId === 'phone' ? 'phone-app' : appId
      open(targetView)
    }

    // ── Notification system ───────────────────────────────────────────────────
    function notify(appId, title, message) {
      const config = NOTIFICATION_APPS[appId] || NOTIFICATION_APPS.system

      // Badge
      if (appId === 'mail')  badges.mail++
      if (appId === 'phone') badges.phone++

      // Lock screen notification
      const id = ++lockNotifId
      lockNotifications.value.unshift({ id, title, message, config, appId })
      if (lockNotifications.value.length > 5) lockNotifications.value.pop()

      // Toast (only when phone is hidden and not DND)
      if (!isPhoneVisible.value && !settings.isDnd) {
        showToast(config, title, message)
      }
    }

    function showToast(config, title, message) {
      toast.config  = config
      toast.title   = title
      toast.message = message
      toast.visible = true
      if (toastTimeout) clearTimeout(toastTimeout)
      toastTimeout = setTimeout(() => { toast.visible = false }, 5000)
    }

    function dismissLockNotif(id) {
      lockNotifications.value = lockNotifications.value.filter(n => n.id !== id)
    }

    // ── Mail ──────────────────────────────────────────────────────────────────
    function loadMails(rawMails) {
      const safe = Array.isArray(rawMails) ? rawMails : []
      mails.value = safe
      badges.mail = safe.filter(m => !m.is_read).length
    }

    function openMailDetail(mail) {
      currentMail.value = mail
      // Remove lock notifs for this sender
      lockNotifications.value = lockNotifications.value.filter(n => n.title !== mail.sender)
      view.value = 'mail-detail'
      if (!mail.is_read) {
        mpTrigger('client:proxyAction', 'readMail', mail.id)
        mail.is_read = 1
        if (badges.mail > 0) badges.mail--
      }
    }

    function readAllMails() {
      mails.value.forEach(m => { m.is_read = 1 })
      badges.mail = 0
      mpTrigger('client:proxyAction', 'readAllMails', 0)
    }

    function receiveMail(id, sender, title, message) {
      notify('mail', sender, title)
      mails.value.unshift({
        id, sender, title, message,
        created_at: new Date().toISOString(),
        is_read: 0,
      })
    }

    // ── Vehicles ──────────────────────────────────────────────────────────────
    function loadVehicles(cars) {
      vehicles.value = Array.isArray(cars) ? cars : []
    }

    function openVehicleDetails(car) {
      currentVehicle.value = car
      view.value = 'vehicle-details'
    }

    function doVehicleAction(action) {
      if (!currentVehicle.value) return
      mpTrigger('client:proxyAction', action, currentVehicle.value.id)
      if (action === 'spawn') window.closePhone()
    }

    function sellVehicle() {
      const car = currentVehicle.value
      if (!car) return
      openConfirmModal(
        'Sell Vehicle',
        `Sell your ${car.displayName || car.model} for $${(car.sellPrice || 0).toLocaleString()}? This cannot be undone.`,
        'Sell', '#ff4757',
        () => {
          mpTrigger('client:phone:sellVehicle', car.id)
          open('vehicles')
        }
      )
    }

    // ── Bank ──────────────────────────────────────────────────────────────────
    function loadBankData(data) {
      bankData.balance = (data && data.balance) ? data.balance : 0
      bankData.history = (data && Array.isArray(data.history)) ? data.history : []
    }

    function resetBankModal() {
      bankModal.step   = 1
      bankModal.target = ''
      bankModal.amount = ''
    }

    function verifyTransfer({ target, amount }) {
      if (!target || !amount || parseFloat(amount) <= 0) {
        notify('bank', 'Error', 'Invalid details entered.')
        return
      }
      bankModal.step   = 2
      bankModal.target = target
      bankModal.amount = amount
    }

    function submitTransfer() {
      mpTrigger('client:proxyAction', 'bankTransfer', JSON.stringify({ t: bankModal.target, a: bankModal.amount }))
      bankModal.visible = false
      resetBankModal()
      notify('bank', 'Processing', 'Sending transaction...')
    }

    // ── Phone App ─────────────────────────────────────────────────────────────
    function initPhoneApp(newContacts, newMessages) {
      if (newContacts) contacts.value = newContacts
      if (newMessages) messages.value = newMessages
      updatePhoneBadge()
    }

    function updatePhoneBadge() {
      badges.phone = messages.value.filter(m => !m.isMine && !m.is_read).length
    }

    function switchPhoneTab(tab) {
      phoneTab.value = tab
    }

    function pressKey(key) {
      if (dialBuffer.value.length < 12) dialBuffer.value += key
    }

    function pressDel() {
      dialBuffer.value = dialBuffer.value.slice(0, -1)
    }

    function startCall() {
      if (!dialBuffer.value) return
      notify('phone', 'Calling...', 'Calling ' + dialBuffer.value)
      mpTrigger('client:proxyAction', 'startCall', dialBuffer.value)
    }

    function getContactName(number) {
      const c = contacts.value.find(x => x.number == number)
      return c ? c.name : number
    }

    function openChat(number, name) {
      activeChat.number = number
      activeChat.name   = name || getContactName(number)
      // Clear lock notifs for this contact
      lockNotifications.value = lockNotifications.value.filter(
        n => n.title !== name && n.title !== number
      )
      // Mark as read
      let changed = false
      messages.value.forEach(m => {
        if (m.number == number && !m.isMine && !m.is_read) {
          m.is_read = 1; changed = true
        }
      })
      if (changed) {
        updatePhoneBadge()
        mpTrigger('client:proxyAction', 'markMessagesRead', number)
      }
      showAttachMenu.value = false
      view.value = 'chat-thread'
    }

    function closeChat() {
      activeChat.number = null
      activeChat.name   = null
      view.value = 'phone-app'
    }

    function sendSMS() {
      const text = chatInput.value.trim()
      if (!text || !activeChat.number) return
      messages.value.push({
        number: activeChat.number, body: text,
        type: 'text', isMine: true, is_read: 1,
        time: new Date().toISOString(),
      })
      mpTrigger('client:proxyAction', 'sendSMS', JSON.stringify({ number: activeChat.number, body: text, type: 'text' }))
      chatInput.value = ''
    }

    function receiveSMS(number, body, type) {
      messages.value.push({
        number, body, type: type || 'text',
        isMine: false, is_read: 0,
        time: new Date().toISOString(),
      })
      const isChatting = activeChat.number == number && !isLocked.value && isPhoneVisible.value && view.value === 'chat-thread'
      if (isChatting) {
        messages.value[messages.value.length - 1].is_read = 1
        mpTrigger('client:proxyAction', 'markMessagesRead', number)
      } else {
        updatePhoneBadge()
        let notifyMsg = body
        if (type === 'photo')    notifyMsg = 'Sent a photo'
        if (type === 'location') notifyMsg = 'Shared location'
        notify('phone', number, notifyMsg)
      }
    }

    // ── Contact edit ──────────────────────────────────────────────────────────
    function openContactEdit(prefill = '') {
      contactEditPrefill.value = prefill
      view.value = 'contact-edit'
    }

    function closeContactEdit() {
      view.value = 'phone-app'
    }

    function saveContact({ name, number }) {
      if (!name || !number) { notify('phone', 'Error', 'Name and Number required.'); return }
      contacts.value.push({ name, number })
      mpTrigger('client:proxyAction', 'saveContact', JSON.stringify({ name, number }))
      closeContactEdit()
    }

    // ── Attachments ───────────────────────────────────────────────────────────
    function reqLocationShare() {
      showAttachMenu.value = false
      openConfirmModal('Share Location', 'Share your current location?', 'Share', '#00a8ff', () => {
        mpTrigger('client:proxyAction', 'shareLocation', activeChat.number)
      })
    }

    function reqPhotoShare() {
      showAttachMenu.value = false
      galleryMode.value = 'pick'
      view.value = 'gallery'
    }

    function reqCamera() {
      showAttachMenu.value = false
      mpTrigger('client:proxyAction', 'cameraForChat', activeChat.number)
    }

    function pickPhoto(photo) {
      const target = activeChat.number
      openConfirmModal('Send Photo', 'Send this photo?', 'Send', '#00a8ff', () => {
        mpTrigger('client:proxyAction', 'sharePhoto', JSON.stringify({ target, image: photo.image_path }))
        galleryMode.value = 'view'
        open('phone-app')
        if (target) openChat(target, getContactName(target))
      })
    }

    function galleryBack() {
      if (galleryMode.value === 'pick') {
        galleryMode.value = 'view'
        open('phone-app')
        if (activeChat.number) openChat(activeChat.number, activeChat.name)
      } else {
        goHome()
      }
    }

    // ── Photos ────────────────────────────────────────────────────────────────
    function loadPhotos(rawPhotos, baseUrl) {
      photos.value    = Array.isArray(rawPhotos) ? rawPhotos : []
      mediaBaseUrl.value = baseUrl || ''
    }

    function openPhotoDetail(photo, returnView = 'gallery') {
      currentPhoto.value = photo
      photoDetailReturnView.value = returnView
      view.value = 'photo-detail'
    }

    function photoDetailBack() {
      if (photoDetailReturnView.value === 'chat-thread') {
        view.value = 'chat-thread'
      } else {
        view.value = 'gallery'
      }
    }

    function deleteCurrentPhoto() {
      if (!currentPhoto.value) return
      openConfirmModal('Delete Photo', 'Permanently delete this picture?', 'Delete', '#ff3b30', () => {
        mpTrigger('client:proxyAction', 'deletePhoto', JSON.stringify({
          id:   currentPhoto.value.id,
          path: currentPhoto.value.image_path,
        }))
        photos.value = photos.value.filter(p => p.id !== currentPhoto.value.id)
        open('gallery')
      })
    }

    // ── Settings ──────────────────────────────────────────────────────────────
    function initSettings(data) {
      if (!data) return
      settings.phoneNumber  = data.phone_number  || 'Unknown'
      settings.wallpaper    = data.wallpaper      || 'wall1.jpg'
      settings.isDnd        = !!data.is_dnd
      settings.isFlightMode = !!data.is_flight_mode
      settings.zoomLevel    = data.zoom_level     || 100
    }

    function toggleDND(val) {
      settings.isDnd = val
      mpTrigger('client:proxyAction', 'saveSetting', JSON.stringify({ key: 'is_dnd', val: val ? 1 : 0 }))
    }

    function toggleFlight(val) {
      settings.isFlightMode = val
      mpTrigger('client:proxyAction', 'saveSetting', JSON.stringify({ key: 'is_flight_mode', val: val ? 1 : 0 }))
    }

    function setZoom(val) {
      settings.zoomLevel = parseInt(val)
      mpTrigger('client:proxyAction', 'saveSetting', JSON.stringify({ key: 'zoom_level', val: settings.zoomLevel }))
    }

    function setWallpaper(source) {
      settings.wallpaper = source
      mpTrigger('client:proxyAction', 'saveSetting', JSON.stringify({ key: 'wallpaper', val: source }))
    }

    function applyCustomWallpaper(url) {
      if (!url) return
      if (!url.startsWith('http')) { notify('system', 'Error', 'Link must start with http/s'); return }
      setWallpaper(url)
      customWallUrl.value = ''
      notify('system', 'Updated', 'Custom wallpaper applied.')
    }

    // ── QuickEats ─────────────────────────────────────────────────────────────
    function toggleQuickEats() {
      qe.processing = true
      mpTrigger('client:proxyAction', 'toggleQuickEats', null)
    }

    function updateQuickEatsUI(isActive, statusText, locationName) {
      qe.processing    = false
      qe.active        = isActive
      qe.statusText    = statusText || (isActive ? 'Searching...' : 'Offline')
      qe.subText       = isActive ? (locationName ? 'Driving to destination...' : 'Waiting for new orders...') : 'Go online to start receiving orders'
      qe.locationName  = locationName || null
    }

    // ── eScootr ───────────────────────────────────────────────────────────────
    function scooterScan() {
      if (scooter.state === 'found') { scooterUnlock(); return }
      scooter.state = 'scanning'
      mpTrigger('client:proxyAction', 'scooterAction', JSON.stringify({ type: 'scan' }))
    }

    function scooterOnResult(data) {
      if (data.status === 'failed') {
        scooter.state = 'idle'
      } else if (data.status === 'found') {
        scooter.state   = 'found'
        scooter.dist    = data.dist || 15
        scooter.battery = data.battery
        scooterBattery  = data.battery
      } else {
        scooter.state = 'idle'
      }
    }

    function scooterUnlock() {
      mpTrigger('client:proxyAction', 'scooterAction', JSON.stringify({ type: 'rent' }))
    }

    function scooterStartRide() {
      scooter.state = 'active'
      scooterStart  = Date.now()
      scooterTimer  = setInterval(() => {
        const s    = Math.floor((Date.now() - scooterStart) / 1000)
        const mins = Math.floor(s / 60)
        const secs = s % 60
        scooter.timerStr    = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`
        scooter.cost        = '$' + (scooter.unlockCost + mins * scooter.costPerMin).toFixed(2)
        scooter.liveBattery = scooterBattery
      }, 1000)
      window.closePhone()
    }

    function scooterEndRide() {
      mpTrigger('client:proxyAction', 'scooterAction', JSON.stringify({ type: 'end' }))
      if (scooterTimer) { clearInterval(scooterTimer); scooterTimer = null }
      scooter.state    = 'idle'
      scooter.timerStr = '00:00'
      scooter.cost     = `$${scooter.unlockCost}.00`
    }

    // ── Confirm modal ─────────────────────────────────────────────────────────
    function openConfirmModal(title, text, btnLabel = 'Confirm', btnColor = '#00a8ff', callback = null) {
      confirmModal.title    = title
      confirmModal.text     = text
      confirmModal.btnLabel = btnLabel
      confirmModal.btnColor = btnColor
      confirmModal.callback = callback
      confirmModal.visible  = true
    }

    function closeConfirmModal() {
      confirmModal.visible  = false
      confirmModal.callback = null
    }

    // ── Window bridge ─────────────────────────────────────────────────────────
    window.openPhone = () => {
      isPhoneVisible.value = true
      toast.visible = false
      if (toastTimeout) { clearTimeout(toastTimeout); toastTimeout = null }
      lock()
      updateClock()
    }

    window.closePhone = () => {
      isPhoneVisible.value = false
      mpTrigger('client:closePhoneWrapper')
    }

    window.app = {
      notify,
      receiveMail,
      receiveSMS,
      receiveNotification: (sender, title, message, appType = 'mail') => {
        const appId = appType === 'phone' ? 'phone' : 'mail'
        notify(appId, sender, title || message)
      },
      loadMails,
      loadPhotos,
      loadVehicles,
      loadBankData,
      updateQuickEatsUI,
      settings: {
        init: initSettings,
        flightMode: computed(() => settings.isFlightMode),
      },
      phoneApp: {
        init: initPhoneApp,
        receiveMessageRaw: receiveSMS,
        activeChatNumber: computed(() => activeChat.number),
        getContactName,
        openChat,
        renderChatBubbles: () => {},   // no-op, Vue handles this reactively
        renderMessageList: () => {},   // no-op
        messages,
        contacts,
        sendSMSInternal: (number, body, type) => {
          messages.value.push({ number, body, type, isMine: true, is_read: 1, time: new Date().toISOString() })
          mpTrigger('client:proxyAction', 'sendSMS', JSON.stringify({ number, body, type }))
        },
      },
      scooter: {
        onScanResult: scooterOnResult,
        startRide: scooterStartRide,
        endRide: scooterEndRide,
      },
      openConfirmModal,
      closeConfirmModal,
      isLocked,
      open,
      goHome,
    }

    // Expose getRelativeTime and constants for child components
    return {
      // state
      isPhoneVisible, view, isLocked, clockTime, clockDate,
      toast, lockNotifications, badges,
      mails, currentMail,
      vehicles, currentVehicle,
      bankData, bankModal,
      phoneTab, dialBuffer, contacts, messages, filteredContacts,
      activeChat, activeChatMessages, contactSearch,
      chatInput, showAttachMenu, contactEditPrefill,
      photos, mediaBaseUrl, currentPhoto, galleryMode,
      settings, customWallUrl,
      qe, scooter,
      confirmModal,
      // computed styles
      wallpaperStyle, phoneShellStyle,
      // constants
      WALLPAPERS, GRADE_COLORS,
      // methods
      open, goHome, unlock, lock, openFromLock,
      notify, dismissLockNotif,
      loadMails, openMailDetail, readAllMails,
      loadVehicles, openVehicleDetails, doVehicleAction, sellVehicle,
      loadBankData, resetBankModal, verifyTransfer, submitTransfer,
      switchPhoneTab, pressKey, pressDel, startCall,
      openChat, closeChat, sendSMS,
      openContactEdit, closeContactEdit, saveContact,
      reqLocationShare, reqPhotoShare, reqCamera, pickPhoto, galleryBack,
      loadPhotos, openPhotoDetail, photoDetailBack, deleteCurrentPhoto,
      initSettings, toggleDND, toggleFlight, setZoom, setWallpaper, applyCustomWallpaper,
      toggleQuickEats, updateQuickEatsUI,
      scooterScan, scooterEndRide,
      openConfirmModal, closeConfirmModal,
      getRelativeTime,
      mpTrigger,
    }
  }
}

const vueApp = createApp(App)
vueApp.mount('#app')
