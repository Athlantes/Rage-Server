// Store the current job data globally for debugging
let currentJob = null;

function setupPreview(jsonString) {
    try {
        // Safe parsing
        const job = JSON.parse(jsonString);
        currentJob = job;
        
        console.log("Job Preview Loaded:", job);

        document.getElementById('job-title').innerText = job.name || "Unknown Job";
        document.getElementById('job-desc').innerText = job.description || "No description available.";

        const container = document.getElementById('button-container');
        container.innerHTML = ''; // Clear old buttons

        if (job.buttons && Array.isArray(job.buttons)) {
            job.buttons.forEach(btn => {
                const button = document.createElement('button');
                button.className = 'job-btn';
                button.innerText = btn.label;
                
                button.onclick = () => {
                    console.log(`[UI] Button Clicked: ${btn.label}, Action: ${btn.action}`);
                    
                    // Trigger Client Event
                    if ('mp' in window) {
                        mp.trigger('ui:job:select', btn.action);
                    } else {
                        console.error("MP object not found (Are you testing in browser?)");
                    }
                };
                container.appendChild(button);
            });
        }
    } catch (e) {
        console.error("Error setting up preview:", e);
    }
}

function closeMenu() {
    console.log("[UI] Closing Menu");
    if ('mp' in window) {
        mp.trigger('ui:job:close');
    }
}