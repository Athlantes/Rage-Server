function setupPreview(data) {
    const job = JSON.parse(data);
    
    document.getElementById('job-title').innerText = job.name;
    document.getElementById('job-desc').innerText = job.description;

    const container = document.getElementById('button-container');
    container.innerHTML = '';

    job.buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = 'job-btn';
        button.innerText = btn.label;
        button.onclick = () => {
            // Send selected action back to client script
            if('alt' in window) alt.emit('ui:job:select', btn.action); // Fallback
            else mp.trigger('ui:job:select', btn.action);
        };
        container.appendChild(button);
    });
}

function closeMenu() {
    if('alt' in window) alt.emit('ui:job:close');
    else mp.trigger('ui:job:close');
}