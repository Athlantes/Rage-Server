const jobManager = require('./jobManager');

const JOB_DESCRIPTIONS = {
    'garbage': "Help keep Los Santos clean. Drive a trashmaster and collect bins from designated routes. Bonus for perfect runs.",
    'courier': "Deliver packages for GoPostal. The faster you deliver, the better. Tips available for good service."
};

const JOB_NAMES = {
    'garbage': "Sanitation Dept.",
    'courier': "GoPostal Logistics"
};

mp.events.add('server:requestJobMenuData', (player) => {
    // 1. Ensure skills are loaded
    if (!player.data.jobSkills) player.data.jobSkills = {};

    const menuData = [];
    const jobs = ['garbage', 'courier']; // List of jobs to display

    jobs.forEach(key => {
        const skill = player.data.jobSkills[key] || { level: 1, xp: 0 };
        const isActive = (player.activeJobId === key);

        menuData.push({
            key: key,
            name: JOB_NAMES[key] || key.charAt(0).toUpperCase() + key.slice(1),
            level: skill.level,
            rank: jobManager.getRankName(skill.level),
            xp: skill.xp,
            active: isActive,
            description: JOB_DESCRIPTIONS[key] || "No description available."
        });
    });

    // 2. Send JSON back to client
    player.call('client:receiveJobMenuData', [JSON.stringify(menuData)]);
});