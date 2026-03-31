/**
 * app.js — ui/auth/
 * Vue 3 root app for the login / register CEF.
 *
 * Window bridge (called by client_packages/auth/index.js):
 *   window.loadRecent(accounts)   — array of { username, level, money }
 *   window.showError(msg)         — displays the shake notification
 */

const { createApp, ref } = Vue

/** Safe mp.trigger — no-ops when opened in a browser for testing */
function mpTrigger(event, ...args) {
  if ('mp' in window) mp.trigger(event, ...args)
}

const app = createApp({

  template: `
    <div class="auth-wrapper">

      <div class="brand">
        <div class="brand-title">Central Online</div>
        <div class="brand-sub">Roleplay Experience</div>
      </div>

      <transition name="notif">
        <div v-if="errorMsg" class="notification">
          <i class="fas fa-exclamation-circle"></i>
          {{ errorMsg }}
        </div>
      </transition>

      <transition name="panel" mode="out-in">

        <div v-if="activeTab === 'login'" key="login">
          <div class="form-head">
            <h2>Welcome Back</h2>
            <p>Sign in to continue your story</p>
          </div>
          <div class="acc-line"></div>

          <div class="input-group">
            <label>Username</label>
            <div class="input-row">
              <i class="fas fa-user inp-icon"></i>
              <input type="text" v-model="loginUser" placeholder="Enter your username" @keydown.enter="attemptLogin" />
            </div>
          </div>

          <div class="input-group">
            <label>Password</label>
            <div class="input-row">
              <i class="fas fa-lock inp-icon"></i>
              <input type="password" v-model="loginPass" placeholder="Enter your password" @keydown.enter="attemptLogin" />
            </div>
          </div>

          <button class="btn-primary" @click="attemptLogin">
            <i class="fas fa-arrow-right-to-bracket" style="margin-right:9px"></i>Enter the City
          </button>

          <div class="toggle-link">
            New to the city?
            <span @click="switchTab('register')">Create Account</span>
          </div>

          <div v-if="recentAccounts.length > 0" class="quick-access">
            <div class="qa-label">Quick Access</div>
            <div class="recent-list">
              <div v-for="acc in recentAccounts" :key="acc.username" class="recent-card" @click="tryAutoLogin(acc.username)">
                <div class="avatar-circle">
                  <img v-if="acc.mugshot" :src="\`http://26.118.189.124:3008/photos/mugshots/\${acc.mugshot}\`" class="mugshot-img" @error="acc.mugshot = null" />
                  <i v-else class="fas fa-user-circle"></i>
                </div>
                <div class="user-info">
                  <strong>{{ acc.username }}</strong>
                  <small>Level {{ acc.level }} &nbsp;·&nbsp; {{ '$' + acc.money.toLocaleString() }}</small>
                </div>
                <i class="fas fa-chevron-right recent-chevron"></i>
              </div>
            </div>
          </div>
        </div>

        <div v-else key="register">
          <div class="form-head">
            <h2>New Identity</h2>
            <p>Begin your new life in Central Online</p>
          </div>
          <div class="acc-line"></div>

          <div class="input-group">
            <label>Username</label>
            <div class="input-row">
              <i class="fas fa-user inp-icon"></i>
              <input type="text" v-model="regUser" placeholder="Choose a username" @keydown.enter="attemptRegister" />
            </div>
          </div>

          <div class="input-group">
            <label>Password</label>
            <div class="input-row">
              <i class="fas fa-lock inp-icon"></i>
              <input type="password" v-model="regPass" placeholder="Choose a password" @keydown.enter="attemptRegister" />
            </div>
          </div>

          <div class="input-group">
            <label>Confirm Password</label>
            <div class="input-row">
              <i class="fas fa-shield-halved inp-icon"></i>
              <input type="password" v-model="regRepass" placeholder="Repeat your password" @keydown.enter="attemptRegister" />
            </div>
          </div>

          <button class="btn-primary" @click="attemptRegister">
            <i class="fas fa-id-card" style="margin-right:9px"></i>Create Character
          </button>

          <div class="toggle-link">
            Already a citizen?
            <span @click="switchTab('login')">Access Account</span>
          </div>
        </div>

      </transition>
    </div>
  `,

  setup() {
    const activeTab      = ref('login')
    const errorMsg       = ref('')
    const recentAccounts = ref([])

    const loginUser = ref('')
    const loginPass = ref('')
    const regUser   = ref('')
    const regPass   = ref('')
    const regRepass = ref('')

    let errorTimer = null

    function switchTab(tab) { activeTab.value = tab; clearError() }

    function showError(msg) {
      errorMsg.value = ''
      clearTimeout(errorTimer)
      setTimeout(() => {
        errorMsg.value = msg
        errorTimer = setTimeout(() => { errorMsg.value = '' }, 5000)
      }, 10)
    }

    function clearError() { errorMsg.value = ''; clearTimeout(errorTimer) }

    function attemptLogin() {
      if (!loginUser.value || !loginPass.value) return showError('Please fill in all fields.')
      clearError()
      mpTrigger('client:auth:login', loginUser.value, loginPass.value)
    }

    function attemptRegister() {
      if (!regUser.value || !regPass.value) return showError('Please fill in all fields.')
      if (regPass.value !== regRepass.value) return showError('Passwords do not match.')
      clearError()
      mpTrigger('client:auth:register', regUser.value, regPass.value)
    }

    function tryAutoLogin(username) { mpTrigger('client:auth:tryAutoLogin', username) }

    function loadRecent(accounts) { recentAccounts.value = Array.isArray(accounts) ? accounts : [] }

    window.loadRecent = loadRecent
    window.showError  = showError

    return {
      activeTab, errorMsg, recentAccounts,
      loginUser, loginPass,
      regUser, regPass, regRepass,
      switchTab, attemptLogin, attemptRegister, tryAutoLogin,
    }
  },
})

app.mount('#app')