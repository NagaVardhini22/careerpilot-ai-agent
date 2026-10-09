/**
 * Targeted Candidate Skill Migration Utility
 * 
 * Updates artificially populated candidate skills to:
 *   proficiency_level = 'Not specified'
 *   years_of_experience = NULL
 * 
 * SAFETY GUARD:
 * - Does NOT perform bulk indiscriminate updates.
 * - Requires explicit specification of the candidate profile ID.
 * - Requires explicit confirmation flag (--confirm).
 * - Leaves unconfirmed profiles and custom user skills untouched.
 * 
 * Usage:
 *   node database/migrate_skills.js --candidate-id=1 --confirm
 */

const mysql = require('mysql2/promise');
const env = require('../backend/config/env');

/**
 * Migrate skills for a specific verified candidate profile.
 * 
 * @param {object} connection Active mysql2 connection
 * @param {number} candidateId The candidate profile ID to update
 * @param {boolean} confirmed Explicit confirmation boolean
 * @returns {Promise<{ updatedCount: number, candidateId: number }>}
 */
async function migrateCandidateSkills(connection, candidateId, confirmed = false) {
  if (!candidateId || isNaN(candidateId)) {
    throw new Error('A valid numeric candidate profile ID must be specified.');
  }

  if (!confirmed) {
    throw new Error('Explicit confirmation is required. Pass --confirm to proceed.');
  }

  // 1. Verify candidate profile exists
  const [profileRows] = await connection.query(
    'SELECT cp.id, u.name, u.email FROM candidate_profiles cp JOIN users u ON cp.user_id = u.id WHERE cp.id = ?',
    [candidateId]
  );

  if (profileRows.length === 0) {
    throw new Error(`Candidate profile #${candidateId} not found in database.`);
  }

  const candidate = profileRows[0];
  console.log(`🎯 Targeted Candidate Profile: #${candidate.id} (${candidate.name} <${candidate.email}>)`);

  // 2. Fetch current skills for this candidate
  const [skillsBefore] = await connection.query(`
    SELECT cs.id, s.name, cs.proficiency_level, cs.years_of_experience
    FROM candidate_skills cs
    JOIN skills s ON cs.skill_id = s.id
    WHERE cs.candidate_id = ?
  `, [candidateId]);

  console.log(`🔍 Total skills associated with profile: ${skillsBefore.length}`);

  // 3. Update ONLY skills that have the default signature (Advanced and 2.5) for this candidate
  const [updateResult] = await connection.query(`
    UPDATE candidate_skills
    SET proficiency_level = 'Not specified',
        years_of_experience = NULL
    WHERE candidate_id = ?
      AND proficiency_level = 'Advanced'
      AND years_of_experience = 2.5
  `, [candidateId]);

  const updatedCount = updateResult.affectedRows;
  console.log(`✅ Successfully updated ${updatedCount} artificial skill record(s) to ['Not specified', NULL].`);

  // 4. Report any skills that were preserved
  const preservedCount = skillsBefore.length - updatedCount;
  if (preservedCount > 0) {
    console.log(`🛡️  Preserved ${preservedCount} custom user skill record(s) that did not match the default signature.`);
  }

  return { updatedCount, preservedCount, candidateId };
}

async function cliRunner() {
  const args = process.argv.slice(2);
  let candidateId = null;
  let confirmed = false;

  for (const arg of args) {
    if (arg.startsWith('--candidate-id=')) {
      candidateId = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--confirm') {
      confirmed = true;
    }
  }

  if (!candidateId || !confirmed) {
    console.log('====================================================');
    console.log('⚠️  TARGETED SKILL MIGRATION SAFETY NOTICE');
    console.log('====================================================');
    console.log('This script requires explicit human verification of the affected candidate profile ID.');
    console.log('Indiscriminate bulk resets are strictly prevented.\n');
    console.log('1. First preview the affected candidate profiles:');
    console.log('     node database/preview_migration.js\n');
    console.log('2. Once verified, execute targeted migration for that candidate:');
    console.log('     node database/migrate_skills.js --candidate-id=<ID> --confirm\n');
    console.log('====================================================');
    process.exit(1);
  }

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

  const connection = await mysql.createConnection(config);
  try {
    await migrateCandidateSkills(connection, candidateId, confirmed);
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  cliRunner();
}

module.exports = {
  migrateCandidateSkills
};
