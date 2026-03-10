// =============================================
//  GoPostal CityBox UI — app.js
// =============================================

const MIN_SLOTS = 20; // minimum empty slots shown

// Called by the RAGE client after the browser loads
function loadData(boxItemsJson, invItemsJson) {
    const boxItems = JSON.parse(boxItemsJson);
    const invItems = JSON.parse(invItemsJson);

    renderGrid('box-grid', boxItems, true);
    renderGrid('inv-grid', invItems, false);

    // Update counts
    updateCount('locker-count', boxItems.length, true);
    updateCount('inv-count', invItems.length, false);
}

function updateCount(elId, count, isLocker) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = count === 0
        ? 'Empty'
        : `${count} item${count !== 1 ? 's' : ''}`;
    if (isLocker && count === 0) {
        el.style.color = '#3a5a7a';
    }
}

function renderGrid(containerId, items, isLocker) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    items.forEach(item => {
        const slot = createItemSlot(item, isLocker);
        container.appendChild(slot);
    });

    // Pad with empty slots
    const total = Math.max(MIN_SLOTS, Math.ceil(items.length / 4) * 4);
    const empties = total - items.length;
    for (let i = 0; i < empties; i++) {
        const empty = document.createElement('div');
        empty.className = 'slot empty';
        container.appendChild(empty);
    }
}

function createItemSlot(item, isLocker) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.itemId = item.id;

    const imagePath = `../items/${item.itemId}.png`;
    const displayName = item.name || item.itemId || '???';

    slot.innerHTML = `
        <span class="slot-name" title="${displayName}">${displayName}</span>
        <img
            src="${imagePath}"
            class="slot-img"
            alt="${displayName}"
            onerror="this.src='../items/default.png'; this.onerror=null;"
        >
        ${item.count > 1 ? `<span class="slot-count">x${item.count}</span>` : ''}
    `;

    if (isLocker) {
        slot.addEventListener('click', () => handleTakeItem(slot, item));
    }

    return slot;
}

function handleTakeItem(slotEl, item) {
    if (slotEl.classList.contains('retrieved')) return;

    // Mark as retrieved visually
    slotEl.classList.add('retrieved');
    slotEl.querySelector('.slot-name').textContent = 'COLLECTED';

    // Show toast
    showToast(`✓ ${item.name || item.itemId} added to pockets`);

    // Trigger RAGE event
    if (typeof mp !== 'undefined' && 'trigger' in mp) {
        mp.trigger('client:citybox:takeItem', item.id);
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function closeLocker() {
    if (typeof mp !== 'undefined' && 'trigger' in mp) {
        mp.trigger('client:citybox:close');
    }
}

// ---- DEMO DATA (only used in browser preview, not in-game) ----
if (typeof mp === 'undefined') {
    const demoBox = [
        { id: 1, itemId: 'water',       name: 'Water Bottle',  count: 3  },
        { id: 2, itemId: 'burger',      name: 'Cheeseburger',  count: 2  },
        { id: 3, itemId: 'apple',       name: 'Apple',         count: 5  },
        { id: 4, itemId: 'pumpkin',     name: 'Pumpkin',       count: 1  },
        { id: 5, itemId: 'scrap_metal', name: 'Scrap Metal',   count: 10 },
        { id: 6, itemId: 'cabbage',     name: 'Cabbage',       count: 4  },
        { id: 7, itemId: 'water',       name: 'Water Bottle',  count: 1  },
        { id: 8, itemId: 'burger',      name: 'Cheeseburger',  count: 1  },
    ];
    const demoInv = [
        { id: 101, itemId: 'apple',  name: 'Apple',        count: 2 },
        { id: 102, itemId: 'water',  name: 'Water Bottle', count: 1 },
        { id: 103, itemId: 'burger', name: 'Cheeseburger', count: 3 },
    ];
    loadData(JSON.stringify(demoBox), JSON.stringify(demoInv));
}
