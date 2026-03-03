// CONFIGURATION: Define your apps here for easy modularity
const NOTIFICATION_APPS = {
    'mail':      { color: '#00a8ff', icon: 'fas fa-envelope', title: 'Mail' },
    'phone':     { color: '#34c759', icon: 'fas fa-phone-alt', title: 'Phone' },
    'bank':      { color: '#1abc9c', icon: 'fas fa-university', title: 'Fleeca' },
    'scooter':   { color: '#56ab2f', icon: 'fas fa-bolt', title: 'eScootr' },
    'quickeats': { color: '#ff9500', icon: 'fas fa-hamburger', title: 'QuickEats' },
    'vehicles':  { color: '#f1c40f', icon: 'fas fa-car', title: 'Vehicles' },
    'system':    { color: '#636366', icon: 'fas fa-cog', title: 'System' },
    'maps':      { color: '#ff4757', icon: 'fas fa-map-marked-alt', title: 'Maps' },
    'taxi':      { color: '#ffc300', icon: 'fas fa-taxi', title: 'Taxi' },
};

const app = {
    isLocked: true, 
    toastTimeout: null,
    bannerTimeout: null,
    currentVehicleId: null,
    mediaBaseUrl: '',
    photos: [],
    currentPhoto: null,
    photoDetailReturnView: 'gallery', // tracks where to go back from photo-detail
    galleryMode: 'view', // 'view' or 'pick'

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
        // Clear all lockscreen notifications on unlock (mirrors real phone behavior)
        const lockList = document.getElementById('lock-notification-list');
        if (lockList) lockList.innerHTML = '';
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

        const onlineApps = ['bank', 'quickeats', 'mail', 'escootr'];
        if (app.settings.flightMode && onlineApps.includes(appName)) {
            app.notify('system', "No Connection", "Turn off Airplane Mode to use this app.");
            return;
        }

        if (appName === 'camera') {
            if ('mp' in window) mp.trigger('client:phone:appCallback', 'camera', 'open');
            return; 
        }

        if (appName === 'bank') {
            if('mp' in window) mp.trigger('client:proxyAction', 'requestBankData', 0);
        }

        if (appName === 'maps') {
            if('mp' in window) mp.trigger('client:phone:requestMapBlips');
        }

        if (appName === 'taxi') {
            if('mp' in window) mp.trigger('client:phone:requestTaxiData');
        }

        if (appName === 'settings-wallpapers') {
            setTimeout(() => {
                if(app.settings && app.settings.renderWallpapers) app.settings.renderWallpapers();
            }, 50);
        }

        document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));

        const appView = document.getElementById(`view-${appName}`);
        if(appView) {
            appView.classList.remove('hidden');
        } else {
            document.getElementById('view-home').classList.remove('hidden');
        }
    },
    
    goHome: () => {
        if(app.isLocked) return;
        
        // Reset Gallery Mode when going home
        app.galleryMode = 'view';
        const galTitle = document.getElementById('gallery-title');
        if(galTitle) galTitle.innerText = "Gallery";
        
        document.querySelectorAll('.view').forEach(el => {
            if(el.id !== 'view-home' && el.id !== 'view-lock') el.classList.add('hidden');
        });
        document.getElementById('view-home').classList.remove('hidden');
    },

    // --- MODULAR NOTIFICATION SYSTEM ---

    notify: (appId, title, message) => {
        const config = NOTIFICATION_APPS[appId] || NOTIFICATION_APPS['system'];

        const badge = document.getElementById(`badge-${appId}`);
        if(badge) { 
            badge.classList.remove('hidden'); 
            badge.innerText = "!"; 
        }

        const lockContainer = document.getElementById('lock-notification-list');
        if(lockContainer) {
            const notif = document.createElement('div');
            notif.className = 'lock-notif-item';
            notif.setAttribute('data-sender', title); 

            notif.innerHTML = `
            <div class="lock-notif-icon" style="background:${config.color}">
                <i class="${config.icon}"></i>
            </div>
            <div class="lock-notif-content">
                <div class="lock-notif-title">${title}</div>
                <div class="lock-notif-msg">${message}</div>
            </div>
            `;
            
            // Tap to open the relevant app
            notif.onclick = (e) => {
                e.stopPropagation(); // Prevent view-lock's onclick from firing
                notif.remove();
                if(app.isLocked) {
                    app.unlock(); 
                    let targetView = appId;
                    if(appId === 'phone') targetView = 'phone-app';
                    app.open(targetView);
                }
            };

            // Swipe-to-dismiss (horizontal drag)
            let startX = 0;
            notif.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
            notif.addEventListener('mousedown', (e) => { startX = e.clientX; });
            notif.addEventListener('touchmove', (e) => {
                const dx = e.touches[0].clientX - startX;
                if (dx > 0) notif.style.transform = `translateX(${dx}px)`;
                notif.style.opacity = Math.max(0, 1 - dx / 200);
            }, { passive: true });
            notif.addEventListener('mousemove', (e) => {
                if (e.buttons !== 1) return;
                const dx = e.clientX - startX;
                if (dx > 0) notif.style.transform = `translateX(${dx}px)`;
                notif.style.opacity = Math.max(0, 1 - dx / 200);
            });
            const dismissOnEnd = (dx) => {
                if (dx > 80) {
                    notif.style.transition = 'transform 0.2s, opacity 0.2s';
                    notif.style.transform = 'translateX(300px)';
                    notif.style.opacity = '0';
                    setTimeout(() => notif.remove(), 200);
                } else {
                    notif.style.transition = 'transform 0.2s, opacity 0.2s';
                    notif.style.transform = 'translateX(0)';
                    notif.style.opacity = '1';
                    setTimeout(() => { notif.style.transition = ''; }, 200);
                }
            };
            notif.addEventListener('touchend', (e) => {
                const dx = e.changedTouches ? e.changedTouches[0].clientX - startX : 0;
                dismissOnEnd(dx);
            });
            notif.addEventListener('mouseup', (e) => {
                dismissOnEnd(e.clientX - startX);
            });

            lockContainer.prepend(notif);
            
            if(lockContainer.children.length > 5) {
                lockContainer.removeChild(lockContainer.lastChild);
            }
        }

        const phoneShell = document.getElementById('phone-shell');
        const isPhoneHidden = phoneShell.classList.contains('hidden');
        
        if (app.settings.data.is_dnd) return;

        if (isPhoneHidden) {
            // Phone closed — show phantom toast below the phone
            app.showToast(config, title, message);
        } else if (!app.isLocked) {
            // Phone open & unlocked — show in-app banner overlay
            app.showBanner(config, title, message);
        }
    },

    showBanner: (config, title, message) => {
        const banner = document.getElementById('inapp-banner');
        if (!banner) return;

        const iconEl  = banner.querySelector('.inapp-banner-icon');
        const titleEl = banner.querySelector('.inapp-banner-title');
        const msgEl   = banner.querySelector('.inapp-banner-msg');

        if (iconEl) {
            iconEl.innerHTML = `<i class="${config.icon}"></i>`;
            iconEl.style.background = config.color;
        }
        if (titleEl) titleEl.innerText = config.title;
        if (msgEl)   msgEl.innerText = `${title}: ${message}`;

        // Reset animation
        banner.classList.remove('active');
        void banner.offsetWidth; // force reflow
        banner.classList.add('active');

        if (app.bannerTimeout) clearTimeout(app.bannerTimeout);
        app.bannerTimeout = setTimeout(() => {
            banner.classList.remove('active');
        }, 4000);
    },

    showToast: (config, title, message) => {
        const shell = document.getElementById('toast-shell');
        const txtSender = document.getElementById('toast-sender');
        const txtMsg = document.getElementById('toast-message');
        const iconBox = document.querySelector('.toast-icon-box');
        
        if(!shell) return;

        txtSender.innerText = config.title; 
        txtMsg.innerText = `${title}: ${message}`; 

        if (iconBox) {
            iconBox.innerHTML = `<i class="${config.icon}"></i>`;
            iconBox.style.background = config.color;
        }

        shell.classList.add('active');
        
        if (app.toastTimeout) clearTimeout(app.toastTimeout);
        app.toastTimeout = setTimeout(() => {
            shell.classList.remove('active');
        }, 5000);
    },

    receiveNotification: (sender, title, message, appType = 'mail') => {
        let appId = 'system';
        if(appType === 'mail') appId = 'mail';
        if(appType === 'phone') appId = 'phone';
        app.notify(appId, sender, title || message); 
    },
    
    // --- APP SPECIFIC LOADERS ---

    loadMails: (mails) => {
        const container = document.getElementById('mail-list');
        if (!container) return;
        container.innerHTML = ''; 
        const safeMails = Array.isArray(mails) ? mails : [];

        if (safeMails.length === 0) {
            container.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">No Mail</div>';
            return;
        }

        let unreadCount = 0;
        safeMails.forEach(mail => {
            const timeAgo = app.getRelativeTime(mail.created_at);
            const div = document.createElement('div');
            div.id = 'mail-item-' + mail.id;
            div.className = `mail-item ${mail.is_read ? 'read' : ''}`;
            div.onclick = () => app.openMailDetail(mail);
            div.innerHTML = `
                <div class="mail-header-row" style="display:flex; justify-content:space-between; align-items:baseline;">
                    <div class="mail-sender">${mail.sender}</div>
                    <div class="mail-time" style="font-size:11px; color:rgba(0,0,0,0.35);">${timeAgo}</div>
                </div>
                <div class="mail-title">${mail.title}</div>
                <div class="mail-msg">${mail.message}</div>
            `;
            container.appendChild(div);
            if (!mail.is_read) unreadCount++;
        });

        const badge = document.getElementById('badge-mail');
        if (badge) {
            if (unreadCount > 0) {
                badge.classList.remove('hidden');
                badge.innerText = unreadCount;
            } else {
                badge.classList.add('hidden');
            }
        }
    },

    readAllMails: () => {
        const items = document.querySelectorAll('.mail-item');
        items.forEach(el => el.classList.add('read'));
        const badge = document.getElementById('badge-mail');
        if(badge) badge.classList.add('hidden');
        if ('mp' in window) mp.trigger('client:proxyAction', 'readAllMails', 0);
    },

    openMailDetail: (mail) => {
        app.open('mail-detail');
        
        const notifs = document.querySelectorAll(`.lock-notif-item[data-sender="${mail.sender}"]`);
        notifs.forEach(el => el.remove());

        document.getElementById('mail-detail-sender').innerText = `From: ${mail.sender}`;
        document.getElementById('mail-detail-title').innerText = mail.title;
        document.getElementById('mail-detail-body').innerText = mail.message;

        if (!mail.is_read) {
            if ('mp' in window) mp.trigger('client:proxyAction', 'readMail', mail.id);
            mail.is_read = 1;
            const listEl = document.getElementById('mail-item-' + mail.id);
            if (listEl) {
                listEl.classList.add('read');
            }
            
            const badge = document.getElementById('badge-mail');
            if (badge && !badge.classList.contains('hidden')) {
                let count = parseInt(badge.innerText) || 0;
                if (count > 0) count--;
                if (count <= 0) badge.classList.add('hidden');
                else badge.innerText = count;
            }
        }
    },

    receiveMail: (id, sender, title, message) => {
        app.notify('mail', sender, title);

        const container = document.getElementById('mail-list');
        if (container) {
            const mail = { 
                id: id, 
                sender: sender, 
                title: title, 
                message: message, 
                created_at: new Date().toISOString(), 
                is_read: 0 
            };
            
            if (container.innerHTML.includes('No Mail')) container.innerHTML = '';

            const timeAgo = app.getRelativeTime(mail.created_at);
            const div = document.createElement('div');
            div.id = 'mail-item-' + mail.id;
            div.className = `mail-item`; 
            div.onclick = () => app.openMailDetail(mail);
            
            div.innerHTML = `
                <div class="mail-header-row" style="display:flex; justify-content:space-between; align-items:baseline;">
                    <div class="mail-sender">${mail.sender}</div>
                    <div class="mail-time" style="font-size:11px; color:rgba(0,0,0,0.35);">${timeAgo}</div>
                </div>
                <div class="mail-title">${mail.title}</div>
                <div class="mail-msg">${mail.message}</div>
            `;
            
            container.prepend(div);

            const badge = document.getElementById('badge-mail');
            if(badge) {
                let count = parseInt(badge.innerText) || 0;
                count++;
                badge.innerText = count;
                badge.classList.remove('hidden');
            }
        }
    },

    loadVehicles: (cars) => {
        const container = document.getElementById('vehicle-list');
        container.innerHTML = '';
        const safeCars = Array.isArray(cars) ? cars : [];

        // Update slots badge
        const slotsBadge = document.getElementById('veh-slots-badge');
        if (slotsBadge) slotsBadge.textContent = safeCars.length + ' vehicles';

        if (safeCars.length === 0) {
            container.innerHTML = `
                <div class="veh-empty-state">
                    <div class="veh-empty-icon"><i class="fas fa-car"></i></div>
                    <div class="veh-empty-title">No Vehicles</div>
                    <div class="veh-empty-sub">Visit a dealership to purchase your first car</div>
                </div>`;
            return;
        }
        safeCars.forEach(car => {
            const isOut = car.spawned;
            const gradeColors = { S:'#ff4757', A:'#ff6b35', B:'#f39c12', C:'#2ecc71', D:'#00a8ff', E:'#8a8fa6', F:'#555' };
            const gc = gradeColors[car.grade] || '#888';
            const div = document.createElement('div');
            div.className = 'vehicle-item';
            div.onclick = () => app.openVehicleDetails(car);
            div.innerHTML = `
                <div class="veh-icon-new" style="border-color: ${gc}33; background: ${gc}11;">
                    <i class="fas fa-car" style="color:${gc}"></i>
                    <span class="veh-grade-pip" style="background:${gc}">${car.grade}</span>
                </div>
                <div class="veh-info">
                    <div class="veh-model">${car.displayName || car.model}</div>
                    <div class="veh-plate">${car.plate} · ${car.type || 'Unknown'}</div>
                </div>
                <div class="veh-right">
                    <div class="veh-status-pill ${isOut ? 'active' : ''}">${isOut ? 'Active' : 'Parked'}</div>
                    <div class="veh-fuel-mini"><i class="fas fa-gas-pump"></i> ${Math.floor(car.fuel)}%</div>
                </div>
            `;
            container.appendChild(div);
        });
    },

    openVehicleDetails: (car) => {
        app.currentVehicleId = car.id;
        app._currentCar = car;
        document.getElementById('view-vehicles').classList.add('hidden');
        document.getElementById('view-vehicle-details').classList.remove('hidden');
        document.getElementById('detail-model').innerText = car.displayName || car.model;
        document.getElementById('detail-plate').innerText = car.plate;
        document.getElementById('detail-type').innerText = car.type || 'Unknown';
        
        const gradeEl = document.getElementById('detail-grade');
        if (gradeEl) {
            gradeEl.innerText = car.grade || '?';
            const gradeColors = { S:'#ff4757', A:'#ff6b35', B:'#f39c12', C:'#2ecc71', D:'#00a8ff', E:'#8a8fa6', F:'#555' };
            gradeEl.style.background = gradeColors[car.grade] || '#888';
        }
        
        const fuelPct = Math.floor(car.fuel);
        document.getElementById('detail-fuel').innerText = fuelPct + '%';
        const fuelBar = document.getElementById('detail-fuel-bar');
        if (fuelBar) {
            fuelBar.style.width = fuelPct + '%';
            fuelBar.style.background = fuelPct > 50 ? '#2ecc71' : fuelPct > 20 ? '#f39c12' : '#ff4757';
        }
        
        const sellPriceEl = document.getElementById('detail-sell-price');
        if (sellPriceEl) sellPriceEl.innerText = '$' + (car.sellPrice || 0).toLocaleString();
        
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

    sellVehicle: () => {
        if (!app.currentVehicleId) return;
        const car = app._currentCar;
        if (!car) return;
        // Open confirm modal
        document.getElementById('confirm-title').innerText = 'Sell Vehicle';
        document.getElementById('confirm-text').innerText = `Sell your ${car.displayName || car.model} for $${(car.sellPrice || 0).toLocaleString()}? This cannot be undone.`;
        document.getElementById('btn-confirm-yes').innerText = 'Sell';
        document.getElementById('btn-confirm-yes').onclick = () => {
            if ('mp' in window) mp.trigger('client:phone:sellVehicle', app.currentVehicleId);
            app.closeConfirmModal();
            app.open('vehicles');
        };
        document.getElementById('confirm-modal').classList.remove('hidden');
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
        const ring = document.getElementById('qe-status-ring');
        const icon = document.getElementById('qe-icon');
        const titleEl = document.getElementById('qe-hero-title');
        const subEl = document.getElementById('qe-hero-sub');
        const btn = document.getElementById('btn-qe-toggle');
        const card = document.getElementById('qe-order-card');
        const statsRow = document.getElementById('qe-stats-row');
        btn.disabled = false; 
        if (isActive) {
            ring.className = 'qe-status-ring online';
            icon.className = 'fas fa-hamburger';
            btn.innerText = "GO OFFLINE";
            btn.className = "qe-toggle-btn go-offline";
            titleEl.innerText = statusText || "Searching...";
            subEl.innerText = "Driving to destination...";
            if (statsRow) statsRow.classList.remove('hidden');
            if (locationName) {
                card.classList.remove('hidden');
                document.getElementById('qe-task-name').innerText = statusText;
                document.getElementById('qe-location').innerText = locationName;
            } else {
                card.classList.add('hidden');
                subEl.innerText = "Waiting for new orders...";
            }
        } else {
            ring.className = 'qe-status-ring offline';
            icon.className = 'fas fa-power-off';
            btn.innerText = "GO ONLINE";
            btn.className = "qe-toggle-btn go-online";
            titleEl.innerText = "Offline";
            subEl.innerText = "Go online to start receiving orders";
            card.classList.add('hidden');
            if (statsRow) statsRow.classList.add('hidden');
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
                <div style="font-size:11px; color:rgba(0,0,0,0.35); text-align:right;">${app.getRelativeTime(tx.created_at)}</div>
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
            app.notify('bank', 'Error', 'Invalid details entered.');
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
        app.notify('bank', 'Processing', 'Sending transaction...');
    },

    phoneApp: {
        currentTab: 'keypad',
        dialBuffer: '',
        contacts: [], 
        messages: [], 
        activeChatNumber: null,

        init: (contactsJson, messagesJson) => {
            if (contactsJson) app.phoneApp.contacts = contactsJson;
            if (messagesJson) app.phoneApp.messages = messagesJson;
            app.phoneApp.renderContacts();
            app.phoneApp.updateBadge(); 
        },

        updateBadge: () => {
            const unreadCount = app.phoneApp.messages.filter(m => !m.isMine && !m.is_read).length;
            const badge = document.getElementById('badge-phone');
            if (unreadCount > 0) {
                badge.classList.remove('hidden');
                badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
            } else {
                badge.classList.add('hidden');
            }
        },

        switchTab: (tabName, btnEl) => {
            app.phoneApp.currentTab = tabName;
            document.querySelectorAll('.phone-tab-content').forEach(el => el.classList.add('hidden'));
            document.getElementById(`tab-content-${tabName}`).classList.remove('hidden');
            document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
            if(btnEl) btnEl.classList.add('active');
            if (tabName === 'recent') app.phoneApp.renderMessageList();
        },

        // --- ATTACHMENT LOGIC ---
        toggleAttachMenu: () => {
            const menu = document.getElementById('chat-attachment-menu');
            if (menu.classList.contains('hidden')) {
                menu.classList.remove('hidden');
            } else {
                menu.classList.add('hidden');
            }
        },

        reqLocationShare: () => {
            app.phoneApp.toggleAttachMenu();
            app.openConfirmModal("Share Location", "Share your current location?", () => {
                const target = app.phoneApp.activeChatNumber;
                if('mp' in window) mp.trigger('client:proxyAction', 'shareLocation', target);
                // The server will handle sending the message via sendSMSInternal equivalent
            });
        },

        reqPhotoShare: () => {
             app.phoneApp.toggleAttachMenu();
             app.galleryMode = 'pick';
             
             // Open Gallery View
             app.open('gallery'); 
             
             const galTitle = document.getElementById('gallery-title');
             galTitle.innerText = "Select Photo";
             
             const backBtn = document.getElementById('btn-gallery-back');
             
             // OVERRIDE BACK BUTTON
             backBtn.onclick = () => {
                 app.galleryMode = 'view';
                 galTitle.innerText = "Gallery";
                 
                 // 1. Switch back to Phone App View (Hides Gallery)
                 app.open('phone-app'); 
                 
                 // 2. Re-open the specific chat
                 if(app.phoneApp.activeChatNumber) {
                     const name = app.phoneApp.getContactName(app.phoneApp.activeChatNumber);
                     app.phoneApp.openChat(app.phoneApp.activeChatNumber, name);
                 }
                 
                 // 3. Reset Back Button to Default
                 backBtn.onclick = app.goHome; 
             };
        },

        reqCamera: () => {
            app.phoneApp.toggleAttachMenu();
            if('mp' in window) mp.trigger('client:proxyAction', 'cameraForChat', app.phoneApp.activeChatNumber);
        },

        getContactName: (number) => {
            const c = app.phoneApp.contacts.find(x => x.number == number);
            return c ? c.name : number;
        },

        // --- KEYPAD ---
        pressKey: (key) => { if (app.phoneApp.dialBuffer.length < 12) { app.phoneApp.dialBuffer += key; app.phoneApp.updateDisplay(); } },
        pressDel: () => { app.phoneApp.dialBuffer = app.phoneApp.dialBuffer.slice(0, -1); app.phoneApp.updateDisplay(); },
        updateDisplay: () => { 
            const display = document.getElementById('keypad-number');
            const sub = document.getElementById('keypad-action-sub');
            const delBtn = document.getElementById('btn-keypad-del');
            display.innerText = app.phoneApp.dialBuffer;
            if (app.phoneApp.dialBuffer.length > 0) { sub.classList.remove('hidden'); delBtn.classList.remove('hidden'); } 
            else { sub.classList.add('hidden'); delBtn.classList.add('hidden'); }
        },
        addCurrentNumber: () => { app.phoneApp.openContactEdit(app.phoneApp.dialBuffer); },
        startCall: () => { const num = app.phoneApp.dialBuffer; if(!num) return; app.notify("phone", "Calling...", "Calling " + num); if('mp' in window) mp.trigger('client:proxyAction', 'startCall', num); },

        renderContacts: (filter = "") => { 
            const container = document.getElementById('contact-list-real'); container.innerHTML = '';
            const sorted = app.phoneApp.contacts.sort((a,b) => a.name.localeCompare(b.name));
            sorted.forEach(c => {
                if (filter && !c.name.toLowerCase().includes(filter.toLowerCase())) return;
                const div = document.createElement('div'); div.className = 'contact-row';
                const initial = c.name[0] || "#"; const colorHex = '#' + Math.floor(c.name.charCodeAt(0)*123456).toString(16).slice(0,6);
                div.innerHTML = `<div class="contact-avatar" style="background:${colorHex}">${initial}</div><div class="contact-name">${c.name}</div><div class="contact-actions"><div class="c-act-btn" onclick="app.phoneApp.openChat('${c.number}', '${c.name}')"><i class="fas fa-comment"></i></div><div class="c-act-btn" onclick="app.phoneApp.dialBuffer='${c.number}'; app.phoneApp.startCall(); event.stopPropagation();"><i class="fas fa-phone"></i></div></div>`;
                div.onclick = (e) => { if(e.target.closest('.c-act-btn')) return; app.phoneApp.dialBuffer = c.number; app.phoneApp.updateDisplay(); const tabs = document.querySelectorAll('.tab-item'); app.phoneApp.switchTab('keypad', tabs[0]); };
                container.appendChild(div);
            });
        },
        filterContacts: (val) => { app.phoneApp.renderContacts(val); },
        openContactEdit: (prefillNumber = "") => { document.getElementById('view-phone-app').classList.add('hidden'); document.getElementById('view-contact-edit').classList.remove('hidden'); document.getElementById('contact-edit-name').value = ""; document.getElementById('contact-edit-number').value = prefillNumber; },
        closeContactEdit: () => { document.getElementById('view-contact-edit').classList.add('hidden'); document.getElementById('view-phone-app').classList.remove('hidden'); },
        saveContact: () => { const name = document.getElementById('contact-edit-name').value; const number = document.getElementById('contact-edit-number').value; if(!name || !number) return app.notify("phone", "Error", "Name and Number required."); app.phoneApp.contacts.push({ name, number }); app.phoneApp.renderContacts(); if('mp' in window) mp.trigger('client:proxyAction', 'saveContact', JSON.stringify({ name, number })); app.phoneApp.closeContactEdit(); },

        renderMessageList: () => {
            const container = document.getElementById('msg-conversation-list');
            container.innerHTML = '';
            const groups = {};
            app.phoneApp.messages.forEach(msg => { if(!groups[msg.number]) groups[msg.number] = []; groups[msg.number].push(msg); });
            const keys = Object.keys(groups);
            if (keys.length === 0) { container.innerHTML = '<div style="text-align:center; padding:30px; color:#aaa; font-size:14px;">No messages</div>'; return; }
            keys.sort((a, b) => { const lastA = groups[a][groups[a].length - 1]; const lastB = groups[b][groups[b].length - 1]; return new Date(lastB.time) - new Date(lastA.time); });

            keys.forEach(num => {
                const thread = groups[num];
                const lastMsg = thread[thread.length - 1];
                const contact = app.phoneApp.contacts.find(c => c.number == num);
                const displayName = contact ? contact.name : num;
                const hasUnread = thread.some(m => !m.isMine && !m.is_read);
                
                // PREVIEW LOGIC
                let preview = lastMsg.body;
                if (lastMsg.type === 'location') preview = "📍 Location Shared";
                else if (lastMsg.type === 'photo') preview = "📷 Photo Sent";
                
                const div = document.createElement('div');
                div.className = 'msg-row';
                if(hasUnread) div.style.backgroundColor = "rgba(0,168,255,0.06)"; 
                div.onclick = () => app.phoneApp.openChat(num, displayName);
                const prefix = lastMsg.isMine ? "You: " : "";
                div.innerHTML = `<div class="msg-header"><span class="msg-sender" style="${hasUnread ? 'font-weight:800; color:#00a8ff;' : ''}">${displayName} ${hasUnread ? '●' : ''}</span><span class="msg-date">${app.getRelativeTime(lastMsg.time)}</span></div><div class="msg-preview" style="${hasUnread ? 'font-weight:600; color:#1a1a2e;' : ''}">${prefix}${preview}</div>`;
                container.appendChild(div);
            });
        },

        openChat: (number, displayName) => {
            app.phoneApp.activeChatNumber = number;
            const notifs = document.querySelectorAll(`.lock-notif-item[data-sender="${displayName}"], .lock-notif-item[data-sender="${number}"]`);
            notifs.forEach(el => el.remove());

            document.getElementById('view-phone-app').classList.add('hidden');
            document.getElementById('view-chat-thread').classList.remove('hidden');
            document.getElementById('chat-thread-name').innerText = displayName;
            let changed = false;
            app.phoneApp.messages.forEach(m => { if(m.number == number && !m.isMine && !m.is_read) { m.is_read = 1; changed = true; } });
            if (changed) { app.phoneApp.updateBadge(); if('mp' in window) mp.trigger('client:proxyAction', 'markMessagesRead', number); }
            app.phoneApp.renderChatBubbles();
            
            // Hide menu if open
            document.getElementById('chat-attachment-menu').classList.add('hidden');
        },

        closeChat: () => { 
            app.phoneApp.activeChatNumber = null; 
            document.getElementById('view-chat-thread').classList.add('hidden'); 
            document.getElementById('view-phone-app').classList.remove('hidden'); 
            app.phoneApp.renderMessageList(); 
        },

        renderChatBubbles: () => {
            const container = document.getElementById('chat-bubbles');
            container.innerHTML = '';
            
            // Get messages for active chat
            const thread = app.phoneApp.messages.filter(m => m.number == app.phoneApp.activeChatNumber);
            thread.sort((a,b) => new Date(a.time) - new Date(b.time));
            
            thread.forEach(msg => { 
                const div = document.createElement('div'); 
                const isMine = msg.isMine;
                // Base classes
                div.className = `chat-bubble ${isMine ? 'mine' : 'theirs'}`; 

                // --- RENDERING LOGIC ---
                if (msg.type === 'location') {
                    div.classList.add('location-bubble');
                    // Simplified HTML: Just Icon + Text
                    div.innerHTML = `<i class="fas fa-map-marker-alt"></i> <span>Location</span>`;
                    
                    div.onclick = () => {
                         if('mp' in window) mp.trigger('client:proxyAction', 'setWaypoint', msg.body);
                    };
                }
                else if (msg.type === 'photo') {
                    div.classList.add('photo-bubble');
                    const fullUrl = app.mediaBaseUrl + msg.body; 
                    div.innerHTML = `<img src="${fullUrl}" alt="Photo">`;
                    // Add Click Event to view full screen
                    div.onclick = () => {
                         app.photoDetailReturnView = 'chat-thread';
                         app.openPhotoDetail({ image_path: msg.body, created_at: msg.time });
                    };
                }
                else {
                    // Default Text Message
                    div.innerText = msg.body; 
                }
                // -----------------------
                
                container.appendChild(div); 
            });
            container.scrollTop = container.scrollHeight;
        },

        sendSMS: () => {
            const input = document.getElementById('chat-input-text');
            const text = input.value.trim();
            if(!text || !app.phoneApp.activeChatNumber) return;
            
            app.phoneApp.sendSMSInternal(app.phoneApp.activeChatNumber, text, 'text');
            input.value = '';
        },

        sendSMSInternal: (number, body, type) => {
             app.phoneApp.messages.push({ 
                 number: number, 
                 body: body, 
                 type: type, 
                 isMine: true, 
                 is_read: 1, 
                 time: new Date().toISOString() 
             });
             app.phoneApp.renderChatBubbles();
             
             if('mp' in window) mp.trigger('client:proxyAction', 'sendSMS', JSON.stringify({ number, body, type }));
        },
        
        receiveMessageRaw: (number, body, type) => {
            app.phoneApp.messages.push({
                number: number,
                body: body,
                type: type || 'text',
                isMine: false,
                is_read: 0,
                time: new Date().toISOString()
            });
            
            if (app.phoneApp.activeChatNumber == number) {
                app.phoneApp.renderChatBubbles();
            } else {
                app.phoneApp.updateBadge();
                let notifyMsg = body;
                if(type === 'photo') notifyMsg = "Sent a photo";
                if(type === 'location') notifyMsg = "Shared location";
                app.notify('phone', number, notifyMsg);
            }
        }
    },
    
    // Global wrapper
    receiveSMS: (senderNumber, body, type) => {
        app.phoneApp.receiveMessageRaw(senderNumber, body, type);
    },

    // --- MAPS / GPS APP ---
    mapsApp: {
        blips: [],
        categories: {},
        currentCategory: null,
        isSearching: false,

        CATEGORY_CONFIG: {
            'Houses':       { icon: 'fas fa-home',           color: '#4cd964' },
            'Dealerships':  { icon: 'fas fa-car',            color: '#ff9500' },
            'Businesses':   { icon: 'fas fa-store',          color: '#5856d6' },
            'Faction HQs':  { icon: 'fas fa-shield-alt',     color: '#ff3b30' },
            'Gas Stations': { icon: 'fas fa-gas-pump',       color: '#ffcc00' },
            'ATMs & Banks': { icon: 'fas fa-university',     color: '#1abc9c' },
            'Food & Drink': { icon: 'fas fa-utensils',       color: '#ff6b6b' },
            'Garages':      { icon: 'fas fa-warehouse',      color: '#00a8ff' },
            'Jobs':         { icon: 'fas fa-briefcase',      color: '#8e8e93' },
            'Other':        { icon: 'fas fa-map-marker-alt', color: '#636e72' },
        },

        loadBlips: (blipData) => {
            app.mapsApp.blips = blipData || [];
            app.mapsApp.categories = {};

            blipData.forEach(blip => {
                const cat = blip.category || 'Other';
                if (!app.mapsApp.categories[cat]) app.mapsApp.categories[cat] = [];
                app.mapsApp.categories[cat].push(blip);
            });

            // Sort each category by distance
            for (const cat in app.mapsApp.categories) {
                app.mapsApp.categories[cat].sort((a, b) => (a.dist || 999) - (b.dist || 999));
            }

            app.mapsApp.currentCategory = null;
            app.mapsApp.isSearching = false;
            app.mapsApp.renderCategories();
        },

        renderCategories: () => {
            const container = document.getElementById('maps-categories');
            const locContainer = document.getElementById('maps-locations');
            container.innerHTML = '';
            locContainer.classList.add('hidden');
            locContainer.innerHTML = '';
            container.classList.remove('hidden');
            app.mapsApp.currentCategory = null;
            app.mapsApp.isSearching = false;

            document.getElementById('maps-title').innerText = 'Maps';
            document.getElementById('maps-search-input').value = '';

            const catKeys = Object.keys(app.mapsApp.categories);

            if (catKeys.length === 0) {
                container.innerHTML = '<div class="maps-empty"><i class="fas fa-map"></i><span>No locations found</span></div>';
                return;
            }

            const order = ['Houses', 'Dealerships', 'Businesses', 'Faction HQs', 'Gas Stations', 'ATMs & Banks', 'Food & Drink', 'Garages', 'Jobs', 'Other'];

            const sortedKeys = catKeys.sort((a, b) => {
                const ai = order.indexOf(a);
                const bi = order.indexOf(b);
                return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
            });

            sortedKeys.forEach(cat => {
                const config = app.mapsApp.CATEGORY_CONFIG[cat] || app.mapsApp.CATEGORY_CONFIG['Other'];
                const count = app.mapsApp.categories[cat].length;
                const nearest = app.mapsApp.categories[cat][0];
                const nearestDist = (nearest && nearest.dist !== undefined) ? nearest.dist + ' km' : '';
                const div = document.createElement('div');
                div.className = 'maps-category-item';
                div.onclick = () => app.mapsApp.openCategory(cat);
                div.innerHTML = `
                    <div class="maps-cat-icon" style="background: ${config.color}20; color: ${config.color};">
                        <i class="${config.icon}"></i>
                    </div>
                    <div class="maps-cat-info">
                        <div class="maps-cat-name">${cat}</div>
                        <div class="maps-cat-count">${count} location${count !== 1 ? 's' : ''}${nearestDist ? ' · Nearest: ' + nearestDist : ''}</div>
                    </div>
                    <div class="maps-cat-chevron"><i class="fas fa-chevron-right"></i></div>
                `;
                container.appendChild(div);
            });
        },

        openCategory: (catName) => {
            app.mapsApp.currentCategory = catName;
            app.mapsApp.isSearching = false;
            document.getElementById('maps-categories').classList.add('hidden');
            const locContainer = document.getElementById('maps-locations');
            locContainer.classList.remove('hidden');
            document.getElementById('maps-title').innerText = catName;
            document.getElementById('maps-search-input').value = '';

            const locations = app.mapsApp.categories[catName] || [];
            app.mapsApp.renderLocations(locations);
        },

        renderLocations: (locations) => {
            const container = document.getElementById('maps-locations');
            container.innerHTML = '';

            if (locations.length === 0) {
                container.innerHTML = '<div class="maps-empty"><i class="fas fa-map-pin"></i><span>No locations found</span></div>';
                return;
            }

            locations.forEach(loc => {
                const config = app.mapsApp.CATEGORY_CONFIG[loc.category] || app.mapsApp.CATEGORY_CONFIG['Other'];
                const distText = (loc.dist !== undefined) ? loc.dist + ' km' : '';
                const div = document.createElement('div');
                div.className = 'maps-location-item';
                div.onclick = () => app.mapsApp.selectLocation(loc);
                div.innerHTML = `
                    <div class="maps-loc-icon" style="color: ${config.color};">
                        <i class="fas fa-map-pin"></i>
                    </div>
                    <div class="maps-loc-info">
                        <div class="maps-loc-name">${loc.name}</div>
                        <div class="maps-loc-cat">${loc.category}${distText ? ' · ' + distText : ''}</div>
                    </div>
                    <div class="maps-loc-go"><i class="fas fa-directions"></i></div>
                `;
                container.appendChild(div);
            });
        },

        selectLocation: (loc) => {
            app.openConfirmModal(
                'Set GPS Route',
                `Navigate to "${loc.name}"?`,
                () => {
                    if ('mp' in window) {
                        mp.trigger('client:phone:setGPSRoute', JSON.stringify({
                            x: parseFloat(loc.x),
                            y: parseFloat(loc.y),
                            z: parseFloat(loc.z),
                            name: loc.name
                        }));
                    }
                }
            );
        },

        search: (query) => {
            if (!query || query.trim() === '') {
                if (app.mapsApp.currentCategory) {
                    app.mapsApp.openCategory(app.mapsApp.currentCategory);
                } else {
                    app.mapsApp.renderCategories();
                }
                return;
            }

            app.mapsApp.isSearching = true;

            const lower = query.toLowerCase();
            const results = app.mapsApp.blips.filter(b =>
                b.name.toLowerCase().includes(lower) ||
                (b.category && b.category.toLowerCase().includes(lower))
            );

            document.getElementById('maps-categories').classList.add('hidden');
            document.getElementById('maps-locations').classList.remove('hidden');
            document.getElementById('maps-title').innerText = 'Search Results';

            app.mapsApp.renderLocations(results);
        },

        goBack: () => {
            const searchInput = document.getElementById('maps-search-input');

            if (app.mapsApp.isSearching) {
                searchInput.value = '';
                if (app.mapsApp.currentCategory) {
                    app.mapsApp.openCategory(app.mapsApp.currentCategory);
                } else {
                    app.mapsApp.renderCategories();
                }
            } else if (app.mapsApp.currentCategory) {
                searchInput.value = '';
                app.mapsApp.renderCategories();
            } else {
                app.goHome();
            }
        }
    },

    // ── TAXI APP ──────────────────────────────────────────────────────────────
    taxiApp: {
        blips: [],
        categories: {},
        currentCategory: null,
        isSearching: false,
        driversOnDuty: 0,
        selectedLocation: null,
        selectedRating: 0,
        activeCall: null, // { phase, destName, fare, distKm, driverName }

        CATEGORY_CONFIG: {
            'Houses':       { icon: 'fas fa-home',           color: '#4cd964' },
            'Dealerships':  { icon: 'fas fa-car',            color: '#ff9500' },
            'Businesses':   { icon: 'fas fa-store',          color: '#5856d6' },
            'Faction HQs':  { icon: 'fas fa-shield-alt',     color: '#ff3b30' },
            'Gas Stations': { icon: 'fas fa-gas-pump',       color: '#ffcc00' },
            'ATMs & Banks': { icon: 'fas fa-university',     color: '#1abc9c' },
            'Food & Drink': { icon: 'fas fa-utensils',       color: '#ff6b6b' },
            'Garages':      { icon: 'fas fa-warehouse',      color: '#00a8ff' },
            'Jobs':         { icon: 'fas fa-briefcase',      color: '#8e8e93' },
            'Other':        { icon: 'fas fa-map-marker-alt', color: '#636e72' },
        },

        // Called when app data arrives from server
        loadAppData: (data) => {
            const t = app.taxiApp;
            t.driversOnDuty = data.driversOnDuty || 0;
            document.getElementById('taxi-driver-count').innerText = t.driversOnDuty;

            // If there's an active call, restore the progress view
            if (data.activeCall) {
                t.activeCall = data.activeCall;
                t.showProgress(data.activeCall.phase, data.activeCall);
                return;
            }

            // Show browse view
            t.showBrowse();
        },

        loadLocations: (locData) => {
            const t = app.taxiApp;
            t.blips = locData || [];
            t.categories = {};

            locData.forEach(blip => {
                const cat = blip.category || 'Other';
                if (!t.categories[cat]) t.categories[cat] = [];
                t.categories[cat].push(blip);
            });

            for (const cat in t.categories) {
                t.categories[cat].sort((a, b) => (a.dist || 999) - (b.dist || 999));
            }

            t.currentCategory = null;
            t.isSearching = false;
            t.renderCategories();
        },

        showBrowse: () => {
            document.getElementById('taxi-browse').classList.remove('hidden');
            document.getElementById('taxi-confirm').classList.add('hidden');
            document.getElementById('taxi-progress').classList.add('hidden');
            document.getElementById('taxi-rating').classList.add('hidden');
            document.getElementById('taxi-title').innerText = 'Taxi';
        },

        renderCategories: () => {
            const t = app.taxiApp;
            const container = document.getElementById('taxi-categories');
            const locContainer = document.getElementById('taxi-locations');
            container.innerHTML = '';
            locContainer.classList.add('hidden');
            locContainer.innerHTML = '';
            container.classList.remove('hidden');
            t.currentCategory = null;
            t.isSearching = false;
            document.getElementById('taxi-title').innerText = 'Taxi';
            document.getElementById('taxi-search-input').value = '';

            const catKeys = Object.keys(t.categories);
            if (catKeys.length === 0) {
                container.innerHTML = '<div class="maps-empty"><i class="fas fa-taxi"></i><span>Loading locations...</span></div>';
                return;
            }

            const order = ['Houses', 'Dealerships', 'Businesses', 'Faction HQs', 'Gas Stations', 'ATMs & Banks', 'Food & Drink', 'Garages', 'Jobs', 'Other'];
            const sortedKeys = catKeys.sort((a, b) => {
                const ai = order.indexOf(a);
                const bi = order.indexOf(b);
                return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
            });

            sortedKeys.forEach(cat => {
                const config = t.CATEGORY_CONFIG[cat] || t.CATEGORY_CONFIG['Other'];
                const count = t.categories[cat].length;
                const nearest = t.categories[cat][0];
                const nearestDist = (nearest && nearest.dist !== undefined) ? nearest.dist + ' km' : '';
                const div = document.createElement('div');
                div.className = 'maps-category-item';
                div.onclick = () => t.openCategory(cat);
                div.innerHTML = `
                    <div class="maps-cat-icon" style="background: ${config.color}20; color: ${config.color};">
                        <i class="${config.icon}"></i>
                    </div>
                    <div class="maps-cat-info">
                        <div class="maps-cat-name">${cat}</div>
                        <div class="maps-cat-count">${count} location${count !== 1 ? 's' : ''}${nearestDist ? ' · Nearest: ' + nearestDist : ''}</div>
                    </div>
                    <div class="maps-cat-chevron"><i class="fas fa-chevron-right"></i></div>
                `;
                container.appendChild(div);
            });
        },

        openCategory: (catName) => {
            const t = app.taxiApp;
            t.currentCategory = catName;
            t.isSearching = false;
            document.getElementById('taxi-categories').classList.add('hidden');
            const locContainer = document.getElementById('taxi-locations');
            locContainer.classList.remove('hidden');
            document.getElementById('taxi-title').innerText = catName;
            document.getElementById('taxi-search-input').value = '';

            const locations = t.categories[catName] || [];
            t.renderLocations(locations);
        },

        renderLocations: (locations) => {
            const t = app.taxiApp;
            const container = document.getElementById('taxi-locations');
            container.innerHTML = '';

            if (locations.length === 0) {
                container.innerHTML = '<div class="maps-empty"><i class="fas fa-map-pin"></i><span>No locations found</span></div>';
                return;
            }

            locations.forEach(loc => {
                const config = t.CATEGORY_CONFIG[loc.category] || t.CATEGORY_CONFIG['Other'];
                const distText = (loc.dist !== undefined) ? loc.dist + ' km' : '';
                const div = document.createElement('div');
                div.className = 'maps-location-item';
                div.onclick = () => t.selectLocation(loc);
                div.innerHTML = `
                    <div class="maps-loc-icon" style="color: ${config.color};">
                        <i class="fas fa-map-pin"></i>
                    </div>
                    <div class="maps-loc-info">
                        <div class="maps-loc-name">${loc.name}</div>
                        <div class="maps-loc-cat">${loc.category}${distText ? ' · ' + distText : ''}</div>
                    </div>
                    <div class="maps-loc-go" style="color: #ffc300;"><i class="fas fa-taxi"></i></div>
                `;
                container.appendChild(div);
            });
        },

        selectLocation: (loc) => {
            const t = app.taxiApp;
            t.selectedLocation = loc;

            document.getElementById('taxi-browse').classList.add('hidden');
            document.getElementById('taxi-confirm').classList.remove('hidden');

            document.getElementById('taxi-confirm-dest').innerText = loc.name;

            // Calculate estimated fare ($50/km)
            const dist = loc.dist || 0;
            const fare = Math.round(dist * 50);
            const minDist = 0.5;

            document.getElementById('taxi-confirm-fare').innerText = dist < minDist ? 'Too close' : '$' + fare;
            document.getElementById('taxi-confirm-info').innerText = dist + ' km · $50/km';

            const callBtn = document.getElementById('taxi-call-btn');
            if (t.driversOnDuty === 0) {
                callBtn.classList.add('disabled');
                callBtn.innerHTML = '<i class="fas fa-phone-slash"></i> No drivers available';
            } else if (dist < minDist) {
                callBtn.classList.add('disabled');
                callBtn.innerHTML = '<i class="fas fa-times"></i> Min distance: 0.5 km';
            } else {
                callBtn.classList.remove('disabled');
                callBtn.innerHTML = '<i class="fas fa-phone-alt"></i> Call Taxi';
            }
        },

        useWaypoint: () => {
            // Ask the client to check for a GTA waypoint
            if ('mp' in window) mp.trigger('client:phone:getWaypoint');
        },

        onWaypointResult: (data) => {
            const t = app.taxiApp;
            if (!data || data.error) {
                app.notify('taxi', 'Taxi', data ? data.error : 'Set a waypoint on map first.');
                return;
            }
            // data = { name, x, y, z, dist }
            t.selectLocation({
                name: data.name || 'Custom Waypoint',
                x: data.x,
                y: data.y,
                z: data.z,
                dist: data.dist,
                category: 'Waypoint'
            });
        },

        confirmCall: () => {
            const t = app.taxiApp;
            if (!t.selectedLocation) return;
            const loc = t.selectedLocation;

            if ('mp' in window) {
                mp.trigger('client:phone:callTaxi', JSON.stringify({
                    name: loc.name,
                    x: parseFloat(loc.x),
                    y: parseFloat(loc.y),
                    z: parseFloat(loc.z)
                }));
            }
        },

        onCallPlaced: (data) => {
            const t = app.taxiApp;
            t.activeCall = {
                phase: 0,
                destName: data.destName,
                fare: data.fare,
                distKm: data.distKm,
                driverName: null
            };
            t.showProgress(0, t.activeCall);
        },

        onCallError: (message) => {
            app.notify('taxi', 'Taxi', message);
        },

        showProgress: (phase, data) => {
            const t = app.taxiApp;

            document.getElementById('taxi-browse').classList.add('hidden');
            document.getElementById('taxi-confirm').classList.add('hidden');
            document.getElementById('taxi-progress').classList.remove('hidden');
            document.getElementById('taxi-rating').classList.add('hidden');

            if (data) {
                document.getElementById('taxi-progress-dest').innerText = data.destName || 'Your destination';
                document.getElementById('taxi-progress-fare').innerText = '$' + (data.fare || 0);
                if (data.driverName) t.activeCall.driverName = data.driverName;
            }

            // Update stepper
            const steps = document.querySelectorAll('#taxi-stepper .taxi-step');
            steps.forEach(step => {
                const stepNum = parseInt(step.dataset.step);
                step.classList.remove('active', 'completed');
                if (stepNum < phase) {
                    step.classList.add('completed');
                } else if (stepNum === phase) {
                    step.classList.add('active');
                }
            });

            // Hide cancel button once boarded (phase 3+)
            const cancelBtn = document.getElementById('taxi-cancel-btn');
            if (phase >= 3) {
                cancelBtn.classList.add('hidden');
            } else {
                cancelBtn.classList.remove('hidden');
            }

            // Phase 4 = finished → show rating
            if (phase === 4) {
                setTimeout(() => {
                    t.showRating(data);
                }, 1500);
            }
        },

        showRating: (data) => {
            const t = app.taxiApp;

            document.getElementById('taxi-browse').classList.add('hidden');
            document.getElementById('taxi-confirm').classList.add('hidden');
            document.getElementById('taxi-progress').classList.add('hidden');
            document.getElementById('taxi-rating').classList.remove('hidden');

            document.getElementById('taxi-rating-driver').innerText = (t.activeCall && t.activeCall.driverName) ? t.activeCall.driverName : 'Your driver';
            document.getElementById('taxi-rating-total').innerText = '$' + ((data && data.fare) || (t.activeCall && t.activeCall.fare) || 0);

            // Reset stars
            t.selectedRating = 0;
            document.querySelectorAll('#taxi-stars i').forEach(star => star.classList.remove('selected'));
            document.getElementById('taxi-submit-rating').classList.remove('enabled');
        },

        selectStar: (num) => {
            const t = app.taxiApp;
            t.selectedRating = num;
            document.querySelectorAll('#taxi-stars i').forEach(star => {
                const sn = parseInt(star.dataset.star);
                if (sn <= num) star.classList.add('selected');
                else star.classList.remove('selected');
            });
            document.getElementById('taxi-submit-rating').classList.add('enabled');
        },

        submitRating: () => {
            const t = app.taxiApp;
            if (t.selectedRating < 1) return;
            if ('mp' in window) mp.trigger('client:phone:submitTaxiRating', t.selectedRating);
            t.activeCall = null;
            t.selectedRating = 0;
            t.selectedLocation = null;
            t.showBrowse();
        },

        cancelCall: () => {
            if ('mp' in window) mp.trigger('client:phone:cancelTaxi');
        },

        onCallCancelled: () => {
            const t = app.taxiApp;
            t.activeCall = null;
            t.selectedLocation = null;
            t.showBrowse();
            app.notify('taxi', 'Taxi', 'Your ride has been cancelled.');
        },

        onRatingConfirmed: () => {
            const t = app.taxiApp;
            t.activeCall = null;
            t.selectedRating = 0;
            t.selectedLocation = null;
            t.showBrowse();
        },

        backToBrowse: () => {
            const t = app.taxiApp;
            t.selectedLocation = null;
            document.getElementById('taxi-confirm').classList.add('hidden');
            document.getElementById('taxi-browse').classList.remove('hidden');
        },

        search: (query) => {
            const t = app.taxiApp;
            if (!query || query.trim() === '') {
                if (t.currentCategory) {
                    t.openCategory(t.currentCategory);
                } else {
                    t.renderCategories();
                }
                return;
            }

            t.isSearching = true;
            const lower = query.toLowerCase();
            const results = t.blips.filter(b =>
                b.name.toLowerCase().includes(lower) ||
                (b.category && b.category.toLowerCase().includes(lower))
            );

            document.getElementById('taxi-categories').classList.add('hidden');
            document.getElementById('taxi-locations').classList.remove('hidden');
            document.getElementById('taxi-title').innerText = 'Search Results';

            t.renderLocations(results);
        },

        goBack: () => {
            const t = app.taxiApp;

            // If showing rating, can't go back
            if (!document.getElementById('taxi-rating').classList.contains('hidden')) return;

            // If showing progress, do nothing (use cancel button)
            if (!document.getElementById('taxi-progress').classList.contains('hidden')) return;

            // If showing confirm, go back to browse
            if (!document.getElementById('taxi-confirm').classList.contains('hidden')) {
                t.backToBrowse();
                return;
            }

            const searchInput = document.getElementById('taxi-search-input');
            if (t.isSearching) {
                searchInput.value = '';
                if (t.currentCategory) {
                    t.openCategory(t.currentCategory);
                } else {
                    t.renderCategories();
                }
            } else if (t.currentCategory) {
                searchInput.value = '';
                t.renderCategories();
            } else {
                app.goHome();
            }
        },

        // Update progress from server events
        updateProgress: (data) => {
            const t = app.taxiApp;
            if (!t.activeCall) {
                t.activeCall = { phase: 0, destName: '', fare: 0, distKm: 0, driverName: null };
            }
            if (data.driverName) t.activeCall.driverName = data.driverName;
            if (data.destName) t.activeCall.destName = data.destName;
            if (data.fare) t.activeCall.fare = data.fare;
            t.activeCall.phase = data.phase;
            t.showProgress(data.phase, t.activeCall);
        }
    },

    scooter: {
        state: 'idle', 
        timerInterval: null,
        startTime: null,
        unlockCost: 5,
        costPerMin: 1,
        simulatedBattery: 0,

        scan: () => {
            if (app.scooter.state === 'found') { app.scooter.unlock(); return; }
            const ring = document.getElementById('scootr-ring');
            const msg = document.getElementById('escootr-status-msg');
            const btn = document.getElementById('btn-escootr-main');
            app.scooter.state = 'scanning';
            ring.classList.add('pulsing');
            msg.innerText = "Triangulating nearby scooters..."; 
            btn.disabled = true;
            btn.innerText = "SEARCHING...";
            if ('mp' in window) mp.trigger('client:proxyAction', 'scooterAction', JSON.stringify({ type: 'scan' }));
        },

        onScanResult: (data) => {
            const ring = document.getElementById('scootr-ring');
            const msg = document.getElementById('escootr-status-msg');
            const btn = document.getElementById('btn-escootr-main');
            const info = document.getElementById('escootr-found-info');
            ring.classList.remove('pulsing');
            btn.disabled = false;
            if (data.status === 'failed') {
                app.scooter.state = 'idle';
                msg.innerText = data.msg || "Cannot scan here.";
                btn.innerText = "SCAN AREA";
            } else if (data.status === 'found') {
                app.scooter.state = 'found';
                app.scooter.simulatedBattery = data.battery;
                msg.innerText = "Signal acquired.";
                info.classList.remove('hidden');
                const distEl = document.getElementById('escootr-found-dist');
                if(distEl) distEl.innerText = data.dist || 15;
                document.getElementById('escootr-found-batt').innerText = data.battery;
                btn.innerText = `UNLOCK ($${app.scooter.unlockCost})`;
                btn.className = "scootr-scan-btn unlock";
            } else {
                app.scooter.state = 'idle';
                msg.innerText = "No scooters signal nearby.";
                btn.innerText = "SCAN AGAIN";
            }
        },

        unlock: () => { if ('mp' in window) mp.trigger('client:proxyAction', 'scooterAction', JSON.stringify({ type: 'rent' })); },

        startRide: () => {
            app.scooter.state = 'active';
            document.getElementById('escootr-scan-ui').classList.add('hidden');
            document.getElementById('escootr-active-ui').classList.remove('hidden');
            app.scooter.startTime = Date.now();
            app.scooter.timerInterval = setInterval(app.scooter.updateRideUI, 1000);
            closePhone();
        },

        updateRideUI: () => {
            if (!app.scooter.startTime) return;
            const diffSeconds = Math.floor((Date.now() - app.scooter.startTime) / 1000);
            const mins = Math.floor(diffSeconds / 60);
            const secs = diffSeconds % 60;
            document.getElementById('escootr-timer').innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            const currentCost = app.scooter.unlockCost + (mins * app.scooter.costPerMin) + (secs > 0 ? 0 : 0);
            document.getElementById('escootr-cost').innerText = '$' + currentCost.toFixed(2);
            document.getElementById('escootr-batt-live').innerText = app.scooter.simulatedBattery + "%";
        },

        endRide: () => {
            if ('mp' in window) mp.trigger('client:proxyAction', 'scooterAction', JSON.stringify({ type: 'end' }));
            if(app.scooter.timerInterval) clearInterval(app.scooter.timerInterval);
            app.scooter.state = 'idle';
            document.getElementById('escootr-scan-ui').classList.remove('hidden');
            document.getElementById('escootr-active-ui').classList.add('hidden');
            document.getElementById('escootr-found-info').classList.add('hidden');
            const btn = document.getElementById('btn-escootr-main');
            btn.innerText = "SCAN AREA";
            btn.className = "scootr-scan-btn";
            document.getElementById('escootr-status-msg').innerText = "Ride ended.";
        }
    },

    loadPhotos: (photosJson, baseUrl) => {
        app.photos = Array.isArray(photosJson) ? photosJson : [];
        app.mediaBaseUrl = baseUrl;
        const grid = document.getElementById('gallery-grid');
        if (!grid) return;
        grid.innerHTML = '';
        const countBadge = document.getElementById('gallery-count');
        if (countBadge) countBadge.innerText = app.photos.length > 0 ? app.photos.length : '';
        if (app.photos.length === 0) { grid.innerHTML = '<div class="gallery-empty"><i class="fas fa-camera"></i><span>No photos yet</span></div>'; return; }
        
        app.photos.forEach(photo => {
            const div = document.createElement('div');
            div.className = 'gallery-item';
            const fullUrl = app.mediaBaseUrl + photo.image_path;
            div.innerHTML = `<img src="${fullUrl}" loading="lazy">`;
            
            div.onclick = () => {
                if (app.galleryMode === 'pick') {
                    // --- PICK MODE ---
                    app.openConfirmModal("Send Photo", "Send this photo?", () => {
                         const target = app.phoneApp.activeChatNumber;
                         // Send via proxy
                         if('mp' in window) mp.trigger('client:proxyAction', 'sharePhoto', JSON.stringify({ target: target, image: photo.image_path }));
                         
                         // --- FIX: RETURN TO CHAT CORRECTLY ---
                         app.galleryMode = 'view';
                         document.getElementById('gallery-title').innerText = "Gallery";
                         document.getElementById('btn-gallery-back').onclick = app.goHome;

                         // 1. Switch View
                         app.open('phone-app');
                         
                         // 2. Open Chat
                         if(target) {
                             const name = app.phoneApp.getContactName(target);
                             app.phoneApp.openChat(target, name);
                         }

                         // Hide menu
                         document.getElementById('chat-attachment-menu').classList.add('hidden');
                    });
                } else {
                    // --- VIEW MODE ---
                    app.openPhotoDetail(photo);
                }
            };
            grid.appendChild(div);
        });
    },

    openPhotoDetail: (photo) => {
        app.currentPhoto = photo;
        app.open('photo-detail');
        const img = document.getElementById('photo-full-img');
        img.src = app.mediaBaseUrl + photo.image_path;
        const dateEl = document.getElementById('photo-detail-date');
        const date = new Date(photo.created_at);
        dateEl.innerText = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        // Update the back button to return to the correct view
        const backBtn = document.querySelector('#view-photo-detail .back-btn');
        if (backBtn) {
            backBtn.onclick = () => {
                if (app.photoDetailReturnView === 'chat-thread') {
                    document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
                    document.getElementById('view-chat-thread').classList.remove('hidden');
                } else {
                    app.open('gallery');
                }
                app.photoDetailReturnView = 'gallery'; // reset to default
            };
        }
    },

    pendingAction: null,

    openConfirmModal: (title, text, actionCallback) => {
        document.getElementById('confirm-modal').classList.remove('hidden');
        document.getElementById('confirm-title').innerText = title;
        document.getElementById('confirm-text').innerText = text;
        app.pendingAction = actionCallback;
        const yesBtn = document.getElementById('btn-confirm-yes');
        const newBtn = yesBtn.cloneNode(true);
        yesBtn.parentNode.replaceChild(newBtn, yesBtn);
        newBtn.innerText = "Confirm";
        newBtn.style.background = "#00a8ff";
        if(title.includes("Delete")) newBtn.style.background = "#ff3b30";
        
        newBtn.addEventListener('click', () => { if (app.pendingAction) app.pendingAction(); app.closeConfirmModal(); });
    },

    closeConfirmModal: () => {
        document.getElementById('confirm-modal').classList.add('hidden');
        app.pendingAction = null;
    },

    deleteCurrentPhoto: () => {
        if (!app.currentPhoto) return;
        app.openConfirmModal("Delete Photo", "Are you sure you want to permanently delete this picture?", () => {
                if ('mp' in window) mp.trigger('client:proxyAction', 'deletePhoto', JSON.stringify({ id: app.currentPhoto.id, path: app.currentPhoto.image_path }));
                app.photos = app.photos.filter(p => p.id !== app.currentPhoto.id);
                app.loadPhotos(app.photos, app.mediaBaseUrl);
                app.open('gallery');
                player.call('showNotification', ['System', 'Photo deleted successfully.']);
            }
        );
    },

    settings: {
        data: {
            phone_number: 'Unknown',
            wallpaper: 'wall1.jpg',
            is_dnd: false,
            is_flight_mode: false,
            zoom_level: 100
        },

        init: (serverData) => {
            if (serverData) {
                app.settings.data.phone_number = serverData.phone_number || 'Unknown';
                app.settings.data.wallpaper = serverData.wallpaper || 'wall1.jpg';
                app.settings.data.is_dnd = !!serverData.is_dnd;
                app.settings.data.is_flight_mode = !!serverData.is_flight_mode;
                app.settings.data.zoom_level = serverData.zoom_level || 100;
                app.settings.data.mugshot = serverData.mugshot || null;
            }
            app.settings.applyAll();
            setTimeout(() => { if(app.settings.renderWallpapers) app.settings.renderWallpapers(); }, 100);
        },

        applyAll: () => {
            app.settings.setWallpaperUI(app.settings.data.wallpaper);
            app.settings.applyZoomUI(app.settings.data.zoom_level);
            const dndToggle = document.getElementById('toggle-dnd');
            if(dndToggle) dndToggle.checked = app.settings.data.is_dnd;
            app.settings.toggleDNDUI(app.settings.data.is_dnd);
            const flightToggle = document.getElementById('toggle-flight-mode');
            if(flightToggle) flightToggle.checked = app.settings.data.is_flight_mode;
            app.settings.toggleFlightUI(app.settings.data.is_flight_mode);
            const numEl = document.getElementById('setting-my-number');
            if (numEl) numEl.innerText = app.settings.data.phone_number;

            // Mugshot avatar
            const avatarEl = document.getElementById('settings-avatar');
            if (avatarEl) {
                if (app.settings.data.mugshot) {
                    avatarEl.innerHTML = `<img src="${app.settings.data.mugshot}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-user\\'></i>'" />`;
                } else {
                    avatarEl.innerHTML = '<i class="fas fa-user"></i>';
                }
            }
        },

        renderWallpapers: () => {
            const grid = document.getElementById('wallpaper-grid');
            if (!grid) return;
            grid.innerHTML = '';
            const walls = ['wall1.jpg', 'wall2.jpg', 'wall3.jpg', 'wall4.jpg', 'wall5.jpg', 'wall6.jpg'];
            walls.forEach(wall => {
                const div = document.createElement('div');
                div.className = 'wallpaper-item';
                const path = `package://phone/ui/images/wallpapers/${wall}`; 
                div.style.backgroundImage = `url('${path}')`;
                if (app.settings.data.wallpaper === wall) div.classList.add('selected');
                div.onclick = () => {
                    document.querySelectorAll('.wallpaper-item').forEach(el => el.classList.remove('selected'));
                    div.classList.add('selected');
                    app.settings.setWallpaper(wall);
                };
                grid.appendChild(div);
            });
        },

        toggleDND: (checked) => { app.settings.data.is_dnd = checked; app.settings.toggleDNDUI(checked); app.settings.save('is_dnd', checked ? 1 : 0); },
        toggleFlightMode: (checked) => { app.settings.data.is_flight_mode = checked; app.settings.toggleFlightUI(checked); app.settings.save('is_flight_mode', checked ? 1 : 0); },
        setZoom: (val) => { app.settings.data.zoom_level = parseInt(val); app.settings.applyZoomUI(app.settings.data.zoom_level); app.settings.save('zoom_level', app.settings.data.zoom_level); },
        setWallpaper: (source) => { app.settings.data.wallpaper = source; app.settings.setWallpaperUI(source); app.settings.save('wallpaper', source); },

        applyCustomWallpaper: () => {
            const input = document.getElementById('custom-wall-url');
            if(!input) return;
            const url = input.value.trim();
            if (!url) return;
            if (!url.startsWith('http')) return app.notify("system", "Error", "Link must start with http/s");
            document.querySelectorAll('.wallpaper-item').forEach(el => el.classList.remove('selected'));
            app.settings.setWallpaper(url);
            app.notify("system", "Updated", "Custom wallpaper applied.");
            input.value = ''; 
        },

        save: (key, val) => { if ('mp' in window) mp.trigger('client:proxyAction', 'saveSetting', JSON.stringify({ key, val })); },

        setWallpaperUI: (source) => {
            let finalUrl = source.startsWith('http') ? `url('${source}')` : `url('package://phone/ui/images/wallpapers/${source}')`;
            
            const screen = document.querySelector('.screen-content');
            if(screen) {
                screen.style.backgroundImage = finalUrl;
                screen.style.backgroundSize = 'cover';
                screen.style.backgroundPosition = 'center';
            }

            const toastScreen = document.querySelector('.toast-screen');
            if(toastScreen) {
                toastScreen.style.backgroundImage = finalUrl;
                toastScreen.style.backgroundSize = 'cover';
                toastScreen.style.backgroundPosition = 'center';
            }
        },

        toggleDNDUI: (isActive) => { const dndIcon = document.getElementById('status-dnd'); if (dndIcon) isActive ? dndIcon.classList.remove('hidden') : dndIcon.classList.add('hidden'); },
        toggleFlightUI: (isActive) => { const signalIcon = document.querySelector('.fa-signal'); if(signalIcon) signalIcon.className = isActive ? "fas fa-plane" : "fas fa-signal"; },
        applyZoomUI: (val) => {
            const shell = document.getElementById('phone-shell');
            if (shell) { shell.style.transform = `scale(${val / 100})`; shell.style.transformOrigin = 'bottom right'; }
            const zoomVal = document.getElementById('zoom-val');
            if(zoomVal) zoomVal.innerText = val + '%';
        }
    },
};

function openPhone() {
    document.getElementById('phone-shell').classList.remove('hidden');
    const toastShell = document.getElementById('toast-shell');
    toastShell.classList.remove('active');
    if (app.toastTimeout) { clearTimeout(app.toastTimeout); app.toastTimeout = null; }
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
app.settings.init();

// Lockscreen: clicking the time/date area unlocks; notifications handle their own clicks
document.addEventListener('DOMContentLoaded', () => {
    const lockTimeGroup = document.querySelector('.lock-time-group');
    if (lockTimeGroup) {
        lockTimeGroup.style.cursor = 'pointer';
        lockTimeGroup.addEventListener('click', () => app.unlock());
    }
});