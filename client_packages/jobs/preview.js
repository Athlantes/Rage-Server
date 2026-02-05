let previewCam = null;
let previewBrowser = null;
let currentJobId = null;

mp.events.add('client:job:openPreview', (jobData) => {
    // 1. Setup Camera
    if (previewCam) previewCam.destroy();

    // Calculate position in front of the NPC based on heading
    const rad = (jobData.pos.h || 0) * (Math.PI / 180);
    const forwardX = -Math.sin(rad);
    const forwardY = Math.cos(rad);

    // Place camera 2 meters in front, looking at the NPC
    const camPos = new mp.Vector3(
        jobData.pos.x + (forwardX * 2.0),
        jobData.pos.y + (forwardY * 2.0),
        jobData.pos.z + 0.6
    );
    const lookAt = new mp.Vector3(jobData.pos.x, jobData.pos.y, jobData.pos.z + 0.6);

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

    // Send data to UI
    previewBrowser.execute(`setupPreview('${JSON.stringify(jobData)}');`);
    
    mp.gui.cursor.show(true, true);
    mp.game.ui.displayRadar(false);
});

mp.events.add('ui:job:select', (action) => {
    cleanupPreview();
    if (currentJobId) {
        mp.events.callRemote('server:job:continue', currentJobId, action);
    }
});

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