/**
 * Tool: calculateJobMatch
 * Purpose: Compare candidate skills with job requirements.
 * Returns match score, matched skills, missing skills, and actionable recommendations.
 */

const db = require('../config/db');

async function calculateJobMatch(args = {}) {
  let { jobId, candidateId } = args;

  // Resolve candidateId if omitted
  if (!candidateId) {
    const defaultProfile = await db.query('SELECT id FROM candidate_profiles ORDER BY id ASC LIMIT 1');
    if (defaultProfile.length > 0) {
      candidateId = defaultProfile[0].id;
    } else {
      throw new Error('No candidate profile exists to calculate match against. Please create a profile first.');
    }
  }

  // Resolve jobId if omitted (e.g. choose first saved job)
  if (!jobId) {
    const defaultJob = await db.query('SELECT id FROM jobs WHERE status = "saved" ORDER BY id ASC LIMIT 1');
    if (defaultJob.length > 0) {
      jobId = defaultJob[0].id;
    } else {
      throw new Error('No saved jobs found to match against. Please add or save a job first.');
    }
  }

  // 1. Fetch Job
  const jobRows = await db.query('SELECT * FROM jobs WHERE id = ?', [jobId]);
  if (!jobRows || jobRows.length === 0) {
    throw new Error(`Job with ID ${jobId} not found.`);
  }
  const job = jobRows[0];
  let requiredSkills = [];
  try {
    requiredSkills = typeof job.required_skills === 'string' ? JSON.parse(job.required_skills) : (job.required_skills || []);
  } catch {
    requiredSkills = [];
  }

  // 2. Fetch Candidate Skills
  const candidateSkillsRows = await db.query(
    `SELECT s.name, cs.proficiency_level, cs.years_of_experience
     FROM candidate_skills cs
     JOIN skills s ON cs.skill_id = s.id
     WHERE cs.candidate_id = ?`,
    [candidateId]
  );

  const candidateSkillMap = new Map();
  candidateSkillsRows.forEach(row => {
    candidateSkillMap.set(row.name.toLowerCase().trim(), {
      name: row.name,
      proficiency: row.proficiency_level,
      years: parseFloat(row.years_of_experience)
    });
  });

  // 3. Match Evaluation
  const matchedSkills = [];
  const missingSkills = [];
  let proficiencyPoints = 0;

  requiredSkills.forEach(reqSkill => {
    const key = reqSkill.toLowerCase().trim();
    if (candidateSkillMap.has(key)) {
      const cand = candidateSkillMap.get(key);
      matchedSkills.push(cand.name);
      if (cand.proficiency === 'Expert') proficiencyPoints += 1.0;
      else if (cand.proficiency === 'Advanced') proficiencyPoints += 0.9;
      else if (cand.proficiency === 'Intermediate') proficiencyPoints += 0.75;
      else proficiencyPoints += 0.5;
    } else {
      missingSkills.push(reqSkill);
    }
  });

  // Calculate normalized match score
  let matchScore = 0;
  if (requiredSkills.length > 0) {
    const baseRatio = matchedSkills.length / requiredSkills.length;
    const weightedRatio = matchedSkills.length > 0 ? (proficiencyPoints / requiredSkills.length) : 0;
    matchScore = Math.round((baseRatio * 0.7 + weightedRatio * 0.3) * 100);
  } else {
    matchScore = 75;
  }
  matchScore = Math.min(100, Math.max(10, matchScore));

  let interviewReadiness = 'Low';
  if (matchScore >= 85) interviewReadiness = 'High';
  else if (matchScore >= 65) interviewReadiness = 'Moderate';

  const keyStrengths = matchedSkills.map(skill => {
    const info = candidateSkillMap.get(skill.toLowerCase());
    return `${skill} (${info ? info.proficiency : 'Proficient'}, ${info ? info.years : 1}+ yrs)`;
  });

  const recommendations = [];
  if (missingSkills.length > 0) {
    recommendations.push(`Familiarize yourself with core concepts of: ${missingSkills.join(', ')}.`);
    recommendations.push(`Prepare to speak to transferable skills from ${matchedSkills.slice(0, 2).join(' & ') || 'prior experience'} to bridge the gap with ${missingSkills[0]}.`);
  } else {
    recommendations.push(`Strong direct match! Emphasize leadership and deep architectural proficiency in ${matchedSkills.slice(0, 3).join(', ')}.`);
  }
  recommendations.push(`Review key architectural patterns for ${job.title} roles at ${job.company}.`);

  return {
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    candidateId,
    matchScore,
    interviewReadiness,
    requiredSkillsCount: requiredSkills.length,
    matchedSkillsCount: matchedSkills.length,
    matchedSkills,
    missingSkills,
    keyStrengths,
    recommendations
  };
}

module.exports = {
  name: 'calculateJobMatch',
  description: 'Calculate compatibility match score between candidate profile and a specific job, identifying matched skills, missing skills, and tailored recommendations.',
  parameters: {
    type: 'object',
    properties: {
      jobId: {
        type: 'integer',
        description: 'The ID of the job to match against candidate skills.'
      },
      candidateId: {
        type: 'integer',
        description: 'Optional ID of the candidate profile. If omitted, uses active candidate profile.'
      }
    }
  },
  execute: calculateJobMatch
};
