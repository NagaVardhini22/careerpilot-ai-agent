/**
 * Database Connection Pool
 * Manages connection pooling and executes parameterized SQL queries.
 */

const mysql = require('mysql2/promise');
const env = require('./env');

const poolConfig = env.db.url
  ? {
      uri: env.db.url,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    }
  : {
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.name,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    };

if (env.db.ssl) {
  poolConfig.ssl = {
    rejectUnauthorized: env.db.sslRejectUnauthorized
  };
}

const pool = mysql.createPool(poolConfig);

/**
 * Execute a parameterized SQL query.
 * Always use parameters (?) to prevent SQL injection.
 * 
 * @param {string} sql - SQL query with '?' placeholders
 * @param {Array} params - Array of parameter values
 * @returns {Promise<Array>} - Query results
 */
async function query(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error(`[Database Error] SQL: "${sql}"`, error.message);
    throw error;
  }
}

/**
 * Health check to verify database connectivity.
 */
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}

module.exports = {
  pool,
  query,
  testConnection
};
