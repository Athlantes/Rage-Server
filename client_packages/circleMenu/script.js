class Menu {
    constructor({
        centerX = 250,
        centerY = 250,
        outerRadius = 250,
        innerRadius = 90, // Increased inner hole for better text space
        iconRadius = 170, // Position icons in the "meat" of the slice
        sectorsGroupId = 'sectors',
        iconsContainerId = 'icons',
        headingSelector = '#title-text',
        descriptionSelector = '#description-text',
        fadeInDelay = 0.02,
    } = {}) {
        this.menuItemsData = [];
        this.centerX = centerX;
        this.centerY = centerY;
        this.outerRadius = outerRadius;
        this.innerRadius = innerRadius;
        this.iconRadius = iconRadius;
        this.sectorsGroup = document.getElementById(sectorsGroupId);
        this.iconsContainer = document.getElementById(iconsContainerId);
        this.heading = document.querySelector(headingSelector);
        this.description = document.querySelector(descriptionSelector);
        this.fadeInDelay = fadeInDelay;
        this.sectors = [];
        this.icons = []; // Track icons to highlight them
        this.activeSector = null;
        
        // Bind methods
        this.updateTextContent = this.updateTextContent.bind(this);
    }

    init() {
        if (typeof mp !== 'undefined') {
            mp.trigger('circleMenu:ready');
        }
    }

    updateMenu(itemsJson) {
        this.menuItemsData = JSON.parse(itemsJson);
        this.clearMenu();
        this.createSectorsAndIcons();
    }

    clearMenu() {
        this.sectorsGroup.innerHTML = '';
        this.iconsContainer.innerHTML = '';
        this.sectors = [];
        this.icons = [];
        this.activeSector = null;
        this.heading.textContent = '';
        this.description.textContent = '';
    }

    createSectorsAndIcons() {
        if (!this.menuItemsData || this.menuItemsData.length === 0) return;

        const totalItems = this.menuItemsData.length;
        // -90 degrees (in radians) so the first item starts at 12 o'clock
        const rotationOffset = -Math.PI / 2; 

        this.menuItemsData.forEach((item, index) => {
            // 1. Calculate Angles
            const startAngle = (index / totalItems) * 2 * Math.PI + rotationOffset;
            const endAngle = ((index + 1) / totalItems) * 2 * Math.PI + rotationOffset;
            
            // 2. Create Sector (The Shape)
            const sector = this.createSector(startAngle, endAngle, item, index);
            
            // 3. Create Icon (The Image)
            // Midpoint of the sector
            const midAngle = startAngle + (endAngle - startAngle) / 2;
            const icon = this.createIcon(midAngle, item, index);

            this.sectors.push(sector);
            this.icons.push(icon);

            this.sectorsGroup.appendChild(sector.element);
            this.iconsContainer.appendChild(icon.element);

            // Animation
            setTimeout(() => {
                sector.element.style.opacity = '1';
                icon.element.style.opacity = '1';
            }, index * (this.fadeInDelay * 1000));
        });
    }

    createSector(startAngle, endAngle, item, index) {
        // SVG Path Math
        const x1Outer = this.centerX + this.outerRadius * Math.cos(startAngle);
        const y1Outer = this.centerY + this.outerRadius * Math.sin(startAngle);
        const x2Outer = this.centerX + this.outerRadius * Math.cos(endAngle);
        const y2Outer = this.centerY + this.outerRadius * Math.sin(endAngle);

        const x1Inner = this.centerX + this.innerRadius * Math.cos(startAngle);
        const y1Inner = this.centerY + this.innerRadius * Math.sin(startAngle);
        const x2Inner = this.centerX + this.innerRadius * Math.cos(endAngle);
        const y2Inner = this.centerY + this.innerRadius * Math.sin(endAngle);

        // SVG Large Arc Flag (is the slice bigger than 180 deg?)
        const largeArcFlag = (endAngle - startAngle) > Math.PI ? 1 : 0;

        const pathData = [
            `M ${x1Inner},${y1Inner}`,
            `L ${x1Outer},${y1Outer}`,
            `A ${this.outerRadius},${this.outerRadius} 0 ${largeArcFlag},1 ${x2Outer},${y2Outer}`,
            `L ${x2Inner},${y2Inner}`,
            `A ${this.innerRadius},${this.innerRadius} 0 ${largeArcFlag},0 ${x1Inner},${y1Inner}`,
            'Z'
        ].join(' ');

        const sectorElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        sectorElement.setAttribute('d', pathData);
        sectorElement.classList.add('sector');

        // Events
        sectorElement.addEventListener('mouseenter', () => this.handleHover(index, item));
        sectorElement.addEventListener('mouseleave', () => this.handleLeave());
        sectorElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleClick(item);
        });

        return { element: sectorElement, index };
    }

    createIcon(midAngle, item, index) {
        const iconX = this.centerX + this.iconRadius * Math.cos(midAngle);
        const iconY = this.centerY + this.iconRadius * Math.sin(midAngle);

        const iconElement = document.createElement('i');
        const iconClass = item.icon.startsWith('fa-') ? `fas ${item.icon}` : item.icon;
        
        iconElement.className = `icon ${iconClass}`;
        // We set left/top and translate in CSS for perfect centering
        iconElement.style.left = `${iconX}px`;
        iconElement.style.top = `${iconY}px`;

        return { element: iconElement, index };
    }

    handleHover(index, item) {
        // Highlight Sector
        if (this.sectors[index]) this.sectors[index].element.classList.add('active');
        // Highlight Icon
        if (this.icons[index]) this.icons[index].element.classList.add('active');
        
        this.updateTextContent(item.title, item.description || '');
    }

    handleLeave() {
        // Clear all active states
        this.sectors.forEach(s => s.element.classList.remove('active'));
        this.icons.forEach(i => i.element.classList.remove('active'));
        
        this.heading.textContent = '';
        this.description.textContent = '';
    }

    handleClick(item) {
        // Play sound if you have one
        // const audio = new Audio('selection.mp3'); audio.play();

        if (typeof mp !== 'undefined') {
            mp.trigger('circleMenu:onSelect', item.ident);
        } else {
            console.log(`[DEV] Selected: ${item.ident}`);
        }
    }

    updateTextContent(title, description) {
        this.heading.textContent = title;
        this.description.textContent = description;
    }
}

const menu = new Menu();
document.addEventListener('DOMContentLoaded', () => {
    menu.init();
});

// Expose to window
window.updateMenu = (items) => {
    menu.updateMenu(items);
};