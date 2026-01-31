// client_packages/ui/auth/app.js

function switchTab(tab) {
    document.getElementById('login-panel').classList.add('hidden');
    document.getElementById('register-panel').classList.add('hidden');
    document.getElementById('notification').classList.add('hidden');

    if (tab === 'login') {
        document.getElementById('login-panel').classList.remove('hidden');
    } else {
        document.getElementById('register-panel').classList.remove('hidden');
    }
}

function loadRecent(jsonString) {
    const accounts = JSON.parse(jsonString);
    const container = document.getElementById('quick-access-area');
    const list = document.getElementById('recent-list');
    list.innerHTML = '';

    if (accounts.length > 0) {
        container.classList.remove('hidden');
        accounts.forEach(acc => {
            const card = document.createElement('div');
            card.className = 'recent-card';
            card.onclick = () => mp.trigger('client:auth:tryAutoLogin', acc.username);
            
            card.innerHTML = `
                <div class="avatar-circle">
                    <i class="fas fa-user-circle"></i>
                </div>
                <div class="user-info">
                    <strong>${acc.username}</strong>
                    <small>Level ${acc.level} • $${acc.money.toLocaleString()}</small>
                </div>
                <i class="fas fa-chevron-right" style="margin-left:auto; color:#444;"></i>
            `;
            list.appendChild(card);
        });
    } else {
        container.classList.add('hidden');
    }
}

function attemptLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    if(!u || !p) return showError("Please fill in all fields.");
    mp.trigger('client:auth:login', u, p);
}

function attemptRegister() {
    const u = document.getElementById('reg-user').value;
    const p = document.getElementById('reg-pass').value;
    const rp = document.getElementById('reg-repass').value;

    if(!u || !p) return showError("Please fill in all fields.");
    if(p !== rp) return showError("Passwords do not match.");
    
    mp.trigger('client:auth:register', u, p);
}

function showError(msg) {
    const el = document.getElementById('notification');
    el.innerText = msg;
    el.classList.remove('hidden');
}

// Global Exports for RageMP
window.loadRecent = loadRecent;
window.showError = showError;
window.switchTab = switchTab;