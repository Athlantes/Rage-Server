// packages/factions/taxi/events/duty.js

module.exports = (faction) => {
    // This perfectly catches the event sent from your interaction.js
    mp.events.add('faction:taxi:toggleDuty', (player) => {
        
        // 1. Check if they belong to Taxi (Faction ID 1)
        if (player.factionId !== faction.id) {
            return player.outputChatBox("!{#ff0000}You do not have the keys to this locker room.");
        }

        // 2. Toggle Duty State
        let onDuty = player.getVariable('factionDuty') || false;
        player.setVariable('factionDuty', !onDuty);

        if (!onDuty) {
            player.outputChatBox("!{#00ff00}You are now ON duty. You can grab a cab from the garage outside.");
        } else {
            player.outputChatBox("!{#ff0000}You are now OFF duty.");
        }
    });
};