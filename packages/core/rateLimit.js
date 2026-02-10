// packages/core/rateLimit.js
// Server-side rate limiter to prevent event spam from modified clients.

const buckets = new Map(); // "playerId:eventName" -> { count, resetTime }

/**
 * Check if a player is rate-limited for a given event.
 * @param {Object} player - RageMP player
 * @param {string} eventName - Unique event identifier
 * @param {number} maxCalls - Max allowed calls in the window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} true if BLOCKED (over limit), false if ALLOWED
 */
function isRateLimited(player, eventName, maxCalls = 5, windowMs = 5000) {
    if (!player || !player.id) return true;
    const key = `${player.id}:${eventName}`;
    const now = Date.now();
    
    let bucket = buckets.get(key);
    if (!bucket || now > bucket.resetTime) {
        bucket = { count: 1, resetTime: now + windowMs };
        buckets.set(key, bucket);
        return false;
    }

    bucket.count++;
    if (bucket.count > maxCalls) {
        return true; // BLOCKED
    }
    return false; // ALLOWED
}

/**
 * Wrap an event handler with rate limiting.
 * If rate-limited, silently drops the event.
 * @param {string} eventName - The event name (for bucket key)
 * @param {Function} handler - The original handler (player, ...args)
 * @param {number} maxCalls - Max calls per window (default 5)
 * @param {number} windowMs - Window in ms (default 5000)
 * @returns {Function} Wrapped handler
 */
function rateLimited(eventName, handler, maxCalls = 5, windowMs = 5000) {
    return function(player, ...args) {
        if (isRateLimited(player, eventName, maxCalls, windowMs)) {
            // Silently drop or optionally warn
            return;
        }
        return handler(player, ...args);
    };
}

// Cleanup stale buckets every 60 seconds
setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
        if (now > bucket.resetTime) buckets.delete(key);
    }
}, 60000);

module.exports = { isRateLimited, rateLimited };
