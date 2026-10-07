/**
 * Candidate Profile Service
 * Handles profile retrieval, creation (onboarding), updates, and skill catalog querying.
 */

const db = require('../config/db');

/**
 * Retrieve the active candidate profile (or null if none exists)
 */
async function getActiveProfile(candidateId = null) {
  let profileRows;
  if (candidateId) {
    profileRows = await db.query(
      `SELECT cp.id, cp.user_id, u.name, u.email, cp.headline, cp.summary, 
              cp.education, cp.experience_years, cp.created_at, cp.updated_at
       FROM candidate_profiles cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.id = ?`,
      [candidateId]
    );
  } else {
    profileRows = await db.query(
      `SELECT cp.id, cp.user_id, u.name, u.email, cp.headline, cp.summary, 
              cp.education, cp.experience_years, cp.created_at, cp.updated_at
       FROM candidate_profiles cp
       JOIN users u ON cp.user_id = u.id
       ORDER BY cp.id ASC LIMIT 1`
    );
  }

  if (!profileRows || profileRows.length === 0) {
    return null;
  }

  const profile = profileRows[0];

  // Retrieve candidate skills
  const skillsRows = await db.query(
    `SELECT s.id, s.name, s.category, cs.proficiency_level, cs.years_of_experience
     FROM candidate_skills cs
     JOIN skills s ON cs.skill_id = s.id
     WHERE cs.candidate_id = ?
     ORDER BY s.category, cs.years_of_experience DESC`,
    [profile.id]
  );

  return {
    id: profile.id,
    userId: profile.user_id,
    name: profile.name,
    email: profile.email,
    headline: profile.headline,
    summary: profile.summary,
    education: profile.education,
    experienceYears: parseFloat(profile.experience_years),
    skills: skillsRows.map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      proficiency: s.proficiency_level,
      years: parseFloat(s.years_of_experience)
    })),
    createdAt: profile.created_at,
    updatedAt: profile.updated_at
  };
}

/**
 * Create a new candidate profile (Onboarding)
 */
async function createProfile(data) {
  const { name, email, headline, summary, education, experienceYears = 0, skills = [] } = data;

  if (!name || !email) {
    throw new Error('Name and email are required to create a profile.');
  }

  // 1. Create or get user
  let userRows = await db.query('SELECT id FROM users WHERE email = ?', [email.trim()]);
  let userId;
  if (userRows.length > 0) {
    userId = userRows[0].id;
    await db.query('UPDATE users SET name = ? WHERE id = ?', [name.trim(), userId]);
  } else {
    const userInsert = await db.query('INSERT INTO users (name, email) VALUES (?, ?)', [name.trim(), email.trim()]);
    userId = userInsert.insertId;
  }

  // 2. Create candidate profile
  const profileInsert = await db.query(
    `INSERT INTO candidate_profiles (user_id, headline, summary, education, experience_years)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, headline || 'Software Engineer', summary || '', education || '', experienceYears]
  );
  const candidateId = profileInsert.insertId;

  // 3. Map skills
  if (Array.isArray(skills) && skills.length > 0) {
    for (const skillItem of skills) {
      const skillName = typeof skillItem === 'string' ? skillItem.trim() : skillItem.name?.trim();
      const proficiency = skillItem.proficiency || 'Intermediate';
      const years = skillItem.years || 1.0;

      if (!skillName) continue;

      // Find or insert skill into catalog
      let skillRows = await db.query('SELECT id FROM skills WHERE name = ?', [skillName]);
      let skillId;
      if (skillRows.length > 0) {
        skillId = skillRows[0].id;
      } else {
        const category = skillItem.category || 'General';
        const newSkill = await db.query('INSERT INTO skills (name, category) VALUES (?, ?)', [skillName, category]);
        skillId = newSkill.insertId;
      }

      await db.query(
        `INSERT INTO candidate_skills (candidate_id, skill_id, proficiency_level, years_of_experience)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE proficiency_level = VALUES(proficiency_level), years_of_experience = VALUES(years_of_experience)`,
        [candidateId, skillId, proficiency, years]
      );
    }
  }

  return await getActiveProfile(candidateId);
}

/**
 * Update candidate profile
 */
async function updateProfile(candidateId, data) {
  const { name, headline, summary, education, experienceYears, skills } = data;

  const existing = await getActiveProfile(candidateId);
  if (!existing) {
    throw new Error(`Profile with ID ${candidateId} not found.`);
  }

  if (name) {
    await db.query('UPDATE users SET name = ? WHERE id = ?', [name.trim(), existing.userId]);
  }

  await db.query(
    `UPDATE candidate_profiles 
     SET headline = COALESCE(?, headline),
         summary = COALESCE(?, summary),
         education = COALESCE(?, education),
         experience_years = COALESCE(?, experience_years)
     WHERE id = ?`,
    [headline, summary, education, experienceYears, candidateId]
  );

  // If skills provided, re-sync candidate skills
  if (Array.isArray(skills)) {
    await db.query('DELETE FROM candidate_skills WHERE candidate_id = ?', [candidateId]);
    for (const skillItem of skills) {
      const skillName = typeof skillItem === 'string' ? skillItem.trim() : skillItem.name?.trim();
      const proficiency = skillItem.proficiency || 'Intermediate';
      const years = skillItem.years || 1.0;

      if (!skillName) continue;

      let skillRows = await db.query('SELECT id FROM skills WHERE name = ?', [skillName]);
      let skillId;
      if (skillRows.length > 0) {
        skillId = skillRows[0].id;
      } else {
        const category = skillItem.category || 'General';
        const newSkill = await db.query('INSERT INTO skills (name, category) VALUES (?, ?)', [skillName, category]);
        skillId = newSkill.insertId;
      }

      await db.query(
        `INSERT INTO candidate_skills (candidate_id, skill_id, proficiency_level, years_of_experience)
         VALUES (?, ?, ?, ?)`,
        [candidateId, skillId, proficiency, years]
      );
    }
  }

  return await getActiveProfile(candidateId);
}

/**
 * Get all available taxonomy skills
 */
async function getAllSkills() {
  const rows = await db.query('SELECT id, name, category FROM skills ORDER BY category, name ASC');
  return rows;
}

module.exports = {
  getActiveProfile,
  createProfile,
  updateProfile,
  getAllSkills
};
