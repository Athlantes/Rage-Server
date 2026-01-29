const app = {
    isLocked: true, 
    toastTimeout: null,

    // --- TIME HELPER (Added this to fix the crash) ---
    getRelativeTime: (dateString) => {
        if (!dateString) return 'now';
        const now = new Date();
        const past = new Date(dateString);
        const diffInSeconds = Math.floor((now - past) / 1000);

        if (diffInSeconds < 60) return 'now';
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
    },

    unlock: () => {
        app.isLocked = false;
        document.getElementById('view-lock').classList.add('hidden');
        document.getElementById('view-home').classList.remove('hidden');
    },

    lock: () => {
        app.isLocked = true;
        document.getElementById('view-lock').classList.remove('hidden');
        document.getElementById('view-home').classList.add('hidden');
        
        // Hide any other open apps
        document.querySelectorAll('.view').forEach(el => {
            if(el.id !== 'view-lock' && el.id !== 'view-home') el.classList.add('hidden');
        });
    },

    open: (appName) => {
        if(app.isLocked) return; 

        // [NEW] Request fresh data if opening the Bank app
        if (appName === 'bank') {
            // We pass 0 as a dummy ID because proxyAction expects a second argument
            if('mp' in window) mp.trigger('client:proxyAction', 'requestBankData', 0);
        }

        document.querySelectorAll('.view').forEach(el => {
            el.classList.add('hidden');
        });

        // 2. Show the requested view
        const appView = document.getElementById(`view-${appName}`);
        if(appView) {
            appView.classList.remove('hidden');
        } else {
            // Fallback: If view doesn't exist, go home
            document.getElementById('view-home').classList.remove('hidden');
        }
    },
    
    goHome: () => {
        if(app.isLocked) return;
        document.querySelectorAll('.view').forEach(el => {
            if(el.id !== 'view-home' && el.id !== 'view-lock') el.classList.add('hidden');
        });
        document.getElementById('view-home').classList.remove('hidden');
    },

    // --- DATA ---
    loadMails: (mails) => {
        const container = document.getElementById('mail-list');
        const lockContainer = document.getElementById('lock-notification-list');
        
        if (!container || !lockContainer) return; // Safety check

        container.innerHTML = ''; 
        lockContainer.innerHTML = '';

        if (!mails || mails.length === 0) {
            container.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">No Mail</div>';
            return;
        }

        let unreadCount = 0;

        mails.forEach(mail => {
            // This line was crashing the script because the function was missing
            const timeAgo = app.getRelativeTime(mail.created_at); 
            
            const div = document.createElement('div');
            div.className = `mail-item ${mail.is_read ? 'read' : ''}`;
            div.onclick = () => app.openMailDetail(mail);
            
            div.innerHTML = `
                <div class="mail-header-row" style="display:flex; justify-content:space-between; align-items:baseline;">
                    <div class="mail-sender">${mail.sender}</div>
                    <div class="mail-time" style="font-size:11px; color:#8e8e93;">${timeAgo}</div>
                </div>
                <div class="mail-title">${mail.title}</div>
                <div class="mail-msg">${mail.message}</div>
            `;
            container.appendChild(div);

            if (!mail.is_read) {
                unreadCount++;
                if (lockContainer.children.length < 3) {
                    const notif = document.createElement('div');
                    notif.className = 'lock-notif-item';
                    notif.innerHTML = `
                        <div class="lock-notif-icon"><i class="fas fa-envelope"></i></div>
                        <div class="lock-notif-content">
                            <div class="lock-notif-title">${mail.sender}</div>
                            <div class="lock-notif-msg">${mail.title}</div>
                        </div>`;
                    lockContainer.appendChild(notif);
                }
            }
        });

        // Update Badge
        const badge = document.getElementById('badge-mail');
        if (unreadCount > 0) {
            badge.classList.remove('hidden');
            badge.innerText = unreadCount;
        } else {
            badge.classList.add('hidden');
        }
    },

    readAllMails: () => {
        if ('mp' in window) {
            // Trigger the server to mark all as read
            mp.trigger('client:proxyAction', 'readAllMails', 0);
        }
    },

    openMailDetail: (mail) => {
        // 1. Show the view
        app.open('mail-detail');

        // 2. Populate data
        document.getElementById('mail-detail-sender').innerText = `From: ${mail.sender}`;
        document.getElementById('mail-detail-title').innerText = mail.title;
        document.getElementById('mail-detail-body').innerText = mail.message;

        // 3. Mark as read on server if it was unread
        if (!mail.is_read) {
            if ('mp' in window) {
                mp.trigger('client:proxyAction', 'readMail', mail.id);
            }
        }
    },

    showToast: (sender, title, message) => {
        // 1. Get Elements
        const shell = document.getElementById('toast-shell');
        const txtSender = document.getElementById('toast-sender');
        const txtMsg = document.getElementById('toast-message'); // We will put TITLE here
        const txtClock = document.getElementById('toast-clock');

        // 2. Set Data
        txtSender.innerText = sender;
        
        // --- CHANGE THIS LINE ---
        // Old: txtMsg.innerText = message;
        txtMsg.innerText = title; 
        // ------------------------
        
        // Sync status bar clock
        const now = new Date();
        txtClock.innerText = now.getHours().toString().padStart(2, '0') + ':' + 
                             now.getMinutes().toString().padStart(2, '0');

        // 3. Show Animation logic...
        const phoneShell = document.getElementById('phone-shell');
        const isPhoneHidden = phoneShell.classList.contains('hidden');

        if (isPhoneHidden) {
            shell.classList.add('active');
            if (app.toastTimeout) clearTimeout(app.toastTimeout);
            app.toastTimeout = setTimeout(() => {
                shell.classList.remove('active');
            }, 5000);
        }
    },

    receiveNotification: (sender, title, message) => {
        // 1. Show Red Badge inside the phone
        const badge = document.getElementById('badge-mail');
        if(badge) {
            badge.classList.remove('hidden');
            badge.innerText = "!";
        }

        // 2. Add to Lock Screen list (if phone is locked)
        if (app.isLocked) {
             const lockContainer = document.getElementById('lock-notification-list');
             if(lockContainer) {
                 const notif = document.createElement('div');
                 notif.className = 'lock-notif-item';
                 notif.innerHTML = `
                    <div class="lock-notif-icon"><i class="fas fa-envelope"></i></div>
                    <div class="lock-notif-content">
                        <div class="lock-notif-title">${sender}</div>
                        <div class="lock-notif-msg">${title}</div>
                    </div>
                `;
                lockContainer.prepend(notif);
             }
        }
        app.showToast(sender, title, message);
    },

    currentVehicleId: null, // Track which car is selected

    loadVehicles: (cars) => {
        const container = document.getElementById('vehicle-list');
        container.innerHTML = '';

        if (!cars || cars.length === 0) {
            container.innerHTML = '<div style="padding:30px; text-align:center; color:#999;">No vehicles found</div>';
            return;
        }

        cars.forEach(car => {
            const isOut = car.spawned; // Server tells us if it's on map
            const div = document.createElement('div');
            div.className = 'vehicle-item';
            div.onclick = () => app.openVehicleDetails(car);
            
            div.innerHTML = `
                <div class="veh-icon"><i class="fas fa-car"></i></div>
                <div class="veh-info">
                    <div class="veh-model">${car.model}</div>
                    <div class="veh-plate">${car.plate}</div>
                </div>
                <div class="veh-status-dot ${isOut ? 'status-active' : ''}"></div>
            `;
            container.appendChild(div);
        });
    },

    openVehicleDetails: (car) => {
        app.currentVehicleId = car.id; // Save ID for button clicks

        // 1. Switch View
        document.getElementById('view-vehicles').classList.add('hidden');
        document.getElementById('view-vehicle-details').classList.remove('hidden');

        // 2. Fill Data
        document.getElementById('detail-model').innerText = car.model;
        document.getElementById('detail-plate').innerText = car.plate;
        document.getElementById('detail-fuel').innerText = Math.floor(car.fuel) + "%";
        
        const statusEl = document.getElementById('detail-status');
        const btnSpawn = document.getElementById('btn-spawn');
        const btnLocate = document.getElementById('btn-locate');
        const btnTow = document.getElementById('btn-tow');

        if (car.spawned) {
            statusEl.innerText = "Active (On Map)";
            statusEl.className = "status-tag tag-out";
            
            // Logic: Can't spawn if already out. Can locate. Can Tow.
            btnSpawn.classList.add('btn-disabled');
            btnLocate.classList.remove('btn-disabled');
            btnTow.classList.remove('btn-disabled');
        } else {
            statusEl.innerText = "In Garage";
            statusEl.className = "status-tag";
            
            // Logic: Can Spawn. Can't locate or tow.
            btnSpawn.classList.remove('btn-disabled');
            btnLocate.classList.add('btn-disabled');
            btnTow.classList.add('btn-disabled');
        }
    },

    doVehicleAction: (action) => {
        if (!app.currentVehicleId) return;

        // Trigger Client Event -> Server Event
        // We use window.mp to talk to RAGE Client
        if ('mp' in window) {
            mp.trigger('client:proxyAction', action, app.currentVehicleId);
        } else {
            console.log(`Action: ${action} on ID ${app.currentVehicleId}`);
        }
        
        // Optional: Close phone after spawn for immersion
        if (action === 'spawn') closePhone();
    },

    // --- BANKING APP ---
    loadBankData: (data) => {
        document.getElementById('bank-balance').innerText = '$' + data.balance.toLocaleString();
        
        const list = document.getElementById('bank-history');
        list.innerHTML = '';

        if (data.history.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:20px; color:#aaa;">No transactions</div>';
            return;
        }

        data.history.forEach(tx => {
            const isPlus = tx.type === 'deposit' || tx.type === 'transfer_in' || tx.type === 'salary';
            const color = isPlus ? '#2ecc71' : '#e74c3c';
            const sign = isPlus ? '+' : '-';

            const div = document.createElement('div');
            div.className = 'bank-item';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <span style="font-weight:bold;">${tx.type.toUpperCase().replace('_', ' ')}</span>
                    <span style="color:${color}; font-weight:bold;">${sign}$${tx.amount}</span>
                </div>
                <div style="font-size:11px; color:#888;">${tx.description || ''}</div>
                <div style="font-size:10px; color:#666; text-align:right;">${app.getRelativeTime(tx.created_at)}</div>
            `;
            list.appendChild(div);
        });
    },

    sendTransfer: () => {
        const target = document.getElementById('bank-target').value;
        const amount = document.getElementById('bank-amount').value;
        
        if (!target || !amount) return;
        
        if ('mp' in window) {
            mp.trigger('client:proxyAction', 'bankTransfer', JSON.stringify({t: target, a: amount}));
        }
        
        // Clear inputs
        document.getElementById('bank-target').value = '';
        document.getElementById('bank-amount').value = '';
    }
};

function openPhone() {
    // 1. Show Real Phone
    document.getElementById('phone-shell').classList.remove('hidden');
    
    // 2. Hide Toast Immediately (Fixes "seeing it under phone")
    const toastShell = document.getElementById('toast-shell');
    toastShell.classList.remove('active');
    
    // Optional: Clear the timer so it doesn't try to close later
    if (app.toastTimeout) {
        clearTimeout(app.toastTimeout);
        app.toastTimeout = null;
    }

    app.lock(); // Always start locked
    updateClock();
}

function closePhone() {
    document.getElementById('phone-shell').classList.add('hidden');
    if ('mp' in window) mp.trigger('client:closePhoneWrapper'); 
}

function updateClock() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const mins = now.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${mins}`;

    // Update Status Bar
    document.getElementById('clock-small').innerText = timeStr;
    
    // Update Lock Screen
    const lockClock = document.getElementById('lock-clock');
    if(lockClock) lockClock.innerText = timeStr;

    // Update Date
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('en-US', options);
    const lockDate = document.getElementById('lock-date');
    if(lockDate) lockDate.innerText = dateStr;
}

setInterval(updateClock, 1000);
updateClock();