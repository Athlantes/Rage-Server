const app = new Vue({
    el: '#app',
    data: {
        inputActive: false,
        currentInput: '',
        messages: [],
        commands: [],
        // UPDATED TABS: Removed Trade, added typical RPG tabs
        tabs: ['All', 'Local', 'Whisper', 'Clan', 'Faction', 'Admin'],
        currentTab: 'All',
        showSettings: false,
        settings: {
            height: 300,
            nameColor: '#aaaaaa',
            timestamp: false
        },
        suggestionIndex: -1,
        messageHistory: [],
        historyIndex: -1
    },
    computed: {
        filteredMessages() {
            if (this.currentTab === 'All') return this.messages;
            
            // Filter logic:
            // "Whisper" tab catches both incoming and outgoing whispers
            if (this.currentTab === 'Whisper') {
                return this.messages.filter(m => m.type === 'whisper');
            }
            
            return this.messages.filter(m => m.type.toLowerCase() === this.currentTab.toLowerCase());
        },
        // ... (rest of suggestions logic stays the same)
        suggestions() {
            if (!this.currentInput.startsWith('/')) return [];
            const search = this.currentInput.substring(1).toLowerCase();
            if (search.length === 0) return this.commands.slice(0, 5);
            return this.commands.filter(cmd => cmd.toLowerCase().startsWith(search)).slice(0, 5); 
        }
    },
    methods: {
        formatMessage(text) {
            if (!text) return '';
            let safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            
            // Basic color parsing
            safeText = safeText.replace(/!\{([a-fA-F0-9]{6})\}/g, (match, color) => {
                return `<span style="color: #${color}">`;
            });
            return safeText;
        },
        addMessage(username, text, type = 'local') {
            // Check if we need to auto-add a tab? (Disabled to keep your fixed list clean)
            // const capType = type.charAt(0).toUpperCase() + type.slice(1);
            
            this.messages.push({ 
                username, 
                text, 
                type,
                formattedText: this.formatMessage(text)
            });

            if (this.messages.length > 100) this.messages.shift();
            this.scrollToBottom();
        },
        // ... (rest of the methods: scrollToBottom, openInput, closeChat, etc. remain unchanged)
        scrollToBottom() {
            this.$nextTick(() => {
                const container = this.$el.querySelector('.chat-messages');
                if (container) container.scrollTop = container.scrollHeight;
            });
        },
        openInput() {
            this.inputActive = true;
            this.suggestionIndex = -1;
            this.historyIndex = -1;
            this.$nextTick(() => document.getElementById('chatInput').focus());
        },
        closeChat() {
            this.inputActive = false;
            this.showSettings = false;
            this.currentInput = '';
            mp.trigger('chat:close');
        },
        sendMessage() {
            const text = this.currentInput.trim();
            if (text !== '') {
                if (this.messageHistory[0] !== text) this.messageHistory.unshift(text);
                mp.trigger('chat:submit', text);
            }
            this.currentInput = '';
            this.closeChat();
        },
        handleUp() {
            if (this.suggestions.length > 0) {
                this.suggestionIndex--;
                if (this.suggestionIndex < 0) this.suggestionIndex = this.suggestions.length - 1;
                return;
            }
            if (this.historyIndex < this.messageHistory.length - 1) {
                this.historyIndex++;
                this.currentInput = this.messageHistory[this.historyIndex];
            }
        },
        handleDown() {
            if (this.suggestions.length > 0) {
                this.suggestionIndex++;
                if (this.suggestionIndex >= this.suggestions.length) this.suggestionIndex = 0;
                return;
            }
            if (this.historyIndex > -1) {
                this.historyIndex--;
                this.currentInput = this.historyIndex >= 0 ? this.messageHistory[this.historyIndex] : '';
            }
        },
        handleTab() {
            if (this.suggestions.length > 0) {
                const idx = this.suggestionIndex >= 0 ? this.suggestionIndex : 0;
                this.selectSuggestion(this.suggestions[idx]);
            }
        },
        selectSuggestion(cmd) {
            this.currentInput = '/' + cmd + ' ';
            this.suggestionIndex = -1;
            document.getElementById('chatInput').focus();
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
        if (typeof mp !== 'undefined') mp.trigger('chat:browserReady');
    }
});