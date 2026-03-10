// Called by the RAGE client when the UI opens
function loadData(boxItemsJson, invItemsJson) {
    const boxItems = JSON.parse(boxItemsJson);
    const invItems = JSON.parse(invItemsJson);

    renderGrid('box-grid', boxItems, true);
    renderGrid('inv-grid', invItems, false);
}

function renderGrid(containerId, items, isLocker) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // Clear old items

    items.forEach(item => {
        const slotDiv = document.createElement('div');
        slotDiv.className = 'slot';
        
        // --- ICON PATH ---
        // Change this path to wherever your main inventory images are stored!
        // We use itemId (e.g., 'water.png', 'phone.png')
        const imagePath = `../items/${item.itemId}.png`; 

        // Added the <img> tag and an onerror fallback if the image is missing
        slotDiv.innerHTML = `
            <div class="name">${item.name || item.itemId}</div>
            <img src="${imagePath}" class="icon" onerror="this.src='../items/default.png'; this.onerror=null;">
            <div class="count">x${item.count}</div>
        `;

        if (isLocker) {
            slotDiv.onclick = () => {
                slotDiv.style.pointerEvents = 'none';
                slotDiv.style.opacity = '0.5';
                
                if ('mp' in window) {
                    mp.trigger('client:citybox:takeItem', item.id);
                }
            };
        }

        container.appendChild(slotDiv);
    });

    const minSlots = 20;
    const totalSlots = Math.max(minSlots, Math.ceil(items.length / 4) * 4);
    const emptySlots = totalSlots - items.length;
    
    for(let i = 0; i < emptySlots; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'slot empty';
        container.appendChild(emptyDiv);
    }
}

function closeLocker() {
    if ('mp' in window) {
        mp.trigger('client:citybox:close');
    }
}