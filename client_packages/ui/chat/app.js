const app = new Vue({
    el: '#app',
    data: {
        inputActive: false,
        currentInput: '',
        messages: [],
        commands: [], // Loaded from server
        currentTab: 'All',
        tabs: ['All', 'Local', 'Admin', 'Clan'],
        showSettings: false,
        settings: {
            height: 300,
            nameColor: '#aaaaaa', // Default Gray
            textColor: '#ffffff'  // Default White
        }
    },
    computed: {
        filteredMessages() {
            if (this.currentTab === 'All') return this.messages;
            return this.messages.filter(m => m.type.toLowerCase() === this.currentTab.toLowerCase());
        }
    },
    methods: {
        addMessage(username, text, type) {
            this.messages.push({ username, text, type });
            if (this.messages.length > 50) this.messages.shift();
            
            // Auto scroll down
            this.$nextTick(() => {
                const container = this.$el.querySelector('.chat-messages');
                container.scrollTop = container.scrollHeight;
            });
        },
        openInput() {
            this.inputActive = true;
            this.$nextTick(() => document.getElementById('chatInput').focus());
        },
        closeChat() {
            this.inputActive = false;
            this.showSettings = false;
            mp.trigger('chat:close');
        },
        sendMessage() {
            if (this.currentInput.trim() !== '') {
                mp.trigger('chat:submit', this.currentInput);
            }
            this.currentInput = '';
            this.closeChat();
        },
        handleTab() {
            if (!this.currentInput.startsWith('/')) return;
            
            const search = this.currentInput.substring(1);
            const match = this.commands.find(cmd => cmd.startsWith(search));
            
            if (match) {
                this.currentInput = '/' + match + ' ';
            }
        },
        toggleSettings() {
            this.showSettings = !this.showSettings;
        },
        saveSettings() {
            this.showSettings = false;
            localStorage.setItem('chatSettings', JSON.stringify(this.settings));
        },
        setCommands(cmds) {
            this.commands = cmds;
        }
    },
    mounted() {
        const saved = localStorage.getItem('chatSettings');
        if (saved) this.settings = JSON.parse(saved);
    }
});