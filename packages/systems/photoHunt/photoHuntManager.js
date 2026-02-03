// packages/core/photoHuntManager.js
const db = require('../../core/database');
const PlayerManager = require('../../core/playerManager');
const LandmarkDefinitions = require('../../data/landmarks');

const DAILY_LANDMARK_COUNT = 6; // How many landmarks to assign per day

const PhotoHuntManager = {
    // Determine the "Game Day" based on 7 AM reset
    getGameDate: () => {
        const now = new Date();
        // If it's before 7 AM, it counts as the previous day
        if (now.getHours() < 7) {
            now.setDate(now.getDate() - 1);
        }
        return now.toISOString().split('T')[0];
    },

    initPlayer: async (player) => {
        if (!player.data.dbId) return;

        const dateStr = PhotoHuntManager.getGameDate();
        
        // 1. Fetch today's record
        const [rows] = await db.query(
            "SELECT * FROM player_photo_hunt WHERE user_id = ? AND activity_date = ?", 
            [player.data.dbId, dateStr]
        );

        let assignedIds = [];
        let completedIds = [];

        if (rows.length > 0) {
            // Load existing progress
            assignedIds = JSON.parse(rows[0].assigned_landmarks || '[]');
            completedIds = JSON.parse(rows[0].completed_landmarks || '[]');
        } else {
            // Generate New Landmarks
            const shuffled = [...LandmarkDefinitions].sort(() => 0.5 - Math.random());
            assignedIds = shuffled.slice(0, DAILY_LANDMARK_COUNT).map(l => l.id);
            
            await db.query(
                "INSERT INTO player_photo_hunt (user_id, activity_date, assigned_landmarks, completed_landmarks) VALUES (?, ?, ?, ?)", 
                [player.data.dbId, dateStr, JSON.stringify(assignedIds), '[]']
            );
            console.log(`[PhotoHunt] Generated ${assignedIds.length} landmarks for ${player.name}`);
        }

        // Filter definitions to send full data to client
        const activeData = assignedIds.map(id => {
            const def = LandmarkDefinitions.find(l => l.id === id);
            return { ...def, completed: completedIds.includes(id) };
        }).filter(l => l.id);

        player.call('client:setupPhotoHunt', [JSON.stringify(activeData)]);
    },

    // Called when client claims they took a photo of a landmark
    processPhoto: async (player, landmarkId) => {
        const dateStr = PhotoHuntManager.getGameDate();
        const def = LandmarkDefinitions.find(l => l.id === landmarkId);

        if (!def) return;

        // Verify Database state
        const [rows] = await db.query(
            "SELECT * FROM player_photo_hunt WHERE user_id = ? AND activity_date = ?", 
            [player.data.dbId, dateStr]
        );

        if (rows.length === 0) return;

        let completed = JSON.parse(rows[0].completed_landmarks || '[]');
        const assigned = JSON.parse(rows[0].assigned_landmarks || '[]');

        // Validation Checks
        if (!assigned.includes(landmarkId)) return; // Not assigned today
        if (completed.includes(landmarkId)) return; // Already done

        // Rudimentary Server-side distance check (optional, but good security)
        const dist = player.dist(new mp.Vector3(def.pos.x, def.pos.y, def.pos.z));
        if (dist > 200) { // Allow 200m leeway for "photographing from distance"
            player.notify("You are too far away from the landmark.");
            return;
        }

        // Update DB
        completed.push(landmarkId);
        await db.query(
            "UPDATE player_photo_hunt SET completed_landmarks = ? WHERE id = ?",
            [JSON.stringify(completed), rows[0].id]
        );

        // Give Reward
        await PlayerManager.addMoneyAndSave(player, def.reward, `Photo Hunt: ${def.name}`);
        
        player.call('client:photoSuccess', [landmarkId]);
        player.call('showNotification', ['Photo Hunt', `Captured ${def.name}! Received $${def.reward}`]);
    }
};

mp.events.add('server:claimLandmarkPhoto', (player, landmarkId) => {
    PhotoHuntManager.processPhoto(player, landmarkId);
});

module.exports = PhotoHuntManager;