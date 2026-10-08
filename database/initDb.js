/**
 * Clean Database Schema Initialization
 * Connects to MySQL and executes ONLY schema.sql.
 * Guarantees a fresh, clean, empty state without hardcoded personal or demo data.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDatabase() {
  console.log('🚀 Initializing CareerPilot Fresh Database (Clean Empty State)...');

  const dbName = process.env.DB_NAME || 'careerpilot_db';
  const ssl = process.env.DB_SSL === 'true' || process.env.MYSQL_SSL === 'true' || false;
  const sslRejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';

  let config;
  if (process.env.DATABASE_URL || process.env.MYSQL_URL) {
    config = {
      uri: process.env.DATABASE_URL || process.env.MYSQL_URL,
      multipleStatements: true
    };
  } else {
    config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    };
  }

  if (ssl) {
    config.ssl = { rejectUnauthorized: sslRejectUnauthorized };
  }

  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to MySQL server.');

    // Ensure database exists if permissions permit, then select it
    try {
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    } catch {
      // Ignored if user lacks CREATE DATABASE privilege on managed cloud service
    }
    await connection.query(`USE \`${dbName}\``);
    console.log(`📁 Selected database: "${dbName}"`);

    // Execute clean schema DDL
    const schemaPath = path.join(__dirname, 'schema.sql');
    console.log(`📄 Executing clean schema from: ${schemaPath}`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await connection.query(schemaSql);
    console.log('✅ Empty database schema ready. (Zero mock users or jobs inserted).');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };
