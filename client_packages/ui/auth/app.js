/**
 * app.js — ui/auth/
 * Vue 3 root app for the login / register CEF.
 *
 * Window bridge (called by client_packages/auth/index.js):
 *   window.loadRecent(accounts)   — array of { username, level, money }
 *   window.showError(msg)         — displays the shake notification
 */

const { createApp, ref, computed } = Vue

/** Safe mp.trigger — no-ops when opened in a browser for testing */
function mpTrigger(event, ...args) {
  if ('mp' in window) mp.trigger(event, ...args)
}

const app = createApp({

  template: `
    <div class="auth-wrapper">

      <h1 class="server-title">Central Online</h1>

      <!-- Error notification -->
      <transition name="notif">
        <div v-if="errorMsg" class="notification">{{ errorMsg }}</div>
      </transition>

      <!-- Panels swap with a slide transition -->
      <transition name="panel" mode="out-in">

        <!-- ── Login ── -->
        <div v-if="activeTab === 'login'" key="login">
          <h2>Welcome Back</h2>
          <p class="sub-text">Sign in to continue your story</p>

          <div class="input-group">
            <input
              type="text"
              v-model="loginUser"
              placeholder="Username"
              @keydown.enter="attemptLogin"
            />
            <i class="fas fa-user"></i>
          </div>
          <div class="input-group">
            <input
              type="password"
              v-model="loginPass"
              placeholder="Password"
              @keydown.enter="attemptLogin"
            />
            <i class="fas fa-lock"></i>
          </div>

          <button class="btn-primary" @click="attemptLogin">
            <i class="fas fa-sign-in-alt" style="margin-right:8px;"></i>Login
          </button>

          <div class="toggle-link">
            New to the city?
            <span @click="switchTab('register')">Create Account</span>
          </div>

          <!-- Quick Access — only rendered when there are recent accounts -->
          <div v-if="recentAccounts.length > 0" class="quick-access">
            <div class="qa-title">Quick Access</div>
            <div class="recent-list">
              <div
                v-for="acc in recentAccounts"
                :key="acc.username"
                class="recent-card"
                @click="tryAutoLogin(acc.username)"
              >
                <div class="avatar-circle">
                  <i class="fas fa-user-circle"></i>
                </div>
                <div class="user-info">
                  <strong>{{ acc.username }}</strong>
                  <small>Level {{ acc.level }} • {{ '$' + acc.money.toLocaleString() }}</small>
                </div>
                <i class="fas fa-chevron-right recent-chevron"></i>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Register ── -->
        <div v-else key="register">
          <h2>Identity Creation</h2>
          <p class="sub-text">Begin your new life in Central Online</p>

          <div class="input-group">
            <input
              type="text"
              v-model="regUser"
              placeholder="Choose Username"
              @keydown.enter="attemptRegister"
            />
            <i class="fas fa-user"></i>
          </div>
          <div class="input-group">
            <input
              type="password"
              v-model="regPass"
              placeholder="Password"
              @keydown.enter="attemptRegister"
            />
            <i class="fas fa-lock"></i>
          </div>
          <div class="input-group">
            <input
              type="password"
              v-model="regRepass"
              placeholder="Confirm Password"
              @keydown.enter="attemptRegister"
            />
            <i class="fas fa-check-circle"></i>
          </div>

          <button class="btn-primary" @click="attemptRegister">
            <i class="fas fa-user-plus" style="margin-right:8px;"></i>Register
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
    // ── State ────────────────────────────────────────────────────────────────

    const activeTab      = ref('login')
    const errorMsg       = ref('')
    const recentAccounts = ref([])

    const loginUser = ref('')
    const loginPass = ref('')

    const regUser   = ref('')
    const regPass   = ref('')
    const regRepass = ref('')

    let errorTimer = null

    // ── Methods ───────────────────────────────────────────────────────────────

    function switchTab(tab) {
      activeTab.value = tab
      clearError()
    }

    function showError(msg) {
      // Clear and re-set so the shake animation re-triggers even for the same message
      errorMsg.value = ''
      clearTimeout(errorTimer)
      setTimeout(() => {
        errorMsg.value = msg
        errorTimer = setTimeout(() => { errorMsg.value = '' }, 5000)
      }, 10)
    }

    function clearError() {
      errorMsg.value = ''
      clearTimeout(errorTimer)
    }

    function attemptLogin() {
      if (!loginUser.value || !loginPass.value) {
        return showError('Please fill in all fields.')
      }
      clearError()
      mpTrigger('client:auth:login', loginUser.value, loginPass.value)
    }

    function attemptRegister() {
      if (!regUser.value || !regPass.value) {
        return showError('Please fill in all fields.')
      }
      if (regPass.value !== regRepass.value) {
        return showError('Passwords do not match.')
      }
      clearError()
      mpTrigger('client:auth:register', regUser.value, regPass.value)
    }

    function tryAutoLogin(username) {
      mpTrigger('client:auth:tryAutoLogin', username)
    }

    // ── Window Bridge ─────────────────────────────────────────────────────────
    //
    // Called by client_packages/auth/index.js via invBrowser.execute(...)
    // loadRecent receives the parsed array directly (no JSON.parse needed)

    function loadRecent(accounts) {
      recentAccounts.value = Array.isArray(accounts) ? accounts : []
    }

    window.loadRecent = loadRecent
    window.showError  = showError

    // ── Expose ────────────────────────────────────────────────────────────────

    return {
      activeTab, errorMsg, recentAccounts,
      loginUser, loginPass,
      regUser, regPass, regRepass,
      switchTab, attemptLogin, attemptRegister, tryAutoLogin,
    }
  },
})

app.mount('#app')
