// client_packages/ui/chat/main.js

const msgBox = document.getElementById('messages-box');
const inputWrapper = document.getElementById('input-wrapper');
const input = document.getElementById('chat-input');
const autoList = document.getElementById('autocomplete-list');

// State
let commands = [];
let msgHistory = [];
let historyIndex = -1;
let suggestions = [];
let selectIndex = 0;

// --- API Called by Client Script ---
window.chatAPI = {
    push: (name, text, type = 'local') => {
        const el = document.createElement('div');
        el.className = `message ${type}`;
        
        // Handle RAGE colors !{HEX}
        let formattedText = text.replace(/!\{([0-9a-fA-F]{6})\}/g, '<span style="color:#$1">');

        if (name) {
            el.innerHTML = `<strong>${name}:</strong> ${formattedText}`;
        } else {
            el.innerHTML = formattedText;
        }

        msgBox.appendChild(el);
        msgBox.scrollTop = msgBox.scrollHeight;

        // Cleanup old messages
        if (msgBox.children.length > 100) {
            msgBox.removeChild(msgBox.firstChild);
        }
    },

    showInput: (show) => {
        if (show) {
            inputWrapper.classList.remove('hidden');
            input.focus();
            setTimeout(() => input.focus(), 10); // Force focus
        } else {
            inputWrapper.classList.add('hidden');
            input.value = '';
            closeSuggestions();
        }
    },

    setCommands: (list) => {
        commands = list.sort();
    }
};

// --- Input Event Listeners ---

input.addEventListener('keydown', (e) => {
    // ENTER: Send
    if (e.key === 'Enter') {
        const text = input.value.trim();
        if (text.length > 0) {
            // Save to history
            msgHistory.unshift(text);
            if (msgHistory.length > 20) msgHistory.pop();
            historyIndex = -1;

            // Send to client script
            // Use mp.trigger for RAGE compatibility
            mp.trigger('chat:client:send', text);
        }
        mp.trigger('chat:client:close');
        return;
    }

    // ESC: Close
    if (e.key === 'Escape') {
        mp.trigger('chat:client:close');
        return;
    }

    // UP ARROW: History or Suggestion Nav
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (suggestions.length > 0) {
            selectIndex = (selectIndex > 0) ? selectIndex - 1 : suggestions.length - 1;
            renderSuggestions();
        } else if (msgHistory.length > 0) {
            if (historyIndex < msgHistory.length - 1) {
                historyIndex++;
                input.value = msgHistory[historyIndex];
            }
        }
        return;
    }

    // DOWN ARROW: History or Suggestion Nav
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (suggestions.length > 0) {
            selectIndex = (selectIndex < suggestions.length - 1) ? selectIndex + 1 : 0;
            renderSuggestions();
        } else if (historyIndex > -1) {
            historyIndex--;
            input.value = (historyIndex >= 0) ? msgHistory[historyIndex] : '';
        }
        return;
    }

    // TAB: Autocomplete
    if (e.key === 'Tab') {
        e.preventDefault();
        if (suggestions.length > 0) {
            input.value = '/' + suggestions[selectIndex] + ' ';
            closeSuggestions();
        }
    }
});

// Autocomplete Logic
input.addEventListener('input', () => {
    const val = input.value;
    
    // Only autocomplete if starts with / and has no spaces yet
    if (val.startsWith('/') && !val.includes(' ')) {
        const query = val.substring(1).toLowerCase();
        
        // Filter commands
        suggestions = commands.filter(cmd => cmd.toLowerCase().startsWith(query)).slice(0, 5);
        
        if (suggestions.length > 0) {
            selectIndex = 0;
            renderSuggestions();
            autoList.style.display = 'block';
        } else {
            closeSuggestions();
        }
    } else {
        closeSuggestions();
    }
});

function renderSuggestions() {
    autoList.innerHTML = '';
    suggestions.forEach((cmd, index) => {
        const div = document.createElement('div');
        div.className = 'suggestion' + (index === selectIndex ? ' selected' : '');
        div.innerHTML = `<span>/${cmd}</span>`;
        autoList.appendChild(div);
    });
}

function closeSuggestions() {
    autoList.style.display = 'none';
    suggestions = [];
    selectIndex = 0;
}