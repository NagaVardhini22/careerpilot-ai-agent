/**
 * Candidate Profile Service
 * Handles profile retrieval, creation (onboarding), updates, and skill catalog querying.
 * Enforces per-user data isolation and quarantine of legacy profiles.
 */

const db = require('../config/db');

const ALLOWED_PROFICIENCIES = ['Not specified', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

/**
 * Normalizes input skills into clean structured array.
 * Supports individual entries or comma/semicolon-separated skill strings.
 */
function normalizeSkillsList(skillsInput) {
  if (!skillsInput) return [];
  const normalized = [];
  const rawItems = Array.isArray(skillsInput) ? skillsInput : [skillsInput];

  for (const item of rawItems) {
    if (typeof item === 'string') {
      const splitNames = item.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
      for (const name of splitNames) {
        normalized.push({
          name,
          category: 'General',
          proficiency: 'Not specified',
          years: null
        });
      }
    } else if (typeof item === 'object' && item !== null) {
      const rawName = item.name ? String(item.name).trim() : '';
      if (!rawName) continue;

      const splitNames = rawName.split(/[,;]+/).map(s => s.trim()).filter(Boolean);

      let proficiency = item.proficiency ? String(item.proficiency).trim() : 'Not specified';
      if (!ALLOWED_PROFICIENCIES.includes(proficiency)) {
        throw new Error(`Invalid proficiency level: "${proficiency}". Allowed levels: ${ALLOWED_PROFICIENCIES.join(', ')}`);
      }

      let years = null;
      if (item.years !== undefined && item.years !== null && item.years !== '') {
        const parsed = parseFloat(item.years);
        if (isNaN(parsed) || parsed < 0) {
          throw new Error(`Skill experience years cannot be negative: "${item.years}"`);
        }
        years = parsed;
      }

      for (const name of splitNames) {
        normalized.push({
          name,
          category: item.category || 'General',
          proficiency,
          years
        });
      }
    }
  }

  return normalized;
}

/**
 * Retrieve the candidate profile for the authenticated user (or null if none exists)
 */
async function getActiveProfile(userId, candidateId = null) {
  if (!userId) {
    return null;
  }

  let profileRows;
  if (candidateId) {
    profileRows = await db.query(
      `SELECT cp.id, cp.user_id, u.name, u.email, cp.headline, cp.summary, 
              cp.qualification, cp.field_of_study, cp.institution, cp.graduation_year,
              cp.education, cp.experience_years, cp.created_at, cp.updated_at
       FROM candidate_profiles cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.id = ? AND cp.user_id = ? AND (cp.is_legacy = FALSE OR cp.is_legacy IS NULL)`,
      [candidateId, userId]
    );
  } else {
    profileRows = await db.query(
      `SELECT cp.id, cp.user_id, u.name, u.email, cp.headline, cp.summary, 
              cp.qualification, cp.field_of_study, cp.institution, cp.graduation_year,
              cp.education, cp.experience_years, cp.created_at, cp.updated_at
       FROM candidate_profiles cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.user_id = ? AND (cp.is_legacy = FALSE OR cp.is_legacy IS NULL)
       ORDER BY cp.id DESC LIMIT 1`,
      [userId]
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
    qualification: profile.qualification || null,
    fieldOfStudy: profile.field_of_study || null,
    institution: profile.institution || null,
    graduationYear: profile.graduation_year || null,
    education: profile.education || '',
    experienceYears: profile.experience_years !== null ? parseFloat(profile.experience_years) : null,
    skills: skillsRows.map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      proficiency: s.proficiency_level,
      years: s.years_of_experience !== null ? parseFloat(s.years_of_experience) : null
    })),
    createdAt: profile.created_at,
    updatedAt: profile.updated_at
  };
}

/**
 * Create or initialize a candidate profile for the authenticated user.
 */
async function createProfile(data, authenticatedUserId) {
  if (!authenticatedUserId) {
    throw new Error('Authentication is required to create a candidate profile.');
  }

  const {
    headline,
    summary,
    qualification,
    fieldOfStudy,
    institution,
    graduationYear,
    education,
    experienceYears,
    skills = []
  } = data;

  // Validate numeric fields
  let expYears = null;
  if (experienceYears !== undefined && experienceYears !== null && experienceYears !== '') {
    const parsed = parseFloat(experienceYears);
    if (isNaN(parsed) || parsed < 0) {
      throw new Error('Total experience years cannot be negative.');
    }
    expYears = parsed;
  }

  let gradYear = null;
  if (graduationYear !== undefined && graduationYear !== null && graduationYear !== '') {
    const parsed = parseInt(graduationYear, 10);
    if (isNaN(parsed) || parsed < 1950 || parsed > 2040) {
      throw new Error('Graduation year must be between 1950 and 2040.');
    }
    gradYear = parsed;
  }

  const normalizedSkills = normalizeSkillsList(skills);

  // 1. Verify authenticated user exists
  const userRows = await db.query('SELECT id, name, email FROM users WHERE id = ?', [authenticatedUserId]);
  if (userRows.length === 0) {
    throw new Error('Authenticated user account not found.');
  }

  // 2. Check if user already has an active profile
  const existingProfile = await getActiveProfile(authenticatedUserId);
  let candidateId;

  if (existingProfile) {
    await db.query(
      `UPDATE candidate_profiles
       SET headline = COALESCE(?, headline),
           summary = COALESCE(?, summary),
           qualification = COALESCE(?, qualification),
           field_of_study = COALESCE(?, field_of_study),
           institution = COALESCE(?, institution),
           graduation_year = COALESCE(?, graduation_year),
           education = COALESCE(?, education),
           experience_years = COALESCE(?, experience_years)
       WHERE id = ? AND user_id = ?`,
      [headline, summary, qualification, fieldOfStudy, institution, gradYear, education, expYears, existingProfile.id, authenticatedUserId]
    );
    candidateId = existingProfile.id;
  } else {
    const profileInsert = await db.query(
      `INSERT INTO candidate_profiles
       (user_id, headline, summary, qualification, field_of_study, institution, graduation_year, education, experience_years)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [authenticatedUserId, headline || 'Software Engineer', summary || '', qualification || null, fieldOfStudy || null, institution || null, gradYear, education || '', expYears]
    );
    candidateId = profileInsert.insertId;
  }

  // 3. Map skills
  if (normalizedSkills.length > 0) {
    for (const skillItem of normalizedSkills) {
      let skillRows = await db.query('SELECT id FROM skills WHERE name = ?', [skillItem.name]);
      let skillId;
      if (skillRows.length > 0) {
        skillId = skillRows[0].id;
      } else {
        const newSkill = await db.query('INSERT INTO skills (name, category) VALUES (?, ?)', [skillItem.name, skillItem.category]);
        skillId = newSkill.insertId;
      }

      await db.query(
        `INSERT INTO candidate_skills (candidate_id, skill_id, proficiency_level, years_of_experience)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE proficiency_level = VALUES(proficiency_level), years_of_experience = VALUES(years_of_experience)`,
        [candidateId, skillId, skillItem.proficiency, skillItem.years]
      );
    }
  }

  return await getActiveProfile(authenticatedUserId, candidateId);
}

/**
 * Update candidate profile with ownership check
 */
async function updateProfile(candidateId, data, authenticatedUserId) {
  if (!authenticatedUserId) {
    throw new Error('Authentication is required to update a profile.');
  }

  const {
    name,
    headline,
    summary,
    qualification,
    fieldOfStudy,
    institution,
    graduationYear,
    education,
    experienceYears,
    skills
  } = data;

  const existing = await getActiveProfile(authenticatedUserId, candidateId);
  if (!existing || existing.userId !== authenticatedUserId) {
    throw new Error(`Profile #${candidateId} not found or access denied.`);
  }

  if (name && name.trim()) {
    await db.query('UPDATE users SET name = ? WHERE id = ?', [name.trim(), authenticatedUserId]);
  }

  let expYears = undefined;
  if (experienceYears !== undefined) {
    if (experienceYears === null || experienceYears === '') {
      expYears = null;
    } else {
      const parsed = parseFloat(experienceYears);
      if (isNaN(parsed) || parsed < 0) {
        throw new Error('Total experience years cannot be negative.');
      }
      expYears = parsed;
    }
  }

  let gradYear = undefined;
  if (graduationYear !== undefined) {
    if (graduationYear === null || graduationYear === '') {
      gradYear = null;
    } else {
      const parsed = parseInt(graduationYear, 10);
      if (isNaN(parsed) || parsed < 1950 || parsed > 2040) {
        throw new Error('Graduation year must be between 1950 and 2040.');
      }
      gradYear = parsed;
    }
  }

  await db.query(
    `UPDATE candidate_profiles 
     SET headline = COALESCE(?, headline),
         summary = COALESCE(?, summary),
         qualification = CASE WHEN ? IS NOT NULL THEN ? ELSE qualification END,
         field_of_study = CASE WHEN ? IS NOT NULL THEN ? ELSE field_of_study END,
         institution = CASE WHEN ? IS NOT NULL THEN ? ELSE institution END,
         graduation_year = CASE WHEN ? IS NOT NULL THEN ? ELSE graduation_year END,
         education = COALESCE(?, education),
         experience_years = CASE WHEN ? IS NOT NULL THEN ? ELSE experience_years END
     WHERE id = ? AND user_id = ?`,
    [
      headline,
      summary,
      qualification !== undefined ? qualification : null,
      qualification !== undefined ? qualification : null,
      fieldOfStudy !== undefined ? fieldOfStudy : null,
      fieldOfStudy !== undefined ? fieldOfStudy : null,
      institution !== undefined ? institution : null,
      institution !== undefined ? institution : null,
      gradYear !== undefined ? gradYear : null,
      gradYear !== undefined ? gradYear : null,
      education,
      expYears !== undefined ? expYears : null,
      expYears !== undefined ? expYears : null,
      candidateId,
      authenticatedUserId
    ]
  );

  // If skills provided, re-sync candidate skills cleanly
  if (skills !== undefined) {
    const normalizedSkills = normalizeSkillsList(skills);
    await db.query('DELETE FROM candidate_skills WHERE candidate_id = ?', [candidateId]);
    for (const skillItem of normalizedSkills) {
      let skillRows = await db.query('SELECT id FROM skills WHERE name = ?', [skillItem.name]);
      let skillId;
      if (skillRows.length > 0) {
        skillId = skillRows[0].id;
      } else {
        const newSkill = await db.query('INSERT INTO skills (name, category) VALUES (?, ?)', [skillItem.name, skillItem.category]);
        skillId = newSkill.insertId;
      }

      await db.query(
        `INSERT INTO candidate_skills (candidate_id, skill_id, proficiency_level, years_of_experience)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE proficiency_level = VALUES(proficiency_level), years_of_experience = VALUES(years_of_experience)`,
        [candidateId, skillId, skillItem.proficiency, skillItem.years]
      );
    }
  }

  return await getActiveProfile(authenticatedUserId, candidateId);
}

/**
 * Retrieve universal skills catalog (Standard taxonomy)
 */
async function getAllSkills() {
  const rows = await db.query('SELECT id, name, category FROM skills ORDER BY category, name');
  return rows;
}

module.exports = {
  getActiveProfile,
  createProfile,
  updateProfile,
  getAllSkills,
  normalizeSkillsList
};
