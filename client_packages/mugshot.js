
let pedHeadShot;
let takingScreenshot = false;
let headshotTexture = false;
let mugshotBrowser = null;
let frameCount = 0;
let mugshotFilename = "";
let isMugshotUploading = false;
let mugshotUploadUrl = "";
let mugshotDbId = 0;

function ensureMugshotBrowser() {
    if (!mugshotBrowser) {
        mugshotBrowser = mp.browsers.new('package://mugshot/index.html');
    }
}

mp.events.add('playerReady', () => {
    ensureMugshotBrowser();
});

mp.events.add("prepareScreenshot", (uploadUrl, dbId) => {
    if (isMugshotUploading) return mp.gui.chat.push("~r~Mugshot already in progress...");
    isMugshotUploading = true;
    mugshotUploadUrl = uploadUrl || "";
    mugshotDbId = dbId || 0;
    ensureMugshotBrowser();

    mp.gui.chat.push("~y~Preparing mugshot...");
    pedHeadShot = mp.players.local.registerheadshot();

    setTimeout(() => {
        if (mp.game.ped.isPedheadshotValid(pedHeadShot) && mp.game.ped.isPedheadshotReady(pedHeadShot)) {
            headshotTexture = mp.game.ped.getPedheadshotTxdString(pedHeadShot);
            frameCount = 0;
            takingScreenshot = true;
        } else {
            mp.gui.chat.push("~r~Failed to prepare headshot.");
            isMugshotUploading = false;
        }
    }, 2000);
});

mp.events.add('client:mugshot:uploadSuccess', (savedFilename) => {
    isMugshotUploading = false;
    mp.gui.chat.push(`~g~Mugshot saved: ${savedFilename}`);
});

mp.events.add('client:mugshot:error', (msg) => {
    isMugshotUploading = false;
    mp.gui.chat.push(`~r~Mugshot error: ${msg}`);
});

mp.events.add('render', () => {
    if (!takingScreenshot) return;

    mp.game.graphics.drawSprite(headshotTexture, headshotTexture, 0.045, 0.085, 0.10, 0.18, 0.0, 255, 255, 255, 1000);

    if (frameCount == 1) {
        mugshotFilename = `mugshot_${Date.now()}.jpg`;
        mp.gui.takeScreenshot(mugshotFilename, 0, 100, 0);
        takingScreenshot = false;
        mp.players.local.unregisterheadshot();

        // Wait for screenshot to save, then tell CEF to process + POST it
        setTimeout(() => {
            mp.gui.chat.push("~b~Processing mugshot...");
            setTimeout(() => {
                if (mugshotBrowser) {
                    mugshotBrowser.execute(`processAndUpload('${mugshotFilename}', '${mugshotUploadUrl}', ${mugshotDbId})`);
                } else {
                    isMugshotUploading = false;
                    mp.gui.chat.push("~r~Error: Mugshot browser missing.");
                }
            }, 1000);
        }, 100);
    }
    frameCount++;
});
