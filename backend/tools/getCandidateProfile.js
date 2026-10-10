/**
 * Tool: getCandidateProfile
 * Purpose: Retrieve candidate's profile, education, skills, and experience.
 */

const db = require('../config/db');

async function getCandidateProfile(args = {}) {
  let candidateId = args.candidateId;
  const userId = args.userId;

  let profileRows;
  if (candidateId) {
    const params = [candidateId];
    let sql = `SELECT cp.id, cp.user_id, u.name, u.email, cp.headline, cp.summary,
              cp.qualification, cp.field_of_study, cp.institution, cp.graduation_year,
              cp.education, cp.experience_years, cp.created_at
       FROM candidate_profiles cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.id = ?`;
    if (userId) {
      sql += ' AND cp.user_id = ?';
      params.push(userId);
    }
    profileRows = await db.query(sql, params);
  } else if (userId) {
    profileRows = await db.query(
      `SELECT cp.id, cp.user_id, u.name, u.email, cp.headline, cp.summary, 
              cp.qualification, cp.field_of_study, cp.institution, cp.graduation_year,
              cp.education, cp.experience_years, cp.created_at
       FROM candidate_profiles cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.user_id = ? AND (cp.is_legacy = FALSE OR cp.is_legacy IS NULL)
       ORDER BY cp.id DESC LIMIT 1`,
      [userId]
    );
  } else {
    // If not specified and no userId provided, get the first active non-legacy profile
    profileRows = await db.query(
      `SELECT cp.id, cp.user_id, u.name, u.email, cp.headline, cp.summary, 
              cp.qualification, cp.field_of_study, cp.institution, cp.graduation_year,
              cp.education, cp.experience_years, cp.created_at
       FROM candidate_profiles cp
       JOIN users u ON cp.user_id = u.id
       WHERE (cp.is_legacy = FALSE OR cp.is_legacy IS NULL)
       ORDER BY cp.id ASC LIMIT 1`
    );
  }

  if (!profileRows || profileRows.length === 0) {
    return {
      exists: false,
      message: 'No candidate profile found in database. The user needs to create a profile first.'
    };
  }

  const profile = profileRows[0];
  candidateId = profile.id;

  // Retrieve candidate skills
  const skillsRows = await db.query(
    `SELECT s.id, s.name, s.category, cs.proficiency_level, cs.years_of_experience
     FROM candidate_skills cs
     JOIN skills s ON cs.skill_id = s.id
     WHERE cs.candidate_id = ?
     ORDER BY s.category, cs.years_of_experience DESC`,
    [candidateId]
  );

  return {
    exists: true,
    candidateId: profile.id,
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
    skillsCount: skillsRows.length,
    skills: skillsRows.map(s => ({
      name: s.name,
      category: s.category,
      proficiency: s.proficiency_level,
      years: s.years_of_experience !== null ? parseFloat(s.years_of_experience) : null
    }))
  };
}

module.exports = {
  name: 'getCandidateProfile',
  description: 'Retrieve the candidate profile including education, professional summary, experience years, and categorized skills with proficiency levels.',
  parameters: {
    type: 'object',
    properties: {
      candidateId: {
        type: 'integer',
        description: 'Optional ID of the candidate profile. If omitted, uses the active candidate profile.'
      }
    }
  },
  execute: getCandidateProfile
};
