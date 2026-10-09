/**
 * Safe, Idempotent Database Migration Runner
 * 
 * Inspects information_schema for existing columns and indexes before applying DDL.
 * Safe to execute multiple times or resume after partial execution.
 * Contains ZERO destructive operations (no DROP TABLE, no DROP COLUMN).
 */

const mysql = require('mysql2/promise');
const env = require('../backend/config/env');

/**
 * Check if a column exists on a table in the target database.
 */
async function columnExists(connection, dbName, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
     FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, tableName, columnName]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Check if an index exists on a table in the target database.
 */
async function indexExists(connection, dbName, tableName, indexName) {
  const [rows] = await connection.query(
    `SELECT INDEX_NAME 
     FROM information_schema.STATISTICS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [dbName, tableName, indexName]
  );
  return rows.length > 0;
}

/**
 * Execute all pending safe schema enhancements.
 * 
 * @param {object} [customConnection] Optional existing mysql connection for testing
 * @returns {Promise<{ applied: Array<string>, skipped: Array<string> }>}
 */
async function runMigrations(customConnection = null) {
  console.log('====================================================');
  console.log('🔄 Starting CareerPilot Safe Schema Migration Runner');
  console.log('====================================================');

  let connection = customConnection;
  let shouldClose = false;

  const applied = [];
  const skipped = [];

  try {
    if (!connection) {
      const config = env.db.url
        ? { uri: env.db.url }
        : {
            host: env.db.host,
            port: env.db.port,
            user: env.db.user,
            password: env.db.password,
            database: env.db.name
          };

      if (env.db.ssl) {
        config.ssl = { rejectUnauthorized: env.db.sslRejectUnauthorized };
      }

      connection = await mysql.createConnection(config);
      shouldClose = true;
    }

    // Determine current active database name
    const [dbResult] = await connection.query('SELECT DATABASE() AS currentDb');
    const currentDb = dbResult[0]?.currentDb;

    if (!currentDb) {
      throw new Error('No active database selected for migration.');
    }

    console.log(`📁 Target Database: ${currentDb}`);
    console.log('🔍 Auditing existing schema and applying non-destructive additions...\n');

    // ------------------------------------------------------------------------
    // Step 1: Users Table Enhancements
    // ------------------------------------------------------------------------
    console.log('▶ [1/5] Checking `users` table...');
    const userPassCol = await columnExists(connection, currentDb, 'users', 'password_hash');
    if (!userPassCol) {
      await connection.query('ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL AFTER email');
      applied.push('users.password_hash');
      console.log('  ✅ [APPLIED] Added `password_hash` column to `users`');
    } else {
      skipped.push('users.password_hash');
      console.log('  ⏭️  [SKIPPED] Column `users.password_hash` already exists');
    }

    const userLoginCol = await columnExists(connection, currentDb, 'users', 'last_login');
    if (!userLoginCol) {
      await connection.query('ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL AFTER updated_at');
      applied.push('users.last_login');
      console.log('  ✅ [APPLIED] Added `last_login` column to `users`');
    } else {
      skipped.push('users.last_login');
      console.log('  ⏭️  [SKIPPED] Column `users.last_login` already exists');
    }

    // ------------------------------------------------------------------------
    // Step 2: Candidate Profiles Table Enhancements
    // ------------------------------------------------------------------------
    console.log('\n▶ [2/5] Checking `candidate_profiles` table...');
    const cpQualCol = await columnExists(connection, currentDb, 'candidate_profiles', 'qualification');
    if (!cpQualCol) {
      await connection.query('ALTER TABLE candidate_profiles ADD COLUMN qualification VARCHAR(100) NULL AFTER summary');
      applied.push('candidate_profiles.qualification');
      console.log('  ✅ [APPLIED] Added `qualification` column to `candidate_profiles`');
    } else {
      skipped.push('candidate_profiles.qualification');
      console.log('  ⏭️  [SKIPPED] Column `candidate_profiles.qualification` already exists');
    }

    const cpFieldCol = await columnExists(connection, currentDb, 'candidate_profiles', 'field_of_study');
    if (!cpFieldCol) {
      await connection.query('ALTER TABLE candidate_profiles ADD COLUMN field_of_study VARCHAR(150) NULL AFTER qualification');
      applied.push('candidate_profiles.field_of_study');
      console.log('  ✅ [APPLIED] Added `field_of_study` column to `candidate_profiles`');
    } else {
      skipped.push('candidate_profiles.field_of_study');
      console.log('  ⏭️  [SKIPPED] Column `candidate_profiles.field_of_study` already exists');
    }

    const cpInstCol = await columnExists(connection, currentDb, 'candidate_profiles', 'institution');
    if (!cpInstCol) {
      await connection.query('ALTER TABLE candidate_profiles ADD COLUMN institution VARCHAR(200) NULL AFTER field_of_study');
      applied.push('candidate_profiles.institution');
      console.log('  ✅ [APPLIED] Added `institution` column to `candidate_profiles`');
    } else {
      skipped.push('candidate_profiles.institution');
      console.log('  ⏭️  [SKIPPED] Column `candidate_profiles.institution` already exists');
    }

    const cpYearCol = await columnExists(connection, currentDb, 'candidate_profiles', 'graduation_year');
    if (!cpYearCol) {
      await connection.query('ALTER TABLE candidate_profiles ADD COLUMN graduation_year INT NULL AFTER institution');
      applied.push('candidate_profiles.graduation_year');
      console.log('  ✅ [APPLIED] Added `graduation_year` column to `candidate_profiles`');
    } else {
      skipped.push('candidate_profiles.graduation_year');
      console.log('  ⏭️  [SKIPPED] Column `candidate_profiles.graduation_year` already exists');
    }

    const cpLegacyCol = await columnExists(connection, currentDb, 'candidate_profiles', 'is_legacy');
    if (!cpLegacyCol) {
      await connection.query('ALTER TABLE candidate_profiles ADD COLUMN is_legacy BOOLEAN NOT NULL DEFAULT FALSE AFTER graduation_year');
      applied.push('candidate_profiles.is_legacy');
      console.log('  ✅ [APPLIED] Added `is_legacy` column to `candidate_profiles`');
    } else {
      skipped.push('candidate_profiles.is_legacy');
      console.log('  ⏭️  [SKIPPED] Column `candidate_profiles.is_legacy` already exists');
    }

    // ------------------------------------------------------------------------
    // Step 3: Candidate Skills Table Enhancements
    // ------------------------------------------------------------------------
    console.log('\n▶ [3/5] Checking `candidate_skills` table...');
    const csProfCol = await columnExists(connection, currentDb, 'candidate_skills', 'proficiency_level');
    if (csProfCol && !csProfCol.COLUMN_TYPE.includes("'Not specified'")) {
      await connection.query(
        "ALTER TABLE candidate_skills MODIFY COLUMN proficiency_level ENUM('Not specified', 'Beginner', 'Intermediate', 'Advanced', 'Expert') NOT NULL DEFAULT 'Not specified'"
      );
      applied.push('candidate_skills.proficiency_level_enum');
      console.log("  ✅ [APPLIED] Updated `proficiency_level` ENUM to include 'Not specified' as default");
    } else {
      skipped.push('candidate_skills.proficiency_level_enum');
      console.log("  ⏭️  [SKIPPED] `candidate_skills.proficiency_level` already supports 'Not specified'");
    }

    const csYearsCol = await columnExists(connection, currentDb, 'candidate_skills', 'years_of_experience');
    if (csYearsCol && (csYearsCol.IS_NULLABLE === 'NO' || csYearsCol.COLUMN_DEFAULT !== null)) {
      await connection.query(
        'ALTER TABLE candidate_skills MODIFY COLUMN years_of_experience DECIMAL(3, 1) NULL DEFAULT NULL'
      );
      applied.push('candidate_skills.years_nullable');
      console.log('  ✅ [APPLIED] Altered `candidate_skills.years_of_experience` to allow NULL and default to NULL');
    } else {
      skipped.push('candidate_skills.years_nullable');
      console.log('  ⏭️  [SKIPPED] `candidate_skills.years_of_experience` is already nullable with default NULL');
    }

    // ------------------------------------------------------------------------
    // Step 4: Jobs Table Enhancements
    // ------------------------------------------------------------------------
    console.log('\n▶ [4/5] Checking `jobs` table...');
    const jobExtCol = await columnExists(connection, currentDb, 'jobs', 'is_external');
    if (!jobExtCol) {
      await connection.query('ALTER TABLE jobs ADD COLUMN is_external BOOLEAN NOT NULL DEFAULT FALSE AFTER status');
      applied.push('jobs.is_external');
      console.log('  ✅ [APPLIED] Added `is_external` column to `jobs`');
    } else {
      skipped.push('jobs.is_external');
      console.log('  ⏭️  [SKIPPED] Column `jobs.is_external` already exists');
    }

    const jobExtIdCol = await columnExists(connection, currentDb, 'jobs', 'external_id');
    if (!jobExtIdCol) {
      await connection.query('ALTER TABLE jobs ADD COLUMN external_id VARCHAR(100) NULL AFTER is_external');
      applied.push('jobs.external_id');
      console.log('  ✅ [APPLIED] Added `external_id` column to `jobs`');
    } else {
      skipped.push('jobs.external_id');
      console.log('  ⏭️  [SKIPPED] Column `jobs.external_id` already exists');
    }

    const jobSrcCol = await columnExists(connection, currentDb, 'jobs', 'source_name');
    if (!jobSrcCol) {
      await connection.query('ALTER TABLE jobs ADD COLUMN source_name VARCHAR(100) NULL AFTER external_id');
      applied.push('jobs.source_name');
      console.log('  ✅ [APPLIED] Added `source_name` column to `jobs`');
    } else {
      skipped.push('jobs.source_name');
      console.log('  ⏭️  [SKIPPED] Column `jobs.source_name` already exists');
    }

    const jobUrlCol = await columnExists(connection, currentDb, 'jobs', 'original_url');
    if (!jobUrlCol) {
      await connection.query('ALTER TABLE jobs ADD COLUMN original_url TEXT NULL AFTER source_name');
      applied.push('jobs.original_url');
      console.log('  ✅ [APPLIED] Added `original_url` column to `jobs`');
    } else {
      skipped.push('jobs.original_url');
      console.log('  ⏭️  [SKIPPED] Column `jobs.original_url` already exists');
    }

    // ------------------------------------------------------------------------
    // Step 5: Index Additions (Safe & Idempotent)
    // ------------------------------------------------------------------------
    console.log('\n▶ [5/5] Checking query performance indexes...');
    const jobsUserIdx = await indexExists(connection, currentDb, 'jobs', 'idx_jobs_user');
    if (!jobsUserIdx) {
      await connection.query('ALTER TABLE jobs ADD INDEX idx_jobs_user (user_id)');
      applied.push('index:jobs.idx_jobs_user');
      console.log('  ✅ [APPLIED] Created index `idx_jobs_user` on `jobs(user_id)`');
    } else {
      skipped.push('index:jobs.idx_jobs_user');
      console.log('  ⏭️  [SKIPPED] Index `idx_jobs_user` on `jobs` already exists');
    }

    const cpUserIdx = await indexExists(connection, currentDb, 'candidate_profiles', 'idx_cp_user');
    if (!cpUserIdx) {
      await connection.query('ALTER TABLE candidate_profiles ADD INDEX idx_cp_user (user_id)');
      applied.push('index:candidate_profiles.idx_cp_user');
      console.log('  ✅ [APPLIED] Created index `idx_cp_user` on `candidate_profiles(user_id)`');
    } else {
      skipped.push('index:candidate_profiles.idx_cp_user');
      console.log('  ⏭️  [SKIPPED] Index `idx_cp_user` on `candidate_profiles` already exists');
    }

    const arUserIdx = await indexExists(connection, currentDb, 'agent_runs', 'idx_ar_user');
    if (!arUserIdx) {
      await connection.query('ALTER TABLE agent_runs ADD INDEX idx_ar_user (user_id)');
      applied.push('index:agent_runs.idx_ar_user');
      console.log('  ✅ [APPLIED] Created index `idx_ar_user` on `agent_runs(user_id)`');
    } else {
      skipped.push('index:agent_runs.idx_ar_user');
      console.log('  ⏭️  [SKIPPED] Index `idx_ar_user` on `agent_runs` already exists');
    }

    console.log('\n====================================================');
    console.log(`🎉 Migration Completed Successfully!`);
    console.log(`   Applied additions: ${applied.length}`);
    console.log(`   Skipped existing:  ${skipped.length}`);
    console.log('====================================================\n');

    return { applied, skipped };
  } catch (error) {
    console.error('\n❌ Migration failed with error:', error.message);
    throw error;
  } finally {
    if (shouldClose && connection) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  runMigrations,
  columnExists,
  indexExists
};
