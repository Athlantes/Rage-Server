const input = document.getElementById('chat-input');
const messagesDiv = document.getElementById('messages');
const inputArea = document.getElementById('input-area');
const suggestionsDiv = document.getElementById('suggestions');

let allCommands = [];
let activeSuggestions = [];
let selectedIndex = -1;
let history = [];
let historyIndex = -1;

// --- API exposed to Client Script ---
window.chatAPI = {
    push: (name, text, type) => {
        const msg = document.createElement('div');
        msg.className = `message ${type}`;
        
        // Format Colors (simple regex for !{hex})
        let formatted = text.replace(/!\{([0-9a-fA-F]{6})\}/g, '<span style="color:#$1">');
        
        if (name) {
            msg.innerHTML = `<b>${name}:</b> ${formatted}`;
        } else {
            msg.innerHTML = formatted;
        }

        messagesDiv.appendChild(msg);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        // Auto-remove old messages
        if (messagesDiv.children.length > 50) {
            messagesDiv.removeChild(messagesDiv.firstChild);
        }
    },

    showInput: (state) => {
        if (state) {
            inputArea.classList.remove('hidden');
            input.focus();
            setTimeout(() => input.focus(), 10); // Ensure focus
        } else {
            inputArea.classList.add('hidden');
            input.value = '';
            closeSuggestions();
        }
    },

    setCommands: (cmds) => {
        allCommands = cmds;
        console.log(`[Chat] Loaded ${cmds.length} commands.`);
    }
};

// --- Input Logic ---

input.addEventListener('input', () => {
    const val = input.value;
    
    // Autocomplete Logic
    if (val.startsWith('/')) {
        const query = val.substring(1).toLowerCase();
        activeSuggestions = allCommands.filter(c => c.toLowerCase().startsWith(query)).slice(0, 5);
        
        if (activeSuggestions.length > 0) {
            renderSuggestions();
            suggestionsDiv.style.display = 'block';
        } else {
            closeSuggestions();
        }
    } else {
        closeSuggestions();
    }
});

input.addEventListener('keydown', (e) => {
    // ENTER: Send
    if (e.key === 'Enter') {
        e.preventDefault();
        const text = input.value.trim();
        if (text.length > 0) {
            history.unshift(text); // Add to history
            historyIndex = -1;
            mp.trigger('chat:client:send', text);
        }
        mp.trigger('chat:client:close');
        return;
    }
    
    // ESC: Close
    if (e.key === 'Escape') {
        e.preventDefault();
        mp.trigger('chat:client:close');
        return;
    }

    // TAB: Complete
    if (e.key === 'Tab') {
        e.preventDefault();
        if (activeSuggestions.length > 0) {
            const idx = selectedIndex > -1 ? selectedIndex : 0;
            input.value = '/' + activeSuggestions[idx] + ' ';
            closeSuggestions();
        }
        return;
    }

    // UP: History or Suggestions
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeSuggestions.length > 0) {
            selectedIndex--;
            if (selectedIndex < 0) selectedIndex = activeSuggestions.length - 1;
            renderSuggestions();
        } else if (history.length > 0) {
            if (historyIndex < history.length - 1) {
                historyIndex++;
                input.value = history[historyIndex];
            }
        }
        return;
    }

    // DOWN: History or Suggestions
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeSuggestions.length > 0) {
            selectedIndex++;
            if (selectedIndex >= activeSuggestions.length) selectedIndex = 0;
            renderSuggestions();
        } else if (historyIndex > -1) {
            historyIndex--;
            input.value = historyIndex >= 0 ? history[historyIndex] : '';
        }
        return;
    }
});

function renderSuggestions() {
    suggestionsDiv.innerHTML = '';
    activeSuggestions.forEach((cmd, idx) => {
        const div = document.createElement('div');
        div.className = 'suggestion-item' + (idx === selectedIndex ? ' selected' : '');
        div.innerText = '/' + cmd;
        suggestionsDiv.appendChild(div);
    });
}

function closeSuggestions() {
    suggestionsDiv.style.display = 'none';
    selectedIndex = -1;
}