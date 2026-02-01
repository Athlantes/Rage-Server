// client_packages/phone/ui/script.js
const app = {
    isLocked: true, 
    toastTimeout: null,
    currentVehicleId: null,

    getRelativeTime: (dateString) => {
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

    unlock: () => {
        app.isLocked = false;
        document.getElementById('view-lock').classList.add('hidden');
        document.getElementById('view-home').classList.remove('hidden');
    },

    lock: () => {
        app.isLocked = true;
        document.getElementById('view-lock').classList.remove('hidden');
        document.getElementById('view-home').classList.add('hidden');
        document.querySelectorAll('.view').forEach(el => {
            if(el.id !== 'view-lock' && el.id !== 'view-home') el.classList.add('hidden');
        });
    },

    open: (appName) => {
        if(app.isLocked) return; 

        if (appName === 'bank') {
            if('mp' in window) mp.trigger('client:proxyAction', 'requestBankData', 0);
        }

        if (appName === 'escootr') {
             if('mp' in window) mp.trigger('client:proxyAction', 'checkScooterStatus', null);
        }

        document.querySelectorAll('.view').forEach(el => {
            el.classList.add('hidden');
        });

        const appView = document.getElementById(`view-${appName}`);
        if(appView) {
            appView.classList.remove('hidden');
        } else {
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

    // --- MAIL SYSTEM ---
    loadMails: (mails) => {
        const container = document.getElementById('mail-list');
        const lockContainer = document.getElementById('lock-notification-list');
        if (!container || !lockContainer) return;
        container.innerHTML = ''; 
        lockContainer.innerHTML = '';
        const safeMails = Array.isArray(mails) ? mails : [];

        if (safeMails.length === 0) {
            container.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">No Mail</div>';
            return;
        }

        let unreadCount = 0;
        safeMails.forEach(mail => {
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
        const badge = document.getElementById('badge-mail');
        if (unreadCount > 0) {
            badge.classList.remove('hidden');
            badge.innerText = unreadCount;
        } else {
            badge.classList.add('hidden');
        }
    },

    readAllMails: () => {
        if ('mp' in window) mp.trigger('client:proxyAction', 'readAllMails', 0);
    },

    openMailDetail: (mail) => {
        app.open('mail-detail');
        document.getElementById('mail-detail-sender').innerText = `From: ${mail.sender}`;
        document.getElementById('mail-detail-title').innerText = mail.title;
        document.getElementById('mail-detail-body').innerText = mail.message;

        if (!mail.is_read && 'mp' in window) {
            mp.trigger('client:proxyAction', 'readMail', mail.id);
        }
    },

    // --- NOTIFICATIONS ---
    showToast: (sender, title, message) => {
        const shell = document.getElementById('toast-shell');
        const txtSender = document.getElementById('toast-sender');
        const txtMsg = document.getElementById('toast-message');
        const txtClock = document.getElementById('toast-clock');
        txtSender.innerText = sender;
        txtMsg.innerText = title; 
        const now = new Date();
        txtClock.innerText = now.getHours().toString().padStart(2, '0') + ':' + 
                             now.getMinutes().toString().padStart(2, '0');
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
        const badge = document.getElementById('badge-mail');
        if(badge) {
            badge.classList.remove('hidden');
            badge.innerText = "!";
        }
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

    // --- PLAYER VEHICLES ---
    loadVehicles: (cars) => {
        const container = document.getElementById('vehicle-list');
        container.innerHTML = '';
        const safeCars = Array.isArray(cars) ? cars : [];
        if (safeCars.length === 0) {
            container.innerHTML = '<div style="padding:30px; text-align:center; color:#999;">No vehicles found</div>';
            return;
        }
        safeCars.forEach(car => {
            const isOut = car.spawned;
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
        app.currentVehicleId = car.id;
        document.getElementById('view-vehicles').classList.add('hidden');
        document.getElementById('view-vehicle-details').classList.remove('hidden');
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
            btnSpawn.classList.add('btn-disabled');
            btnLocate.classList.remove('btn-disabled');
            btnTow.classList.remove('btn-disabled');
        } else {
            statusEl.innerText = "In Garage";
            statusEl.className = "status-tag";
            btnSpawn.classList.remove('btn-disabled');
            btnLocate.classList.add('btn-disabled');
            btnTow.classList.add('btn-disabled');
        }
    },

    doVehicleAction: (action) => {
        if (!app.currentVehicleId) return;
        if ('mp' in window) mp.trigger('client:proxyAction', action, app.currentVehicleId);
        if (action === 'spawn') closePhone();
    },

    // --- QUICK EATS ---
    quickEatsActive: false,
    toggleQuickEats: () => {
        if ('mp' in window) {
            mp.trigger('client:proxyAction', 'toggleQuickEats', null);
        }
        const btn = document.getElementById('btn-qe-toggle');
        btn.innerText = "Processing...";
        btn.disabled = true;
    },

    updateQuickEatsUI: (isActive, statusText, locationName) => {
        app.quickEatsActive = isActive;
        const circle = document.getElementById('qe-status-circle');
        const icon = document.getElementById('qe-icon');
        const txtStatus = document.getElementById('qe-status-text');
        const txtSub = document.getElementById('qe-subtext');
        const btn = document.getElementById('btn-qe-toggle');
        const card = document.getElementById('qe-order-card');
        btn.disabled = false; 
        if (isActive) {
            circle.className = 'status-circle online';
            icon.className = 'fas fa-hamburger';
            btn.innerText = "GO OFFLINE";
            btn.className = "btn-qe-action active";
            txtStatus.innerText = statusText || "Searching...";
            txtSub.innerText = "Driving to destination...";
            if (locationName) {
                card.classList.remove('hidden');
                document.getElementById('qe-task-name').innerText = statusText;
                document.getElementById('qe-location').innerText = locationName;
            } else {
                card.classList.add('hidden');
                txtSub.innerText = "Waiting for new orders...";
            }
        } else {
            circle.className = 'status-circle offline';
            icon.className = 'fas fa-power-off';
            btn.innerText = "GO ONLINE";
            btn.className = "btn-qe-action";
            txtStatus.innerText = "Offline";
            txtSub.innerText = "Go online to start receiving delivery orders.";
            card.classList.add('hidden');
        }
    },

    // --- BANKING ---
    loadBankData: (data) => {
        const safeBalance = (data && data.balance) ? data.balance : 0;
        document.getElementById('bank-balance').innerText = safeBalance.toLocaleString();
        const list = document.getElementById('bank-history');
        if(!list) return;
        list.innerHTML = '';
        const history = (data && Array.isArray(data.history)) ? data.history : [];
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const recentHistory = history.filter(tx => {
            const txDate = new Date(tx.created_at);
            return txDate >= twoDaysAgo;
        });
        if (recentHistory.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:20px; color:#aaa;">No recent activity</div>';
            return;
        }
        recentHistory.forEach(tx => {
            const isPlus = tx.type === 'deposit' || tx.type === 'transfer_in' || tx.type === 'salary';
            const color = isPlus ? '#34c759' : '#ff3b30'; 
            const sign = isPlus ? '+' : '-';
            const safeAmount = tx.amount || 0;
            const safeDesc = tx.description || 'Transaction';
            const div = document.createElement('div');
            div.className = 'bank-item';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:600; font-size:14px;">${safeDesc}</span>
                    <span style="color:${color}; font-weight:bold; font-size:14px;">${sign}$${safeAmount.toLocaleString()}</span>
                </div>
                <div style="font-size:11px; color:#8e8e93; text-align:right;">${app.getRelativeTime(tx.created_at)}</div>
            `;
            list.appendChild(div);
        });
    },

    openTransferModal: () => {
        document.getElementById('transfer-modal').classList.remove('hidden');
        app.resetTransferModal();
    },

    closeTransferModal: () => {
        document.getElementById('transfer-modal').classList.add('hidden');
    },

    resetTransferModal: () => {
        document.getElementById('transfer-step-1').classList.remove('hidden');
        document.getElementById('transfer-step-2').classList.add('hidden');
        document.getElementById('modal-title').innerText = "Send Money";
    },

    verifyTransfer: () => {
        const target = document.getElementById('bank-target').value;
        const amount = parseFloat(document.getElementById('bank-amount').value);
        if (!target || !amount || amount <= 0) {
            app.showToast('Fleeca', 'Error', 'Invalid details entered.');
            return;
        }
        document.getElementById('transfer-step-1').classList.add('hidden');
        document.getElementById('transfer-step-2').classList.remove('hidden');
        document.getElementById('modal-title').innerText = "Confirm Transfer";
        document.getElementById('confirm-amount').innerText = '$' + amount.toLocaleString();
        document.getElementById('confirm-target').innerText = target;
    },

    submitTransfer: () => {
        const target = document.getElementById('bank-target').value;
        const amount = document.getElementById('bank-amount').value;
        if ('mp' in window) {
            mp.trigger('client:proxyAction', 'bankTransfer', JSON.stringify({t: target, a: amount}));
        }
        app.closeTransferModal();
        document.getElementById('bank-target').value = '';
        document.getElementById('bank-amount').value = '';
        app.showToast('Fleeca', 'Processing', 'Sending transaction...');
    },

    scooters: [],
    
    // Updates the list of scooters visible on the "Find" screen
    loadScooterList: (data) => {
        app.scooters = data;
        const list = document.getElementById('escootr-list');
        if (!list) return;
        list.innerHTML = '';

        if (!data || data.length === 0) {
            list.innerHTML = `
                <div style="text-align:center; margin-top:50px;">
                    <div style="background:#f5f5f5; width:60px; height:60px; border-radius:50%; margin:0 auto 15px auto; display:flex; align-items:center; justify-content:center; color:#ccc; font-size:24px;">
                        <i class="fas fa-search"></i>
                    </div>
                    <h3 style="margin:0; color:#333;">No Scooters Nearby</h3>
                    <p style="color:#999; font-size:13px; padding:0 30px;">Try moving to a different area to find available rides.</p>
                </div>`;
            return;
        }

        data.forEach(scoot => {
            const sId = parseInt(scoot.id);
            const fuel = Math.floor(scoot.fuel); // This is actually battery now
            
            // Color code battery
            let battColor = '#2ecc71'; 
            if(fuel < 50) battColor = '#f1c40f'; 
            if(fuel < 20) battColor = '#e74c3c'; 

            const div = document.createElement('div');
            div.className = 'scoot-card';
            div.onclick = () => app.pinScooter(sId); // Clicking card also locates
            div.innerHTML = `
                <div class="scoot-header">
                    <span class="scoot-id">#${sId.toString().padStart(4, '0')}</span>
                    <div class="scoot-dist">
                        <i class="fas fa-location-arrow"></i> ${Math.floor(scoot.dist)}m
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="scoot-info">
                        <div class="battery-pill">
                            <div class="battery-fill" style="width: ${fuel}%; background: ${battColor};"></div>
                        </div>
                        <span style="font-size:13px; font-weight:600; color:#333;">${fuel}%</span>
                    </div>
                    <button class="btn-locate-scoot" onclick="event.stopPropagation(); app.pinScooter(${sId})">
                        LOCATE
                    </button>
                </div>
            `;
            list.appendChild(div);
        });
    },

    // Sends the request to Server to track this specific ID
    pinScooter: (id) => {
        const safeId = parseInt(id);
        if(isNaN(safeId)) return;
        
        app.showToast('eScootr', 'GPS', 'Updating destination...');
        if ('mp' in window) {
            mp.trigger('client:proxyAction', 'locateScooter', safeId);
        }
    },

    checkScooterState: () => {
        if ('mp' in window) mp.trigger('client:proxyAction', 'checkScooterStatus', null);
    },

    // Updates the screen depending on if user is riding or searching
    updateScooterUI: (isOnScooter, fuel, rentalTimeLeft) => {
        const listView = document.getElementById('escootr-list-view');
        const rentView = document.getElementById('escootr-rent-view');
        const controls = document.getElementById('rent-controls');
        const activeControls = document.getElementById('active-rent-controls');
        
        const statusTitle = document.getElementById('scooter-status-title');
        const statusSub = document.getElementById('scooter-status-sub');
        const batteryBadge = document.getElementById('scoot-battery-badge');
        const fuelTxt = document.getElementById('scoot-fuel');

        if (isOnScooter) {
            // User is ON a scooter -> Show Dashboard
            listView.classList.add('hidden');
            rentView.classList.remove('hidden');
            
            const fuelVal = Math.floor(fuel);
            fuelTxt.innerText = fuelVal + '%';
            
            // Color logic for dashboard badge
            if(fuelVal < 20) batteryBadge.style.background = '#e74c3c';
            else if(fuelVal < 50) batteryBadge.style.background = '#f1c40f';
            else batteryBadge.style.background = '#2ecc71';

            if (rentalTimeLeft > 0) {
                // Currently Renting (Active)
                controls.classList.add('hidden');
                activeControls.classList.remove('hidden');
                
                statusTitle.innerText = "Ride in Progress";
                statusSub.innerText = "Drive safely and follow traffic laws.";
                
                const minsLeft = Math.ceil(rentalTimeLeft / 60);
                document.getElementById('rent-timer').innerText = minsLeft + " min";
            } else {
                // Not Renting (Waiting to pay)
                controls.classList.remove('hidden');
                activeControls.classList.add('hidden');
                
                statusTitle.innerText = "Scooter Locked";
                statusSub.innerText = "Select a plan to unlock the engine.";
            }
        } else {
            // User is walking -> Show List
            listView.classList.remove('hidden');
            rentView.classList.add('hidden');
            // Refresh list if we just switched back
            if ('mp' in window) mp.trigger('client:proxyAction', 'requestScooters', null);
        }
    },

    rentScooter: (minutes) => {
        if ('mp' in window) mp.trigger('client:proxyAction', 'rentScooter', minutes);
    },
}

// --- GLOBAL APP FUNCTIONS ---
function openPhone() {
    document.getElementById('phone-shell').classList.remove('hidden');
    const toastShell = document.getElementById('toast-shell');
    toastShell.classList.remove('active');
    
    if (app.toastTimeout) {
        clearTimeout(app.toastTimeout);
        app.toastTimeout = null;
    }

    app.lock();
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

    const clockSmall = document.getElementById('clock-small');
    if(clockSmall) clockSmall.innerText = timeStr;
    
    const lockClock = document.getElementById('lock-clock');
    if(lockClock) lockClock.innerText = timeStr;

    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('en-US', options);
    const lockDate = document.getElementById('lock-date');
    if(lockDate) lockDate.innerText = dateStr;
}

setInterval(updateClock, 1000);
updateClock();