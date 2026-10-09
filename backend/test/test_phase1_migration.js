/**
 * Phase 1 Database Migration & Safety Verification Suite
 * 
 * Tests against an isolated disposable local database instance:
 * 1. Schema evolution (new columns and indexes created properly).
 * 2. Idempotency (safe resumption after partial/duplicate execution).
 * 3. Preservation of legitimate user records and custom skill proficiencies.
 * 4. Audit preview accuracy (detects only onboarding default signatures).
 * 5. Explicit human confirmation guard on targeted skill corrections.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');
const mysql = require('mysql2/promise');
const { runMigrations, columnExists, indexExists } = require('../../database/migrate');
const { previewSkillMigration } = require('../../database/preview_migration');
const { migrateCandidateSkills } = require('../../database/migrate_skills');

const TEST_PORT = 3307;
const TEST_DB = 'careerpilot_phase1_test_db';
const MYSQLD_PATH = 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqld.exe';

/**
 * Ensures an isolated disposable MySQL test server is running on TEST_PORT.
 */
async function ensureDisposableServer() {
  // First, check if server is already running on TEST_PORT
  try {
    const testConn = await mysql.createConnection({
      host: '127.0.0.1',
      port: TEST_PORT,
      user: 'root',
      password: '',
      connectTimeout: 1000
    });
    await testConn.end();
    return { cleanup: async () => {} };
  } catch {
    // Need to spin up disposable instance
  }

  if (!fs.existsSync(MYSQLD_PATH)) {
    throw new Error(`MySQL daemon not found at ${MYSQLD_PATH} to spin up disposable test database.`);
  }

  const tempDatadir = path.join(os.tmpdir(), `mysql_disposable_${Date.now()}`);
  if (fs.existsSync(tempDatadir)) {
    fs.rmSync(tempDatadir, { recursive: true, force: true });
  }

  console.log('⚡ Initializing isolated disposable MySQL test instance...');
  execSync(`"${MYSQLD_PATH}" --initialize-insecure --datadir="${tempDatadir}" --console`, { stdio: 'ignore' });

  console.log(`⚡ Spawning disposable MySQL test server on port ${TEST_PORT}...`);
  const child = spawn(MYSQLD_PATH, [
    `--datadir=${tempDatadir}`,
    `--port=${TEST_PORT}`,
    '--console'
  ], { stdio: 'ignore' });

  // Poll connection until ready (up to 15s)
  let ready = false;
  const start = Date.now();
  while (!ready && Date.now() - start < 15000) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const probe = await mysql.createConnection({
        host: '127.0.0.1',
        port: TEST_PORT,
        user: 'root',
        password: '',
        connectTimeout: 1000
      });
      await probe.end();
      ready = true;
    } catch {
      // retry
    }
  }

  if (!ready) {
    child.kill();
    throw new Error('Failed to connect to spawned disposable MySQL server within 15 seconds.');
  }

  return {
    cleanup: async () => {
      console.log('🧹 Terminating disposable MySQL test server...');
      child.kill();
      await new Promise(r => setTimeout(r, 1000));
      try {
        fs.rmSync(tempDatadir, { recursive: true, force: true });
      } catch {
        // ignore on Windows if handles close asynchronously
      }
    }
  };
}

async function runPhase1Tests() {
  console.log('====================================================');
  console.log('🧪 Starting CareerPilot Phase 1 Migration Verification');
  console.log(`📡 Disposable Database: ${TEST_DB} @ 127.0.0.1:${TEST_PORT}`);
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(testName, condition, detail = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} - ${detail}`);
      failed++;
    }
  }

  const { cleanup } = await ensureDisposableServer();

  let rootConn;
  try {
    rootConn = await mysql.createConnection({
      host: '127.0.0.1',
      port: TEST_PORT,
      user: 'root',
      password: '',
      multipleStatements: true
    });

    // ------------------------------------------------------------------------
    // Setup Disposable Test Database
    // ------------------------------------------------------------------------
    console.log('▶ 1. Setting up fresh disposable database schema...');
    await rootConn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    await rootConn.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await rootConn.query(`USE \`${TEST_DB}\``);

    // Load initial schema.sql (as it existed prior to migration)
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const initialSchemaSql = fs.readFileSync(schemaPath, 'utf8');
    await rootConn.query(initialSchemaSql);
    assert('Initial schema loaded successfully', true);

    // ------------------------------------------------------------------------
    // Insert Test Data: Legitimate User vs Default Onboarding User
    // ------------------------------------------------------------------------
    console.log('\n▶ 2. Populating test users and skills...');

    // User A: Legitimate candidate with custom skills & custom experience
    const [userARes] = await rootConn.query(
      "INSERT INTO users (name, email) VALUES ('Custom User', 'custom@example.com')"
    );
    const userAId = userARes.insertId;

    const [cpARes] = await rootConn.query(`
      INSERT INTO candidate_profiles (user_id, headline, summary, education, experience_years)
      VALUES (?, 'Senior Full Stack Engineer', 'Seasoned engineer with custom background', 'B.Tech IT', 5.0)
    `, [userAId]);
    const cpAId = cpARes.insertId;

    // Query standard taxonomy skills populated by schema.sql
    async function getSkillId(name) {
      const [rows] = await rootConn.query('SELECT id FROM skills WHERE name = ?', [name]);
      return rows[0]?.id;
    }

    const s1Id = await getSkillId('React');
    const s2Id = await getSkillId('TypeScript');
    const s3Id = await getSkillId('Python');
    const s4Id = await getSkillId('SQL');

    // User A skills: Diverse, legitimate custom values
    await rootConn.query(`
      INSERT INTO candidate_skills (candidate_id, skill_id, proficiency_level, years_of_experience) VALUES
      (?, ?, 'Advanced', 4.0),
      (?, ?, 'Intermediate', 2.0)
    `, [cpAId, s1Id, cpAId, s2Id]);

    // User B: Candidate whose profile was generated with the onboarding default signature:
    // (all skills have proficiency_level = 'Advanced' and years_of_experience = 2.5)
    const [userBRes] = await rootConn.query(
      "INSERT INTO users (name, email) VALUES ('Default Onboarded User', 'default@example.com')"
    );
    const userBId = userBRes.insertId;

    const [cpBRes] = await rootConn.query(`
      INSERT INTO candidate_profiles (user_id, headline, summary, education, experience_years)
      VALUES (?, 'Junior Python Developer', 'Fresher', 'BCA', 0.0)
    `, [userBId]);
    const cpBId = cpBRes.insertId;

    await rootConn.query(`
      INSERT INTO candidate_skills (candidate_id, skill_id, proficiency_level, years_of_experience) VALUES
      (?, ?, 'Advanced', 2.5),
      (?, ?, 'Advanced', 2.5)
    `, [cpBId, s3Id, cpBId, s4Id]);

    assert('Test dataset established (User A with custom data, User B with default signature)', true);

    // ------------------------------------------------------------------------
    // Step 3: Run Safe Schema Migration
    // ------------------------------------------------------------------------
    console.log('\n▶ 3. Executing safe migration runner (migrate.js)...');
    const migrationResult1 = await runMigrations(rootConn);

    assert('Migration executed without errors', Boolean(migrationResult1));
    assert('Applied additions count > 0', migrationResult1.applied.length >= 10);

    // Verify Column Existence & Definitions
    console.log('\n▶ 4. Verifying column definitions and attributes in information_schema...');
    const userPassCol = await columnExists(rootConn, TEST_DB, 'users', 'password_hash');
    assert('Column users.password_hash exists', userPassCol !== null);
    assert('Column users.password_hash is nullable', userPassCol?.IS_NULLABLE === 'YES');

    const userLoginCol = await columnExists(rootConn, TEST_DB, 'users', 'last_login');
    assert('Column users.last_login exists', userLoginCol !== null);

    const cpQualCol = await columnExists(rootConn, TEST_DB, 'candidate_profiles', 'qualification');
    assert('Column candidate_profiles.qualification exists', cpQualCol !== null);

    const cpFieldCol = await columnExists(rootConn, TEST_DB, 'candidate_profiles', 'field_of_study');
    assert('Column candidate_profiles.field_of_study exists', cpFieldCol !== null);

    const cpInstCol = await columnExists(rootConn, TEST_DB, 'candidate_profiles', 'institution');
    assert('Column candidate_profiles.institution exists', cpInstCol !== null);

    const cpYearCol = await columnExists(rootConn, TEST_DB, 'candidate_profiles', 'graduation_year');
    assert('Column candidate_profiles.graduation_year exists', cpYearCol !== null);

    const cpLegacyCol = await columnExists(rootConn, TEST_DB, 'candidate_profiles', 'is_legacy');
    assert('Column candidate_profiles.is_legacy exists', cpLegacyCol !== null);

    const csProfCol = await columnExists(rootConn, TEST_DB, 'candidate_skills', 'proficiency_level');
    assert("Column candidate_skills.proficiency_level enum includes 'Not specified'", csProfCol?.COLUMN_TYPE.includes("'Not specified'"));
    assert("Column candidate_skills.proficiency_level default is 'Not specified'", csProfCol?.COLUMN_DEFAULT === 'Not specified');

    const csYearsCol = await columnExists(rootConn, TEST_DB, 'candidate_skills', 'years_of_experience');
    assert('Column candidate_skills.years_of_experience is nullable', csYearsCol?.IS_NULLABLE === 'YES');
    assert('Column candidate_skills.years_of_experience defaults to NULL', csYearsCol?.COLUMN_DEFAULT === null);

    const jobExtCol = await columnExists(rootConn, TEST_DB, 'jobs', 'is_external');
    assert('Column jobs.is_external exists', jobExtCol !== null);

    const jobExtIdCol = await columnExists(rootConn, TEST_DB, 'jobs', 'external_id');
    assert('Column jobs.external_id exists', jobExtIdCol !== null);

    const jobSrcCol = await columnExists(rootConn, TEST_DB, 'jobs', 'source_name');
    assert('Column jobs.source_name exists', jobSrcCol !== null);

    const jobUrlCol = await columnExists(rootConn, TEST_DB, 'jobs', 'original_url');
    assert('Column jobs.original_url exists', jobUrlCol !== null);

    // Verify Index Existence
    console.log('\n▶ 5. Verifying query performance indexes in information_schema...');
    const jobsUserIdx = await indexExists(rootConn, TEST_DB, 'jobs', 'idx_jobs_user');
    assert('Index idx_jobs_user exists on jobs', jobsUserIdx === true);

    const cpUserIdx = await indexExists(rootConn, TEST_DB, 'candidate_profiles', 'idx_cp_user');
    assert('Index idx_cp_user exists on candidate_profiles', cpUserIdx === true);

    const arUserIdx = await indexExists(rootConn, TEST_DB, 'agent_runs', 'idx_ar_user');
    assert('Index idx_ar_user exists on agent_runs', arUserIdx === true);

    // ------------------------------------------------------------------------
    // Step 6: Test Idempotency (Safe Partial / Duplicate Runs)
    // ------------------------------------------------------------------------
    console.log('\n▶ 6. Testing migration runner idempotence (re-running on migrated DB)...');
    const migrationResult2 = await runMigrations(rootConn);

    assert('Second run executed without error', Boolean(migrationResult2));
    assert('Second run applied zero changes (all skipped)', migrationResult2.applied.length === 0);
    assert('Second run skipped existing items', migrationResult2.skipped.length >= 10);

    // ------------------------------------------------------------------------
    // Step 7: Verify Non-Destructive Audit Preview Utility
    // ------------------------------------------------------------------------
    console.log('\n▶ 7. Verifying preview_migration.js audit detection...');
    const previewResult = await previewSkillMigration(rootConn);

    assert('Preview reports exactly 1 matching profile (User B)', previewResult.matchingProfiles.length === 1);
    assert('Preview identifies User B candidateId correctly', previewResult.matchingProfiles[0]?.candidateId === cpBId);
    assert('Preview leaves User A (custom data) unflagged', !previewResult.matchingProfiles.some(p => p.candidateId === cpAId));

    // Verify that preview did NOT modify any database records
    const [skillsCheck1] = await rootConn.query('SELECT proficiency_level, years_of_experience FROM candidate_skills WHERE candidate_id = ?', [cpBId]);
    assert('Preview did not mutate candidate B records (still Advanced / 2.5)', skillsCheck1.every(s => s.proficiency_level === 'Advanced' && Number(s.years_of_experience) === 2.5));

    // ------------------------------------------------------------------------
    // Step 8: Verify Targeted Skill Migration with Confirmation Guard
    // ------------------------------------------------------------------------
    console.log('\n▶ 8. Verifying targeted skill migration & safety guards...');

    // Attempt without confirmation -> must throw
    let unconfirmedError = null;
    try {
      await migrateCandidateSkills(rootConn, cpBId, false);
    } catch (err) {
      unconfirmedError = err.message;
    }
    assert('Targeted migration rejects unconfirmed execution', Boolean(unconfirmedError));

    // Attempt with nonexistent candidate -> must throw
    let notFoundError = null;
    try {
      await migrateCandidateSkills(rootConn, 99999, true);
    } catch (err) {
      notFoundError = err.message;
    }
    assert('Targeted migration rejects invalid candidate ID', Boolean(notFoundError));

    // Execute with explicit confirmation for User B
    const updateResult = await migrateCandidateSkills(rootConn, cpBId, true);
    assert('Targeted update reported 2 affected rows for candidate B', updateResult.updatedCount === 2);

    // Verify User B's skills were updated to 'Not specified' and NULL
    const [skillsBAfter] = await rootConn.query(
      'SELECT s.name, cs.proficiency_level, cs.years_of_experience FROM candidate_skills cs JOIN skills s ON cs.skill_id = s.id WHERE cs.candidate_id = ?',
      [cpBId]
    );
    assert("User B skills proficiency updated to 'Not specified'", skillsBAfter.every(s => s.proficiency_level === 'Not specified'));
    assert('User B skills years_of_experience updated to NULL', skillsBAfter.every(s => s.years_of_experience === null));

    // ------------------------------------------------------------------------
    // Step 9: Verify Preservation of Legitimate User A Records
    // ------------------------------------------------------------------------
    console.log('\n▶ 9. Verifying preservation of legitimate User A data...');
    const [skillsAAfter] = await rootConn.query(
      'SELECT s.name, cs.proficiency_level, cs.years_of_experience FROM candidate_skills cs JOIN skills s ON cs.skill_id = s.id WHERE cs.candidate_id = ? ORDER BY s.name ASC',
      [cpAId]
    );

    assert('User A still has exactly 2 skills', skillsAAfter.length === 2);
    assert("User A skill 'React' preserved as 'Advanced' and 4.0 years", skillsAAfter[0].name === 'React' && skillsAAfter[0].proficiency_level === 'Advanced' && Number(skillsAAfter[0].years_of_experience) === 4.0);
    assert("User A skill 'TypeScript' preserved as 'Intermediate' and 2.0 years", skillsAAfter[1].name === 'TypeScript' && skillsAAfter[1].proficiency_level === 'Intermediate' && Number(skillsAAfter[1].years_of_experience) === 2.0);

    const [userACheck] = await rootConn.query('SELECT name, email FROM users WHERE id = ?', [userAId]);
    assert("User A user record preserved", userACheck[0].email === 'custom@example.com');

    // ------------------------------------------------------------------------
    // Clean up Disposable Database
    // ------------------------------------------------------------------------
    console.log('\n▶ 10. Cleaning up disposable test database...');
    await rootConn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    assert('Disposable test database cleanly dropped after verification', true);

    console.log('\n====================================================');
    console.log(`Phase 1 Migration Suite Results: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Phase 1 test suite failure:', err);
    process.exit(1);
  } finally {
    if (rootConn) {
      await rootConn.end();
    }
    await cleanup();
  }
}

if (require.main === module) {
  runPhase1Tests()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  runPhase1Tests
};
