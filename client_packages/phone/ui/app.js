const { createApp, reactive, computed, ref, watch } = Vue;

// ============================================
// GLOBAL STATE STORE (Pinia-like pattern)
// ============================================
const store = reactive({
    // UI State
    isLocked: true,
    currentView: 'lock',
    viewHistory: [],
    currentViewData: null, // Stores data for current view (like selected mail, vehicle, etc.)
    
    // Phone State
    phoneNumber: null,
    contacts: [],
    messages: [],
    callState: null, // null | 'incoming' | 'ringing' | 'active'
    callData: null,
    callTimer: 0,
    
    // Apps State
    mails: [],
    unreadMails: 0,
    vehicles: [],
    bankData: {
        balance: 0,
        history: []
    },
    
    // Settings
    settings: {
        flightMode: false,
        dndMode: false,
        wallpaper: 'default',
        ringtone: 'default'
    },
    
    // Notifications
    notifications: [],
    
    // Gallery
    photos: [],
    mediaBaseUrl: '',
    
    // Actions
    unlock() {
        this.isLocked = false;
        this.currentView = 'home';
        this.notifications = [];
    },
    
    lock() {
        this.isLocked = true;
        this.currentView = 'lock';
        this.viewHistory = [];
        this.currentViewData = null;
    },
    
    navigateTo(view, data = null) {
        if (this.isLocked && view !== 'lock') return;
        
        // Push current view to history for back navigation
        if (this.currentView !== view) {
            this.viewHistory.push({ 
                view: this.currentView, 
                data: this.currentViewData 
            });
        }
        
        this.currentView = view;
        this.currentViewData = data;
    },
    
    goBack() {
        if (this.viewHistory.length > 0) {
            const previous = this.viewHistory.pop();
            this.currentView = previous.view;
            this.currentViewData = previous.data;
        } else {
            this.goHome();
        }
    },
    
    goHome() {
        if (this.isLocked) return;
        this.currentView = 'home';
        this.viewHistory = [];
        this.currentViewData = null;
    },
    
    addNotification(appType, title, message) {
        const notification = {
            id: Date.now(),
            appType,
            title,
            message,
            timestamp: new Date(),
            read: false
        };
        
        this.notifications.unshift(notification);
        
        // Limit notification history
        if (this.notifications.length > 50) {
            this.notifications = this.notifications.slice(0, 50);
        }
        
        // Update badges
        if (appType === 'mail') {
            this.unreadMails++;
        }
    },
    
    clearNotifications() {
        this.notifications = [];
    }
});

// ============================================
// NOTIFICATION APP CONFIGURATION
// ============================================
const NOTIFICATION_APPS = {
    'mail': { color: '#00a8ff', icon: 'fas fa-envelope', title: 'Mail' },
    'phone': { color: '#34c759', icon: 'fas fa-phone-alt', title: 'Phone' },
    'bank': { color: '#1abc9c', icon: 'fas fa-university', title: 'Fleeca' },
    'scooter': { color: '#56ab2f', icon: 'fas fa-bolt', title: 'eScootr' },
    'quickeats': { color: '#ff9500', icon: 'fas fa-hamburger', title: 'QuickEats' },
    'vehicles': { color: '#f1c40f', icon: 'fas fa-car', title: 'Vehicles' },
    'system': { color: '#636366', icon: 'fas fa-cog', title: 'System' },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
const utils = {
    getRelativeTime(dateString) {
        if (!dateString) return 'now';
        const now = new Date();
        const past = new Date(dateString);
        if (isNaN(past.getTime())) return 'recently';
        const diffInSeconds = Math.floor((now - past) / 1000);
        if (diffInSeconds < 60) return 'now';
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
    },
    
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    },
    
    formatTime(date) {
        return new Date(date).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
    }
};

// ============================================
// RAGE:MP BRIDGE
// ============================================
const mp = {
    trigger(eventName, ...args) {
        if (window.mp && typeof window.mp.trigger === 'function') {
            window.mp.trigger(eventName, ...args);
        } else {
            console.log(`[MP] ${eventName}`, args);
        }
    }
};

// ============================================
// COMPONENTS
// ============================================

// Status Bar Component
const StatusBar = {
    template: `
        <div class="status-bar">
            <span>{{ currentTime }}</span>
            <div class="status-icons">
                <i v-if="store.settings.dndMode" class="fas fa-moon"></i>
                <i class="fas fa-signal"></i>
                <i class="fas fa-wifi"></i>
                <i class="fas fa-battery-full"></i>
            </div>
        </div>
    `,
    setup() {
        const currentTime = ref('12:00');
        
        const updateTime = () => {
            const now = new Date();
            currentTime.value = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        };
        
        setInterval(updateTime, 1000);
        updateTime();
        
        return { currentTime, store };
    }
};

// Lock Screen Component
const LockScreen = {
    template: `
        <div class="view active">
            <div class="lock-content">
                <div class="lock-time-group">
                    <div class="lock-clock">{{ currentTime }}</div>
                    <div class="lock-date">{{ currentDate }}</div>
                </div>
                <div class="lock-notification-list">
                    <div v-for="notif in store.notifications" 
                         :key="notif.id" 
                         class="lock-notification">
                        <i :class="getNotificationIcon(notif.appType)"></i>
                        <div>
                            <strong>{{ notif.title }}</strong>
                            <p>{{ notif.message }}</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="unlock-hint" @click="store.unlock()">
                <div class="bar"></div>
                <span>Click to Unlock</span>
            </div>
        </div>
    `,
    setup() {
        const currentTime = ref('12:00');
        const currentDate = ref('');
        
        const updateTime = () => {
            const now = new Date();
            currentTime.value = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            currentDate.value = now.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
            });
        };
        
        setInterval(updateTime, 1000);
        updateTime();
        
        const getNotificationIcon = (appType) => {
            return NOTIFICATION_APPS[appType]?.icon || 'fas fa-bell';
        };
        
        return { currentTime, currentDate, store, getNotificationIcon };
    }
};

// App Icon Component
const AppIcon = {
    props: ['app'],
    template: `
        <div class="app-icon" @click="$emit('click')">
            <div class="icon-box" 
                 :style="iconStyle">
                <i :class="app.icon"></i>
                <div v-if="app.badge && app.badge > 0" 
                     class="app-badge">
                    {{ app.badge > 9 ? '9+' : app.badge }}
                </div>
            </div>
            <span class="app-name">{{ app.name }}</span>
        </div>
    `,
    setup(props) {
        const iconStyle = computed(() => {
            if (props.app.gradient) {
                return { background: props.app.gradient };
            }
            return { background: props.app.color || '#636366' };
        });
        
        return { iconStyle };
    }
};

// Home Screen Component
const HomeScreen = {
    components: { AppIcon },
    template: `
        <div class="view" :class="{ hidden: store.currentView !== 'home' }">
            <div class="app-grid">
                <app-icon 
                    v-for="app in apps" 
                    :key="app.id"
                    :app="app"
                    @click="openApp(app.id)"
                />
            </div>
        </div>
    `,
    setup() {
        const apps = ref([
            { id: 'mail', name: 'Mail', icon: 'fas fa-envelope', color: '#00a8ff', badge: computed(() => store.unreadMails) },
            { id: 'vehicles', name: 'My Cars', icon: 'fas fa-truck-moving', color: '#f1c40f' },
            { id: 'settings', name: 'Settings', icon: 'fas fa-cog', color: '#636366' },
            { id: 'bank', name: 'Bank', icon: 'fas fa-university', gradient: 'linear-gradient(135deg, #1abc9c, #16a085)' },
            { id: 'quickeats', name: 'QuickEats', icon: 'fas fa-hamburger', gradient: 'linear-gradient(135deg, #00b09b, #96c93d)' },
            { id: 'escootr', name: 'eScootr', icon: 'fas fa-bolt', gradient: 'linear-gradient(135deg, #56ab2f, #a8e063)' },
            { id: 'gallery', name: 'Gallery', icon: 'fas fa-images', gradient: 'linear-gradient(135deg, #ff9a9e, #fecfef)' },
            { id: 'camera', name: 'Camera', icon: 'fas fa-camera', gradient: 'linear-gradient(135deg, #757F9A, #D7DDE8)' },
            { id: 'phone-app', name: 'Phone', icon: 'fas fa-phone-alt', gradient: 'linear-gradient(135deg, #4cd964, #2ecc71)' }
        ]);
        
        const openApp = (appId) => {
            const onlineApps = ['bank', 'quickeats', 'mail', 'escootr'];
            
            if (store.settings.flightMode && onlineApps.includes(appId)) {
                store.addNotification('system', 'No Connection', 'Turn off Airplane Mode to use this app.');
                return;
            }
            
            if (appId === 'camera') {
                mp.trigger('client:phone:appCallback', 'camera', 'open');
                return;
            }
            
            if (appId === 'bank') {
                mp.trigger('client:proxyAction', 'requestBankData', 0);
            }
            
            store.navigateTo(appId);
        };
        
        return { apps, store, openApp };
    }
};

// Mail App Component
const MailApp = {
    template: `
        <div class="view" :class="{ hidden: store.currentView !== 'mail' }">
            <div class="app-header">
                <div style="display: flex; align-items: center;">
                    <button class="back-btn" @click="store.goHome()">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <span>Inbox</span>
                </div>
                <button @click="readAllMails" class="read-all-btn">
                    Read All
                </button>
            </div>
            <div class="scrollable-content">
                <div v-if="store.mails.length === 0" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No messages</p>
                </div>
                <div v-else>
                    <div v-for="mail in store.mails" 
                         :key="mail.id"
                         class="mail-item"
                         :class="{ unread: !mail.read }"
                         @click="openMail(mail)">
                        <div class="mail-header">
                            <strong>{{ mail.sender }}</strong>
                            <span class="mail-time">{{ utils.getRelativeTime(mail.timestamp) }}</span>
                        </div>
                        <div class="mail-subject">{{ mail.subject }}</div>
                        <div class="mail-preview">{{ mail.body.substring(0, 60) }}...</div>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const openMail = (mail) => {
            mail.read = true;
            store.unreadMails = Math.max(0, store.unreadMails - 1);
            store.navigateTo('mail-detail', mail);
        };
        
        const readAllMails = () => {
            store.mails.forEach(mail => mail.read = true);
            store.unreadMails = 0;
        };
        
        return { store, utils, openMail, readAllMails };
    }
};

// Mail Detail Component
const MailDetail = {
    template: `
        <div class="view" :class="{ hidden: store.currentView !== 'mail-detail' }">
            <div class="app-header">
                <button class="back-btn" @click="store.navigateTo('mail')">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span>{{ store.currentViewData?.sender || 'Message' }}</span>
            </div>
            <div class="scrollable-content detail-container">
                <div class="stat-box">
                    <h3 style="margin-top:0; color:#1a1a2e;">{{ store.currentViewData?.subject }}</h3>
                    <p style="color:#555; line-height:1.4; white-space: pre-wrap;">{{ store.currentViewData?.body }}</p>
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #999; font-size: 12px;">
                        Received {{ utils.getRelativeTime(store.currentViewData?.timestamp) }}
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        return { store, utils };
    }
};

// Phone App Component
const PhoneApp = {
    template: `
        <div class="view" :class="{ hidden: store.currentView !== 'phone-app' }" style="background: #f5f5f8;">
            <div class="phone-tabs">
                <button :class="{ active: activeTab === 'keypad' }" 
                        @click="activeTab = 'keypad'">
                    Keypad
                </button>
                <button :class="{ active: activeTab === 'recent' }" 
                        @click="activeTab = 'recent'">
                    Messages
                </button>
                <button :class="{ active: activeTab === 'contacts' }" 
                        @click="activeTab = 'contacts'">
                    Contacts
                </button>
            </div>
            
            <!-- Keypad Tab -->
            <div v-if="activeTab === 'keypad'" class="phone-tab-content">
                <div class="keypad-display">
                    <div class="keypad-input">{{ dialedNumber }}</div>
                    <div v-if="dialedNumber" class="keypad-sub" @click="addToContacts">
                        + Add to Contacts
                    </div>
                </div>
                <div class="keypad-grid">
                    <div v-for="key in keypadButtons" 
                         :key="key.value"
                         class="key-btn" 
                         @click="pressKey(key.value)">
                        {{ key.value }}
                        <span v-if="key.letters">{{ key.letters }}</span>
                    </div>
                </div>
                <div class="keypad-actions">
                    <button class="btn-call" @click="startCall">
                        <i class="fas fa-phone-alt"></i>
                    </button>
                    <button v-if="dialedNumber" class="btn-del" @click="deleteDigit">
                        <i class="fas fa-backspace"></i>
                    </button>
                </div>
            </div>
            
            <!-- Messages Tab -->
            <div v-if="activeTab === 'recent'" class="phone-tab-content">
                <div class="app-header">
                    <span>Messages</span>
                </div>
                <div class="scrollable-content">
                    <div v-if="store.messages.length === 0" class="empty-state">
                        <i class="fas fa-comments"></i>
                        <p>No messages</p>
                    </div>
                    <div v-else>
                        <div v-for="msg in store.messages" 
                             :key="msg.id"
                             class="message-item"
                             @click="openConversation(msg)">
                            <div class="message-avatar">
                                {{ msg.contact.charAt(0) }}
                            </div>
                            <div class="message-info">
                                <strong>{{ msg.contact }}</strong>
                                <p>{{ msg.lastMessage }}</p>
                            </div>
                            <span class="message-time">{{ utils.getRelativeTime(msg.timestamp) }}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Contacts Tab -->
            <div v-if="activeTab === 'contacts'" class="phone-tab-content">
                <div class="app-header">
                    <span>Contacts</span>
                    <i class="fas fa-plus add-contact-btn" @click="addNewContact"></i>
                </div>
                <div class="scrollable-content">
                    <div v-if="store.contacts.length === 0" class="empty-state">
                        <i class="fas fa-address-book"></i>
                        <p>No contacts</p>
                    </div>
                    <div v-else>
                        <div v-for="contact in store.contacts" 
                             :key="contact.id"
                             class="contact-item"
                             @click="callContact(contact)">
                            <div class="contact-avatar">
                                {{ contact.name.charAt(0) }}
                            </div>
                            <div class="contact-info">
                                <strong>{{ contact.name }}</strong>
                                <p>{{ contact.number }}</p>
                            </div>
                            <i class="fas fa-phone-alt"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const activeTab = ref('keypad');
        const dialedNumber = ref('');
        
        const keypadButtons = [
            { value: '1', letters: '' },
            { value: '2', letters: 'ABC' },
            { value: '3', letters: 'DEF' },
            { value: '4', letters: 'GHI' },
            { value: '5', letters: 'JKL' },
            { value: '6', letters: 'MNO' },
            { value: '7', letters: 'PQRS' },
            { value: '8', letters: 'TUV' },
            { value: '9', letters: 'WXYZ' },
            { value: '*', letters: '' },
            { value: '0', letters: '+' },
            { value: '#', letters: '' }
        ];
        
        const pressKey = (key) => {
            dialedNumber.value += key;
        };
        
        const deleteDigit = () => {
            dialedNumber.value = dialedNumber.value.slice(0, -1);
        };
        
        const startCall = () => {
            if (!dialedNumber.value) return;
            mp.trigger('client:phone:startCall', dialedNumber.value);
            dialedNumber.value = '';
        };
        
        const addToContacts = () => {
            store.navigateTo('contact-edit', { number: dialedNumber.value });
        };
        
        const addNewContact = () => {
            store.navigateTo('contact-edit', {});
        };
        
        const callContact = (contact) => {
            mp.trigger('client:phone:startCall', contact.number);
        };
        
        const openConversation = (msg) => {
            store.navigateTo('message-detail', msg);
        };
        
        return {
            store,
            utils,
            activeTab,
            dialedNumber,
            keypadButtons,
            pressKey,
            deleteDigit,
            startCall,
            addToContacts,
            addNewContact,
            callContact,
            openConversation
        };
    }
};

// Contact Edit Component
const ContactEdit = {
    template: `
        <div class="view" :class="{ hidden: store.currentView !== 'contact-edit' }">
            <div class="app-header">
                <button class="back-btn" @click="cancel">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span>{{ isEdit ? 'Edit Contact' : 'New Contact' }}</span>
                <button class="save-btn" @click="save" :disabled="!canSave">
                    Save
                </button>
            </div>
            <div class="scrollable-content" style="padding: 20px;">
                <div class="input-group">
                    <label>Name</label>
                    <input v-model="name" type="text" placeholder="John Doe">
                </div>
                <div class="input-group">
                    <label>Phone Number</label>
                    <input v-model="number" type="text" placeholder="555-0100">
                </div>
                <div v-if="isEdit" style="margin-top: 20px;">
                    <button class="btn-delete" @click="deleteContact">
                        <i class="fas fa-trash"></i> Delete Contact
                    </button>
                </div>
            </div>
        </div>
    `,
    setup() {
        const name = ref(store.currentViewData?.name || '');
        const number = ref(store.currentViewData?.number || '');
        const isEdit = computed(() => !!store.currentViewData?.id);
        
        const canSave = computed(() => {
            return name.value.trim() !== '' && number.value.trim() !== '';
        });
        
        const save = () => {
            if (!canSave.value) return;
            
            if (isEdit.value) {
                // Update existing contact
                const contact = store.contacts.find(c => c.id === store.currentViewData.id);
                if (contact) {
                    contact.name = name.value;
                    contact.number = number.value;
                }
            } else {
                // Add new contact
                mp.trigger('client:phone:appCallback', 'phone', 'addContact', JSON.stringify({
                    name: name.value,
                    number: number.value
                }));
            }
            
            store.goBack();
        };
        
        const deleteContact = () => {
            if (confirm(`Delete contact ${name.value}?`)) {
                mp.trigger('client:phone:appCallback', 'phone', 'deleteContact', JSON.stringify({
                    contactId: store.currentViewData.id
                }));
                store.navigateTo('phone-app');
            }
        };
        
        const cancel = () => {
            store.goBack();
        };
        
        return { 
            store,
            name, 
            number, 
            isEdit, 
            canSave, 
            save, 
            deleteContact, 
            cancel 
        };
    }
};

// Message Detail Component
const MessageDetail = {
    template: `
        <div class="view" :class="{ hidden: store.currentView !== 'message-detail' }">
            <div class="app-header">
                <button class="back-btn" @click="store.navigateTo('phone-app')">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span>{{ store.currentViewData?.contact || 'Messages' }}</span>
            </div>
            <div class="message-thread">
                <div v-for="msg in messages" 
                     :key="msg.id"
                     class="message-bubble"
                     :class="msg.isSent ? 'sent' : 'received'">
                    <div class="message-content">{{ msg.text }}</div>
                    <div class="message-time">{{ utils.formatTime(msg.timestamp) }}</div>
                </div>
            </div>
            <div class="message-input-bar">
                <input v-model="newMessage" 
                       type="text" 
                       placeholder="Type a message..."
                       @keyup.enter="sendMessage">
                <button @click="sendMessage" :disabled="!newMessage.trim()">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    `,
    setup() {
        const newMessage = ref('');
        const messages = ref([
            // Load conversation history from store
            // This would be populated from server
        ]);
        
        const sendMessage = () => {
            if (!newMessage.value.trim()) return;
            
            mp.trigger('client:phone:appCallback', 'phone', 'sendMessage', JSON.stringify({
                number: store.currentViewData.number,
                message: newMessage.value
            }));
            
            // Optimistically add to UI
            messages.value.push({
                id: Date.now(),
                text: newMessage.value,
                isSent: true,
                timestamp: new Date()
            });
            
            newMessage.value = '';
        };
        
        return { store, utils, newMessage, messages, sendMessage };
    }
};

// Bank App Component
const BankApp = {
    template: `
        <div class="view" :class="{ hidden: store.currentView !== 'bank' }">
            <div class="app-header">
                <button class="back-btn" @click="store.goHome()">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span>Fleeca Bank</span>
            </div>
            <div class="scrollable-content">
                <div class="bank-balance-card">
                    <div class="balance-label">Current Balance</div>
                    <div class="balance-amount">{{ utils.formatCurrency(store.bankData.balance) }}</div>
                </div>
                
                <div class="bank-actions">
                    <div class="bank-action-btn" @click="openTransfer">
                        <div class="action-icon-box" style="background: #00a8ff;">
                            <i class="fas fa-paper-plane"></i>
                        </div>
                        <span>Send</span>
                    </div>
                    <div class="bank-action-btn" @click="requestMoney">
                        <div class="action-icon-box" style="background: #34c759;">
                            <i class="fas fa-hand-holding-usd"></i>
                        </div>
                        <span>Request</span>
                    </div>
                    <div class="bank-action-btn">
                        <div class="action-icon-box" style="background: #8e8e93;">
                            <i class="fas fa-ellipsis-h"></i>
                        </div>
                        <span>More</span>
                    </div>
                </div>
                
                <div class="bank-section-title">
                    <span style="font-weight: bold; font-size: 16px;">Recent Activity</span>
                    <span style="font-size: 12px; color: #888;">Last 48h</span>
                </div>
                
                <div class="bank-history-list">
                    <div v-for="transaction in store.bankData.history" 
                         :key="transaction.id"
                         class="transaction-item">
                        <div class="transaction-icon" 
                             :class="transaction.type === 'income' ? 'income' : 'expense'">
                            <i :class="transaction.type === 'income' ? 'fas fa-arrow-down' : 'fas fa-arrow-up'"></i>
                        </div>
                        <div class="transaction-info">
                            <strong>{{ transaction.description }}</strong>
                            <span>{{ utils.getRelativeTime(transaction.timestamp) }}</span>
                        </div>
                        <div class="transaction-amount" 
                             :class="transaction.type === 'income' ? 'positive' : 'negative'">
                            {{ transaction.type === 'income' ? '+' : '-' }}{{ utils.formatCurrency(Math.abs(transaction.amount)) }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const openTransfer = () => {
            store.navigateTo('bank-transfer');
        };
        
        const requestMoney = () => {
            store.addNotification('system', 'Feature Coming Soon', 'Money request feature is under development.');
        };
        
        return { store, utils, openTransfer, requestMoney };
    }
};

// Bank Transfer Modal Component
const BankTransferModal = {
    template: `
        <div class="view" :class="{ hidden: store.currentView !== 'bank-transfer' }">
            <div class="app-header">
                <button class="back-btn" @click="store.navigateTo('bank')">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span>Send Money</span>
            </div>
            <div class="scrollable-content" style="padding: 20px;">
                <div v-if="step === 1" class="transfer-form">
                    <div class="input-group">
                        <label>Recipient Name or ID</label>
                        <input v-model="recipient" type="text" placeholder="John Doe or ID">
                    </div>
                    <div class="input-group">
                        <label>Amount</label>
                        <input v-model.number="amount" type="number" placeholder="0">
                    </div>
                    <div class="input-group">
                        <label>Note (Optional)</label>
                        <input v-model="note" type="text" placeholder="What's this for?">
                    </div>
                    <div class="modal-buttons">
                        <button class="btn-cancel" @click="store.navigateTo('bank')">Cancel</button>
                        <button class="btn-confirm" @click="verifyTransfer" :disabled="!canProceed">
                            Next
                        </button>
                    </div>
                </div>
                
                <div v-if="step === 2" class="transfer-confirmation">
                    <div class="confirm-box">
                        <h3>Confirm Transfer</h3>
                        <div class="confirm-detail">
                            <span>To:</span>
                            <strong>{{ recipient }}</strong>
                        </div>
                        <div class="confirm-detail">
                            <span>Amount:</span>
                            <strong>{{ utils.formatCurrency(amount) }}</strong>
                        </div>
                        <div v-if="note" class="confirm-detail">
                            <span>Note:</span>
                            <strong>{{ note }}</strong>
                        </div>
                        <div class="confirm-warning">
                            This action cannot be undone.
                        </div>
                    </div>
                    <div class="modal-buttons">
                        <button class="btn-cancel" @click="step = 1">Back</button>
                        <button class="btn-confirm" @click="submitTransfer">
                            Confirm Transfer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const step = ref(1);
        const recipient = ref('');
        const amount = ref(0);
        const note = ref('');
        
        const canProceed = computed(() => {
            return recipient.value.trim() !== '' && 
                   amount.value > 0 && 
                   amount.value <= store.bankData.balance;
        });
        
        const verifyTransfer = () => {
            if (canProceed.value) {
                step.value = 2;
            }
        };
        
        const submitTransfer = () => {
            mp.trigger('client:phone:appCallback', 'bank', 'transfer', JSON.stringify({
                target: recipient.value,
                amount: amount.value,
                note: note.value
            }));
            
            // Reset form
            step.value = 1;
            recipient.value = '';
            amount.value = 0;
            note.value = '';
            
            store.navigateTo('bank');
        };
        
        return { 
            store, 
            utils, 
            step, 
            recipient, 
            amount, 
            note, 
            canProceed, 
            verifyTransfer, 
            submitTransfer 
        };
    }
};

// Vehicles App Component
const VehiclesApp = {
    template: `
        <div class="view" :class="{ hidden: store.currentView !== 'vehicles' }">
            <div class="app-header">
                <button class="back-btn" @click="store.goHome()">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span>My Cars</span>
                <span class="slots-badge">{{ store.vehicles.length }}/{{ maxSlots }}</span>
            </div>
            <div class="scrollable-content">
                <div v-if="store.vehicles.length === 0" class="empty-state">
                    <i class="fas fa-car"></i>
                    <p>No vehicles</p>
                </div>
                <div v-else>
                    <div v-for="vehicle in store.vehicles" 
                         :key="vehicle.id"
                         class="vehicle-card"
                         @click="openVehicle(vehicle)">
                        <div class="vehicle-icon">
                            <i class="fas fa-car"></i>
                            <span class="vehicle-grade">{{ vehicle.grade || 'C' }}</span>
                        </div>
                        <div class="vehicle-info">
                            <h3>{{ vehicle.model }}</h3>
                            <p>{{ vehicle.plate }}</p>
                            <div class="vehicle-status">
                                <span :class="'status-' + vehicle.status">{{ vehicle.status }}</span>
                                <span class="fuel-indicator">⛽ {{ vehicle.fuel }}%</span>
                            </div>
                        </div>
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const maxSlots = ref(3);
        
        const openVehicle = (vehicle) => {
            store.navigateTo('vehicle-detail', vehicle);
        };
        
        return { store, maxSlots, openVehicle };
    }
};

// Vehicle Detail Component
const VehicleDetail = {
    template: `
        <div class="view" :class="{ hidden: store.currentView !== 'vehicle-detail' }">
            <div class="app-header">
                <button class="back-btn" @click="store.navigateTo('vehicles')">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span>{{ store.currentViewData?.model || 'Vehicle' }}</span>
            </div>
            <div class="detail-container veh-detail-new">
                <div class="veh-detail-top">
                    <div class="veh-detail-icon-wrap">
                        <i class="fas fa-car"></i>
                        <span class="veh-detail-grade">{{ store.currentViewData?.grade || 'C' }}</span>
                    </div>
                    <h2>{{ store.currentViewData?.model }}</h2>
                    <p>{{ store.currentViewData?.plate }}</p>
                    <span class="veh-detail-type">{{ store.currentViewData?.type || 'Sedan' }}</span>
                </div>
                
                <div class="stat-box">
                    <div class="stat-row">
                        <span>Status</span>
                        <span class="status-tag" :class="'status-' + store.currentViewData?.status">
                            {{ store.currentViewData?.status || 'Unknown' }}
                        </span>
                    </div>
                    <div class="stat-row">
                        <span>Fuel</span>
                        <div class="fuel-bar-wrap">
                            <div class="fuel-bar" :style="{ width: (store.currentViewData?.fuel || 0) + '%' }"></div>
                        </div>
                        <span class="fuel-pct">{{ store.currentViewData?.fuel || 0 }}%</span>
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button class="action-btn btn-green" 
                            :disabled="store.currentViewData?.status === 'spawned'"
                            @click="vehicleAction('spawn')">
                        <i class="fas fa-key"></i> Spawn
                    </button>
                    <button class="action-btn btn-blue" 
                            :disabled="store.currentViewData?.status !== 'spawned'"
                            @click="vehicleAction('locate')">
                        <i class="fas fa-map-marker-alt"></i> Locate
                    </button>
                    <button class="action-btn btn-red" 
                            :disabled="store.currentViewData?.status !== 'spawned'"
                            @click="vehicleAction('despawn')">
                        <i class="fas fa-warehouse"></i> Park
                    </button>
                </div>
                
                <div class="veh-sell-section">
                    <div class="sell-info">
                        <span class="sell-label">Sell Value</span>
                        <span class="sell-price">{{ utils.formatCurrency(store.currentViewData?.sellPrice || 0) }}</span>
                    </div>
                    <button class="sell-btn" @click="confirmSell">
                        <i class="fas fa-dollar-sign"></i> Sell
                    </button>
                </div>
            </div>
        </div>
    `,
    setup() {
        const vehicleAction = (action) => {
            mp.trigger('client:phone:appCallback', 'vehicles', action, JSON.stringify({
                vehicleId: store.currentViewData.id
            }));
        };
        
        const confirmSell = () => {
            if (confirm(`Are you sure you want to sell ${store.currentViewData.model} for ${utils.formatCurrency(store.currentViewData.sellPrice)}?`)) {
                vehicleAction('sell');
                store.navigateTo('vehicles');
            }
        };
        
        return { store, utils, vehicleAction, confirmSell };
    }
};

// Settings App Component
const SettingsApp = {
    template: `
        <div class="view" :class="{ hidden: store.currentView !== 'settings' }">
            <div class="app-header">
                <button class="back-btn" @click="store.goHome()">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span>Settings</span>
            </div>
            <div class="scrollable-content">
                <div class="settings-section">
                    <h3>Connectivity</h3>
                    <div class="setting-item" @click="toggleFlightMode">
                        <div>
                            <i class="fas fa-plane"></i>
                            <span>Airplane Mode</span>
                        </div>
                        <div class="toggle-switch" :class="{ active: store.settings.flightMode }">
                            <div class="toggle-knob"></div>
                        </div>
                    </div>
                    <div class="setting-item" @click="toggleDND">
                        <div>
                            <i class="fas fa-moon"></i>
                            <span>Do Not Disturb</span>
                        </div>
                        <div class="toggle-switch" :class="{ active: store.settings.dndMode }">
                            <div class="toggle-knob"></div>
                        </div>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h3>Personalization</h3>
                    <div class="setting-item" @click="openWallpapers">
                        <div>
                            <i class="fas fa-image"></i>
                            <span>Wallpaper</span>
                        </div>
                        <i class="fas fa-chevron-right"></i>
                    </div>
                    <div class="setting-item" @click="openRingtones">
                        <div>
                            <i class="fas fa-music"></i>
                            <span>Ringtone</span>
                        </div>
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h3>Account</h3>
                    <div class="setting-item">
                        <div>
                            <i class="fas fa-phone"></i>
                            <span>Phone Number</span>
                        </div>
                        <span class="setting-value">{{ store.phoneNumber || 'Not Set' }}</span>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const toggleFlightMode = () => {
            store.settings.flightMode = !store.settings.flightMode;
            mp.trigger('client:phone:toggleFlightMode', store.settings.flightMode);
        };
        
        const toggleDND = () => {
            store.settings.dndMode = !store.settings.dndMode;
            mp.trigger('client:phone:toggleDND', store.settings.dndMode);
        };
        
        const openWallpapers = () => {
            store.navigateTo('settings-wallpapers');
        };
        
        const openRingtones = () => {
            store.navigateTo('settings-ringtones');
        };
        
        return {
            store,
            toggleFlightMode,
            toggleDND,
            openWallpapers,
            openRingtones
        };
    }
};

// Incoming Call Overlay Component
const IncomingCallOverlay = {
    template: `
        <transition name="slide-up">
            <div v-if="store.callState === 'incoming'" class="call-overlay">
                <div class="call-content">
                    <div class="caller-avatar">
                        {{ store.callData?.name?.charAt(0) || '?' }}
                    </div>
                    <h2>{{ store.callData?.name || store.callData?.number }}</h2>
                    <p>Incoming Call</p>
                    <div class="call-actions">
                        <button class="call-btn-decline" @click="rejectCall">
                            <i class="fas fa-phone-slash"></i>
                        </button>
                        <button class="call-btn-accept" @click="acceptCall">
                            <i class="fas fa-phone"></i>
                        </button>
                    </div>
                </div>
            </div>
        </transition>
    `,
    setup() {
        const acceptCall = () => {
            mp.trigger('client:phone:appCallback', 'phone', 'acceptCall', '{}');
        };
        
        const rejectCall = () => {
            mp.trigger('client:phone:appCallback', 'phone', 'rejectCall', '{}');
        };
        
        return { store, acceptCall, rejectCall };
    }
};

// Active Call Overlay Component
const ActiveCallOverlay = {
    template: `
        <transition name="fade">
            <div v-if="store.callState === 'active' || store.callState === 'ringing'" 
                 class="call-overlay active-call">
                <div class="call-content">
                    <div class="caller-avatar">
                        {{ store.callData?.name?.charAt(0) || '?' }}
                    </div>
                    <h2>{{ store.callData?.name || store.callData?.number }}</h2>
                    <p v-if="store.callState === 'ringing'">Calling...</p>
                    <p v-else class="call-timer">{{ store.callTimer }}</p>
                    <div class="call-actions">
                        <button class="call-btn-end" @click="endCall">
                            <i class="fas fa-phone-slash"></i>
                        </button>
                    </div>
                    <div class="call-mini-controls">
                        <button @click="toggleMute">
                            <i :class="isMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone'"></i>
                        </button>
                        <button @click="toggleSpeaker">
                            <i :class="isSpeaker ? 'fas fa-volume-up' : 'fas fa-volume-down'"></i>
                        </button>
                    </div>
                </div>
            </div>
        </transition>
    `,
    setup() {
        const isMuted = ref(false);
        const isSpeaker = ref(false);
        
        const endCall = () => {
            mp.trigger('client:phone:appCallback', 'phone', 'endCall', '{}');
        };
        
        const toggleMute = () => {
            isMuted.value = !isMuted.value;
            mp.trigger('client:phone:toggleMute', isMuted.value);
        };
        
        const toggleSpeaker = () => {
            isSpeaker.value = !isSpeaker.value;
            mp.trigger('client:phone:toggleSpeaker', isSpeaker.value);
        };
        
        return { store, isMuted, isSpeaker, endCall, toggleMute, toggleSpeaker };
    }
};

// Toast Notification Component
const ToastNotification = {
    template: `
        <transition name="slide-down">
            <div v-if="currentToast" id="toast-shell">
                <div class="toast-screen">
                    <div class="status-bar">
                        <span>{{ currentTime }}</span>
                        <div class="status-icons">
                            <i class="fas fa-signal"></i>
                            <i class="fas fa-wifi"></i>
                            <i class="fas fa-battery-full"></i>
                        </div>
                    </div>
                    <div class="toast-content-area">
                        <div class="toast-card">
                            <div class="toast-icon-box" :style="{ background: appColor }">
                                <i :class="appIcon"></i>
                            </div>
                            <div class="toast-text-group">
                                <div class="toast-header">
                                    <span>{{ currentToast.title }}</span>
                                    <span class="toast-time">now</span>
                                </div>
                                <div class="toast-message">{{ currentToast.message }}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </transition>
    `,
    setup() {
        const currentToast = ref(null);
        const currentTime = ref('12:00');
        
        const appColor = computed(() => {
            if (!currentToast.value) return '#636366';
            return NOTIFICATION_APPS[currentToast.value.appType]?.color || '#636366';
        });
        
        const appIcon = computed(() => {
            if (!currentToast.value) return 'fas fa-bell';
            return NOTIFICATION_APPS[currentToast.value.appType]?.icon || 'fas fa-bell';
        });
        
        // Watch for new notifications
        watch(() => store.notifications.length, () => {
            if (store.notifications.length > 0 && store.isLocked) {
                currentToast.value = store.notifications[0];
                setTimeout(() => {
                    currentToast.value = null;
                }, 5000);
            }
        });
        
        setInterval(() => {
            currentTime.value = new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        }, 1000);
        
        return { currentToast, currentTime, appColor, appIcon };
    }
};

// Home Bar Component
const HomeBar = {
    template: `
        <div class="home-bar-area" @click="store.goHome()">
            <div class="home-bar"></div>
        </div>
    `,
    setup() {
        return { store };
    }
};

// ============================================
// MAIN PHONE SHELL COMPONENT
// ============================================
const PhoneShell = {
    components: {
        StatusBar,
        LockScreen,
        HomeScreen,
        MailApp,
        MailDetail,
        PhoneApp,
        ContactEdit,
        MessageDetail,
        BankApp,
        BankTransferModal,
        VehiclesApp,
        VehicleDetail,
        SettingsApp,
        IncomingCallOverlay,
        ActiveCallOverlay,
        ToastNotification,
        HomeBar
    },
    template: `
        <div>
            <div id="phone-shell" :class="{ hidden: !isVisible }">
                <div class="screen-content">
                    <status-bar />
                    
                    <lock-screen v-if="store.currentView === 'lock'" />
                    <home-screen v-if="store.currentView === 'home'" />
                    <mail-app v-if="store.currentView === 'mail'" />
                    <mail-detail v-if="store.currentView === 'mail-detail'" />
                    <phone-app v-if="store.currentView === 'phone-app'" />
                    <contact-edit v-if="store.currentView === 'contact-edit'" />
                    <message-detail v-if="store.currentView === 'message-detail'" />
                    <bank-app v-if="store.currentView === 'bank'" />
                    <bank-transfer-modal v-if="store.currentView === 'bank-transfer'" />
                    <vehicles-app v-if="store.currentView === 'vehicles'" />
                    <vehicle-detail v-if="store.currentView === 'vehicle-detail'" />
                    <settings-app v-if="store.currentView === 'settings'" />
                    
                    <home-bar />
                </div>
            </div>
            
            <!-- Call Overlays (outside phone shell for full screen) -->
            <incoming-call-overlay />
            <active-call-overlay />
            
            <!-- Toast Notifications (outside phone shell) -->
            <toast-notification />
        </div>
    `,
    setup() {
        const isVisible = ref(false);
        
        // Store instance for global access
        vueAppInstance = { isVisible };
        
        // Debug logging
        console.log('PhoneShell mounted, isVisible:', isVisible.value);
        
        return { isVisible, store };
    }
};

// ============================================
// GLOBAL API FOR RAGE:MP
// ============================================

// Store the Vue app instance globally for easy access
let vueAppInstance = null;

window.openPhone = function() {
    console.log('openPhone called');
    if (vueAppInstance) {
        console.log('Setting isVisible to true');
        vueAppInstance.isVisible = true;
    } else {
        console.error('Vue app instance not found!');
    }
};

window.closePhone = function() {
    console.log('closePhone called');
    if (vueAppInstance) {
        vueAppInstance.isVisible = false;
        store.lock();
    } else {
        console.error('Vue app instance not found!');
    }
};

window.receiveNotification = function(sender, title, message, appType = 'system') {
    store.addNotification(appType, title, message);
};

window.updateBankData = function(balance, history) {
    store.bankData.balance = balance;
    store.bankData.history = history;
};

window.updateVehicles = function(vehicles) {
    store.vehicles = vehicles;
};

window.updateMails = function(mails) {
    store.mails = mails;
    store.unreadMails = mails.filter(m => !m.read).length;
};

window.updateContacts = function(contacts) {
    store.contacts = contacts;
};

window.updateMessages = function(messages) {
    store.messages = messages;
};

window.setPhoneNumber = function(number) {
    store.phoneNumber = number;
};

window.showIncomingCall = function(number, name) {
    store.callState = 'incoming';
    store.callData = { number, name };
};

window.showOutgoingCall = function(number, name) {
    store.callState = 'ringing';
    store.callData = { number, name };
};

window.updateCallTimer = function(time) {
    store.callTimer = time;
};

window.endCall = function() {
    store.callState = null;
    store.callData = null;
    store.callTimer = 0;
};

// ============================================
// CREATE VUE APP
// ============================================
const app = createApp(PhoneShell);
app.mount('#app');