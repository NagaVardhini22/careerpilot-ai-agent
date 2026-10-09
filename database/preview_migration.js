/**
 * Non-Destructive Skill-Migration Preview Utility
 * 
 * Audits candidate skills in the database to identify profiles where
 * every recorded skill systematically exhibits the onboarding default signature:
 * (proficiency_level = 'Advanced' AND years_of_experience = 2.5).
 * 
 * READ-ONLY: Never alters, modifies, or drops any database records.
 */

const mysql = require('mysql2/promise');
const env = require('../backend/config/env');

/**
 * Preview candidate profiles and skills affected by artificial onboarding defaults.
 * 
 * @param {object} [customConnection] Optional existing mysql connection
 * @returns {Promise<{ matchingProfiles: Array<object>, totalAudited: number }>}
 */
async function previewSkillMigration(customConnection = null) {
  console.log('====================================================');
  console.log('🔍 CareerPilot Candidate Skill Data Migration Preview');
  console.log('   (READ-ONLY AUDIT — ZERO RECORDS MODIFIED)');
  console.log('====================================================\n');

  let connection = customConnection;
  let shouldClose = false;

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

    // 1. Audit total candidate profiles and skills
    const [totalRows] = await connection.query(
      'SELECT COUNT(DISTINCT cp.id) AS totalProfiles, COUNT(cs.id) AS totalSkills FROM candidate_profiles cp LEFT JOIN candidate_skills cs ON cp.id = cs.candidate_id'
    );
    const totalProfiles = totalRows[0]?.totalProfiles || 0;
    const totalSkills = totalRows[0]?.totalSkills || 0;

    console.log(`📊 Total Candidate Profiles in Database: ${totalProfiles}`);
    console.log(`📊 Total Skill Associations in Database: ${totalSkills}\n`);

    // 2. Identify candidate profiles where EVERY skill matches Advanced + 2.5
    const [matchingRows] = await connection.query(`
      SELECT 
        cp.id AS candidate_id,
        u.id AS user_id,
        u.name AS user_name,
        u.email AS user_email,
        COUNT(cs.id) AS total_skills,
        SUM(cs.proficiency_level = 'Advanced' AND cs.years_of_experience = 2.5) AS default_count
      FROM candidate_profiles cp
      JOIN users u ON cp.user_id = u.id
      JOIN candidate_skills cs ON cp.id = cs.candidate_id
      GROUP BY cp.id, u.id, u.name, u.email
      HAVING total_skills > 0 AND default_count = total_skills
    `);

    if (matchingRows.length === 0) {
      console.log('✅ No candidate profiles detected with the 100% artificial default signature.');
      console.log('   Either all skills have been customized, or no candidate profiles exist.\n');
      return { matchingProfiles: [], totalAudited: totalProfiles };
    }

    console.log(`⚠️  Detected ${matchingRows.length} candidate profile(s) matching the artificial onboarding signature:\n`);

    const previewData = [];

    for (const profile of matchingRows) {
      const [skillRows] = await connection.query(`
        SELECT s.name AS skill_name, cs.proficiency_level, cs.years_of_experience
        FROM candidate_skills cs
        JOIN skills s ON cs.skill_id = s.id
        WHERE cs.candidate_id = ?
        ORDER BY s.name ASC
      `, [profile.candidate_id]);

      previewData.push({
        candidateId: profile.candidate_id,
        userName: profile.user_name,
        userEmail: profile.user_email,
        skillCount: profile.total_skills,
        skills: skillRows.map(r => `${r.skill_name} (${r.proficiency_level}, ${r.years_of_experience}y)`)
      });

      console.log(`----------------------------------------------------`);
      console.log(`Candidate ID:   #${profile.candidate_id}`);
      console.log(`Candidate Name: ${profile.user_name} <${profile.user_email}>`);
      console.log(`Total Skills:   ${profile.total_skills}`);
      console.log(`Skills Audit:`);
      skillRows.forEach(s => {
        console.log(`  • ${s.skill_name.padEnd(20)} Current: [${s.proficiency_level}, ${s.years_of_experience} yrs] -> Proposed: [Not specified, NULL]`);
      });
      console.log(`----------------------------------------------------`);
    }

    console.log('\n====================================================');
    console.log('📋 AUDIT SUMMARY & SAFETY INSTRUCTIONS');
    console.log('====================================================');
    console.log('• DO NOT reset records indiscriminately.');
    console.log('• Custom user-entered proficiencies or experience must remain intact.');
    console.log('• To update only a confirmed artificial profile after human verification, run:');
    console.log('    node database/migrate_skills.js --candidate-id=<ID> --confirm');
    console.log('====================================================\n');

    return { matchingProfiles: previewData, totalAudited: totalProfiles };
  } catch (error) {
    console.error('\n❌ Preview audit failed with error:', error.message);
    throw error;
  } finally {
    if (shouldClose && connection) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  previewSkillMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  previewSkillMigration
};
