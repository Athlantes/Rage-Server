const mysql = require('mysql2');

// 1. Create a connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',      
    password: '',      
    database: 'rage_trucking_db', 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 30000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

// 2. Connection error handling & auto-reconnect
pool.on('error', (err) => {
    console.error('[Database] Pool error:', err.code);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
        console.error('[Database] Connection lost. Pool will auto-reconnect on next query.');
    }
});

// 3. Validate connections stay alive (ping every 30s)
setInterval(() => {
    pool.query('SELECT 1', (err) => {
        if (err) console.error('[Database] Keep-alive ping failed:', err.code);
    });
}, 30000);

const promisePool = pool.promise();

console.log("[Database] Connection pool created with keep-alive & error recovery.");

module.exports = promisePool;