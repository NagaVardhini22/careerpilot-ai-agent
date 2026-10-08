/**
 * Manual Demo / Development Seed Script
 * Explicitly invoked only when the developer or interviewer wishes to load demo data.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function seedDatabase() {
  console.log('🌱 Manually Seeding CareerPilot Demo Data...');

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

    await connection.query(`USE \`${dbName}\``);
    console.log(`📁 Selected database: "${dbName}"`);

    const seedPath = path.join(__dirname, 'seed.sql');
    console.log(`📄 Executing seed script from: ${seedPath}`);
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await connection.query(seedSql);
    console.log('✅ Demo data loaded successfully.');
  } catch (error) {
    console.error('❌ Seeding error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
