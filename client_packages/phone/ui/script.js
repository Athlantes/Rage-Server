// CONFIGURATION: Define your apps here for easy modularity
const NOTIFICATION_APPS = {
    'mail':      { color: '#007aff', icon: 'fas fa-envelope', title: 'Mail' },
    'phone':     { color: '#34c759', icon: 'fas fa-phone-alt', title: 'Phone' },
    'bank':      { color: '#1abc9c', icon: 'fas fa-university', title: 'Fleeca' },
    'scooter':   { color: '#56ab2f', icon: 'fas fa-bolt', title: 'eScootr' },
    'quickeats': { color: '#ff9500', icon: 'fas fa-hamburger', title: 'QuickEats' },
    'vehicles':  { color: '#f1c40f', icon: 'fas fa-car', title: 'Vehicles' },
    'system':    { color: '#8e8e93', icon: 'fas fa-cog', title: 'System' },
};

const app = {
    isLocked: true, 
    toastTimeout: null,
    currentVehicleId: null,
    mediaBaseUrl: '',
    photos: [],
    currentPhoto: null,
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
            
            notif.onclick = () => {
                if(app.isLocked) {
                    app.unlock(); 
                    let targetView = appId;
                    if(appId === 'phone') targetView = 'phone-app';
                    app.open(targetView);
                }
            };

            lockContainer.prepend(notif);
            
            if(lockContainer.children.length > 5) {
                lockContainer.removeChild(lockContainer.lastChild);
            }
        }

        const phoneShell = document.getElementById('phone-shell');
        const isPhoneHidden = phoneShell.classList.contains('hidden');
        
        if (isPhoneHidden && !app.settings.data.is_dnd) {
            app.showToast(config, title, message);
        }
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
                    <div class="mail-time" style="font-size:11px; color:#8e8e93;">${timeAgo}</div>
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
                    <div class="mail-time" style="font-size:11px; color:#8e8e93;">${timeAgo}</div>
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
                if(hasUnread) div.style.backgroundColor = "#f0f8ff"; 
                div.onclick = () => app.phoneApp.openChat(num, displayName);
                const prefix = lastMsg.isMine ? "You: " : "";
                div.innerHTML = `<div class="msg-header"><span class="msg-sender" style="${hasUnread ? 'font-weight:800; color:#007aff;' : ''}">${displayName} ${hasUnread ? '●' : ''}</span><span class="msg-date">${app.getRelativeTime(lastMsg.time)}</span></div><div class="msg-preview" style="${hasUnread ? 'font-weight:600; color:#000;' : ''}">${prefix}${preview}</div>`;
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

    scooter: {
        state: 'idle', 
        timerInterval: null,
        startTime: null,
        unlockCost: 5,
        costPerMin: 1,
        simulatedBattery: 0,

        scan: () => {
            if (app.scooter.state === 'found') { app.scooter.unlock(); return; }
            const circle = document.querySelector('.radar-circle');
            const msg = document.getElementById('escootr-status-msg');
            const btn = document.getElementById('btn-escootr-main');
            app.scooter.state = 'scanning';
            circle.classList.add('pulsing');
            msg.innerText = "Triangulating nearby scooters..."; 
            btn.disabled = true;
            btn.innerText = "SEARCHING...";
            if ('mp' in window) mp.trigger('client:proxyAction', 'scooterAction', JSON.stringify({ type: 'scan' }));
        },

        onScanResult: (data) => {
            const circle = document.querySelector('.radar-circle');
            const msg = document.getElementById('escootr-status-msg');
            const btn = document.getElementById('btn-escootr-main');
            const info = document.getElementById('escootr-found-info');
            circle.classList.remove('pulsing');
            btn.disabled = false;
            if (data.status === 'found') {
                app.scooter.state = 'found';
                app.scooter.simulatedBattery = data.battery;
                msg.innerText = "Signal acquired.";
                info.classList.remove('hidden');
                const distContainer = info.querySelector('div > span:first-child');
                if(distContainer) distContainer.innerHTML = `<i class="fas fa-walking"></i> ${data.dist || 15}m`;
                document.getElementById('escootr-found-batt').innerText = data.battery;
                btn.innerText = `UNLOCK ($${app.scooter.unlockCost})`;
                btn.style.background = "white"; 
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
            btn.style.background = "#32cd32";
            document.getElementById('escootr-status-msg').innerText = "Ride ended.";
        }
    },

    loadPhotos: (photosJson, baseUrl) => {
        app.photos = Array.isArray(photosJson) ? photosJson : [];
        app.mediaBaseUrl = baseUrl;
        const grid = document.getElementById('gallery-grid');
        if (!grid) return;
        grid.innerHTML = '';
        if (app.photos.length === 0) { grid.innerHTML = '<div style="width:100%; padding:40px; text-align:center; color:#999; grid-column: 1 / -1;">No photos yet</div>'; return; }
        
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
        newBtn.innerText = "Confirm"; // Default text
        newBtn.style.background = "#007aff";
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