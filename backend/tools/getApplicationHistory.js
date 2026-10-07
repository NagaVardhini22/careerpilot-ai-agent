/**
 * Tool: getApplicationHistory
 * Purpose: Retrieve previous job analyses and application-related records.
 */

const db = require('../config/db');

async function getApplicationHistory(args = {}) {
  let candidateId = args.candidateId;

  if (!candidateId) {
    const defaultProfile = await db.query('SELECT id FROM candidate_profiles ORDER BY id ASC LIMIT 1');
    if (defaultProfile.length > 0) {
      candidateId = defaultProfile[0].id;
    }
  }

  const limit = Math.min(Math.max(parseInt(args.limit || 10, 10), 1), 50);

  if (!candidateId) {
    return {
      candidateId: null,
      totalApplications: 0,
      totalAnalyses: 0,
      applications: [],
      pastAnalyses: [],
      message: 'No candidate profile found. Create a profile to view application history.'
    };
  }

  // 1. Fetch Applications
  const applicationRows = await db.query(
    `SELECT a.id, a.status, a.applied_date, a.notes, a.created_at,
            j.id AS job_id, j.title AS job_title, j.company, j.location, j.work_mode
     FROM applications a
     JOIN jobs j ON a.job_id = j.id
     WHERE a.candidate_id = ?
     ORDER BY a.created_at DESC
     LIMIT ?`,
    [candidateId, limit]
  );

  // 2. Fetch Recent Job Analyses
  const analysisRows = await db.query(
    `SELECT ja.id, ja.match_score, ja.matched_skills, ja.missing_skills, 
            ja.interview_readiness, ja.created_at,
            j.id AS job_id, j.title AS job_title, j.company
     FROM job_analyses ja
     JOIN jobs j ON ja.job_id = j.id
     WHERE ja.candidate_id = ?
     ORDER BY ja.created_at DESC
     LIMIT ?`,
    [candidateId, limit]
  );

  const applications = applicationRows.map(app => ({
    id: app.id,
    jobId: app.job_id,
    jobTitle: app.job_title,
    company: app.company,
    location: app.location,
    workMode: app.work_mode,
    status: app.status,
    appliedDate: app.applied_date,
    notes: app.notes
  }));

  const pastAnalyses = analysisRows.map(an => {
    let matched = [];
    let missing = [];
    try {
      matched = typeof an.matched_skills === 'string' ? JSON.parse(an.matched_skills) : an.matched_skills;
      missing = typeof an.missing_skills === 'string' ? JSON.parse(an.missing_skills) : an.missing_skills;
    } catch {
      matched = [];
      missing = [];
    }

    return {
      id: an.id,
      jobId: an.job_id,
      jobTitle: an.job_title,
      company: an.company,
      matchScore: an.match_score,
      interviewReadiness: an.interview_readiness,
      matchedSkillsCount: matched.length,
      missingSkillsCount: missing.length,
      analyzedAt: an.created_at
    };
  });

  return {
    candidateId,
    totalApplications: applications.length,
    totalAnalyses: pastAnalyses.length,
    applications,
    pastAnalyses
  };
}

module.exports = {
  name: 'getApplicationHistory',
  description: 'Retrieve previous job analyses and application tracking records for the candidate.',
  parameters: {
    type: 'object',
    properties: {
      candidateId: {
        type: 'integer',
        description: 'Optional ID of the candidate. Defaults to active profile.'
      },
      limit: {
        type: 'integer',
        description: 'Maximum number of history records to retrieve.'
      }
    }
  },
  execute: getApplicationHistory
};
