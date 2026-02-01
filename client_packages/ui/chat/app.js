const app = new Vue({
    el: '#app',
    data: {
        inputActive: false,
        currentInput: '',
        messages: [],
        commands: [], 
        currentTab: 'All',
        tabs: ['All', 'Local', 'Admin', 'Clan'],
        showSettings: false,
        settings: {
            height: 300,
            nameColor: '#aaaaaa',
            textColor: '#ffffff'
        }
    },
    computed: {
        filteredMessages() {
            if (this.currentTab === 'All') return this.messages;
            return this.messages.filter(m => m.type.toLowerCase() === this.currentTab.toLowerCase());
        },
        // NEW: Filter commands based on input
        suggestions() {
            // Only show if typing a command (starts with /)
            if (!this.currentInput.startsWith('/')) return [];
            
            const search = this.currentInput.substring(1).toLowerCase();
            
            // If just '/', show nothing (or show top 5 if you prefer)
            if (search.length === 0) return []; 

            // Find matches and limit to 5
            return this.commands
                .filter(cmd => cmd.toLowerCase().startsWith(search))
                .slice(0, 5); 
        }
    },
    methods: {
        addMessage(username, text, type) {
            this.messages.push({ username, text, type });
            if (this.messages.length > 50) this.messages.shift();
            
            this.$nextTick(() => {
                const container = this.$el.querySelector('.chat-messages');
                if (container) container.scrollTop = container.scrollHeight;
            });
        },
        openInput() {
            this.inputActive = true;
            this.$nextTick(() => {
                const input = document.getElementById('chatInput');
                if(input) input.focus();
            });
        },
        closeChat() {
            this.inputActive = false;
            this.showSettings = false;
            // Clear suggestions when closing
            this.currentInput = ''; 
            mp.trigger('chat:close');
        },
        sendMessage() {
            if (this.currentInput.trim() !== '') {
                mp.trigger('chat:submit', this.currentInput);
            }
            this.currentInput = '';
            this.closeChat();
        },
        // NEW: Apply the first suggestion when TAB is pressed
        applySuggestion() {
            if (this.suggestions.length > 0) {
                this.currentInput = '/' + this.suggestions[0] + ' ';
                // Keep focus on input
                document.getElementById('chatInput').focus();
            }
        },
        // NEW: Click a suggestion from the list
        selectSuggestion(cmd) {
            this.currentInput = '/' + cmd + ' ';
            document.getElementById('chatInput').focus();
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

        if (typeof mp !== 'undefined') {
            mp.trigger('chat:browserReady');
        }
    }
});