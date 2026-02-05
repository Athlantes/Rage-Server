let previewCam = null;
let previewBrowser = null;
let currentJobId = null;

// EVENT: Open the preview menu
mp.events.add('client:job:openPreview', (jobData) => {
    // 1. Setup Camera
    if (previewCam) previewCam.destroy();

    // Check if heading exists, default to 0 if not
    const heading = jobData.pos.h || 0;
    const rad = heading * (Math.PI / 180);
    
    // Position camera 2.5m in front of the ped/point
    const forwardX = -Math.sin(rad);
    const forwardY = Math.cos(rad);

    const camPos = new mp.Vector3(
        jobData.pos.x + (forwardX * 2.5),
        jobData.pos.y + (forwardY * 2.5),
        jobData.pos.z + 0.5
    );
    
    // Look at the job location
    const lookAt = new mp.Vector3(jobData.pos.x, jobData.pos.y, jobData.pos.z + 0.5);

    previewCam = mp.cameras.new('default', camPos, new mp.Vector3(0,0,0), 40);
    previewCam.pointAtCoord(lookAt.x, lookAt.y, lookAt.z);
    previewCam.setActive(true);
    mp.game.cam.renderScriptCams(true, false, 0, true, false);

    // 2. Open UI
    if (!previewBrowser) {
        previewBrowser = mp.browsers.new("package://ui/job-preview/index.html");
    }
    
    // Store ID for the callback
    currentJobId = jobData.id;

    // 3. Send data to UI Safely (Fix for quotes breaking JS)
    // We stringify the object, then we verify it's clean for execution
    const safeJson = JSON.stringify(jobData);
    previewBrowser.execute(`setupPreview(${JSON.stringify(safeJson)});`); // Double stringify handles escaping quotes
    
    mp.gui.cursor.show(true, true);
    mp.game.ui.displayRadar(false);
});

// EVENT: Handle button click from UI
mp.events.add('ui:job:select', (action) => {
    mp.gui.chat.push(`[Debug] Selected Job Action: ${action}`); // Debug message in chat
    
    cleanupPreview();
    
    if (currentJobId !== null && currentJobId !== undefined) {
        mp.events.callRemote('server:job:continue', currentJobId, action);
    } else {
        mp.gui.chat.push("Error: No Job ID found.");
    }
});

// EVENT: Handle close button
mp.events.add('ui:job:close', () => {
    cleanupPreview();
});

function cleanupPreview() {
    if (previewBrowser) {
        previewBrowser.destroy();
        previewBrowser = null;
    }
    
    mp.gui.cursor.show(false, false);
    mp.game.ui.displayRadar(true);

    if (previewCam) {
        mp.game.cam.renderScriptCams(false, true, 1000, true, false);
        previewCam.destroy();
        previewCam = null;
    }
    currentJobId = null;
}