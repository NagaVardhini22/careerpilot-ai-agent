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

  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  };

  let connection;
  try {
    connection = await mysql.createConnection(config);
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
