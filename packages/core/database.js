const mysql = require('mysql2');

// 1. Create a connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',      
    password: '',      
    database: 'rage_trucking_db', 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();

console.log("[Database] Connection pool created.");

module.exports = promisePool;