const app = {
    isLocked: true, 
    toastTimeout: null,
    currentVehicleId: null,
    mediaBaseUrl: '',
    photos: [],
    currentPhoto: null,

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
            app.showToast("System", "No Connection", "Turn off Airplane Mode to use this app.");
            return;
        }

        if (appName === 'camera') {
            if ('mp' in window) {
                // Signal client to open camera mode
                mp.trigger('client:phone:appCallback', 'camera', 'open');
            }
            return; // Stop here, don't change phone UI view
        }

        if (appName === 'bank') {
            if('mp' in window) mp.trigger('client:proxyAction', 'requestBankData', 0);
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
        const items = document.querySelectorAll('.mail-item');
        items.forEach(el => {
            el.classList.add('read');
        });

        const badge = document.getElementById('badge-mail');
        if(badge) badge.classList.add('hidden');

        const lockContainer = document.getElementById('lock-notification-list');
        if(lockContainer) lockContainer.innerHTML = '';

        if ('mp' in window) mp.trigger('client:proxyAction', 'readAllMails', 0);
    },

    openMailDetail: (mail) => {
        app.open('mail-detail');
        document.getElementById('mail-detail-sender').innerText = `From: ${mail.sender}`;
        document.getElementById('mail-detail-title').innerText = mail.title;
        document.getElementById('mail-detail-body').innerText = mail.message;

        if (!mail.is_read) {
            if ('mp' in window) {
                mp.trigger('client:proxyAction', 'readMail', mail.id);
            }

            mail.is_read = 1;
            
            const listEl = document.getElementById('mail-item-' + mail.id);
            if (listEl) {
                listEl.classList.add('read');
                listEl.classList.remove('unread');
            }

            const badge = document.getElementById('badge-mail');
            if (badge && !badge.classList.contains('hidden')) {
                let count = parseInt(badge.innerText) || 0;
                if (count > 0) count--;
                
                if (count <= 0) {
                    badge.classList.add('hidden');
                } else {
                    badge.innerText = count;
                }
            }
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
        if (!app.settings.dnd) {
            app.showToast(sender, title, message);
        }
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

    // --- eSCOOTR APP ---
    scooter: {
        state: 'idle', 
        timerInterval: null,
        startTime: null,
        unlockCost: 5,
        costPerMin: 1,
        simulatedBattery: 0,

        scan: () => {
            if (app.scooter.state === 'found') {
                app.scooter.unlock();
                return;
            }
            
            const circle = document.querySelector('.radar-circle');
            const msg = document.getElementById('escootr-status-msg');
            const btn = document.getElementById('btn-escootr-main');
            
            app.scooter.state = 'scanning';
            circle.classList.add('pulsing');
            msg.innerText = "Triangulating nearby scooters..."; 
            btn.disabled = true;
            btn.innerText = "SEARCHING...";

            if ('mp' in window) {
                mp.trigger('client:proxyAction', 'scooterAction', JSON.stringify({ type: 'scan' }));
            }
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

        unlock: () => {
             if ('mp' in window) {
                mp.trigger('client:proxyAction', 'scooterAction', JSON.stringify({ type: 'rent' }));
            }
        },

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
            
            document.getElementById('escootr-timer').innerText = 
                `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            const currentCost = app.scooter.unlockCost + (mins * app.scooter.costPerMin) + (secs > 0 ? 0 : 0);
            document.getElementById('escootr-cost').innerText = '$' + currentCost.toFixed(2);
            document.getElementById('escootr-batt-live').innerText = app.scooter.simulatedBattery + "%";
        },

        endRide: () => {
            if ('mp' in window) {
                mp.trigger('client:proxyAction', 'scooterAction', JSON.stringify({ type: 'end' }));
            }
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

    // --- GALLERY SYSTEM (Fixed: Moved outside 'scooter' object) ---
    loadPhotos: (photosJson, baseUrl) => {
        app.photos = Array.isArray(photosJson) ? photosJson : [];
        app.mediaBaseUrl = baseUrl;
        
        const grid = document.getElementById('gallery-grid');
        if (!grid) return;
        
        grid.innerHTML = '';

        if (app.photos.length === 0) {
            grid.innerHTML = '<div style="width:100%; padding:40px; text-align:center; color:#999; grid-column: 1 / -1;">No photos yet</div>';
            return;
        }

        app.photos.forEach(photo => {
            const div = document.createElement('div');
            div.className = 'gallery-item';
            div.onclick = () => app.openPhotoDetail(photo);
            
            const fullUrl = app.mediaBaseUrl + photo.image_path;
            
            div.innerHTML = `<img src="${fullUrl}" loading="lazy">`;
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
        
        // Store the action to run if they click Yes
        app.pendingAction = actionCallback;
        
        // Bind the Yes button
        const yesBtn = document.getElementById('btn-confirm-yes');
        // Remove old listeners to prevent stacking
        const newBtn = yesBtn.cloneNode(true);
        yesBtn.parentNode.replaceChild(newBtn, yesBtn);
        
        newBtn.addEventListener('click', () => {
            if (app.pendingAction) app.pendingAction();
            app.closeConfirmModal();
        });
    },

    closeConfirmModal: () => {
        document.getElementById('confirm-modal').classList.add('hidden');
        app.pendingAction = null;
    },

    // --- UPDATED DELETE LOGIC ---
    deleteCurrentPhoto: () => {
        if (!app.currentPhoto) return;
        
        // Use the new custom modal instead of the crash-prone confirm()
        app.openConfirmModal(
            "Delete Photo", 
            "Are you sure you want to permanently delete this picture?", 
            () => {
                // This runs only if user clicks "Delete"
                if ('mp' in window) {
                    mp.trigger('client:proxyAction', 'deletePhoto', JSON.stringify({
                        id: app.currentPhoto.id,
                        path: app.currentPhoto.image_path
                    }));
                }

                // 1. Remove from local array immediately (for instant feedback)
                app.photos = app.photos.filter(p => p.id !== app.currentPhoto.id);
                
                // 2. Refresh the gallery grid UI
                app.loadPhotos(app.photos, app.mediaBaseUrl);

                // 3. Go back to gallery view
                app.open('gallery');
                
                app.showToast("Gallery", "Deleted", "Photo removed successfully.");
            }
        );
    },

    // --- SETTINGS V2 ---
    settings: {
        flightMode: false,
        dnd: false,
        zoom: 100,
        currentWallpaper: 'wall1.jpg',

        init: () => {
            // Load saved settings
            const saved = localStorage.getItem('phoneSettings_v2');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    app.settings.flightMode = parsed.flightMode || false;
                    app.settings.dnd = parsed.dnd || false;
                    app.settings.zoom = parsed.zoom || 100;
                    app.settings.currentWallpaper = parsed.currentWallpaper || 'wall1.jpg';
                } catch (err) {
                    console.error("Settings Parse Error", err);
                }
            }

            app.settings.applyAll();
            
            // Force render with a slight delay to ensure DOM is ready
            setTimeout(() => {
                app.settings.renderWallpapers();
            }, 100);
            
            const idEl = document.getElementById('settings-my-id');
            if(idEl) idEl.innerText = "Unknown"; 
        },

        applyAll: () => {
            // Zoom
            const shell = document.getElementById('phone-shell');
            if (shell) {
                shell.style.transform = `scale(${app.settings.zoom / 100})`;
                shell.style.transformOrigin = 'bottom right'; 
            }
            const inputZoom = document.getElementById('input-zoom');
            if(inputZoom) inputZoom.value = app.settings.zoom;
            const zoomVal = document.getElementById('zoom-val');
            if(zoomVal) zoomVal.innerText = app.settings.zoom + '%';

            // Toggles
            const flightToggle = document.getElementById('toggle-flight-mode');
            if(flightToggle) flightToggle.checked = app.settings.flightMode;
            app.settings.updateSignalIcon();

            const dndToggle = document.getElementById('toggle-dnd');
            if(dndToggle) dndToggle.checked = app.settings.dnd;
            app.settings.toggleDND(app.settings.dnd);

            // Wallpaper
            app.settings.setWallpaper(app.settings.currentWallpaper, false);
        },

        setWallpaper: (source, save = true) => {
            const screen = document.querySelector('.screen-content');
            if(!screen) return;

            let finalUrl = '';
            if (source.startsWith('http') || source.startsWith('data:')) {
                finalUrl = `url('${source}')`;
            } else {
                finalUrl = `url('package://phone/ui/images/wallpapers/${source}')`;
            }

            screen.style.backgroundImage = finalUrl;
            screen.style.backgroundSize = 'cover';
            screen.style.backgroundPosition = 'center';
            screen.style.backgroundRepeat = 'no-repeat';
            
            app.settings.currentWallpaper = source;
            if (save) app.settings.save();
        },

        applyCustomWallpaper: () => {
            const input = document.getElementById('custom-wall-url');
            if(!input) return;
            const url = input.value.trim();
            if (!url) return app.showToast("Settings", "Error", "Invalid URL.");

            app.settings.setWallpaper(url, true);
            app.showToast("Settings", "Success", "Custom wallpaper applied.");
            input.value = '';
            app.settings.renderWallpapers(); // Refresh to clear selection
        },

        renderWallpapers: () => {
            console.log("DEBUG: Rendering Wallpapers..."); // Check F8 console
            const container = document.getElementById('wallpaper-list');
            
            if(!container) {
                console.error("DEBUG: Container #wallpaper-list NOT FOUND.");
                return;
            }

            // 1. HARDCODED LIST (To prevent empty array issues)
            const wallpapers = [
                { name: 'Blue Gem', file: 'wall1.jpg' },
                { name: 'Sweet Pink', file: 'wall2.jpg' },
                { name: 'Nature Green', file: 'wall3.jpg' },
                { name: 'Night City', file: 'wall4.jpg' },
                { name: 'Abstract', file: 'wall5.jpg' },
                { name: 'Dark Void', file: 'wall6.jpg' }
            ];

            container.innerHTML = '';
            
            wallpapers.forEach(wp => {
                const div = document.createElement('div');
                div.className = 'wall-option';
                
                // 2. INLINE STYLES (To force visibility even if CSS fails)
                div.style.position = 'relative';
                div.style.height = '150px'; // Forced height
                div.style.backgroundColor = '#444'; // Grey fallback if image missing
                div.style.borderRadius = '10px';
                div.style.marginBottom = '10px';
                div.style.cursor = 'pointer';
                div.style.overflow = 'hidden';
                div.style.backgroundSize = 'cover';
                div.style.backgroundPosition = 'center';

                // Image Source
                const previewUrl = `package://phone/ui/images/wallpapers/${wp.file}`;
                div.style.backgroundImage = `url('${previewUrl}')`;
                
                // Name Tag
                div.innerHTML = `<div style="
                    position: absolute; bottom: 0; width: 100%; 
                    background: rgba(0,0,0,0.6); color: white; 
                    font-size: 11px; padding: 5px; text-align: center;">
                    ${wp.name}
                </div>`;

                // Selection Border
                if (wp.file === app.settings.currentWallpaper) {
                    div.style.border = '3px solid #007aff';
                } else {
                    div.style.border = '3px solid transparent';
                }
                
                div.onclick = () => {
                    app.settings.setWallpaper(wp.file);
                    app.settings.renderWallpapers(); 
                };
                
                container.appendChild(div);
            });
            console.log(`DEBUG: Rendered ${wallpapers.length} wallpapers.`);
        },

        save: () => {
            const data = {
                flightMode: app.settings.flightMode,
                dnd: app.settings.dnd,
                zoom: app.settings.zoom,
                currentWallpaper: app.settings.currentWallpaper
            };
            localStorage.setItem('phoneSettings_v2', JSON.stringify(data));
        },

        updateSignalIcon: () => {
            const signalIcon = document.querySelector('.fa-signal');
            if(signalIcon) signalIcon.className = app.settings.flightMode ? "fas fa-plane" : "fas fa-signal";
        },

        toggleDND: (isActive) => {
            app.settings.dnd = isActive;
            app.settings.save();
            const dndIcon = document.getElementById('status-dnd');
            if (dndIcon) isActive ? dndIcon.classList.remove('hidden') : dndIcon.classList.add('hidden');
        },

        toggleFlightMode: (isActive) => {
            app.settings.flightMode = isActive;
            app.settings.updateSignalIcon();
            app.settings.save();
            if (isActive) app.showToast("System", "Settings", "Airplane Mode Enabled");
        },

        setZoom: (value) => {
            app.settings.zoom = value;
            const shell = document.getElementById('phone-shell');
            if(shell) {
                shell.style.transform = `scale(${value / 100})`;
                shell.style.transformOrigin = 'bottom right';
            }
            const zVal = document.getElementById('zoom-val');
            if(zVal) zVal.innerText = value + '%';
            app.settings.save();
        }
    },
};

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
app.settings.init();