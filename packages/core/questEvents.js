const QuestManager = require('./questManager');

module.exports = {
    /**
     * Dispatch an event to the Quest System.
     * @param {Player} player - The player triggering the event
     * @param {string} eventType - The type of event (e.g., 'fuel_vehicle')
     * @param {object} data - Data payload (e.g., { liters: 10 })
     */
    emit: (player, eventType, data = {}) => {
        if (!player || !mp.players.exists(player)) return;
        QuestManager.handleEvent(player, eventType, data);
    }
};