const app = new Vue({
    el: '#app',
    data: {
        inputActive: false,
        currentInput: '',
        messages: [],
        commands: [],
        // Defined tabs. 'All' shows everything. Others filter by 'type'.
        tabs: ['All', 'Local', 'Admin', 'Clan', 'Faction'],
        currentTab: 'All',
        showSettings: false,
        settings: {
            height: 300,
            nameColor: '#aaaaaa', // User can still change their own name color locally if desired
            timestamp: false
        },
        // Autocomplete & History
        suggestionIndex: -1,
        messageHistory: [],
        historyIndex: -1
    },
    computed: {
        filteredMessages() {
            if (this.currentTab === 'All') return this.messages;
            // Filter messages where msg.type matches the current tab (case-insensitive)
            return this.messages.filter(m => m.type.toLowerCase() === this.currentTab.toLowerCase());
        },
        suggestions() {
            if (!this.currentInput.startsWith('/')) return [];
            const search = this.currentInput.substring(1).toLowerCase();
            if (search.length === 0) return [];
            
            // Return top 7 matches
            return this.commands
                .filter(cmd => cmd.toLowerCase().startsWith(search))
                .slice(0, 7);
        }
    },
    methods: {
        // Safe color parser
        formatMessage(text) {
            if (!text) return '';
            
            // 1. Sanitize HTML (prevent XSS)
            let safeText = text.replace(/&/g, "&amp;")
                               .replace(/</g, "&lt;")
                               .replace(/>/g, "&gt;")
                               .replace(/"/g, "&quot;")
                               .replace(/'/g, "&#039;");

            // 2. Parse Colors: !{RRGGBB} -> <span style="color:#RRGGBB">
            // Regex matches !{ followed by 6 hex characters }
            safeText = safeText.replace(/!\{([a-fA-F0-9]{6})\}/g, (match, color) => {
                return `<span style="color: #${color}">`;
            });

            // 3. Close spans (optional, but good practice if you want to reset colors)
            // Browsers usually auto-close, but we can append </span> if needed. 
            // For simple implementation, the browser handles unclosed spans at end of div.
            return safeText;
        },
        addMessage(username, text, type = 'local') {
            // Automatically add a tab if it doesn't exist (optional, makes it super easy to extend)
            const capType = type.charAt(0).toUpperCase() + type.slice(1);
            if (!this.tabs.includes(capType) && type.toLowerCase() !== 'info') {
                this.tabs.push(capType);
            }

            this.messages.push({ 
                username, 
                text, 
                type,
                formattedText: this.formatMessage(text)
            });

            if (this.messages.length > 100) this.messages.shift();
            
            this.scrollToBottom();
        },
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
                // Save to history
                if (this.messageHistory[0] !== text) {
                    this.messageHistory.unshift(text);
                }
                mp.trigger('chat:submit', text);
            }
            this.currentInput = '';
            this.closeChat();
        },
        // Navigation: Up/Down for History OR Suggestions
        handleUp() {
            // If suggestions are visible, navigate them
            if (this.suggestions.length > 0) {
                this.suggestionIndex--;
                if (this.suggestionIndex < 0) this.suggestionIndex = this.suggestions.length - 1;
                return;
            }
            // Otherwise, navigate history
            if (this.historyIndex < this.messageHistory.length - 1) {
                this.historyIndex++;
                this.currentInput = this.messageHistory[this.historyIndex];
            }
        },
        handleDown() {
            // If suggestions are visible
            if (this.suggestions.length > 0) {
                this.suggestionIndex++;
                if (this.suggestionIndex >= this.suggestions.length) this.suggestionIndex = 0;
                return;
            }
            // History
            if (this.historyIndex > -1) {
                this.historyIndex--;
                this.currentInput = this.historyIndex >= 0 ? this.messageHistory[this.historyIndex] : '';
            }
        },
        handleTab() {
            if (this.suggestions.length > 0) {
                // If user selected one with arrows, use that. Otherwise use first.
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